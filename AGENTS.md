
- Class data spaces: boards/quiz_sessions/checkin_sessions/seat_checkin_sessions carry class_id; tag on create via set_content_class RPC and filter on load via src/lib/class-space.ts — keeps classes isolated without changing create RPCs.
- Seat chart exports restore only the outer room zoom, keep child transforms, and fit PDF onto one page — this prevents displaced labels and split seats.
