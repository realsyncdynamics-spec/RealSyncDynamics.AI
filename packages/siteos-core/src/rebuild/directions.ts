// REBUILD — aus Import und Bewertung zwei bis drei gestaltete Richtungen.
//
// ## Woher der Text kommt
//
// Aus der Quelle. Überschrift, Angebot, Leistungen, Ort, Zielgruppe,
// Belege — alles stammt aus dem Import und trägt, wo möglich, die
// Beleg-ID mit. Was die Quelle nicht hergibt, wird nicht erfunden:
// Referenzen, Preise, Kennzahlen und Kundenstimmen bleiben Platzhalter
// (`placeholder: true`) und werden als solche gerendert.
//
// Was dieses Modul selbst formuliert, beschreibt den Rebuild — den
// Anfrageweg, den Ablauf, die Compliance-Eigenschaften der neuen Seite.
// Das sind Aussagen über das, was hier gebaut wird, nicht über die Firma.
//
// ## Warum drei Richtungen und nicht eine
//
// Eine einzelne Version zwingt zur Entscheidung, ob sie „richtig" ist.
// Drei benannte Richtungen mit Begründung machen die Entscheidung
// sichtbar: nüchtern-institutionell, auf Abschluss gebaut, lokal und
// nahbar — oder, wo die Branche es verlangt, Premium-Beratung und
// Governance-first.

import { INDUSTRY_PRESETS } from '../blueprint/industries.ts';
import type { IndustryKey } from '../types.ts';
import { clip, createComponent } from './components.ts';
import { deriveDesignSystem } from './design-system.ts';
import { sentences, wordCount } from './html.ts';
import {
  REBUILD_DIRECTION_LABEL,
  type ImportedCta,
  type LeadFlow,
  type ProofItem,
  type RebuildComponent,
  type RebuildComponentKind,
  type RebuildCta,
  type RebuildDirection,
  type RebuildDirectionKey,
  type RebuildItem,
  type RebuildMedia,
  type RebuildSeo,
  type SiteAssessment,
  type SiteImport,
} from './types.ts';

// ─────────────────────────────────────────────────────────────────────
// Auswahl der Richtungen
// ─────────────────────────────────────────────────────────────────────

const GOVERNANCE_TERMS = /\b(?:ki|künstliche intelligenz|ai\b|governance|compliance|dsgvo|eu ai act|datenschutz-?beratung|iso 27001|informationssicherheit)\b/i;

export function chooseDirections(imp: SiteImport): RebuildDirectionKey[] {
  const industry = imp.positioning.industry;
  const text = `${imp.title ?? ''} ${imp.h1 ?? ''} ${imp.description ?? ''} ${imp.headings.map((h) => h.text).join(' ')}`;
  const governance = GOVERNANCE_TERMS.test(text) && (industry === 'agentur' || industry === 'sonstiges' || industry === null);

  if (industry === 'steuerberatung' || industry === 'rechtsanwalt') return ['premium-advisory', 'clean-enterprise', 'local-trust'];
  if (industry === 'handwerk' || industry === 'gastronomie' || industry === 'zahnarzt' || industry === 'arztpraxis' || industry === 'immobilien') {
    return ['local-trust', 'conversion-focus', 'clean-enterprise'];
  }
  if (governance) return ['governance-first', 'clean-enterprise', 'conversion-focus'];
  return ['clean-enterprise', 'conversion-focus', 'local-trust'];
}

// ─────────────────────────────────────────────────────────────────────
// Redaktioneller Kern aus dem Import
// ─────────────────────────────────────────────────────────────────────

interface Editorial {
  brand: string;
  offer: string | null;
  industry: IndustryKey | null;
  industryLabel: string | null;
  locality: string | null;
  audience: string | null;
  services: RebuildItem[];
  proof: ProofItem[];
  faq: RebuildItem[];
  phone: ImportedCta | null;
  email: ImportedCta | null;
  formTarget: string | null;
  heroMedia: RebuildMedia | null;
  priceSentence: RebuildItem | null;
  reference: RebuildItem | null;
  firstSentence: string | null;
}

const GENERIC_NAV = /^(?:home|start|startseite|kontakt|contact|impressum|datenschutz|privacy|über uns|ueber uns|about|team|news|blog|aktuelles|karriere|jobs|agb|login|anmelden|mehr|menü|menu|suche|search|sitemap|faq|downloads?|leistungen|unsere leistungen|services?|referenzen|projekte|portfolio|galerie|produkte|preise|standort|anfahrt|öffnungszeiten|partner|presse|shop|angebote?)$/i;

