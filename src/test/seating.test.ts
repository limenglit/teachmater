import { describe, it, expect } from 'vitest';
import {
  distributeToTables,
  distributeBanquet,
  distributeSmartClassroom,
  distributeConferenceLongTable,
  distributeConcertHall,
  distributeComputerLab,
} from '@/lib/seating';

describe('seating library', () => {
  it('distributeToTables basic', () => {
    const names = ['a', 'b', 'c', 'd', 'e'];
    const tables = distributeToTables(names, 2, 3, false);
    expect(tables.length).toBe(2);
    // each table length <= seatsPerTable
    expect(tables[0].length).toBeLessThanOrEqual(3);
    expect(tables[1].length).toBeLessThanOrEqual(3);
    expect(tables.flat().length).toBe(5);
  });

  it('distributeBanquet distributes roughly evenly over calculated tables', () => {
    const names = Array.from({ length: 21 }, (_, i) => `s${i}`);
    const tables = distributeBanquet(names, 10, false);
    // should produce 3 tables (ceil(21/10))
    expect(tables.length).toBe(3);
    // every table size should not exceed seatsPerTable and total matches input
    tables.forEach(t => expect(t.length).toBeLessThanOrEqual(10));
    expect(tables.flat().length).toBe(21);
  });

  it('smart classroom table distribution', () => {
    const names = Array.from({ length: 12 }, (_, i) => `n${i}`);
    const res = distributeSmartClassroom(names, 4, 3, false);
    expect(res.length).toBe(4);
    expect(res.flat().length).toBe(12);
  });

  it('conference long table heads and sides', () => {
    const names = ['h1', 'h2', 't1', 't2', 't3', 'b1', 'b2'];
    const { top, bottom, headLeft, headRight } = distributeConferenceLongTable(names, 3, false);
    expect(headLeft).toBe('h1');
    expect(headRight).toBe('h2');
    expect(top.length).toBeLessThanOrEqual(3);
    expect(bottom.length).toBeLessThanOrEqual(3);
  });

  it('concert hall rows increase seats', () => {
    const names = Array.from({ length: 50 }, (_, i) => `p${i}`);
    const rows = distributeConcertHall(names, 6, 5, false);
    expect(rows.length).toBeGreaterThan(0);
    // seat counts per row are non-decreasing
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].length).toBeGreaterThanOrEqual(rows[i - 1].length);
    }
  });

  it('computer lab rows and sides', () => {
    const names = Array.from({ length: 20 }, (_, i) => `u${i}`);
    const rows = distributeComputerLab(names, 3, 4, true, false);
    // expect rows of top/bottom groups
    expect(rows.length).toBeGreaterThan(0);
    const total = rows.reduce((s, r) => s + r.students.length, 0);
    expect(total).toBe(20);
  });
});
