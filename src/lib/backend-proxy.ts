// 让浏览器的登录、数据、文件和后台服务请求全部走本站同源地址（/api/public/sb/...），
// 由本站服务器转发到后台：国内用户不再直连境外接口，无需 VPN。
// 必须在创建后台连接之前安装（后台连接创建时会记住当时的 fetch）。

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

export function installBackendProxy() {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;
  const w = window as typeof window & { __backendProxyInstalled?: boolean };
  if (w.__backendProxyInstalled) return;
  const base = String(import.meta.env.VITE_SUPABASE_URL ?? "");
  if (!base) return;
  w.__backendProxyInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const proxied = toProxyUrl(url, base, window.location.origin);
    if (!proxied) return originalFetch(input, init);
    if (typeof input === "string" || input instanceof URL) return originalFetch(proxied, init);
    return originalFetch(new Request(proxied, input), init);
  };
}

installBackendProxy();