function editorialFrom(imp: SiteImport): Editorial {
  const brand = imp.brand.name ?? hostLabel(imp.finalUrl);
  const industry = imp.positioning.industry;
  const industryLabel = industry && industry !== 'sonstiges' ? INDUSTRY_PRESETS[industry].label : null;
  const paragraphs = imp.texts.paragraphs;
  const evidenceFor = (ref: string) => imp.evidence.find((e) => e.ref === ref)?.id ?? null;

  const serviceCandidates = [
    ...imp.headings.filter((h) => h.level === 2).map((h) => ({ label: h.text, ref: 'headings' })),
    ...imp.navigation.map((l) => ({ label: l.label, ref: 'nav' })),
  ]
    .map((c) => ({ ...c, label: c.label.replace(/[.:!]+$/, '').trim() }))
    .filter((c) => c.label.length >= 3 && c.label.length <= 60 && !GENERIC_NAV.test(c.label) && !/\?$/.test(c.label) && wordCount(c.label) <= 6);
  const seen = new Set<string>();
  const services: RebuildItem[] = [];
  for (const c of serviceCandidates) {
    const key = c.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    services.push({ title: c.label, text: sentenceAbout(c.label, paragraphs) ?? '', evidenceId: evidenceFor(c.ref) });
    if (services.length >= 6) break;
  }

  const proof: ProofItem[] = imp.trust.slice(0, 6).map((t) => ({ kind: t.kind, text: t.text, evidenceId: t.evidenceId, placeholder: false }));
  const faq: RebuildItem[] = imp.headings
    .filter((h) => /\?\s*$/.test(h.text))
    .slice(0, 6)
    .map((h) => ({ title: h.text, text: answerAfter(h.text, paragraphs) ?? '', evidenceId: evidenceFor('headings') }));

  const phone = imp.ctas.find((c) => c.kind === 'tel') ?? null;
  const email = imp.ctas.find((c) => c.kind === 'mailto') ?? null;
  const leadForm = imp.forms.find((f) => ['contact', 'quote', 'booking'].includes(f.purpose)) ?? null;
  const formTarget = leadForm?.action && /^https:\/\//i.test(leadForm.action) ? leadForm.action : null;

  const heroImage = imp.seo.ogImage
    ? { src: imp.seo.ogImage, alt: imp.seo.ogTitle ?? imp.title, origin: 'import' as const }
    : (() => {
        const img = imp.images.find((i) => !i.isLogo && (i.width === null || i.width >= 600) && !/icon|sprite|pixel|badge|\.svg$/i.test(i.src));
        return img ? { src: img.src, alt: img.alt, origin: 'import' as const } : null;
      })();

  const priceRaw = sentences(paragraphs.join(' ')).find((s) => /\b(?:ab\s+\d+|€|eur\b|festpreis|preis)/i.test(s) && s.length <= 200) ?? null;
  const referenceSignal = imp.trust.find((t) => t.kind === 'reference') ?? imp.trust.find((t) => t.kind === 'rating') ?? null;

  return {
    brand,
    offer: imp.positioning.offer ? stripBrand(imp.positioning.offer, brand) : null,
    industry,
    industryLabel,
    locality: imp.positioning.locality,
    audience: imp.positioning.audience,
    services,
    proof,
    faq,
    phone,
    email,
    formTarget,
    heroMedia: heroImage,
    priceSentence: priceRaw ? { title: 'Preise', text: priceRaw, evidenceId: evidenceFor('text') } : null,
    reference: referenceSignal ? { title: 'Referenz', text: referenceSignal.text, evidenceId: referenceSignal.evidenceId } : null,
    firstSentence: imp.description ?? sentences(paragraphs.join(' ')).find((s) => wordCount(s) >= 6 && wordCount(s) <= 30) ?? null,
  };
}

function hostLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const label = host.split('.')[0] ?? host;
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return 'Ihre Marke';
  }
}

