import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://teachmater.lovable.app',
  'https://id-preview--50abb99d-e699-4e11-920c-db8e0dcc3ffe.lovable.app',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  };
}

type QuizQuestionType = 'single' | 'multi' | 'tf' | 'short';

type Counts = {
  single?: number;
  multi?: number;
  tf?: number;
  short?: number;
};

interface GenerateRequestBody {
  courseName: string;
  knowledgePoints: string[];
  difficulty?: 'basic' | 'medium' | 'hard';
  counts?: Counts;
  lang?: string;
}

interface GeneratedQuestion {
  type: QuizQuestionType;
  content: string;
  options: string[];
  correct_answer: string | string[];
  tags: string;
}

function clampCount(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(20, Math.floor(value as number)));
}

function sanitizeQuestions(rawList: any[], fallbackTag: string): GeneratedQuestion[] {
  const result: GeneratedQuestion[] = [];

  for (const raw of rawList) {
    const type = raw?.type as QuizQuestionType;
    const content = typeof raw?.content === 'string' ? raw.content.trim() : '';
    const tags = typeof raw?.tags === 'string' && raw.tags.trim() ? raw.tags.trim() : fallbackTag;

    if (!content || !['single', 'multi', 'tf', 'short'].includes(type)) continue;

    if (type === 'single') {
      const options = Array.isArray(raw?.options) ? raw.options.map((o: any) => String(o).trim()).filter(Boolean) : [];
      const answer = typeof raw?.correct_answer === 'string' ? raw.correct_answer.trim().toUpperCase() : 'A';
      if (options.length < 2) continue;
      result.push({
        type,
        content,
        options,
        correct_answer: /^[A-F]$/.test(answer) ? answer : 'A',
        tags,
      });
      continue;
    }

    if (type === 'multi') {
      const options = Array.isArray(raw?.options) ? raw.options.map((o: any) => String(o).trim()).filter(Boolean) : [];
      const answers = Array.isArray(raw?.correct_answer)
        ? Array.from(new Set(raw.correct_answer.map((a: any) => String(a).trim().toUpperCase()).filter((a: string) => /^[A-F]$/.test(a))))
        : [];
      if (options.length < 2) continue;
      result.push({
        type,
        content,
        options,
        correct_answer: answers.length > 0 ? answers : ['A'],
        tags,
      });
      continue;
    }

    if (type === 'tf') {
      const answer = typeof raw?.correct_answer === 'string' ? raw.correct_answer.trim().toUpperCase() : 'A';
      result.push({
        type,
        content,
        options: ['正确', '错误'],
        correct_answer: answer === 'B' ? 'B' : 'A',
        tags,
      });
      continue;
    }

    result.push({
      type: 'short',
      content,
      options: [],
      correct_answer: typeof raw?.correct_answer === 'string' ? raw.correct_answer.trim() : '',
      tags,
    });
  }

  return result;
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json() as GenerateRequestBody;
    const courseName = body?.courseName?.trim();
    const knowledgePoints = Array.isArray(body?.knowledgePoints)
      ? body.knowledgePoints.map((p) => String(p).trim()).filter(Boolean)
      : [];

    if (!courseName) {
      return new Response(JSON.stringify({ error: 'Course name required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (knowledgePoints.length === 0) {
      return new Response(JSON.stringify({ error: 'Knowledge points required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const counts = {
      single: clampCount(body?.counts?.single),
      multi: clampCount(body?.counts?.multi),
      tf: clampCount(body?.counts?.tf),
      short: clampCount(body?.counts?.short),
    };
    const total = counts.single + counts.multi + counts.tf + counts.short;
    if (total <= 0) {
      return new Response(JSON.stringify({ error: 'Question count must be greater than 0' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const languageHint = body?.lang === 'en' ? 'English' : 'Chinese';
    const difficultyMap: Record<string, string> = {
      basic: 'entry-level, recall and understanding focus',
      medium: 'intermediate, understanding + application focus',
      hard: 'advanced, analysis and synthesis focus',
    };
    const difficulty = difficultyMap[body?.difficulty || 'medium'] || difficultyMap.medium;

    const systemPrompt = `You are an experienced teacher and assessment designer.
Generate high-quality quiz questions strictly as structured JSON through tool calling.

Constraints:
- Course: ${courseName}
- Knowledge points: ${knowledgePoints.join(', ')}
- Difficulty: ${difficulty}
- Language: ${languageHint}
- Required count by type: single=${counts.single}, multi=${counts.multi}, tf=${counts.tf}, short=${counts.short}

Quality rules:
- Questions must align with listed knowledge points and avoid repetition.
- single: exactly one correct option, 4 options preferred.
- multi: at least two correct options, 4-5 options preferred.
- tf: correct_answer must be "A" (true) or "B" (false).
- short: concise prompt with a model answer.
- correct_answer for single should be one letter like "A".
- correct_answer for multi should be an array like ["A","C"].
- tags should include course name and one key knowledge point.
- Return exactly the requested quantity.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate quiz questions now.' },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_quiz_questions',
            description: 'Generate quiz questions for classroom assessment',
            parameters: {
              type: 'object',
              properties: {
                questions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['single', 'multi', 'tf', 'short'] },
                      content: { type: 'string' },
                      options: { type: 'array', items: { type: 'string' } },
                      correct_answer: {
                        oneOf: [
                          { type: 'string' },
                          { type: 'array', items: { type: 'string' } },
                        ],
                      },
                      tags: { type: 'string' },
                    },
                    required: ['type', 'content', 'options', 'correct_answer', 'tags'],
                  },
                },
              },
              required: ['questions'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'generate_quiz_questions' } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited' }), {
          status: 429,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required' }), {
          status: 402,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      const text = await response.text();
      console.error('generate-quiz-questions AI error:', response.status, text);
      return new Response(JSON.stringify({ error: 'AI generation failed' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await response.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: 'No generation result' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const fallbackTag = `${courseName} ${knowledgePoints.join('、')}`.trim();
    const sanitized = sanitizeQuestions(Array.isArray(parsed?.questions) ? parsed.questions : [], fallbackTag);

    return new Response(JSON.stringify({
      questions: sanitized,
      requested: counts,
      generated: sanitized.length,
    }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('generate-quiz-questions error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
