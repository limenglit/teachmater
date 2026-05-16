// Integration tests for the generate-vocab-cards HTTP handler.
//
// These exercise the full request lifecycle (auth → quota → AI → response)
// using injectable dependencies, so we can verify behavior across many
// "session" shapes without hitting Supabase or any AI provider.

import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRequest, type HandlerDeps } from "./index.ts";
import { VALIDATION_FAILED_MESSAGE } from "./lib.ts";

/* ── Fixtures ────────────────────────────────────────────────────────── */

function validToolCallJson(n = 3) {
  const cards = Array.from({ length: n }, (_, i) => ({
    word: `w${i}`,
    definition: `d${i}`,
  }));
  return {
    choices: [{
      message: {
        tool_calls: [{
          function: { arguments: JSON.stringify({ cards }) },
        }],
      },
    }],
  };
}

interface CallLog {
  authHeaders: string[];
  quotaUserIds: string[];
  primaryCalls: number;
  fallbackCalls: number;
}

function makeDeps(
  overrides: Partial<HandlerDeps> = {},
): { deps: HandlerDeps; log: CallLog } {
  const log: CallLog = {
    authHeaders: [],
    quotaUserIds: [],
    primaryCalls: 0,
    fallbackCalls: 0,
  };
  const deps: HandlerDeps = {
    getUserFromAuth: async (h) => {
      log.authHeaders.push(h);
      return { id: "user-default" };
    },
    consumeQuota: async (id) => {
      log.quotaUserIds.push(id);
      return true;
    },
    callPrimary: async () => {
      log.primaryCalls += 1;
      return validToolCallJson();
    },
    callFallback: async () => {
      log.fallbackCalls += 1;
      return validToolCallJson();
    },
    ...overrides,
  };
  return { deps, log };
}

function makeRequest(opts: {
  method?: string;
  auth?: string | null;
  body?: unknown;
} = {}): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (opts.auth !== null && opts.auth !== undefined) {
    headers.set("Authorization", opts.auth);
  }
  return new Request("http://localhost/generate-vocab-cards", {
    method: opts.method ?? "POST",
    headers,
    body: opts.body === undefined ? JSON.stringify({ topic: "动物" }) : JSON.stringify(opts.body),
  });
}

/* ── Auth ────────────────────────────────────────────────────────────── */

Deno.test("auth: missing Authorization header → 401, no quota / AI calls", async () => {
  const { deps, log } = makeDeps();
  const resp = await handleRequest(makeRequest({ auth: null }), deps);
  assertEquals(resp.status, 401);
  const body = await resp.json();
  assertEquals(body.error, "Unauthorized");
  assertEquals(log.quotaUserIds.length, 0);
  assertEquals(log.primaryCalls, 0);
  assertEquals(log.fallbackCalls, 0);
});

Deno.test("auth: non-Bearer Authorization header → 401", async () => {
  const { deps, log } = makeDeps();
  const resp = await handleRequest(makeRequest({ auth: "Basic abc" }), deps);
  assertEquals(resp.status, 401);
  await resp.text();
  assertEquals(log.quotaUserIds.length, 0);
});

Deno.test("auth: invalid token (getUser returns null) → 401, no quota burn", async () => {
  const { deps, log } = makeDeps({ getUserFromAuth: async () => null });
  const resp = await handleRequest(makeRequest({ auth: "Bearer bad" }), deps);
  assertEquals(resp.status, 401);
  await resp.text();
  assertEquals(log.quotaUserIds.length, 0);
  assertEquals(log.primaryCalls, 0);
});

Deno.test("auth: header is forwarded verbatim to getUserFromAuth", async () => {
  const { deps, log } = makeDeps();
  await handleRequest(makeRequest({ auth: "Bearer specific-jwt" }), deps);
  assertEquals(log.authHeaders, ["Bearer specific-jwt"]);
});

/* ── CORS preflight ──────────────────────────────────────────────────── */

