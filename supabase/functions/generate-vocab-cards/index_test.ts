import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { callDeepSeek, extractCards } from "./lib.ts";

// ── extractCards ──────────────────────────────────────────────────────────
Deno.test("extractCards returns parsed pairs from a valid tool call", () => {
  const json = {
    choices: [{
      message: {
        tool_calls: [{
          function: {
            arguments: JSON.stringify({
              cards: [
                { word: "Apple", definition: "苹果" },
                { word: "Banana", definition: "香蕉", example: "I eat a banana." },
                { word: "  ", definition: "空白" }, // filtered
                { word: "Cat", definition: "" },     // filtered
              ],
            }),
          },
        }],
      },
    }],
  };
  const cards = extractCards(json);
  assertEquals(cards.length, 2);
  assertEquals(cards[0], { word: "Apple", definition: "苹果", example: undefined });
  assertEquals(cards[1].example, "I eat a banana.");
});

Deno.test("extractCards returns [] when tool_call is missing", () => {
  assertEquals(extractCards({}), []);
  assertEquals(extractCards({ choices: [{ message: {} }] }), []);
});

Deno.test("extractCards returns [] when arguments JSON is malformed", () => {
  const json = {
    choices: [{
      message: {
        tool_calls: [{ function: { arguments: "{not json" } }],
      },
    }],
  };
  assertEquals(extractCards(json), []);
});

// ── callDeepSeek error handling ───────────────────────────────────────────

const ORIGINAL_FETCH = globalThis.fetch;

function stubFetch(impl: typeof fetch) {
  globalThis.fetch = impl as typeof fetch;
}
function restoreFetch() {
  globalThis.fetch = ORIGINAL_FETCH;
}

Deno.test("callDeepSeek throws when DEEPSEEK_API_KEY is missing", async () => {
  const prev = Deno.env.get("DEEPSEEK_API_KEY");
  Deno.env.delete("DEEPSEEK_API_KEY");
  try {
    await assertRejects(
      () => callDeepSeek([{ role: "user", content: "hi" }]),
      Error,
      "DEEPSEEK_API_KEY missing",
    );
  } finally {
    if (prev !== undefined) Deno.env.set("DEEPSEEK_API_KEY", prev);
  }
});

Deno.test("callDeepSeek throws when upstream returns non-OK status", async () => {
  Deno.env.set("DEEPSEEK_API_KEY", "test-key");
  stubFetch(() =>
    Promise.resolve(
      new Response("upstream boom", { status: 500 }),
    )
  );
  try {
    await assertRejects(
      () => callDeepSeek([{ role: "user", content: "hi" }]),
      Error,
      "DeepSeek 500",
    );
  } finally {
    restoreFetch();
  }
});

