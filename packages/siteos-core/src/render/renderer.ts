// Blueprint → HTML.
//
// Schließt die Lücke zwischen „geprüfter Beschreibung" und „auslieferbarer
// Seite". Der Renderer ist deterministisch und abhängigkeitsfrei: gleicher
// Blueprint ⇒ byte-gleiches HTML. Damit ist auch das Auslieferungsartefakt
// hashbar und gehört in dieselbe Nachweiskette wie der Blueprint.
//
// Der Renderer ist die Stelle, an der die Compliance-Zusagen des Blueprints
// tatsächlich eingelöst werden. Was hier nicht ausgeliefert wird, existiert
// für einen Prüfer nicht — deshalb ist er so gebaut, dass sein Ergebnis die
// Live-Analysatoren (analysis/observation.ts) besteht:
//
//   • `lang` am <html>                    → accessibility.missing-lang
//   • <title> + meta[description]         → seo.*-not-delivered
//   • genau eine <h1>                     → seo.missing-h1 / seo.multiple-h1
//   • link[rel=canonical]                 → seo.missing-canonical
//   • Footer-Links auf Impressum/Datenschutz → gdpr.*-link-not-delivered
//   • data-ai-disclosure bei generiertem Inhalt → eu-ai-act.disclosure-*
//   • alt an jedem <img>                  → accessibility.image-without-alt
//   • <label> an jedem Eingabefeld        → accessibility.form-without-labels
//   • Drittanbieter erst nach Einwilligung → tdddg.third-party-before-consent
//
// Diese Kopplung ist in test/siteos/render.test.ts abgesichert: der
// gerenderte Output wird durch `analyzeObservation` geschickt.

import type { SiteBlock, SiteBlueprint, SitePage } from '../types.ts';
import { attr, escapeHtml, jsonLdPayload, safeUrl, textBlockHtml } from './escape.ts';
import { renderThemeCss } from './theme.ts';
import { renderPresentationCss, type PresentationLevel } from './presentation.ts';
import { renderDesignCss } from './design.ts';
import { designedUsesPageHeading, governanceFacts, renderDesignedBlock } from './designed.ts';

export interface RenderOptions {
  /**
   * Basis-URL der Site. Nötig für Canonical-Links und JSON-LD. Ohne Angabe
   * werden relative Canonicals gesetzt — gültig, aber schwächer.
   */
  baseUrl?: string;
  /**
   * Darstellungsstufe. `minimal` (Default) hält das Ergebnis byte-stabil und
   * ist die Grundlage der Artefakt-Hashes. `showcase` hängt die Layoutschicht
   * aus `presentation.ts` an — dieselbe Struktur, gestaltet.
   *
   * Der Default bleibt bewusst `minimal`: Ein Aufrufer, der die Optik nicht
   * anfordert, darf sie nicht ungefragt in seinem Hash wiederfinden.
   */
  presentation?: PresentationLevel;
}

export interface RenderedPage {
  path: string;
  html: string;
}

/** Rendert alle Seiten des Blueprints. Reihenfolge folgt dem Blueprint. */
export function renderSite(blueprint: SiteBlueprint, options: RenderOptions = {}): RenderedPage[] {
  return blueprint.pages.map((page) => ({
    path: page.path,
    html: renderPage(blueprint, page, options),
  }));
}