Deno.test("OPTIONS preflight returns CORS headers without invoking deps", async () => {
  const { deps, log } = makeDeps();
  const req = new Request("http://localhost/", { method: "OPTIONS" });
  const resp = await handleRequest(req, deps);
  assertEquals(resp.status, 200);
  assertEquals(resp.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(log.quotaUserIds.length, 0);
  assertEquals(log.primaryCalls, 0);
});

/* ── Quota ───────────────────────────────────────────────────────────── */

Deno.test("quota: exhausted user → 429 with friendly message, AI not called", async () => {
  const { deps, log } = makeDeps({ consumeQuota: async () => false });
  const resp = await handleRequest(
    makeRequest({ auth: "Bearer t" }),
    deps,
  );
  assertEquals(resp.status, 429);
  const body = await resp.json();
  assertStringIncludes(body.error, "今日 AI");
  assertEquals(log.primaryCalls, 0);
  assertEquals(log.fallbackCalls, 0);
});

Deno.test("quota: receives the resolved user id (not the raw token)", async () => {
  const { deps, log } = makeDeps({
    getUserFromAuth: async () => ({ id: "user-42" }),
  });
  await handleRequest(makeRequest({ auth: "Bearer secret" }), deps);
  assertEquals(log.quotaUserIds, ["user-42"]);
});

Deno.test("quota: each request consumes once — two distinct sessions tracked separately", async () => {
  const { deps, log } = makeDeps({
    getUserFromAuth: async (h) => ({ id: h.includes("alice") ? "alice" : "bob" }),
  });
  await handleRequest(makeRequest({ auth: "Bearer alice" }), deps);
  await handleRequest(makeRequest({ auth: "Bearer bob" }), deps);
  assertEquals(log.quotaUserIds, ["alice", "bob"]);
  assertEquals(log.primaryCalls, 2);
});

/* ── Body validation ─────────────────────────────────────────────────── */

Deno.test("body: missing topic → 400 (after auth + quota are spent)", async () => {
  const { deps, log } = makeDeps();
  const resp = await handleRequest(
    makeRequest({ auth: "Bearer t", body: {} }),
    deps,
  );
  assertEquals(resp.status, 400);
  const body = await resp.json();
  assertStringIncludes(body.error, "topic");
  assertEquals(log.primaryCalls, 0);
});

Deno.test("body: non-string topic → 400", async () => {
  const { deps } = makeDeps();
  const resp = await handleRequest(
    makeRequest({ auth: "Bearer t", body: { topic: 123 } }),
    deps,
  );
  assertEquals(resp.status, 400);
  await resp.text();
});

/* ── Success path ────────────────────────────────────────────────────── */

Deno.test("success: returns 200 + cards JSON when primary AI returns a valid payload", async () => {
  const { deps, log } = makeDeps();
  const resp = await handleRequest(
    makeRequest({ auth: "Bearer t", body: { topic: "水果" } }),
    deps,
  );
  assertEquals(resp.status, 200);
  const body = await resp.json();
  assertEquals(Array.isArray(body.cards), true);
  assertEquals(body.cards.length, 3);
  assertEquals(body.cards[0].word, "w0");
  assertEquals(body.cards[0].definition, "d0");
  assertEquals(log.primaryCalls, 1);
  assertEquals(log.fallbackCalls, 0);
});

Deno.test("success: response carries CORS headers + JSON content-type", async () => {
  const { deps } = makeDeps();
  const resp = await handleRequest(makeRequest({ auth: "Bearer t" }), deps);
  assertEquals(resp.headers.get("Access-Control-Allow-Origin"), "*");
  assertStringIncludes(resp.headers.get("Content-Type") ?? "", "application/json");
  await resp.text();
});

/* ── AI provider failures ────────────────────────────────────────────── */

Deno.test("primary RATE_LIMIT → 429, fallback NOT invoked", async () => {
  const { deps, log } = makeDeps({
    callPrimary: async () => { throw new Error("RATE_LIMIT"); },
  });
  const resp = await handleRequest(makeRequest({ auth: "Bearer t" }), deps);
  assertEquals(resp.status, 429);
  const body = await resp.json();
  assertStringIncludes(body.error, "请稍后重试");
  assertEquals(log.fallbackCalls, 0);
});

Deno.test("primary failure (non-rate-limit) → falls back to DeepSeek and succeeds", async () => {
  const { deps, log } = makeDeps({
    callPrimary: async () => { throw new Error("PAYMENT_REQUIRED"); },
  });
  const resp = await handleRequest(makeRequest({ auth: "Bearer t" }), deps);
  assertEquals(resp.status, 200);
  const body = await resp.json();
  assertEquals(body.cards.length, 3);
  assertEquals(log.primaryCalls, 1);
  assertEquals(log.fallbackCalls, 1);
});

Deno.test("primary AND fallback both fail → 500 with sanitized message", async () => {
  const { deps } = makeDeps({
    callPrimary: async () => { throw new Error("upstream 500"); },
    callFallback: async () => { throw new Error("deepseek down"); },
  });
  const resp = await handleRequest(makeRequest({ auth: "Bearer t" }), deps);
  assertEquals(resp.status, 500);
  const text = await resp.text();
  // Must not leak upstream error strings
  if (text.includes("upstream 500") || text.includes("deepseek down")) {
    throw new Error(`response leaked upstream error: ${text}`);
  }
});

Deno.test("primary returns malformed payload → sanitized 422", async () => {
  const { deps } = makeDeps({
    callPrimary: async () => ({ choices: [{ message: {} }] }), // no tool_calls
  });
  const resp = await handleRequest(makeRequest({ auth: "Bearer t" }), deps);
  assertEquals(resp.status, 422);
  const body = await resp.json();
  assertEquals(body.error, VALIDATION_FAILED_MESSAGE);
});
