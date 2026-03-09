import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface StoryboardParams {
  theme: string;
  audience: string;
  tone: string;
  panelCount: number;
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

  return `Create a hand-drawn style educational infographic illustration WITHOUT ANY TEXT.

CRITICAL REQUIREMENTS - NO TEXT POLICY:
- DO NOT include ANY text, labels, titles, numbers, letters, or written words in the image
- Leave BLANK banner/title areas at the top (empty rectangular space for overlay)
- Each panel should have EMPTY label placeholders (blank rounded rectangles or speech bubbles)
- All content must be purely visual - icons, characters, objects, symbols only

Topic: ${params.theme}
Target Audience: ${audienceMap[params.audience] || 'general audience'}
Tone: ${toneMap[params.tone] || 'educational'}

Visual Style Requirements:
- Hand-drawn sketch style with clean linework
- Flat colorful design with ${colorMap[params.colorScheme] || 'soft pastel colors'}
- Divided into ${params.panelCount} clear sections/panels with visual separators
- Include a prominent BLANK banner area at the top for title overlay
- Use simple icon-style characters and objects to convey meaning
- Each panel should have a distinct visual element representing the concept
- Educational poster/infographic layout with clear visual hierarchy
- Aspect ratio: ${params.aspectRatio}

DO NOT include:
- ANY text, labels, titles, numbers, or letters (CRITICAL!)
- Photorealistic elements
- Complex 3D graphics
- Watermarks or logos
- Any copyrighted characters

The final image should be a clean visual template ready for text overlay, with clear blank spaces where titles and labels would go.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { params } = await req.json() as { params: StoryboardParams };
    
    if (!params?.theme?.trim()) {
      return new Response(
        JSON.stringify({ error: "Theme is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = buildPrompt(params);
    console.log("Generated prompt:", prompt.substring(0, 200) + "...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error("No image returned from AI:", JSON.stringify(data).substring(0, 500));
      return new Response(
        JSON.stringify({ error: "No image generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ imageUrl, prompt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate storyboard error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
