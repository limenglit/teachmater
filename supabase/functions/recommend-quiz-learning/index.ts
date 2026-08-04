const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface WrongItem {
  index: number;
  type: 'single' | 'multi' | 'tf' | 'short';
  question: string;
  options?: string[];
  correctAnswer?: string;
  studentAnswer?: string;
}

interface RequestBody {
  sessionTitle?: string;
  wrongs: WrongItem[];
}

interface Recommendation {
  topic: string;
  rootCause: string;
  explanation: string;
  examples: string[];
  memoryTip: string;
  bilibiliQuery: string;
  bilibiliUrl: string;
  youtubeUrl: string;
  relatedQuestionIndexes: number[];
}

interface AIResponse {
  summary: string;
  weakAreas: string[];
  recommendations: Recommendation[];
}

/** Lovable AI 优先；额度耗尽/限流/异常时自动降级 DeepSeek */
async function callAIWithFallback(body: Record<string, unknown>): Promise<Response> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY');

  const callDeepSeek = () => {
    if (!deepseekKey) return null;
    console.log('falling back to DeepSeek');
    return fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${deepseekKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, model: 'deepseek-chat' }),
    });
  };

  if (!lovableKey) {
    const ds = callDeepSeek();
    if (ds) return ds;
    throw new Error('LOVABLE_API_KEY 未配置');
  }

  let primary: Response;
  try {
    primary = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const ds = callDeepSeek();
    if (ds) return ds;
    throw e;
  }

  if (primary.ok || (primary.status !== 402 && primary.status !== 429 && primary.status < 500)) {
    return primary;
  }
  const ds = callDeepSeek();
  return ds ?? primary;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!Deno.env.get('LOVABLE_API_KEY') && !Deno.env.get('DEEPSEEK_API_KEY')) {
      return new Response(JSON.stringify({ error: 'AI 服务未配置' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    const body = (await req.json()) as RequestBody;
    const wrongs = Array.isArray(body.wrongs)
      ? body.wrongs.filter(w => w && typeof w.question === 'string' && w.question.trim().length > 0).slice(0, 30)
      : [];

    if (wrongs.length === 0) {
      return new Response(JSON.stringify({ error: '没有错题，无需生成推荐' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const wrongList = wrongs.map((w, i) => {
      const opts = (w.options && w.options.length > 0)
        ? '\n   选项：' + w.options.map((o, j) => `${String.fromCharCode(65 + j)}.${o}`).join(' / ')
        : '';
      return `${i + 1}. 【${w.type}】${w.question}${opts}\n   正确答案：${w.correctAnswer || '未提供'}\n   学生作答：${w.studentAnswer || '未作答'}`;
    }).join('\n\n');

    const systemPrompt = `你是一名资深教师，擅长根据学生答题错误定位薄弱知识点并给出个性化学习建议。

要求：
1. 先用 2-3 句话总结学生答错这些题时暴露的整体薄弱点。
2. 归纳 2-5 个学习主题（可跨题合并），每个主题要指出错误根源（rootCause）——是概念理解、审题失误、记忆混淆还是方法不当。
3. 每个主题给出：通俗易懂的讲解、2-3 个例句或情境、1 条记忆/学习技巧、一个适合在哔哩哔哩搜索的中文关键词，以及该主题覆盖的题号数组（relatedQuestionIndexes，使用输入清单里的序号，从 1 开始）。
4. 严格输出 JSON，禁止 markdown 代码块。

JSON 结构：
{
  "summary": "整体薄弱点总结",
  "weakAreas": ["薄弱点1", "薄弱点2"],
  "recommendations": [
    {
      "topic": "学习主题",
      "rootCause": "错误根源（1-2句）",
      "explanation": "通俗讲解（80-150字）",
      "examples": ["例句1", "例句2"],
      "memoryTip": "记忆技巧",
      "bilibiliQuery": "B站搜索关键词",
      "relatedQuestionIndexes": [1, 2]
    }
  ]
}`;

    const userPrompt = `测验名称：${body.sessionTitle || '未命名测验'}
学生错题清单：
${wrongList}

请生成 JSON 格式的个性化学习推荐。`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
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
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: 'AI 额度已用尽，请联系管理员充值' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!resp.ok) {
      const text = await resp.text();
      return new Response(JSON.stringify({ error: `AI 调用失败: ${text.slice(0, 200)}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '{}';

    let parsed: AIResponse;
    try { parsed = JSON.parse(content); }
    catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { summary: '', weakAreas: [], recommendations: [] };
    }

    const recommendations: Recommendation[] = (parsed.recommendations || []).map((r) => {
      const q = (r.bilibiliQuery || r.topic || '').trim();
      const encoded = encodeURIComponent(q);
      return {
        topic: r.topic || '',
        rootCause: r.rootCause || '',
        explanation: r.explanation || '',
        examples: Array.isArray(r.examples) ? r.examples : [],
        memoryTip: r.memoryTip || '',
        bilibiliQuery: q,
        bilibiliUrl: `https://search.bilibili.com/all?keyword=${encoded}`,
        youtubeUrl: `https://www.youtube.com/results?search_query=${encoded}`,
        relatedQuestionIndexes: Array.isArray(r.relatedQuestionIndexes) ? r.relatedQuestionIndexes : [],
      };
    });

    return new Response(
      JSON.stringify({
        summary: parsed.summary || '',
        weakAreas: parsed.weakAreas || [],
        recommendations,
        wrongCount: wrongs.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || '服务器异常' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
