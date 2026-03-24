import { useEffect, useRef } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-scala';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-perl';
import 'prismjs/components/prism-r';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-sass';
import 'prismjs/components/prism-less';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-toml';
import 'prismjs/components/prism-ini';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-powershell';
import 'prismjs/components/prism-batch';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-graphql';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-dart';
import 'prismjs/components/prism-lua';
import 'prismjs/components/prism-zig';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-latex';

const EXT_TO_PRISM: Record<string, string> = {
  c: 'c', cpp: 'cpp', cc: 'cpp', h: 'c', hpp: 'cpp',
  cs: 'csharp', java: 'java', kt: 'kotlin', scala: 'scala',
  py: 'python', rb: 'ruby', php: 'php', pl: 'perl', r: 'r',
  js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx', mjs: 'javascript', cjs: 'javascript',
  html: 'markup', htm: 'markup', xml: 'markup', svg: 'markup',
  css: 'css', scss: 'scss', sass: 'sass', less: 'less',
  json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml', ini: 'ini', cfg: 'ini',
  sh: 'bash', bash: 'bash', zsh: 'bash', bat: 'batch', ps1: 'powershell', cmd: 'batch',
  sql: 'sql', graphql: 'graphql', gql: 'graphql',
  go: 'go', rs: 'rust', swift: 'swift', dart: 'dart', lua: 'lua', zig: 'zig',
  vue: 'markup', svelte: 'markup', astro: 'markup',
  md: 'markdown', markdown: 'markdown', tex: 'latex',
};

export function getPrismLanguage(ext: string): string {
  return EXT_TO_PRISM[ext.toLowerCase()] || 'plain';
}

interface Props {
  code: string;
  ext: string;
}

export default function CodeHighlight({ code, ext }: Props) {
  const ref = useRef<HTMLElement>(null);
  const lang = getPrismLanguage(ext);

  useEffect(() => {
    if (ref.current) {
      Prism.highlightElement(ref.current);
    }
  }, [code, lang]);

  return (
    <pre className="p-3 text-xs font-mono whitespace-pre overflow-x-auto leading-relaxed m-0 bg-transparent">
      <code ref={ref} className={`language-${lang}`}>
        {code}
      </code>
    </pre>
  );
}
