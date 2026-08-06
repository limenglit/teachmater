/**
 * Seat rule composition + conflict detection.
 *
 * The seat panel already exposes several independent selectors (mode,
 * gender policy, smart-cluster strategy, group source, start-from). When a
 * teacher combines them, some pairs silently override each other inside the
 * `autoSeat` algorithm. This module exposes:
 *
 *   1. `collectActiveRules(state)` — normalize the current panel state into
 *      a flat list of "active rules" suitable for chip rendering.
 *   2. `detectRuleConflicts(rules)` — return human-readable conflict reports
 *      with a clear "winner" so the UI can tell the user which one will
 *      actually take effect after auto-seat.
 *
 * Pure functions, no React, fully unit-testable.
 */

export type SeatModeId =
  | 'verticalS' | 'studentNo' | 'horizontalS' | 'groupCol' | 'groupRow'
  | 'smartCluster' | 'random' | 'exam';

export type GenderPolicyId = 'none' | 'alternate' | 'cluster' | 'alternateRows';
export type SmartClusterStrategyId = 'classic' | 'orgFrontWeighted';
export type GroupSourceId = 'auto' | 'groups' | 'teams' | 'count';
export type StartFromId = 'door' | 'window' | 'center';

export interface SeatRuleState {
  mode: SeatModeId;
  genderPolicy: GenderPolicyId;
  smartClusterStrategy: SmartClusterStrategyId;
  groupSource: GroupSourceId;
  startFrom: StartFromId;
  examSkipRow: boolean;
  examSkipCol: boolean;
}

export type RuleKind = 'mode' | 'gender' | 'cluster' | 'group' | 'start' | 'exam';

export interface ActiveRule {
  kind: RuleKind;
  id: string;
  label: string;
  /**
   * Larger = higher priority. autoSeat is hard-coded so we mirror its real
   * precedence here: gender alternateRows runs first and returns early, so
   * it dominates `mode`; otherwise `mode` dominates within-row gender.
   */
  priority: number;
}

export interface RuleConflict {
  /** The rule whose intent will fully take effect. */
  winnerId: string;
  /** Rules whose intent is silently overridden by the winner. */
  loserIds: string[];
  /** Plain-language hint shown to the teacher. */
  message: string;
  severity: 'warning' | 'info';
}

const MODE_LABEL: Record<SeatModeId, string> = {
  verticalS: 'S 形纵向',
  studentNo: '学号顺序',
  horizontalS: 'S 形横向',
  groupCol: '按列分组',
  groupRow: '按行分组',
  smartCluster: '智能集中',
  random: '随机',
  exam: '考试模式',
};

const GENDER_LABEL: Record<GenderPolicyId, string> = {
  none: '不限制性别',
  alternate: '男女间隔',
  cluster: '男女集中',
  alternateRows: '男女隔行',
};

const CLUSTER_LABEL: Record<SmartClusterStrategyId, string> = {
  classic: '经典聚类',
  orgFrontWeighted: '前排优先 + 按单位分列',
};

const GROUP_LABEL: Record<GroupSourceId, string> = {
  auto: '自动来源',
  groups: '使用已分组',
  teams: '使用已建队',
  count: '按组数临时分组',
};

const START_LABEL: Record<StartFromId, string> = {
  door: '从门口起',
  window: '从窗边起',
  center: '居中开始',
};

