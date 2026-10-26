import { describe, expect, it } from "vitest";
import { PROXY_UPLOAD_MAX_BYTES, backendUploadUrl, parseObjectUpload, toProxyMediaUrl, toProxyUrl, toProxyWsUrl } from "./backend-proxy";
import { RESUMABLE_CHUNK_BYTES, proxiedResumableLocation } from "./resumable-upload";

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

describe("realtime, file links and large uploads", () => {
  const B = "https://x.supabase.co";
  const O = "https://teachermate.org.cn";

  it("sends realtime websockets through the site", () => {
    expect(toProxyWsUrl("wss://x.supabase.co/realtime/v1/websocket?apikey=k&vsn=1.0.0", B, O)).toBe(
      "wss://teachermate.org.cn/api/public/sb/realtime/v1/websocket?apikey=k&vsn=1.0.0",
    );
    expect(toProxyWsUrl("wss://other.com/realtime/v1/websocket", B, O)).toBeNull();
  });

  it("rewrites saved public image links but not other links", () => {
    expect(toProxyMediaUrl(`${B}/storage/v1/object/public/board-media/boards/1/a.jpg`, B, O)).toBe(
      `${O}/api/public/sb/storage/v1/object/public/board-media/boards/1/a.jpg`,
    );
    expect(toProxyMediaUrl("https://cdn.example.com/a.jpg", B, O)).toBe("https://cdn.example.com/a.jpg");
    expect(toProxyMediaUrl(`${B}/rest/v1/boards`, B, O)).toBe(`${B}/rest/v1/boards`);
  });

  it("recognises plain file uploads only", () => {
    expect(parseObjectUpload(`${B}/storage/v1/object/board-media/boards/1/a.mp4`, "POST", B)).toEqual({ bucket: "board-media", objectName: "boards/1/a.mp4" });
    expect(parseObjectUpload(`${B}/storage/v1/object/sign/board-media/a.mp4`, "POST", B)).toBeNull();
    expect(parseObjectUpload(`${B}/storage/v1/object/board-media/a.mp4`, "GET", B)).toBeNull();
  });

  it("keeps resumable upload chunks on the site", () => {
    expect(proxiedResumableLocation(`${B}/storage/v1/upload/resumable/abc`, O)).toBe(`${O}/api/public/sb/storage/v1/upload/resumable/abc`);
    expect(RESUMABLE_CHUNK_BYTES).toBe(6 * 1024 * 1024);
  });
});
