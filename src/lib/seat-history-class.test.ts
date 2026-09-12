import { describe, it, expect } from 'vitest';
import {
  withActiveClassContext,
  snapshotMatchesClass,
  filterHistoryByClass,
  readSnapshotClassContext,
  historyClassLabel,
} from './seat-history-class';

const ctx = (label: string, classIds: string[] = [], collegeIds: string[] = []) => ({ label, classIds, collegeIds });

describe('seat-history-class', () => {
  it('stamps the active class onto the snapshot', () => {
    const snap = withActiveClassContext({ rows: 3 }, ctx('计算机1班', ['c1'], ['g1']));
    expect(readSnapshotClassContext(snap)).toEqual({ label: '计算机1班', classIds: ['c1'], collegeIds: ['g1'] });
    expect(historyClassLabel(snap)).toBe('计算机1班');
  });

  it('leaves the snapshot untouched when no class is active', () => {
    const snap = withActiveClassContext({ rows: 3 }, ctx('', []));
    expect(readSnapshotClassContext(snap)).toBeNull();
  });

  it('matches by class id first', () => {
    const snap = withActiveClassContext({}, ctx('一班', ['c1']));
    expect(snapshotMatchesClass(snap, ctx('随便写的名字', ['c1']))).toBe(true);
    expect(snapshotMatchesClass(snap, ctx('一班', ['c2']))).toBe(false);
  });

  it('falls back to the class name when ids are unavailable', () => {
    const snap = withActiveClassContext({}, ctx('计算机 1班'));
    expect(snapshotMatchesClass(snap, ctx('计算机1班'))).toBe(true);
    expect(snapshotMatchesClass(snap, ctx('计算机2班'))).toBe(false);
  });

  it('keeps legacy untagged records visible and shows everything when no class is selected', () => {
    expect(snapshotMatchesClass({ rows: 3 }, ctx('计算机1班', ['c1']))).toBe(true);
    const tagged = withActiveClassContext({}, ctx('二班', ['c2']));
    expect(snapshotMatchesClass(tagged, ctx('', []))).toBe(true);
  });

  it('filters a history list by the active class', () => {
    const items = [
      { id: 'a', name: 'A', createdAt: '', snapshot: withActiveClassContext({}, ctx('一班', ['c1'])) },
      { id: 'b', name: 'B', createdAt: '', snapshot: withActiveClassContext({}, ctx('二班', ['c2'])) },
      { id: 'c', name: 'C', createdAt: '', snapshot: {} },
    ];
    expect(filterHistoryByClass(items, ctx('一班', ['c1'])).map(i => i.id)).toEqual(['a', 'c']);
  });
});
