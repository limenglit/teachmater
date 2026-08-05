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

interface ProblemItem {
  problem: string;
  evidence: string;
  severity: 'high' | 'medium' | 'low';
  relatedQuestionIndexes: number[];
}

interface KnowledgePoint {
  name: string;
  description: string;
  mastery: 'weak' | 'partial' | 'ok';
  relatedProblems: string[];
}

interface LearningStep {
  step: number;
  title: string;
  goal: string;
  action: string;
  minutes: number;
  searchQuery: string;
  bilibiliUrl?: string;
  youtubeUrl?: string;
}

interface PracticeQuestion {
  question: string;
  type: 'single' | 'multi' | 'tf' | 'short';
  options: string[];
  answer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  knowledgePoint: string;
}

interface AIResponse {
  summary: string;
  weakAreas: string[];
  problems: ProblemItem[];
  knowledgePoints: KnowledgePoint[];
  learningPath: LearningStep[];
  practiceQuestions: PracticeQuestion[];
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

    const systemPrompt = `你是一名资深教师，擅长根据学生答题错误定位薄弱知识点并给出结构化的个性化学习方案。

请输出四大结构化板块：
A. 存在问题（problems）：2-5 条，说明学生具体暴露了什么问题（概念理解、审题失误、记忆混淆、方法不当等），给出题目证据（evidence）、严重程度 severity（high/medium/low）与覆盖题号 relatedQuestionIndexes（输入清单序号，从 1 开始）。
B. 对应知识点（knowledgePoints）：2-6 条，每条给出知识点名称、一句话说明、掌握程度 mastery（weak/partial/ok）、以及它对应的问题描述数组 relatedProblems。
C. 建议学习路径（learningPath）：3-5 个有先后顺序的步骤，每步含 step 序号、标题、目标 goal、具体行动 action、预计时长 minutes（整数分钟）、一个适合搜索的中文关键词 searchQuery。
D. 可直接练习的题目（practiceQuestions）：4-8 道新题（不要照抄错题），字段：question、type（single/multi/tf/short）、options（选择题给 2-4 项，非选择题给空数组）、answer（标准答案）、explanation（简明解析）、difficulty（easy/medium/hard）、knowledgePoint（对应上面的知识点名称）。

另外保留：summary（2-3 句整体总结）、weakAreas（薄弱点短标签数组）、recommendations（2-5 个学习主题，含 topic/rootCause/explanation/examples/memoryTip/bilibiliQuery/relatedQuestionIndexes）。

严格输出 JSON，禁止 markdown 代码块。

JSON 结构：
{
  "summary": "整体薄弱点总结",
  "weakAreas": ["薄弱点1"],
  "problems": [{"problem":"问题描述","evidence":"题目证据","severity":"high","relatedQuestionIndexes":[1]}],
  "knowledgePoints": [{"name":"知识点","description":"一句话说明","mastery":"weak","relatedProblems":["问题描述"]}],
  "learningPath": [{"step":1,"title":"步骤标题","goal":"目标","action":"具体行动","minutes":15,"searchQuery":"搜索关键词"}],
  "practiceQuestions": [{"question":"题干","type":"single","options":["A项","B项"],"answer":"正确答案","explanation":"解析","difficulty":"easy","knowledgePoint":"知识点"}],
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

    const resp = await callAIWithFallback({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
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

    const empty: AIResponse = {
      summary: '', weakAreas: [], problems: [], knowledgePoints: [],
      learningPath: [], practiceQuestions: [], recommendations: [],
    };
    let parsed: AIResponse;
    try { parsed = JSON.parse(content); }
    catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : empty;
    }

    const searchUrls = (raw: string) => {
      const encoded = encodeURIComponent((raw || '').trim());
      return {
        bilibiliUrl: `https://search.bilibili.com/all?keyword=${encoded}`,
        youtubeUrl: `https://www.youtube.com/results?search_query=${encoded}`,
      };
    };

    const recommendations: Recommendation[] = (parsed.recommendations || []).map((r) => {
      const q = (r.bilibiliQuery || r.topic || '').trim();
      return {
        topic: r.topic || '',
        rootCause: r.rootCause || '',
        explanation: r.explanation || '',
        examples: Array.isArray(r.examples) ? r.examples : [],
        memoryTip: r.memoryTip || '',
        bilibiliQuery: q,
        ...searchUrls(q),
        relatedQuestionIndexes: Array.isArray(r.relatedQuestionIndexes) ? r.relatedQuestionIndexes : [],
      };
    });

    const problems: ProblemItem[] = (parsed.problems || []).map((p) => ({
      problem: p.problem || '',
      evidence: p.evidence || '',
      severity: (['high', 'medium', 'low'].includes(p.severity) ? p.severity : 'medium') as ProblemItem['severity'],
      relatedQuestionIndexes: Array.isArray(p.relatedQuestionIndexes) ? p.relatedQuestionIndexes : [],
    })).filter(p => p.problem);

    const knowledgePoints: KnowledgePoint[] = (parsed.knowledgePoints || []).map((k) => ({
      name: k.name || '',
      description: k.description || '',
      mastery: (['weak', 'partial', 'ok'].includes(k.mastery) ? k.mastery : 'partial') as KnowledgePoint['mastery'],
      relatedProblems: Array.isArray(k.relatedProblems) ? k.relatedProblems : [],
    })).filter(k => k.name);

    const learningPath: LearningStep[] = (parsed.learningPath || []).map((s, i) => {
      const q = (s.searchQuery || s.title || '').trim();
      return {
        step: typeof s.step === 'number' ? s.step : i + 1,
        title: s.title || '',
        goal: s.goal || '',
        action: s.action || '',
        minutes: typeof s.minutes === 'number' ? s.minutes : 15,
        searchQuery: q,
        ...searchUrls(q),
      };
    }).filter(s => s.title).sort((a, b) => a.step - b.step);

    const practiceQuestions: PracticeQuestion[] = (parsed.practiceQuestions || []).map((p) => ({
      question: p.question || '',
      type: (['single', 'multi', 'tf', 'short'].includes(p.type) ? p.type : 'short') as PracticeQuestion['type'],
      options: Array.isArray(p.options)
        ? p.options.map((o) => String(o ?? '').replace(/^\s*[A-Za-zＡ-Ｚa-z]\s*[.、．:：)）]\s*/, '').trim()).filter(Boolean)
        : [],
      answer: p.answer || '',
      explanation: p.explanation || '',
      difficulty: (['easy', 'medium', 'hard'].includes(p.difficulty) ? p.difficulty : 'medium') as PracticeQuestion['difficulty'],
      knowledgePoint: p.knowledgePoint || '',
    })).filter(p => p.question);

    return new Response(
      JSON.stringify({
        summary: parsed.summary || '',
        weakAreas: parsed.weakAreas || [],
        problems,
        knowledgePoints,
        learningPath,
        practiceQuestions,
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
