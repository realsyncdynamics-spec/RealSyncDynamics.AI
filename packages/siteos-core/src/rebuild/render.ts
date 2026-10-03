// Vorschau-Renderer — Richtung + Design-System → ein HTML-Dokument.
//
// ## Was hier gilt
//
//   • Alles, was aus Daten kommt, geht durch `escapeHtml`/`safeUrl`.
//     Farben und Schriften kommen ausschließlich aus dem Design-System,
//     das sie bereits geprüft hat (`design-system.ts`).
//   • Kein Drittanbieter-Host im Markup: keine Google Fonts, kein CDN.
//     Schriften fallen auf System-Stacks zurück — ehrlich, statt in der
//     Vorschau etwas zu zeigen, was die Live-Analyse später als Befund
//     meldet (§ 25 TDDDG).
//   • Platzhalter werden sichtbar als solche gerendert. Eine Sektion mit
//     `placeholder: true` bekommt eine gestrichelte Rahmung und einen
//     Hinweis — niemals eine erfundene Zahl, die wie echt aussieht.
//   • Genau eine <h1>, `lang`, Titel, Description, Viewport, Footer mit
//     Pflichtseiten, KI-Hinweis — was der Blueprint-Renderer zusagt,
//     sagt auch die Vorschau zu.
//
// Bewegung ist auf eine einzige, dezente Einblendung beschränkt und
// respektiert `prefers-reduced-motion`.

import { attr, escapeHtml, jsonLdPayload, safeUrl } from '../render/escape.ts';
import { visibleComponents } from './components.ts';
import { designSystemCssVariables } from './design-system.ts';
import type { RebuildComponent, RebuildCta, RebuildDirection } from './types.ts';

export interface RenderPreviewOptions {
  /** Kanonische Basis-URL, falls bekannt (JSON-LD, canonical). */
  baseUrl?: string | null;
  /** Anzeigename der Marke für Navigation und Footer. */
  brandName: string;
  /** Ort für JSON-LD. */
  locality?: string | null;
  /** Schema.org-Typ; ohne Angabe `Organization`. */
  structuredDataType?: string;
  /**
   * Text des KI-Hinweises (Art. 50 EU AI Act). Nur setzen, wenn ein
   * generatives Modell beteiligt war — der Rebuild selbst arbeitet
   * regelbasiert, und ein Hinweis auf ein Modell, das nie lief, wäre eine
   * falsche Angabe (dieselbe Regel wie `origin.model` im Blueprint).
   */
  aiDisclosure?: string | null;
}

export function renderRebuildPreview(direction: RebuildDirection, options: RenderPreviewOptions): string {
  const components = visibleComponents(direction);
  const body = components.map((c, i) => renderComponent(c, i, direction)).filter((s) => s !== '').join('\n');
  const canonical = options.baseUrl ? safeUrl(options.baseUrl) : null;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': options.structuredDataType ?? 'Organization',
    name: options.brandName,
    description: direction.seo.description,
  };
  if (canonical) jsonLd.url = options.baseUrl;
  if (options.locality) jsonLd.address = { '@type': 'PostalAddress', addressLocality: options.locality };

  return [
    '<!doctype html>',
    '<html lang="de">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(direction.seo.title)}</title>`,
    `<meta name="description" content="${escapeHtml(direction.seo.description)}">`,
    canonical ? `<link rel="canonical" href="${canonical}">` : '',
    `<meta property="og:title" content="${escapeHtml(direction.seo.title)}">`,
    `<meta property="og:description" content="${escapeHtml(direction.seo.description)}">`,
    `<meta name="theme-color" content="${escapeHtml(direction.designSystem.colors.primary)}">`,
    `<script type="application/ld+json">${jsonLdPayload(jsonLd)}</script>`,
    `<style>${designSystemCssVariables(direction.designSystem)}${BASE_CSS}</style>`,
    '</head>',
    `<body data-direction="${escapeHtml(direction.key)}" data-mode="${escapeHtml(direction.designSystem.mode)}">`,
    renderHeader(direction, options.brandName),
    '<main id="inhalt">',
    body,
    '</main>',
    renderFooter(direction, options.brandName, options.aiDisclosure ?? null),
    '</body>',
    '</html>',
  ].filter((l) => l !== '').join('\n');
}

