/**
 * Touch drag shim
 *
 * HTML5 drag & drop (draggable / dragstart / dragover / drop) is not implemented
 * by mobile Safari or Android Chrome, which means every seat / aisle / student
 * drag in the app is dead on phones and iPads.
 *
 * This module emulates the HTML5 drag events with Pointer/Touch events so the
 * existing React handlers keep working unchanged:
 *   long-press (200ms) on a [draggable=true] element -> dragstart
 *   finger move                                      -> dragover / dragenter / dragleave
 *   finger up                                        -> drop + dragend
 *
 * A floating ghost follows the finger and the page is prevented from scrolling
 * only while a drag is actually in progress, so normal scrolling still works.
 */

const LONG_PRESS_MS = 200;
const MOVE_CANCEL_PX = 12;

class ShimDataTransfer {
  private store = new Map<string, string>();
  dropEffect = 'move';
  effectAllowed = 'all';
  readonly files: FileList = { length: 0, item: () => null } as unknown as FileList;
  get types() { return Array.from(this.store.keys()); }
  setData(format: string, data: string) { this.store.set(format, String(data)); }
  getData(format: string) { return this.store.get(format) ?? ''; }
  clearData(format?: string) { format ? this.store.delete(format) : this.store.clear(); }
  setDragImage() { /* ghost is handled by the shim */ }
}

interface DragSession {
  source: HTMLElement;
  dataTransfer: ShimDataTransfer;
  ghost: HTMLElement | null;
  lastTarget: Element | null;
}

let pressTimer: number | null = null;
let pending: { el: HTMLElement; x: number; y: number } | null = null;
let session: DragSession | null = null;

function isTouchLike() {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
}

function fire(target: Element | null, type: string, dt: ShimDataTransfer, x: number, y: number) {
  if (!target) return false;
  const evt = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(evt, {
    dataTransfer: { value: dt },
    clientX: { value: x },
    clientY: { value: y },
    pageX: { value: x + window.scrollX },
    pageY: { value: y + window.scrollY },
  });
  return target.dispatchEvent(evt);
}

function makeGhost(el: HTMLElement, x: number, y: number) {
  const rect = el.getBoundingClientRect();
  const ghost = el.cloneNode(true) as HTMLElement;
  ghost.style.cssText = [
    'position:fixed',
    `left:${x - rect.width / 2}px`,
    `top:${y - rect.height / 2}px`,
    `width:${rect.width}px`,
    `height:${rect.height}px`,
    'pointer-events:none',
    'opacity:0.85',
    'z-index:9999',
    'transform:scale(1.06)',
    'box-shadow:0 8px 24px rgba(0,0,0,0.22)',
    'border-radius:8px',
    'margin:0',
  ].join(';');
  document.body.appendChild(ghost);
  return ghost;
}

function moveGhost(ghost: HTMLElement | null, x: number, y: number) {
  if (!ghost) return;
  ghost.style.left = `${x - ghost.offsetWidth / 2}px`;
  ghost.style.top = `${y - ghost.offsetHeight / 2}px`;
}

function cancelPending() {
  if (pressTimer !== null) { window.clearTimeout(pressTimer); pressTimer = null; }
  pending = null;
}

function endSession(x: number, y: number, drop: boolean) {
  if (!session) return;
  const { dataTransfer, ghost, source } = session;
  if (ghost) ghost.remove();
  session.ghost = null;

  if (drop) {
    const target = document.elementFromPoint(x, y);
    if (target) {
      fire(target, 'dragover', dataTransfer, x, y);
      fire(target, 'drop', dataTransfer, x, y);
    }
  } else if (session.lastTarget) {
    fire(session.lastTarget, 'dragleave', dataTransfer, x, y);
  }
  fire(source, 'dragend', dataTransfer, x, y);
  session = null;
  document.body.style.removeProperty('user-select');
}

function onTouchStart(e: TouchEvent) {
  if (session || e.touches.length !== 1) return;
  const touch = e.touches[0];
  const el = (touch.target as Element | null)?.closest?.('[draggable="true"]') as HTMLElement | null;
  if (!el) return;
  // Skip natively-editable / scrollable interactive controls.
  if ((touch.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]')) return;

  pending = { el, x: touch.clientX, y: touch.clientY };
  pressTimer = window.setTimeout(() => {
    if (!pending) return;
    const { el: source, x, y } = pending;
    pending = null;
    pressTimer = null;
    const dataTransfer = new ShimDataTransfer();
    const allowed = fire(source, 'dragstart', dataTransfer, x, y);
    if (allowed === false && dataTransfer.types.length === 0) return;
    session = { source, dataTransfer, ghost: makeGhost(source, x, y), lastTarget: null };
    document.body.style.userSelect = 'none';
    navigator.vibrate?.(12);
  }, LONG_PRESS_MS);
}

function onTouchMove(e: TouchEvent) {
  const touch = e.touches[0];
  if (!touch) return;

  if (pending) {
    if (Math.hypot(touch.clientX - pending.x, touch.clientY - pending.y) > MOVE_CANCEL_PX) cancelPending();
    return;
  }
  if (!session) return;

  e.preventDefault(); // stop page scroll while dragging
  const { dataTransfer } = session;
  const x = touch.clientX;
  const y = touch.clientY;
  moveGhost(session.ghost, x, y);

  const target = document.elementFromPoint(x, y);
  if (target !== session.lastTarget) {
    if (session.lastTarget) fire(session.lastTarget, 'dragleave', dataTransfer, x, y);
    if (target) fire(target, 'dragenter', dataTransfer, x, y);
    session.lastTarget = target;
  }
  if (target) fire(target, 'dragover', dataTransfer, x, y);
}

function onTouchEnd(e: TouchEvent) {
  cancelPending();
  if (!session) return;
  const touch = e.changedTouches[0];
  endSession(touch?.clientX ?? 0, touch?.clientY ?? 0, true);
}

function onTouchCancel(e: TouchEvent) {
  cancelPending();
  if (!session) return;
  const touch = e.changedTouches[0];
  endSession(touch?.clientX ?? 0, touch?.clientY ?? 0, false);
}

let installed = false;

/** Install the shim once. Safe to call on every app boot. */
export function installTouchDragShim() {
  if (installed || typeof window === 'undefined') return;
  if (!('ontouchstart' in window) && !isTouchLike()) return;
  installed = true;
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);
  document.addEventListener('touchcancel', onTouchCancel);
}
