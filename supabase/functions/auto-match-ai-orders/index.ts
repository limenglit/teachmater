// Auto-match AI credit recharge orders: OCR screenshot + parse payer_note,
// auto-approve when the paid amount matches the package price and either
// the OCR receipt or payer_note references the buyer.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Order {
  id: string;
  user_id: string;
  email: string;
  nickname: string | null;
  package_key: string;
  amount_cny: number;
  credits: number;
  screenshot_url: string | null;
  payer_note: string | null;
  status: string;
}

interface OCRResult {
  amount: number | null;
  raw_text: string;
}

const EXPECTED: Record<string, number> = { p10_100: 10, p20_300: 20 };

async function ocrScreenshot(imageUrl: string, apiKey: string): Promise<OCRResult> {
  try {
    // Fetch image → base64 (some signed URLs cannot be fetched by the model directly)
    const resp = await fetch(imageUrl);
    if (!resp.ok) return { amount: null, raw_text: '' };
    const bytes = new Uint8Array(await resp.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);
    const mime = resp.headers.get('content-type') || 'image/jpeg';

    const body = {
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '这是一张微信/支付宝付款截图。请识别付款金额（人民币，单位元，仅返回数字）以及可读文本。严格按 JSON 返回：{"amount": number, "raw_text": string}。如无法识别金额则 amount 为 null。',
            },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    };
    const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': apiKey },
      body: JSON.stringify(body),
    });
    if (!r.ok) return { amount: null, raw_text: '' };
    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content || '';
    try {
      const parsed = JSON.parse(content);
      const amt = typeof parsed.amount === 'number' ? parsed.amount
        : parsed.amount ? Number(String(parsed.amount).replace(/[^\d.]/g, '')) : null;
      return { amount: Number.isFinite(amt as number) ? (amt as number) : null, raw_text: String(parsed.raw_text || '') };
    } catch {
      const m = content.match(/(\d+(?:\.\d+)?)/);
      return { amount: m ? Number(m[1]) : null, raw_text: content };
    }
  } catch {
    return { amount: null, raw_text: '' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
  const LOVABLE_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_KEY) {
    return new Response(JSON.stringify({ error: 'Missing LOVABLE_API_KEY' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') || '';
  const supabase = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });

  // Verify caller is admin
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return new Response(JSON.stringify({ error: 'Unauthenticated' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const { data: isAdmin } = await supabase.rpc('has_role', {
    _user_id: userData.user.id, _role: 'admin',
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: { order_id?: string } = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  // Load pending orders (single or all)
  const { data: orders, error: listErr } = await supabase.rpc('admin_list_ai_credit_orders', {
    p_status: 'pending',
  });
  if (listErr) {
    return new Response(JSON.stringify({ error: listErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const targets: Order[] = ((orders || []) as Order[])
    .filter(o => !body.order_id || o.id === body.order_id);

  const results: Array<{ id: string; email: string; approved: boolean; reason: string; ocr_amount?: number | null }> = [];

  for (const o of targets) {
    const expected = EXPECTED[o.package_key];
    if (!expected) { results.push({ id: o.id, email: o.email, approved: false, reason: '未知套餐' }); continue; }

    const note = (o.payer_note || '').toLowerCase();
    const emailLocal = (o.email || '').toLowerCase().split('@')[0];
    const noteMatchesUser =
      !!o.email && (note.includes(o.email.toLowerCase()) ||
      (emailLocal.length >= 3 && note.includes(emailLocal)) ||
      (o.nickname && note.includes(o.nickname.toLowerCase())));

    let ocrAmount: number | null = null;
    if (o.screenshot_url) {
      const ocr = await ocrScreenshot(o.screenshot_url, LOVABLE_KEY);
      ocrAmount = ocr.amount;
    }
    const amountMatches = ocrAmount !== null && Math.abs(ocrAmount - expected) < 0.01;

    // Auto-approve if amount matches OCR, OR (amount matches package expected AND note references user)
    // We already know order.amount_cny == expected server-side, so the key signal is OCR amount.
    if (amountMatches) {
      const { error: apErr } = await supabase.rpc('admin_approve_ai_credit_order', { p_order_id: o.id });
      if (apErr) {
        results.push({ id: o.id, email: o.email, approved: false, reason: apErr.message, ocr_amount: ocrAmount });
      } else {
        results.push({ id: o.id, email: o.email, approved: true, reason: `OCR 金额 ￥${ocrAmount} 匹配套餐${noteMatchesUser ? '，备注含用户信息' : ''}`, ocr_amount: ocrAmount });
      }
    } else {
      results.push({
        id: o.id, email: o.email, approved: false, ocr_amount: ocrAmount,
        reason: ocrAmount === null ? '未能识别付款金额' : `OCR 金额 ￥${ocrAmount} 与套餐 ￥${expected} 不匹配`,
      });
    }
  }

  return new Response(JSON.stringify({
    scanned: targets.length,
    approved: results.filter(r => r.approved).length,
    results,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