function stripBrand(offer: string, brand: string): string {
  const cleaned = offer.replace(new RegExp(`\\s*[|–—\\-·:]\\s*${escapeRegExp(brand)}\\s*$`, 'i'), '').replace(new RegExp(`^${escapeRegExp(brand)}\\s*[|–—\\-·:]\\s*`, 'i'), '').trim();
  return cleaned.length >= 3 ? cleaned : offer;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sentenceAbout(term: string, paragraphs: string[]): string | null {
  const needle = term.toLowerCase().split(/\s+/)[0] ?? '';
  if (needle.length < 4) return null;
  for (const p of paragraphs) {
    for (const s of sentences(p)) {
      if (s.toLowerCase().includes(needle) && wordCount(s) >= 5 && s.length <= 220) return s;
    }
  }
  return null;
}

function answerAfter(question: string, paragraphs: string[]): string | null {
  // Ohne DOM-Reihenfolge nur eine Näherung: ein Absatz, der ein Schlüsselwort der Frage enthält.
  const keywords = question.toLowerCase().replace(/[?]/g, '').split(/\s+/).filter((w) => w.length >= 5);
  for (const p of paragraphs) {
    const lower = p.toLowerCase();
    if (keywords.some((k) => lower.includes(k)) && p.length <= 400) return p;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Erzeugung
// ─────────────────────────────────────────────────────────────────────

export interface GenerateOptions {
  directions?: RebuildDirectionKey[];
}

export function generateDirections(imp: SiteImport, assessment: SiteAssessment | null, options: GenerateOptions = {}): RebuildDirection[] {
  const keys = options.directions ?? chooseDirections(imp);
  const editorial = editorialFrom(imp);
  return keys.map((key) => buildDirection(key, editorial, imp, assessment));
}

export function buildDirection(key: RebuildDirectionKey, editorial: Editorial, imp: SiteImport, assessment: SiteAssessment | null): RebuildDirection {
  const designSystem = deriveDesignSystem(imp.brand, key);
  const primaryCta = primaryCtaFor(imp, editorial, key);
  const secondaryCta = secondaryCtaFor(editorial, primaryCta);
  const leadFlow = leadFlowFor(editorial, key);
  const components = componentsFor(key, editorial, primaryCta, secondaryCta, leadFlow);
  return {
    key,
    label: REBUILD_DIRECTION_LABEL[key],
    tagline: TAGLINE[key],
    rationale: rationaleFor(key, editorial, assessment),
    designSystem,
    components,
    seo: seoFor(editorial, primaryCta),
    primaryCta,
    secondaryCta,
    leadFlow,
    proof: editorial.proof.length > 0 ? editorial.proof : [{ kind: 'unknown', text: 'Belege ergänzen: Bewertungen, Zertifikate, Erfahrungsjahre — nur echte.', evidenceId: null, placeholder: true }],
    tone: TONE[key],
  };
}

const TAGLINE: Readonly<Record<RebuildDirectionKey, string>> = Object.freeze({
  'clean-enterprise': 'Ruhig, strukturiert, institutionell. Für Marken, die Verlässlichkeit ausstrahlen sollen.',
  'conversion-focus': 'Ein Ziel, ein Pfad. Jede Sektion führt zur Anfrage.',
  'local-trust': 'Nahbar und konkret. Ort, Ansprechpartner und Belege stehen vorn.',
  'premium-advisory': 'Zurückhaltend und hochwertig. Weniger Elemente, mehr Gewicht je Aussage.',
  'governance-first': 'Nachvollziehbarkeit als Versprechen. Compliance und Ablauf sichtbar, nicht versteckt.',
});

const TONE: Readonly<Record<RebuildDirectionKey, number>> = Object.freeze({
  'clean-enterprise': 35,
  'conversion-focus': 55,
  'local-trust': 80,
  'premium-advisory': 15,
  'governance-first': 30,
});

function rationaleFor(key: RebuildDirectionKey, e: Editorial, assessment: SiteAssessment | null): string {
  const score = (c: string) => assessment?.criteria.find((x) => x.criterion === c)?.score ?? null;
  const cta = score('cta-structure');
  const trust = score('trust-signals');
  const conv = score('conversion-focus');
  const hero = score('hero-clarity');
  const where = e.locality ? ` in ${e.locality}` : '';
  switch (key) {
    case 'clean-enterprise':
      return `${e.brand} wirkt mit klarer Struktur und ruhiger Typografie verlässlich${e.industryLabel ? ` — passend für ${e.industryLabel}` : ''}.${hero !== null && hero < 70 ? ` Die Hero-Klarheit liegt bei ${hero}/100; diese Richtung stellt das Angebot in einem Satz nach vorn.` : ''}`;
    case 'conversion-focus':
      return `Jede Sektion führt zu „${e.brand}" anfragen.${cta !== null && conv !== null ? ` CTA-Struktur ${cta}/100 und Conversion-Fokus ${conv}/100 der aktuellen Seite sind der Hebel.` : ''} Formular früh, Ablauf sichtbar, ein Primär-CTA.`;
    case 'local-trust':
      return `Ort${where ? ` (${e.locality})` : ''}, Ansprechpartner und echte Belege stehen vorn.${trust !== null && trust < 70 ? ` Trust-Signale liegen bei ${trust}/100 — was belegt ist, wird sichtbar; was fehlt, bleibt Platzhalter.` : ''}`;
    case 'premium-advisory':
      return `Beratung verkauft sich über Gewicht, nicht Lautstärke. Wenige Elemente, Serifen-Überschriften, keine Effekte — ${e.brand} wird als Instanz positioniert.`;
    case 'governance-first':
      return `Die Quelle spricht von KI, Compliance oder Governance. Diese Richtung macht Nachvollziehbarkeit zum sichtbaren Versprechen: Ablauf, Pflichten, Automatisierung — alles mit Freigabe.`;
  }
}

// ─────────────────────────────────────────────────────────────────────
// CTAs und Lead-Flow
// ─────────────────────────────────────────────────────────────────────

function primaryCtaFor(imp: SiteImport, e: Editorial, key: RebuildDirectionKey): RebuildCta {
  const goal = imp.positioning.conversionGoal;
  const strong = key === 'conversion-focus';
  switch (goal) {
    case 'booking':
      return { label: strong ? 'Termin anfragen' : 'Termin vereinbaren', href: '#kontakt', origin: 'proposed' };
    case 'call':
      return e.phone?.href ? { label: 'Jetzt anrufen', href: e.phone.href, origin: 'import' } : { label: 'Rückruf anfragen', href: '#kontakt', origin: 'proposed' };
    case 'purchase': {
      const shop = imp.ctas.find((c) => c.href && /shop|produkt|kaufen|bestellen|cart/i.test(`${c.label} ${c.href}`));
      return shop?.href ? { label: clip(shop.label, 40), href: shop.href, origin: 'import' } : { label: 'Zum Angebot', href: '#leistungen', origin: 'proposed' };
    }
    case 'newsletter':
      return { label: 'Newsletter abonnieren', href: '#kontakt', origin: 'proposed' };
    case 'lead':
      return { label: strong ? 'Angebot anfordern' : 'Unverbindlich anfragen', href: '#kontakt', origin: 'proposed' };
    case 'contact':
    case 'unknown':
    default:
      return { label: strong ? 'Anfrage senden' : key === 'premium-advisory' ? 'Erstgespräch anfragen' : 'Kontakt aufnehmen', href: '#kontakt', origin: 'proposed' };
  }
}

function secondaryCtaFor(e: Editorial, primary: RebuildCta): RebuildCta | null {
  if (e.phone?.href && primary.href !== e.phone.href) return { label: 'Anrufen', href: e.phone.href, origin: 'import' };
  if (e.services.length > 0) return { label: 'Leistungen ansehen', href: '#leistungen', origin: 'proposed' };
  return { label: 'Ablauf ansehen', href: '#ablauf', origin: 'proposed' };
}

function leadFlowFor(e: Editorial, key: RebuildDirectionKey): LeadFlow {
  const detailed = key === 'local-trust';
  return {
    formTarget: e.formTarget,
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'email', label: 'E-Mail', type: 'email', required: true },
      ...(detailed ? [{ name: 'phone', label: 'Telefon (optional)', type: 'tel' as const, required: false }] : []),
      { name: 'message', label: 'Ihr Anliegen', type: 'textarea', required: true },
    ],
    successMessage: 'Danke — Ihre Anfrage ist eingegangen. Sie erhalten eine Antwort per E-Mail.',
    consentNote: 'Mit dem Absenden stimmen Sie der Verarbeitung Ihrer Angaben zur Bearbeitung der Anfrage zu (Art. 6 Abs. 1 lit. b DSGVO). Details in der Datenschutzerklärung.',
    requiresConfiguration: e.formTarget === null,
  };
}

// ─────────────────────────────────────────────────────────────────────
// SEO
// ─────────────────────────────────────────────────────────────────────

/** Nennt der Text den Ort schon? Verhindert „in Kassel in Kassel". */
function mentionsLocality(text: string | null | undefined, locality: string | null): boolean {
  return Boolean(locality && text && text.toLowerCase().includes(locality.toLowerCase()));
}

function seoFor(e: Editorial, primary: RebuildCta): RebuildSeo {
  const core = e.offer ?? [e.brand, e.industryLabel].filter(Boolean).join(' – ');
  let title = e.offer ? `${limitChars(e.offer, 40)} | ${e.brand}` : core;
  if (e.locality && !mentionsLocality(core, e.locality) && title.length + e.locality.length + 3 <= 60) {
    title = e.offer ? `${limitChars(e.offer, 36)} ${e.locality} | ${e.brand}` : `${core} in ${e.locality}`;
  }
  title = limitChars(title, 60);

  const lead = e.offer ? `${e.brand}: ${e.offer}` : e.brand;
  const parts = [lead, e.services.length > 0 ? e.services.slice(0, 3).map((s) => s.title).join(', ') : null, e.locality && !mentionsLocality(lead, e.locality) ? `In ${e.locality}` : null, `${primary.label}.`].filter((p): p is string => Boolean(p));
  const description = limitChars(parts.join('. ').replace(/\.\./g, '.'), 155);

  const keywords = [...e.services.map((s) => s.title), e.industryLabel, e.locality, e.brand].filter((k): k is string => Boolean(k)).slice(0, 8);
  return { title, description, keywords };
}

function limitChars(value: string, max: number): string {
  const v = value.trim();
  if (v.length <= max) return v;
  const cut = v.slice(0, max);
  const at = cut.lastIndexOf(' ');
  return (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:|–-]+$/, '');
}

