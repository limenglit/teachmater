
- Class data spaces: boards/quiz_sessions/checkin_sessions/seat_checkin_sessions carry class_id; tag on create via set_content_class RPC and filter on load via src/lib/class-space.ts — keeps classes isolated without changing create RPCs.
