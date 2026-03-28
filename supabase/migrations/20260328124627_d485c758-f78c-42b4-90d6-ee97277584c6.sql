
-- Restrict quiz_sessions SELECT to session owner (by user_id or creator_token)
-- Students use get_quiz_session_for_student RPC (SECURITY DEFINER) so they don't need direct SELECT

DROP POLICY IF EXISTS "Authenticated users read quiz sessions" ON quiz_sessions;

CREATE POLICY "Owner reads quiz sessions" ON quiz_sessions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
  );
