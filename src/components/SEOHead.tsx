import { useEffect } from 'react';

/**
 * SEOHead — per-route Meta-Tag-Manager fuer die Vite-SPA.
 *
 * Setzt <title>, <meta description>, <link rel=canonical>, OpenGraph- und
 * Twitter-Card-Tags via DOM-Mutation. Wird vom Prerender-Script (scripts/
 * prerender.mjs) zur Build-Zeit ausgewertet — Effects laufen vor dem
 * networkidle-Wait, damit der gerenderte HTML-Output die korrekten Tags
 * enthaelt fuer Crawler die kein JS rendern (LinkedIn, Slack, archive.org).
 *
 * Kein react-helmet-async — wir vermeiden die Dep und nutzen stattdessen
 * einen schlanken useEffect-Hook der die Tags direkt in <head> einfuegt
 * bzw. updated. React 19 batches die Effects sauber, kein Flicker.
 *
 * Verwendung:
 *   <SEOHead
 *     title="Cookiebot Alternative — DSGVO-konforme Compliance"
 *     description="Automatisierte DSGVO-Compliance statt nur Cookie-Banner..."
 *     canonical="/cookiebot-alternative"
 *     ogImage="/og-image.png"
 *   />
 *
 * Defaults aus index.html werden nicht zurueckgesetzt — der Hook ueberschreibt
 * nur die Tags die er kennt. Wenn man eine Route ohne <SEOHead> rendert,
 * bleibt der globale Default aus index.html aktiv.
 */

export interface SEOHeadProps {
  /** Page-Title — wird zu "{title} — RealSyncDynamics.AI" gesetzt */
  title: string;
  /** Meta-Description — Soll 130-160 Zeichen sein */
  description: string;
  /** Canonical-Pfad relativ zur Domain (z.B. "/features"). Default: aktueller Pfad. */
  canonical?: string;
  /** OG-Image-Pfad. Default: /og-image.png */
  ogImage?: string;
  /** OG-Type. Default: "website" — fuer Blog/Article auf "article" setzen. */
  ogType?: 'website' | 'article' | 'product';
  /** Verhindert Indexierung — z.B. fuer dauerhafte Beta-Pages oder Auth-Wall */
  noIndex?: boolean;
}

const SITE_NAME = 'RealSyncDynamics.AI';
const SITE_URL = 'https://realsyncdynamicsai.de';
const DEFAULT_OG_IMAGE = '/og-image.png';
const TITLE_SUFFIX = ' — RealSyncDynamics.AI';

export function SEOHead({
  title,
  description,
  canonical,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = 'website',
  noIndex = false,
}: SEOHeadProps): null {
  useEffect(() => {
    const fullTitle = title.endsWith(SITE_NAME) ? title : title + TITLE_SUFFIX;
    const path = canonical ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
    const fullCanonical = SITE_URL + (path.startsWith('/') ? path : '/' + path);
    const fullOgImage = ogImage.startsWith('http') ? ogImage : SITE_URL + ogImage;

    document.title = fullTitle;

    setMeta('name', 'description', description);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', fullCanonical);
    setMeta('property', 'og:type', ogType);
    setMeta('property', 'og:image', fullOgImage);
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('property', 'og:locale', 'de_DE');

    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', fullOgImage);

    if (noIndex) {
      setMeta('name', 'robots', 'noindex, nofollow');
    } else {
      // Aktiver Index-Hinweis (default-konsistent mit robots.txt)
      setMeta('name', 'robots', 'index, follow, max-image-preview:large');
    }

    setLink('canonical', fullCanonical);
  }, [title, description, canonical, ogImage, ogType, noIndex]);

  return null;
}

/**
 * Setzt oder updated <meta {attr}="{key}" content="{value}">.
 * Idempotent: laeuft auf jedem Render.
 */
function setMeta(attr: 'name' | 'property', key: string, value: string): void {
  if (typeof document === 'undefined') return;
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

/**
 * Setzt oder updated <link rel="{rel}" href="{href}">.
 */
function setLink(rel: string, href: string): void {
  if (typeof document === 'undefined') return;
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Helper fuer JSON-LD Structured-Data Injection. Verwendet einen festen
 * data-attribute-key damit Re-Renders das alte Script ersetzen statt
 * zu duplizieren.
 *
 *   <SEOHead title="..." description="..." />
 *   <SEOJsonLd id="article" data={{
 *     '@context': 'https://schema.org',
 *     '@type': 'Article',
 *     headline: '...', author: { '@type': 'Person', name: '...' }
 *   }} />
 */
export function SEOJsonLd({ id, data }: { id: string; data: Record<string, unknown> }): null {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const selector = `script[type="application/ld+json"][data-seo-id="${id}"]`;
    let el = document.querySelector<HTMLScriptElement>(selector);
    if (!el) {
      el = document.createElement('script');
      el.setAttribute('type', 'application/ld+json');
      el.setAttribute('data-seo-id', id);
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
    return () => {
      // Cleanup beim Unmount damit alte JSON-LD nicht "haengen" bleibt
      el?.remove();
    };
  }, [id, data]);
  return null;
}
