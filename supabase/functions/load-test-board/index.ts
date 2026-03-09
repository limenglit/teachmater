import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Load test: simulate N students concurrently uploading photos + inserting cards.
 * POST body: { boardId: string, studentCount?: number }
 * Each simulated student:
 *   1. Uploads a small generated PNG to storage
 *   2. Inserts a board_card row referencing that image
 * Returns timing stats and per-student results.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { boardId, studentCount = 100 } = await req.json();
    if (!boardId) {
      return new Response(JSON.stringify({ error: "boardId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const count = Math.min(Math.max(1, studentCount), 200); // cap at 200

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify board exists
    const { data: board, error: boardErr } = await supabase
      .from("boards")
      .select("id, title, is_locked")
      .eq("id", boardId)
      .single();

    if (boardErr || !board) {
      return new Response(JSON.stringify({ error: "Board not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (board.is_locked) {
      return new Response(JSON.stringify({ error: "Board is locked" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a tiny 1x1 PNG for each student (minimal payload to test concurrency)
    const tinyPng = new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10, // PNG signature
      0, 0, 0, 13, 73, 72, 68, 82, // IHDR chunk
      0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0,
      144, 119, 83, 222, // CRC
      0, 0, 0, 12, 73, 68, 65, 84, // IDAT chunk
      8, 215, 99, 248, 207, 192, 0, 0, 0, 3, 0, 1,
      24, 216, 110, 37, // CRC
      0, 0, 0, 0, 73, 69, 78, 68, // IEND chunk
      174, 66, 96, 130, // CRC
    ]);

    const overallStart = Date.now();

    // Run all students concurrently with controlled batching
    const BATCH_SIZE = 20; // process 20 at a time to avoid overwhelming
    const results: Array<{
      student: number;
      uploadMs: number;
      insertMs: number;
      totalMs: number;
      success: boolean;
      error?: string;
    }> = [];

    for (let batch = 0; batch < count; batch += BATCH_SIZE) {
      const batchEnd = Math.min(batch + BATCH_SIZE, count);
      const promises = [];

      for (let i = batch; i < batchEnd; i++) {
        promises.push(
          (async () => {
            const studentStart = Date.now();
            const studentName = `测试学生${i + 1}`;
            const filePath = `${boardId}/loadtest-${crypto.randomUUID()}.png`;

            try {
              // Step 1: Upload file
              const uploadStart = Date.now();
              const { data: uploadData, error: uploadErr } = await supabase.storage
                .from("board-media")
                .upload(filePath, tinyPng, {
                  contentType: "image/png",
                  upsert: false,
                });
              const uploadMs = Date.now() - uploadStart;

              if (uploadErr) {
                return {
                  student: i + 1,
                  uploadMs,
                  insertMs: 0,
                  totalMs: Date.now() - studentStart,
                  success: false,
                  error: `upload: ${uploadErr.message}`,
                };
              }

              const { data: urlData } = supabase.storage
                .from("board-media")
                .getPublicUrl(uploadData.path);

              // Step 2: Insert card
              const insertStart = Date.now();
              const { error: insertErr } = await supabase.from("board_cards").insert({
                board_id: boardId,
                content: `[负载测试] ${studentName} 的提交`,
                card_type: "image",
                media_url: urlData.publicUrl,
                author_nickname: studentName,
                color: "#ffffff",
                is_approved: true,
                column_id: "",
                position_x: Math.random() * 600,
                position_y: Math.random() * 400,
                sort_order: 0,
              });
              const insertMs = Date.now() - insertStart;

              return {
                student: i + 1,
                uploadMs,
                insertMs,
                totalMs: Date.now() - studentStart,
                success: !insertErr,
                error: insertErr?.message,
              };
            } catch (err) {
              return {
                student: i + 1,
                uploadMs: 0,
                insertMs: 0,
                totalMs: Date.now() - studentStart,
                success: false,
                error: err instanceof Error ? err.message : "Unknown error",
              };
            }
          })()
        );
      }

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    const overallMs = Date.now() - overallStart;

    // Compute stats
    const successResults = results.filter((r) => r.success);
    const failedResults = results.filter((r) => !r.success);
    const avgUpload =
      successResults.length > 0
        ? Math.round(successResults.reduce((s, r) => s + r.uploadMs, 0) / successResults.length)
        : 0;
    const avgInsert =
      successResults.length > 0
        ? Math.round(successResults.reduce((s, r) => s + r.insertMs, 0) / successResults.length)
        : 0;
    const maxUpload = Math.max(...successResults.map((r) => r.uploadMs), 0);
    const maxInsert = Math.max(...successResults.map((r) => r.insertMs), 0);
    const p95Upload = successResults.length > 0
      ? successResults.map((r) => r.uploadMs).sort((a, b) => a - b)[Math.floor(successResults.length * 0.95)]
      : 0;

    const report = {
      summary: {
        totalStudents: count,
        successCount: successResults.length,
        failureCount: failedResults.length,
        successRate: `${((successResults.length / count) * 100).toFixed(1)}%`,
        totalTimeMs: overallMs,
        batchSize: BATCH_SIZE,
      },
      latency: {
        avgUploadMs: avgUpload,
        avgInsertMs: avgInsert,
        maxUploadMs: maxUpload,
        maxInsertMs: maxInsert,
        p95UploadMs: p95Upload,
      },
      failures: failedResults.map((r) => ({
        student: r.student,
        error: r.error,
      })),
      // Include first 10 detailed results as sample
      sampleResults: results.slice(0, 10),
    };

    return new Response(JSON.stringify(report, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Load test error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
