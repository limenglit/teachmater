const ORG_COLOR_PALETTE = [
  '#0f766e',
  '#1d4ed8',
  '#9333ea',
  '#be123c',
  '#b45309',
  '#15803d',
  '#7c2d12',
  '#0369a1',
  '#6d28d9',
  '#9f1239',
  '#0f172a',
  '#0c4a6e',
  '#14532d',
  '#78350f',
  '#7f1d1d',
  '#4c1d95',
  '#1e3a8a',
  '#365314',
  '#701a75',
  '#92400e',
];

const normalizeOrgText = (value?: string) => {
  return (value || '').trim().replace(/\s+/g, ' ');
};

// For multi-department naming like "教育局/教务处" or "教育局-信息中心",
// use the leading unit segment as the grouping key so the same unit keeps one color.
export const getOrganizationUnitKey = (organization?: string) => {
  const normalized = normalizeOrgText(organization);
  if (!normalized) return '';
  const withoutBracket = normalized.replace(/[（(].*$/, '').trim();
  const firstSegment = withoutBracket.split(/[\\/|>|＞,，;；、\-—]/)[0]?.trim() || '';
  return (firstSegment || withoutBracket).toLowerCase();
};

const getPaletteColor = (index: number) => {
  if (index < ORG_COLOR_PALETTE.length) return ORG_COLOR_PALETTE[index];

  // For many units, keep colors distinguishable by rotating hue and varying saturation/lightness bands.
  const hue = Math.round((index * 137.508) % 360);
  const saturationBands = [62, 70, 78];
  const lightnessBands = [34, 40, 46];
  const saturation = saturationBands[index % saturationBands.length];
  const lightness = lightnessBands[Math.floor(index / saturationBands.length) % lightnessBands.length];
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
};

export const buildOrganizationColorResolver = (organizations: string[]) => {
  const unitKeyByRaw = new Map<string, string>();

  organizations.forEach(raw => {
    const normalizedRaw = normalizeOrgText(raw);
    if (!normalizedRaw) return;
    const unitKey = getOrganizationUnitKey(normalizedRaw);
    if (unitKey) {
      unitKeyByRaw.set(normalizedRaw, unitKey);
    }
  });

  const uniqueUnitKeys = Array.from(new Set(unitKeyByRaw.values())).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  const colorByUnitKey = new Map<string, string>();

  uniqueUnitKeys.forEach((unitKey, index) => {
    colorByUnitKey.set(unitKey, getPaletteColor(index));
  });

  return (organization?: string) => {
    const normalizedRaw = normalizeOrgText(organization);
    if (!normalizedRaw) return undefined;

    const unitKey = getOrganizationUnitKey(normalizedRaw);
    if (!unitKey) return undefined;
    return colorByUnitKey.get(unitKey) || getPaletteColor(0);
  };
};

export const getOrganizationColor = (organization: string) => {
  const resolver = buildOrganizationColorResolver([organization]);
  return resolver(organization) || '#334155';
};
