// 让浏览器的登录、数据、文件、后台服务、实时推送和图片/视频链接全部走本站同源地址
// （/api/public/sb/...），由本站服务器转发到后台：国内用户不再直连境外接口，无需 VPN。
// 必须在创建后台连接之前安装（后台连接创建时会记住当时的 fetch 和 WebSocket）。
import { resumableUpload } from "./resumable-upload";

export const PROXY_PREFIX = "/api/public/sb";
export const PROXIED_PATHS = ["/auth/v1/", "/rest/v1/", "/storage/v1/", "/functions/v1/"];

/** 若 url 指向后台的认证/数据/存储/服务接口，返回同源转发地址；否则返回 null。 */
export function toProxyUrl(url: string, backendBase: string, origin: string): string | null {
  const base = backendBase.replace(/\/+$/, "");
  if (!base || !url.startsWith(base + "/")) return null;
  const rest = url.slice(base.length);
  if (!PROXIED_PATHS.some((p) => rest.startsWith(p))) return null;
  return origin.replace(/\/+$/, "") + PROXY_PREFIX + rest;
}

/** 实时推送地址（wss://后台/realtime/v1/...）→ 本站 wss 转发地址；否则 null。 */
export function toProxyWsUrl(url: string, backendBase: string, origin: string): string | null {
  const host = backendBase.replace(/\/+$/, "").replace(/^http/, "ws");
  if (!host || !url.startsWith(host + "/realtime/v1/")) return null;
  return origin.replace(/\/+$/, "").replace(/^http/, "ws") + PROXY_PREFIX + url.slice(host.length);
}

const MEDIA_PATHS = ["/storage/v1/object/public/", "/storage/v1/object/sign/", "/storage/v1/render/image/"];

/** 已保存的图片/视频/文件链接（直连后台）→ 本站转发地址；其他链接原样返回。 */
export function toProxyMediaUrl(url: string, backendBase: string, origin: string): string {
  const base = backendBase.replace(/\/+$/, "");
  if (!base || typeof url !== "string" || !url.startsWith(base + "/")) return url;
  const rest = url.slice(base.length);
  if (!MEDIA_PATHS.some((p) => rest.startsWith(p))) return url;
  return origin.replace(/\/+$/, "") + PROXY_PREFIX + rest;
}

/** 本站转发单次最多转送的上传大小；更大的文件改为 6MB 分片上传，同样经本站转发。 */
export const PROXY_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

/** 上传（XMLHttpRequest 不经过 fetch 拦截）用：返回本站转发地址。大于上限的文件请用 resumableUpload。 */
export function backendUploadUrl(url: string, size: number): string {
  if (typeof window === "undefined" || !(size <= PROXY_UPLOAD_MAX_BYTES)) return url;
  const base = String(import.meta.env.VITE_SUPABASE_URL ?? "");
  return toProxyUrl(url, base, window.location.origin) ?? url;
}

const RESERVED_OBJECT_SEGMENTS = new Set(["sign", "upload", "list", "move", "copy", "public", "authenticated", "info"]);

/** 识别 supabase-js 的普通文件上传（POST/PUT /storage/v1/object/<桶>/<路径>）。 */
export function parseObjectUpload(url: string, method: string, backendBase: string): { bucket: string; objectName: string } | null {
  const m = method.toUpperCase();
  if (m !== "POST" && m !== "PUT") return null;
  const base = backendBase.replace(/\/+$/, "");
  const prefix = base + "/storage/v1/object/";
  if (!base || !url.startsWith(prefix)) return null;
  const path = url.slice(prefix.length).split("?")[0];
  const slash = path.indexOf("/");
  if (slash <= 0) return null;
  const bucket = decodeURIComponent(path.slice(0, slash));
  if (RESERVED_OBJECT_SEGMENTS.has(bucket)) return null;
  return { bucket, objectName: decodeURIComponent(path.slice(slash + 1)) };
}