export function collectActiveRules(state: SeatRuleState): ActiveRule[] {
  const out: ActiveRule[] = [];

  out.push({ kind: 'mode', id: `mode:${state.mode}`, label: `排座模式：${MODE_LABEL[state.mode]}`, priority: 50 });

  if (state.genderPolicy !== 'none') {
    // alternateRows in autoSeat returns early — it overrides `mode` entirely.
    const priority = state.genderPolicy === 'alternateRows' ? 90 : 40;
    out.push({
      kind: 'gender',
      id: `gender:${state.genderPolicy}`,
      label: `性别策略：${GENDER_LABEL[state.genderPolicy]}`,
      priority,
    });
  }

  if (state.mode === 'smartCluster') {
    out.push({
      kind: 'cluster',
      id: `cluster:${state.smartClusterStrategy}`,
      label: `集中策略：${CLUSTER_LABEL[state.smartClusterStrategy]}`,
      priority: 30,
    });
  }

  const needsGroup: SeatModeId[] = ['groupCol', 'groupRow', 'smartCluster'];
  if (needsGroup.includes(state.mode)) {
    out.push({
      kind: 'group',
      id: `group:${state.groupSource}`,
      label: `分组来源：${GROUP_LABEL[state.groupSource]}`,
      priority: 25,
    });
  }

  out.push({ kind: 'start', id: `start:${state.startFrom}`, label: `起始位置：${START_LABEL[state.startFrom]}`, priority: 20 });

  if (state.mode === 'exam') {
    if (state.examSkipRow) out.push({ kind: 'exam', id: 'exam:skipRow', label: '考试：隔行', priority: 15 });
    if (state.examSkipCol) out.push({ kind: 'exam', id: 'exam:skipCol', label: '考试：隔列', priority: 15 });
  }

  return out;
}

export function detectRuleConflicts(rules: ActiveRule[]): RuleConflict[] {
  const conflicts: RuleConflict[] = [];
  const byId = new Map(rules.map(r => [r.id, r]));

  const has = (id: string) => byId.has(id);

  // 1. alternateRows totally overrides the chosen seat mode.
  if (has('gender:alternateRows')) {
    const modeRule = rules.find(r => r.kind === 'mode');
    if (modeRule && modeRule.id !== 'mode:verticalS') {
      conflicts.push({
        winnerId: 'gender:alternateRows',
        loserIds: [modeRule.id],
        message: '"男女隔行" 会直接按行填充并提前返回，所选「排座模式」不会生效。',
        severity: 'warning',
      });
    }
  }

  // 2. Smart cluster + within-row gender alternation cannot coexist; mode wins.
  if (has('mode:smartCluster') && (has('gender:alternate') || has('gender:cluster'))) {
    const loser = has('gender:alternate') ? 'gender:alternate' : 'gender:cluster';
    conflicts.push({
      winnerId: 'mode:smartCluster',
      loserIds: [loser],
      message: '"智能集中" 已按组/单位决定座位顺序，所选的同行性别策略不会再生效。',
      severity: 'warning',
    });
  }

  // 3. Random + any gender policy: random wins, gender is ignored.
  if (has('mode:random') && rules.some(r => r.kind === 'gender' && r.id !== 'gender:none')) {
    const loser = rules.find(r => r.kind === 'gender')!.id;
    conflicts.push({
      winnerId: 'mode:random',
      loserIds: [loser],
      message: '"随机" 模式忽略性别策略，若要保留性别规则请改用 S 形或考试模式。',
      severity: 'warning',
    });
  }

  // 4. Exam mode + group source has no effect (exam ignores groups).
  if (has('mode:exam') && rules.some(r => r.kind === 'group')) {
    const loser = rules.find(r => r.kind === 'group')!.id;
    conflicts.push({
      winnerId: 'mode:exam',
      loserIds: [loser],
      message: '"考试模式" 单独按列铺设，"分组来源" 不参与排座。',
      severity: 'info',
    });
  }

  // 5. orgFrontWeighted cluster + non-auto group source: org strategy wins.
  if (has('cluster:orgFrontWeighted') && rules.some(r => r.kind === 'group' && r.id !== 'group:auto')) {
    const loser = rules.find(r => r.kind === 'group')!.id;
    conflicts.push({
      winnerId: 'cluster:orgFrontWeighted',
      loserIds: [loser],
      message: '"前排优先 + 按单位分列" 直接按单位人数排列，不会读取所选分组来源。',
      severity: 'info',
    });
  }

  return conflicts;
}