export function renderPage(blueprint: SiteBlueprint, page: SitePage, options: RenderOptions = {}): string {
  const lang = escapeHtml(blueprint.locales.default);
  const title = escapeHtml(page.path === '/' ? blueprint.seo.defaultTitle : `${page.title} — ${blueprint.name}`);
  const description = escapeHtml(page.description || blueprint.seo.defaultDescription);
  const canonical = canonicalUrl(page.path, options.baseUrl);

  // Genau eine H1 je Seite: der erste Block, der eine Überschrift führen
  // darf, bekommt sie — alle weiteren rendern H2. Ohne diese Buchführung
  // erzeugt eine Seite mit Hero UND Services zwei H1.
  const state: RenderState = { h1Used: false };

  const body = renderBlocksWithState(blueprint, page.blocks, state).map((b) => b.html).join('\n');

  return [
    '<!doctype html>',
    `<html lang="${lang}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title}</title>`,
    `<meta name="description" content="${description}">`,
    `<link rel="canonical" href="${canonical}">`,
    page.noindex ? '<meta name="robots" content="noindex">' : '',
    renderStructuredData(blueprint, page, options),
    // Inline statt externer Datei: das Stylesheet ist klein, und ein
    // eigener Request würde die erste Darstellung verzögern. Die Werte
    // sind in theme.ts geprüft, nicht escaped — CSS kennt kein Escaping.
    `<style>${renderThemeCss(blueprint.theme)}</style>`,
    // Die Layoutschicht folgt dem Kern-Stylesheet und überschreibt dessen
    // Grundregeln — nie umgekehrt. Sonst gewänne die Optik gegen die
    // Lesbarkeits- und Fokusregeln, die geprüft werden.
    //
    // Trägt der Blueprint ein Design-System (Rebuild), tritt dessen
    // Stylesheet an die Stelle der generischen Layoutschicht — es gehört zu
    // dem gestalteten Markup, das dann gerendert wird.
    options.presentation === 'showcase'
      ? `<style>${blueprint.design ? renderDesignCss(blueprint.design) : renderPresentationCss(blueprint.theme)}</style>`
      : '',
    '</head>',
    '<body>',
    // Sprungmarke zum Inhalt (WCAG 2.2 — 2.4.1).
    '<a class="skip-link" href="#inhalt">Zum Inhalt springen</a>',
    body,
    '</body>',
    '</html>',
  ].filter((line) => line !== '').join('\n');
}

interface RenderState {
  h1Used: boolean;
}

/** Ein gerenderter Block, wie er im Seitenrumpf steht. */
export interface RenderedBlock {
  id: string;
  html: string;
  /**
   * Welche Überschriftenebene der Block bekommen hat. `null`, wenn der Block
   * keine Seitenüberschrift führt (Navigation, Karte, CTA, Hinweis, Fuß)
   * oder nichts gerendert hat (leere Referenzliste).
   */
  heading: 'h1' | 'h2' | null;
}

/**
 * Rendert die Blöcke einer Seite einzeln, mit derselben H1-Buchführung wie
 * `renderPage`: aneinandergehängt ergeben die Fragmente byte-gleich den
 * Seitenrumpf. Gedacht für Oberflächen, die Blöcke einzeln zeigen müssen
 * (der Block-Editor), ohne dass dort ein zweiter Renderer entsteht — der
 * wäre die Stelle, an der Vorschau und Auslieferung auseinanderliefen.
 */
export function renderPageBlocks(blueprint: SiteBlueprint, page: SitePage): RenderedBlock[] {
  return renderBlocksWithState(blueprint, page.blocks, { h1Used: false });
}

/**
 * Rendert einen einzelnen Block mit vorgegebener Überschriftenebene. Für
 * Vorschauen, die einen Block außerhalb seiner Seite darstellen; die Ebene
 * kommt dann aus `renderPageBlocks` der aktuellen Seite.
 */
export function renderBlockHtml(blueprint: SiteBlueprint, block: SiteBlock, heading: 'h1' | 'h2'): string {
  if (isHidden(block)) return '';
  const state: RenderState = { h1Used: heading === 'h2' };
  if (blueprint.design) return renderDesignedBlock(blueprint, block, () => headingTag(state) as 'h1' | 'h2', 'base');
  return renderBlock(blueprint, block, state);
}

