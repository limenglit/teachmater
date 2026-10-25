import { describe, expect, it } from "vitest";
import { PROXY_UPLOAD_MAX_BYTES, backendUploadUrl, toProxyUrl } from "./backend-proxy";

const BASE = String(import.meta.env.VITE_SUPABASE_URL ?? "https://example.supabase.co");

describe("backend proxy", () => {
  it("rewrites login requests to the same-origin relay", () => {
    expect(toProxyUrl("https://x.supabase.co/auth/v1/token?grant_type=password", "https://x.supabase.co", "https://teachermate.org.cn")).toBe(
      "https://teachermate.org.cn/api/public/sb/auth/v1/token?grant_type=password",
    );
  });

  it("leaves realtime and unrelated hosts alone", () => {
    expect(toProxyUrl("https://x.supabase.co/realtime/v1/websocket", "https://x.supabase.co", "https://teachermate.org.cn")).toBeNull();
    expect(toProxyUrl("https://other.com/rest/v1/a", "https://x.supabase.co", "https://teachermate.org.cn")).toBeNull();
  });

  it("routes uploads up to 50MB through the relay, larger ones direct", () => {
    const url = `${BASE}/storage/v1/object/board-media/a.jpg`;
    if (!import.meta.env.VITE_SUPABASE_URL) return;
    expect(backendUploadUrl(url, 4 * 1024 * 1024)).toBe(`${window.location.origin}/api/public/sb/storage/v1/object/board-media/a.jpg`);
    expect(backendUploadUrl(url, PROXY_UPLOAD_MAX_BYTES + 1)).toBe(url);
  });
});
