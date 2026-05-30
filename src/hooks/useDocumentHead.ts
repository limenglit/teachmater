import { useEffect } from 'react';

interface DocumentHeadOptions {
  title?: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogUrl?: string;
  ogType?: 'website' | 'article';
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
}

function setMeta(selector: string, attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Per-route head updater for the Vite + react-router stack.
 * Sets <title>, description, canonical, og:* and an optional JSON-LD block.
 * Removes the JSON-LD on unmount; other tags persist (next route overwrites them).
 */
export function useDocumentHead(opts: DocumentHeadOptions) {
  useEffect(() => {
    if (opts.title) document.title = opts.title;
    if (opts.description) setMeta('description', 'name', 'description', opts.description);
    if (opts.canonical) setLink('canonical', opts.canonical);
    if (opts.ogTitle) setMeta('og:title', 'property', 'og:title', opts.ogTitle);
    if (opts.ogDescription) setMeta('og:description', 'property', 'og:description', opts.ogDescription);
    if (opts.ogUrl) setMeta('og:url', 'property', 'og:url', opts.ogUrl);
    if (opts.ogType) setMeta('og:type', 'property', 'og:type', opts.ogType);

    let jsonLdEl: HTMLScriptElement | null = null;
    if (opts.jsonLd) {
      jsonLdEl = document.createElement('script');
      jsonLdEl.type = 'application/ld+json';
      jsonLdEl.dataset.routeJsonLd = 'true';
      jsonLdEl.text = JSON.stringify(opts.jsonLd);
      document.head.appendChild(jsonLdEl);
    }
    return () => {
      if (jsonLdEl && jsonLdEl.parentNode) jsonLdEl.parentNode.removeChild(jsonLdEl);
    };
  }, [
    opts.title,
    opts.description,
    opts.canonical,
    opts.ogTitle,
    opts.ogDescription,
    opts.ogUrl,
    opts.ogType,
    JSON.stringify(opts.jsonLd ?? null),
  ]);
}