function renderBlocksWithState(blueprint: SiteBlueprint, blocks: SiteBlock[], state: RenderState): RenderedBlock[] {
  let contentSections = 0;
  return blocks.map((block) => {
    const before = state.h1Used;
    let html: string;
    if (isHidden(block)) {
      // Ausgeblendet: nicht ausgeliefert, verbraucht keine Überschrift.
      html = '';
    } else if (blueprint.design) {
      // Abwechselnde Flächen im Modus `banded` — deterministisch aus der
      // Reihenfolge, damit gleicher Blueprint gleiches Markup ergibt.
      const tone = BANDED_KINDS.has(block.kind) ? (contentSections++ % 2 === 1 ? 'alt' : 'base') : 'base';
      html = renderDesignedBlock(blueprint, block, () => headingTag(state) as 'h1' | 'h2', tone);
    } else {
      html = renderBlock(blueprint, block, state);
    }
    // Die Ebene ergibt sich aus der Buchführung, nicht aus dem Block-Typ:
    // Der erste Block, der eine Überschrift setzt, kippt `h1Used`.
    const usesHeading = blueprint.design ? designedUsesPageHeading(block) : usesPageHeading(block);
    const heading: RenderedBlock['heading'] = html === '' || !usesHeading
      ? null
      : state.h1Used !== before ? 'h1' : 'h2';
    return { id: block.id, html, heading };
  });
}

/** Blockarten, die im Modus `banded` abwechselnd auf der zweiten Fläche stehen. */
const BANDED_KINDS: ReadonlySet<SiteBlock['kind']> = new Set([
  'services', 'features', 'problem-solution', 'process', 'pricing', 'testimonials', 'case-study', 'about', 'team',
  'faq', 'contact-info', 'contact-form', 'booking', 'automation',
]);

/** Angeheftete Blöcke lassen sich nicht ausblenden (Navigation, Fuß, Rechtstexte, KI-Hinweis). */
function isHidden(block: SiteBlock): boolean {
  if (block.kind === 'navigation' || block.kind === 'footer' || block.kind === 'legal-text' || block.kind === 'ai-disclosure') return false;
  return (block.content as { hidden?: unknown }).hidden === true;
}

