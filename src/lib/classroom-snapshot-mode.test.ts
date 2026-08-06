import { describe, it, expect } from 'vitest';
import { collectActiveRules, type SeatModeId, type SeatRuleState } from './seat-rule-conflicts';
import type { ClassroomSnapshot } from './teamwork-local';

const ALL_MODES: SeatModeId[] = [
  'exam',
  'groupCol',
  'groupRow',
  'horizontalS',
  'random',
  'smartCluster',
  'studentNo',
  'verticalS',
];

const baseRuleState = (mode: SeatModeId): SeatRuleState => ({
  mode,
  genderPolicy: 'none',
  smartClusterStrategy: 'classic',
  groupSource: 'auto',
  startFrom: 'door',
  examSkipRow: false,
  examSkipCol: false,
});

const buildSnapshot = (mode: SeatModeId): ClassroomSnapshot => ({
  rows: 4,
  cols: 5,
  mode,
  groupCount: 4,
  groupSource: 'auto',
  smartClusterStrategy: 'classic',
  disabledSeats: [],
  examSkipRow: false,
  examSkipCol: false,
  startFrom: 'door',
  windowOnLeft: true,
  colAisles: [],
  rowAisles: [],
  seats: [[null, null, null, null, null]],
  updatedAt: new Date().toISOString(),
});

describe('ClassroomSnapshot mode mapping', () => {
  it('accepts every SeatModeId as a snapshot mode', () => {
    for (const mode of ALL_MODES) {
      const snapshot = buildSnapshot(mode);
      expect(snapshot.mode).toBe(mode);
    }
  });

  it('round-trips the mode through a serialized snapshot', () => {
    for (const mode of ALL_MODES) {
      const parsed = JSON.parse(JSON.stringify(buildSnapshot(mode))) as ClassroomSnapshot;
      expect(parsed.mode).toBe(mode);
      // A restored snapshot must still be a valid rule-state mode.
      expect(ALL_MODES).toContain(parsed.mode as SeatModeId);
    }
  });

  it('exposes a labeled mode rule for every mode, including studentNo', () => {
    for (const mode of ALL_MODES) {
      const rules = collectActiveRules(baseRuleState(mode));
      const modeRule = rules.find(rule => rule.kind === 'mode');
      expect(modeRule, `missing mode rule for ${mode}`).toBeTruthy();
      expect(modeRule!.id).toBe(mode);
      expect(modeRule!.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('produces unique labels per mode', () => {
    const labels = ALL_MODES.map(
      mode => collectActiveRules(baseRuleState(mode)).find(rule => rule.kind === 'mode')!.label
    );
    expect(new Set(labels).size).toBe(ALL_MODES.length);
  });
});
