import { describe, it, expect } from 'vitest';
import {
  getFileCategory,
  getCardType,
  getFileExtFromUrl,
  getFileCategoryFromUrl,
  getFileNameFromUrl,
  getDocIcon,
  getCodeIcon,
  getCodeLanguage,
  ACCEPT_ALL_MEDIA,
} from './board-file-utils';

// ── getFileCategory ──────────────────────────────────────

describe('getFileCategory', () => {
  it('recognizes common image extensions', () => {
    for (const ext of ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']) {
      expect(getFileCategory(ext)).toBe('image');
    }
  });

  it('is case-insensitive', () => {
    expect(getFileCategory('JPG')).toBe('image');
    expect(getFileCategory('MP4')).toBe('video');
    expect(getFileCategory('MP3')).toBe('audio');
    expect(getFileCategory('PDF')).toBe('document');
  });

  it('recognizes video extensions', () => {
    for (const ext of ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv']) {
      expect(getFileCategory(ext)).toBe('video');
    }
  });

  it('recognizes audio extensions', () => {
    for (const ext of ['mp3', 'wav', 'ogg', 'aac', 'm4a']) {
      expect(getFileCategory(ext)).toBe('audio');
    }
  });

  it('recognizes code extensions', () => {
    for (const ext of ['c', 'cpp', 'py', 'js', 'ts', 'html', 'css', 'go', 'rs', 'java', 'rb', 'sh', 'sql', 'json', 'xml', 'yaml', 'md']) {
      expect(getFileCategory(ext)).toBe('code');
    }
  });

  it('falls back to document for unknown extensions', () => {
    expect(getFileCategory('doc')).toBe('document');
    expect(getFileCategory('pdf')).toBe('document');
    expect(getFileCategory('xyz')).toBe('document');
  });

  it('recognizes office document extensions', () => {
    for (const ext of ['doc', 'docx', 'pdf', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt']) {
      expect(getFileCategory(ext)).toBe('document');
    }
  });
});

// ── getCardType ──────────────────────────────────────────

describe('getCardType', () => {
  it('maps category directly to card type', () => {
    expect(getCardType('image')).toBe('image');
    expect(getCardType('video')).toBe('video');
    expect(getCardType('audio')).toBe('audio');
    expect(getCardType('document')).toBe('document');
  });
});

// ── getFileExtFromUrl ────────────────────────────────────

describe('getFileExtFromUrl', () => {
  it('extracts extension from a valid URL', () => {
    expect(getFileExtFromUrl('https://example.com/files/photo.jpg')).toBe('jpg');
    expect(getFileExtFromUrl('https://example.com/doc.pdf')).toBe('pdf');
  });

  it('lowercases the extension', () => {
    expect(getFileExtFromUrl('https://example.com/photo.PNG')).toBe('png');
  });

  it('returns empty string for invalid URL', () => {
    expect(getFileExtFromUrl('not-a-url')).toBe('');
  });

  it('handles URLs with query params', () => {
    const ext = getFileExtFromUrl('https://example.com/file.mp4?token=abc');
    // pathname is /file.mp4, so pop gives mp4
    expect(ext).toBe('mp4');
  });

  it('handles URLs without extension', () => {
    const ext = getFileExtFromUrl('https://example.com/noext');
    // pathname.split('.').pop() returns the full path segment when no dot
    expect(ext).toBe('/noext');
  });
});

// ── getFileCategoryFromUrl ───────────────────────────────

describe('getFileCategoryFromUrl', () => {
  it('detects image from URL', () => {
    expect(getFileCategoryFromUrl('https://cdn.example.com/photo.png')).toBe('image');
  });

  it('detects video from URL', () => {
    expect(getFileCategoryFromUrl('https://cdn.example.com/clip.mp4')).toBe('video');
  });

  it('defaults to document for unknown URL', () => {
    expect(getFileCategoryFromUrl('https://cdn.example.com/report.pdf')).toBe('document');
  });
});

// ── getFileNameFromUrl ───────────────────────────────────

describe('getFileNameFromUrl', () => {
  it('extracts filename from URL', () => {
    expect(getFileNameFromUrl('https://example.com/files/report.pdf')).toBe('report.pdf');
  });

  it('decodes URI-encoded filenames', () => {
    expect(getFileNameFromUrl('https://example.com/%E6%96%87%E4%BB%B6.pdf')).toBe('文件.pdf');
  });

  it('returns "file" for invalid URL', () => {
    expect(getFileNameFromUrl('bad')).toBe('file');
  });
});

// ── getDocIcon ───────────────────────────────────────────

describe('getDocIcon', () => {
  it('returns PDF icon', () => {
    expect(getDocIcon('pdf')).toBe('📄');
  });

  it('returns Word icon for doc/docx', () => {
    expect(getDocIcon('doc')).toBe('📝');
    expect(getDocIcon('docx')).toBe('📝');
    expect(getDocIcon('rtf')).toBe('📝');
  });

  it('returns spreadsheet icon for xls/xlsx/csv', () => {
    expect(getDocIcon('xls')).toBe('📊');
    expect(getDocIcon('xlsx')).toBe('📊');
    expect(getDocIcon('csv')).toBe('📊');
  });

  it('returns presentation icon for ppt/pptx', () => {
    expect(getDocIcon('ppt')).toBe('📽️');
    expect(getDocIcon('pptx')).toBe('📽️');
  });

  it('returns text icon for txt', () => {
    expect(getDocIcon('txt')).toBe('📃');
  });

  it('returns fallback icon for unknown', () => {
    expect(getDocIcon('zip')).toBe('📎');
  });

  it('is case-insensitive', () => {
    expect(getDocIcon('PDF')).toBe('📄');
    expect(getDocIcon('DOCX')).toBe('📝');
  });
});

// ── ACCEPT_ALL_MEDIA ─────────────────────────────────────

describe('ACCEPT_ALL_MEDIA', () => {
  it('includes image wildcard', () => {
    expect(ACCEPT_ALL_MEDIA).toContain('image/*');
  });

  it('includes video MIME types', () => {
    expect(ACCEPT_ALL_MEDIA).toContain('video/mp4');
  });

  it('includes audio MIME types', () => {
    expect(ACCEPT_ALL_MEDIA).toContain('audio/*');
    expect(ACCEPT_ALL_MEDIA).toContain('.mp3');
  });

  it('includes document extensions', () => {
    expect(ACCEPT_ALL_MEDIA).toContain('.pdf');
    expect(ACCEPT_ALL_MEDIA).toContain('.docx');
    expect(ACCEPT_ALL_MEDIA).toContain('.xlsx');
  });
});
