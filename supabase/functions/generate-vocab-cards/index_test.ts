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