Deno.test("callDeepSeek returns parsed JSON on success", async () => {
  Deno.env.set("DEEPSEEK_API_KEY", "test-key");
  const fakeJson = { choices: [{ message: { tool_calls: [] } }] };
  stubFetch(() =>
    Promise.resolve(
      new Response(JSON.stringify(fakeJson), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
  );
  try {
    const out = await callDeepSeek([{ role: "user", content: "hi" }]);
    assertEquals(out, fakeJson);
  } finally {
    restoreFetch();
  }
});

Deno.test("callDeepSeek surfaces network failures so the handler can fall through", async () => {
  Deno.env.set("DEEPSEEK_API_KEY", "test-key");
  stubFetch(() => Promise.reject(new Error("ENETUNREACH")));
  try {
    await assertRejects(
      () => callDeepSeek([{ role: "user", content: "hi" }]),
      Error,
      "ENETUNREACH",
    );
  } finally {
    restoreFetch();
  }
});

// ── DeepSeek: non-JSON upstream body ─────────────────────────────────────
Deno.test("callDeepSeek throws when upstream returns 200 with non-JSON body", async () => {
  Deno.env.set("DEEPSEEK_API_KEY", "test-key");
  stubFetch(() =>
    Promise.resolve(
      new Response("<html>upstream gateway error</html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
    )
  );
  try {
    await assertRejects(
      () => callDeepSeek([{ role: "user", content: "hi" }]),
      Error,
    );
  } finally {
    restoreFetch();
  }
});

Deno.test("callDeepSeek error for non-OK status does not leak the API key", async () => {
  const SECRET = "sk-super-secret-deepseek-key";
  Deno.env.set("DEEPSEEK_API_KEY", SECRET);
  stubFetch(() =>
    Promise.resolve(new Response("forbidden", { status: 403 }))
  );
  try {
    const err = await assertRejects(
      () => callDeepSeek([{ role: "user", content: "hi" }]),
      Error,
    );
    if (String(err.message).includes(SECRET)) {
      throw new Error("DeepSeek error message leaked the API key");
    }
  } finally {
    restoreFetch();
  }
});

// ── extractCards: additional unexpected tool-call shapes ─────────────────
Deno.test("extractCards returns [] when arguments.cards is not an array", () => {
  const json = {
    choices: [{
      message: {
        tool_calls: [{
          function: { arguments: JSON.stringify({ cards: { word: "x", definition: "y" } }) },
        }],
      },
    }],
  };
  assertEquals(extractCards(json), []);
});

Deno.test("extractCards returns [] when arguments JSON is an array (wrong root shape)", () => {
  const json = {
    choices: [{
      message: {
        tool_calls: [{
          function: { arguments: JSON.stringify([{ word: "Apple", definition: "苹果" }]) },
        }],
      },
    }],
  };
  assertEquals(extractCards(json), []);
});

Deno.test("extractCards rejects whole payload when any card entry is invalid (schema)", () => {
  const json = {
    choices: [{
      message: {
        tool_calls: [{
          function: {
            arguments: JSON.stringify({
              cards: [
                { word: "Apple", definition: "苹果" },
                null, // invalid entry → whole payload fails schema
              ],
            }),
          },
        }],
      },
    }],
  };
  assertEquals(extractCards(json), []);
});

Deno.test("extractCards rejects payload with non-string word/definition (schema)", () => {
  const json = {
    choices: [{
      message: {
        tool_calls: [{
          function: {
            arguments: JSON.stringify({
              cards: [{ word: 123, definition: 456 }],
            }),
          },
        }],
      },
    }],
  };
  assertEquals(extractCards(json), []);
});

Deno.test("extractCards rejects payload with non-string example (schema)", () => {
  const json = {
    choices: [{
      message: {
        tool_calls: [{
          function: {
            arguments: JSON.stringify({
              cards: [{ word: "Apple", definition: "苹果", example: 42 }],
            }),
          },
        }],
      },
    }],
  };
  assertEquals(extractCards(json), []);
});

Deno.test("extractCards returns [] when tool_call.function is missing", () => {
  const json = { choices: [{ message: { tool_calls: [{}] } }] };
  assertEquals(extractCards(json), []);
});

Deno.test("extractCards returns [] when arguments is an empty string", () => {
  const json = {
    choices: [{ message: { tool_calls: [{ function: { arguments: "" } }] } }],
  };
  assertEquals(extractCards(json), []);
});

Deno.test("extractCards returns [] when message has content instead of tool_calls", () => {
  const json = {
    choices: [{ message: { content: "{\"cards\":[{\"word\":\"a\",\"definition\":\"b\"}]}" } }],
  };
  assertEquals(extractCards(json), []);
});

// ── Fuzz / property-based tests ──────────────────────────────────────────
// Goal: for ANY malformed upstream payload, extractCards must
//   (a) never throw, and
//   (b) return either [] or a CardOut[] whose entries all have
//       non-empty string `word` and `definition` (and string|undefined example).

// Seeded PRNG (Mulberry32) for deterministic, reproducible runs.
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// deno-lint-ignore no-explicit-any
function randomValue(rand: () => number, depth: number): any {
  if (depth > 4) return null;
  const pick = Math.floor(rand() * 12);
  switch (pick) {
    case 0: return null;
    case 1: return undefined;
    case 2: return rand() < 0.5;
    case 3: return Math.floor(rand() * 1_000_000) - 500_000;
    case 4: return rand() * 1e6;
    case 5: {
      const len = Math.floor(rand() * 10);
      let s = "";
      for (let i = 0; i < len; i++) {
        s += String.fromCharCode(32 + Math.floor(rand() * 95));
      }
      return s;
    }
    case 6: return ""; // empty string
    case 7: { // array
      const n = Math.floor(rand() * 4);
      const arr: unknown[] = [];
      for (let i = 0; i < n; i++) arr.push(randomValue(rand, depth + 1));
      return arr;
    }
    case 8: { // object
      const n = Math.floor(rand() * 4);
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < n; i++) {
        obj[`k${i}`] = randomValue(rand, depth + 1);
      }
      return obj;
    }
    case 9: { // object that *might* look like a card
      const obj: Record<string, unknown> = {};
      if (rand() < 0.7) obj.word = randomValue(rand, depth + 1);
      if (rand() < 0.7) obj.definition = randomValue(rand, depth + 1);
      if (rand() < 0.4) obj.example = randomValue(rand, depth + 1);
      return obj;
    }
    case 10: return Number.NaN;
    default: return Infinity;
  }
}

function isValidCardOut(c: unknown): boolean {
  if (!c || typeof c !== "object") return false;
  const r = c as Record<string, unknown>;
  if (typeof r.word !== "string" || r.word.length === 0) return false;
  if (typeof r.definition !== "string" || r.definition.length === 0) return false;
  if (r.example !== undefined && typeof r.example !== "string") return false;
  return true;
}

Deno.test("fuzz: extractCards never throws on arbitrary random payloads", () => {
  const rand = mulberry32(0xC0FFEE);
  for (let i = 0; i < 500; i++) {
    const payload = randomValue(rand, 0);
    let result: unknown;
    try {
      result = extractCards(payload);
    } catch (e) {
      throw new Error(
        `extractCards threw on iteration ${i}: ${(e as Error).message}\n` +
        `payload=${JSON.stringify(payload)?.slice(0, 200)}`,
      );
    }
    if (!Array.isArray(result)) {
      throw new Error(`extractCards returned non-array on iteration ${i}`);
    }
    for (const c of result) {
      if (!isValidCardOut(c)) {
        throw new Error(
          `extractCards returned invalid card on iteration ${i}: ${JSON.stringify(c)}`,
        );
      }
    }
  }
});

Deno.test("fuzz: extractCards never throws on random tool-call argument strings", () => {
  const rand = mulberry32(0xBADF00D);
  // Build payloads shaped like a tool_call but with arbitrary `arguments` strings,
  // including non-JSON, truncated JSON, JSON of wrong shapes, and giant strings.
  const argFactories: Array<() => string> = [
    () => "",
    () => "{",
    () => "}{",
    () => "null",
    () => "true",
    () => "42",
    () => "\"a string\"",
    () => "[1,2,3]",
    () => "{\"cards\":null}",
    () => "{\"cards\":\"not-an-array\"}",
    () => "{\"cards\":[{}]}",
    () => "{\"cards\":[{\"word\":1,\"definition\":2}]}",
    () => "{\"cards\":[{\"word\":\"ok\",\"definition\":\"ok\",\"example\":7}]}",
    () => JSON.stringify({ cards: [{ word: "a".repeat(10_000), definition: "b" }] }),
    () => JSON.stringify(randomValue(rand, 0)),
    () => "\u0000\u0001\u0002 garbage bytes",
  ];

  for (let i = 0; i < 800; i++) {
    const factory = argFactories[Math.floor(rand() * argFactories.length)];
    const args = factory();
    const payload = {
      choices: [{
        message: {
          tool_calls: [{ function: { arguments: args } }],
        },
      }],
    };
    let result: unknown;
    try {
      result = extractCards(payload);
    } catch (e) {
      throw new Error(
        `extractCards threw on iteration ${i}: ${(e as Error).message}\n` +
        `arguments=${args.slice(0, 200)}`,
      );
    }
    if (!Array.isArray(result)) {
      throw new Error(`extractCards returned non-array on iteration ${i}`);
    }
    for (const c of result) {
      if (!isValidCardOut(c)) {
        throw new Error(
          `extractCards returned invalid card on iteration ${i}: ${JSON.stringify(c)}`,
        );
      }
    }
  }
});

Deno.test("property: well-formed payloads round-trip through extractCards", () => {
  const rand = mulberry32(42);
  for (let i = 0; i < 200; i++) {
    const n = 1 + Math.floor(rand() * 6);
    const cards = Array.from({ length: n }, (_, k) => {
      const card: Record<string, string> = {
        word: `w${i}_${k}`,
        definition: `d${i}_${k}`,
      };
      if (rand() < 0.5) card.example = `ex${i}_${k}`;
      return card;
    });
    const payload = {
      choices: [{
        message: {
          tool_calls: [{
            function: { arguments: JSON.stringify({ cards }) },
          }],
        },
      }],
    };
    const out = extractCards(payload);
    if (out.length !== n) {
      throw new Error(`expected ${n} cards, got ${out.length} on iteration ${i}`);
    }
    for (let k = 0; k < n; k++) {
      if (out[k].word !== cards[k].word || out[k].definition !== cards[k].definition) {
        throw new Error(`round-trip mismatch on iteration ${i}, card ${k}`);
      }
    }
  }
});

// ── Handler-level: validation failures map to sanitized 422 ──────────────
import { cardsToResponse, VALIDATION_FAILED_MESSAGE } from "./lib.ts";

const CORS = { "Access-Control-Allow-Origin": "*" };

// Strings we must NEVER find in the response body — these would indicate
// that parsing details, schema diagnostics, or upstream payload fragments
// have leaked to the client.
const FORBIDDEN_FRAGMENTS = [
  "JSON.parse",
  "SyntaxError",
  "Unexpected token",
  "tool_call",
  "tool_calls",
  "schema",
  "validateCardsPayload",
  "DeepSeek",
  "Lovable",
  "stack",
  "at ",       // stack trace marker
  "definition", // raw card field name leak
  "arguments",
];

async function assertSanitized422(json: unknown, label: string) {
  const resp = cardsToResponse(json, CORS);
  if (resp.status !== 422) {
    throw new Error(`${label}: expected 422, got ${resp.status}`);
  }
  const text = await resp.text();
  const body = JSON.parse(text);
  if (body.error !== VALIDATION_FAILED_MESSAGE) {
    throw new Error(`${label}: error message changed to "${body.error}"`);
  }
  if (Object.keys(body).length !== 1) {
    throw new Error(`${label}: body has unexpected keys: ${Object.keys(body).join(",")}`);
  }
  for (const frag of FORBIDDEN_FRAGMENTS) {
    if (text.includes(frag)) {
      throw new Error(`${label}: response leaked fragment "${frag}": ${text}`);
    }
  }
}

Deno.test("handler: empty / null upstream → sanitized 422", async () => {
  await assertSanitized422(null, "null");
  await assertSanitized422(undefined, "undefined");
  await assertSanitized422({}, "empty object");
  await assertSanitized422({ choices: [] }, "no choices");
  await assertSanitized422({ choices: [{ message: {} }] }, "no tool_calls");
});

Deno.test("handler: malformed JSON arguments → sanitized 422", async () => {
  const cases: Array<[string, string]> = [
    ["not-json", "{not json"],
    ["truncated", "{\"cards\":["],
    ["empty string", ""],
    ["control bytes", "\u0000\u0001 garbage"],
    ["wrong root null", "null"],
    ["wrong root array", "[1,2,3]"],
  ];
  for (const [label, args] of cases) {
    await assertSanitized422({
      choices: [{ message: { tool_calls: [{ function: { arguments: args } }] } }],
    }, `malformed ${label}`);
  }
});

Deno.test("handler: schema-invalid cards payload → sanitized 422", async () => {
  const cases: Array<[string, unknown]> = [
    ["cards is null", { cards: null }],
    ["cards is object", { cards: { word: "x", definition: "y" } }],
    ["cards is string", { cards: "nope" }],
    ["entry missing definition", { cards: [{ word: "ok" }] }],
    ["entry has numeric word", { cards: [{ word: 1, definition: "ok" }] }],
    ["entry has numeric definition", { cards: [{ word: "ok", definition: 2 }] }],
    ["entry has non-string example", { cards: [{ word: "ok", definition: "ok", example: 7 }] }],
    ["mixed valid + invalid entries", { cards: [{ word: "ok", definition: "ok" }, null] }],
  ];
  for (const [label, args] of cases) {
    await assertSanitized422({
      choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify(args) } }] } }],
    }, `schema-invalid ${label}`);
  }
});

Deno.test("handler: only one valid card → sanitized 422 (need ≥ 2)", async () => {
  await assertSanitized422({
    choices: [{
      message: {
        tool_calls: [{
          function: {
            arguments: JSON.stringify({
              cards: [{ word: "Apple", definition: "苹果" }],
            }),
          },
        }],
      },
    }],
  }, "single valid card");
});

Deno.test("handler: ≥2 valid cards → 200 with cards body (no leakage)", async () => {
  const resp = cardsToResponse({
    choices: [{
      message: {
        tool_calls: [{
          function: {
            arguments: JSON.stringify({
              cards: [
                { word: "Apple", definition: "苹果" },
                { word: "Banana", definition: "香蕉", example: "I eat one." },
              ],
            }),
          },
        }],
      },
    }],
  }, CORS);
  if (resp.status !== 200) throw new Error(`expected 200, got ${resp.status}`);
  const body = await resp.json();
  if (!Array.isArray(body.cards) || body.cards.length !== 2) {
    throw new Error(`unexpected body: ${JSON.stringify(body)}`);
  }
});
