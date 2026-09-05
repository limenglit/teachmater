import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "add_class_students",
  title: "Add students to a class",
  description:
    "Add students to one of the signed-in teacher's classes. Students already on the roster (same name and student number) are skipped.",
  inputSchema: {
    class_id: z.string().uuid().describe("Class id from list_classes."),
    students: z
      .array(
        z.object({
          name: z.string().trim().min(1).describe("Student name."),
          student_number: z.string().trim().optional().describe("Optional student number."),
        }),
      )
      .min(1)
      .max(500)
      .describe("Students to add."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ class_id, students }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const userId = ctx.getUserId();
    if (!userId) {
      return { content: [{ type: "text", text: "Missing user identity" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);

    const { data: existing, error: readError } = await supabase
      .from("class_students")
      .select("name, student_number")
      .eq("class_id", class_id)
      .limit(5000);
    if (readError) return { content: [{ type: "text", text: readError.message }], isError: true };

    const key = (name: string, no?: string | null) => `${name.trim()}|${(no ?? "").trim()}`;
    const seen = new Set((existing ?? []).map((s: any) => key(s.name, s.student_number)));

    const rows: { class_id: string; user_id: string; name: string; student_number: string | null }[] = [];
    let skipped = 0;
    for (const s of students) {
      const k = key(s.name, s.student_number);
      if (seen.has(k)) {
        skipped += 1;
        continue;
      }
      seen.add(k);
      rows.push({
        class_id,
        user_id: userId,
        name: s.name.trim(),
        student_number: s.student_number?.trim() || null,
      });
    }

    if (rows.length === 0) {
      const summary = { inserted: 0, skipped };
      return {
        content: [{ type: "text", text: JSON.stringify(summary) }],
        structuredContent: summary,
      };
    }

    const { data, error } = await supabase.from("class_students").insert(rows).select("id, name, student_number");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const summary = { inserted: data?.length ?? 0, skipped, students: data ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
