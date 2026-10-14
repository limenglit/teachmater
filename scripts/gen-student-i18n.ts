// 生成学生扫码页专用的小词典：按页面（普通签到 / 座位签到）和语言各一个文件，只下载命中的那一个。
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { __translations } from '../src/contexts/LanguageContext';
const groups: Record<string, string[]> = {
  checkin: ['src/pages/CheckInPage.tsx'],
  seat: ['src/pages/SeatCheckinPage.tsx'],
  // 签到成功后的座位展示词典，随座位图一起按需下载
  seatResult: readdirSync('src/components/checkin-views').map(f=>'src/components/checkin-views/'+f),
};
const langs = ['zh','en','ru','ja','ko','es'] as const;
mkdirSync('src/lib/student-i18n', { recursive: true });
for (const [g, files] of Object.entries(groups)) {
  const keys = new Set<string>();
  for (const f of files) for (const m of readFileSync(f,'utf8').matchAll(/\bt\(\s*['"]([\w.]+)['"]/g)) keys.add(m[1]);
  for (const l of langs) {
    const dict = Object.fromEntries([...keys].sort().filter(k=>(__translations as any)[l]?.[k]!=null).map(k=>[k,(__translations as any)[l][k]]));
    writeFileSync(`src/lib/student-i18n/${g}-${l}.ts`, `// 自动生成：bun scripts/gen-student-i18n.ts\nconst d: Record<string, string> = ${JSON.stringify(dict,null,1)};\nexport default d;\n`);
  }
  console.log(g, keys.size);
}
