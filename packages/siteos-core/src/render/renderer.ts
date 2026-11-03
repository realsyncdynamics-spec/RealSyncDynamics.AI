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
import { attr, escapeHtml, jsonLdPayload, safeUrl } from './escape.ts';
import { renderThemeCss } from './theme.ts';
import { renderPresentationCss, type PresentationLevel } from './presentation.ts';

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
  /**
   * Posteingang-Anbindung des Kontaktformulars (PR C). Nur gesetzt, wenn die
   * Seite ein `site_inbox_bindings`-Binding hat. Dann bekommt jedes
   * Formular (`contact-form`, `booking`) Endpunkt, Kennung, Honeypot und ein
   * kleines Skript, das die Eingaben als JSON an `inbox-form-submit` sendet.
   *
   * Ohne diese Option ist die Ausgabe byte-identisch zum bisherigen Stand —
   * bestehende Artefakt-Hashes bleiben gültig. `siteRef` ist der öffentliche,
   * serverseitig erzeugte Schlüssel; `tenant_id`/`bot_id` stehen nie im Markup.
   */
  inbox?: InboxFormOptions;
}

export interface InboxFormOptions {
  /** Öffentliche Formular-Kennung aus `site_inbox_bindings.site_ref` (24 Zeichen base64url). */
  siteRef: string;
  /** Absolute URL der Edge Function `inbox-form-submit`. */
  endpoint: string;
}

/** Honeypot-Feldname — identisch zu `inbox-form-submit/logic.ts`. */
export const INBOX_HONEYPOT_FIELD = 'company_website';

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
  const state: RenderState = { h1Used: false, inbox: options.inbox, inboxFormRendered: false };

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
    options.presentation === 'showcase'
      ? `<style>${renderPresentationCss(blueprint.theme)}</style>`
      : '',
    '</head>',
    '<body>',
    // Sprungmarke zum Inhalt (WCAG 2.2 — 2.4.1).
    '<a class="skip-link" href="#inhalt">Zum Inhalt springen</a>',
    body,
    // Das Skript steht nur auf Seiten, die tatsächlich ein angebundenes
    // Formular enthalten — sonst bleibt der Rumpf unverändert.
    state.inboxFormRendered ? renderInboxScript() : '',
    '</body>',
    '</html>',
  ].filter((line) => line !== '').join('\n');
}

interface RenderState {
  h1Used: boolean;
  /** Posteingang-Anbindung; undefined = Formular ohne Ziel (Bestand). */
  inbox?: InboxFormOptions;
  /** Wird gesetzt, sobald ein angebundenes Formular gerendert wurde. */
  inboxFormRendered?: boolean;
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
  return renderBlock(blueprint, block, { h1Used: heading === 'h2' });
}

function renderBlocksWithState(blueprint: SiteBlueprint, blocks: SiteBlock[], state: RenderState): RenderedBlock[] {
  return blocks.map((block) => {
    const before = state.h1Used;
    const html = renderBlock(blueprint, block, state);
    // Die Ebene ergibt sich aus der Buchführung, nicht aus dem Block-Typ:
    // Der erste Block, der eine Überschrift setzt, kippt `h1Used`.
    const heading: RenderedBlock['heading'] = html === '' || !usesPageHeading(block)
      ? null
      : state.h1Used !== before ? 'h1' : 'h2';
    return { id: block.id, html, heading };
  });
}

