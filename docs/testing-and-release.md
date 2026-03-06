# Testing and Release Checklist

This checklist is for pre-release validation of the TeachMater app.

## 1) Automated tests

Run unit tests:

```sh
npm.cmd run test
```

Recommended test focus:

- Command card icon search behavior
- Fallback behavior when network/icon search fails
- Candidate list boundaries (3-6)
- Existing utility tests and smoke tests

## 2) Edge test matrix

### Command card icon retrieval

- Empty topic input: no request should be sent.
- Network error: command should still be published with default `？` icon.
- Candidate count < 3: command should still be published with default `？` icon.
- Candidate count >= 3 and <= 6: show candidate badges and allow manual selection.
- Duplicate icon names from API: candidates should be deduplicated.
- Invalid icon IDs from API: invalid entries should be ignored.

### Classroom scale and performance

- 0 students loaded.
- Typical class (30-60).
- Large class (80-120).
- Slow network (icon search API latency > 2s).
- Search API unavailable (timeout / 5xx).

### Export and usability

- Export PNG/PDF naming flow with custom title.
- Verify fallback prompts are understandable for teachers.
- Verify command overlay closes with ESC and click.

## 3) Manual usability checks

- Input placeholder clearly describes what to type.
- Error/fallback messages are actionable and short.
- Candidate icon list can be selected with mouse and keyboard.
- New custom commands appear ahead of built-in commands.

## 4) Release gate

Release only when:

- All automated tests pass.
- No blocking runtime errors in browser console.
- Edge cases above are validated in QA notes.
- Core classroom workflows complete end-to-end: grouping, seating, toolkit, check-in.

## 5) Recommended CI step

Use this command in CI:

```sh
npm.cmd run test
```

If your CI image uses bash:

```sh
npm run test
```
