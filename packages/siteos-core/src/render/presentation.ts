// Präsentationsschicht des Renderers.
//
// Der Kern-Renderer (`renderer.ts`) liefert semantisch korrektes,
// prüfbares HTML mit einem absichtlich winzigen Stylesheet: Kontrast,
// Zeilenlänge, Fokus, Sprungmarke. Das besteht jede Prüfung — sieht aber
// nicht aus wie eine Website, die jemand veröffentlichen würde.
//
// Genau das ist das Problem in der Live-Vorschau. Wer vor der Registrierung
// „das ist bereits Ihre Website" liest und eine Textwüste sieht, glaubt dem
// Produkt kein Wort mehr. Die Vorschau muss aussehen wie das Ergebnis, sonst
// ist sie ein Mockup mit anderen Mitteln.
//
// ## Warum das eine eigene Datei ist und kein größeres Theme-CSS
//
// Zwei Verträge stehen gegeneinander:
//
//   1. `renderThemeCss` ist an die Compliance-Analyse gekoppelt
//      (`analysis/observation.ts`) und wird byte-gleich gehasht. Jede
//      Erweiterung dort ändert den Hash jedes Artefakts.
//   2. Die Vorschau braucht Layout, Raster, Karten, Tiefe.
//
// Deshalb ist die Präsentation eine **additive Schicht**: ein zweites
// Stylesheet, das nur bei `presentation: 'showcase'` ausgegeben wird. Der
// Default bleibt `minimal` — bestehende Artefakte, Hashes und Tests bleiben
// unverändert.
//
// ## Warum das ohne Klassen im Markup auskommt
//
// Die Präsentation darf das Markup **nicht** anfassen. Jedes zusätzliche
// Attribut wäre eine Änderung an genau dem Dokument, dessen Prüfbarkeit das
// Produkt zusagt. Angesprochen wird deshalb ausschließlich, was ohnehin da
// ist: die Block-IDs aus `blockId()` tragen ihre Art im Namen
// (`root--hero--1`), und darauf lässt sich mit `[id*="--hero--"]` zielen.
//
// Folge: Kein Block-Typ bekommt eine Sonderbehandlung, die es im Blueprint
// nicht gibt. Was hier gestaltet wird, existiert dort auch.

import type { SiteTheme } from '../types.ts';
import { sanitizeTheme } from './theme.ts';

/**
 * Darstellungsstufe des Renderers.
 *
 * `minimal`  — Kern-Stylesheet. Default, byte-stabil, Grundlage der Hashes.
 * `showcase` — zusätzliche Layoutschicht für Vorschau und Auslieferung.
 */
export type PresentationLevel = 'minimal' | 'showcase';

/**
 * Layoutschicht. Wird **nach** `renderThemeCss` ausgegeben und überschreibt
 * dessen Grundregeln bei gleicher oder höherer Spezifität.
 *
 * Alle Farben leiten sich aus den drei Theme-Tokens ab (`color-mix`), damit
 * eine Themenänderung durchschlägt, ohne dass hier eine zweite Palette
 * gepflegt werden müsste. Ein zweiter Farbsatz wäre eine eigene
 * Design-Entscheidung — die trifft der Blueprint, nicht der Renderer.
 */
