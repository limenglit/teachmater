export type AICreditPackageKey = 'p10_100' | 'p20_300';

export interface AICreditPackage {
  key: AICreditPackageKey;
  price: number;      // CNY
  credits: number;    // AI 次数
  label: string;
  highlight?: boolean;
}

export const AI_CREDIT_PACKAGES: AICreditPackage[] = [
  { key: 'p10_100', price: 10, credits: 100, label: '入门包' },
  { key: 'p20_300', price: 20, credits: 300, label: '标准包', highlight: true },
];

export function getPackage(key: AICreditPackageKey): AICreditPackage | undefined {
  return AI_CREDIT_PACKAGES.find(p => p.key === key);
}
