import { useEffect, useRef } from 'react';

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

// Language dependency map – load prerequisites first
const LANG_DEPS: Record<string, string[]> = {
  jsx: ['markup', 'javascript'],
  tsx: ['markup', 'javascript', 'jsx', 'typescript'],
  cpp: ['c'],
  scss: ['css'],
  sass: ['css'],
  less: ['css'],
  kotlin: ['java'],
  scala: ['java'],
};

async function loadPrismLanguage(lang: string) {
  if (lang === 'plain') return;
  const deps = LANG_DEPS[lang];
  if (deps) {
    for (const dep of deps) {
      try { await import(`prismjs/components/prism-${dep}.js`); } catch {}
    }
  }
  try { await import(`prismjs/components/prism-${lang}.js`); } catch {}
}

interface Props {
  code: string;
  ext: string;
}

export default function CodeHighlight({ code, ext }: Props) {
  const ref = useRef<HTMLElement>(null);
  const lang = getPrismLanguage(ext);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prismModule = await import('prismjs');
        const Prism = prismModule.default ?? prismModule;
        await loadPrismLanguage(lang);
        if (!cancelled && ref.current) {
          ref.current.textContent = code;
          try { Prism.highlightElement(ref.current); } catch {}
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [code, lang]);

  return (
    <pre
      className="p-3 text-xs font-mono whitespace-pre overflow-x-auto leading-relaxed m-0 bg-transparent"
    >
      <code ref={ref} className={`language-${lang}`}>
        {code}
      </code>
    </pre>
  );
}
