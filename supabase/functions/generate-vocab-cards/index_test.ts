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
