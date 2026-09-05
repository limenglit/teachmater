import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listClasses from "./tools/list-classes";
import listClassStudents from "./tools/list-class-students";
import addClassStudents from "./tools/add-class-students";
import listCheckinSessions from "./tools/list-checkin-sessions";
import getCheckinAttendance from "./tools/get-checkin-attendance";
import listQuizSessions from "./tools/list-quiz-sessions";
import getQuizResults from "./tools/get-quiz-results";
import listBoards from "./tools/list-boards";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "teachmate-pro",
  title: "TeachMate Pro",
  version: "0.1.0",
  instructions:
    "Tools for the TeachMate Pro classroom platform. Use list_classes and list_class_students to read rosters, add_class_students to extend a roster, list_checkin_sessions plus get_checkin_attendance for attendance, list_quiz_sessions plus get_quiz_results for quiz performance, and list_boards for creative board activity. All data is scoped to the signed-in teacher.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listClasses,
    listClassStudents,
    addClassStudents,
    listCheckinSessions,
    getCheckinAttendance,
    listQuizSessions,
    getQuizResults,
    listBoards,
  ],
});