export function renderPresentationCss(theme: Partial<SiteTheme> | undefined): string {
  const t = sanitizeTheme(theme);

  // Abgeleitete Töne. `--tint` ist die Fläche für Karten und Panels,
  // `--line` die Haarlinie, `--muted` der zurückgenommene Text.
  const derived = [
    ':root{',
    '--tint:color-mix(in srgb,var(--foreground) 5%,var(--surface));',
    '--tint-strong:color-mix(in srgb,var(--foreground) 9%,var(--surface));',
    '--line:color-mix(in srgb,var(--foreground) 14%,transparent);',
    '--muted:color-mix(in srgb,var(--foreground) 68%,var(--surface));',
    '--accent-soft:color-mix(in srgb,var(--accent) 14%,var(--surface));',
    '--shadow:0 1px 2px rgba(0,0,0,.06),0 12px 32px -12px rgba(0,0,0,.28);',
    '--gutter:clamp(1.25rem,5vw,3rem);',
    '--maxw:1180px;',
    '}',
  ].join('');

  return [
    derived,

    // ── Grundraster ────────────────────────────────────────────────
    // Hebt die 72ch-Begrenzung des Kern-Stylesheets auf: Die Lesebreite
    // wird auf Textblöcke verlagert (siehe `p`-Regel weiter unten), das
    // Seitenraster darf voll ausspielen.
    'body{font-size:clamp(16px,1.02vw + 14px,18px);-webkit-font-smoothing:antialiased;}',
    'body main{max-width:none;margin:0;padding:0;}',
    'body header,body footer{max-width:none;margin:0;padding:0;}',
    'body main>section,body main>aside{',
    'max-width:none;margin:0;padding:clamp(3rem,7vw,5.5rem) var(--gutter);}',
    'body main>section>*,body main>aside>*{max-width:var(--maxw);margin-left:auto;margin-right:auto;}',
    'h1,h2,h3{letter-spacing:-.02em;margin:0 0 .6em;}',
    'h2{font-size:clamp(1.6rem,2.6vw,2.35rem);}',
    'h3{font-size:clamp(1.15rem,1.6vw,1.4rem);}',
    'p{max-width:66ch;color:var(--muted);}',
    'a{text-underline-offset:.18em;}',

    // ── Kopfbereich ────────────────────────────────────────────────
    // Sticky mit Milchglas. Der Wert dahinter ist nicht Optik, sondern
    // Bedienbarkeit: Die Navigation bleibt auf langen Seiten erreichbar.
    'body>header{position:sticky;top:0;z-index:20;',
    'background:color-mix(in srgb,var(--surface) 82%,transparent);',
    '-webkit-backdrop-filter:saturate(1.6) blur(14px);backdrop-filter:saturate(1.6) blur(14px);',
    'border-bottom:1px solid var(--line);}',
    'body>header>nav{max-width:var(--maxw);margin:0 auto;padding:.9rem var(--gutter);',
    'display:flex;align-items:center;gap:clamp(1rem,3vw,2.25rem);flex-wrap:wrap;}',
    // Erstes Kind der Navigation ist die Wortmarke.
    'body>header>nav>a:first-child{font-family:var(--font-display);font-weight:700;',
    'font-size:1.05rem;color:var(--foreground);text-decoration:none;letter-spacing:-.01em;}',
    'body>header>nav>ul{display:flex;flex-wrap:wrap;gap:clamp(.75rem,2vw,1.5rem);',
    'list-style:none;margin:0;padding:0;margin-left:auto;}',
    'body>header>nav>ul a{color:var(--muted);text-decoration:none;font-size:.95rem;}',
    'body>header>nav>ul a:hover{color:var(--foreground);}',

    // ── Hero ───────────────────────────────────────────────────────
    // Zwei Spalten ab 900px, darunter gestapelt. Das Medium bleibt ein
    // Platzhalter — ein Bild ohne geklärte Rechtelage wird nicht erfunden,
    // auch nicht in der Vorschau.
    '[id*="--hero--"]{position:relative;overflow:hidden;',
    'padding-block:clamp(3.5rem,9vw,7rem)!important;',
    'background:radial-gradient(1100px 520px at 12% -10%,var(--accent-soft),transparent 62%);}',
    '[id*="--hero--"]>h1,[id*="--hero--"]>h2{',
    'font-size:clamp(2.1rem,5.4vw,4rem);line-height:1.05;max-width:16ch;}',
    '[id*="--hero--"]>p{font-size:clamp(1.05rem,1.5vw,1.3rem);max-width:52ch;}',
    '[id*="--hero--"]>a{display:inline-block;margin-top:1.75rem;',
    'background:var(--accent);color:var(--surface);text-decoration:none;font-weight:600;',
    'padding:.85rem 1.6rem;border-radius:var(--radius);box-shadow:var(--shadow);}',
    '[id*="--hero--"]>a:hover{filter:brightness(1.08);}',
    '[id*="--hero--"]>[data-placeholder]{margin-top:2.5rem;width:100%;',
    'background:linear-gradient(135deg,var(--tint-strong),var(--accent-soft));',
    'border:1px solid var(--line);box-shadow:var(--shadow);}',
    // Höhe des Heroes, vom Blueprint gesteuert (`content.emphasis`).
    '[id*="--hero--"][data-emphasis="tall"]{padding-block:clamp(5rem,13vw,9.5rem)!important;}',
    '[id*="--hero--"][data-emphasis="compact"]{padding-block:clamp(2.25rem,5vw,3.5rem)!important;}',
    '@media (min-width:900px){',
    '[id*="--hero--"]{display:grid;grid-template-columns:1.05fr .95fr;',
    'gap:clamp(2rem,4vw,4rem);align-items:center;}',
    '[id*="--hero--"]>h1,[id*="--hero--"]>h2,[id*="--hero--"]>p,[id*="--hero--"]>a{',
    'grid-column:1;margin-left:0;margin-right:0;}',
    '[id*="--hero--"]>[data-placeholder]{grid-column:2;grid-row:1 / span 4;',
    'margin-top:0;align-self:stretch;min-height:22rem;}',
    '}',

    // ── Karten-Raster (Leistungen, Vorzüge) ────────────────────────
    '[id*="--services--"]>ul,[id*="--features--"]>ul{list-style:none;padding:0;',
    'display:grid;gap:clamp(1rem,2vw,1.5rem);',
    'grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),1fr));}',
    '[id*="--services--"] li,[id*="--features--"] li{background:var(--tint);',
    'border:1px solid var(--line);border-radius:var(--radius);',
    'padding:clamp(1.25rem,2vw,1.75rem);}',
    '[id*="--services--"] li strong,[id*="--features--"] li strong{',
    'display:block;font-family:var(--font-display);font-size:1.1rem;margin-bottom:.4rem;}',
    '[id*="--services--"] li span,[id*="--features--"] li span{color:var(--muted);}',

    // ── Über uns / Team / Stimmen ──────────────────────────────────
    '[id*="--about--"]{background:var(--tint);}',
    '[id*="--about--"]>p{font-size:1.1rem;}',
    '[id*="--team--"]>p{background:var(--tint);border:1px solid var(--line);',
    'border-radius:var(--radius);padding:1rem 1.25rem;margin:.5rem 0;max-width:none;}',
    'blockquote{margin:0 0 1rem;background:var(--tint);border-left:3px solid var(--accent);',
    'border-radius:var(--radius);padding:1.25rem 1.5rem;font-size:1.05rem;}',

    // ── FAQ ────────────────────────────────────────────────────────
    'details{background:var(--tint);border:1px solid var(--line);border-radius:var(--radius);',
    'padding:1rem 1.25rem;margin-bottom:.75rem;}',
    'summary{cursor:pointer;font-family:var(--font-display);font-weight:600;}',
    'details[open] summary{margin-bottom:.6rem;}',

    // ── Formulare ──────────────────────────────────────────────────
    '[id*="--contact-form--"],[id*="--booking--"]{background:var(--tint);}',
    'form{max-width:38rem;margin:0 auto;background:var(--surface);',
    'border:1px solid var(--line);border-radius:var(--radius);',
    'padding:clamp(1.5rem,3vw,2.25rem);box-shadow:var(--shadow);}',
    'form label{font-size:.9rem;color:var(--muted);}',
    'form input{border:1px solid var(--line);background:var(--surface);',
    'color:var(--foreground);padding:.7rem .85rem;}',
    'form input[type="checkbox"]{width:auto;display:inline-block;margin-right:.5rem;}',
    'form button{margin-top:1.25rem;width:100%;padding:.85rem 1.25rem;font-weight:600;',
    'border-radius:var(--radius);box-shadow:var(--shadow);}',

    // ── Handlungsaufforderung ──────────────────────────────────────
    '[id*="--cta--"]{text-align:center;background:var(--accent-soft);}',
    '[id*="--cta--"]>a{display:inline-block;margin-top:.5rem;background:var(--accent);',
    'color:var(--surface);text-decoration:none;font-weight:600;padding:.85rem 1.6rem;',
    'border-radius:var(--radius);box-shadow:var(--shadow);}',

    // ── Einwilligungsschranke (Karte, Video) ───────────────────────
    // Bleibt bewusst als Schranke erkennbar. Sie wegzugestalten hieße, den
    // Nutzer über eine Datenweitergabe hinwegzutäuschen (TDDDG § 25).
    '[data-consent-required]{background:var(--tint);border:1px dashed var(--line);',
    'padding:clamp(1.5rem,3vw,2.5rem);text-align:center;}',

    // ── KI-Hinweis (Art. 50 EU AI Act) ─────────────────────────────
    // Zurückgenommen, aber nie unsichtbar: kein `display:none`, keine
    // Deckkraft unter 1, kontrastgeprüfter Text.
    '[data-ai-disclosure]{padding-block:1.5rem!important;border-top:1px solid var(--line);}',
    '[data-ai-disclosure] p{font-size:.85rem;color:var(--muted);margin:0;}',

    // ── Fuß ────────────────────────────────────────────────────────
    'body>footer{border-top:1px solid var(--line);background:var(--tint);}',
    'body>footer>nav{max-width:var(--maxw);margin:0 auto;padding:2rem var(--gutter);}',
    'body>footer ul{display:flex;flex-wrap:wrap;gap:1.5rem;list-style:none;padding:0;margin:0;}',
    'body>footer a{color:var(--muted);text-decoration:none;font-size:.9rem;}',
    'body>footer a:hover{color:var(--foreground);}',

    // ── Einblenden ─────────────────────────────────────────────────
    // Rein per CSS, ohne Skript: Ein Skript, das Inhalte erst sichtbar
    // macht, versteckt sie bei deaktiviertem JavaScript dauerhaft.
    // Deshalb animiert die Regel nur den Zustand, in dem der Inhalt
    // ohnehin schon im Dokument steht.
    '@media (prefers-reduced-motion:no-preference){',
    'body main>section{animation:rsdReveal .6s cubic-bezier(.22,.61,.36,1) both;}',
    'body main>section:nth-of-type(2){animation-delay:.06s;}',
    'body main>section:nth-of-type(3){animation-delay:.12s;}',
    'body main>section:nth-of-type(n+4){animation-delay:.18s;}',
    '@keyframes rsdReveal{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:none;}}',
    '}',
  ].join('');
}
