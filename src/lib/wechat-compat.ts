/**
 * WeChat in-app browser compatibility layer.
 *
 * WeChat uses WKWebView (iOS) and the X5 / XWeb kernel (Android). Both differ
 * from Safari / Chrome in ways that break touch interaction on this app:
 *
 *  1. WeChat rewrites the viewport meta on iOS and disables pinch-zoom.
 *  2. WeChat iOS applies a user-controlled font-size scaling ("字体大小") that
 *     re-lays out the page and can leave the shell taller than the viewport.
 *  3. X5 does not support `dvh` and mis-reports `100vh` after rotation, so a
 *     full-height shell traps the content and nothing scrolls.
 *  4. Rotation inside WeChat frequently does not fire a layout pass, leaving a
 *     stale height until the user scrolls.
 *
 * This module tags <html> so CSS can react, restores pinch-zoom, freezes the
 * WeChat font scaling and forces a reflow + safe-area re-measure after every
 * orientation / viewport change.
 */

import { syncSafeArea } from "./safe-area";

declare global {
  interface Window {
    WeixinJSBridge?: {
      invoke: (api: string, params: Record<string, unknown>, cb?: (res: unknown) => void) => void;
      on?: (event: string, cb: (res: unknown) => void) => void;
    };
  }
}

const VIEWPORT_CONTENT =
  "width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover";

export function isWeChatBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /micromessenger/i.test(navigator.userAgent);
}

function tagDocument() {
  const ua = navigator.userAgent.toLowerCase();
  const root = document.documentElement;
  root.classList.add("is-wechat");
  if (/iphone|ipad|ipod/.test(ua)) root.classList.add("is-wechat-ios");
  else root.classList.add("is-wechat-android");
}

/** WeChat strips user-scalable on iOS; rewrite the tag so pinch-zoom works. */
function restorePinchZoom() {
  let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "viewport";
    document.head.appendChild(meta);
  }
  if (meta.content !== VIEWPORT_CONTENT) meta.content = VIEWPORT_CONTENT;
}

/** Disable WeChat's global font-size override so layout math stays predictable. */
function lockFontSize() {
  const apply = () => {
    try {
      window.WeixinJSBridge?.invoke("setFontSizeCallback", { fontSize: 0 });
      window.WeixinJSBridge?.invoke("setPageFontSize", { fontSize: 0 });
    } catch {
      /* bridge unavailable — harmless */
    }
  };
  if (window.WeixinJSBridge) apply();
  else document.addEventListener("WeixinJSBridgeReady", apply, { once: true });
}

/** X5 / WKWebView can skip the layout pass after rotation — nudge it. */
function forceReflow() {
  const body = document.body;
  if (!body) return;
  const prev = body.style.minHeight;
  body.style.minHeight = `${Math.round(window.innerHeight) + 1}px`;
  window.requestAnimationFrame(() => {
    body.style.minHeight = prev;
    syncSafeArea();
    window.dispatchEvent(new Event("safe-area-change"));
  });
}

function onViewportChange() {
  forceReflow();
  [80, 250, 500].forEach((d) => window.setTimeout(forceReflow, d));
}

/* ------------------------------------------------------------------
   Pinch vs scroll arbitration
   ------------------------------------------------------------------
   WeChat's kernels hand a two-finger gesture to whichever scroll
   container is under the fingers, which makes the page scroll jitter
   instead of zooming. We flag the pinch on <html data-pinching> so CSS
   can freeze inner scroll containers (`touch-action: pinch-zoom`) for
   the duration of the gesture, then release them on the last touch up.
   Components with their own pinch implementation (`[data-own-pinch]`,
   e.g. the seat check-in canvas) are left untouched.
   ------------------------------------------------------------------ */

let pinchReleaseTimer = 0;
let pinchWatchdog = 0;

function setPinching(on: boolean) {
  const root = document.documentElement;
  if (on) {
    window.clearTimeout(pinchReleaseTimer);
    root.setAttribute("data-pinching", "");
    // Safety net: WeChat sometimes drops the final touchend, which would
    // otherwise leave scrolling frozen for good.
    window.clearTimeout(pinchWatchdog);
    pinchWatchdog = window.setTimeout(() => root.removeAttribute("data-pinching"), 2000);
  } else {
    window.clearTimeout(pinchWatchdog);
    // Small delay: WeChat fires touchend per finger and briefly re-enters
    // the gesture, so releasing instantly causes a scroll flicker.
    window.clearTimeout(pinchReleaseTimer);
    pinchReleaseTimer = window.setTimeout(() => {
      root.removeAttribute("data-pinching");
      syncSafeArea();
    }, 180);
  }
}

function installPinchArbitration() {
  const ownPinch = (t: EventTarget | null) =>
    t instanceof Element && !!t.closest("[data-own-pinch]");

  document.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length >= 2 && !ownPinch(e.target)) setPinching(true);
    },
    { passive: true, capture: true },
  );
  document.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length >= 2 && !ownPinch(e.target)) setPinching(true);
    },
    { passive: true, capture: true },
  );
  const end = (e: TouchEvent) => {
    if (e.touches.length < 2) setPinching(false);
  };
  document.addEventListener("touchend", end, { passive: true, capture: true });
  document.addEventListener("touchcancel", end, { passive: true, capture: true });

  // iOS WKWebView native zoom gestures (fired outside the touch sequence).
  window.addEventListener("gesturestart", () => setPinching(true), true);
  window.addEventListener("gestureend", () => setPinching(false), true);

  // After a zoom, the visual viewport is offset/scaled: re-measure so
  // safe-area paddings and --app-vh stay correct.
  window.visualViewport?.addEventListener("resize", () => syncSafeArea());
}

let installed = false;

/** Install once at boot. No-op outside the WeChat in-app browser. */
export function installWeChatCompat(): void {
  if (installed || typeof window === "undefined" || !isWeChatBrowser()) return;
  installed = true;

  const start = () => {
    tagDocument();
    restorePinchZoom();
    lockFontSize();
    onViewportChange();
    installPinchArbitration();
    window.addEventListener("orientationchange", onViewportChange);
    window.addEventListener("pageshow", onViewportChange);
    window.addEventListener("resize", forceReflow);
    // WeChat restores pages from bfcache with a stale viewport meta.
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        restorePinchZoom();
        onViewportChange();
      }
    });
  };

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
}

