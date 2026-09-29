// Gestaltetes Markup für Blueprints mit Design-System (`blueprint.design`).
//
// ## Warum ein zweiter Markup-Zweig und kein größeres Stylesheet
//
// `presentation.ts` gestaltet das Kern-Markup, ohne es anzufassen — das hält
// die Hashes aller bestehenden Blueprints stabil. Für Karten mit Nummern,
// Schritte, Preiskarten, einen zweispaltigen Hero oder ein Formular im
// Raster reicht das nicht: Dafür braucht es Container und Rollen im Markup.
//
// Dieser Zweig greift deshalb nur, wenn der Blueprint ein Design-System
// trägt — also nur für Rebuild-Blueprints, die es vorher nicht gab. Für alle
// anderen bleibt die Ausgabe byte-gleich.
//
// ## Was gleich bleibt
//
// Dieselben Zusagen wie im Kern-Renderer, gegen dieselbe Live-Analyse
// gebaut: genau eine H1 (über `nextHeading`), Labels an jedem Feld,
// Rechtslinks im Fuß, Drittanbieter nur hinter der Einwilligungsschranke,
// jeder Wert durch `escapeHtml` bzw. `safeUrl`. Ein Bild erscheint nur mit
// bestätigter Rechtelage und Alternativtext.

import type { SiteBlock, SiteBlueprint } from '../types.ts';
import { attr, escapeHtml, safeUrl, textBlockHtml } from './escape.ts';
import { sanitizeDesign } from './design.ts';

export type NextHeading = () => 'h1' | 'h2';

const CHECK_ICON = '<svg class="rs-icon" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"><path d="M7.6 13.4 4.2 10l-1.2 1.2 4.6 4.6 9.4-9.4-1.2-1.2z" fill="currentColor"/></svg>';
const SHIELD_ICON = '<svg class="rs-icon rs-icon--lg" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false"><path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5l-8-3zm-1.2 14.2-3.6-3.6 1.4-1.4 2.2 2.2 5-5 1.4 1.4-6.4 6.4z" fill="currentColor"/></svg>';
const ARROW_ICON = '<svg class="rs-icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false"><path d="M11.2 4.8 10 6l3.2 3.2H4v1.6h9.2L10 14l1.2 1.2L16.4 10z" fill="currentColor"/></svg>';

const ANCHOR = /^[a-z][a-z0-9-]{1,30}$/;

interface Ctx {
  blueprint: SiteBlueprint;
  block: SiteBlock;
  id: string;
  content: Record<string, unknown>;
  nextHeading: NextHeading;
  /** Abwechselnde Fläche im Modus `banded`. */
  tone: 'base' | 'alt';
}

/**
 * Rendert einen Block im gestalteten Zweig. `''` heißt: nichts ausliefern
 * (ausgeblendet oder ohne belegte Inhalte).
 */
export function renderDesignedBlock(blueprint: SiteBlueprint, block: SiteBlock, nextHeading: NextHeading, tone: 'base' | 'alt'): string {
  const content = block.content as Record<string, unknown>;
  const ctx: Ctx = { blueprint, block, id: escapeHtml(block.id), content, nextHeading, tone };

  switch (block.kind) {
    case 'navigation': return navigation(ctx);
    case 'hero': return hero(ctx);
    case 'trust-bar': return trustBar(ctx);
    case 'services':
    case 'features': return cards(ctx);
    case 'problem-solution': return problemSolution(ctx);
    case 'process': return process(ctx);
    case 'pricing': return pricing(ctx);
    case 'testimonials': return testimonials(ctx);
    case 'case-study': return caseStudies(ctx);
    case 'about': return about(ctx);
    case 'team': return team(ctx);
    case 'faq': return faq(ctx);
    case 'contact-info': return contactInfo(ctx);
    case 'contact-form':
    case 'booking': return form(ctx);
    case 'map': return map(ctx);
    case 'governance': return governance(ctx);
    case 'automation': return automation(ctx);
    case 'cta': return cta(ctx);
    case 'legal-text': return legalText(ctx);
    case 'ai-disclosure': return aiDisclosure(ctx);
    case 'footer': return footer(ctx);
  }
}

