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
    '--shadow:0 1px 2px rgba(0,0,0,.04),0 24px 64px -28px rgba(0,0,0,.38);',
    '--gutter:clamp(1.5rem,6vw,4.5rem);',
    '--maxw:1280px;',
    '--hair:color-mix(in srgb,var(--foreground) 8%,transparent);',
    '}',
  ].join('');

  return [
    derived,

    // ── Grundraster ────────────────────────────────────────────────
    // Hebt die 72ch-Begrenzung des Kern-Stylesheets auf: Die Lesebreite
    // wird auf Textblöcke verlagert (siehe `p`-Regel weiter unten), das
    // Seitenraster darf voll ausspielen.
    'body{font-size:clamp(16px,1.05vw + 14px,19px);-webkit-font-smoothing:antialiased;',
    'text-rendering:optimizeLegibility;}',
    'body main{max-width:none;margin:0;padding:0;}',
    'body header,body footer{max-width:none;margin:0;padding:0;}',
    'body main>section,body main>aside{',
    'max-width:none;margin:0;padding:clamp(3.5rem,8vw,7rem) var(--gutter);}',
    'body main>section>*,body main>aside>*{max-width:var(--maxw);margin-left:auto;margin-right:auto;}',
    'h1,h2,h3{letter-spacing:-.038em;margin:0 0 .6em;font-weight:650;}',
    'h2{font-size:clamp(1.75rem,3.1vw,2.75rem);}',
    'h3{font-size:clamp(1.15rem,1.6vw,1.45rem);}',
    'p{max-width:62ch;color:var(--muted);}',
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
    'body>header>nav>ul a:last-child{background:var(--accent);color:var(--surface);',
    'text-decoration:none;padding:.45rem .95rem;border-radius:var(--radius);font-weight:600;}',
    'body>header>nav>ul a:last-child:hover{color:var(--surface);filter:brightness(1.08);}',

    // ── Hero ───────────────────────────────────────────────────────
    // Zwei Spalten ab 900px, darunter gestapelt. Das Medium bleibt ein
    // Platzhalter — ein Bild ohne geklärte Rechtelage wird nicht erfunden,
    // auch nicht in der Vorschau.
    '[id*="--hero--"]{position:relative;overflow:hidden;',
    'padding-block:clamp(4.5rem,12vw,9rem)!important;',
    'background:',
    'radial-gradient(1200px 640px at 8% -18%,var(--accent-soft),transparent 58%),',
    'linear-gradient(180deg,color-mix(in srgb,var(--accent) 6%,var(--surface)),var(--surface) 72%);}',
    // Cinematic grain ohne Drittanbieter-Bild: nur CSS, keine url().
    '[id*="--hero--"]::before{content:"";position:absolute;inset:0;pointer-events:none;',
    'background-image:repeating-linear-gradient(-12deg,transparent 0 11px,var(--hair) 11px 12px);',
    'opacity:.55;}',
    '[id*="--hero--"]::after{content:"";position:absolute;inset:auto var(--gutter) 0;height:1px;',
    'background:var(--line);pointer-events:none;}',
    // `max-width:16ch` allein genuegt nicht: Ein Firmenname ohne Leerzeichen
    // ist ein einziges Wort, und ein Wort bricht bei `overflow-wrap:normal`
    // nicht. Der Hero hat `overflow:hidden` — der Ueberhang wurde also nicht
    // nur breiter als seine Spalte, er wurde abgeschnitten. Gemessen am
    // 2026-09-01: „RealSyncDynamics.AI" ergab 648px Text in einem 570px
    // breiten Kasten, 78px fielen weg. Bei Markennamen und Domains ist der
    // einteilige Name der Normalfall, nicht die Ausnahme.
    //
    // `break-word` und nicht `anywhere`: `anywhere` zaehlt beim Ermitteln der
    // Mindestbreite mit und laesst die Textspalte im Hero-Raster
    // zusammenfallen — gemessen sackte sie von 570px auf 226px, die
    // Ueberschrift brach dann dreizeilig mitten im Wort. `break-word` bricht
    // erst, wenn es sonst ueberliefe, und laesst die Spaltenbreite in Ruhe.
    '[id*="--hero--"]>h1,[id*="--hero--"]>h2{position:relative;z-index:1;',
    'font-size:clamp(2.35rem,6vw,4.85rem);line-height:1.02;max-width:16ch;',
    'overflow-wrap:break-word;}',
    '[id*="--hero--"]>p{position:relative;z-index:1;font-size:clamp(1.08rem,1.55vw,1.35rem);max-width:52ch;}',
    '[id*="--hero--"]>a{position:relative;z-index:1;display:inline-block;margin-top:2rem;',
    'background:var(--accent);color:var(--surface);text-decoration:none;font-weight:600;',
    'padding:.95rem 1.85rem;border-radius:var(--radius);box-shadow:var(--shadow);',
    'letter-spacing:.01em;}',
    '[id*="--hero--"]>a:hover{filter:brightness(1.08);}',
    '[id*="--hero--"]>[data-placeholder]{position:relative;z-index:1;margin-top:2.5rem;width:100%;',
    'background:',
    'linear-gradient(160deg,var(--tint-strong),var(--accent-soft) 55%,color-mix(in srgb,var(--accent) 22%,var(--surface)));',
    'border:1px solid var(--line);box-shadow:var(--shadow);min-height:18rem;}',
    // Höhe des Heroes, vom Blueprint gesteuert (`content.emphasis`).
    '[id*="--hero--"][data-emphasis="tall"]{padding-block:clamp(6rem,16vw,11rem)!important;}',
    '[id*="--hero--"][data-emphasis="compact"]{padding-block:clamp(2.5rem,6vw,4rem)!important;}',
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
    'display:grid;gap:clamp(1rem,2.2vw,1.75rem);counter-reset:rsdCard;',
    'grid-template-columns:repeat(auto-fit,minmax(min(100%,17.5rem),1fr));}',
    '[id*="--services--"] li,[id*="--features--"] li{background:var(--tint);',
    'border:1px solid var(--line);border-radius:var(--radius);',
    'padding:clamp(1.4rem,2.4vw,2rem);position:relative;overflow:hidden;}',
    '[id*="--services--"] li::before,[id*="--features--"] li::before{',
    'counter-increment:rsdCard;content:counter(rsdCard,decimal-leading-zero);',
    'display:block;font-family:var(--font-display);font-size:.72rem;letter-spacing:.18em;',
    'text-transform:uppercase;color:var(--accent);margin-bottom:.85rem;}',
    '[id*="--services--"] li strong,[id*="--features--"] li strong{',
    'display:block;font-family:var(--font-display);font-size:1.15rem;margin-bottom:.45rem;}',
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
    '[id*="--cta--"]{text-align:center;background:',
    'radial-gradient(900px 280px at 50% 0%,var(--accent-soft),transparent 70%),var(--tint);}',
    '[id*="--cta--"]>h1,[id*="--cta--"]>h2{max-width:18ch;margin-left:auto;margin-right:auto;}',
    '[id*="--cta--"]>a{display:inline-block;margin-top:.75rem;background:var(--accent);',
    'color:var(--surface);text-decoration:none;font-weight:600;padding:1rem 2rem;',
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
    'body>footer>nav{max-width:var(--maxw);margin:0 auto;padding:2.75rem var(--gutter);}',
    'body>footer ul{display:flex;flex-wrap:wrap;gap:1.75rem;list-style:none;padding:0;margin:0;}',
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
