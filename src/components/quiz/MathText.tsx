import { memo, useMemo } from 'react';
import katex from 'katex';
import 'katex/contrib/mhchem';
import 'katex/dist/katex.min.css';

const MATH_RE = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/g;

export function renderLatex(latex: string, displayMode = false): string {
  return katex.renderToString(latex, { throwOnError: false, displayMode, strict: 'ignore', trust: false, output: 'html' });
}

export function hasMath(text: string): boolean {
  return /\$[^$]+\$|\\\(|\\\[/.test(text || '');
}

/** Renders plain text with embedded $...$ / $$...$$ / \(...\) / \[...\] LaTeX. */
function MathTextInner({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => {
    const src = String(text ?? '');
    if (!hasMath(src)) return null;
    return src.split(MATH_RE).filter((p) => p !== '').map((p) => {
      let body: string | null = null; let display = false;
      if (p.startsWith('$$') && p.endsWith('$$') && p.length > 4) { body = p.slice(2, -2); display = true; }
      else if (p.startsWith('\\[') && p.endsWith('\\]')) { body = p.slice(2, -2); display = true; }
      else if (p.startsWith('\\(') && p.endsWith('\\)')) body = p.slice(2, -2);
      else if (p.startsWith('$') && p.endsWith('$') && p.length > 2) body = p.slice(1, -1);
      return body === null ? { text: p } : { html: renderLatex(body, display) };
    });
  }, [text]);

  if (!parts) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      {parts.map((p, i) => ('html' in p
        ? <span key={i} className="katex-inline" dangerouslySetInnerHTML={{ __html: p.html as string }} />
        : <span key={i}>{p.text}</span>))}
    </span>
  );
}

export const MathText = memo(MathTextInner);
export default MathText;
