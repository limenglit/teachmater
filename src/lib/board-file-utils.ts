// File type detection and constants for board uploads

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv'];
const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'webm'];
const DOC_EXTS = ['doc', 'docx', 'pdf', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt', 'rtf', 'odt', 'ods', 'odp'];

export type BoardMediaCategory = 'image' | 'video' | 'audio' | 'document';

export const ACCEPT_ALL_MEDIA = [
  'image/*',
  'video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska',
  'audio/*',
  '.mp3,.wav,.ogg,.aac,.m4a',
  '.doc,.docx,.pdf,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.rtf,.odt,.ods,.odp',
].join(',');

export function getFileCategory(ext: string): BoardMediaCategory {
  const lower = ext.toLowerCase();
  if (IMAGE_EXTS.includes(lower)) return 'image';
  if (VIDEO_EXTS.includes(lower)) return 'video';
  if (AUDIO_EXTS.includes(lower)) return 'audio';
  if (DOC_EXTS.includes(lower)) return 'document';
  return 'document';
}

export function getCardType(category: BoardMediaCategory): string {
  return category; // card_type maps directly: 'image' | 'video' | 'document'
}

export function getFileExtFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop()?.toLowerCase() || '';
    return ext;
  } catch {
    return '';
  }
}

export function getFileCategoryFromUrl(url: string): BoardMediaCategory {
  return getFileCategory(getFileExtFromUrl(url));
}

export function getFileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return decodeURIComponent(pathname.split('/').pop() || 'file');
  } catch {
    return 'file';
  }
}

/** Human-readable label for document type icons */
export function getDocIcon(ext: string): string {
  const lower = ext.toLowerCase();
  if (lower === 'pdf') return '📄';
  if (['doc', 'docx', 'rtf', 'odt'].includes(lower)) return '📝';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(lower)) return '📊';
  if (['ppt', 'pptx', 'odp'].includes(lower)) return '📽️';
  if (lower === 'txt') return '📃';
  return '📎';
}
