import { describe, it, expect } from 'vitest';
import { seatLabelFontPx } from './seat-label-size';

describe('seatLabelFontPx', () => {
  it('keeps 11px for names up to three characters plus the gender marker', () => {
    expect(seatLabelFontPx('张伟')).toBe(11);
    expect(seatLabelFontPx('袁倩倩')).toBe(11);
  });
  it('drops to 10px for four or more characters so the marker stays on the line', () => {
    expect(seatLabelFontPx('欧阳晓燕')).toBe(10);
    expect(seatLabelFontPx('司马相如意')).toBe(10);
  });
});
