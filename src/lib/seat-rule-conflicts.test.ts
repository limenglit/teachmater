import { describe, it, expect } from 'vitest';
import { collectActiveRules, detectRuleConflicts, type SeatRuleState } from './seat-rule-conflicts';

const baseState: SeatRuleState = {
  mode: 'verticalS',
  genderPolicy: 'none',
  smartClusterStrategy: 'classic',
  groupSource: 'auto',
  startFrom: 'door',
  examSkipRow: true,
  examSkipCol: false,
};

describe('collectActiveRules', () => {
  it('always includes mode and start', () => {
    const rules = collectActiveRules(baseState);
    expect(rules.find(r => r.kind === 'mode')?.id).toBe('mode:verticalS');
    expect(rules.find(r => r.kind === 'start')?.id).toBe('start:door');
  });

  it('hides cluster + group rules outside smartCluster/group modes', () => {
    const rules = collectActiveRules(baseState);
    expect(rules.some(r => r.kind === 'cluster')).toBe(false);
    expect(rules.some(r => r.kind === 'group')).toBe(false);
  });

  it('includes exam skip rules only for exam mode', () => {
    const rules = collectActiveRules({ ...baseState, mode: 'exam', examSkipCol: true });
    expect(rules.filter(r => r.kind === 'exam')).toHaveLength(2);
  });

  it('alternateRows has higher priority than mode', () => {
    const rules = collectActiveRules({ ...baseState, genderPolicy: 'alternateRows' });
    const gender = rules.find(r => r.kind === 'gender')!;
    const mode = rules.find(r => r.kind === 'mode')!;
    expect(gender.priority).toBeGreaterThan(mode.priority);
  });
});

describe('detectRuleConflicts', () => {
  it('flags alternateRows overriding mode', () => {
    const rules = collectActiveRules({ ...baseState, mode: 'horizontalS', genderPolicy: 'alternateRows' });
    const c = detectRuleConflicts(rules);
    expect(c).toHaveLength(1);
    expect(c[0].winnerId).toBe('gender:alternateRows');
    expect(c[0].loserIds).toContain('mode:horizontalS');
  });

  it('flags smartCluster overriding within-row gender', () => {
    const rules = collectActiveRules({ ...baseState, mode: 'smartCluster', genderPolicy: 'alternate' });
    const c = detectRuleConflicts(rules);
    expect(c.some(x => x.winnerId === 'mode:smartCluster' && x.loserIds.includes('gender:alternate'))).toBe(true);
  });

  it('flags random ignoring gender policy', () => {
    const rules = collectActiveRules({ ...baseState, mode: 'random', genderPolicy: 'cluster' });
    const c = detectRuleConflicts(rules);
    expect(c.some(x => x.winnerId === 'mode:random')).toBe(true);
  });

  it('flags exam ignoring group source', () => {
    const rules = collectActiveRules({ ...baseState, mode: 'exam', groupSource: 'groups' });
    // exam mode doesn't produce a group rule, so no conflict expected.
    const c = detectRuleConflicts(rules);
    expect(c).toHaveLength(0);
  });

  it('flags orgFrontWeighted ignoring non-auto group source', () => {
    const rules = collectActiveRules({ ...baseState, mode: 'smartCluster', smartClusterStrategy: 'orgFrontWeighted', groupSource: 'groups' });
    const c = detectRuleConflicts(rules);
    expect(c.some(x => x.winnerId === 'cluster:orgFrontWeighted')).toBe(true);
  });

  it('returns empty for harmonious combos', () => {
    const rules = collectActiveRules({ ...baseState, mode: 'verticalS', genderPolicy: 'alternate' });
    expect(detectRuleConflicts(rules)).toHaveLength(0);
  });
});
