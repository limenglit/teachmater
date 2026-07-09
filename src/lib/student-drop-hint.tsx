/**
 * Global visual hint for "drag student name → seat" interactions.
 *
 * A single fixed-position tooltip follows the pointer while a student is
 * being dragged over any seat scene, and each seat currently under the
 * pointer gets a `data-student-drop-hover` attribute (green = will seat,
 * amber = will swap) that CSS lights up via drop-shadow (works for both
 * SVG <g> nodes and HTML <div> nodes).
 *
 * Scenes just wire acceptStudentDragOver({ occupant }) + onDragLeave =
 * handleStudentDragLeave; everything else is handled here.
 */

import { useEffect, useState } from 'react';

type HintMode = 'empty' | 'swap';
type Hint = {
  x: number;
  y: number;
  mode: HintMode;
  occupant?: string;
  incoming?: string;
} | null;

let hintState: Hint = null;
let currentEl: Element | null = null;
let incomingName = '';
const listeners = new Set<(h: Hint) => void>();

function emit() {
  listeners.forEach(l => l(hintState));
}

/** Called from the sidebar dragstart so the tooltip can label the incoming student. */
export function setIncomingStudentName(name: string) {
  incomingName = name;
}

export function getIncomingStudentName(): string {
  return incomingName;
}

/** Show/update the hint anchored at the current pointer position. */
export function showStudentDropHint(
  e: React.DragEvent,
  opts: { occupant?: string; incoming?: string } = {},
) {
  const el = e.currentTarget as Element | null;
  if (el && currentEl && currentEl !== el) {
    try { currentEl.removeAttribute('data-student-drop-hover'); } catch {}
  }
  if (el) {
    currentEl = el;
    const mode: HintMode = opts.occupant ? 'swap' : 'empty';
    try { el.setAttribute('data-student-drop-hover', mode); } catch {}
    hintState = {
      x: e.clientX,
      y: e.clientY,
      mode,
      occupant: opts.occupant,
      incoming: opts.incoming ?? incomingName,
    };
    emit();
  }
}

/** Clear the hint. Pass the drag event to only clear that element's marker. */
export function clearStudentDropHint(e?: React.DragEvent) {
  if (e && e.currentTarget) {
    const el = e.currentTarget as Element;
    try { el.removeAttribute('data-student-drop-hover'); } catch {}
    if (currentEl === el) currentEl = null;
  } else if (currentEl) {
    try { currentEl.removeAttribute('data-student-drop-hover'); } catch {}
    currentEl = null;
  }
  hintState = null;
  emit();
}

/** onDragLeave handler for a seat element. */
export function handleStudentDragLeave(e: React.DragEvent) {
  const el = e.currentTarget as Element;
  try { el.removeAttribute('data-student-drop-hover'); } catch {}
  if (currentEl === el) {
    currentEl = null;
    hintState = null;
    emit();
  }
}

/** Renders the floating tooltip. Mount once near the app root. */
export function StudentDropHintOverlay() {
  const [h, setH] = useState<Hint>(hintState);
  useEffect(() => {
    const l = (v: Hint) => setH(v);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  useEffect(() => {
    const clear = () => { incomingName = ''; clearStudentDropHint(); };
    window.addEventListener('dragend', clear);
    window.addEventListener('drop', clear);
    return () => {
      window.removeEventListener('dragend', clear);
      window.removeEventListener('drop', clear);
    };
  }, []);

  if (!h) return null;
  const isSwap = h.mode === 'swap';
  const bg = isSwap ? '#f59e0b' : '#22c55e';
  const icon = isSwap ? '↔' : '→';
  const label = isSwap
    ? `${icon} 交换${h.incoming ? `：${h.incoming}` : ''} ⇄ ${h.occupant ?? ''}`
    : `${icon} 就座${h.incoming ? `：${h.incoming}` : ''}`;

  // Clamp so the tooltip never falls off the right/bottom edges.
  const width = 220;
  const height = 34;
  const left = Math.min(h.x + 16, (typeof window !== 'undefined' ? window.innerWidth : 9999) - width - 8);
  const top = Math.min(h.y + 16, (typeof window !== 'undefined' ? window.innerHeight : 9999) - height - 8);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left,
        top,
        zIndex: 9999,
        pointerEvents: 'none',
        background: bg,
        color: '#fff',
        padding: '5px 10px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
        whiteSpace: 'nowrap',
        maxWidth: width,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {label}
    </div>
  );
}