// ─────────────────────────────────────────────────────────────────────
// Kopf und Fuß
// ─────────────────────────────────────────────────────────────────────

function renderHeader(d: RebuildDirection, brand: string): string {
  const links = visibleComponents(d)
    .filter((c) => ['benefits', 'process', 'pricing', 'faq', 'contact'].includes(c.kind))
    .map((c) => `<li><a href="#${escapeHtml(anchorFor(c))}">${escapeHtml(navLabel(c))}</a></li>`)
    .join('');
  const cta = renderCta(d.primaryCta, 'rs-btn rs-btn--primary rs-btn--sm');
  return [
    '<header class="rs-header">',
    '<div class="rs-container rs-header__inner">',
    `<a class="rs-brand" href="#top">${escapeHtml(brand)}</a>`,
    `<nav aria-label="Hauptnavigation"><ul class="rs-nav">${links}</ul></nav>`,
    cta,
    '</div>',
    '</header>',
  ].join('\n');
}

function renderFooter(d: RebuildDirection, brand: string, disclosure: string | null): string {
  return [
    '<footer class="rs-footer">',
    '<div class="rs-container rs-footer__inner">',
    `<p class="rs-footer__brand">${escapeHtml(brand)}</p>`,
    '<nav aria-label="Rechtliches"><ul class="rs-footer__links">',
    '<li><a href="/impressum">Impressum</a></li>',
    '<li><a href="/datenschutz">Datenschutzerklärung</a></li>',
    '<li><a href="/barrierefreiheit">Barrierefreiheit</a></li>',
    '</ul></nav>',
    disclosure ? `<aside class="rs-disclosure" data-ai-disclosure><p>${escapeHtml(disclosure)}</p></aside>` : '',
    `<p class="rs-footer__meta">Richtung: ${escapeHtml(d.label)}</p>`,
    '</div>',
    '</footer>',
  ].filter((l) => l !== '').join('\n');
}

// ─────────────────────────────────────────────────────────────────────
// Komponenten
// ─────────────────────────────────────────────────────────────────────

function renderComponent(c: RebuildComponent, index: number, d: RebuildDirection): string {
  const alt = d.designSystem.sections.alternate && index % 2 === 1 && c.kind !== 'hero' ? ' rs-section--alt' : '';
  const ph = c.placeholder ? ' rs-section--placeholder' : '';
  const open = `<section id="${escapeHtml(anchorFor(c))}" class="rs-section rs-${c.kind} rs-${c.kind}--${escapeHtml(c.variant)}${alt}${ph}" data-component="${escapeHtml(c.kind)}" data-variant="${escapeHtml(c.variant)}">`;
  const note = c.placeholder ? '<p class="rs-placeholder-note">Platzhalter — echte Inhalte ergänzen. Es wurden keine Angaben erfunden.</p>' : '';
  const inner = renderInner(c, d);
  if (inner === '') return '';
  return `${open}\n<div class="rs-container rs-reveal">\n${note}${inner}\n</div>\n</section>`;
}

