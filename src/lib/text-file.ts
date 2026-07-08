/**
 * Decode text-file bytes with Chinese classroom roster compatibility.
 * UTF-8/UTF-16 BOMs are honored; otherwise UTF-8 is tried first and files
 * with replacement characters fall back to GB18030 (covers GBK/GB2312).
 */
export function decodeTextBytes(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }

  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (utf8.includes('\ufffd')) {
    try {
      return new TextDecoder('gb18030').decode(bytes);
    } catch {
      return utf8;
    }
  }
  return utf8;
}