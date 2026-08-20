/**
 * Regression tests for the WeChat (MicroMessenger) compatibility layer.
 *
 * The bug we guard against: inside WeChat the page could get "stuck" — neither
 * vertical nor horizontal swiping scrolled anything, because
 *   1. html/body/containers used `overflow-x: hidden` (which implicitly turns
 *      the Y axis into `auto`, making them scroll containers), and
 *   2. inner scrollers used `overscroll-behavior: contain`, swallowing the
 *      gesture instead of chaining it to the document, and
 *   3. a dropped `touchend` could leave `<html data-pinching>` set forever,
 *      freezing every scroll container in `touch-action: pinch-zoom`.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const css = readFileSync(path.resolve(__dirname, '../index.css'), 'utf8');

function setWeChatUA(on: boolean) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: on
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 MicroMessenger/8.0.49(0x18003128) NetType/WIFI'
      : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
  });
}

/** jsdom has no TouchEvent constructor — fake the shape the layer reads. */
function touch(type: string, fingers: number, target: EventTarget = document.body) {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'touches', { value: new Array(fingers).fill({}) });
  target.dispatchEvent(ev);
}

async function install() {
  vi.resetModules();
  const mod = await import('./wechat-compat');
  mod.installWeChatCompat();
  return mod;
}

describe('wechat-compat gesture regressions', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame'] });
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-pinching');
    document.body.innerHTML = '';
    setWeChatUA(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    setWeChatUA(false);
  });

  it('tags the document and restores pinch-zoom in the viewport meta', async () => {
    await install();
    expect(document.documentElement.classList.contains('is-wechat')).toBe(true);
    expect(document.documentElement.classList.contains('is-wechat-ios')).toBe(true);
    const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
    expect(meta.content).toContain('user-scalable=yes');
    expect(meta.content).toContain('viewport-fit=cover');
  });

  it('does nothing outside MicroMessenger', async () => {
    setWeChatUA(false);
    await install();
    expect(document.documentElement.classList.contains('is-wechat')).toBe(false);
  });

  it('vertical swipe (one finger) never freezes scrolling', async () => {
    await install();
    touch('touchstart', 1);
    touch('touchmove', 1);
    touch('touchmove', 1);
    touch('touchend', 0);
    expect(document.documentElement.hasAttribute('data-pinching')).toBe(false);
  });

  it('horizontal swipe (one finger) never freezes scrolling', async () => {
    await install();
    const scroller = document.createElement('div');
    scroller.className = 'overflow-x-auto';
    document.body.appendChild(scroller);

    touch('touchstart', 1, scroller);
    touch('touchmove', 1, scroller);
    touch('touchend', 0, scroller);
    expect(document.documentElement.hasAttribute('data-pinching')).toBe(false);
  });

  it('two-finger pinch freezes scroll, then releases it after the gesture', async () => {
    await install();
    touch('touchstart', 2);
    expect(document.documentElement.hasAttribute('data-pinching')).toBe(true);

    touch('touchend', 1);
    vi.advanceTimersByTime(300);
    expect(document.documentElement.hasAttribute('data-pinching')).toBe(false);
  });

  it('watchdog releases the frozen state when WeChat drops touchend', async () => {
    await install();
    touch('touchstart', 2);
    expect(document.documentElement.hasAttribute('data-pinching')).toBe(true);

    // No touchend at all — the safety timer must unstick scrolling.
    vi.advanceTimersByTime(2500);
    expect(document.documentElement.hasAttribute('data-pinching')).toBe(false);
  });

  it('surfaces with their own pinch handling are not arbitrated globally', async () => {
    await install();
    const canvas = document.createElement('div');
    canvas.setAttribute('data-own-pinch', '');
    document.body.appendChild(canvas);

    touch('touchstart', 2, canvas);
    expect(document.documentElement.hasAttribute('data-pinching')).toBe(false);
  });

  it('rotation re-measures the safe area and restores body height', async () => {
    await install();
    const changed = vi.fn();
    window.addEventListener('safe-area-change', changed);

    window.dispatchEvent(new Event('orientationchange'));
    vi.runAllTimers();

    expect(changed).toHaveBeenCalled();
    expect(document.body.style.minHeight).toBe('');
  });
});

describe('index.css scroll rules', () => {
  it('uses overflow-x: clip (not hidden) so html/body stay scrollable on mobile', () => {
    expect(css).toContain('overflow-x: clip');
    expect(css).toMatch(/html\.is-wechat,\s*html\.is-wechat body \{[^}]*overflow-y: visible/);
  });

  it('lets inner scrollers chain the gesture to the page', () => {
    expect(css).toMatch(/overscroll-behavior: auto/);
    expect(css).not.toMatch(/@media \(pointer: coarse\)[\s\S]{0,600}overscroll-behavior: contain/);
  });

  it('keeps pan + pinch-zoom available on WeChat scroll containers', () => {
    expect(css).toMatch(/html\.is-wechat \.overflow-y-auto[\s\S]{0,200}touch-action: pan-x pan-y pinch-zoom/);
  });

  it('downgrades .overflow-x-hidden to clip on mobile widths', () => {
    expect(css).toMatch(/\.overflow-x-hidden \{\s*overflow-x: clip;/);
  });
});