export function limitWords(value: string, max: number): string {
  const words = value.trim().split(/\s+/);
  if (words.length <= max) return value.trim();
  return `${words.slice(0, max).join(' ').replace(/[,;:–-]+$/, '')}`;
}

// ─────────────────────────────────────────────────────────────────────
// Komponenten je Richtung
// ─────────────────────────────────────────────────────────────────────

const ORDER: Readonly<Record<RebuildDirectionKey, ReadonlyArray<{ kind: RebuildComponentKind; variant: string }>>> = Object.freeze({
  'clean-enterprise': [
    { kind: 'hero', variant: 'split' },
    { kind: 'trust-bar', variant: 'quiet' },
    { kind: 'problem-solution', variant: 'two-column' },
    { kind: 'benefits', variant: 'grid-3' },
    { kind: 'process', variant: 'steps' },
    { kind: 'case-study', variant: 'quote' },
    { kind: 'compliance-block', variant: 'statement' },
    { kind: 'faq', variant: 'two-column' },
    { kind: 'lead-form', variant: 'short' },
    { kind: 'contact', variant: 'card' },
    { kind: 'pricing', variant: 'request' },
    { kind: 'automation-block', variant: 'grid' },
  ],
  'conversion-focus': [
    { kind: 'hero', variant: 'centered' },
    { kind: 'trust-bar', variant: 'facts' },
    { kind: 'benefits', variant: 'grid-3' },
    { kind: 'lead-form', variant: 'short' },
    { kind: 'process', variant: 'steps' },
    { kind: 'pricing', variant: 'request' },
    { kind: 'case-study', variant: 'quote' },
    { kind: 'faq', variant: 'accordion' },
    { kind: 'contact', variant: 'inline' },
    { kind: 'problem-solution', variant: 'stacked' },
    { kind: 'compliance-block', variant: 'statement' },
    { kind: 'automation-block', variant: 'steps' },
  ],
  'local-trust': [
    { kind: 'hero', variant: 'split' },
    { kind: 'trust-bar', variant: 'facts' },
    { kind: 'benefits', variant: 'list' },
    { kind: 'process', variant: 'timeline' },
    { kind: 'case-study', variant: 'story' },
    { kind: 'pricing', variant: 'request' },
    { kind: 'faq', variant: 'accordion' },
    { kind: 'contact', variant: 'card' },
    { kind: 'lead-form', variant: 'detailed' },
    { kind: 'problem-solution', variant: 'stacked' },
    { kind: 'compliance-block', variant: 'statement' },
    { kind: 'automation-block', variant: 'grid' },
  ],
  'premium-advisory': [
    { kind: 'hero', variant: 'statement' },
    { kind: 'problem-solution', variant: 'stacked' },
    { kind: 'benefits', variant: 'list' },
    { kind: 'process', variant: 'steps' },
    { kind: 'case-study', variant: 'quote' },
    { kind: 'compliance-block', variant: 'statement' },
    { kind: 'contact', variant: 'card' },
    { kind: 'lead-form', variant: 'short' },
    { kind: 'faq', variant: 'two-column' },
    { kind: 'trust-bar', variant: 'quiet' },
    { kind: 'pricing', variant: 'request' },
    { kind: 'automation-block', variant: 'grid' },
  ],
  'governance-first': [
    { kind: 'hero', variant: 'split' },
    { kind: 'compliance-block', variant: 'badges' },
    { kind: 'problem-solution', variant: 'two-column' },
    { kind: 'automation-block', variant: 'steps' },
    { kind: 'benefits', variant: 'grid-3' },
    { kind: 'process', variant: 'steps' },
    { kind: 'faq', variant: 'two-column' },
    { kind: 'lead-form', variant: 'short' },
    { kind: 'contact', variant: 'card' },
    { kind: 'trust-bar', variant: 'quiet' },
    { kind: 'case-study', variant: 'quote' },
    { kind: 'pricing', variant: 'request' },
  ],
});

