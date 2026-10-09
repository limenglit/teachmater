
- Class data spaces: boards/quiz_sessions/checkin_sessions/seat_checkin_sessions carry class_id; tag on create via set_content_class RPC and filter on load via src/lib/class-space.ts — keeps classes isolated without changing create RPCs.
- Seat chart exports restore only the outer room zoom, keep child transforms, and fit PDF onto one appropriately sized page — this prevents displaced labels and split seats in large rooms.
- Shared exports never generate or embed check-in QR codes; check-in codes belong to the separate check-in dialog, keeping every seat chart format QR-free.
- Student quiz and practice content uses the shared MathText renderer for questions, options, answers and explanations; bounded formula-only scrolling preserves KaTeX geometry without clipping or overflowing the page.
- Formula block composition uses dnd-kit Pointer and Keyboard sensors without portal overlays, with a shared pure block serializer; this keeps touch, accessible reordering and inserted LaTeX consistent.
- Student scan pages (CheckInPage, SeatCheckinPage, scan-session) use src/lib/student-supabase.ts: no persisted session, same-domain API relay first with automatic direct fallback — keeps unauthenticated phones lightweight and reachable when the direct backend host is throttled in mainland China.
