export interface ParsedTitleRankRule {
  keyword: string;
  score: number;
}

const TITLE_RANK_RULE_KEY = 'teachmate_title_rank_rules_v1';

export type TitleRankSceneKey = 'conference' | 'smartClassroom' | 'banquet';

export const TITLE_RANK_PRESETS: Array<{ id: string; label: string; content: string }> = [
  {
    id: 'gov',
    label: '政府会务',
    content: [
      '局长 > 副局长 > 处长 > 副处长 > 科长 > 副科长 > 主任科员 > 科员',
      '书记 > 副书记 > 主任 > 副主任',
    ].join('\n'),
  },
  {
    id: 'school',
    label: '校内培训',
    content: [
      '校长 > 副校长 > 院长 > 副院长 > 主任 > 副主任 > 教授 > 副教授 > 讲师 > 教师',
      '辅导员=40',
    ].join('\n'),
  },
  {
    id: 'enterprise',
    label: '企业会议',
    content: [
      '董事长 > 总裁 > 副总裁 > 总经理 > 副总经理 > 总监 > 经理 > 主管 > 组长 > 专员',
      'CEO > VP > Director > Manager > Lead > Engineer',
    ].join('\n'),
  },
];

export const DEFAULT_TITLE_RANK_RULE_TEXT = [
  '# 支持两种写法：',
  '# 1) 层级写法：局长 > 处长 > 科长',
  '# 2) 分值写法：主任=85',
  '局长 > 处长 > 科长',
  '董事长 > 总裁 > 副总裁 > 总监 > 经理',
  '校长 > 副校长 > 主任 > 教师',
  'President > Vice President > Director > Manager > Lead > Engineer',
].join('\n');

const getScopedStorageKey = (sceneKey?: TitleRankSceneKey) => {
  return sceneKey ? `${TITLE_RANK_RULE_KEY}:${sceneKey}` : TITLE_RANK_RULE_KEY;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeLine = (line: string) => line.trim();

export const parseTitleRankRules = (text: string): ParsedTitleRankRule[] => {
  const ruleMap = new Map<string, ParsedTitleRankRule>();
  let plainRuleCount = 0;

  const upsertRule = (keyword: string, score: number) => {
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword) return;

    const key = normalizedKeyword.toLowerCase();
    const normalizedScore = Math.max(0, Math.min(200, Math.round(score)));
    const existing = ruleMap.get(key);
    if (!existing || normalizedScore > existing.score) {
      ruleMap.set(key, { keyword: normalizedKeyword, score: normalizedScore });
    }
  };

  text
    .split(/\r?\n/)
    .map(normalizeLine)
    .forEach(line => {
      if (!line || line.startsWith('#')) return;

      if (line.includes('>')) {
        const chain = line
          .split('>')
          .map(part => part.trim())
          .filter(Boolean);

        chain.forEach((keyword, index) => {
          upsertRule(keyword, Math.max(10, 100 - index * 10));
        });
        return;
      }

      const pairMatch = line.match(/^(.+?)(?:\s*[=:]\s*)(\d{1,3})$/);
      if (pairMatch) {
        const keyword = pairMatch[1]?.trim() || '';
        const score = Number(pairMatch[2]);
        if (keyword && Number.isFinite(score)) {
          upsertRule(keyword, score);
        }
        return;
      }

      upsertRule(line, Math.max(10, 70 - plainRuleCount * 5));
      plainRuleCount += 1;
    });

  return Array.from(ruleMap.values()).sort((a, b) => b.score - a.score);
};

export const buildTitleScorer = (text: string) => {
  const parsed = parseTitleRankRules(text);
  const compiled = parsed.map(rule => ({
    score: rule.score,
    matcher: new RegExp(escapeRegExp(rule.keyword), 'i'),
  }));

  return (title?: string) => {
    if (!title) return 0;
    const normalized = title.trim();
    if (!normalized) return 0;

    let bestScore = 0;
    for (const rule of compiled) {
      if (rule.matcher.test(normalized) && rule.score > bestScore) {
        bestScore = rule.score;
      }
    }

    return bestScore;
  };
};

export const loadTitleRankRuleText = (sceneKey?: TitleRankSceneKey) => {
  const scopedRaw = localStorage.getItem(getScopedStorageKey(sceneKey));
  if (scopedRaw && scopedRaw.trim()) return scopedRaw;

  // Backward compatibility: migrate from legacy global key on first scene-scoped use.
  const legacyRaw = localStorage.getItem(TITLE_RANK_RULE_KEY);
  if (sceneKey && legacyRaw && legacyRaw.trim()) {
    localStorage.setItem(getScopedStorageKey(sceneKey), legacyRaw);
    return legacyRaw;
  }

  const raw = localStorage.getItem(TITLE_RANK_RULE_KEY);
  if (!raw || !raw.trim()) return DEFAULT_TITLE_RANK_RULE_TEXT;
  return raw;
};

export const saveTitleRankRuleText = (text: string, sceneKey?: TitleRankSceneKey) => {
  const nextText = text.trim() ? text : DEFAULT_TITLE_RANK_RULE_TEXT;
  localStorage.setItem(getScopedStorageKey(sceneKey), nextText);
  return nextText;
};
