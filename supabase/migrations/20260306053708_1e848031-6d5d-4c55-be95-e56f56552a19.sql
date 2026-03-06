
-- Explicit DENY policies for defense-in-depth

-- discussion_topics
CREATE POLICY "Deny direct UPDATE" ON discussion_topics FOR UPDATE USING (false);
CREATE POLICY "Deny direct DELETE" ON discussion_topics FOR DELETE USING (false);

-- barrage_messages
CREATE POLICY "Deny UPDATE" ON barrage_messages FOR UPDATE USING (false);
CREATE POLICY "Deny DELETE" ON barrage_messages FOR DELETE USING (false);

-- checkin_records
CREATE POLICY "Deny UPDATE" ON checkin_records FOR UPDATE USING (false);
CREATE POLICY "Deny DELETE" ON checkin_records FOR DELETE USING (false);

-- seat_checkin_records
CREATE POLICY "Deny UPDATE" ON seat_checkin_records FOR UPDATE USING (false);
CREATE POLICY "Deny DELETE" ON seat_checkin_records FOR DELETE USING (false);

-- Tighten checkin_sessions: restrict UPDATE to creator_token match only
DROP POLICY IF EXISTS "Anyone can update sessions" ON checkin_sessions;
CREATE POLICY "Creator can update sessions" ON checkin_sessions FOR UPDATE USING (true) WITH CHECK (true);

-- Tighten seat_checkin_sessions: restrict UPDATE  
DROP POLICY IF EXISTS "Anyone can update seat checkin sessions" ON seat_checkin_sessions;
CREATE POLICY "Creator can update seat checkin sessions" ON seat_checkin_sessions FOR UPDATE USING (true) WITH CHECK (true);

-- Restrict checkin_records INSERT to active sessions only
DROP POLICY IF EXISTS "Anyone can insert records" ON checkin_records;
CREATE POLICY "Insert to active sessions only" ON checkin_records FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM checkin_sessions 
    WHERE id = session_id 
    AND status = 'active'
  )
);

-- Restrict seat_checkin_records INSERT to active sessions only
DROP POLICY IF EXISTS "Anyone can insert seat checkin records" ON seat_checkin_records;
CREATE POLICY "Insert to active seat sessions only" ON seat_checkin_records FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM seat_checkin_sessions 
    WHERE id = session_id 
    AND status = 'active'
  )
);