/** Welche Komponenten in einer Richtung standardmäßig sichtbar sind. */
const HIDDEN_BY_DEFAULT: Readonly<Record<RebuildDirectionKey, readonly RebuildComponentKind[]>> = Object.freeze({
  'clean-enterprise': ['pricing', 'automation-block'],
  'conversion-focus': ['problem-solution', 'compliance-block', 'automation-block'],
  'local-trust': ['problem-solution', 'compliance-block', 'automation-block'],
  'premium-advisory': ['trust-bar', 'pricing', 'automation-block'],
  'governance-first': ['trust-bar', 'case-study', 'pricing'],
});

function componentsFor(key: RebuildDirectionKey, e: Editorial, primary: RebuildCta, secondary: RebuildCta | null, lead: LeadFlow): RebuildComponent[] {
  const hidden = new Set<RebuildComponentKind>(HIDDEN_BY_DEFAULT[key]);
  return ORDER[key].map(({ kind, variant }, index) => {
    const id = `${kind}-${index + 1}`;
    const base = { variant, visible: !hidden.has(kind) };
    switch (kind) {
      case 'hero':
        return createComponent('hero', id, { ...base, ...heroCopy(key, e, primary), cta: primary, media: e.heroMedia });
      case 'trust-bar':
        return createComponent('trust-bar', id, {
          ...base,
          text: { heading: e.proof.length > 0 ? 'Worauf Sie sich verlassen können' : 'Belege' },
          items: e.proof.length > 0 ? e.proof.map((p) => ({ title: labelForProof(p.kind), text: p.text, evidenceId: p.evidenceId })) : [],
          placeholder: e.proof.length === 0,
        });
      case 'problem-solution':
        return createComponent('problem-solution', id, { ...base, text: problemSolutionCopy(e) });
      case 'benefits':
        return createComponent('benefits', id, {
          ...base,
          text: { eyebrow: 'Leistungen', heading: e.services.length > 0 ? 'Was Sie bekommen' : 'Leistungen', intro: e.firstSentence ?? '' },
          items: e.services.length > 0 ? e.services : [],
          placeholder: e.services.length === 0,
        });
      case 'process':
        return createComponent('process', id, { ...base, text: { heading: 'So läuft es ab', intro: `Vom ersten Kontakt bis zur Umsetzung — in klaren Schritten.` }, items: processSteps(e, primary), cta: primary });
      case 'pricing':
        return createComponent('pricing', id, {
          ...base,
          text: { heading: 'Preise', intro: e.priceSentence ? e.priceSentence.text : 'Preislogik ergänzen — keine erfundenen Zahlen.', note: e.priceSentence ? '' : 'Platzhalter: Preisangaben nur aus Ihrem Material.' },
          items: e.priceSentence ? [e.priceSentence] : [],
          cta: { ...primary, label: 'Angebot anfragen' },
          placeholder: e.priceSentence === null,
        });
      case 'faq':
        return createComponent('faq', id, {
          ...base,
          text: { heading: 'Häufige Fragen' },
          items: e.faq.length > 0 ? e.faq : industryQuestions(e.industry).map((q) => ({ title: q, text: '', evidenceId: null })),
          placeholder: e.faq.length === 0 || e.faq.some((f) => f.text === ''),
        });
      case 'contact':
        return createComponent('contact', id, {
          ...base,
          text: {
            heading: 'Kontakt',
            body: e.locality ? `Wir sind für Sie da${e.locality ? ` — in ${e.locality} und Umgebung` : ''}.` : 'Wir sind für Sie da.',
            ...(e.phone?.href ? { phone: e.phone.href.replace(/^tel:/i, '') } : {}),
            ...(e.email?.href ? { email: e.email.href.replace(/^mailto:/i, '').split('?')[0] } : {}),
          },
          cta: secondary ?? primary,
          placeholder: !e.phone && !e.email,
        });
      case 'lead-form':
        return createComponent('lead-form', id, {
          ...base,
          text: {
            heading: key === 'conversion-focus' ? primary.label : 'Anfrage',
            intro: key === 'premium-advisory' ? 'Schildern Sie kurz Ihr Anliegen. Sie erhalten eine persönliche Antwort.' : 'Kurz schildern, was Sie brauchen — der Rest folgt im Gespräch.',
            submitLabel: primary.label,
            consentNote: lead.consentNote,
          },
          formTarget: lead.formTarget,
        });
      case 'case-study':
        return createComponent('case-study', id, {
          ...base,
          text: e.reference ? { heading: 'Aus der Praxis', quote: e.reference.text, attribution: 'Quelle: bestehende Website' } : { heading: 'Referenz', quote: 'Referenz ergänzen — keine erfundenen Kundenstimmen.' },
          placeholder: e.reference === null,
        });
      case 'compliance-block':
        return createComponent('compliance-block', id, {
          ...base,
          text: { heading: 'Datenschutz und Nachvollziehbarkeit', body: 'Diese Seite ist so gebaut, dass Pflichten sichtbar sind, nicht versteckt.' },
          items: [
            { title: 'Hinweis am Formular', text: 'Zweck und Rechtsgrundlage stehen direkt am Absende-Button (Art. 13 DSGVO).', evidenceId: null },
            { title: 'Keine Drittanbieter vor Einwilligung', text: 'Karten, Videos und Schriften werden erst nach Zustimmung geladen (§ 25 TDDDG).', evidenceId: null },
            { title: 'KI-Hinweis', text: 'Generativ erzeugte Inhalte sind gekennzeichnet (Art. 50 EU AI Act).', evidenceId: null },
            { title: 'Pflichtseiten verlinkt', text: 'Impressum, Datenschutz und Barrierefreiheit sind von jeder Seite erreichbar.', evidenceId: null },
          ],
        });
      case 'automation-block':
        return createComponent('automation-block', id, {
          ...base,
          text: { heading: 'Was nach der Anfrage passieren kann', intro: 'Optionen, die nach Ihrer Freigabe angebunden werden — nichts davon läuft ohne Zustimmung.' },
          items: [
            { title: 'Anfragen weiterleiten', text: 'Formular an E-Mail, CRM oder Kalender — nach Freigabe.', evidenceId: null },
            { title: 'Terminbuchung', text: 'Freie Slots direkt auf der Seite — nach Freigabe.', evidenceId: null },
            { title: 'DSGVO- und EU-AI-Act-Check', text: 'Laufende Prüfung der veröffentlichten Seite.', evidenceId: null },
          ],
          cta: { label: 'Optionen ansehen', href: '#kontakt', origin: 'proposed' },
        });
    }
  });
}