/** Blöcke dieser Arten setzen eine Seitenüberschrift über `nextHeading`. */
export function designedUsesPageHeading(block: SiteBlock): boolean {
  switch (block.kind) {
    case 'navigation': case 'cta': case 'ai-disclosure': case 'footer': case 'map': return false;
    case 'trust-bar': return typeof block.content.heading === 'string' && block.content.heading.trim() !== '';
    default: return true;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Kopf und Fuß
// ─────────────────────────────────────────────────────────────────────

function navigation({ blueprint, id, content }: Ctx): string {
  const links = list(content.links)
    .map((link) => {
      const href = safeUrl(link.href);
      return href ? `<li><a href="${href}">${escapeHtml(link.label ?? '')}</a></li>` : '';
    })
    .filter((l) => l !== '');
  const cta = content.cta as { label?: unknown; href?: unknown } | undefined;
  const ctaHref = cta ? safeUrl(cta.href) : null;
  return [
    `<header id="${id}" class="rs-header">`,
    '<div class="rs-container rs-header__bar">',
    `<a class="rs-brand" href="/">${escapeHtml(content.brand ?? blueprint.name)}</a>`,
    links.length > 0 ? `<nav class="rs-nav" aria-label="Hauptnavigation"><ul>${links.join('')}</ul></nav>` : '',
    ctaHref && blueprint.design?.headerCta ? `<a class="rs-btn rs-btn--primary rs-btn--sm rs-header__cta" href="${ctaHref}">${escapeHtml(cta?.label ?? 'Kontakt')}</a>` : '',
    '</div>',
    '</header>',
    '<main id="inhalt">',
  ].filter((l) => l !== '').join('\n');
}

function footer({ blueprint, id, content }: Ctx): string {
  const legal = list(content.legalLinks)
    .map((link) => {
      const href = safeUrl(link.href);
      return href ? `<li><a href="${href}">${escapeHtml(link.label ?? '')}</a></li>` : '';
    })
    .filter((l) => l !== '');
  const pages = list(content.links)
    .map((link) => {
      const href = safeUrl(link.href);
      return href ? `<li><a href="${href}">${escapeHtml(link.label ?? '')}</a></li>` : '';
    })
    .filter((l) => l !== '');
  const lines = Array.isArray(content.contactLines) ? content.contactLines.filter((l): l is string => typeof l === 'string') : [];
  const brand = escapeHtml(content.brand ?? blueprint.name);
  return [
    '</main>',
    `<footer id="${id}" class="rs-footer">`,
    '<div class="rs-container rs-footer__grid">',
    `<div class="rs-footer__about"><p class="rs-footer__brand">${brand}</p>${content.summary ? `<p>${escapeHtml(content.summary)}</p>` : ''}</div>`,
    lines.length > 0 ? `<div><p class="rs-footer__label">Kontakt</p><ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul></div>` : '',
    pages.length > 0 ? `<nav aria-label="Seiten"><p class="rs-footer__label">Seiten</p><ul>${pages.join('')}</ul></nav>` : '',
    `<nav aria-label="Rechtliches"><p class="rs-footer__label">Rechtliches</p><ul>${legal.join('')}</ul></nav>`,
    '</div>',
    `<div class="rs-container rs-footer__base"><p>© ${brand}</p></div>`,
    '</footer>',
  ].filter((l) => l !== '').join('\n');
}

// ─────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────

const HERO_VARIANTS = new Set(['split', 'centered', 'editorial', 'compact']);

function hero({ blueprint, id, content, nextHeading }: Ctx): string {
  const design = blueprint.design;
  // Beide Quellen landen in einem class-Attribut — nur Werte aus der festen
  // Menge (Block-Variante) bzw. aus `sanitizeDesign` (Design-System).
  const variantRaw = typeof content.variant === 'string' && HERO_VARIANTS.has(content.variant)
    ? content.variant
    : design ? sanitizeDesign(design).hero : 'split';
  const heading = nextHeading();
  const primary = content.primaryCta as { label?: unknown; href?: unknown } | undefined;
  const secondary = content.secondaryCta as { label?: unknown; href?: unknown } | undefined;
  const primaryHref = primary ? safeUrl(primary.href) : null;
  const secondaryHref = secondary ? safeUrl(secondary.href) : null;
  const strong = design?.ctaEmphasis === 'strong';

  const actions = [
    primaryHref ? `<a class="rs-btn rs-btn--primary${strong ? ' rs-btn--lg' : ''}" href="${primaryHref}">${escapeHtml(primary?.label ?? 'Kontakt')}${ARROW_ICON}</a>` : '',
    secondaryHref ? `<a class="rs-btn rs-btn--secondary${strong ? ' rs-btn--lg' : ''}" href="${secondaryHref}">${escapeHtml(secondary?.label ?? '')}</a>` : '',
  ].filter((a) => a !== '');

  const media = variantRaw === 'split' ? heroMedia(blueprint, content) : '';
  const layout = media === '' && variantRaw === 'split' ? 'editorial' : variantRaw;

  return [
    `<section id="${id}" class="rs-hero rs-hero--${layout}"${attr('data-variant', layout)}${attr('data-emphasis', emphasisOf(content.emphasis))}>`,
    `<div class="rs-container rs-hero__grid">`,
    '<div class="rs-hero__copy">',
    content.eyebrow ? `<p class="rs-eyebrow">${escapeHtml(content.eyebrow)}</p>` : '',
    `<${heading} class="rs-hero__title">${escapeHtml(content.headline ?? blueprint.name)}</${heading}>`,
    content.subline ? `<p class="rs-hero__lead">${escapeHtml(content.subline)}</p>` : '',
    actions.length > 0 ? `<div class="rs-actions">${actions.join('')}</div>` : '',
    content.proof ? `<p class="rs-proof">${CHECK_ICON}<span>${escapeHtml(content.proof)}</span></p>` : '',
    '</div>',
    media,
    '</div>',
    '</section>',
  ].filter((l) => l !== '').join('\n');
}

/**
 * Rechte Spalte des Heroes. Ein Bild nur mit bestätigter Rechtelage; sonst
 * eine Karte aus belegten Inhalten derselben Seite (Leistungen oder
 * Kontakt) — kein Stockfoto, kein Platzhalter-Grau.
 */
function heroMedia(blueprint: SiteBlueprint, content: Record<string, unknown>): string {
  const media = content.media as { kind?: unknown; src?: unknown; alt?: unknown; rightsConfirmed?: unknown } | undefined;
  // Ein Bild erscheint nur mit Adresse, Alternativtext und bestätigter
  // Rechtelage — unabhängig davon, ob es aus der Quelle stammt oder später
  // eingetragen wurde.
  if (media && typeof media.src === 'string' && media.rightsConfirmed === true && typeof media.alt === 'string' && media.alt.trim() !== '') {
    const src = safeUrl(media.src);
    if (src && /^https?:/.test(src)) {
      return `<div class="rs-hero__media"><img class="rs-hero__image" src="${src}" alt="${escapeHtml(media.alt)}" loading="eager" decoding="async"></div>`;
    }
  }
  const home = blueprint.pages.find((p) => p.path === '/') ?? blueprint.pages[0];
  const blocks = home?.blocks ?? [];
  const direction = blueprint.design?.direction;
  const contact = blocks.find((b) => b.kind === 'contact-info' && b.content.hidden !== true);
  const services = blocks.find((b) => b.kind === 'services' && b.content.hidden !== true);

  if (direction === 'conversion-focus' && contact) {
    const c = contact.content as Record<string, unknown>;
    const rows = [
      c.phone ? `<li><span>Telefon</span>${linkOrText(c.phoneHref, c.phone)}</li>` : '',
      c.email ? `<li><span>E-Mail</span>${linkOrText(`mailto:${String(c.email)}`, c.email)}</li>` : '',
      c.hours ? `<li><span>Erreichbar</span>${escapeHtml(c.hours)}</li>` : '',
    ].filter((r) => r !== '');
    if (rows.length > 0) return `<aside class="rs-hero__card" aria-label="Direkter Kontakt"><p class="rs-hero__card-title">Direkter Kontakt</p><ul class="rs-hero__rows">${rows.join('')}</ul></aside>`;
  }
  if (services) {
    const items = list(services.content.items).slice(0, 5).map((i) => `<li>${CHECK_ICON}<span>${escapeHtml(i.label ?? '')}</span></li>`);
    // Eine Karte mit einem einzigen Eintrag ist keine Übersicht — dann trägt
    // der Hero ohne rechte Spalte (redaktionell).
    if (items.length >= 2) {
      return `<aside class="rs-hero__card" aria-label="${escapeHtml(services.content.heading ?? 'Leistungen')}"><p class="rs-hero__card-title">${escapeHtml(services.content.heading ?? 'Leistungen')}</p><ul class="rs-checklist">${items.join('')}</ul></aside>`;
    }
  }
  return '';
}

// ─────────────────────────────────────────────────────────────────────
// Inhaltsblöcke
// ─────────────────────────────────────────────────────────────────────

function sectionOpen(ctx: Ctx, modifier: string): string {
  const anchor = typeof ctx.content.anchor === 'string' && ANCHOR.test(ctx.content.anchor) ? `<span id="${ctx.content.anchor}" class="rs-anchor"></span>` : '';
  return `<section id="${ctx.id}" class="rs-section rs-${modifier}"${ctx.tone === 'alt' ? ' data-tone="alt"' : ''}>${anchor}`;
}

function head(ctx: Ctx, fallback: string, intro?: unknown): string {
  const heading = ctx.nextHeading();
  return `<div class="rs-section__head"><${heading}>${escapeHtml(ctx.content.heading ?? fallback)}</${heading}>${typeof intro === 'string' && intro.trim() !== '' ? `<p class="rs-section__intro">${escapeHtml(intro)}</p>` : ''}</div>`;
}

function trustBar(ctx: Ctx): string {
  const items = list(ctx.content.items).filter((i) => typeof i.label === 'string' && i.label.trim() !== '');
  if (items.length === 0) return '';
  const heading = typeof ctx.content.heading === 'string' && ctx.content.heading.trim() !== '' ? ctx.nextHeading() : null;
  return [
    `<section id="${ctx.id}" class="rs-trust"${heading ? '' : ' aria-label="Vertrauen und Nachweise"'}>`,
    '<div class="rs-container">',
    heading ? `<${heading} class="rs-trust__title">${escapeHtml(ctx.content.heading)}</${heading}>` : '',
    `<ul class="rs-trust__list">${items.map((i) => `<li>${CHECK_ICON}<span>${escapeHtml(i.label)}</span></li>`).join('')}</ul>`,
    '</div>',
    '</section>',
  ].filter((l) => l !== '').join('\n');
}

const CARD_VARIANTS = new Set(['cards', 'numbered', 'list']);

function cards(ctx: Ctx): string {
  const items = list(ctx.content.items).filter((i) => typeof i.label === 'string' && i.label.trim() !== '');
  if (items.length === 0) return '';
  const variant = typeof ctx.content.variant === 'string' && CARD_VARIANTS.has(ctx.content.variant) ? ctx.content.variant : 'cards';
  const fallback = ctx.block.kind === 'features' ? 'Warum wir' : 'Leistungen';
  return [
    sectionOpen(ctx, ctx.block.kind === 'features' ? 'features' : 'services'),
    '<div class="rs-container">',
    head(ctx, fallback, ctx.content.intro),
    `<ol class="rs-cards rs-cards--${variant}">`,
    ...items.map((item, index) => [
      '<li class="rs-card">',
      variant === 'numbered' ? `<span class="rs-card__index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>` : '',
      variant === 'cards' && ctx.block.kind === 'features' ? CHECK_ICON : '',
      `<h3>${escapeHtml(item.label)}</h3>`,
      typeof item.description === 'string' && item.description.trim() !== '' ? `<p>${escapeHtml(item.description)}</p>` : '',
      '</li>',
    ].filter((l) => l !== '').join('')),
    '</ol>',
    '</div>',
    '</section>',
  ].join('\n');
}

function problemSolution(ctx: Ctx): string {
  const problem = typeof ctx.content.problem === 'string' ? ctx.content.problem.trim() : '';
  const solution = typeof ctx.content.solution === 'string' ? ctx.content.solution.trim() : '';
  if (problem === '' && solution === '') return '';
  const heading = ctx.nextHeading();
  const points = list(ctx.content.points).filter((p) => typeof p.label === 'string' && p.label.trim() !== '');
  return [
    sectionOpen(ctx, 'ps'),
    '<div class="rs-container rs-ps__grid">',
    `<div class="rs-ps__left">${ctx.content.heading ? `<p class="rs-eyebrow">${escapeHtml(ctx.content.heading)}</p>` : ''}<${heading} class="rs-ps__problem">${escapeHtml(problem || ctx.content.heading || '')}</${heading}></div>`,
    '<div class="rs-ps__right">',
    solution ? `<p class="rs-ps__solution">${escapeHtml(solution)}</p>` : '',
    points.length > 0 ? `<ul class="rs-checklist">${points.map((p) => `<li>${CHECK_ICON}<span>${escapeHtml(p.label)}</span></li>`).join('')}</ul>` : '',
    '</div>',
    '</div>',
    '</section>',
  ].filter((l) => l !== '').join('\n');
}

function process(ctx: Ctx): string {
  const steps = list(ctx.content.steps).filter((s) => typeof s.title === 'string' && s.title.trim() !== '');
  if (steps.length === 0) return '';
  return [
    sectionOpen(ctx, 'process'),
    '<div class="rs-container">',
    head(ctx, 'Ablauf'),
    '<ol class="rs-steps">',
    ...steps.map((step, index) => `<li class="rs-step"><span class="rs-step__num" aria-hidden="true">${index + 1}</span><h3>${escapeHtml(step.title)}</h3>${typeof step.text === 'string' && step.text.trim() !== '' ? `<p>${escapeHtml(step.text)}</p>` : ''}</li>`),
    '</ol>',
    '</div>',
    '</section>',
  ].join('\n');
}

function pricing(ctx: Ctx): string {
  const items = list(ctx.content.items).filter((i) => typeof i.price === 'string' && i.price.trim() !== '');
  if (items.length === 0) return '';
  return [
    sectionOpen(ctx, 'pricing'),
    '<div class="rs-container">',
    head(ctx, 'Preise'),
    '<ul class="rs-price-grid">',
    ...items.map((item) => `<li class="rs-card rs-price"><h3>${escapeHtml(item.label ?? '')}</h3><p class="rs-price__value">${escapeHtml(item.price)}</p>${typeof item.note === 'string' && item.note.trim() !== '' ? `<p>${escapeHtml(item.note)}</p>` : ''}</li>`),
    '</ul>',
    typeof ctx.content.note === 'string' ? `<p class="rs-note">${escapeHtml(ctx.content.note)}</p>` : '',
    '</div>',
    '</section>',
  ].filter((l) => l !== '').join('\n');
}

function testimonials(ctx: Ctx): string {
  const items = list(ctx.content.items).filter((i) => typeof i.quote === 'string' && i.quote.trim() !== '');
  // Wie im Kern: keine Überschrift „Stimmen" ohne Stimmen (§ 5 UWG).
  if (items.length === 0) return '';
  return [
    sectionOpen(ctx, 'quotes'),
    '<div class="rs-container">',
    head(ctx, 'Stimmen'),
    '<ul class="rs-quotes">',
    ...items.map((item) => `<li class="rs-card rs-quote"><blockquote><p>${escapeHtml(stripQuotes(item.quote))}</p></blockquote>${typeof item.author === 'string' && item.author.trim() !== '' ? `<p class="rs-quote__author">${escapeHtml(item.author)}</p>` : ''}</li>`),
    '</ul>',
    '</div>',
    '</section>',
  ].join('\n');
}

function caseStudies(ctx: Ctx): string {
  const items = list(ctx.content.items).filter((i) => typeof i.title === 'string' && typeof i.text === 'string' && i.text.trim() !== '');
  if (items.length === 0) return '';
  return [
    sectionOpen(ctx, 'cases'),
    '<div class="rs-container">',
    head(ctx, 'Referenzen'),
    '<ul class="rs-cards rs-cards--cards">',
    ...items.map((item) => `<li class="rs-card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></li>`),
    '</ul>',
    '</div>',
    '</section>',
  ].join('\n');
}

function about(ctx: Ctx): string {
  const body = typeof ctx.content.body === 'string' ? ctx.content.body.trim() : '';
  if (body === '') return '';
  const heading = ctx.nextHeading();
  return [
    sectionOpen(ctx, 'about'),
    `<div class="rs-container rs-about__grid"><${heading}>${escapeHtml(ctx.content.heading ?? 'Über uns')}</${heading}><p class="rs-about__body">${escapeHtml(body)}</p></div>`,
    '</section>',
  ].join('\n');
}

function team(ctx: Ctx): string {
  const members = list(ctx.content.members).filter((m) => typeof m.name === 'string' && m.name.trim() !== '');
  if (members.length === 0) return '';
  return [
    sectionOpen(ctx, 'team'),
    '<div class="rs-container">',
    head(ctx, 'Team'),
    `<ul class="rs-team">${members.map((m) => `<li class="rs-card">${escapeHtml(m.name)}</li>`).join('')}</ul>`,
    '</div>',
    '</section>',
  ].join('\n');
}

function faq(ctx: Ctx): string {
  const items = list(ctx.content.items).filter((i) => typeof i.question === 'string' && typeof i.answer === 'string' && i.answer.trim() !== '');
  if (items.length === 0) return '';
  return [
    sectionOpen(ctx, 'faq'),
    '<div class="rs-container rs-faq__wrap">',
    head(ctx, 'Häufige Fragen'),
    '<div class="rs-faq">',
    ...items.map((item) => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`),
    '</div>',
    '</div>',
    '</section>',
  ].join('\n');
}

function contactInfo(ctx: Ctx): string {
  const c = ctx.content;
  const rows = [
    typeof c.phone === 'string' ? `<div><dt>Telefon</dt><dd>${linkOrText(c.phoneHref, c.phone)}</dd></div>` : '',
    typeof c.email === 'string' ? `<div><dt>E-Mail</dt><dd>${linkOrText(`mailto:${c.email}`, c.email)}</dd></div>` : '',
    typeof c.address === 'string' ? `<div><dt>Anschrift</dt><dd>${escapeHtml(c.address)}</dd></div>` : '',
    typeof c.hours === 'string' ? `<div><dt>Erreichbarkeit</dt><dd>${escapeHtml(c.hours)}</dd></div>` : '',
  ].filter((r) => r !== '');
  if (rows.length === 0) return '';
  return [
    sectionOpen(ctx, 'contact'),
    '<div class="rs-container">',
    head(ctx, 'Kontakt'),
    `<address class="rs-card rs-contact__card"><dl>${rows.join('')}</dl></address>`,
    '</div>',
    '</section>',
  ].join('\n');
}

const FIELD_LABELS: Readonly<Record<string, string>> = Object.freeze({
  name: 'Name',
  email: 'E-Mail-Adresse',
  phone: 'Telefonnummer',
  message: 'Ihre Nachricht',
  slot: 'Wunschtermin',
});

function form(ctx: Ctx): string {
  const c = ctx.content;
  const fields = Array.isArray(c.fields) ? c.fields.filter((f): f is string => typeof f === 'string') : [];
  const privacyHref = safeUrl(c.privacyHref);
  const target = typeof c.target === 'string' ? safeUrl(c.target) : null;
  const mailto = target !== null && target.startsWith('mailto:');
  const heading = ctx.nextHeading();
  const optional = new Set(['phone', 'slot']);
  const controls = fields.map((field) => {
    const name = escapeHtml(field);
    const fieldId = `${ctx.id}--${name}`;
    const label = escapeHtml(FIELD_LABELS[field] ?? field);
    const required = optional.has(field) ? '' : ' required';
    const control = field === 'message'
      ? `<textarea id="${fieldId}" name="${name}" rows="5"${required}></textarea>`
      : `<input id="${fieldId}" name="${name}" type="${fieldType(field)}" autocomplete="${autocomplete(field)}"${required}>`;
    return `<div class="rs-field rs-field--${name}"><label for="${fieldId}">${label}${optional.has(field) ? ' <span class="rs-optional">(optional)</span>' : ''}</label>${control}</div>`;
  });
  return [
    sectionOpen(ctx, 'lead'),
    '<div class="rs-container rs-lead__grid">',
    '<div class="rs-lead__intro">',
    `<${heading}>${escapeHtml(c.heading ?? 'Kontakt')}</${heading}>`,
    typeof c.intro === 'string' && c.intro.trim() !== '' ? `<p class="rs-lead__text">${escapeHtml(c.intro)}</p>` : '',
    typeof c.legalBasis === 'string' ? `<p class="rs-note">Rechtsgrundlage der Verarbeitung: ${escapeHtml(c.legalBasis)}.${privacyHref ? ` <a href="${privacyHref}">Datenschutzerklärung</a>` : ''}</p>` : '',
    '</div>',
    `<form class="rs-card rs-form" method="post"${target ? ` action="${target}"` : ' data-target-missing="true"'}${mailto ? ' enctype="text/plain"' : ''}${attr('data-legal-basis', c.legalBasis)}>`,
    `<div class="rs-form__fields">${controls.join('')}</div>`,
    typeof c.consentText === 'string' && c.consentText.trim() !== ''
      ? `<div class="rs-consent"><input id="${ctx.id}--consent" name="consent" type="checkbox" required><label for="${ctx.id}--consent">${escapeHtml(c.consentText)}</label></div>`
      : '',
    `<button type="submit" class="rs-btn rs-btn--primary rs-btn--block">${escapeHtml(typeof c.submitLabel === 'string' && c.submitLabel.trim() !== '' ? c.submitLabel : 'Absenden')}</button>`,
    '</form>',
    '</div>',
    '</section>',
  ].filter((l) => l !== '').join('\n');
}

/**
 * Anfahrt ohne eingebettete Karte. Eine Karte käme von einem Fremd-Host
 * und bräuchte eine Einwilligungsverwaltung, die eine statische Seite nicht
 * mitbringt — ein „Karte laden"-Knopf ohne sie wäre ein Knopf, der nichts
 * tut. Stattdessen: Anschrift und ein Link zur Routenplanung. Übertragen
 * wird erst, wenn jemand ihn anklickt.
 */
function map(ctx: Ctx): string {
  const hosts = ctx.block.thirdPartyHosts.join(' ');
  const category = escapeHtml(ctx.content.consentCategory ?? 'extern');
  const address = addressOf(ctx.blueprint);
  const route = address ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}` : null;
  return [
    `<section id="${ctx.id}" class="rs-section rs-map" data-consent-required="${category}"${attr('data-consent-src', hosts)}>`,
    '<div class="rs-container">',
    `<div class="rs-card rs-map__gate"><h2>${escapeHtml(ctx.content.heading ?? 'Anfahrt')}</h2>`,
    address ? `<p class="rs-map__address">${escapeHtml(address)}</p>` : '',
    '<p>Eine eingebettete Karte laden wir nicht — sie würde beim Aufruf Daten an einen Kartendienst übertragen. Die Route planen Sie direkt beim Anbieter.</p>',
    route ? `<a class="rs-btn rs-btn--secondary" href="${escapeHtml(route)}" target="_blank" rel="noopener noreferrer">Route planen</a>` : '',
    '</div>',
    '</div>',
    '</section>',
  ].filter((l) => l !== '').join('\n');
}

function addressOf(blueprint: SiteBlueprint): string | null {
  for (const page of blueprint.pages) {
    for (const block of page.blocks) {
      if (block.kind === 'contact-info' && typeof block.content.address === 'string' && block.content.address.trim() !== '') return block.content.address.trim();
    }
  }
  return null;
}

/**
 * Aussagen über die Site selbst — aus ihrer Struktur abgeleitet, damit sie
 * stimmen: Rechtsgrundlagen der Formulare, Einwilligungsschranken,
 * KI-Kennzeichnung. Nichts, was der Renderer nicht selbst garantiert.
 */
export function governanceFacts(blueprint: SiteBlueprint, branch: 'designed' | 'minimal' = 'designed'): string[] {
  const blocks = blueprint.pages.flatMap((p) => p.blocks).filter((b) => b.content.hidden !== true);
  const facts: string[] = [];
  const forms = blocks.filter((b) => b.kind === 'contact-form' || b.kind === 'booking');
  if (forms.length > 0) {
    const bases = [...new Set(forms.map((b) => b.content.legalBasis).filter((v): v is string => typeof v === 'string'))];
    facts.push(`Anfragen über das Formular: Verarbeitung auf Grundlage von ${bases.join(', ')}; der Hinweis zur Datenschutzerklärung steht am Formular.`);
  }
  // Der gestaltete Zweig bettet keine Karten ein (siehe `map`); der
  // Kern-Renderer setzt sie hinter eine Einwilligungsschranke.
  const gated = branch === 'minimal' ? blocks.filter((b) => b.thirdPartyHosts.length > 0 && b.content.requiresConsent === true) : [];
  const imageHosts = branch === 'designed' ? heroImageHosts(blocks) : [];
  if (gated.length > 0) facts.push('Externe Inhalte wie Karten werden erst nach Ihrer Einwilligung geladen.');
  if (imageHosts.length > 0) facts.push(`Bilder werden von ${imageHosts.join(', ')} geladen.`);
  if (gated.length === 0 && imageHosts.length === 0) facts.push('Diese Seite lädt beim Aufruf keine Inhalte externer Anbieter.');
  if (blocks.some((b) => b.kind === 'ai-disclosure')) facts.push('Mit KI erstellte Inhalte sind gekennzeichnet (Art. 50 EU AI Act).');
  return facts;
}

/** Hosts der Bilder, die der gestaltete Hero tatsächlich ausliefert (siehe `heroMedia`). */
function heroImageHosts(blocks: SiteBlock[]): string[] {
  const hosts = new Set<string>();
  for (const block of blocks) {
    if (block.kind !== 'hero') continue;
    const media = block.content.media as { src?: unknown; alt?: unknown; rightsConfirmed?: unknown } | undefined;
    if (!media || media.rightsConfirmed !== true || typeof media.src !== 'string' || typeof media.alt !== 'string' || media.alt.trim() === '') continue;
    try {
      const url = new URL(media.src);
      if (url.protocol === 'https:' || url.protocol === 'http:') hosts.add(url.hostname);
    } catch {
      // Relative oder ungültige Adressen laden nichts von außen.
    }
  }
  return [...hosts].sort();
}

function governance(ctx: Ctx): string {
  const facts = governanceFacts(ctx.blueprint);
  const heading = ctx.nextHeading();
  return [
    `<section id="${ctx.id}" class="rs-section rs-governance">`,
    '<div class="rs-container">',
    `<div class="rs-gov">${SHIELD_ICON}<div><${heading}>${escapeHtml(ctx.content.heading ?? 'Datenschutz & Transparenz')}</${heading}><ul>${facts.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul></div></div>`,
    '</div>',
    '</section>',
  ].join('\n');
}

function automation(ctx: Ctx): string {
  const steps = list(ctx.content.steps).filter((s) => typeof s.label === 'string' && s.label.trim() !== '');
  if (steps.length === 0) return '';
  return [
    sectionOpen(ctx, 'automation'),
    '<div class="rs-container">',
    head(ctx, 'Was nach Ihrer Anfrage passiert'),
    `<ol class="rs-steps">${steps.map((s, i) => `<li class="rs-step"><span class="rs-step__num" aria-hidden="true">${i + 1}</span><h3>${escapeHtml(s.label)}</h3>${typeof s.text === 'string' && s.text.trim() !== '' ? `<p>${escapeHtml(s.text)}</p>` : ''}</li>`).join('')}</ol>`,
    '</div>',
    '</section>',
  ].join('\n');
}

function cta(ctx: Ctx): string {
  const href = safeUrl(ctx.content.href);
  const strong = ctx.blueprint.design?.ctaEmphasis === 'strong';
  return [
    `<section id="${ctx.id}" class="rs-cta${strong ? ' rs-cta--strong' : ''}">`,
    '<div class="rs-container rs-cta__inner">',
    `<h2>${escapeHtml(ctx.content.headline ?? '')}</h2>`,
    href ? `<a class="rs-btn ${strong ? 'rs-btn--inverse' : 'rs-btn--primary'} rs-btn--lg" href="${href}">${escapeHtml(ctx.content.label ?? ctx.content.headline ?? 'Kontakt')}${ARROW_ICON}</a>` : '',
    '</div>',
    '</section>',
  ].filter((l) => l !== '').join('\n');
}

const LEGAL_HEADINGS: Readonly<Record<string, string>> = Object.freeze({
  'legal:impressum': 'Impressum',
  'legal:privacy-policy': 'Datenschutzerklärung',
  'legal:accessibility-statement': 'Erklärung zur Barrierefreiheit',
  'legal:terms': 'Allgemeine Geschäftsbedingungen',
  'legal:withdrawal': 'Widerrufsbelehrung',
});

function legalText(ctx: Ctx): string {
  const heading = ctx.nextHeading();
  return [
    `<section id="${ctx.id}" class="rs-section rs-legal"${attr('data-legal-document', ctx.content.documentRef)}>`,
    `<div class="rs-container rs-legal__wrap"><${heading}>${escapeHtml(LEGAL_HEADINGS[String(ctx.content.documentRef)] ?? 'Rechtliche Hinweise')}</${heading}>`,
    // Wortlaut nur, wenn der Verantwortliche ihn eingesetzt hat — der
    // Renderer erfindet keinen Rechtstext.
    textBlockHtml(ctx.content.body) ?? '<!-- legal:content -->',
    '</div>',
    '</section>',
  ].join('\n');
}

function aiDisclosure(ctx: Ctx): string {
  return [
    `<aside id="${ctx.id}" class="rs-ai" data-ai-disclosure${attr('data-ai-model', ctx.content.model)}>`,
    `<div class="rs-container"><p>${escapeHtml(ctx.content.text ?? '')}</p></div>`,
    '</aside>',
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────
// Hilfen
// ─────────────────────────────────────────────────────────────────────

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null) : [];
}

function linkOrText(href: unknown, text: unknown): string {
  const safe = safeUrl(href);
  return safe ? `<a href="${safe}">${escapeHtml(text)}</a>` : escapeHtml(text);
}

const OPENING_QUOTES = new Set(['„', '"', '“', '»', '«', "'"]);
const CLOSING_QUOTES = new Set(['“', '"', '”', '«', '»', "'"]);

/** Anführungszeichen außen entfernen — als Schleife, nicht als Regex (linear bei langen Folgen). */
function stripQuotes(value: unknown): string {
  const text = String(value ?? '').trim();
  let start = 0;
  let end = text.length;
  while (start < end && OPENING_QUOTES.has(text[start])) start += 1;
  while (end > start && CLOSING_QUOTES.has(text[end - 1])) end -= 1;
  return text.slice(start, end).trim();
}

function emphasisOf(value: unknown): string | undefined {
  return value === 'tall' || value === 'compact' ? value : undefined;
}

function fieldType(field: string): string {
  switch (field) {
    case 'email': return 'email';
    case 'phone': return 'tel';
    case 'slot': return 'datetime-local';
    default: return 'text';
  }
}

function autocomplete(field: string): string {
  switch (field) {
    case 'name': return 'name';
    case 'email': return 'email';
    case 'phone': return 'tel';
    default: return 'off';
  }
}
