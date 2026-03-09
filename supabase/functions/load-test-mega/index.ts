import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Mega load test: simulate 100 teachers × 100 students = 10,000 concurrent operations.
 * 
 * Architecture:
 *   Phase 1: Create N teacher boards (sequential, fast)
 *   Phase 2: For each board, run M student uploads in batches (parallel across boards)
 *   Phase 3: Aggregate results into a detailed report
 * 
 * POST body: {
 *   teacherCount?: number,    // default 100
 *   studentsPerTeacher?: number, // default 100
 *   batchSize?: number,       // concurrent students per batch, default 20
 *   boardBatchSize?: number,  // concurrent boards processed simultaneously, default 10
 *   skipUpload?: boolean,     // if true, test DB insert only (faster)
 * }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const teacherCount = Math.min(Math.max(1, body.teacherCount ?? 100), 200);
    const studentsPerTeacher = Math.min(Math.max(1, body.studentsPerTeacher ?? 100), 200);
    const batchSize = Math.min(Math.max(1, body.batchSize ?? 20), 50);
    const boardBatchSize = Math.min(Math.max(1, body.boardBatchSize ?? 10), 50);
    const skipUpload = body.skipUpload ?? false;
    const totalOps = teacherCount * studentsPerTeacher;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Tiny 1x1 PNG for upload tests
    const tinyPng = new Uint8Array([
      137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,
      0,0,0,1,0,0,0,1,8,2,0,0,0,144,119,83,222,
      0,0,0,12,73,68,65,84,8,215,99,248,207,192,0,0,0,3,0,1,
      24,216,110,37,0,0,0,0,73,69,78,68,174,66,96,130,
    ]);

    const overallStart = Date.now();
    const phaseTimings: Record<string, number> = {};

    // ═══════════════════════════════════════════════════════════════
    // Phase 1: Create teacher boards
    // ═══════════════════════════════════════════════════════════════
    const phase1Start = Date.now();
    const boardIds: string[] = [];

    for (let batch = 0; batch < teacherCount; batch += boardBatchSize) {
      const batchEnd = Math.min(batch + boardBatchSize, teacherCount);
      const boards = [];
      for (let i = batch; i < batchEnd; i++) {
        boards.push({
          title: `[压测] 教师${i + 1}的白板`,
          description: `万人并发测试 - 教师${i + 1}`,
          creator_token: `loadtest-teacher-${i + 1}`,
          view_mode: "wall",
          is_locked: false,
        });
      }
      const { data, error } = await supabase.from("boards").insert(boards).select("id");
      if (error) throw new Error(`Phase 1 board creation failed: ${error.message}`);
      if (data) boardIds.push(...data.map((b: any) => b.id));
    }

    phaseTimings.phase1_createBoards_ms = Date.now() - phase1Start;

    // ═══════════════════════════════════════════════════════════════
    // Phase 2: Student concurrent submissions
    // ═══════════════════════════════════════════════════════════════
    const phase2Start = Date.now();

    interface StudentResult {
      teacherIdx: number;
      studentIdx: number;
      uploadMs: number;
      insertMs: number;
      totalMs: number;
      success: boolean;
      error?: string;
    }

    const allResults: StudentResult[] = [];
    let completedOps = 0;

    // Process boards in batches to control parallelism
    for (let boardBatch = 0; boardBatch < boardIds.length; boardBatch += boardBatchSize) {
      const boardBatchEnd = Math.min(boardBatch + boardBatchSize, boardIds.length);
      const boardPromises = [];

      for (let bi = boardBatch; bi < boardBatchEnd; bi++) {
        const boardId = boardIds[bi];
        const teacherIdx = bi + 1;

        boardPromises.push(
          (async () => {
            const teacherResults: StudentResult[] = [];

            // Process students in sub-batches
            for (let sBatch = 0; sBatch < studentsPerTeacher; sBatch += batchSize) {
              const sBatchEnd = Math.min(sBatch + batchSize, studentsPerTeacher);
              const studentPromises = [];

              for (let si = sBatch; si < sBatchEnd; si++) {
                studentPromises.push(
                  (async () => {
                    const start = Date.now();
                    const studentName = `学生${si + 1}`;
                    let uploadMs = 0;
                    let mediaUrl = "";

                    try {
                      // Upload (optional)
                      if (!skipUpload) {
                        const uploadStart = Date.now();
                        const path = `${boardId}/lt-${crypto.randomUUID()}.png`;
                        const { data: upData, error: upErr } = await supabase.storage
                          .from("board-media")
                          .upload(path, tinyPng, { contentType: "image/png", upsert: false });
                        uploadMs = Date.now() - uploadStart;

                        if (upErr) {
                          return {
                            teacherIdx, studentIdx: si + 1,
                            uploadMs, insertMs: 0,
                            totalMs: Date.now() - start,
                            success: false, error: `upload: ${upErr.message}`,
                          };
                        }
                        const { data: urlData } = supabase.storage
                          .from("board-media")
                          .getPublicUrl(upData.path);
                        mediaUrl = urlData.publicUrl;
                      }

                      // Insert card
                      const insertStart = Date.now();
                      const { error: insErr } = await supabase.from("board_cards").insert({
                        board_id: boardId,
                        content: `[压测] 教师${teacherIdx}-${studentName}`,
                        card_type: skipUpload ? "text" : "image",
                        media_url: mediaUrl,
                        author_nickname: studentName,
                        color: "#ffffff",
                        is_approved: true,
                        column_id: "",
                        position_x: Math.random() * 600,
                        position_y: Math.random() * 400,
                        sort_order: 0,
                      });
                      const insertMs = Date.now() - insertStart;

                      completedOps++;

                      return {
                        teacherIdx, studentIdx: si + 1,
                        uploadMs, insertMs,
                        totalMs: Date.now() - start,
                        success: !insErr,
                        error: insErr?.message,
                      };
                    } catch (err) {
                      return {
                        teacherIdx, studentIdx: si + 1,
                        uploadMs: 0, insertMs: 0,
                        totalMs: Date.now() - start,
                        success: false,
                        error: err instanceof Error ? err.message : "Unknown error",
                      };
                    }
                  })()
                );
              }

              const batchResults = await Promise.all(studentPromises);
              teacherResults.push(...batchResults);
            }

            return teacherResults;
          })()
        );
      }

      const boardBatchResults = await Promise.all(boardPromises);
      for (const results of boardBatchResults) {
        allResults.push(...results);
      }
    }

    phaseTimings.phase2_studentOps_ms = Date.now() - phase2Start;

    // ═══════════════════════════════════════════════════════════════
    // Phase 3: Aggregate report
    // ═══════════════════════════════════════════════════════════════
    const overallMs = Date.now() - overallStart;

    const successResults = allResults.filter((r) => r.success);
    const failedResults = allResults.filter((r) => !r.success);

    const calc = (arr: number[]) => {
      if (arr.length === 0) return { avg: 0, p50: 0, p95: 0, p99: 0, max: 0, min: 0 };
      const sorted = [...arr].sort((a, b) => a - b);
      return {
        avg: Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length),
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
        max: sorted[sorted.length - 1],
        min: sorted[0],
      };
    };

    const uploadLatencies = successResults.filter(r => r.uploadMs > 0).map(r => r.uploadMs);
    const insertLatencies = successResults.map(r => r.insertMs);
    const totalLatencies = successResults.map(r => r.totalMs);

    // Per-teacher breakdown
    const perTeacher: Array<{
      teacher: number;
      total: number;
      success: number;
      failed: number;
      avgTotalMs: number;
    }> = [];
    for (let t = 1; t <= teacherCount; t++) {
      const teacherOps = allResults.filter(r => r.teacherIdx === t);
      const teacherSuccess = teacherOps.filter(r => r.success);
      perTeacher.push({
        teacher: t,
        total: teacherOps.length,
        success: teacherSuccess.length,
        failed: teacherOps.length - teacherSuccess.length,
        avgTotalMs: teacherSuccess.length > 0
          ? Math.round(teacherSuccess.reduce((s, r) => s + r.totalMs, 0) / teacherSuccess.length)
          : 0,
      });
    }

    // Error categorization
    const errorCategories: Record<string, number> = {};
    for (const f of failedResults) {
      const key = f.error?.slice(0, 60) || "unknown";
      errorCategories[key] = (errorCategories[key] || 0) + 1;
    }

    const throughput = overallMs > 0
      ? Math.round((successResults.length / overallMs) * 1000)
      : 0;

    const report = {
      config: {
        teacherCount,
        studentsPerTeacher,
        totalOperations: totalOps,
        batchSize,
        boardBatchSize,
        skipUpload,
      },
      summary: {
        totalOperations: totalOps,
        successCount: successResults.length,
        failureCount: failedResults.length,
        successRate: `${((successResults.length / totalOps) * 100).toFixed(2)}%`,
        totalTimeMs: overallMs,
        totalTimeSec: (overallMs / 1000).toFixed(1),
        throughputOpsPerSec: throughput,
      },
      phaseTimings,
      latency: {
        upload: calc(uploadLatencies),
        dbInsert: calc(insertLatencies),
        endToEnd: calc(totalLatencies),
      },
      errorCategories,
      // Show worst 5 teachers and best 5
      teacherBreakdown: {
        worst5: [...perTeacher].sort((a, b) => a.success - b.success).slice(0, 5),
        best5: [...perTeacher].sort((a, b) => b.avgTotalMs - a.avgTotalMs).slice(0, 5),
        allTeachersFullSuccess: perTeacher.every(t => t.failed === 0),
      },
      // Sample failures
      sampleFailures: failedResults.slice(0, 20).map(r => ({
        teacher: r.teacherIdx,
        student: r.studentIdx,
        error: r.error,
      })),
      boardIds, // for cleanup
    };

    return new Response(JSON.stringify(report, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Mega load test error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