function heroCopy(key: RebuildDirectionKey, e: Editorial, primary: RebuildCta): { text: Record<string, string>; placeholder: boolean } {
  const offerHasPlace = mentionsLocality(e.offer, e.locality);
  const where = e.locality && !offerHasPlace ? ` in ${e.locality}` : '';
  const audience = e.audience ? `Für ${e.audience}` : null;
  const services = e.services.slice(0, 3).map((s) => s.title).join(', ');
  const offer = e.offer ? limitWords(e.offer, 12) : null;
  const placeholder = offer === null;
  const headlineFallback = e.industryLabel ? `${e.brand} — ${e.industryLabel}${where}` : `${e.brand}: Angebot in einem Satz ergänzen`;

  switch (key) {
    case 'clean-enterprise':
      return { placeholder, text: { eyebrow: e.industryLabel ?? e.brand, headline: offer ?? headlineFallback, subline: [audience ? `${audience}${where}.` : where ? `In ${e.locality}.` : null, services ? `${services}.` : e.firstSentence].filter(Boolean).join(' ') || `${e.brand} — klar strukturiert, verlässlich umgesetzt.` } };
    case 'conversion-focus': {
      const fact = e.proof.find((p) => !p.placeholder && (p.kind === 'years' || p.kind === 'rating' || p.kind === 'customers'));
      return { placeholder, text: { eyebrow: fact ? fact.text : audience ?? e.brand, headline: offer ?? headlineFallback, subline: `${services ? `${services}. ` : ''}Nächster Schritt: ${primary.label}.` } };
    }
    case 'local-trust': {
      const local = e.proof.find((p) => !p.placeholder && (p.kind === 'years' || p.kind === 'membership'));
      return { placeholder, text: { eyebrow: local ? local.text : `${e.industryLabel ?? e.brand}${where ? ` · ${e.locality}` : ''}`, headline: offer ? `${offer}${where}` : `${e.brand}${where}`, subline: [services ? `${services}.` : e.firstSentence, e.phone ? 'Persönlich erreichbar — telefonisch oder per Anfrage.' : 'Persönlich erreichbar per Anfrage.'].filter(Boolean).join(' ') } };
    }
    case 'premium-advisory':
      return { placeholder, text: { eyebrow: e.brand, headline: offer ?? headlineFallback, subline: e.firstSentence ?? (services ? `${services}.` : 'Beratung mit klarer Verantwortung.') } };
    case 'governance-first':
      return { placeholder, text: { eyebrow: audience ?? e.industryLabel ?? e.brand, headline: offer ?? headlineFallback, subline: [services ? `${services}.` : e.firstSentence, 'Jeder Schritt nachvollziehbar, jede Automatisierung mit Freigabe.'].filter(Boolean).join(' ') } };
  }
}

