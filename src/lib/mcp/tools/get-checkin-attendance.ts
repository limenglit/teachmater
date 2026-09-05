import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_checkin_attendance",
  title: "Get check-in attendance",
  description:
    "Get who checked in for one of the signed-in teacher's seat check-in sessions, plus the list of students who did not.",
  inputSchema: {
    session_id: z.string().uuid().describe("Check-in session id from list_checkin_sessions."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ session_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);

    const { data: session, error: sessionError } = await supabase
      .from("seat_checkin_sessions")
      .select("id, class_name, status, created_at, student_names")
      .eq("id", session_id)
      .maybeSingle();
    if (sessionError) return { content: [{ type: "text", text: sessionError.message }], isError: true };
    if (!session) {
      return { content: [{ type: "text", text: "Check-in session not found" }], isError: true };
    }

    const { data: records, error } = await supabase
      .from("seat_checkin_records")
      .select("student_name, checked_in_at, org, phone, extra_fields")
      .eq("session_id", session_id)
      .order("checked_in_at", { ascending: true })
      .limit(2000);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const roster: string[] = Array.isArray((session as any).student_names)
      ? ((session as any).student_names as unknown[]).map((n) => String(n))
      : [];
    const present = new Set((records ?? []).map((r: any) => String(r.student_name).trim()));
    const absent = roster.filter((n) => !present.has(String(n).trim()));

    const result = {
      session_id,
      class_name: (session as any).class_name,
      status: (session as any).status,
      roster_size: roster.length,
      checked_in_count: records?.length ?? 0,
      absent_count: absent.length,
      checked_in: records ?? [],
      absent,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});
