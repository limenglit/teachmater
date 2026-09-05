import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_boards",
  title: "List creative boards",
  description: "List the signed-in teacher's creative boards with submission counts.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("How many boards to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("boards")
      .select("id, title, description, is_locked, is_collaborative, created_at, board_cards(count)")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const boards = (data ?? []).map((b: any) => ({
      board_id: b.id,
      title: b.title,
      description: b.description,
      is_locked: b.is_locked,
      is_collaborative: b.is_collaborative,
      created_at: b.created_at,
      submission_count: b.board_cards?.[0]?.count ?? 0,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(boards, null, 2) }],
      structuredContent: { boards },
    };
  },
});
