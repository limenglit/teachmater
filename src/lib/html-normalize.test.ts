import { describe, it, expect } from 'vitest';
import { normalizeHtmlFileToUtf8 } from './html-normalize';

function blobFromBytes(bytes: Uint8Array, type = 'text/html'): Blob {
  return new Blob([bytes], { type });
}

describe('normalizeHtmlFileToUtf8', () => {
  it('keeps UTF-8 content and injects charset meta if missing', async () => {
    const html = '<html><head><title>你好</title></head><body>世界</body></html>';
    const bytes = new TextEncoder().encode(html);
    const out = await normalizeHtmlFileToUtf8(blobFromBytes(bytes));
    expect(out).toContain('你好');
    expect(out).toContain('世界');
    expect(out.toLowerCase()).toContain('<meta charset="utf-8">');
  });

  it('replaces non-utf8 declared charset meta with utf-8', async () => {
    const html = '<html><head><meta charset="gbk"><title>T</title></head><body>x</body></html>';
    const bytes = new TextEncoder().encode(html);
    const out = await normalizeHtmlFileToUtf8(blobFromBytes(bytes));
    expect(out.toLowerCase()).toContain('<meta charset="utf-8">');
    expect(out.toLowerCase()).not.toMatch(/charset="gbk"/);
  });

  it('prepends meta when no <head> present', async () => {
    const html = '<div>纯片段</div>';
    const bytes = new TextEncoder().encode(html);
    const out = await normalizeHtmlFileToUtf8(blobFromBytes(bytes));
    expect(out.toLowerCase().indexOf('<meta charset="utf-8">')).toBeLessThan(out.indexOf('<div'));
    expect(out).toContain('纯片段');
  });
});
