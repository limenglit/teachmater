// Polyfills for older mobile browsers (iOS < 15.4 Safari/WeChat, older
// HarmonyOS / Android WebViews). Must be imported before anything else.

const g: any = typeof globalThis !== 'undefined' ? globalThis : window;

// crypto.randomUUID: Safari 15.4+, Chrome 92+. Also missing on non-secure contexts.
try {
  const c: any = g.crypto || (g.crypto = {});
  if (typeof c.randomUUID !== 'function') {
    c.randomUUID = function randomUUID(): string {
      const b = new Uint8Array(16);
      if (typeof c.getRandomValues === 'function') c.getRandomValues(b);
      else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    };
  }
} catch { /* ignore */ }

// Array/String .at(): Safari 15.4+, Chrome 92+ (used by some dependencies).
function at(this: any, n: number) {
  n = Math.trunc(n) || 0;
  if (n < 0) n += this.length;
  return n < 0 || n >= this.length ? undefined : this[n];
}
for (const C of [Array, String, (g as any).Int8Array && Object.getPrototypeOf(Int8Array)].filter(Boolean)) {
  if (!C.prototype.at) {
    Object.defineProperty(C.prototype, 'at', { value: at, writable: true, configurable: true });
  }
}

// Object.hasOwn: Safari 15.4+.
if (!(Object as any).hasOwn) {
  Object.defineProperty(Object, 'hasOwn', {
    value: (o: object, k: PropertyKey) => Object.prototype.hasOwnProperty.call(o, k),
    writable: true, configurable: true,
  });
}

// structuredClone: Safari 15.4+, Chrome 98+ (JSON fallback is fine for our data).
if (typeof g.structuredClone !== 'function') {
  g.structuredClone = (v: unknown) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
}

// Array.prototype.findLast / findLastIndex: Safari 15.4+, Chrome 97+.
if (!(Array.prototype as any).findLast) {
  Object.defineProperty(Array.prototype, 'findLastIndex', {
    value: function (this: any[], fn: any, t?: any) {
      for (let i = this.length - 1; i >= 0; i--) if (fn.call(t, this[i], i, this)) return i;
      return -1;
    }, writable: true, configurable: true,
  });
  Object.defineProperty(Array.prototype, 'findLast', {
    value: function (this: any[], fn: any, t?: any) {
      const i = (this as any).findLastIndex(fn, t);
      return i < 0 ? undefined : this[i];
    }, writable: true, configurable: true,
  });
}

export {};
