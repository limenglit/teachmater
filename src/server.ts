import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

// 实时推送（白板、签到大屏等）的 WebSocket 连接经本站转发到后台，国内无需直连境外地址。
const REALTIME_PREFIX = "/api/public/sb/realtime/v1/";
const WS_DROP = new Set(["host", "cookie", "origin", "referer", "true-client-ip", "cdn-loop", "x-real-ip"]);

function backendBase(): string {
  const fromEnv = typeof process !== "undefined" ? process.env["SUPABASE_URL"] : undefined;
  return String(fromEnv || import.meta.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
}

async function proxyRealtime(request: Request): Promise<Response> {
  const base = backendBase();
  const url = new URL(request.url);
  if (!base) return new Response("Backend not configured", { status: 500 });
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (WS_DROP.has(k) || k.startsWith("cf-") || k.startsWith("x-forwarded-")) return;
    headers.set(key, value);
  });
  try {
    // 转发运行环境会把升级后的连接原样交还给浏览器。
    return await fetch(base + url.pathname.slice("/api/public/sb".length) + url.search, { headers });
  } catch (error) {
    console.error("[realtime-proxy] upstream failed", error);
    return new Response("realtime unreachable", { status: 502 });
  }
}

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    if (
      request.headers.get("upgrade")?.toLowerCase() === "websocket" &&
      new URL(request.url).pathname.startsWith(REALTIME_PREFIX)
    ) {
      return proxyRealtime(request);
    }
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