function problemSolutionCopy(e: Editorial): Record<string, string> {
  const problem = PROBLEM_BY_INDUSTRY[e.industry ?? 'sonstiges'];
  const solution = e.offer
    ? `${e.brand} — ${e.offer}.${e.services.length > 0 ? ` Konkret: ${e.services.slice(0, 3).map((s) => s.title).join(', ')}.` : ''}`
    : `${e.brand} beantwortet genau das${e.services.length > 0 ? `: ${e.services.slice(0, 3).map((s) => s.title).join(', ')}` : ''}.`;
  return { heading: 'Worum es geht', problem, solution };
}

const PROBLEM_BY_INDUSTRY: Readonly<Record<IndustryKey, string>> = Object.freeze({
  zahnarzt: 'Wer eine Praxis sucht, will wissen: Welche Behandlungen, wie schnell ein Termin, wie der Umgang ist. Das steht selten auf der ersten Seite.',
  arztpraxis: 'Patientinnen und Patienten suchen Leistungen, Sprechzeiten und einen einfachen Weg zum Termin — und finden oft nur eine Begrüßung.',
  rechtsanwalt: 'Mandanten kommen mit einem konkreten Problem. Sie brauchen in Sekunden die Antwort: Ist das mein Rechtsgebiet, und wie beginnt das Gespräch?',
  steuerberatung: 'Unternehmer wechseln den Steuerberater selten — und wenn, dann wegen Erreichbarkeit und Klarheit. Beides muss die Seite vorwegnehmen.',
  handwerk: 'Wer einen Betrieb sucht, hat ein Problem, das heute gelöst werden soll. Unklare Leistungen und versteckte Telefonnummern kosten den Auftrag.',
  gastronomie: 'Gäste entscheiden in Sekunden: Karte, Öffnungszeiten, Reservierung. Alles andere ist Dekoration.',
  immobilien: 'Eigentümer und Suchende wollen Vertrauen und Zahlen, keine Stockfotos. Die Seite muss beides zeigen — belegt.',
  agentur: 'Agenturseiten reden gern über sich. Kunden wollen wissen, was sie bekommen und was es sie kostet.',
  ecommerce: 'Ein Shop lebt vom kürzesten Weg zum Produkt. Jeder Umweg ist ein verlorener Warenkorb.',
  sonstiges: 'Besucher haben eine Frage und wenig Zeit. Eine Seite, die nicht in einem Satz sagt, was sie anbietet, wird verlassen.',
});

