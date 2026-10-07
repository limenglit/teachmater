export interface FormulaBlock {
  id: string;
  kind: string;
  label: string;
  values: string[];
}
export interface BlockTemplate {
  kind: string;
  label: string;
  values: string[];
  fields: string[];
}

export const MATH_BLOCKS: BlockTemplate[] = [
  { kind: 'symbol', label: '变量', values: ['x'], fields: ['变量或数值'] },
  { kind: 'plus', label: '加号', values: [], fields: [] },
  { kind: 'minus', label: '减号', values: [], fields: [] },
  { kind: 'times', label: '乘号', values: [], fields: [] },
  { kind: 'equals', label: '等号', values: [], fields: [] },
  { kind: 'fraction', label: '分式', values: ['a', 'b'], fields: ['分子', '分母'] },
  { kind: 'power', label: '幂', values: ['x', '2'], fields: ['底数', '指数'] },
  { kind: 'subscript', label: '下标', values: ['x', '1'], fields: ['主体', '下标'] },
  { kind: 'root', label: '根式', values: ['x'], fields: ['根号内'] },
  { kind: 'group', label: '括号', values: ['x+y'], fields: ['括号内'] },
];
export const CHEM_BLOCKS: BlockTemplate[] = [
  { kind: 'chemical', label: '氢气', values: ['2', 'H2'], fields: ['系数', '化学式'] },
  { kind: 'chemical', label: '氧气', values: ['', 'O2'], fields: ['系数', '化学式'] },
  { kind: 'chemical', label: '水', values: ['2', 'H2O'], fields: ['系数', '化学式'] },
  { kind: 'chemical', label: '物质 / 离子', values: ['', 'SO4^2-'], fields: ['系数', '化学式'] },
  { kind: 'plus', label: '加号', values: [], fields: [] },
  { kind: 'reaction', label: '反应箭头', values: ['点燃', ''], fields: ['箭头上方条件', '箭头下方条件'] },
  { kind: 'equilibrium', label: '可逆反应', values: ['催化剂', '高温高压'], fields: ['箭头上方条件', '箭头下方条件'] },
  { kind: 'gas', label: '气体', values: [], fields: [] },
  { kind: 'precipitate', label: '沉淀', values: [], fields: [] },
];
export function blockLatex(block: Pick<FormulaBlock, 'kind' | 'values'>): string {
  const [a = '', b = ''] = block.values;
  switch (block.kind) {
    case 'plus': return '+';
    case 'minus': return '-';
    case 'times': return '\\times';
    case 'equals': return '=';
    case 'fraction': return `\\frac{${a}}{${b}}`;
    case 'power': return `{${a}}^{${b}}`;
    case 'subscript': return `{${a}}_{${b}}`;
    case 'root': return `\\sqrt{${a}}`;
    case 'group': return `\\left(${a}\\right)`;
    case 'chemical': return `\\ce{${a}${b}}`;
    case 'reaction': return `\\ce{->[${a}][${b}]}`;
    case 'equilibrium': return `\\ce{<=>[${a}][${b}]}`;
    case 'gas': return '\\uparrow';
    case 'precipitate': return '\\downarrow';
    default: return a;
  }
}
export const composeFormula = (blocks: FormulaBlock[]) => blocks.map(blockLatex).join(' ');
export const blockFields = (block: FormulaBlock) =>
  [...MATH_BLOCKS, ...CHEM_BLOCKS].find(t => t.kind === block.kind)?.fields ?? ['LaTeX'];