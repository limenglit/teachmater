import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAIWithFallback(body: Record<string, unknown>): Promise<Response> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const primary = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (primary.status !== 402) return primary;

  const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
  if (!DEEPSEEK_API_KEY) return primary;

  console.log("Lovable AI 402 → DeepSeek fallback");
  return fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...body, model: "deepseek-chat" }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: quotaOk } = await svc.rpc("consume_ai_quota", { p_user_id: user.id });
    if (quotaOk === false) {
      return new Response(JSON.stringify({ error: "AI quota exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      topic,
      audience = "",
      slideCount = 10,
      style = "icon",
      language = "zh-CN",
      model: requestedModel = "deepseek/deepseek-chat",
    } = await req.json();

    const ALLOWED_MODELS = new Set([
      "deepseek/deepseek-chat",
      "google/gemini-2.5-flash",
      "google/gemini-2.5-flash-lite",
    ]);
    const model = ALLOWED_MODELS.has(requestedModel) ? requestedModel : "deepseek/deepseek-chat";

    if (!topic || String(topic).trim().length < 3) {
      return new Response(JSON.stringify({ error: "Topic too short" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const langLabel: Record<string, string> = {
      "zh-CN": "Simplified Chinese",
      "en": "English",
      "ru": "Russian",
      "ja": "Japanese",
      "ko": "Korean",
      "es": "Spanish",
    };
    const targetLang = langLabel[language] || "Simplified Chinese";

    const systemPrompt = `You are an expert courseware designer. Produce a structured slide outline as STRICT JSON only (no markdown, no commentary).

Output schema:
{
  "title": "string",
  "subtitle": "string (optional)",
  "slides": [
    { "type": "title" | "toc" | "content" | "two-column" | "image-text" | "comparison" | "quote" | "timeline" | "conclusion",
      "title": "string",
      "bullets": ["..."],
      "leftTitle": "string", "leftBullets": ["..."],
      "rightTitle": "string", "rightBullets": ["..."],
      "quoteText": "string", "quoteAuthor": "string",
      "timelineItems": [{"year":"...","text":"..."}],
      "icon": "lucide-icon-name",
      "speakerNotes": "string"
    }
  ]
}

Rules:
- Produce roughly ${slideCount} slides (±2). First slide MUST be type "title". Second SHOULD be "toc". Last MUST be "conclusion".
- Mix slide types for visual variety based on content.
- Each content/two-column/comparison slide: 3-5 bullets, each ≤ 24 words.
- Write all human-readable text in ${targetLang}.
- Visual style hint: ${style}. Pick icons that match each slide topic (lucide-react names like book-open, lightbulb, target, zap, layers, users).
- Output JSON ONLY.`;

    const userPrompt = `Topic: ${topic}\nAudience: ${audience || "general learners"}\nDesired slide count: ${slideCount}\nReturn JSON only.`;

    const response = await callAIWithFallback({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "Payment required" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const txt = await response.text();
      console.error("AI error", response.status, txt);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text: string = data.choices?.[0]?.message?.content || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return new Response(JSON.stringify({ error: "No JSON in response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const outline = JSON.parse(match[0]);

    // Inject ids
    if (Array.isArray(outline.slides)) {
      outline.slides = outline.slides.map((s: Record<string, unknown>, i: number) => ({
        id: `s_${Date.now()}_${i}`,
        ...s,
      }));
    }

    return new Response(JSON.stringify({ outline }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-courseware-outline", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
