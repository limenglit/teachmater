import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Body {
  topic: string;
  count?: number;
  audience?: string;
  hint?: string;
}

interface CardOut {
  word: string;
  definition: string;
  example?: string;
}

const SYSTEM_PROMPT = `你是教学词库设计助手。根据用户给出的主题，生成"消消乐"匹配学习卡片。
每张卡片包含一对配对内容：word（题面/术语/英文/缩写等），definition（对应的中文释义/解释/对照）。
- word 与 definition 必须语义一一对应、简洁、不超过 20 个字符（用于卡片显示）。
- 严禁重复；尽量覆盖经典/高频内容。
- 必要时可附 example（一句话示例，可省略）。
仅通过 emit_cards 工具返回结果，不要输出其他文本。`;

const TOOL = {
  type: 'function',
  function: {
    name: 'emit_cards',
    description: '输出生成的词库卡片',
    parameters: {
      type: 'object',
      properties: {
        cards: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              word: { type: 'string' },
              definition: { type: 'string' },
              example: { type: 'string' },
            },
            required: ['word', 'definition'],
            additionalProperties: false,
          },
        },
      },
      required: ['cards'],
      additionalProperties: false,
    },
  },
} as const;

function buildPrompt(b: Body): string {
  const audience = b.audience ? `适用对象：${b.audience}。` : '';
  const hint = b.hint ? `补充说明：${b.hint}。` : '';
  const count = Math.max(2, Math.min(40, b.count ?? 10));
  return `${audience}${hint}请围绕主题"${b.topic}"，生成 ${count} 对匹配卡片，调用 emit_cards 返回。`;
}

async function callLovableAI(messages: any[]): Promise<any> {
  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) throw new Error('LOVABLE_API_KEY missing');
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages,
      tools: [TOOL],
      tool_choice: { type: 'function', function: { name: 'emit_cards' } },
    }),
  });
  if (resp.status === 429) throw new Error('RATE_LIMIT');
  if (resp.status === 402) throw new Error('PAYMENT_REQUIRED');
  if (!resp.ok) throw new Error(`Lovable AI ${resp.status}: ${await resp.text()}`);
  return await resp.json();
}

async function callDeepSeek(messages: any[]): Promise<any> {
  const key = Deno.env.get('DEEPSEEK_API_KEY');
  if (!key) throw new Error('DEEPSEEK_API_KEY missing');
  const resp = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      tools: [TOOL],
      tool_choice: { type: 'function', function: { name: 'emit_cards' } },
    }),
  });
  if (!resp.ok) throw new Error(`DeepSeek ${resp.status}: ${await resp.text()}`);
  return await resp.json();
}

function extractCards(json: any): CardOut[] {
  const tc = json?.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc?.function?.arguments) return [];
  try {
    const args = JSON.parse(tc.function.arguments);
    const arr = Array.isArray(args?.cards) ? args.cards : [];
    return arr
      .map((c: any) => ({
        word: String(c?.word || '').trim(),
        definition: String(c?.definition || '').trim(),
        example: c?.example ? String(c.example).trim() : undefined,
      }))
      .filter((c: CardOut) => c.word && c.definition);
  } catch {
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  try {
    const body = (await req.json()) as Body;
    if (!body?.topic || typeof body.topic !== 'string') {
      return new Response(JSON.stringify({ error: '缺少 topic' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt(body) },
    ];

    let json: any;
    try {
      json = await callLovableAI(messages);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg === 'RATE_LIMIT') {
        return new Response(JSON.stringify({ error: 'AI 请求过于频繁，请稍后重试' }), {
          status: 429,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      // Fallback to DeepSeek on 402 / other errors
      console.warn('Lovable AI failed, falling back to DeepSeek:', msg);
      try {
        json = await callDeepSeek(messages);
      } catch (e2: any) {
        return new Response(JSON.stringify({ error: 'AI 生成失败：' + (e2?.message || msg) }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
    }

    const cards = extractCards(json);
    if (cards.length < 2) {
      return new Response(JSON.stringify({ error: 'AI 未返回有效卡片，请换个主题再试' }), {
        status: 422,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ cards }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('generate-vocab-cards error:', e);
    return new Response(JSON.stringify({ error: e?.message || 'unknown' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
