-- FIX 1: Quiz sessions - restrict SELECT to authenticated
-- Students use get_quiz_session_for_student RPC (SECURITY DEFINER)
DROP POLICY IF EXISTS "Anyone can read quiz sessions" ON quiz_sessions;
CREATE POLICY "Authenticated users read quiz sessions" ON quiz_sessions
FOR SELECT TO authenticated USING (true);

-- FIX 2: Quiz answers - restrict SELECT to authenticated, deny direct INSERT
-- Students submit via submit_quiz_answers RPC (SECURITY DEFINER)
DROP POLICY IF EXISTS "Anyone can read quiz answers" ON quiz_answers;
CREATE POLICY "Authenticated users read quiz answers" ON quiz_answers
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can submit quiz answers" ON quiz_answers;
CREATE POLICY "Deny direct INSERT quiz answers" ON quiz_answers
FOR INSERT WITH CHECK (false);

-- FIX 3: Student points - restrict to authenticated (teacher feature)
DROP POLICY IF EXISTS "Anyone can read points" ON student_points;
CREATE POLICY "Authenticated users read points" ON student_points
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can add points" ON student_points;
CREATE POLICY "Authenticated users add points" ON student_points
FOR INSERT TO authenticated WITH CHECK (true);

-- FIX 4: Student badges - restrict to authenticated (teacher feature)
DROP POLICY IF EXISTS "Anyone can read student badges" ON student_badges;
CREATE POLICY "Authenticated users read student badges" ON student_badges
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can award badges" ON student_badges;
CREATE POLICY "Authenticated users award badges" ON student_badges
FOR INSERT TO authenticated WITH CHECK (true);

-- FIX 5: Badge definitions - restrict INSERT to authenticated
DROP POLICY IF EXISTS "Anyone can create badges" ON badges;
CREATE POLICY "Authenticated users create badges" ON badges
FOR INSERT TO authenticated WITH CHECK (true);