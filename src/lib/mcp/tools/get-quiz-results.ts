import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_quiz_results",
  title: "Get quiz results",
  description:
    "Get per-student scores and per-question accuracy for one of the signed-in teacher's quiz sessions.",
  inputSchema: {
    session_id: z.string().uuid().describe("Quiz session id from list_quiz_sessions."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ session_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);

    const { data: session, error: sessionError } = await supabase
      .from("quiz_sessions")
      .select("id, title, status, questions")
      .eq("id", session_id)
      .maybeSingle();
    if (sessionError) return { content: [{ type: "text", text: sessionError.message }], isError: true };
    if (!session) return { content: [{ type: "text", text: "Quiz session not found" }], isError: true };

    const { data: answers, error } = await supabase
      .from("quiz_answers")
      .select("student_name, question_index, is_correct")
      .eq("session_id", session_id)
      .limit(5000);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const questionCount = Array.isArray((session as any).questions) ? (session as any).questions.length : 0;
    const byStudent = new Map<string, { correct: number; answered: number }>();
    const byQuestion = new Map<number, { correct: number; answered: number }>();

    for (const a of answers ?? []) {
      const name = String((a as any).student_name);
      const s = byStudent.get(name) ?? { correct: 0, answered: 0 };
      s.answered += 1;
      if ((a as any).is_correct) s.correct += 1;
      byStudent.set(name, s);

      const idx = Number((a as any).question_index);
      const q = byQuestion.get(idx) ?? { correct: 0, answered: 0 };
      q.answered += 1;
      if ((a as any).is_correct) q.correct += 1;
      byQuestion.set(idx, q);
    }

    const students = [...byStudent.entries()]
      .map(([name, s]) => ({
        student_name: name,
        correct: s.correct,
        answered: s.answered,
        accuracy: s.answered ? Math.round((s.correct / s.answered) * 100) : 0,
      }))
      .sort((a, b) => b.accuracy - a.accuracy);

    const questions = [...byQuestion.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([index, q]) => ({
        question_index: index,
        correct: q.correct,
        answered: q.answered,
        accuracy: q.answered ? Math.round((q.correct / q.answered) * 100) : 0,
      }));

    const result = {
      session_id,
      title: (session as any).title,
      status: (session as any).status,
      question_count: questionCount,
      participant_count: students.length,
      students,
      questions,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});
