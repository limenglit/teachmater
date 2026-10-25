/**
 * Font size for a name printed in a 64x48 classroom seat (about 56px of text
 * width after border and padding), counting the trailing gender marker.
 * Names that still don't fit at 10px wrap onto two lines at that size.
 */
export const SEAT_LABEL_WIDTH = 56;

const units = (text: string) =>
  Array.from(text).reduce((w, ch) => w + (/[\u2e80-\uffef]/.test(ch) ? 1 : 0.6), 0);

export function seatLabelFontPx(name: string, withMarker = true): 11 | 10 {
  const width = units(name) + (withMarker ? 1.1 : 0);
  return width * 11 <= SEAT_LABEL_WIDTH ? 11 : 10;
}
