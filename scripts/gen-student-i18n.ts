// 生成学生扫码页专用的小词典（只含这些页面用到的键），每种语言一个文件，按需下载。
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { __translations } from '../src/contexts/LanguageContext';
const files = ['src/pages/CheckInPage.tsx','src/pages/SeatCheckinPage.tsx',
  ...readdirSync('src/components/checkin-views').map(f=>'src/components/checkin-views/'+f)];
const keys = new Set<string>();
for (const f of files) for (const m of readFileSync(f,'utf8').matchAll(/\bt\(\s*['"]([\w.]+)['"]/g)) keys.add(m[1]);
const langs = ['zh','en','ru','ja','ko','es'] as const;
for (const l of langs) {
  const dict = Object.fromEntries([...keys].sort().filter(k=>(__translations as any)[l]?.[k]!=null).map(k=>[k,(__translations as any)[l][k]]));
  writeFileSync(`src/lib/student-i18n/${l}.ts`, `// 自动生成：bun scripts/gen-student-i18n.ts\nconst d: Record<string, string> = ${JSON.stringify(dict,null,1)};\nexport default d;\n`);
}
console.log(keys.size);
