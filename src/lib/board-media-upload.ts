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
}

export interface UploadBoardMediaResult {
  contentType: string;
  path: string;
  publicUrl: string;
}

export async function uploadBoardMediaFile(
  file: Blob | File,
  { boardId, fileName, scope = 'boards' }: UploadBoardMediaOptions,
): Promise<UploadBoardMediaResult> {
  const contentType = getContentType(file, fileName);
  const ext = getUploadExtension(file, fileName);
  const path = `${scope}/${boardId}/${crypto.randomUUID()}.${ext}`;
  const buffer = await file.arrayBuffer();
  const body = new Blob([buffer], { type: contentType });

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