/** Blocktypen, deren Überschrift über `headingTag` vergeben wird. */
function usesPageHeading(block: SiteBlock): boolean {
  switch (block.kind) {
    case 'hero': case 'services': case 'features': case 'about': case 'team':
    case 'testimonials': case 'faq': case 'contact-form': case 'booking': case 'legal-text':
    case 'problem-solution': case 'process': case 'pricing': case 'case-study': case 'contact-info':
    case 'governance': case 'automation':
      return true;
    default:
      return false;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Blöcke
// ─────────────────────────────────────────────────────────────────────

function renderBlock(blueprint: SiteBlueprint, block: SiteBlock, state: RenderState): string {
  const id = escapeHtml(block.id);
  const content = block.content as Record<string, unknown>;

  switch (block.kind) {
    case 'navigation': {
      // Seitenlinks sind optional: Blueprints aus früheren Ständen führen
      // sie nicht, und ein leeres <ul> wäre für Screenreader eine leere
      // Liste statt gar keiner. Fehlen sie, bleibt die Ausgabe unverändert.
      const links = Array.isArray(content.links) ? content.links : [];
      const items = links
        .map((link) => {
          const entry = link as { label?: unknown; href?: unknown };
          const href = safeUrl(entry.href);
          return href ? `<li><a href="${href}">${escapeHtml(entry.label ?? '')}</a></li>` : '';
        })
        .filter((l) => l !== '');

      return [
        `<header id="${id}">`,
        '<nav aria-label="Hauptnavigation">',
        `<a href="/">${escapeHtml(content.brand ?? blueprint.name)}</a>`,
        ...(items.length > 0 ? ['<ul>', ...items, '</ul>'] : []),
        '</nav>',
        '</header>',
        // Der Inhaltsanker sitzt direkt hinter der Navigation.
        '<main id="inhalt">',
      ].join('\n');
    }

    case 'hero': {
      const heading = headingTag(state);
      const media = content.media as { alt?: unknown; ratio?: unknown } | undefined;
      const cta = content.primaryCta as { label?: unknown; href?: unknown } | undefined;
      const ctaHref = cta ? safeUrl(cta.href) : null;

      // `data-emphasis` steuert die Höhe des Heroes in der Layoutschicht.
      // Der Wert stammt aus einer festen Liste, nicht aus dem Blueprint:
      // Er landet als Attribut im ausgelieferten HTML, und was dort landet,
      // wird nicht durchgereicht.
      // Fehlt es (Default), ist die Ausgabe unverändert — das Attribut wird
      // nur gesetzt, wenn der Blueprint es tatsächlich führt.
      return [
        `<section id="${id}"${attr('data-emphasis', heroEmphasis(content.emphasis))}>`,
        `<${heading}>${escapeHtml(content.headline ?? blueprint.name)}</${heading}>`,
        content.subline ? `<p>${escapeHtml(content.subline)}</p>` : '',
        // Platzhalter statt <img src>: es gibt noch kein Bild mit geklärter
        // Rechtelage. Der Alternativtext wird trotzdem gesetzt, damit die
        // Auszeichnung beim späteren Einsetzen schon stimmt.
        media
          ? `<div role="img"${attr('aria-label', media.alt)}${attr('data-ratio', media.ratio)} data-placeholder="true"></div>`
          : '',
        ctaHref ? `<a href="${ctaHref}">${escapeHtml(cta?.label ?? 'Kontakt')}</a>` : '',
        '</section>',
      ].filter((l) => l !== '').join('\n');
    }

    case 'services':
    case 'features': {
      const heading = headingTag(state);
      const items = Array.isArray(content.items) ? content.items : [];
      return [
        `<section id="${id}">`,
        `<${heading}>${escapeHtml(content.heading ?? '')}</${heading}>`,
        '<ul>',
        ...items.map((item) => {
          const entry = item as { label?: unknown; description?: unknown };
          const label = escapeHtml(entry.label ?? '');
          const desc = entry.description ? ` <span>${escapeHtml(entry.description)}</span>` : '';
          return `<li><strong>${label}</strong>${desc}</li>`;
        }),
        '</ul>',
        '</section>',
      ].join('\n');
    }

    case 'about': {
      const heading = headingTag(state);
      return [
        `<section id="${id}">`,
        `<${heading}>${escapeHtml(content.heading ?? 'Über uns')}</${heading}>`,
        `<p>${escapeHtml(content.body ?? '')}</p>`,
        '</section>',
      ].join('\n');
    }

    case 'team': {
      const heading = headingTag(state);
      const members = Array.isArray(content.members) ? content.members : [];
      return [
        `<section id="${id}">`,
        `<${heading}>${escapeHtml(content.heading ?? 'Team')}</${heading}>`,
        ...members.map((m) => `<p>${escapeHtml((m as { name?: unknown }).name ?? '')}</p>`),
        '</section>',
      ].join('\n');
    }

    case 'testimonials': {
      const items = Array.isArray(content.items) ? content.items : [];
      // Leere Bewertungslisten werden NICHT gerendert. Eine Überschrift
      // „Stimmen" ohne Stimmen darunter suggeriert Referenzen, die es nicht
      // gibt (§ 5 UWG).
      if (items.length === 0) return '';
      const heading = headingTag(state);
      return [
        `<section id="${id}">`,
        `<${heading}>${escapeHtml(content.heading ?? 'Stimmen')}</${heading}>`,
        ...items.map((item) => `<blockquote>${escapeHtml((item as { quote?: unknown }).quote ?? '')}</blockquote>`),
        '</section>',
      ].join('\n');
    }

    case 'faq': {
      const heading = headingTag(state);
      const items = Array.isArray(content.items) ? content.items : [];
      return [
        `<section id="${id}">`,
        `<${heading}>${escapeHtml(content.heading ?? 'Häufige Fragen')}</${heading}>`,
        ...items
          // Fragen ohne Antwort werden ausgelassen statt leer gerendert.
          .filter((item) => (item as { answer?: unknown }).answer)
          .map((item) => {
            const entry = item as { question?: unknown; answer?: unknown };
            return `<details><summary>${escapeHtml(entry.question)}</summary><p>${escapeHtml(entry.answer)}</p></details>`;
          }),
        '</section>',
      ].join('\n');
    }

    case 'contact-form':
    case 'booking':
      return renderForm(id, content, headingTag(state));

    case 'map':
      return renderConsentGate(id, block, content);

    case 'cta': {
      const href = safeUrl(content.href);
      return [
        `<section id="${id}">`,
        `<h2>${escapeHtml(content.headline ?? '')}</h2>`,
        href ? `<a href="${href}">${escapeHtml(content.headline ?? 'Kontakt')}</a>` : '',
        '</section>',
      ].filter((l) => l !== '').join('\n');
    }

    case 'legal-text': {
      const heading = headingTag(state);
      // Rechtstexte werden zur Build-Zeit aus dem Legal-Modul eingesetzt.
      // Der Renderer markiert nur die Stelle — er erfindet keinen Rechtstext.
      // Ist ein Wortlaut hinterlegt (vom Verantwortlichen eingesetzt), steht
      // er an dieser Stelle; ohne ihn bleibt die Markierung — unverändert
      // für alle bisherigen Blueprints.
      return [
        `<section id="${id}"${attr('data-legal-document', content.documentRef)}>`,
        `<${heading}>${escapeHtml(legalHeading(content.documentRef))}</${heading}>`,
        textBlockHtml(content.body) ?? '<!-- legal:content -->',
        '</section>',
      ].join('\n');
    }

    case 'ai-disclosure':
      // Das Attribut ist der maschinenlesbare Anker, auf den die
      // Live-Analyse prüft (Art. 50 EU AI Act).
      return [
        `<aside id="${id}" data-ai-disclosure${attr('data-ai-model', content.model)}>`,
        `<p>${escapeHtml(content.text ?? '')}</p>`,
        '</aside>',
      ].join('\n');

    case 'footer': {
      const links = Array.isArray(content.legalLinks) ? content.legalLinks : [];
      return [
        // Schließt das <main> aus dem navigation-Block.
        '</main>',
        `<footer id="${id}">`,
        '<nav aria-label="Rechtliches">',
        '<ul>',
        ...links.map((link) => {
          const entry = link as { label?: unknown; href?: unknown };
          const href = safeUrl(entry.href);
          return href ? `<li><a href="${href}">${escapeHtml(entry.label ?? '')}</a></li>` : '';
        }).filter((l) => l !== ''),
        '</ul>',
        '</nav>',
        '</footer>',
      ].join('\n');
    }

    // ── Rebuild-Komponenten im Grundmarkup ─────────────────────────
    // Für Blueprints ohne Design-System (z. B. im Editor ergänzt). Leere
    // Blöcke werden wie leere Kundenstimmen nicht ausgeliefert.
    case 'trust-bar': {
      const items = listOf(content.items).map((i) => i.label).filter((l): l is string => typeof l === 'string' && l.trim() !== '');
      if (items.length === 0) return '';
      return [`<section id="${id}" aria-label="Vertrauen und Nachweise">`, '<ul>', ...items.map((l) => `<li>${escapeHtml(l)}</li>`), '</ul>', '</section>'].join('\n');
    }

    case 'problem-solution': {
      const heading = headingTag(state);
      const points = listOf(content.points).map((p) => p.label).filter((l): l is string => typeof l === 'string' && l.trim() !== '');
      return [
        `<section id="${id}">`,
        `<${heading}>${escapeHtml(content.problem ?? content.heading ?? '')}</${heading}>`,
        content.solution ? `<p>${escapeHtml(content.solution)}</p>` : '',
        points.length > 0 ? ['<ul>', ...points.map((l) => `<li>${escapeHtml(l)}</li>`), '</ul>'].join('\n') : '',
        '</section>',
      ].filter((l) => l !== '').join('\n');
    }

    case 'process':
    case 'automation': {
      const key = block.kind === 'process' ? 'title' : 'label';
      const steps = listOf(content.steps).map((s) => s[key]).filter((l): l is string => typeof l === 'string' && l.trim() !== '');
      if (steps.length === 0) return '';
      const heading = headingTag(state);
      return [`<section id="${id}">`, `<${heading}>${escapeHtml(content.heading ?? '')}</${heading}>`, '<ol>', ...steps.map((l) => `<li>${escapeHtml(l)}</li>`), '</ol>', '</section>'].join('\n');
    }

    case 'pricing': {
      const items = listOf(content.items).filter((i) => typeof i.price === 'string' && i.price.trim() !== '');
      if (items.length === 0) return '';
      const heading = headingTag(state);
      return [
        `<section id="${id}">`,
        `<${heading}>${escapeHtml(content.heading ?? 'Preise')}</${heading}>`,
        '<ul>',
        ...items.map((i) => `<li><strong>${escapeHtml(i.label ?? '')}</strong> <span>${escapeHtml(i.price)}</span></li>`),
        '</ul>',
        content.note ? `<p>${escapeHtml(content.note)}</p>` : '',
        '</section>',
      ].filter((l) => l !== '').join('\n');
    }

    case 'case-study': {
      const items = listOf(content.items).filter((i) => typeof i.title === 'string' && typeof i.text === 'string');
      if (items.length === 0) return '';
      const heading = headingTag(state);
      return [
        `<section id="${id}">`,
        `<${heading}>${escapeHtml(content.heading ?? 'Referenzen')}</${heading}>`,
        ...items.map((i) => `<article><h3>${escapeHtml(i.title)}</h3><p>${escapeHtml(i.text)}</p></article>`),
        '</section>',
      ].join('\n');
    }

    case 'contact-info': {
      const lines = [
        typeof content.phone === 'string' ? (safeUrl(content.phoneHref) ? `<a href="${safeUrl(content.phoneHref)}">${escapeHtml(content.phone)}</a>` : escapeHtml(content.phone)) : '',
        typeof content.email === 'string' ? `<a href="mailto:${escapeHtml(content.email)}">${escapeHtml(content.email)}</a>` : '',
        typeof content.address === 'string' ? escapeHtml(content.address) : '',
        typeof content.hours === 'string' ? escapeHtml(content.hours) : '',
      ].filter((l) => l !== '');
      if (lines.length === 0) return '';
      const heading = headingTag(state);
      return [`<section id="${id}">`, `<${heading}>${escapeHtml(content.heading ?? 'Kontakt')}</${heading}>`, `<address>${lines.join('<br>')}</address>`, '</section>'].join('\n');
    }

    case 'governance': {
      const heading = headingTag(state);
      return [
        `<section id="${id}">`,
        `<${heading}>${escapeHtml(content.heading ?? 'Datenschutz & Transparenz')}</${heading}>`,
        '<ul>',
        ...governanceFacts(blueprint, 'minimal').map((f) => `<li>${escapeHtml(f)}</li>`),
        '</ul>',
        '</section>',
      ].join('\n');
    }
  }
}

function listOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null) : [];
}

