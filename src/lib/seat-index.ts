export interface SeatIndexEntry {
  name: string;
  studentNumber?: string;
  row: number;
  col: number;
}

/** Sort: by student number when every entry has one, else by pinyin. */
export function sortSeatIndex(entries: SeatIndexEntry[]): { sortBy: 'number' | 'pinyin'; entries: SeatIndexEntry[] } {
  const byNumber = entries.length > 0 && entries.every(e => (e.studentNumber ?? '').trim());
  const collator = new Intl.Collator('zh-Hans-CN-u-co-pinyin', { numeric: true });
  const sorted = [...entries].sort((a, b) =>
    byNumber
      ? collator.compare(a.studentNumber!.trim(), b.studentNumber!.trim()) || collator.compare(a.name, b.name)
      : collator.compare(a.name, b.name),
  );
  return { sortBy: byNumber ? 'number' : 'pinyin', entries: sorted };
}

/**
 * Build index entries from a classroom grid (第X排第Y座, door side = 第1座).
 * Numbering matches the exported chart's 第N排 / 第N列 labels exactly: closed
 * seats and closed rows still count, so the index never contradicts page 1.
 */
export function buildClassroomSeatIndex(
  seats: (string | null)[][],
  disabledSeats: Iterable<string>,
  doorOnRight: boolean,
  numberByName?: Map<string, string | undefined>,
): SeatIndexEntry[] {
  const disabled = new Set(disabledSeats);
  const cols = seats.reduce((m, r) => Math.max(m, r.length), 0);
  const out: SeatIndexEntry[] = [];
  seats.forEach((rowArr, r) => {
    rowArr.forEach((name, c) => {
      if (!name || disabled.has(`${r}-${c}`)) return;
      out.push({ name, studentNumber: numberByName?.get(name), row: r + 1, col: doorOnRight ? cols - c : c + 1 });
    });
  });
  return out;
}