/** 超过转发上限的上传：把 fetch 的上传改成分片续传，返回与普通上传相同的结果。 */
async function largeUploadViaResumable(
  target: { bucket: string; objectName: string },
  init: RequestInit,
  method: string,
): Promise<Response | null> {
  const body = init.body;
  let file: Blob | null = null;
  let cacheControl = "3600";
  if (typeof Blob !== "undefined" && body instanceof Blob) file = body;
  else if (typeof FormData !== "undefined" && body instanceof FormData) {
    const files: Blob[] = [];
    body.forEach((v, k) => {
      if (typeof v !== "string") files.push(v);
      else if (k === "cacheControl") cacheControl = v;
      else if (k === "metadata" || k === "contentEncoding") files.push(new Blob()); // 不支持的选项：保持原样上传
    });
    if (files.length === 1) file = files[0];
  }
  if (!file || file.size <= PROXY_UPLOAD_MAX_BYTES) return null;
  const headers = new Headers(init.headers);
  if (headers.get("cache-control")) cacheControl = headers.get("cache-control")!.replace(/^max-age=/, "");
  try {
    await resumableUpload({
      bucket: target.bucket,
      objectName: target.objectName,
      file,
      contentType: headers.get("content-type") && !(body instanceof FormData) ? headers.get("content-type")! : file.type,
      cacheControl,
      upsert: method.toUpperCase() === "PUT" || headers.get("x-upsert") === "true",
      authorization: headers.get("authorization") ?? "",
      apiKey: headers.get("apikey") ?? String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ""),
    });
    return new Response(JSON.stringify({ Key: `${target.bucket}/${target.objectName}`, Id: null }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "upload failed";
    const status = (error as { status?: number }).status;
    return new Response(JSON.stringify({ statusCode: String(status || 400), error: "upload failed", message }), {
      status: status && status >= 400 ? status : 400,
      headers: { "content-type": "application/json" },
    });
  }
}

// ---- 实时推送 ----
const WS_FAIL_KEY = "tm_ws_proxy_failed_at";
const WS_FAIL_TTL_MS = 30 * 60 * 1000;
const WS_OPEN_TIMEOUT_MS = 8000;

function wsProxyRecentlyFailed(): boolean {
  try {
    const at = Number(localStorage.getItem(WS_FAIL_KEY) || 0);
    return at > 0 && Date.now() - at < WS_FAIL_TTL_MS;
  } catch {
    return false;
  }
}
function markWsProxy(ok: boolean) {
  try {
    if (ok) localStorage.removeItem(WS_FAIL_KEY);
    else localStorage.setItem(WS_FAIL_KEY, String(Date.now()));
  } catch {
    /* 隐私模式 */
  }
}

function installWebSocketProxy(base: string) {
  const Native = window.WebSocket;
  if (typeof Native !== "function" || (Native as unknown as { __tmProxied?: boolean }).__tmProxied) return;
  // 开发预览服务器不支持转发实时连接，只在正式网站启用。
  if (import.meta.env.DEV || window.location.protocol !== "https:") return;

  const Proxied = function (this: unknown, url: string | URL, protocols?: string | string[]) {
    const href = typeof url === "string" ? url : url.href;
    const proxied = wsProxyRecentlyFailed() ? null : toProxyWsUrl(href, base, window.location.origin);
    const ws = protocols === undefined ? new Native(proxied ?? href) : new Native(proxied ?? href, protocols);
    if (proxied) {
      let opened = false;
      const timer = setTimeout(() => {
        if (!opened) {
          markWsProxy(false);
          try { ws.close(); } catch { /* ignore */ }
        }
      }, WS_OPEN_TIMEOUT_MS);
      ws.addEventListener("open", () => { opened = true; clearTimeout(timer); markWsProxy(true); });
      // 本站实时转发连不上：记下来，实时推送随后的自动重连改走原地址，不影响使用。
      ws.addEventListener("close", () => { clearTimeout(timer); if (!opened) markWsProxy(false); });
    }
    return ws;
  } as unknown as typeof WebSocket;
  Proxied.prototype = Native.prototype;
  for (const k of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"] as const) {
    Object.defineProperty(Proxied, k, { value: Native[k] });
  }
  (Proxied as unknown as { __tmProxied: boolean }).__tmProxied = true;
  window.WebSocket = Proxied;
}

// ---- 图片、视频、文件链接 ----
function installMediaUrlRewrite(base: string) {
  const origin = window.location.origin;
  const rewrite = (v: unknown) => (typeof v === "string" ? toProxyMediaUrl(v, base, origin) : v);
  const ATTRS = new Set(["src", "href", "poster", "data"]);

  const nativeSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name: string, value: string) {
    return nativeSetAttribute.call(this, name, ATTRS.has(name.toLowerCase()) ? (rewrite(value) as string) : value);
  };

  const patch = (proto: object | undefined, prop: string) => {
    if (!proto) return;
    const desc = Object.getOwnPropertyDescriptor(proto, prop);
    if (!desc?.set || !desc.get) return;
    Object.defineProperty(proto, prop, {
      ...desc,
      set(this: Element, v: unknown) {
        desc.set!.call(this, rewrite(v));
      },
    });
  };
  patch(window.HTMLImageElement?.prototype, "src");
  patch(window.HTMLMediaElement?.prototype, "src");
  patch(window.HTMLSourceElement?.prototype, "src");
  patch(window.HTMLVideoElement?.prototype, "poster");
  patch(window.HTMLAnchorElement?.prototype, "href");
  patch(window.HTMLIFrameElement?.prototype, "src");
  patch(window.HTMLEmbedElement?.prototype, "src");
  patch(window.HTMLObjectElement?.prototype, "data");

  const nativeOpen = window.open;
  if (typeof nativeOpen === "function") {
    window.open = function (url?: string | URL, ...rest: unknown[]) {
      const next = typeof url === "string" ? (rewrite(url) as string) : url;
      return (nativeOpen as (...a: unknown[]) => Window | null).call(window, next, ...rest);
    } as typeof window.open;
  }

  // 服务器端渲染出来、尚未经过上面拦截的链接。
  const sweep = () => {
    document.querySelectorAll<HTMLElement>("img[src],video[src],audio[src],source[src],a[href],iframe[src]").forEach((el) => {
      for (const attr of ["src", "href"]) {
        const v = el.getAttribute(attr);
        if (v && v.startsWith(base)) {
          const next = toProxyMediaUrl(v, base, origin);
          if (next !== v) nativeSetAttribute.call(el, attr, next);
        }
      }
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sweep, { once: true });
  else sweep();
}

export function installBackendProxy() {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;
  const w = window as typeof window & { __backendProxyInstalled?: boolean };
  if (w.__backendProxyInstalled) return;
  const base = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
  if (!base) return;
  w.__backendProxyInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    if (init?.body && !(input instanceof Request)) {
      const target = parseObjectUpload(url, method, base);
      if (target) {
        const big = await largeUploadViaResumable(target, init, method);
        if (big) return big;
      }
    }
    const proxied = toProxyUrl(url, base, window.location.origin);
    if (!proxied) return originalFetch(input, init);
    if (typeof input === "string" || input instanceof URL) return originalFetch(proxied, init);
    return originalFetch(new Request(proxied, input), init);
  };

  try {
    installWebSocketProxy(base);
  } catch (error) {
    console.warn("[backend-proxy] realtime proxy not installed", error);
  }
  try {
    installMediaUrlRewrite(base);
  } catch (error) {
    console.warn("[backend-proxy] media link proxy not installed", error);
  }
}

installBackendProxy();