function processSteps(e: Editorial, primary: RebuildCta): RebuildItem[] {
  return [
    { title: '1. Anfrage', text: `${primary.label} — per Formular${e.phone ? ' oder Anruf' : ''}. Sie beschreiben kurz Ihr Anliegen.`, evidenceId: null },
    { title: '2. Gespräch', text: 'Rückmeldung mit Rückfragen und einem ersten Vorschlag.', evidenceId: null },
    { title: '3. Angebot', text: 'Ein konkretes Angebot mit Umfang und Preislogik.', evidenceId: null },
    { title: '4. Umsetzung', text: 'Verbindlicher Ablauf, feste Ansprechperson.', evidenceId: null },
  ];
}

function industryQuestions(industry: IndustryKey | null): string[] {
  switch (industry) {
    case 'zahnarzt':
    case 'arztpraxis':
      return ['Wie bekomme ich einen Termin?', 'Welche Kassen werden akzeptiert?', 'Was muss ich zum ersten Besuch mitbringen?'];
    case 'rechtsanwalt':
      return ['Was kostet ein Erstgespräch?', 'Welche Unterlagen brauchen Sie von mir?', 'Wie schnell erhalte ich eine Einschätzung?'];
    case 'steuerberatung':
      return ['Wie läuft ein Wechsel des Steuerberaters ab?', 'Arbeiten Sie digital?', 'Was kostet die laufende Betreuung?'];
    case 'handwerk':
      return ['Wie schnell können Sie kommen?', 'Gibt es einen Festpreis?', 'Übernehmen Sie auch kleine Aufträge?'];
    case 'gastronomie':
      return ['Kann ich reservieren?', 'Gibt es vegetarische Optionen?', 'Wie sind die Öffnungszeiten?'];
    case 'immobilien':
      return ['Wie läuft eine Bewertung ab?', 'Was kostet die Vermittlung?', 'Wie lange dauert ein Verkauf?'];
    default:
      return ['Wie läuft eine Zusammenarbeit ab?', 'Was kostet das?', 'Wie schnell erhalte ich eine Antwort?'];
  }
}

function labelForProof(kind: ProofItem['kind']): string {
  switch (kind) {
    case 'rating': return 'Bewertung';
    case 'certificate': return 'Zertifikat';
    case 'years': return 'Erfahrung';
    case 'customers': return 'Kunden';
    case 'membership': return 'Mitgliedschaft';
    case 'award': return 'Auszeichnung';
    case 'guarantee': return 'Garantie';
    case 'reference': return 'Referenz';
    case 'legal-badge': return 'Datenschutz';
    default: return 'Beleg';
  }
}
