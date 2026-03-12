import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { courseName, topics, questionConfig, lang = "zh" } = await req.json();

    if (!courseName || !courseName.trim()) {
      return new Response(JSON.stringify({ error: "Course name is required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (!topics || topics.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Topics are required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(questionConfig) || questionConfig.length === 0) {
      return new Response(JSON.stringify({ error: "Question config is required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const totalCount = questionConfig.reduce((sum: number, c: { count: number }) => sum + c.count, 0);
    if (totalCount === 0) {
      return new Response(JSON.stringify({ error: "Total question count must be greater than 0" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const typeDescriptions: Record<string, string> = {
      single: lang === "zh" ? "单选题（4个选项A/B/C/D，1个正确答案）" : "Single-choice (4 options A/B/C/D, 1 correct answer)",
      multi: lang === "zh" ? "多选题（4个选项A/B/C/D，2-4个正确答案）" : "Multiple-choice (4 options A/B/C/D, 2-4 correct answers)",
      tf: lang === "zh" ? "判断题（正确/错误）" : "True/False question",
      short: lang === "zh" ? "简答题（无选项，有参考答案）" : "Short-answer question (no options, reference answer)",
    };

    const configDesc = questionConfig
      .map((c: { type: string; count: number }) => `${typeDescriptions[c.type] ?? c.type}: ${c.count}题`)
      .join("；");

    const systemPrompt = lang === "zh"
      ? `你是专业的教育测评专家。根据给定的课程名称和知识点，生成高质量的测试题目。
题目要求：
1. 贴合知识点，难度适中
2. 表述清晰准确，无歧义
3. 单选/多选题需有4个选项（A、B、C、D）
4. 判断题选项为["正确","错误"]，正确答案为"正确"或"错误"
5. 简答题提供详细参考答案
6. 题目标签使用课程名称`
      : `You are a professional education assessment expert. Generate high-quality quiz questions based on the given course and topics.
Requirements:
1. Aligned with the knowledge points, moderate difficulty
2. Clear and unambiguous wording
3. Single/multi-choice must have 4 options (A, B, C, D)
4. True/False options are ["True","False"], correct answer is "True" or "False"
5. Short-answer questions should have a detailed reference answer
6. Use the course name as the tag`;

    const userPrompt = lang === "zh"
      ? `课程名称：${courseName}
知识点：${topics}
题型与数量：${configDesc}

请生成符合要求的题目，用JSON工具调用返回。`
      : `Course: ${courseName}
Topics: ${topics}
Question types and counts: ${configDesc}

Please generate questions meeting the requirements, return via JSON tool call.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_quiz_questions",
            description: "Generate quiz questions for the given course and topics",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["single", "multi", "tf", "short"] },
                      content: { type: "string" },
                      options: { type: "array", items: { type: "string" } },
                      correct_answer: {},
                      tags: { type: "string" },
                    },
                    required: ["type", "content", "options", "correct_answer", "tags"],
                  },
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_quiz_questions" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "No generation result" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const generated = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(generated), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-quiz-questions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
