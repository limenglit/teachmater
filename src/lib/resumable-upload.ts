// 大文件分片上传（续传协议）：每片 6MB 经本站 teachermate.org.cn 转发到后台，
// 不再因为文件超过本站单次转发上限而直连境外地址；断网后从已上传位置继续。

export const PROXY_PREFIX = "/api/public/sb";
/** 后台要求的固定分片大小（最后一片可以更小）。 */
export const RESUMABLE_CHUNK_BYTES = 6 * 1024 * 1024;
const MAX_CHUNK_RETRIES = 4;

export interface ResumableUploadOptions {
  bucket: string;
  objectName: string;
  file: Blob;
  contentType?: string;
  /** 缓存秒数，例如 "3600"。 */
  cacheControl?: string;
  upsert?: boolean;
  /** 登录令牌（未登录时为公开密钥）。 */
  authorization: string;
  apiKey: string;
  onProgress?: (loaded: number, total: number) => void;
  /** 交出取消函数。 */
  onAbortHandle?: (abort: () => void) => void;
  origin?: string;
}

function b64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** 后台返回的续传地址 → 本站转发地址。 */
export function proxiedResumableLocation(location: string, origin: string): string {
  const at = location.indexOf("/storage/v1/upload/resumable");
  if (at < 0) return location;
  return origin.replace(/\/+$/, "") + PROXY_PREFIX + location.slice(at);
}

export function buildUploadMetadata(o: Pick<ResumableUploadOptions, "bucket" | "objectName" | "contentType" | "cacheControl">): string {
  const pairs: [string, string][] = [
    ["bucketName", o.bucket],
    ["objectName", o.objectName],
    ["contentType", o.contentType || "application/octet-stream"],
    ["cacheControl", o.cacheControl || "3600"],
  ];
  return pairs.map(([k, v]) => `${k} ${b64(v)}`).join(",");
}

class UploadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function readMessage(xhr: XMLHttpRequest, fallback: string): string {
  try {
    const parsed = JSON.parse(xhr.responseText);
    if (parsed?.message || parsed?.error) return String(parsed.message || parsed.error);
  } catch {
    /* plain text */
  }
  return xhr.responseText?.trim() ? xhr.responseText.trim().slice(0, 200) : fallback;
}

function request(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: Blob | null,
  track: (abort: () => void) => void,
  onUpload?: (loaded: number) => void,
): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.timeout = 120000;
    track(() => xhr.abort());
    if (onUpload) xhr.upload.onprogress = (e) => onUpload(e.loaded);
    xhr.onload = () => resolve(xhr);
    xhr.onerror = () => reject(new UploadError("网络中断，上传失败", 0));
    xhr.ontimeout = () => reject(new UploadError("上传超时，请检查网络后重试", 0));
    xhr.onabort = () => reject(new UploadError("Upload cancelled", -1));
    xhr.send(body);
  });
}

export async function resumableUpload(o: ResumableUploadOptions): Promise<void> {
  const origin = o.origin ?? window.location.origin;
  const total = o.file.size;
  let cancelled = false;
  let abortCurrent: () => void = () => {};
  o.onAbortHandle?.(() => {
    cancelled = true;
    abortCurrent();
  });
  const track = (a: () => void) => {
    abortCurrent = a;
  };
  const base: Record<string, string> = {
    authorization: o.authorization,
    apikey: o.apiKey,
    "tus-resumable": "1.0.0",
  };

  const created = await request(
    "POST",
    `${origin.replace(/\/+$/, "")}${PROXY_PREFIX}/storage/v1/upload/resumable`,
    {
      ...base,
      "upload-length": String(total),
      "upload-metadata": buildUploadMetadata(o),
      "x-upsert": o.upsert ? "true" : "false",
    },
    null,
    track,
  );
  const location = created.getResponseHeader("location");
  if (created.status !== 201 || !location) {
    throw new UploadError(readMessage(created, `上传失败（${created.status}）`), created.status);
  }
  const uploadUrl = proxiedResumableLocation(location, origin);

  let offset = 0;
  o.onProgress?.(0, total);
  while (offset < total) {
    if (cancelled) throw new UploadError("Upload cancelled", -1);
    const chunk = o.file.slice(offset, Math.min(offset + RESUMABLE_CHUNK_BYTES, total));
    let attempt = 0;
    for (;;) {
      try {
        const res = await request(
          "PATCH",
          uploadUrl,
          { ...base, "upload-offset": String(offset), "content-type": "application/offset+octet-stream" },
          chunk,
          track,
          (loaded) => o.onProgress?.(Math.min(total, offset + loaded), total),
        );
        if (res.status === 204 || res.status === 200) {
          const next = Number(res.getResponseHeader("upload-offset"));
          offset = Number.isFinite(next) && next > offset ? next : offset + chunk.size;
          break;
        }
        throw new UploadError(readMessage(res, `上传失败（${res.status}）`), res.status);
      } catch (error) {
        const status = error instanceof UploadError ? error.status : 0;
        // 4xx（权限、文件已存在、过大）不重试；取消立即结束。
        if (status === -1 || (status >= 400 && status < 500 && status !== 409) || ++attempt > MAX_CHUNK_RETRIES) throw error;
        await new Promise((r) => setTimeout(r, 800 * attempt));
        // 断网续传：问清后台已经收到多少，再从那里继续。
        try {
          const head = await request("HEAD", uploadUrl, base, null, track);
          const got = Number(head.getResponseHeader("upload-offset"));
          if (Number.isFinite(got) && got >= 0) offset = got;
        } catch {
          /* 下一轮重试 */
        }
        if (offset >= total) break;
        if (cancelled) throw new UploadError("Upload cancelled", -1);
        break;
      }
    }
  }
  o.onProgress?.(total, total);
}
