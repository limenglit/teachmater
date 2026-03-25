import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from 'react';

const EXT_TO_PRISM: Record<string, string> = {
  c: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  java: 'java',
  kt: 'kotlin',
  scala: 'scala',
  py: 'python',
  rb: 'ruby',
  php: 'php',
  pl: 'perl',
  r: 'r',
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  mjs: 'javascript',
  cjs: 'javascript',
  html: 'markup',
  htm: 'markup',
  xml: 'markup',
  svg: 'markup',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  cfg: 'ini',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  bat: 'batch',
  ps1: 'powershell',
  cmd: 'batch',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  go: 'go',
  rs: 'rust',
  swift: 'swift',
  dart: 'dart',
  lua: 'lua',
  zig: 'zig',
  vue: 'markup',
  svelte: 'markup',
  astro: 'markup',
  md: 'markdown',
  markdown: 'markdown',
  tex: 'latex',
};

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

const MIN_HEIGHT = 80;
const MAX_HEIGHT = 800;
const DRAG_HANDLE_HEIGHT = 10;

interface Props {
  code: string;
  ext: string;
  initialMaxHeight?: number;
}

export function getPrismLanguage(ext: string): string {
  return EXT_TO_PRISM[ext.toLowerCase()] || 'plain';
}

async function loadPrismLanguage(lang: string) {
  if (lang === 'plain') return;

  const deps = LANG_DEPS[lang] ?? [];

  for (const dep of deps) {
    try {
      await import(`prismjs/components/prism-${dep}.js`);
    } catch {
      // noop
    }
  }

  try {
    await import(`prismjs/components/prism-${lang}.js`);
  } catch {
    // noop
  }
}

export default function CodeHighlight({ code, ext, initialMaxHeight = 256 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ y: number; h: number } | null>(null);
  const lang = useMemo(() => getPrismLanguage(ext), [ext]);

  const [fontSize, setFontSize] = useState(16);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [maxHeight, setMaxHeight] = useState(
    Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, initialMaxHeight)),
  );
  const [highlightedHTML, setHighlightedHTML] = useState<string | null>(null);

  useEffect(() => {
    setMaxHeight(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, initialMaxHeight)));
  }, [initialMaxHeight]);

  useEffect(() => {
    const handleResize = () => {
      const width = containerRef.current?.offsetWidth ?? 0;
      if (!width) return;
      const nextSize = Math.max(12, Math.min(22, Math.floor(width / 48)));
      setFontSize(nextSize);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const highlightCode = async () => {
      if (!code) {
        setHighlightedHTML('');
        return;
      }

      try {
        const prismModule = await import('prismjs');
        const Prism = prismModule.default ?? prismModule;
        await loadPrismLanguage(lang);

        if (cancelled) return;

        const grammar = Prism.languages[lang];
        if (!grammar) {
          setHighlightedHTML(null);
          return;
        }

        setHighlightedHTML(Prism.highlight(code, grammar, lang));
      } catch {
        if (!cancelled) {
          setHighlightedHTML(null);
        }
      }
    };

    void highlightCode();

    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  const lines = useMemo(() => code.split('\n'), [code]);

  const highlightedLines = useMemo(() => {
    if (highlightedHTML === null) return null;
    return highlightedHTML.split('\n');
  }, [highlightedHTML]);

  const gutterWidth = useMemo(() => Math.max(2, String(lines.length).length), [lines.length]);

  const endDrag = useCallback(() => {
    dragStartRef.current = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', endDrag);
  }, []);

  const updateHeight = useCallback((clientY: number) => {
    const drag = dragStartRef.current;
    if (!drag) return;

    const delta = clientY - drag.y;
    const nextHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, drag.h + delta));
    setMaxHeight(nextHeight);
  }, []);

  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      updateHeight(event.clientY);
    },
    [updateHeight],
  );

  const onTouchMove = useCallback(
    (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      updateHeight(touch.clientY);
    },
    [updateHeight],
  );

  const onDragStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement> | ReactTouchEvent<HTMLDivElement>) => {
      const clientY = 'touches' in event ? event.touches[0]?.clientY : event.clientY;
      if (typeof clientY !== 'number') return;

      dragStartRef.current = { y: clientY, h: maxHeight };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', endDrag);
      document.addEventListener('touchmove', onTouchMove, { passive: true });
      document.addEventListener('touchend', endDrag);
    },
    [endDrag, maxHeight, onMouseMove, onTouchMove],
  );

  useEffect(() => endDrag, [endDrag]);

  return (
    <div ref={containerRef} className="relative select-text rounded-lg border border-border bg-card">
      <div className="overflow-auto" style={{ maxHeight, minHeight: MIN_HEIGHT }}>
        <table
          className="w-full border-collapse font-mono leading-relaxed"
          style={{ fontSize }}
        >
          <tbody>
            {lines.map((line, index) => {
              const lineHtml = highlightedLines?.[index];

              return (
                <tr
                  key={`${index}-${line}`}
                  className={hoveredLine === index ? 'bg-muted/50' : undefined}
                  onMouseEnter={() => setHoveredLine(index)}
                  onMouseLeave={() => setHoveredLine(null)}
                >
                  <td
                    className="sticky left-0 select-none border-r border-border bg-muted/60 px-2 py-0 align-top text-right text-muted-foreground"
                    style={{ width: `${gutterWidth + 2}ch`, minWidth: `${gutterWidth + 2}ch` }}
                  >
                    {index + 1}
                  </td>
                  <td className="w-full whitespace-pre px-3 py-0 align-top text-foreground">
                    {lineHtml !== undefined ? (
                      <span
                        className={`language-${lang}`}
                        dangerouslySetInnerHTML={{ __html: lineHtml || '\u200B' }}
                      />
                    ) : (
                      <span>{line || '\u200B'}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className="flex cursor-row-resize items-center justify-center border-t border-border transition-colors hover:bg-muted/60"
        style={{ height: DRAG_HANDLE_HEIGHT }}
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
        title="拖拽调整高度"
      >
        <div className="h-[3px] w-8 rounded-full bg-muted-foreground/30" />
      </div>
    </div>
  );
}