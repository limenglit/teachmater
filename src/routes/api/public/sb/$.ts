import { createFileRoute } from "@tanstack/react-router";

// 同源转发：浏览器 → 本站 /api/public/sb/* → 后台。
// 不附加任何额外权限，原样转发调用方自己的 apikey / 登录令牌，
// 数据访问仍由数据库行级权限控制。
const PREFIX = "/api/public/sb";
const ALLOWED = ["/auth/v1/", "/rest/v1/", "/storage/v1/", "/functions/v1/"];
const DROP_REQUEST = new Set([
  "host",
  "cookie",
  "connection",
  "content-length",
  "accept-encoding",
  "origin",
  "referer",
  "true-client-ip",
  "cdn-loop",
  "x-real-ip",
]);
const DROP_RESPONSE = new Set(["content-encoding", "content-length", "transfer-encoding", "connection", "set-cookie"]);

function backendBase(): string {
  const fromEnv = typeof process !== "undefined" ? process.env["SUPABASE_URL"] : undefined;
  return String(fromEnv || import.meta.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
}

async function forward(request: Request): Promise<Response> {
  const base = backendBase();
  if (!base) return new Response("Backend not configured", { status: 500 });

  const url = new URL(request.url);
  const rest = url.pathname.slice(PREFIX.length);
  if (!ALLOWED.some((p) => rest.startsWith(p))) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (DROP_REQUEST.has(k) || k.startsWith("cf-") || k.startsWith("x-forwarded-")) return;
    headers.set(key, value);
  });
  const clientIp =
    request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (clientIp) headers.set("sb-forwarded-for", clientIp);

  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? null : await request.arrayBuffer();

  // 后台服务（AI 出题、生图等）由本站服务器直接运行，不再转到境外的服务运行环境；
  // 本站运行出错（例如缺少配置）时，才退回境外的原服务，保证功能可用。
  const fnMatch = rest.match(/^\/functions\/v1\/([\w-]+)\/?$/);
  if (fnMatch && method !== "OPTIONS") {
    try {
      const { LOCAL_EDGE_FUNCTIONS } = await import("@/lib/edge-fns/registry.server");
      const load = LOCAL_EDGE_FUNCTIONS[fnMatch[1]];
      if (load) {
        const mod = await load();
        const local = await mod.default(
          new Request(base + rest + url.search, { method, headers, body: body ? body.slice(0) : null }),
        );
        const out = new Headers(local.headers);
        if (!out.has("cache-control")) out.set("cache-control", "no-store");
        out.set("x-tm-fn", "local");
        return new Response(local.body, { status: local.status, statusText: local.statusText, headers: out });
      }
    } catch (error) {
      console.error("[backend-proxy] local function failed, falling back", fnMatch[1], error);
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(base + rest + url.search, { method, headers, body, redirect: "manual" });
  } catch (error) {
    console.error("[backend-proxy] upstream failed", error);
    return new Response(JSON.stringify({ message: "backend unreachable" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!DROP_RESPONSE.has(key.toLowerCase())) out.set(key, value);
  });
  // 未压缩的文件（图片、视频）保留长度，浏览器可显示下载进度、视频可拖动。
  const length = upstream.headers.get("content-length");
  if (length && !upstream.headers.get("content-encoding")) out.set("content-length", length);
  if (!out.has("cache-control")) out.set("cache-control", "no-store");
  // 大文件分片上传：后台返回的续传地址改写为本站地址，后续分片同样经本站转发。
  const location = out.get("location");
  if (location) {
    const resumable = location.indexOf("/storage/v1/upload/resumable");
    if (location.startsWith(base + "/")) out.set("location", url.origin + PREFIX + location.slice(base.length));
    else if (resumable >= 0) out.set("location", url.origin + PREFIX + location.slice(resumable));
  }

  // 直接透传响应流：AI 服务的流式输出不会被整段缓存后才返回。
  return new Response(method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}

export const Route = createFileRoute("/api/public/sb/$")({
  server: {
    handlers: {
      GET: ({ request }) => forward(request),
      HEAD: ({ request }) => forward(request),
      POST: ({ request }) => forward(request),
      PUT: ({ request }) => forward(request),
      PATCH: ({ request }) => forward(request),
      DELETE: ({ request }) => forward(request),
      OPTIONS: () => new Response(null, { status: 204 }),
    },
  },
});
