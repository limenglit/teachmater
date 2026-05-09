// Pure helpers extracted from index.ts so they can be unit-tested without
// booting the HTTP server.

export interface CardOut {
  word: string;
  definition: string;
  example?: string;
}

export const TOOL = {
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

// deno-lint-ignore no-explicit-any
export async function callLovableAI(messages: any[]): Promise<any> {
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

// deno-lint-ignore no-explicit-any
export async function callDeepSeek(messages: any[]): Promise<any> {
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

// deno-lint-ignore no-explicit-any
export function extractCards(json: any): CardOut[] {
  const tc = json?.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc?.function?.arguments) return [];
  try {
    const args = JSON.parse(tc.function.arguments);
    const arr = Array.isArray(args?.cards) ? args.cards : [];
    return arr
      // deno-lint-ignore no-explicit-any
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