function renderInner(c: RebuildComponent, d: RebuildDirection): string {
  const t = c.text;
  switch (c.kind) {
    case 'hero': {
      const media = c.media?.src ? safeUrl(c.media.src) : null;
      const image = media ? `<figure class="rs-hero__media"><img src="${media}"${attr('alt', c.media?.alt ?? '')} loading="eager"></figure>` : c.variant === 'split' ? '<div class="rs-hero__media rs-hero__media--empty" role="img" aria-label="Bildfläche — Motiv aus Ihrem Material ergänzen"></div>' : '';
      return [
        '<div class="rs-hero__grid">',
        '<div class="rs-hero__copy">',
        t.eyebrow ? `<p class="rs-eyebrow">${escapeHtml(t.eyebrow)}</p>` : '',
        `<h1 class="rs-h1">${escapeHtml(t.headline ?? '')}</h1>`,
        t.subline ? `<p class="rs-lead">${escapeHtml(t.subline)}</p>` : '',
        '<div class="rs-actions">',
        renderCta(c.cta ?? d.primaryCta, 'rs-btn rs-btn--primary'),
        d.secondaryCta ? renderCta(d.secondaryCta, 'rs-btn rs-btn--secondary') : '',
        '</div>',
        '</div>',
        image,
        '</div>',
      ].filter(Boolean).join('\n');
    }
    case 'trust-bar':
      return [
        t.heading ? `<h2 class="rs-h2 rs-h2--small">${escapeHtml(t.heading)}</h2>` : '',
        c.items.length > 0 ? `<ul class="rs-trust">${c.items.map((i) => `<li class="rs-trust__item"><span class="rs-trust__label">${escapeHtml(i.title)}</span><span class="rs-trust__text">${escapeHtml(i.text)}</span></li>`).join('')}</ul>` : '<p class="rs-muted">Bewertungen, Zertifikate, Erfahrungsjahre — nur echte.</p>',
      ].filter(Boolean).join('\n');
    case 'problem-solution':
      return [
        t.heading ? `<h2 class="rs-h2">${escapeHtml(t.heading)}</h2>` : '',
        '<div class="rs-ps">',
        `<div class="rs-ps__col"><p class="rs-eyebrow">Die Ausgangslage</p><p class="rs-body">${escapeHtml(t.problem ?? '')}</p></div>`,
        `<div class="rs-ps__col rs-ps__col--solution"><p class="rs-eyebrow">Die Antwort</p><p class="rs-body">${escapeHtml(t.solution ?? '')}</p></div>`,
        '</div>',
      ].filter(Boolean).join('\n');
    case 'benefits':
      return [
        t.eyebrow ? `<p class="rs-eyebrow">${escapeHtml(t.eyebrow)}</p>` : '',
        `<h2 class="rs-h2">${escapeHtml(t.heading ?? 'Leistungen')}</h2>`,
        t.intro ? `<p class="rs-lead rs-measure">${escapeHtml(t.intro)}</p>` : '',
        c.items.length > 0 ? `<ul class="rs-cards">${c.items.map((i) => `<li class="rs-card"><h3 class="rs-h3">${escapeHtml(i.title)}</h3>${i.text ? `<p>${escapeHtml(i.text)}</p>` : ''}</li>`).join('')}</ul>` : '<p class="rs-muted">Leistungen aus Ihrem Material ergänzen.</p>',
      ].filter(Boolean).join('\n');
    case 'process':
      return [
        `<h2 class="rs-h2">${escapeHtml(t.heading ?? 'Ablauf')}</h2>`,
        t.intro ? `<p class="rs-lead rs-measure">${escapeHtml(t.intro)}</p>` : '',
        `<ol class="rs-steps">${c.items.map((i) => `<li class="rs-step"><h3 class="rs-h3">${escapeHtml(i.title)}</h3><p>${escapeHtml(i.text)}</p></li>`).join('')}</ol>`,
        c.cta ? `<div class="rs-actions">${renderCta(c.cta, 'rs-btn rs-btn--primary')}</div>` : '',
      ].filter(Boolean).join('\n');
    case 'pricing':
      return [
        `<h2 class="rs-h2">${escapeHtml(t.heading ?? 'Preise')}</h2>`,
        t.intro ? `<p class="rs-lead rs-measure">${escapeHtml(t.intro)}</p>` : '',
        t.note ? `<p class="rs-muted">${escapeHtml(t.note)}</p>` : '',
        c.cta ? `<div class="rs-actions">${renderCta(c.cta, 'rs-btn rs-btn--secondary')}</div>` : '',
      ].filter(Boolean).join('\n');
    case 'faq':
      return [
        `<h2 class="rs-h2">${escapeHtml(t.heading ?? 'Häufige Fragen')}</h2>`,
        `<div class="rs-faq">${c.items.map((i) => `<details class="rs-faq__item"><summary>${escapeHtml(i.title)}</summary><p>${i.text ? escapeHtml(i.text) : '<em>Antwort ergänzen.</em>'}</p></details>`).join('')}</div>`,
      ].join('\n');
    case 'contact': {
      const phone = t.phone ? `<p><a href="${safeUrl(`tel:${t.phone.replace(/\s+/g, '')}`) ?? '#'}">${escapeHtml(t.phone)}</a></p>` : '';
      const email = t.email ? `<p><a href="${safeUrl(`mailto:${t.email}`) ?? '#'}">${escapeHtml(t.email)}</a></p>` : '';
      return [
        '<div class="rs-contact">',
        `<div><h2 class="rs-h2">${escapeHtml(t.heading ?? 'Kontakt')}</h2>${t.body ? `<p class="rs-lead">${escapeHtml(t.body)}</p>` : ''}</div>`,
        `<div class="rs-contact__details">${phone}${email}${t.address ? `<p>${escapeHtml(t.address)}</p>` : ''}${!phone && !email ? '<p class="rs-muted">Telefon und E-Mail ergänzen.</p>' : ''}${c.cta ? renderCta(c.cta, 'rs-btn rs-btn--secondary') : ''}</div>`,
        '</div>',
      ].join('\n');
    }
    case 'lead-form': {
      const fields = d.leadFlow.fields.map((f) => {
        const id = `rs-f-${escapeHtml(f.name)}`;
        const control = f.type === 'textarea'
          ? `<textarea id="${id}" name="${escapeHtml(f.name)}" rows="4"${f.required ? ' required' : ''}></textarea>`
          : `<input id="${id}" name="${escapeHtml(f.name)}" type="${escapeHtml(f.type)}"${f.required ? ' required' : ''}>`;
        return `<div class="rs-field${f.type === 'textarea' ? ' rs-field--wide' : ''}"><label for="${id}">${escapeHtml(f.label)}</label>${control}</div>`;
      }).join('');
      const action = c.formTarget ? safeUrl(c.formTarget) : null;
      return [
        '<div class="rs-form-wrap">',
        `<div><h2 class="rs-h2">${escapeHtml(t.heading ?? 'Anfrage')}</h2>${t.intro ? `<p class="rs-lead">${escapeHtml(t.intro)}</p>` : ''}${action ? '' : '<p class="rs-muted rs-form-note">Formularziel noch nicht konfiguriert — wird im Publish-Schritt gesetzt.</p>'}</div>`,
        `<form class="rs-form" method="post"${action ? ` action="${action}"` : ''} data-form-target="${action ? 'configured' : 'pending'}">`,
        fields,
        `<p class="rs-consent">${escapeHtml(t.consentNote ?? d.leadFlow.consentNote)} <a href="/datenschutz">Datenschutzerklärung</a></p>`,
        `<button type="submit" class="rs-btn rs-btn--primary">${escapeHtml(t.submitLabel ?? d.primaryCta.label)}</button>`,
        '</form>',
        '</div>',
      ].join('\n');
    }
    case 'case-study': {
      const media = c.media?.src ? safeUrl(c.media.src) : null;
      return [
        `<h2 class="rs-h2 rs-h2--small">${escapeHtml(t.heading ?? 'Referenz')}</h2>`,
        `<blockquote class="rs-quote"><p>${escapeHtml(t.quote ?? '')}</p>${t.attribution ? `<footer>${escapeHtml(t.attribution)}</footer>` : ''}</blockquote>`,
        t.body ? `<p class="rs-body rs-measure">${escapeHtml(t.body)}</p>` : '',
        media ? `<figure class="rs-case__media"><img src="${media}"${attr('alt', c.media?.alt ?? '')} loading="lazy"></figure>` : '',
      ].filter(Boolean).join('\n');
    }
    case 'compliance-block':
      return [
        `<h2 class="rs-h2">${escapeHtml(t.heading ?? 'Datenschutz')}</h2>`,
        t.body ? `<p class="rs-lead rs-measure">${escapeHtml(t.body)}</p>` : '',
        `<ul class="rs-badges">${c.items.map((i) => `<li class="rs-badge"><strong>${escapeHtml(i.title)}</strong><span>${escapeHtml(i.text)}</span></li>`).join('')}</ul>`,
      ].filter(Boolean).join('\n');
    case 'automation-block':
      return [
        `<h2 class="rs-h2">${escapeHtml(t.heading ?? 'Automatisierung')}</h2>`,
        t.intro ? `<p class="rs-lead rs-measure">${escapeHtml(t.intro)}</p>` : '',
        `<ol class="rs-steps rs-steps--grid">${c.items.map((i) => `<li class="rs-step"><h3 class="rs-h3">${escapeHtml(i.title)}</h3><p>${escapeHtml(i.text)}</p></li>`).join('')}</ol>`,
        c.cta ? `<div class="rs-actions">${renderCta(c.cta, 'rs-btn rs-btn--secondary')}</div>` : '',
      ].filter(Boolean).join('\n');
  }
}

