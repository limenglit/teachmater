import {
  assertEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  checkImageSize,
  internalErrorResponse,
  jsonResponse,
  MAX_IMAGE_BASE64_BYTES,
} from "./responses.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization",
};

Deno.test("internalErrorResponse never leaks the underlying error message", async () => {
  const upstream = new Error("Postgres connection refused at 10.0.0.1:5432");
  const res = internalErrorResponse(cors);
  const body = await res.json();

  assertEquals(res.status, 500);
  assertEquals(body, { error: "Internal error" });
  // Ensure none of the sensitive info leaked into the body string
  const raw = JSON.stringify(body);
  assertEquals(raw.includes(upstream.message), false);
  assertEquals(raw.includes("stack"), false);
  // CORS still applied
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(res.headers.get("Content-Type"), "application/json");
});

Deno.test("jsonResponse sets cors + content-type", async () => {
  const res = jsonResponse({ ok: true }, 201, cors);
  assertEquals(res.status, 201);
  assertEquals(res.headers.get("Content-Type"), "application/json");
  assertEquals(await res.json(), { ok: true });
});

Deno.test("checkImageSize returns null when payload is within limit", () => {
  const small = "x".repeat(1024);
  assertStrictEquals(checkImageSize(small, cors), null);
});

Deno.test("checkImageSize returns 413 when payload exceeds limit", async () => {
  const huge = "x".repeat(MAX_IMAGE_BASE64_BYTES + 1);
  const res = checkImageSize(huge, cors);
  if (!res) throw new Error("expected a 413 Response");
  assertEquals(res.status, 413);
  const body = await res.json();
  assertEquals(body, { error: "Image too large (max 5 MB)" });
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("checkImageSize boundary: exactly at limit is allowed", () => {
  const atLimit = "x".repeat(MAX_IMAGE_BASE64_BYTES);
  assertStrictEquals(checkImageSize(atLimit, cors), null);
});

Deno.test("checkImageSize returns null for non-string input (handled upstream)", () => {
  // The caller validates type/presence before calling this guard.
  // The guard itself must not crash on non-strings.
  // deno-lint-ignore no-explicit-any
  assertStrictEquals(checkImageSize(undefined as any, cors), null);
});
