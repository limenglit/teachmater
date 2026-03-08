import "@testing-library/jest-dom";

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

// Polyfill ResizeObserver for Radix UI components
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverMock as any;

// Polyfill SpeechSynthesisUtterance
if (typeof window.SpeechSynthesisUtterance === 'undefined') {
  (window as any).SpeechSynthesisUtterance = class {
    text = '';
    lang = '';
    rate = 1;
    volume = 1;
    constructor(text?: string) { this.text = text || ''; }
  };
}
if (typeof window.speechSynthesis === 'undefined') {
  (window as any).speechSynthesis = { speak: () => {}, cancel: () => {}, getVoices: () => [] };
}
