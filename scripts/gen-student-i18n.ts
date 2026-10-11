// 生成学生扫码页专用的小词典（只含这些页面用到的键，中英文）。
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { __translations } from '../src/contexts/LanguageContext';
const files = ['src/pages/CheckInPage.tsx','src/pages/SeatCheckinPage.tsx',
  ...readdirSync('src/components/checkin-views').map(f=>'src/components/checkin-views/'+f)];
const keys = new Set<string>();
for (const f of files) for (const m of readFileSync(f,'utf8').matchAll(/\bt\(\s*['"]([\w.]+)['"]/g)) keys.add(m[1]);
const pick = (l: 'zh'|'en') => Object.fromEntries([...keys].sort().filter(k=>__translations[l][k]!=null).map(k=>[k,__translations[l][k]]));
writeFileSync('src/lib/student-i18n.ts', `// 自动生成：bun scripts/gen-student-i18n.ts\nexport const STUDENT_I18N: Record<'zh' | 'en', Record<string, string>> = ${JSON.stringify({zh:pick('zh'),en:pick('en')},null,1)};\n`);
console.log(keys.size);
