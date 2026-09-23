import { describe, it, expect, afterEach } from 'vitest';
import { getShareOrigin, buildShareUrl, PUBLIC_SHARE_ORIGIN } from './share-origin';

const setLoc = (href: string) => {
  const u = new URL(href);
  Object.defineProperty(window, 'location', {
    value: { origin: u.origin, hostname: u.hostname, protocol: u.protocol, href },
    writable: true,
    configurable: true,
  });
};

afterEach(() => setLoc('http://localhost/'));

describe('getShareOrigin', () => {
  it('falls back to the public domain on preview hosts', () => {
    setLoc('https://id-preview--50abb99d.lovable.app/');
    expect(getShareOrigin()).toBe(PUBLIC_SHARE_ORIGIN);
  });
  it('falls back on localhost', () => {
    setLoc('http://localhost:8080/');
    expect(getShareOrigin()).toBe(PUBLIC_SHARE_ORIGIN);
  });
  it('keeps the custom domain', () => {
    setLoc('https://teachermate.org.cn/board/1');
    expect(getShareOrigin()).toBe('https://teachermate.org.cn');
  });
  it('keeps the published lovable domain', () => {
    setLoc('https://teachmater.lovable.app/');
    expect(getShareOrigin()).toBe('https://teachmater.lovable.app');
  });
  it('builds share urls', () => {
    setLoc('https://teachermate.org.cn/');
    expect(buildShareUrl('quiz/9')).toBe('https://teachermate.org.cn/quiz/9');
  });
});
