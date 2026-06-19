// scripts/inject-pricing-body.mts — Deterministische Body-Prerender-Injektion
// fuer /pricing.
//
// Problem (Befund 1 aus dem SEO-Review): Der eigentliche Seiten-Inhalt der
// /pricing-Seite (Tarif-Karten: Namen, Preise, Bullets, CTAs) ist client-only.
// Der Playwright-Prerender (scripts/prerender.mjs) SOLL ihn statisch ins
// dist/pricing/index.html schreiben, hydriert im CI aber nicht zuverlaessig —
// dann bleibt #root leer und Crawler ohne JS sehen kein Pricing. Genau wie
// beim <head> (siehe inject-seo-head.mts) brauchen wir eine browser-
// unabhaengige, reproduzierbare Variante.
//
// Loesung: Dieses Script rendert aus der Single-Source-of-Truth
// src/config/pricing.ts einen semantischen, statischen HTML-Block (h1, Intro,
// alle oeffentlichen Tarif-Karten, Enterprise-Banner, Trust-Note) und schreibt
// ihn in das <div id="root"> von dist/pricing/index.html — OHNE Browser.
//
// Praezedenz: Nur ein LEERES <div id="root"></div> wird gefuellt. Hat der
// Playwright-Prerender bereits echten Content erzeugt, bleibt dieser erhalten
// (gleiche Philosophie wie SPA-Fallback + inject-seo-head). Die SPA selbst
// rendert mit createRoot().render() (kein hydrateRoot), ersetzt den Inhalt von
// #root beim Mount also komplett — es gibt daher keinen Hydration-Mismatch.
//
// Usage:
//   npx tsx scripts/inject-pricing-body.mts   # nach build + prerender + spa-fallback

import { readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { PUBLIC_PRICING_TIERS, ENTERPRISE_TIER, PRICING_TRUST_NOTE } from '../src/config/pricing';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const TARGET = join(DIST, 'pricing', 'index.html');

// Marketing-Copy aus src/features/billing/PricingPage.tsx gespiegelt (Hero-H1 +
// Intro). Bewusst nur diese zwei stabilen Strings dupliziert; alle Tarif-Daten
// (Namen/Preise/Bullets/CTAs) kommen aus pricing.ts und koennen nicht driften.
const HERO_H1 = 'Welche Governance-Abdeckung passt zu Ihnen?';
const HERO_INTRO =
  'Vom kostenlosen Erst-Scan bis zur kompletten Governance-Runtime — alle Pläne sind ' +
  'EU-gehostet, alle Pläne enthalten den AVV. Sie wählen nicht nach Anzahl der Webseiten, ' +
  'sondern nach Ihrer Governance-Komplexität.';

// HTML-Escaping fuer Text-/Attribut-Inhalte (Preise/Bullets enthalten u.a. "&").
export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Preis-Anzeige 1:1 aus PricingPage.tsx TierCard, damit der statische Output dem
// entspricht, was die SPA zur Laufzeit rendert.
function priceDisplay(tier: { priceEur: number; id: string }): string {
  if (tier.priceEur > 0) return `${tier.priceEur} €`;
  return tier.id === 'free' ? '0 €' : 'Anfrage';
}

/**
 * Baut den statischen, semantischen Pricing-Body. Reines String-Building, keine
 * Side-Effects — direkt in Tests pruefbar. data-prerender="pricing" markiert den
 * Block fuer Debugging/Greppability.
 */
export function buildPricingBodyHtml(): string {
  const cards = PUBLIC_PRICING_TIERS.map((tier) => {
    const badges = (tier.badges ?? [])
      .map((b) => `<span class="rsd-badge">${esc(b)}</span>`)
      .join('');
    const bullets = tier.bullets
      .map((b) => `<li>${esc(b)}</li>`)
      .join('');
    const external = tier.cta.href.startsWith('http');
    const ctaAttrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return (
      `<article class="rsd-tier"${tier.highlight ? ' data-highlight="true"' : ''}>` +
      `<h2>${esc(tier.name)}</h2>` +
      `<p class="rsd-price"><span class="rsd-amount">${esc(priceDisplay(tier))}</span> ` +
      `<span class="rsd-suffix">${esc(tier.priceSuffix)}</span></p>` +
      `<p class="rsd-tagline">${esc(tier.tagline)}</p>` +
      (badges ? `<div class="rsd-badges">${badges}</div>` : '') +
      `<ul class="rsd-bullets">${bullets}</ul>` +
      `<a class="rsd-cta" href="${esc(tier.cta.href)}"${ctaAttrs}>${esc(tier.cta.label)}</a>` +
      `</article>`
    );
  }).join('');

  const enterprise =
    `<aside class="rsd-enterprise">` +
    `<h2>${esc(ENTERPRISE_TIER.name)} — ${esc(ENTERPRISE_TIER.priceString)}</h2>` +
    `<p>${esc(ENTERPRISE_TIER.tagline)}</p>` +
    `<a class="rsd-cta" href="${esc(ENTERPRISE_TIER.cta.href)}">${esc(ENTERPRISE_TIER.cta.label)}</a>` +
    `</aside>`;

  return (
    `<section data-prerender="pricing" aria-label="Preise">` +
    `<h1>${esc(HERO_H1)}</h1>` +
    `<p class="rsd-intro">${esc(HERO_INTRO)}</p>` +
    `<div class="rsd-tier-grid">${cards}</div>` +
    enterprise +
    `<p class="rsd-trust">${esc(PRICING_TRUST_NOTE)}</p>` +
    `</section>`
  );
}

/**
 * Injiziert den Pricing-Body in ein LEERES <div id="root"></div>. Ist #root
 * bereits gefuellt (Playwright-Prerender hat echten Content erzeugt ODER dieser
 * Schritt lief schon), bleibt das HTML unveraendert — idempotent und
 * prerender-schonend.
 */
export function injectPricingBody(html: string, body: string = buildPricingBodyHtml()): string {
  const emptyRoot = /<div id="root">\s*<\/div>/;
  if (!emptyRoot.test(html)) return html; // bereits gefuellt -> nicht anfassen
  return html.replace(emptyRoot, `<div id="root">${body}</div>`);
}

async function fileExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

async function main(): Promise<void> {
  if (!(await fileExists(TARGET))) {
    // Kein harter Fehler: wenn /pricing (z.B. wegen geaenderter Pipeline) keine
    // eigene Datei hat, gibt es nichts zu injizieren.
    console.warn(`[inject-pricing] ${TARGET} fehlt — uebersprungen.`);
    return;
  }
  const html = await readFile(TARGET, 'utf8');
  const out = injectPricingBody(html);
  if (out === html) {
    console.log('[inject-pricing] #root bereits gefuellt (Prerender) — nichts zu tun.');
    return;
  }
  await writeFile(TARGET, out, 'utf8');
  console.log('[inject-pricing] statischer Pricing-Body in dist/pricing/index.html injiziert.');
}

// Nur ausfuehren, wenn direkt gestartet — beim Import in Tests bleiben die
// Helfer pur, ohne Side-Effects.
const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((e) => {
    console.error('[inject-pricing] FATAL:', e);
    process.exit(1);
  });
}
