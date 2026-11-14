# Student formula rendering
- [x] Render formulas throughout student questions, options, submitted answers, reference answers and practice feedback.
- [x] Prevent tall and long formulas from clipping; verify math, physics and chemistry rendering.
- [x] Run focused regression tests and student answer/review browser checks (9 tests passed; real temporary session submitted and read back; test data deleted).

# Formula puzzle editor
- [x] Add draggable, sortable formula blocks with editable math and chemistry fields and live preview.
- [x] Preserve existing templates and direct LaTeX editing; verify assembly, reorder, edit, delete and insertion (9 focused tests passed; real editor drag/reorder/insert verified).

# WeChat roster access
- [x] Make the mobile roster entry and empty-roster import action visible.
- [x] Keep drawer actions within the visible viewport; retain class-library import labels on phones (360px signed-in check passed).
- [x] Fall back to manual paste when clipboard access is unavailable and verify import end to end (15 tests passed; WeChat simulation imported two names and read them back after reload).

# Phone QR casting
- [x] Add private single-phone rooms and PC QR receiver with fullscreen, rotation, pause and capture.
- [x] Add mobile camera, supported screen sharing, photo casting and snapshot fallback with permission/error states.
- [x] Verify two-browser transmission, room isolation and desktop/mobile rendering (camera snapshot fallback and photos delivered; second phone rejected; closing revokes access). Real phones and unrestricted WebRTC networks remain unverified.