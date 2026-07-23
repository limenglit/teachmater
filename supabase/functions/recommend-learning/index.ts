import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface ErrorItem {
  word: string;
  definition?: string;
  count?: number;
}

interface RequestBody {
  setTitle?: string;
  audience?: string;
  errors: ErrorItem[];
  lang?: string;
}

interface Recommendation {
  topic: string;
  explanation: string;
  examples: string[];
  memoryTip: string;
  bilibiliQuery: string;
  bilibiliUrl: string;
  youtubeUrl: string;
}

interface AIResponse {
  summary: string;
  weakAreas: string[];
  recommendations: Recommendation[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: quotaOk } = await svc.rpc('consume_ai_quota', { p_user_id: user.id });
    if (quotaOk === false) {
      return new Response(JSON.stringify({ error: 'AI 配额已用尽' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY 未配置' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as RequestBody;
    const errors = Array.isArray(body.errors) ? body.errors.filter(e => e && e.word) : [];

    if (errors.length === 0) {
      return new Response(JSON.stringify({ error: '暂无错题数据，无法生成推荐' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const freq = new Map<string, ErrorItem>();
    for (const e of errors) {
      const key = e.word.trim().toLowerCase();
      const existing = freq.get(key);
      if (existing) {
        existing.count = (existing.count ?? 1) + (e.count ?? 1);
      } else {
        freq.set(key, { word: e.word.trim(), definition: e.definition ?? '', count: e.count ?? 1 });
      }
    }
    const sortedErrors = Array.from(freq.values())
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .slice(0, 12);

    const errorList = sortedErrors
      .map((e, i) => `${i + 1}. 「${e.word}」（释义：${e.definition || '无'}）— 错${e.count}次`)
      .join('\n');

    const systemPrompt = `你是一名经验丰富的中文学习辅导老师。学生在词库练习中遇到困难，请基于错题清单，为学生生成个性化的学习资料推荐。

要求：
1. 先用2-3句话总结学生薄弱的知识点。
2. 针对错题归纳3-5个学习主题（避免逐词重复）。
3. 每个主题给出：通俗易懂的讲解、2-3个例句或情境、1条记忆/学习技巧、一个适合在哺哩哔哩搜索的中文关键词。
4. 输出严格 JSON，不要 markdown 代码块。

JSON 结构：
{
  "summary": "学生整体薄弱点的简短总结",
  "weakAreas": ["薄弱知识点1", "薄弱知识点2"],
  "recommendations": [
    {
      "topic": "学习主题",
      "explanation": "通俗讲解（80-150字）",
      "examples": ["例句/情境1", "例句/情境2"],
      "memoryTip": "记忆技巧（1-2句）",
      "bilibiliQuery": "B站搜索关键词"
    }
  ]
}`;

    const userPrompt = `词库名称：${body.setTitle || '未命名词库'}
适用对象：${body.audience || '通用'}
错题清单（按错误频次排序）：
${errorList}

请生成 JSON 格式的个性化学习推荐。`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: 'AI 请求过于频繁，请稍后再试' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: 'AI 额度已用尽，请联系管理员充值' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!resp.ok) {
      console.error('recommend-learning AI error', resp.status);
      return new Response(JSON.stringify({ error: 'AI 调用失败' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '{}';

    let parsed: AIResponse;
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { summary: '', weakAreas: [], recommendations: [] };
    }

    const recommendations: Recommendation[] = (parsed.recommendations || []).map((r) => {
      const q = (r.bilibiliQuery || r.topic || '').trim();
      const encoded = encodeURIComponent(q);
      return {
        topic: r.topic || '',
        explanation: r.explanation || '',
        examples: Array.isArray(r.examples) ? r.examples : [],
        memoryTip: r.memoryTip || '',
        bilibiliQuery: q,
        bilibiliUrl: `https://search.bilibili.com/all?keyword=${encoded}`,
        youtubeUrl: `https://www.youtube.com/results?search_query=${encoded}`,
      };
    });

    return new Response(
      JSON.stringify({
        summary: parsed.summary || '',
        weakAreas: parsed.weakAreas || [],
        recommendations,
        errorCount: sortedErrors.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('recommend-learning error', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
