import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface StoryboardParams {
  theme: string;
  audience: string;
  tone: string;
  panelCount: number;
  layoutMode: string;
  textMode: string;
  aspectRatio: string;
  language: string;
  colorScheme: string;
  textDensity: string;
}

function buildPrompt(params: StoryboardParams): string {
  const audienceMap: Record<string, string> = {
    'middle-school': 'middle school students',
    'high-school': 'high school students',
    'college': 'college students',
    'teacher': 'teachers',
    'general': 'general audience',
  };
  const toneMap: Record<string, string> = {
    'educational': 'educational, easy to understand',
    'serious': 'serious, professional',
    'encouraging': 'encouraging, positive',
    'critical': 'critical thinking',
  };
  const colorMap: Record<string, string> = {
    'soft': 'soft pastel educational colors (light blue, mint green, warm yellow, soft pink)',
    'high-contrast': 'high contrast classroom colors (bright blue, orange, green, red)',
  };

  const isUnified = params.layoutMode === 'unified';
  const isEmbedded = params.textMode === 'embedded';

  const layoutInstructions = isUnified
    ? `UNIFIED CANVAS LAYOUT:
- Create ONE single cohesive scene/canvas, NOT divided into separate panels
- Use visual connectors to link concepts: curved arrows, dotted paths, flowing ribbons, gesture lines, road/river metaphors
- Arrange story elements organically across the canvas like a mind-map or journey map
- Use size variation, positioning, and visual flow to guide the viewer's eye through the narrative
- Elements should feel interconnected and part of one unified visual story
- Use directional cues (arrows, paths, numbered waypoints, winding roads) to show sequence and relationships`
    : `- Divided into ${params.panelCount} clear sections/panels with visual separators`;

  const textInstructions = isEmbedded
    ? `EMBEDDED TEXT MODE:
- DO include text labels directly embedded INTO visual elements within the image
- Write text ON banners, ribbons, signposts, road signs, speech bubbles, flags, badges, stamps, chalkboards, sticky notes, book covers, screens, and other visual containers
- Text should feel like a natural part of the illustration
- Use ${params.language === 'zh' ? 'Chinese' : 'English'} text on these visual elements
- Each key concept should have its label integrated into a fitting visual object
- Make text legible but artistically integrated
- DO NOT leave blank spaces for overlay - all text is part of the artwork`
    : `NO TEXT POLICY:
- DO NOT include ANY text, labels, titles, numbers, letters, or written words in the image
- Leave BLANK banner/title areas at the top (empty rectangular space for overlay)
- Each panel should have EMPTY label placeholders (blank rounded rectangles or speech bubbles)
- All content must be purely visual - icons, characters, objects, symbols only`;

  return `Create a hand-drawn style educational infographic illustration.

CRITICAL REQUIREMENTS - ${isEmbedded ? 'EMBEDDED TEXT' : 'NO TEXT'}:
${textInstructions}

Topic: ${params.theme}
Target Audience: ${audienceMap[params.audience] || 'general audience'}
Tone: ${toneMap[params.tone] || 'educational'}

Visual Style Requirements:
- Hand-drawn sketch style with clean linework
- Flat colorful design with ${colorMap[params.colorScheme] || 'soft pastel colors'}
${layoutInstructions}
- Use simple icon-style characters and objects to convey meaning
- Each concept should have a distinct visual element representing it
- Educational poster/infographic layout with clear visual hierarchy
- Aspect ratio: ${params.aspectRatio}
${isUnified ? '- Include connecting elements: arrows, curved paths, dotted lines, numbered stepping stones, flowing ribbons linking concepts' : ''}

DO NOT include:
${isEmbedded ? '- Text outside of visual containers (no floating text)' : '- ANY text, labels, titles, numbers, or letters (CRITICAL!)'}
- Photorealistic elements
- Complex 3D graphics
- Watermarks or logos
- Any copyrighted characters

The final image should be a ${isEmbedded ? 'complete illustrated infographic with text naturally embedded in visual elements' : 'clean visual template ready for text overlay, with clear blank spaces where titles and labels would go'}.`;
}

/* ── AI image call — no DeepSeek fallback for image generation ── */
async function callImageAI(body: Record<string, unknown>): Promise<Response> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

serve(async (req) => {
  
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { params } = await req.json() as { params: StoryboardParams };
    if (!params?.theme?.trim()) {
      return new Response(JSON.stringify({ error: "Theme is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = buildPrompt(params);

    const response = await callImageAI({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI 算力额度不足，图片生成暂不支持降级，请稍后再试" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error("No image returned from AI:", JSON.stringify(data).substring(0, 500));
      return new Response(JSON.stringify({ error: "No image generated" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ imageUrl, prompt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate storyboard error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