function renderForm(id: string, content: Record<string, unknown>, heading: string): string {
  const fields = Array.isArray(content.fields) ? content.fields : [];
  const privacyHref = safeUrl(content.privacyHref);

  return [
    `<section id="${id}">`,
    `<${heading}>${escapeHtml(content.heading ?? 'Kontakt')}</${heading}>`,
    `<form method="post"${attr('data-legal-basis', content.legalBasis)}>`,
    ...fields.map((field) => {
      const name = escapeHtml(field);
      const fieldId = `${id}--${name}`;
      // Jedes Feld bekommt ein verbundenes <label> — ohne das ist das
      // Formular mit Screenreader nicht bedienbar (WCAG 2.2 — 3.3.2).
      return [
        `<label for="${fieldId}">${escapeHtml(fieldLabel(String(field)))}</label>`,
        `<input id="${fieldId}" name="${name}" type="${escapeHtml(fieldType(String(field)))}" required>`,
      ].join('\n');
    }),
    content.consentText
      ? [
          `<label for="${id}--consent">${escapeHtml(content.consentText)}</label>`,
          `<input id="${id}--consent" name="consent" type="checkbox" required>`,
        ].join('\n')
      : '',
    privacyHref ? `<p><a href="${privacyHref}">Datenschutzerklärung</a></p>` : '',
    '<button type="submit">Absenden</button>',
    '</form>',
    '</section>',
  ].filter((l) => l !== '').join('\n');
}

