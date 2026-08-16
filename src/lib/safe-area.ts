/**
 * Safe-area observer.
 *
 * iOS Safari does not always re-evaluate `env(safe-area-inset-*)` immediately
 * after an orientation change (values can stay stale for a frame or several).
 * We measure the real insets with a hidden probe element and mirror them into
 * CSS custom properties (`--safe-top/right/bottom/left`) so layout paddings and
 * scroll areas update right away on rotation.
 */

const PROBE_ID = "safe-area-probe";
const SIDES = ["top", "right", "bottom", "left"] as const;

let probe: HTMLDivElement | null = null;
let rafId = 0;
let installed = false;

function ensureProbe(): HTMLDivElement {
  if (probe && probe.isConnected) return probe;
  const el = document.createElement("div");
  el.id = PROBE_ID;
  el.setAttribute("aria-hidden", "true");
  el.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "width:0",
    "height:0",
    "visibility:hidden",
    "pointer-events:none",
    "padding-top:env(safe-area-inset-top, 0px)",
    "padding-right:env(safe-area-inset-right, 0px)",
    "padding-bottom:env(safe-area-inset-bottom, 0px)",
    "padding-left:env(safe-area-inset-left, 0px)",
  ].join(";");
  document.body.appendChild(el);
  probe = el;
  return el;
}

export function measureSafeArea(): Record<(typeof SIDES)[number], number> {
  const style = getComputedStyle(ensureProbe());
  const read = (v: string) => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  return {
    top: read(style.paddingTop),
    right: read(style.paddingRight),
    bottom: read(style.paddingBottom),
    left: read(style.paddingLeft),
  };
}

/** Measure and publish current insets. Returns true when a value changed. */
export function syncSafeArea(): boolean {
  if (typeof document === "undefined" || !document.body) return false;
  const insets = measureSafeArea();
  const root = document.documentElement;
  let changed = false;
  for (const side of SIDES) {
    const next = `${insets[side]}px`;
    if (root.style.getPropertyValue(`--safe-${side}`) !== next) {
      root.style.setProperty(`--safe-${side}`, next);
      changed = true;
    }
  }
  // Expose the viewport height too, so scroll containers relying on it can
  // recompute without waiting for a dvh re-evaluation.
  const vh = `${Math.round(window.visualViewport?.height ?? window.innerHeight)}px`;
  if (root.style.getPropertyValue("--app-vh") !== vh) {
    root.style.setProperty("--app-vh", vh);
    changed = true;
  }
  return changed;
}

function scheduleSync(): void {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    syncSafeArea();
  });
}

/**
 * Rotation on iOS settles asynchronously: sample a few times after the event
 * so the final (correct) insets win.
 */
function scheduleSyncBurst(): void {
  scheduleSync();
  [50, 150, 350, 600].forEach((delay) => {
    window.setTimeout(() => {
      if (syncSafeArea()) {
        window.dispatchEvent(new Event("safe-area-change"));
      }
    }, delay);
  });
}

export function installSafeAreaObserver(): () => void {
  if (typeof window === "undefined" || installed) return () => {};
  installed = true;

  const start = () => {
    syncSafeArea();
    window.addEventListener("resize", scheduleSyncBurst);
    window.addEventListener("orientationchange", scheduleSyncBurst);
    window.addEventListener("pageshow", scheduleSyncBurst);
    window.visualViewport?.addEventListener("resize", scheduleSync);
    window.visualViewport?.addEventListener("scroll", scheduleSync);
    try {
      window.matchMedia("(orientation: portrait)").addEventListener("change", scheduleSyncBurst);
    } catch {
      /* older Safari: covered by orientationchange */
    }
  };

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });

  return () => {
    window.removeEventListener("resize", scheduleSyncBurst);
    window.removeEventListener("orientationchange", scheduleSyncBurst);
    window.removeEventListener("pageshow", scheduleSyncBurst);
    window.visualViewport?.removeEventListener("resize", scheduleSync);
    window.visualViewport?.removeEventListener("scroll", scheduleSync);
    installed = false;
  };
}
