
-- Drop overly permissive ALL policies on checkin tables
DROP POLICY IF EXISTS "Allow all access to checkin_sessions" ON checkin_sessions;
DROP POLICY IF EXISTS "Allow all access to checkin_records" ON checkin_records;

-- checkin_sessions: anyone can read and create, but no direct update/delete
CREATE POLICY "Anyone can read sessions" ON checkin_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can create sessions" ON checkin_sessions FOR INSERT WITH CHECK (true);
-- No UPDATE or DELETE policies = no one can update/delete via direct table access
-- (updates/deletes should go through validated RPC functions if needed)

-- checkin_records: anyone can read and insert (students check in), no update/delete
CREATE POLICY "Anyone can read records" ON checkin_records FOR SELECT USING (true);
CREATE POLICY "Anyone can insert records" ON checkin_records FOR INSERT WITH CHECK (true);
