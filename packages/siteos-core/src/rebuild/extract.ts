// DISCOVER — reale Website → strukturierter Import mit Belegen.
//
// Eingabe ist das rohe HTML einer Seite plus die Metadaten des Abrufs. Der
// Abruf selbst passiert **nicht** hier: Der Kern hat keinen Netzwerkzugriff
// und darf keinen haben (SSRF-Schutz und Rate-Limits liegen im Handler).
//
// ## Drei Zusagen
//
//   • Was die Quelle nicht hergibt, ist `null` bzw. `'unknown'`. Es wird
//     nichts geraten, nichts „sinnvoll vorbelegt".
//   • Jeder Fund, auf den später eine Bewertung zeigt, bekommt einen Beleg:
//     Quelle, Auszug, Zeitpunkt, Hash.
//   • Das Ergebnis ist deterministisch für dasselbe HTML und denselben
//     Zeitstempel — zwei Läufe ergeben denselben Hash.

import { sha256Hex } from '../canonical.ts';
import { detectIndustry, detectLocality } from '../blueprint/brief.ts';
import {
  cleanText,
  findTags,
  getAttr,
  hostnameOf,
  linkHrefs,
  metaContent,
  resolveUrl,
  sameSite,
  sentences,
  stripNonVisible,
  truncate,
  unique,
  visibleText,
  withoutChrome,
  wordCount,
} from './html.ts';
import {
  MAX_EVIDENCE_EXCERPT,
  type ConversionGoal,
  type Evidence,
  type EvidenceKind,
  type FormPurpose,
  type ImportedBrand,
  type ImportedCta,
  type ImportedForm,
  type ImportedFormField,
  type ImportedImage,
  type ImportedLink,
  type ImportedPositioning,
  type ImportedSeo,
  type ImportedTexts,
  type ImportedTrustSignal,
  type SiteImport,
  type TrustSignalKind,
} from './types.ts';

export interface ImportInput {
  sourceUrl: string;
  /** URL nach Weiterleitungen; ohne Angabe = sourceUrl. */
  finalUrl?: string;
  html: string;
  statusCode?: number | null;
  contentType?: string | null;
  fetchedAt: string;
}

const MAX_HTML_BYTES = 1_500_000;
const MAX_NAV_LINKS = 20;
const MAX_SITEMAP_LINKS = 60;
const MAX_PARAGRAPHS = 60;
const MAX_CTAS = 30;
const MAX_FORMS = 10;
const MAX_IMAGES = 40;
const MAX_TRUST = 20;
const MAX_COLORS = 6;
const MAX_FONTS = 4;

// ─────────────────────────────────────────────────────────────────────
// Beleg-Sammler
// ─────────────────────────────────────────────────────────────────────

interface PendingEvidence {
  id: string;
  ref: string;
  kind: EvidenceKind;
  raw: string;
}

class EvidenceCollector {
  private readonly items: PendingEvidence[] = [];
  private readonly source: string;
  private readonly observedAt: string;

  constructor(source: string, observedAt: string) {
    this.source = source;
    this.observedAt = observedAt;
  }

  add(ref: string, kind: EvidenceKind, raw: string): string {
    const id = `ev-${this.items.length + 1}`;
    this.items.push({ id, ref, kind, raw: raw.replace(/\s+/g, ' ').trim() });
    return id;
  }

