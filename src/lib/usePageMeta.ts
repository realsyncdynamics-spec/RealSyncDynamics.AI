import { useEffect } from 'react';

/**
 * Minimal head-meta manager for SPA routes without react-helmet.
 *
 * Sets document.title plus the standard SEO meta tags (description, OG,
 * Twitter) imperatively on mount, and restores the previous values on
 * unmount. Index.html holds the site-wide defaults — this hook just
 * overrides them while a specific route is active.
 *
 * Why no library:
 *   The whole site is statically served from GitHub Pages; this hook is
 *   sufficient for client-side title/OG control. Adding react-helmet just
 *   for two routes would not be worth the bundle increase.
 */
export interface PageMeta {
  title: string;
  description: string;
  url?: string;
  ogType?: string;       // default: 'website'
  twitterCard?: string;  // default: 'summary_large_image'
  image?: string;        // og:image / twitter:image
}

interface UpsertSpec {
  selector: string;
  attr: 'name' | 'property';
  attrValue: string;
  content: string;
}

function upsertMetas(specs: UpsertSpec[]): Array<{ el: HTMLMetaElement; prev: string | null; created: boolean }> {
  return specs.map(({ selector, attr, attrValue, content }) => {
    let el = document.head.querySelector<HTMLMetaElement>(selector);
    let prev: string | null = null;
    let created = false;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, attrValue);
      document.head.appendChild(el);
      created = true;
    } else {
      prev = el.getAttribute('content');
    }
    el.setAttribute('content', content);
    return { el, prev, created };
  });
}

export function usePageMeta(meta: PageMeta) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = meta.title;

    const ogType = meta.ogType ?? 'website';
    const twitterCard = meta.twitterCard ?? 'summary_large_image';

    const specs: UpsertSpec[] = [
      { selector: 'meta[name="description"]',         attr: 'name',     attrValue: 'description',         content: meta.description },
      { selector: 'meta[property="og:title"]',        attr: 'property', attrValue: 'og:title',            content: meta.title },
      { selector: 'meta[property="og:description"]',  attr: 'property', attrValue: 'og:description',      content: meta.description },
      { selector: 'meta[property="og:type"]',         attr: 'property', attrValue: 'og:type',             content: ogType },
      { selector: 'meta[name="twitter:card"]',        attr: 'name',     attrValue: 'twitter:card',        content: twitterCard },
      { selector: 'meta[name="twitter:title"]',       attr: 'name',     attrValue: 'twitter:title',       content: meta.title },
      { selector: 'meta[name="twitter:description"]', attr: 'name',     attrValue: 'twitter:description', content: meta.description },
    ];
    if (meta.url) {
      specs.push({ selector: 'meta[property="og:url"]', attr: 'property', attrValue: 'og:url', content: meta.url });
    }
    if (meta.image) {
      specs.push({ selector: 'meta[property="og:image"]', attr: 'property', attrValue: 'og:image', content: meta.image });
      specs.push({ selector: 'meta[name="twitter:image"]', attr: 'name',     attrValue: 'twitter:image', content: meta.image });
    }

    const touched = upsertMetas(specs);

    return () => {
      document.title = prevTitle;
      touched.forEach(({ el, prev, created }) => {
        if (created) {
          el.remove();
        } else if (prev !== null) {
          el.setAttribute('content', prev);
        }
      });
    };
  }, [meta.title, meta.description, meta.url, meta.ogType, meta.twitterCard, meta.image]);
}