function renderCta(cta: RebuildCta, className: string): string {
  const href = safeUrl(cta.href);
  if (!href) return '';
  return `<a class="${className}" href="${href}">${escapeHtml(cta.label)}</a>`;
}

export function anchorFor(c: RebuildComponent): string {
  switch (c.kind) {
    case 'benefits': return 'leistungen';
    case 'process': return 'ablauf';
    case 'pricing': return 'preise';
    case 'faq': return 'faq';
    case 'contact': return 'kontakt';
    case 'lead-form': return 'anfrage';
    default: return c.id;
  }
}

function navLabel(c: RebuildComponent): string {
  switch (c.kind) {
    case 'benefits': return 'Leistungen';
    case 'process': return 'Ablauf';
    case 'pricing': return 'Preise';
    case 'faq': return 'FAQ';
    case 'contact': return 'Kontakt';
    default: return c.text.heading ?? c.kind;
  }
}

// ─────────────────────────────────────────────────────────────────────
// CSS — nur Variablen aus dem Design-System, keine festen Farben
// ─────────────────────────────────────────────────────────────────────

const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--rs-bg);color:var(--rs-fg);font-family:var(--rs-font-body);font-weight:var(--rs-body-weight);line-height:var(--rs-body-lh);font-size:1rem;-webkit-font-smoothing:antialiased}
img{max-width:100%;height:auto;display:block}
a{color:var(--rs-primary);text-decoration:none}
a:hover{text-decoration:underline}
h1,h2,h3{font-family:var(--rs-font-display);font-weight:var(--rs-display-weight);letter-spacing:var(--rs-display-tracking);line-height:var(--rs-display-lh);margin:0 0 calc(var(--rs-unit)*4)}
p{margin:0 0 calc(var(--rs-unit)*4)}
ul,ol{margin:0;padding:0;list-style:none}
.rs-container{width:100%;max-width:var(--rs-container);margin:0 auto;padding:0 var(--rs-gutter)}
.rs-section{padding:var(--rs-section-y) 0}
.rs-section--alt{background:var(--rs-surface-alt)}
.rs-section--placeholder .rs-container{outline:2px dashed var(--rs-border);outline-offset:-8px;border-radius:var(--rs-radius-lg)}
.rs-placeholder-note{font-size:var(--rs-text-sm);color:var(--rs-muted);background:var(--rs-surface);border:1px solid var(--rs-border);border-radius:var(--rs-radius-sm);padding:calc(var(--rs-unit)*2) calc(var(--rs-unit)*3);display:inline-block;margin-bottom:calc(var(--rs-unit)*6)}
.rs-h1{font-size:var(--rs-text-3xl);max-width:20ch}
.rs-h2{font-size:var(--rs-text-2xl);max-width:28ch}
.rs-h2--small{font-size:var(--rs-text-lg);color:var(--rs-muted);font-weight:600;letter-spacing:0.02em;text-transform:uppercase}
.rs-h3{font-size:var(--rs-text-lg);margin-bottom:calc(var(--rs-unit)*2)}
.rs-eyebrow{font-size:var(--rs-text-sm);font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--rs-accent);margin-bottom:calc(var(--rs-unit)*3)}
.rs-lead{font-size:var(--rs-text-lg);color:var(--rs-muted);max-width:var(--rs-measure)}
.rs-body{max-width:var(--rs-measure)}
.rs-measure{max-width:var(--rs-measure)}
.rs-muted{color:var(--rs-muted);font-size:var(--rs-text-sm)}
.rs-actions{display:flex;flex-wrap:wrap;gap:calc(var(--rs-unit)*3);margin-top:calc(var(--rs-unit)*6)}
.rs-btn{display:inline-flex;align-items:center;justify-content:center;min-height:var(--rs-btn-h);padding:0 var(--rs-btn-px);border-radius:var(--rs-btn-radius);font-weight:var(--rs-btn-weight);font-family:var(--rs-font-body);font-size:1rem;border:1px solid transparent;transition:transform var(--rs-motion-ms) var(--rs-motion-ease),background-color var(--rs-motion-ms) var(--rs-motion-ease);cursor:pointer;text-decoration:none}
.rs-btn:hover{text-decoration:none;transform:translateY(-1px)}
.rs-btn:focus-visible{outline:3px solid var(--rs-focus);outline-offset:2px}
.rs-btn--primary{background:var(--rs-primary);color:var(--rs-primary-fg);border-color:var(--rs-primary)}
.rs-btn--secondary{background:transparent;color:var(--rs-primary);border-color:var(--rs-primary)}
[data-mode="dark"] .rs-btn--secondary{color:var(--rs-fg);border-color:var(--rs-border)}
.rs-btn--sm{min-height:calc(var(--rs-btn-h) - 8px);padding:0 calc(var(--rs-btn-px) - 6px);font-size:var(--rs-text-sm)}
.rs-header{position:sticky;top:0;z-index:10;background:color-mix(in srgb,var(--rs-bg) 88%,transparent);backdrop-filter:saturate(1.2) blur(10px);border-bottom:1px solid var(--rs-border)}
.rs-header__inner{display:flex;align-items:center;justify-content:space-between;gap:calc(var(--rs-unit)*4);min-height:64px}
.rs-brand{font-family:var(--rs-font-display);font-weight:700;color:var(--rs-fg);font-size:var(--rs-text-lg)}
.rs-nav{display:none;gap:calc(var(--rs-unit)*6)}
.rs-nav a{color:var(--rs-fg);font-size:var(--rs-text-sm);font-weight:500}
.rs-hero{padding-top:calc(var(--rs-section-y) + 8px)}
.rs-hero__grid{display:grid;gap:calc(var(--rs-unit)*8);align-items:center}
.rs-hero--centered .rs-hero__copy{text-align:center;margin:0 auto;max-width:44rem}
.rs-hero--centered .rs-h1,.rs-hero--centered .rs-lead{margin-left:auto;margin-right:auto}
.rs-hero--centered .rs-actions{justify-content:center}
.rs-hero--statement .rs-h1{font-size:var(--rs-text-4xl);max-width:16ch}
.rs-hero--statement .rs-hero__media{display:none}
.rs-hero__media{border-radius:var(--rs-radius-lg);overflow:hidden;margin:0}
.rs-hero__media--empty{aspect-ratio:4/3;background:linear-gradient(135deg,var(--rs-surface),var(--rs-surface-alt));border:1px solid var(--rs-border)}
.rs-trust{display:grid;gap:calc(var(--rs-unit)*4);grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
.rs-trust__item{display:grid;gap:calc(var(--rs-unit)*1);padding:calc(var(--rs-unit)*4);border:1px solid var(--rs-border);border-radius:var(--rs-radius-md);background:var(--rs-surface)}
.rs-trust-bar--quiet .rs-trust__item{border:0;background:transparent;padding:0}
.rs-trust__label{font-size:var(--rs-text-xs);letter-spacing:0.06em;text-transform:uppercase;color:var(--rs-muted);font-weight:600}
.rs-trust__text{font-weight:500}
.rs-ps{display:grid;gap:calc(var(--rs-unit)*8)}
.rs-ps__col--solution{border-left:3px solid var(--rs-primary);padding-left:calc(var(--rs-unit)*5)}
.rs-cards{display:grid;gap:var(--rs-card-pad)}
.rs-card{background:var(--rs-card-bg);border:1px solid var(--rs-card-border);border-radius:var(--rs-card-radius);padding:var(--rs-card-pad);box-shadow:var(--rs-card-shadow)}
.rs-benefits--list .rs-cards{grid-template-columns:1fr}
.rs-benefits--list .rs-card{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:calc(var(--rs-unit)*4);align-items:start}
.rs-benefits--list .rs-card .rs-h3{margin:0}
.rs-steps{display:grid;gap:calc(var(--rs-unit)*6);counter-reset:step}
.rs-step{position:relative;padding-left:calc(var(--rs-unit)*12)}
.rs-step::before{counter-increment:step;content:counter(step);position:absolute;left:0;top:0;width:calc(var(--rs-unit)*8);height:calc(var(--rs-unit)*8);border-radius:999px;display:grid;place-items:center;background:var(--rs-primary);color:var(--rs-primary-fg);font-weight:700;font-size:var(--rs-text-sm)}
.rs-process--timeline .rs-step::after{content:"";position:absolute;left:calc(var(--rs-unit)*4 - 1px);top:calc(var(--rs-unit)*9);bottom:calc(var(--rs-unit)*-6);width:2px;background:var(--rs-border)}
.rs-process--timeline .rs-step:last-child::after{display:none}
.rs-faq{display:grid;gap:calc(var(--rs-unit)*2)}
.rs-faq__item{border:1px solid var(--rs-border);border-radius:var(--rs-radius-md);padding:calc(var(--rs-unit)*3) calc(var(--rs-unit)*4);background:var(--rs-surface)}
.rs-faq__item summary{cursor:pointer;font-weight:600;font-family:var(--rs-font-display)}
.rs-faq__item p{margin:calc(var(--rs-unit)*3) 0 0;color:var(--rs-muted)}
.rs-contact{display:grid;gap:calc(var(--rs-unit)*8)}
.rs-contact__details p{font-size:var(--rs-text-lg);font-weight:500}
.rs-contact--card .rs-contact__details{background:var(--rs-card-bg);border:1px solid var(--rs-card-border);border-radius:var(--rs-card-radius);padding:var(--rs-card-pad)}
.rs-form-wrap{display:grid;gap:calc(var(--rs-unit)*8)}
.rs-form{display:grid;gap:calc(var(--rs-unit)*4);background:var(--rs-card-bg);border:1px solid var(--rs-card-border);border-radius:var(--rs-card-radius);padding:var(--rs-card-pad)}
.rs-field{display:grid;gap:calc(var(--rs-unit)*1.5)}
.rs-field label{font-weight:600;font-size:var(--rs-text-sm)}
.rs-field input,.rs-field textarea{width:100%;min-height:var(--rs-input-h);padding:calc(var(--rs-unit)*3);border:1px solid var(--rs-input-border);border-radius:var(--rs-input-radius);background:var(--rs-input-bg);color:var(--rs-fg);font:inherit}
.rs-field textarea{min-height:calc(var(--rs-input-h)*2.4)}
.rs-field input:focus-visible,.rs-field textarea:focus-visible{outline:3px solid var(--rs-focus);outline-offset:1px}
.rs-consent{font-size:var(--rs-text-xs);color:var(--rs-muted)}
.rs-form-note{margin-top:calc(var(--rs-unit)*2)}
.rs-quote{margin:0;padding:calc(var(--rs-unit)*6);border-left:3px solid var(--rs-primary);background:var(--rs-surface);border-radius:0 var(--rs-radius-md) var(--rs-radius-md) 0;max-width:var(--rs-measure)}
.rs-quote p{font-size:var(--rs-text-lg);font-family:var(--rs-font-display)}
.rs-quote footer{color:var(--rs-muted);font-size:var(--rs-text-sm)}
.rs-case__media{margin:calc(var(--rs-unit)*6) 0 0;border-radius:var(--rs-radius-lg);overflow:hidden;max-width:var(--rs-measure)}
.rs-badges{display:grid;gap:calc(var(--rs-unit)*4)}
.rs-badge{display:grid;gap:calc(var(--rs-unit)*1);padding:calc(var(--rs-unit)*4);border:1px solid var(--rs-border);border-radius:var(--rs-radius-md);background:var(--rs-surface)}
.rs-compliance-block--badges .rs-badge{border-color:var(--rs-primary)}
.rs-badge span{color:var(--rs-muted);font-size:var(--rs-text-sm)}
.rs-footer{border-top:1px solid var(--rs-border);padding:calc(var(--rs-unit)*10) 0;color:var(--rs-muted);font-size:var(--rs-text-sm)}
.rs-footer__inner{display:grid;gap:calc(var(--rs-unit)*4)}
.rs-footer__brand{font-weight:600;color:var(--rs-fg)}
.rs-footer__links{display:flex;flex-wrap:wrap;gap:calc(var(--rs-unit)*4)}
.rs-footer__links a{color:var(--rs-muted)}
.rs-disclosure p{margin:0}
.rs-footer__meta{margin:0;font-size:var(--rs-text-xs)}
.rs-reveal{animation:rs-fade var(--rs-motion-ms) var(--rs-motion-ease) both}
@keyframes rs-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.rs-reveal{animation:none}.rs-btn{transition:none}}
@media (min-width:640px){.rs-cards{grid-template-columns:repeat(2,1fr)}.rs-form{grid-template-columns:1fr 1fr}.rs-field--wide,.rs-consent,.rs-form .rs-btn{grid-column:1/-1}.rs-form .rs-btn{justify-self:start}.rs-badges{grid-template-columns:repeat(2,1fr)}}
@media (min-width:834px){.rs-nav{display:flex}.rs-section{padding:var(--rs-section-y-lg) 0}.rs-hero__grid{grid-template-columns:1.1fr 0.9fr}.rs-hero--centered .rs-hero__grid,.rs-hero--statement .rs-hero__grid{grid-template-columns:1fr}.rs-cards{grid-template-columns:repeat(3,1fr)}.rs-benefits--list .rs-cards{grid-template-columns:1fr}.rs-ps{grid-template-columns:1fr 1fr}.rs-problem-solution--stacked .rs-ps{grid-template-columns:1fr;max-width:var(--rs-measure)}.rs-steps--grid{grid-template-columns:repeat(3,1fr)}.rs-steps--grid .rs-step{padding-left:0;padding-top:calc(var(--rs-unit)*12)}.rs-contact{grid-template-columns:1fr 1fr}.rs-form-wrap{grid-template-columns:0.8fr 1.2fr}.rs-faq--two-column .rs-faq{grid-template-columns:1fr 1fr}.rs-footer__inner{grid-template-columns:1fr auto;align-items:center}.rs-footer__inner .rs-disclosure{grid-column:1/-1}}
`;