/** Blocktypen, deren Überschrift über `headingTag` vergeben wird. */
function usesPageHeading(block: SiteBlock): boolean {
  switch (block.kind) {
    case 'hero': case 'services': case 'features': case 'about': case 'team':
    case 'testimonials': case 'faq': case 'contact-form': case 'booking': case 'legal-text':
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
      if (state.inbox && hasInboxDisclosure(content)) state.inboxFormRendered = true;
      return renderForm(id, content, headingTag(state), state.inbox);

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
      return [
        `<section id="${id}"${attr('data-legal-document', content.documentRef)}>`,
        `<${heading}>${escapeHtml(legalHeading(content.documentRef))}</${heading}>`,
        '<!-- legal:content -->',
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
  }
}

/** Kein öffentlich angebundenes Formular ohne sichtbaren Datenschutzhinweis und Checkbox. */
function hasInboxDisclosure(content: Record<string, unknown>): boolean {
  return typeof content.consentText === 'string' && content.consentText.trim().length > 0
    && typeof content.legalBasis === 'string' && content.legalBasis.trim().length > 0
    && Boolean(safeUrl(content.privacyHref));
}

function renderForm(id: string, content: Record<string, unknown>, heading: string, inbox?: InboxFormOptions): string {
  const fields = Array.isArray(content.fields) ? content.fields : [];
  const privacyHref = safeUrl(content.privacyHref);
  const connectedInbox = inbox && hasInboxDisclosure(content) ? inbox : undefined;
  // Angebundenes Formular: Endpunkt und Kennung als data-Attribute, dazu ein
  // Honeypot-Feld (ausserhalb des sichtbaren Bereichs, für Hilfstechnik
  // verborgen) und eine Statuszeile für die Rückmeldung des Skripts.
  const inboxAttrs = connectedInbox
    ? `${attr('data-inbox-endpoint', connectedInbox.endpoint)}${attr('data-site-ref', connectedInbox.siteRef)}`
    : '';
  const honeypot = connectedInbox
    ? `<div class="inbox-hp" aria-hidden="true"><label for="${id}--hp">Firmenwebsite</label><input id="${id}--hp" name="${INBOX_HONEYPOT_FIELD}" type="text" tabindex="-1" autocomplete="off"></div>`
    : '';
  const status = connectedInbox ? `<p class="inbox-status" data-inbox-status aria-live="polite"></p>` : '';

  return [
    `<section id="${id}">`,
    `<${heading}>${escapeHtml(content.heading ?? 'Kontakt')}</${heading}>`,
    `<form method="post"${attr('data-legal-basis', content.legalBasis)}${inboxAttrs}>`,
    honeypot,
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
    status,
    inbox && !connectedInbox ? '<p role="alert">Formular-Annahme nicht freigeschaltet: Datenschutzhinweis oder Einwilligung fehlt.</p>' : '',
    inbox && !connectedInbox ? '<button type="submit" disabled>Absenden</button>' : '<button type="submit">Absenden</button>',
    '</form>',
    '</section>',
  ].filter((l) => l !== '').join('\n');
}

/**
 * Skript für angebundene Formulare. Kein Fremd-Host, keine Bibliothek, keine
 * Cookies. Es liest Endpunkt und Kennung aus dem Formular, bildet den
 * Request-Body für `inbox-form-submit` und zeigt die Rückmeldung an.
 *
 *   name/email/phone/message/slot (Blueprint-Felder)
 *     → kontakt_name / kontakt_email / kontakt_telefon / anliegen / terminwunsch
 *   consent (Pflicht-Checkbox) → einwilligung: true
 *   nonce: je Absendeversuch neu (crypto.randomUUID), macht Doppelklicks und
 *   Wiederholungen serverseitig idempotent.
 *
 * Ohne JavaScript bleibt das Formular ein gewöhnliches POST ohne Ziel — wie
 * bisher. Der Terminwunsch ist ein Wunsch; eine Bestätigung verspricht das
 * Skript nicht.
 */
function renderInboxScript(): string {
  return [
    '<style>.inbox-hp{position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden}.inbox-status:empty{display:none}</style>',
    '<script>',
    '(function(){',
    'var forms=document.querySelectorAll("form[data-inbox-endpoint]");',
    'function nonce(){return (window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+"-"+Math.random().toString(36).slice(2,14);}',
    'function val(f,n){var el=f.elements.namedItem(n);return el&&typeof el.value==="string"?el.value.trim():"";}',
    'Array.prototype.forEach.call(forms,function(f){',
    'f.addEventListener("submit",function(ev){',
    'ev.preventDefault();',
    'var st=f.querySelector("[data-inbox-status]");var btn=f.querySelector("button[type=submit]");',
    'var consent=f.elements.namedItem("consent");',
    'if(!consent||!consent.checked){if(st){st.textContent="Bitte bestätigen Sie vor dem Senden die Einwilligung.";}return;}',
    'var body={site_ref:f.getAttribute("data-site-ref"),nonce:nonce(),',
    'anliegen:val(f,"message")||val(f,"anliegen")||val(f,"nachricht"),',
    'kontakt_name:val(f,"name")||null,kontakt_email:val(f,"email")||null,kontakt_telefon:val(f,"phone")||null,',
    'terminwunsch:val(f,"slot")||val(f,"terminwunsch")||null,',
    'einwilligung:!!(consent&&consent.checked)};',
    'body["' + INBOX_HONEYPOT_FIELD + '"]=val(f,"' + INBOX_HONEYPOT_FIELD + '");',
    'if(!body.anliegen){body.anliegen=[body.kontakt_name,body.terminwunsch].filter(Boolean).join(" – ")||"Kontaktanfrage";}',
    'if(btn){btn.disabled=true;}if(st){st.textContent="Wird gesendet …";}',
    'fetch(f.getAttribute("data-inbox-endpoint"),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})',
    '.then(function(r){return r.json().catch(function(){return {};}).then(function(j){return {ok:r.ok,status:r.status,json:j};});})',
    '.then(function(res){',
    'if(res.ok){f.reset();if(st){st.textContent="Vielen Dank – Ihre Anfrage ist eingegangen. Wir melden uns.";}return;}',
    'var code=res.json&&res.json.error&&res.json.error.code;',
    'var msg=code==="RATE_LIMITED"?"Zu viele Anfragen – bitte später erneut versuchen.":code==="VALIDATION"?"Bitte Anliegen und E-Mail oder Telefon angeben und der Verarbeitung zustimmen.":"Senden derzeit nicht möglich – bitte rufen Sie uns an.";',
    'if(st){st.textContent=msg;}if(btn){btn.disabled=false;}',
    '}).catch(function(){if(st){st.textContent="Senden derzeit nicht möglich – bitte rufen Sie uns an.";}if(btn){btn.disabled=false;}});',
    '});});',
    '})();',
    '</script>',
  ].join('\n');
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
  if (blueprint.seo.locality) {
    data.address = { '@type': 'PostalAddress', addressLocality: blueprint.seo.locality };
  }

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
