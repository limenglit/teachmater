import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

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
  initialMaxHeight?: number;
}

const MIN_HEIGHT = 80;
const MAX_HEIGHT = 800;
const DRAG_HANDLE_HEIGHT = 10;

export default function CodeHighlight({ code, ext, initialMaxHeight = 256 }: Props) {
  const ref = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lang = getPrismLanguage(ext);
  const [highlightedHTML, setHighlightedHTML] = useState<string | null>(null);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [maxHeight, setMaxHeight] = useState(initialMaxHeight);
  const dragStartRef = useRef<{ y: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prismModule = await import('prismjs');
        const Prism = prismModule.default ?? prismModule;
        await loadPrismLanguage(lang);
        if (!cancelled) {
          try {
            const grammar = Prism.languages[lang];
            if (grammar) {
              setHighlightedHTML(Prism.highlight(code, grammar, lang));
            } else {
              setHighlightedHTML(null);
            }
          } catch {
            setHighlightedHTML(null);
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [code, lang]);

  const lines = useMemo(() => code.split('\n'), [code]);
  const lineCount = lines.length;
  const gutterWidth = Math.max(2, String(lineCount).length);

  // Split highlighted HTML back into lines (best-effort)
  const highlightedLines = useMemo(() => {
    if (!highlightedHTML) return null;
    // Prism output keeps \n as literal newlines inside spans; splitting naively works
    // for most cases. We wrap unclosed spans across line boundaries.
    const raw = highlightedHTML.split('\n');
    return raw;
  }, [highlightedHTML]);

  /* ── drag-to-resize ── */
  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { y: clientY, h: maxHeight };

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!dragStartRef.current) return;
      const cy = 'touches' in ev ? ev.touches[0].clientY : (ev as MouseEvent).clientY;
      const delta = cy - dragStartRef.current.y;
      setMaxHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragStartRef.current.h + delta)));
    };
    const onEnd = () => {
      dragStartRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onEnd);
  }, [maxHeight]);

  return (
    <div ref={containerRef} className="relative select-text">
      <div
        className="overflow-auto"
        style={{ maxHeight }}
      >
        <table className="w-full border-collapse text-xs font-mono leading-relaxed">
          <tbody>
            {lines.map((line, i) => (
              <tr
                key={i}
                className={`transition-colors duration-75 ${
                  hoveredLine === i ? 'bg-primary/8' : ''
                }`}
                onMouseEnter={() => setHoveredLine(i)}
                onMouseLeave={() => setHoveredLine(null)}
              >
                <td
                  className="sticky left-0 select-none text-right pr-3 pl-2 text-muted-foreground/50 bg-muted/40"
                  style={{ width: `${gutterWidth + 2}ch`, minWidth: `${gutterWidth + 2}ch` }}
                >
                  {i + 1}
                </td>
                <td className="pr-3 whitespace-pre">
                  {highlightedLines && highlightedLines[i] !== undefined ? (
                    <span
                      className={`language-${lang}`}
                      dangerouslySetInnerHTML={{ __html: highlightedLines[i] || '\u200B' }}
                    />
                  ) : (
                    <span>{line || '\u200B'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Drag handle */}
      <div
        className="flex items-center justify-center cursor-row-resize group hover:bg-primary/10 transition-colors"
        style={{ height: DRAG_HANDLE_HEIGHT }}
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
        title="拖拽调整高度"
      >
        <div className="w-8 h-[3px] rounded-full bg-muted-foreground/20 group-hover:bg-primary/40 transition-colors" />
      </div>
    </div>
  );
}
