import { supabase } from '@/integrations/supabase/client';

const BOARD_MEDIA_CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv',
  txt: 'text/plain',
  rtf: 'application/rtf',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  html: 'text/html',
  htm: 'text/html',
};

const MIME_PRIMARY_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/csv': 'csv',
  'text/plain': 'txt',
  'application/rtf': 'rtf',
  'application/zip': 'zip',
  'application/vnd.rar': 'rar',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/aac': 'aac',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
};

const MIME_EXTENSION_ALIASES: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
};

function getFileExtension(fileName: string) {
  return fileName.split('.').pop()?.trim().toLowerCase() || '';
}

function getContentType(file: Blob | File, fallbackFileName?: string) {
  const ext = getFileExtension(fallbackFileName || ('name' in file ? file.name : ''));
  return file.type || BOARD_MEDIA_CONTENT_TYPES[ext] || 'application/octet-stream';
}

function getUploadExtension(file: Blob | File, fallbackFileName?: string) {
  const fileName = fallbackFileName || ('name' in file ? file.name : '');
  const extFromName = getFileExtension(fileName);
  const contentType = getContentType(file, fallbackFileName);
  const allowedAliases = MIME_EXTENSION_ALIASES[contentType];

  if (extFromName) {
    if (!allowedAliases || allowedAliases.includes(extFromName)) {
      return extFromName;
    }
  }

  return MIME_PRIMARY_EXTENSIONS[contentType] || extFromName || 'bin';
}

export interface UploadBoardMediaOptions {
  boardId: string;
  fileName?: string;
  scope?: string;
  /** Called with real byte-level progress while the file is being transferred. */
  onProgress?: (loaded: number, total: number) => void;
  /** Receives an abort handle so callers can cancel the transfer. */
  onAbortHandle?: (abort: () => void) => void;
}


export interface UploadBoardMediaResult {
  contentType: string;
  path: string;
  publicUrl: string;
}

function detectHtmlCharset(bytes: Uint8Array): string | null {
  // Sniff first 1KB for <meta charset> or http-equiv content-type
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

async function normalizeHtmlToUtf8(file: Blob): Promise<Blob> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const declared = detectHtmlCharset(buf);
  const looksLikeUtf8 = isValidUtf8(buf);
  let text: string;

  if (declared && !/^utf-?8$/i.test(declared)) {
    // Honor declared non-UTF8 charset (gbk, gb2312, big5, shift_jis, etc.)
    try {
      text = new TextDecoder(declared.toLowerCase(), { fatal: false }).decode(buf);
    } catch {
      text = new TextDecoder('gbk', { fatal: false }).decode(buf);
    }
  } else if (!looksLikeUtf8) {
    // No/utf-8 declaration but bytes aren't valid UTF-8 → likely GBK (common for Chinese HTML saved on Windows)
    try {
      text = new TextDecoder('gbk', { fatal: false }).decode(buf);
    } catch {
      text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    }
  } else {
    text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  }

  // Ensure a UTF-8 meta charset tag is present / replace any existing charset declaration
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

  return new Blob([new TextEncoder().encode(text)], { type: 'text/html; charset=utf-8' });
}

export async function uploadBoardMediaFile(
  file: Blob | File,
  { boardId, fileName, scope = 'boards' }: UploadBoardMediaOptions,
): Promise<UploadBoardMediaResult> {
  let contentType = getContentType(file, fileName);
  const ext = getUploadExtension(file, fileName);
  const isHtml = ext === 'html' || ext === 'htm' || contentType.startsWith('text/html');

  let body: Blob;
  if (isHtml) {
    // Re-encode to UTF-8 and inject a proper charset meta so browsers render Chinese correctly
    body = await normalizeHtmlToUtf8(file);
    contentType = 'text/html; charset=utf-8';
  } else {
    const buffer = await file.arrayBuffer();
    body = new Blob([buffer], { type: contentType });
  }

  const path = `${scope}/${boardId}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage
    .from('board-media')
    .upload(path, body, {
      upsert: false,
      contentType,
      cacheControl: '3600',
    });

  if (error) throw error;

  const uploadedPath = data?.path || path;
  const { data: urlData } = supabase.storage.from('board-media').getPublicUrl(uploadedPath);

  return {
    contentType,
    path: uploadedPath,
    publicUrl: urlData.publicUrl,
  };
}