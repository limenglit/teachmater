import { describe, it, expect } from 'vitest';
import { rewriteModernColors, withLegacyColors } from './html2canvas-colors';

// Fake browser conversion: every color samples to an opaque mid-red pixel.
const sample = (c: string) => (c.includes('/') ? null : ([200, 10, 20, 255] as [number, number, number, number]));

describe('html2canvas modern color compatibility', () => {
  it('rewrites oklab with alpha to rgba keeping the alpha', () => {
    expect(rewriteModernColors('oklab(0.593887 0.168983 0.0782202 / 0.3)', sample)).toBe('rgba(200, 10, 20, 0.3)');
  });

  it('rewrites colors inside shadows and leaves rgb values alone', () => {
    const out = rewriteModernColors('rgb(0, 0, 0) 0px 1px 2px 0px, oklch(0.7 0.1 30 / 10%) 0px 0px 0px 1px', sample);
    expect(out).toBe('rgb(0, 0, 0) 0px 1px 2px 0px, rgba(200, 10, 20, 0.1) 0px 0px 0px 1px');
  });

  it('restores getComputedStyle after the capture, even when it fails', async () => {
    const before = window.getComputedStyle;
    await expect(withLegacyColors(async () => { throw new Error('x'); }, sample)).rejects.toThrow('x');
    expect(window.getComputedStyle).toBe(before);
  });
});
