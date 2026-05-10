import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getSeoForPath, type SEOConfig } from '../config/seo';

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
 * Config-driven: Ohne Props zieht der Hook automatisch den Eintrag aus
 * src/config/seo.ts via useLocation().pathname. Props ueberschreiben
 * Config-Werte (z.B. fuer dynamische Detail-Pages oder Pricing-Tier-A/B-Tests).
 *
 * Verwendung:
 *   // Config-driven (default fuer alle pre-rendered Routes):
 *   <SEOHead />
 *
 *   // Explizit (z.B. fuer dynamische Detail-Pages):
 *   <SEOHead title="Custom" description="..." canonical="/x" />
 *
 * Defaults aus index.html werden nicht zurueckgesetzt — der Hook ueberschreibt
 * nur die Tags die er kennt. Wenn man eine Route ohne <SEOHead> rendert,
 * bleibt der globale Default aus index.html aktiv.
 */

export interface SEOHeadProps {
  /** Page-Title — wird zu "{title} — RealSyncDynamics.AI" gesetzt */
  title?: string;
  /** Meta-Description — Soll 130-160 Zeichen sein */
  description?: string;
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

export function SEOHead(props: SEOHeadProps = {}): null {
  const location = useLocation();
  const config: SEOConfig = getSeoForPath(location.pathname);

  const title = props.title ?? config.title;
  const description = props.description ?? config.description;
  const canonical = props.canonical ?? config.canonical ?? location.pathname;
  const ogTitle = config.ogTitle ?? title;
  const ogDescription = config.ogDescription ?? description;
  const ogImage = props.ogImage ?? config.ogImage ?? DEFAULT_OG_IMAGE;
  const ogType = props.ogType ?? config.ogType ?? 'website';
  const noIndex = props.noIndex ?? config.noIndex ?? false;
  const jsonLd = config.jsonLd;
  // Stable serialization fuer den useEffect-Dependency-Array.
  const jsonLdSerialized = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    const fullTitle = title.endsWith(SITE_NAME) ? title : title + TITLE_SUFFIX;
    const fullOgTitle = ogTitle.endsWith(SITE_NAME) ? ogTitle : ogTitle + TITLE_SUFFIX;
    const path = canonical.startsWith('http')
      ? canonical
      : SITE_URL + (canonical.startsWith('/') ? canonical : '/' + canonical);
    const fullCanonical = path;
    const fullOgImage = ogImage.startsWith('http') ? ogImage : SITE_URL + ogImage;

    document.title = fullTitle;

    setMeta('name', 'description', description);
    setMeta('property', 'og:title', fullOgTitle);
    setMeta('property', 'og:description', ogDescription);
    setMeta('property', 'og:url', fullCanonical);
    setMeta('property', 'og:type', ogType);
    setMeta('property', 'og:image', fullOgImage);
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('property', 'og:locale', 'de_DE');

    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullOgTitle);
    setMeta('name', 'twitter:description', ogDescription);
    setMeta('name', 'twitter:image', fullOgImage);

    if (noIndex) {
      setMeta('name', 'robots', 'noindex, nofollow');
    } else {
      // Aktiver Index-Hinweis (default-konsistent mit robots.txt)
      setMeta('name', 'robots', 'index, follow, max-image-preview:large');
    }

    setLink('canonical', fullCanonical);

    // Route-spezifisches JSON-LD: alle Eintraege unter data-seo-id="route"
    // einfuegen / updaten / removen. Stale-Eintraege aus vorherigen Routes
    // werden vor dem Schreiben entfernt, damit kein Schema "haengen" bleibt.
    if (jsonLdSerialized) {
      removeRouteJsonLd();
      const entries = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
      entries.forEach((entry, idx) => {
        const el = document.createElement('script');
        el.setAttribute('type', 'application/ld+json');
        el.setAttribute('data-seo-route', String(idx));
        el.textContent = JSON.stringify(entry);
        document.head.appendChild(el);
      });
    } else {
      removeRouteJsonLd();
    }
  }, [
    title,
    description,
    canonical,
    ogTitle,
    ogDescription,
    ogImage,
    ogType,
    noIndex,
    jsonLdSerialized,
    jsonLd,
  ]);

  return null;
}

function removeRouteJsonLd(): void {
  if (typeof document === 'undefined') return;
  document
    .querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"][data-seo-route]')
    .forEach((el) => el.remove());
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