  async finish(): Promise<Evidence[]> {
    return Promise.all(
      this.items.map(async (item) => ({
        id: item.id,
        ref: item.ref,
        source: this.source,
        kind: item.kind,
        excerpt: truncate(item.raw, MAX_EVIDENCE_EXCERPT),
        observedAt: this.observedAt,
        sha256: await sha256Hex(item.raw),
      })),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// Einstieg
// ─────────────────────────────────────────────────────────────────────

export async function importSite(input: ImportInput): Promise<SiteImport> {
  const html = input.html.length > MAX_HTML_BYTES ? input.html.slice(0, MAX_HTML_BYTES) : input.html;
  const finalUrl = input.finalUrl ?? input.sourceUrl;
  const ev = new EvidenceCollector(finalUrl, input.fetchedAt);
  const host = hostnameOf(finalUrl) ?? '';

  const title = orNull(cleanText(findTags(html, 'title', 1)[0]?.inner));
  const description = orNull(metaContent(html, 'description'));
  const h1Tags = findTags(html, 'h1', 20);
  const h1 = orNull(cleanText(h1Tags[0]?.inner));
  if (h1Tags[0]) ev.add('h1', 'dom', h1Tags[0].full);
  else ev.add('h1', 'derived', 'kein <h1> im Dokument');
  if (h1Tags.length > 1) ev.add('h1:count', 'derived', `${h1Tags.length} <h1>-Elemente im Dokument`);

  const headings = [...findTags(html, 'h2', 40).map((t) => ({ level: 2 as const, text: cleanText(t.inner), index: t.index })), ...findTags(html, 'h3', 40).map((t) => ({ level: 3 as const, text: cleanText(t.inner), index: t.index }))]
    .filter((h) => h.text.length > 0)
    .sort((a, b) => a.index - b.index)
    .slice(0, 30)
    .map(({ level, text }) => ({ level, text }));

  const text = visibleText(html);
  const { navigation, sitemap } = extractLinks(html, finalUrl, host);
  const texts = extractTexts(html, text);
  const ctas = extractCtas(html, finalUrl, ev);
  const forms = extractForms(html, finalUrl, ev);
  const images = extractImages(html, finalUrl);
  const trust = extractTrust(visibleText(withoutChrome(html)), ev);
  ev.add('images', 'derived', `${images.length} Bilder, davon ${images.filter((i) => i.alt === null || i.alt === '').length} ohne Alternativtext`);
  ev.add('text', 'derived', `${wordCount(text)} Wörter sichtbarer Text`);
  const brand = extractBrand(html, title, images, host);
  const seo = extractSeo(html, finalUrl, h1Tags.length);
  const thirdPartyHosts = extractThirdPartyHosts(html, finalUrl, host);
  const positioning = derivePositioning({ title, h1, description, headings: headings.map((h) => h.text), navigation, text, forms, ctas, seo });

  // Belege für Struktur-Befunde, die sonst keinen Auszug hätten.
  ev.add('title', title ? 'meta' : 'derived', title ? `<title>${title}</title>` : 'kein <title> im Dokument');
  ev.add('description', description ? 'meta' : 'derived', description ? `<meta name="description" content="${description}">` : 'keine Meta-Description im Dokument');
  ev.add('viewport', seo.hasViewport ? 'meta' : 'derived', seo.hasViewport ? '<meta name="viewport"> vorhanden' : 'kein <meta name="viewport"> im Dokument');
  ev.add('lang', seo.lang ? 'dom' : 'derived', seo.lang ? `<html lang="${seo.lang}">` : 'kein lang-Attribut am <html>');
  ev.add('canonical', seo.canonical ? 'meta' : 'derived', seo.canonical ? `<link rel="canonical" href="${seo.canonical}">` : 'kein canonical-Link');
  ev.add('og', seo.ogTitle || seo.ogImage ? 'meta' : 'derived', seo.ogTitle || seo.ogImage ? `og:title=${seo.ogTitle ?? '–'} og:image=${seo.ogImage ?? '–'}` : 'keine Open-Graph-Angaben');
  ev.add('jsonld', seo.jsonLdTypes.length ? 'dom' : 'derived', seo.jsonLdTypes.length ? `JSON-LD @type: ${seo.jsonLdTypes.join(', ')}` : 'kein JSON-LD im Dokument');
  ev.add('headings', headings.length ? 'dom' : 'derived', headings.length ? headings.map((h) => `<h${h.level}>${h.text}</h${h.level}>`).join(' ') : 'keine h2/h3-Überschriften');
  ev.add('nav', navigation.length ? 'dom' : 'derived', navigation.length ? navigation.map((l) => l.label).join(' · ') : 'keine Navigation erkannt');
  ev.add('brand', 'derived', `Farben: ${brand.colors.join(', ') || '–'}; Schriften: ${brand.fonts.join(', ') || '–'}; Logo: ${brand.logo ? brand.logo.src : '–'}`);
  ev.add('third-party', 'derived', thirdPartyHosts.length ? `Drittanbieter: ${thirdPartyHosts.join(', ')}` : 'keine Drittanbieter-Hosts');

  return {
    schemaVersion: 1,
    sourceUrl: input.sourceUrl,
    finalUrl,
    fetchedAt: input.fetchedAt,
    statusCode: input.statusCode ?? null,
    contentType: input.contentType ?? null,
    htmlSha256: await sha256Hex(html),
    htmlBytes: new TextEncoder().encode(html).length,
    title,
    description,
    h1,
    headings,
    navigation,
    sitemap,
    texts,
    ctas,
    forms,
    images,
    trust,
    brand,
    positioning,
    seo,
    thirdPartyHosts,
    evidence: await ev.finish(),
  };
}

function orNull(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  return v.length > 0 ? v : null;
}

// ─────────────────────────────────────────────────────────────────────
// Links: Navigation + beobachtbare Sitemap
// ─────────────────────────────────────────────────────────────────────

function extractLinks(html: string, base: string, host: string): { navigation: ImportedLink[]; sitemap: ImportedLink[] } {
  const anchors = findTags(stripNonVisible(html), 'a', 800);
  const toLink = (tag: { attrs: string; inner: string }): ImportedLink | null => {
    const rawHref = getAttr(tag.attrs, 'href');
    if (!rawHref) return null;
    const href = resolveUrl(rawHref, base);
    if (!href) return null;
    const label = cleanText(tag.inner) || cleanText(getAttr(tag.attrs, 'aria-label') ?? getAttr(tag.attrs, 'title') ?? '');
    if (!label) return null;
    const linkHost = hostnameOf(href);
    return { href, label: truncate(label, 80), internal: linkHost !== null && sameSite(linkHost, host) };
  };

  const navRegions = [...findTags(html, 'nav', 10), ...findTags(html, 'header', 5)];
  const navAnchors = navRegions.flatMap((region) => findTags(region.inner, 'a', 60));
  let navigation = unique(navAnchors.map(toLink).filter((l): l is ImportedLink => l !== null), (l) => l.href).slice(0, MAX_NAV_LINKS);
  const all = unique(anchors.map(toLink).filter((l): l is ImportedLink => l !== null), (l) => l.href);
  if (navigation.length === 0) navigation = all.filter((l) => l.internal).slice(0, 12);

  const navHrefs = new Set(navigation.map((l) => l.href));
  const sitemap = all
    .filter((l) => l.internal && !navHrefs.has(l.href) && !/#/.test(l.href.replace(base, '')))
    .slice(0, MAX_SITEMAP_LINKS);
  return { navigation, sitemap };
}

// ─────────────────────────────────────────────────────────────────────
// Texte
// ─────────────────────────────────────────────────────────────────────

function extractTexts(html: string, text: string): ImportedTexts {
  const paragraphs = findTags(stripNonVisible(html), 'p', 400)
    .map((t) => cleanText(t.inner))
    .filter((p) => p.length >= 20)
    .slice(0, MAX_PARAGRAPHS);
  const sents = sentences(text).filter((s) => wordCount(s) >= 3);
  const lengths = sents.map(wordCount);
  const avg = lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0) / lengths.length : null;
  const long = lengths.length > 0 ? lengths.filter((n) => n > 25).length / lengths.length : null;
  return {
    paragraphs,
    wordCount: wordCount(text),
    avgSentenceLength: avg === null ? null : Math.round(avg * 10) / 10,
    longSentenceShare: long === null ? null : Math.round(long * 100) / 100,
  };
}

// ─────────────────────────────────────────────────────────────────────
// CTAs
// ─────────────────────────────────────────────────────────────────────

const ACTION_WORDS = /\b(?:anfrage|anfragen|kontakt|termin|buchen|jetzt|starten|angebot|beratung|kostenlos|unverbindlich|rückruf|anrufen|bestellen|kaufen|demo|download|registrieren|anmelden|mehr erfahren|los geht|get started|contact|book|request|start)\b/i;

function extractCtas(html: string, base: string, ev: EvidenceCollector): ImportedCta[] {
  const doc = stripNonVisible(html);
  const out: ImportedCta[] = [];

  const push = (label: string, href: string | null, kind: ImportedCta['kind'], attrs: string, full: string) => {
    const cls = `${getAttr(attrs, 'class') ?? ''} ${getAttr(attrs, 'id') ?? ''}`.toLowerCase();
    const prominence: ImportedCta['prominence'] = /primary|\bcta\b|btn-main|button--main|hero/.test(cls)
      ? 'primary'
      : /secondary|outline|ghost|link|text-btn/.test(cls)
        ? 'secondary'
        : 'unknown';
    out.push({ label: truncate(label, 60), href, kind, prominence, evidenceId: ev.add(`cta:${out.length + 1}`, 'dom', full) });
  };

  for (const tag of findTags(doc, 'a', 800)) {
    const rawHref = getAttr(tag.attrs, 'href') ?? '';
    const label = cleanText(tag.inner) || cleanText(getAttr(tag.attrs, 'aria-label') ?? '');
    if (!label) continue;
    const cls = `${getAttr(tag.attrs, 'class') ?? ''} ${getAttr(tag.attrs, 'role') ?? ''}`.toLowerCase();
    if (/^tel:/i.test(rawHref)) { push(label, rawHref, 'tel', tag.attrs, tag.full); continue; }
    if (/^mailto:/i.test(rawHref)) { push(label, rawHref, 'mailto', tag.attrs, tag.full); continue; }
    const looksLikeButton = /\bbtn\b|button|\bcta\b/.test(cls) || ACTION_WORDS.test(label);
    if (!looksLikeButton || label.length > 60) continue;
    push(label, resolveUrl(rawHref, base), /\bbtn\b|button|\bcta\b/.test(cls) ? 'button' : 'link', tag.attrs, tag.full);
  }
  for (const tag of findTags(doc, 'button', 200)) {
    const label = cleanText(tag.inner) || cleanText(getAttr(tag.attrs, 'aria-label') ?? '');
    if (!label || label.length > 60) continue;
    const type = (getAttr(tag.attrs, 'type') ?? '').toLowerCase();
    push(label, null, type === 'submit' ? 'form-submit' : 'button', tag.attrs, tag.full);
  }
  for (const tag of findTags(doc, 'input', 300)) {
    if ((getAttr(tag.attrs, 'type') ?? '').toLowerCase() !== 'submit') continue;
    const label = cleanText(getAttr(tag.attrs, 'value') ?? '');
    if (!label) continue;
    push(label, null, 'form-submit', tag.attrs, tag.full);
  }
  return unique(out, (c) => `${c.kind}|${c.label.toLowerCase()}|${c.href ?? ''}`).slice(0, MAX_CTAS);
}

// ─────────────────────────────────────────────────────────────────────
// Formulare
// ─────────────────────────────────────────────────────────────────────

const CONSENT_HINT = /datenschutz|privacy|einwillig|consent|dsgvo|gdpr|zustimm/i;

function extractForms(html: string, base: string, ev: EvidenceCollector): ImportedForm[] {
  const out: ImportedForm[] = [];
  for (const form of findTags(stripNonVisible(html), 'form', MAX_FORMS)) {
    const rawAction = getAttr(form.attrs, 'action');
    const action = rawAction === null ? null : rawAction === '' ? base : resolveUrl(rawAction, base);
    const methodRaw = (getAttr(form.attrs, 'method') ?? '').toLowerCase();
    const method: ImportedForm['method'] = methodRaw === 'post' ? 'post' : methodRaw === 'get' ? 'get' : 'unknown';
    const labels = new Map<string, string>();
    for (const label of findTags(form.inner, 'label', 60)) {
      const forId = getAttr(label.attrs, 'for');
      const txt = cleanText(label.inner);
      if (forId && txt) labels.set(forId, txt);
    }
    const fields: ImportedFormField[] = [];
    const collect = (tag: { attrs: string }, fallbackType: string) => {
      const type = (getAttr(tag.attrs, 'type') ?? fallbackType).toLowerCase();
      if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) return;
      const id = getAttr(tag.attrs, 'id');
      fields.push({
        name: orNull(getAttr(tag.attrs, 'name')),
        type,
        label: orNull((id && labels.get(id)) || getAttr(tag.attrs, 'placeholder') || getAttr(tag.attrs, 'aria-label')),
        required: getAttr(tag.attrs, 'required') !== null,
      });
    };
    findTags(form.inner, 'input', 60).forEach((t) => collect(t, 'text'));
    findTags(form.inner, 'textarea', 10).forEach((t) => collect(t, 'textarea'));
    findTags(form.inner, 'select', 10).forEach((t) => collect(t, 'select'));

    const formText = cleanText(form.inner).toLowerCase();
    const hasConsentHint = fields.some((f) => f.type === 'checkbox' && CONSENT_HINT.test(`${f.name ?? ''} ${f.label ?? ''}`)) || CONSENT_HINT.test(formText);
    const purpose = classifyForm(fields, `${getAttr(form.attrs, 'class') ?? ''} ${getAttr(form.attrs, 'id') ?? ''} ${formText}`);
    out.push({ action, method, fields: fields.slice(0, 20), purpose, hasConsentHint, evidenceId: ev.add(`form:${out.length + 1}`, 'dom', truncate(form.full, 1200)) });
  }
  return out;
}

function classifyForm(fields: ImportedFormField[], context: string): FormPurpose {
  const names = fields.map((f) => `${f.name ?? ''} ${f.label ?? ''} ${f.type}`.toLowerCase()).join(' ');
  const all = `${names} ${context.toLowerCase()}`;
  if (/password|passwort/.test(names)) return 'login';
  if (/\bsearch\b|suche/.test(all) && fields.length <= 2) return 'search';
  if (/date|datum|termin|uhrzeit|time|slot|booking|buchung/.test(all)) return 'booking';
  if (/angebot|anfrage|quote|kostenvoranschlag|offerte/.test(all)) return 'quote';
  const hasEmail = fields.some((f) => f.type === 'email' || /mail/.test(`${f.name ?? ''} ${f.label ?? ''}`.toLowerCase()));
  const hasMessage = fields.some((f) => f.type === 'textarea' || /nachricht|message|anliegen/.test(`${f.name ?? ''} ${f.label ?? ''}`.toLowerCase()));
  if (hasEmail && hasMessage) return 'contact';
  if (hasEmail && fields.length <= 2 && /newsletter|abonn|subscribe/.test(all)) return 'newsletter';
  if (hasEmail && fields.length <= 2) return 'newsletter';
  if (hasEmail || hasMessage || /kontakt|contact/.test(all)) return 'contact';
  return 'unknown';
}

// ─────────────────────────────────────────────────────────────────────
// Bilder und Logo
// ─────────────────────────────────────────────────────────────────────

function extractImages(html: string, base: string): ImportedImage[] {
  const out: ImportedImage[] = [];
  for (const tag of findTags(html, 'img', 200)) {
    const raw = getAttr(tag.attrs, 'src') ?? getAttr(tag.attrs, 'data-src') ?? '';
    const src = resolveUrl(raw, base);
    if (!src) continue;
    const alt = getAttr(tag.attrs, 'alt');
    const haystack = `${raw} ${alt ?? ''} ${getAttr(tag.attrs, 'class') ?? ''} ${getAttr(tag.attrs, 'id') ?? ''}`.toLowerCase();
    out.push({
      src,
      alt: alt === null ? null : alt,
      isLogo: /logo|wortmarke|brand/.test(haystack),
      width: toDimension(getAttr(tag.attrs, 'width')),
      height: toDimension(getAttr(tag.attrs, 'height')),
    });
  }
  return unique(out, (i) => i.src).slice(0, MAX_IMAGES);
}

function toDimension(value: string | null): number | null {
  if (!value) return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ─────────────────────────────────────────────────────────────────────
// Trust-Signale
// ─────────────────────────────────────────────────────────────────────

const TRUST_PATTERNS: ReadonlyArray<{ kind: TrustSignalKind; pattern: RegExp }> = [
  { kind: 'rating', pattern: /\b\d[.,]\d\s*(?:von|\/|out of)\s*5\b|★{3,}|\b\d{2,5}\+?\s*(?:bewertungen|rezensionen|reviews)\b|google\s*(?:bewertung|rezension)|proven\s*expert|trusted\s*shops|trustpilot/i },
  { kind: 'certificate', pattern: /\biso\s?\d{4,5}\b|\btüv\b|\bdin\s?(?:en\s?)?\d+|zertifiziert|zertifikat|certified|\bsgs\b|dekra/i },
  { kind: 'years', pattern: /\bseit\s+(?:19|20)\d{2}\b|\b(?:über|mehr als|more than)?\s*\d{1,3}\s*jahre(?:n)?\s+(?:erfahrung|am markt|tradition)|\b\d{1,3}\s*years?\s+(?:of\s+)?experience/i },
  { kind: 'customers', pattern: /\b\d{1,3}(?:[.,]\d{3})*\+?\s*(?:zufriedene\s+)?(?:kunden|projekte|mandanten|patienten|auftraggeber|unternehmen|installationen|clients|customers|projects)\b/i },
  { kind: 'membership', pattern: /\bmitglied\b|\binnung\b|\bkammer\b|\bverband\b|\bfachverband\b|\bmember of\b/i },
  { kind: 'award', pattern: /auszeichnung|\baward\b|preisträger|testsieger|ausgezeichnet/i },
  { kind: 'guarantee', pattern: /\bgarantie\b|festpreis|geld-zurück|zufriedenheitsgarantie|\bwarranty\b/i },
  { kind: 'reference', pattern: /referenzen|kunden sagen|kundenstimmen|testimonial|das sagen unsere|erfahrungsberichte|case stud/i },
  { kind: 'legal-badge', pattern: /dsgvo-konform|dsgvo konform|gdpr[- ]compliant|server in deutschland|hosting in deutschland|made in germany|eu-hosting|iso 27001/i },
];

function extractTrust(text: string, ev: EvidenceCollector): ImportedTrustSignal[] {
  const out: ImportedTrustSignal[] = [];
  const seen = new Set<string>();
  for (const sentence of sentences(text)) {
    if (sentence.length > 300 || sentence.length < 20) continue;
    for (const { kind, pattern } of TRUST_PATTERNS) {
      if (!pattern.test(sentence)) continue;
      const key = `${kind}|${sentence.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind, text: truncate(sentence, 200), evidenceId: ev.add(`trust:${out.length + 1}`, 'text', sentence) });
      break;
    }
    if (out.length >= MAX_TRUST) break;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Marke: Name, Logo, Farben, Schriften
// ─────────────────────────────────────────────────────────────────────

const HEX_COLOR = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
const RGB_COLOR = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)/gi;
const GENERIC_FONTS = new Set(['inherit', 'initial', 'unset', 'sans-serif', 'serif', 'monospace', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'cursive', 'fantasy', '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'roboto', 'helvetica neue', 'arial', 'helvetica', 'sans', 'icon', 'fontawesome', 'font awesome 5 free', 'font awesome 6 free', 'material icons', 'dashicons', 'eicons', 'elementor-icons']);

function extractBrand(html: string, title: string | null, images: ImportedImage[], host: string): ImportedBrand {
  const styles = [...findTags(html, 'style', 40).map((t) => t.inner), ...[...html.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)].map((m) => m[1] ?? '')].join('\n');
  return {
    name: deriveBrandName(html, title, images, host),
    logo: images.find((i) => i.isLogo) ?? null,
    colors: extractColors(styles),
    fonts: extractFonts(html, styles),
    themeColor: normalizeHex(metaContent(html, 'theme-color') ?? ''),
  };
}

const LEGAL_FORM = /\b(?:gmbh|ag|kg|ohg|ug|e\.\s?k\.|e\.\s?v\.|mbh|inc\.?|ltd\.?|se|partg|partnerschaft)\b/i;

function deriveBrandName(html: string, title: string | null, images: ImportedImage[], host: string): string | null {
  const og = metaContent(html, 'og:site_name');
  if (og) return truncate(og, 80);
  const app = metaContent(html, 'application-name');
  if (app) return truncate(app, 80);
  // Der Alternativtext des Logos nennt die Marke fast immer: „Elektro Müller Logo".
  const logoAlt = images.find((i) => i.isLogo && i.alt)?.alt?.replace(/\b(?:logo|wortmarke|brand|zurück zur startseite|startseite)\b/gi, '').replace(/\s+/g, ' ').trim();
  if (logoAlt && logoAlt.length >= 2 && wordCount(logoAlt) <= 6) return truncate(logoAlt, 80);
  if (title) {
    // „Firma | Claim" oder „Claim – Firma": die Rechtsform entscheidet, sonst
    // der kürzere Teil, bei Gleichstand der erste.
    const parts = title.split(/\s+[|–—\-·:]\s+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const legal = parts.find((p) => LEGAL_FORM.test(p));
      if (legal) return truncate(legal, 80);
      const candidates = parts.filter((p) => wordCount(p) <= 5);
      if (candidates.length > 0) {
        const shortest = [...candidates].sort((a, b) => wordCount(a) - wordCount(b) || candidates.indexOf(a) - candidates.indexOf(b))[0];
        return truncate(shortest, 80);
      }
    }
    if (wordCount(title) <= 5) return truncate(title, 80);
  }
  const label = host.replace(/^www\./, '').split('.')[0];
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : null;
}

function extractColors(styles: string): string[] {
  const counts = new Map<string, number>();
  const bump = (hex: string | null) => {
    if (!hex) return;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  };
  for (const m of styles.matchAll(HEX_COLOR)) bump(normalizeHex(m[0]));
  for (const m of styles.matchAll(RGB_COLOR)) bump(rgbToHex(Number(m[1]), Number(m[2]), Number(m[3])));

  // Neutrale Töne (Grau, Weiß, Schwarz) tragen keine Marke; sie werden
  // im Design-System ohnehin abgeleitet.
  const saturated = [...counts.entries()]
    .filter(([hex]) => saturationOf(hex) >= 0.12 && lightnessOf(hex) > 0.08 && lightnessOf(hex) < 0.92)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([hex]) => hex);
  return saturated.slice(0, MAX_COLORS);
}

function extractFonts(html: string, styles: string): string[] {
  const counts = new Map<string, number>();
  const bump = (family: string, weight = 1) => {
    const cleaned = family.replace(/["']/g, '').trim();
    const lower = cleaned.toLowerCase();
    if (!cleaned || GENERIC_FONTS.has(lower) || /^var\(|^--|icon/i.test(cleaned) || cleaned.length > 40) return;
    counts.set(cleaned, (counts.get(cleaned) ?? 0) + weight);
  };
  for (const m of styles.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
    const first = (m[1] ?? '').split(',')[0] ?? '';
    bump(first);
  }
  for (const m of styles.matchAll(/@font-face\s*{[^}]*font-family\s*:\s*([^;}]+)/gi)) bump(m[1] ?? '', 3);
  for (const href of [...linkHrefs(html, 'stylesheet'), ...linkHrefs(html, 'preload')]) {
    const fontHost = hostnameOf(href);
    if (fontHost !== 'fonts.googleapis.com' && fontHost !== 'fonts.bunny.net') continue;
    for (const m of href.matchAll(/family=([^&:]+)/gi)) {
      for (const fam of (m[1] ?? '').split('|')) bump(decodeURIComponent(fam.replace(/\+/g, ' ')), 5);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([f]) => f).slice(0, MAX_FONTS);
}

export function normalizeHex(value: string): string | null {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(value.trim());
  if (!m) return null;
  const raw = m[1];
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  return `#${full.toUpperCase()}`;
}

export function rgbToHex(r: number, g: number, b: number): string | null {
  if ([r, g, b].some((v) => !Number.isFinite(v) || v < 0 || v > 255)) return null;
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  return [parseInt(n.slice(1, 3), 16), parseInt(n.slice(3, 5), 16), parseInt(n.slice(5, 7), 16)];
}

export function saturationOf(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return 0;
  const d = max - min;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}

export function lightnessOf(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => v / 255);
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}

// ─────────────────────────────────────────────────────────────────────
// SEO-Basics
// ─────────────────────────────────────────────────────────────────────

function extractSeo(html: string, base: string, h1Count: number): ImportedSeo {
  const lang = /<html\b[^>]*\blang\s*=\s*["']?([a-zA-Z-]+)/i.exec(html)?.[1] ?? null;
  const jsonLdTypes: string[] = [];
  for (const tag of findTags(html, 'script', 200)) {
    if (!/application\/ld\+json/i.test(getAttr(tag.attrs, 'type') ?? '')) continue;
    for (const m of tag.inner.matchAll(/"@type"\s*:\s*"([^"]+)"/g)) jsonLdTypes.push(m[1]);
  }
  const canonicalRaw = linkHrefs(html, 'canonical')[0] ?? null;
  return {
    canonical: canonicalRaw ? resolveUrl(canonicalRaw, base) : null,
    ogTitle: metaContent(html, 'og:title'),
    ogDescription: metaContent(html, 'og:description'),
    ogImage: (() => { const v = metaContent(html, 'og:image'); return v ? resolveUrl(v, base) : null; })(),
    robots: metaContent(html, 'robots'),
    hasViewport: metaContent(html, 'viewport') !== null,
    lang: lang ? lang.toLowerCase() : null,
    jsonLdTypes: [...new Set(jsonLdTypes)].slice(0, 10),
    h1Count,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Drittanbieter
// ─────────────────────────────────────────────────────────────────────

function extractThirdPartyHosts(html: string, base: string, host: string): string[] {
  const hosts = new Set<string>();
  const consider = (raw: string | null) => {
    if (!raw) return;
    const url = resolveUrl(raw, base);
    const h = url ? hostnameOf(url) : null;
    if (h && !sameSite(h, host)) hosts.add(h);
  };
  for (const tag of findTags(html, 'script', 300)) consider(getAttr(tag.attrs, 'src'));
  for (const tag of findTags(html, 'link', 300)) consider(getAttr(tag.attrs, 'href'));
  for (const tag of findTags(html, 'iframe', 50)) consider(getAttr(tag.attrs, 'src'));
  for (const tag of findTags(html, 'img', 200)) consider(getAttr(tag.attrs, 'src'));
  return [...hosts].sort();
}

// ─────────────────────────────────────────────────────────────────────
// Positionierung
// ─────────────────────────────────────────────────────────────────────

interface PositioningInput {
  title: string | null;
  h1: string | null;
  description: string | null;
  headings: string[];
  navigation: ImportedLink[];
  text: string;
  forms: ImportedForm[];
  ctas: ImportedCta[];
  seo: ImportedSeo;
}

const VAGUE_HEADLINE = /^(?:willkommen|herzlich willkommen|welcome|home|startseite|start|über uns|hallo)\b/i;

const AUDIENCE = /\bfür\s+((?:kleine\s+und\s+mittlere\s+|mittelständische\s+|regionale\s+|lokale\s+)?(?:unternehmen|privatkunden|firmen|kmu|mittelstand|handwerker|handwerksbetriebe|steuerberater|kanzleien|praxen|ärzte|startups|start-ups|familien|senioren|gewerbekunden|privat-?\s?und\s+gewerbekunden|agenturen|behörden|kommunen|vereine|selbstständige|freiberufler|online-?shops|hersteller|industrie))\b/iu;

function derivePositioning(input: PositioningInput): ImportedPositioning {
  const signal = [input.title, input.h1, input.description, ...input.headings, ...input.navigation.map((l) => l.label)].filter(Boolean).join(' . ');
  const { industry, confident } = detectIndustry(`${signal} . ${input.text.slice(0, 4000)}`);
  // Eine Begrüßung ist kein Angebot: „Herzlich willkommen bei …" wird
  // übersprungen, die Bewertung meldet sie separat (`hero.vague-headline`).
  const usableH1 = input.h1 && !VAGUE_HEADLINE.test(input.h1) ? input.h1 : null;
  const offerSource = usableH1 ?? input.seo.ogTitle ?? input.description ?? input.title;
  const audienceMatch = AUDIENCE.exec(`${signal} . ${input.text.slice(0, 6000)}`);
  const locality = detectLocality(signal) ?? detectLocality(input.text.slice(0, 3000));

  return {
    industry: confident ? industry : null,
    industryConfident: confident,
    offer: offerSource ? truncate(offerSource, 140) : null,
    audience: audienceMatch ? truncate(audienceMatch[1], 80) : null,
    conversionGoal: deriveConversionGoal(input),
    locality,
    language: input.seo.lang,
  };
}

function deriveConversionGoal(input: PositioningInput): ConversionGoal {
  const purposes = new Set(input.forms.map((f) => f.purpose));
  const ctaText = input.ctas.map((c) => `${c.label} ${c.href ?? ''}`).join(' ').toLowerCase();
  if (purposes.has('booking') || /termin|buchen|booking/.test(ctaText)) return 'booking';
  if (/warenkorb|cart|checkout|kaufen|bestellen|shop\b/.test(ctaText)) return 'purchase';
  if (purposes.has('quote')) return 'lead';
  if (purposes.has('contact')) return 'contact';
  if (input.ctas.some((c) => c.kind === 'tel')) return 'call';
  if (purposes.has('newsletter')) return 'newsletter';
  if (/kontakt|contact|anfrage/.test(ctaText)) return 'contact';
  return 'unknown';
}
