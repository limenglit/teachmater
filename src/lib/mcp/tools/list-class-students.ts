import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_class_students",
  title: "List class students",
  description: "List the students on one of the signed-in teacher's class rosters.",
  inputSchema: {
    class_id: z.string().uuid().describe("Class id from list_classes."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ class_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("class_students")
      .select("id, name, student_number, created_at")
      .eq("class_id", class_id)
      .order("created_at", { ascending: true })
      .limit(2000);

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const students = (data ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      student_number: s.student_number,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify({ count: students.length, students }, null, 2) }],
      structuredContent: { count: students.length, students },
    };
  },
});
