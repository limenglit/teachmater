import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_classes",
  title: "List classes",
  description: "List the signed-in teacher's schools/colleges and their classes, with student counts.",
  inputSchema: {
    search: z.string().trim().optional().describe("Optional filter matched against the class name."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);

    let query = supabase
      .from("classes")
      .select("id, name, created_at, colleges(id, name), class_students(count)")
      .order("sort_order", { ascending: true })
      .limit(500);
    if (search) query = query.ilike("name", `%${search}%`);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const classes = (data ?? []).map((row: any) => ({
      class_id: row.id,
      class_name: row.name,
      college_id: row.colleges?.id ?? null,
      college_name: row.colleges?.name ?? null,
      student_count: row.class_students?.[0]?.count ?? 0,
      created_at: row.created_at,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(classes, null, 2) }],
      structuredContent: { classes },
    };
  },
});