/**
 * Drittanbieter-Einbindung hinter einer Einwilligungsschranke.
 *
 * Entscheidend ist, was NICHT im Markup steht: kein iframe, kein src auf
 * den Fremd-Host. Der Host wird nur als `data-consent-src` hinterlegt und
 * erst nach erteilter Einwilligung per Skript nachgeladen. Damit kontaktiert
 * der bloße Seitenaufruf keinen Dritten (§ 25 Abs. 1 TDDDG).
 */
function renderConsentGate(id: string, block: SiteBlock, content: Record<string, unknown>): string {
  const hosts = block.thirdPartyHosts.join(' ');
  const category = escapeHtml(content.consentCategory ?? 'extern');

  return [
    `<section id="${id}" data-consent-required="${category}"${attr('data-consent-src', hosts)}>`,
    `<h2>${escapeHtml(content.heading ?? 'Externer Inhalt')}</h2>`,
    '<p>',
    `Dieser Inhalt wird von einem externen Anbieter geladen (${escapeHtml(hosts)}). `,
    'Er wird erst nach Ihrer Einwilligung übertragen.',
    '</p>',
    `<button type="button" data-consent-accept="${category}">Inhalt laden</button>`,
    '</section>',
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────
// Kopfbereich
// ─────────────────────────────────────────────────────────────────────

function renderStructuredData(blueprint: SiteBlueprint, page: SitePage, options: RenderOptions): string {
  if (page.path !== '/') return '';
  if (blueprint.seo.structuredDataType.trim() === '') return '';

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': blueprint.seo.structuredDataType,
    name: blueprint.seo.siteName,
    description: blueprint.seo.defaultDescription,
  };
  if (options.baseUrl) data.url = options.baseUrl;
  const org = blueprint.seo.organization;
  if (blueprint.seo.locality) {
    const address: Record<string, unknown> = { '@type': 'PostalAddress', addressLocality: blueprint.seo.locality };
    // Belegte Anschrift aus dem Rebuild — nur, wenn vorhanden; sonst bleibt
    // das JSON-LD bestehender Blueprints unverändert.
    if (org?.streetAddress) address.streetAddress = org.streetAddress;
    if (org?.postalCode) address.postalCode = org.postalCode;
    data.address = address;
  }
  if (org?.telephone) data.telephone = org.telephone;
  if (org?.email) data.email = org.email;
  if (org?.sameAs && org.sameAs.length > 0) data.sameAs = org.sameAs.filter((u) => safeUrl(u) !== null);

  return `<script type="application/ld+json">${jsonLdPayload(data)}</script>`;
}

// ─────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────

/** Erste Überschrift der Seite wird H1, alle weiteren H2. */
function headingTag(state: RenderState): string {
  if (state.h1Used) return 'h2';
  state.h1Used = true;
  return 'h1';
}

function canonicalUrl(path: string, baseUrl?: string): string {
  if (!baseUrl) return escapeHtml(path);
  try {
    return escapeHtml(new URL(path, baseUrl).toString());
  } catch {
    return escapeHtml(path);
  }
}

const FIELD_LABELS: Readonly<Record<string, string>> = Object.freeze({
  name: 'Name',
  email: 'E-Mail-Adresse',
  phone: 'Telefonnummer',
  message: 'Ihre Nachricht',
  slot: 'Wunschtermin',
});

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function fieldType(field: string): string {
  switch (field) {
    case 'email': return 'email';
    case 'phone': return 'tel';
    case 'slot': return 'datetime-local';
    default: return 'text';
  }
}

const LEGAL_HEADINGS: Readonly<Record<string, string>> = Object.freeze({
  'legal:impressum': 'Impressum',
  'legal:privacy-policy': 'Datenschutzerklärung',
  'legal:accessibility-statement': 'Erklärung zur Barrierefreiheit',
  'legal:terms': 'Allgemeine Geschäftsbedingungen',
  'legal:withdrawal': 'Widerrufsbelehrung',
});

function legalHeading(ref: unknown): string {
  return LEGAL_HEADINGS[String(ref)] ?? 'Rechtliche Hinweise';
}

/**
 * Prüft die Betonung des Titelbereichs gegen die erlaubten Werte.
 *
 * `undefined` heisst „kein Attribut" — damit bleibt das Markup jedes
 * Blueprints ohne Angabe unverändert.
 */
function heroEmphasis(value: unknown): string | undefined {
  return value === 'tall' || value === 'compact' ? value : undefined;
}
