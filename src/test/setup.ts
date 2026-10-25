import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Project polyfills carried over from the pre-migration setup (Radix UI, TTS).
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

if (typeof window.SpeechSynthesisUtterance === "undefined") {
  (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
    text = "";
    lang = "";
    rate = 1;
    volume = 1;
    constructor(text?: string) {
      this.text = text || "";
    }
  };
}
if (typeof window.speechSynthesis === "undefined") {
  (window as unknown as { speechSynthesis: unknown }).speechSynthesis = {
    speak: () => {},
    cancel: () => {},
    getVoices: () => [],
  };
}
