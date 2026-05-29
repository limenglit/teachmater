// 将上传的 HTML 文件（任意编码）规范化为 UTF-8 字符串，并确保 <meta charset="utf-8"> 存在。
// 用于 Page 发布 / 白板 HTML 上传等场景。

function detectHtmlCharset(bytes: Uint8Array): string | null {
  const head = new TextDecoder('ascii', { fatal: false }).decode(bytes.slice(0, 2048)).toLowerCase();
  const m1 = head.match(/<meta[^>]+charset\s*=\s*["']?\s*([a-z0-9_\-]+)/);
  if (m1) return m1[1];
  const m2 = head.match(/<meta[^>]+content\s*=\s*["'][^"']*charset=\s*([a-z0-9_\-]+)/);
  if (m2) return m2[1];
  return null;
}

function isValidUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

export async function normalizeHtmlFileToUtf8(file: Blob): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const declared = detectHtmlCharset(buf);
  const looksLikeUtf8 = isValidUtf8(buf);
  let text: string;

  if (declared && !/^utf-?8$/i.test(declared)) {
    try {
      text = new TextDecoder(declared.toLowerCase(), { fatal: false }).decode(buf);
    } catch {
      text = new TextDecoder('gbk', { fatal: false }).decode(buf);
    }
  } else if (!looksLikeUtf8) {
    try {
      text = new TextDecoder('gbk', { fatal: false }).decode(buf);
    } catch {
      text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    }
  } else {
    text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  }

  const utf8Meta = '<meta charset="utf-8">';
  const hasCharset = /<meta[^>]+charset\s*=/i.test(text);
  if (hasCharset) {
    text = text.replace(/<meta[^>]+charset\s*=\s*["']?[a-z0-9_\-]+["']?[^>]*>/gi, utf8Meta);
  } else if (/<head[^>]*>/i.test(text)) {
    text = text.replace(/<head[^>]*>/i, (m) => `${m}\n  ${utf8Meta}`);
  } else if (/<html[^>]*>/i.test(text)) {
    text = text.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${utf8Meta}</head>`);
  } else {
    text = `${utf8Meta}\n${text}`;
  }
  return text;
}
