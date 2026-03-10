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

    const { text, lang = "zh" } = await req.json();
    if (!text || text.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Text too short" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert text analyst. Analyze the given text and extract structured information for visualization.

Return a JSON object using tool calling with these fields:
- title: A concise title/summary (max 20 chars)
- summary: 1-2 sentence summary
- keywords: Array of 5-10 key terms/phrases
- structure_type: One of "flow", "comparison", "pyramid", "funnel", "timeline", "quadrant", "list", "hierarchy", "cycle"
- structure_nodes: Array of objects {label, description?, value?} representing the main points in logical order
- data_points: Array of objects {label, value, unit?} if numerical data is found, otherwise empty array
- suggested_chart: One of "bar", "line", "pie", "radar", "scatter", "none" based on data
- relationships: Array of {from, to, label?} for relationship mapping
- categories: Array of {name, items: string[]} for grouping

Language for output: ${lang === "zh" ? "Chinese" : lang === "ja" ? "Japanese" : lang === "ko" ? "Korean" : lang === "ru" ? "Russian" : "English"}`;

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
          { role: "user", content: text.slice(0, 5000) },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_visualization_data",
            description: "Extract structured data from text for visualization",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                summary: { type: "string" },
                keywords: { type: "array", items: { type: "string" } },
                structure_type: { type: "string", enum: ["flow", "comparison", "pyramid", "funnel", "timeline", "quadrant", "list", "hierarchy", "cycle"] },
                structure_nodes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      description: { type: "string" },
                      value: { type: "number" }
                    },
                    required: ["label"]
                  }
                },
                data_points: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      value: { type: "number" },
                      unit: { type: "string" }
                    },
                    required: ["label", "value"]
                  }
                },
                suggested_chart: { type: "string", enum: ["bar", "line", "pie", "radar", "scatter", "none"] },
                relationships: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      from: { type: "string" },
                      to: { type: "string" },
                      label: { type: "string" }
                    },
                    required: ["from", "to"]
                  }
                },
                categories: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      items: { type: "array", items: { type: "string" } }
                    },
                    required: ["name", "items"]
                  }
                }
              },
              required: ["title", "summary", "keywords", "structure_type", "structure_nodes", "data_points", "suggested_chart"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "extract_visualization_data" } },
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
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "No analysis result" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const analysisData = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(analysisData), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-text error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
