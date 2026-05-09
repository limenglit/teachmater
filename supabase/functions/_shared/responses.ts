// Shared response helpers used to keep error payloads sanitized
// and to centralize size limits for AI uploads.

export const MAX_IMAGE_BASE64_BYTES = 5 * 1024 * 1024; // 5 MB

export function jsonResponse(
  body: unknown,
  status: number,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/**
 * Generic 500 response that never leaks internal error messages
 * (stack traces, upstream provider details, etc.).
 */
export function internalErrorResponse(cors: Record<string, string>): Response {
  return jsonResponse({ error: "Internal error" }, 500, cors);
}

/**
 * Returns a 413 response when the provided base64 image exceeds the
 * platform's hard limit, otherwise returns null.
 */
export function checkImageSize(
  base64: string,
  cors: Record<string, string>,
): Response | null {
  if (typeof base64 !== "string") return null;
  if (base64.length > MAX_IMAGE_BASE64_BYTES) {
    return jsonResponse(
      { error: "Image too large (max 5 MB)" },
      413,
      cors,
    );
  }
  return null;
}
