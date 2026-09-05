import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_quiz_sessions",
  title: "List quiz sessions",
  description: "List the signed-in teacher's quiz sessions with question counts and status.",
  inputSchema: {
    status: z.enum(["active", "ended", "all"]).optional().describe("Filter by status. Defaults to all."),
    limit: z.number().int().min(1).max(100).optional().describe("How many sessions to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("quiz_sessions")
      .select("id, title, status, created_at, ended_at, questions, student_names")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status && status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const sessions = (data ?? []).map((s: any) => ({
      session_id: s.id,
      title: s.title,
      status: s.status,
      created_at: s.created_at,
      ended_at: s.ended_at,
      question_count: Array.isArray(s.questions) ? s.questions.length : 0,
      roster_size: Array.isArray(s.student_names) ? s.student_names.length : 0,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(sessions, null, 2) }],
      structuredContent: { sessions },
    };
  },
});
