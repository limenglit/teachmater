import type { TeamingDimension, TeamingStrategy } from '@/lib/team-assignment';

export type TeamingPresetScope = 'groups' | 'teams';

export interface TeamingPreset {
  id: string;
  name: string;
  strategy: TeamingStrategy;
  customPrimaryDimension: TeamingDimension | 'none';
  customBalanceDimensions: TeamingDimension[];
  builtIn?: boolean;
}

interface TeamingPresetStorage {
  groups: TeamingPreset[];
  teams: TeamingPreset[];
}

const STORAGE_KEY = 'teachmate_teaming_presets_v1';

const BUILTIN_PRESETS: TeamingPreset[] = [
  {
    id: 'builtin_enterprise_training',
    name: '企业培训模板',
    strategy: 'balancedOrganizationAndTitle',
    customPrimaryDimension: 'none',
    customBalanceDimensions: ['organization', 'titleLevel'],
    builtIn: true,
  },
  {
    id: 'builtin_government_meeting',
    name: '政务会议模板',
    strategy: 'sameOrganization',
    customPrimaryDimension: 'organization',
    customBalanceDimensions: ['titleLevel'],
    builtIn: true,
  },
  {
    id: 'builtin_school_training',
    name: '校内培训模板',
    strategy: 'balancedGender',
    customPrimaryDimension: 'none',
    customBalanceDimensions: ['gender', 'organization'],
    builtIn: true,
  },
];

const safeParse = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const normalizeDimensions = (dims?: TeamingDimension[]) => {
  if (!Array.isArray(dims)) return ['organization', 'titleLevel'] as TeamingDimension[];
  const valid = dims.filter((d): d is TeamingDimension => d === 'organization' || d === 'gender' || d === 'titleLevel');
  return valid.length > 0 ? valid : (['organization', 'titleLevel'] as TeamingDimension[]);
};

const normalizePreset = (preset: Partial<TeamingPreset>): TeamingPreset | null => {
  if (!preset || typeof preset.name !== 'string' || !preset.name.trim()) return null;
  if (typeof preset.id !== 'string' || !preset.id.trim()) return null;

  const strategy = preset.strategy;
  const validStrategy: TeamingStrategy[] = [
    'random',
    'sameOrganization',
    'sameTitleLevel',
    'sameGender',
    'balancedGender',
    'balancedOrganizationAndTitle',
    'custom',
  ];

  if (!strategy || !validStrategy.includes(strategy)) return null;

  const primary = preset.customPrimaryDimension;
  const normalizedPrimary: TeamingDimension | 'none' =
    primary === 'organization' || primary === 'gender' || primary === 'titleLevel' || primary === 'none'
      ? primary
      : 'none';

  return {
    id: preset.id,
    name: preset.name.trim(),
    strategy,
    customPrimaryDimension: normalizedPrimary,
    customBalanceDimensions: normalizeDimensions(preset.customBalanceDimensions),
    builtIn: !!preset.builtIn,
  };
};

const loadStorage = (): TeamingPresetStorage => {
  const parsed = safeParse<TeamingPresetStorage>(localStorage.getItem(STORAGE_KEY));
  if (!parsed || !Array.isArray(parsed.groups) || !Array.isArray(parsed.teams)) {
    return { groups: [], teams: [] };
  }

  const groups = parsed.groups.map(normalizePreset).filter((x): x is TeamingPreset => !!x && !x.builtIn);
  const teams = parsed.teams.map(normalizePreset).filter((x): x is TeamingPreset => !!x && !x.builtIn);
  return { groups, teams };
};

const saveStorage = (storage: TeamingPresetStorage) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
};

export const loadTeamingPresets = (scope: TeamingPresetScope): TeamingPreset[] => {
  const storage = loadStorage();
  return [...BUILTIN_PRESETS, ...storage[scope]];
};

export const saveCustomTeamingPreset = (
  scope: TeamingPresetScope,
  input: Omit<TeamingPreset, 'id' | 'builtIn'>,
): TeamingPreset => {
  const storage = loadStorage();
  const next: TeamingPreset = {
    id: `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: input.name.trim(),
    strategy: input.strategy,
    customPrimaryDimension: input.customPrimaryDimension,
    customBalanceDimensions: normalizeDimensions(input.customBalanceDimensions),
    builtIn: false,
  };

  storage[scope] = [
    ...storage[scope].filter(item => item.name !== next.name),
    next,
  ];

  saveStorage(storage);
  return next;
};

export const deleteCustomTeamingPreset = (scope: TeamingPresetScope, id: string) => {
  const storage = loadStorage();
  storage[scope] = storage[scope].filter(item => item.id !== id);
  saveStorage(storage);
};
