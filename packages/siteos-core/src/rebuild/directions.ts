// REBUILD — zwei bis drei Richtungen aus einem Snapshot.
//
// Eine Richtung ist keine Farbvariante, sondern eine Haltung: Reihenfolge
// der Abschnitte, Hero-Aufbau, Gewicht der Handlungsaufforderung,
// Design-System. Die Inhalte sind in allen Richtungen dieselben belegten
// Inhalte der Ausgangsseite — anders angeordnet, anders gewichtet.
//
// ## Was hier nicht passiert
//
// Ein Abschnitt ohne belegte Inhalte wird nicht mit etwas Plausiblem
// gefüllt. Keine Referenzen → keine Referenzen, sondern ein Eintrag in
// `omitted` mit Grund. Das ist die sichtbare Seite derselben Regel, die im
// Renderer leere Kundenstimmen gar nicht erst ausliefert (§ 5 UWG).
//
// ## Warum das Ergebnis ein normaler Blueprint ist
//
// Damit gilt alles, was für jeden Blueprint gilt: kanonischer Hash,
// Kette, statische Analyse, Publish Gate, Block-Editor. Die Herkunft ist
// `import` — der Publish Gate behandelt die Site damit als Transformation
// einer bestehenden Seite, nicht als Neubau (siehe `publish-gate.ts`,
// `deriveBackendState`).

import { deriveCompliance, slugify, buildBlock } from '../blueprint/synthesize.ts';
import { getIndustryPreset } from '../blueprint/industries.ts';
import type { SiteBrief } from '../blueprint/brief.ts';
import type { BlockKind, SiteBlock, SiteBlueprint, SitePage } from '../types.ts';
import { composeHero, composeSeo, displayName, primaryCta, secondaryCta, joinList, trimToSentence } from './copy.ts';
import { deriveDesignSpec, directionLabel, readBrandSignals, themeFromDesign, type DirectionKey } from './design-system.ts';
import type { Assessment, Positioning, SourceSnapshot, TrustSignal } from './types.ts';
import { toWellFormed } from './well-formed.ts';

export type { DirectionKey } from './design-system.ts';

export interface DirectionPlan {
  key: DirectionKey;
  label: string;
  /** Ein Satz: wofür die Richtung steht. */
  tagline: string;
  /** Warum sie zu dieser Website passt — mit Bezug auf Befunde. */
  rationale: string[];
}

export interface SectionReport {
  kind: BlockKind;
  /** `quelle`: Wortlaut der Ausgangsseite · `abgeleitet`: aus belegten Daten zusammengesetzt · `system`: von der Plattform garantiert. */
  origin: 'quelle' | 'abgeleitet' | 'system';
  evidence: string[];
}

export interface DirectionBuild {
  plan: DirectionPlan;
  blueprint: SiteBlueprint;
  report: {
    sections: SectionReport[];
    omitted: { kind: BlockKind; reason: string }[];
    rejectedClaims: string[];
    /** Formularziel der Ausgangsseite — Vorschlag, nicht übernommen. */
    formTargetHint: FormTargetHint | null;
    /** Fremd-Einbindungen der Quelle, die der Rebuild nicht übernimmt. */
    droppedThirdParties: { host: string; category: string }[];
    /** Weiterleitungen alter Pfade auf neue Seiten (für den Export). */
    redirects: { from: string; to: string }[];
  };
}

export interface FormTargetHint {
  url: string;
  /** `cms-plugin`: Formular-Plugin eines CMS — erwartet eigene Felder und Tokens. */
  backend: 'cms-plugin' | 'endpoint' | 'mailto' | 'third-party';
  label: string;
  evidence: string;
}

const LOCAL_INDUSTRIES = new Set(['handwerk', 'gastronomie', 'zahnarzt', 'arztpraxis', 'immobilien']);

const TAGLINES: Readonly<Record<DirectionKey, string>> = {
  'clean-enterprise': 'Klar, sachlich, belastbar — Angebot und Nachweise im Vordergrund.',
  'conversion-focus': 'Kurzer Weg zur Anfrage — Handlungsaufforderung und Formular früh auf der Seite.',
  'local-trust': 'Nahbar und vor Ort — Kontakt, Anschrift und Stimmen stehen vorn.',
  'premium-advisory': 'Ruhig und hochwertig — Beratung statt Verkauf, viel Raum für Inhalt.',
};

/** Welche Richtungen passen? Immer zwei, eine dritte nach Lage. */
export function planDirections(snapshot: SourceSnapshot, positioning: Positioning, assessment: Assessment): DirectionPlan[] {
  const score = (criterion: string) => assessment.criteria.find((c) => c.criterion === criterion)?.score ?? 100;
  const codes = new Set(assessment.findings.map((f) => f.code));
  const locality = positioning.locality.value;
  const industry = positioning.industry.value;

  const enterprise: DirectionPlan = {
    key: 'clean-enterprise', label: directionLabel('clean-enterprise'), tagline: TAGLINES['clean-enterprise'],
    rationale: [
      score('visual-hierarchy') < 80 ? `Visuelle Hierarchie bei ${score('visual-hierarchy')}/100 — klare Gliederung und ruhige Typografie.` : 'Klare Gliederung mit ruhiger Typografie und viel Weißraum.',
      codes.has('rebuild.hero.generic-headline') ? 'Die H1 bekommt eine Aussage statt einer Begrüßung.' : 'Die Hauptaussage bleibt, die Nachweise rücken nach oben.',
    ],
  };
  const conversion: DirectionPlan = {
    key: 'conversion-focus', label: directionLabel('conversion-focus'), tagline: TAGLINES['conversion-focus'],
    rationale: [
      score('cta-structure') < 80 || score('conversion-focus') < 80
        ? `CTA-Struktur ${score('cta-structure')}/100, Conversion-Fokus ${score('conversion-focus')}/100 — Anfrage direkt unter den Hero.`
        : 'Anfrage direkt unter den Hero; die Handlungsaufforderung steht zusätzlich im Kopf.',
      score('mobile-ux') < 80 ? `Mobile UX ${score('mobile-ux')}/100 — einspaltig mobil, Anruf mit einem Tipp.` : 'Kurze Wege auf dem Smartphone: Anruf und Anfrage mit einem Tipp.',
    ],
  };
  const plans = [enterprise, conversion];

  if (locality || (industry && LOCAL_INDUSTRIES.has(industry))) {
    plans.push({
      key: 'local-trust', label: directionLabel('local-trust'), tagline: TAGLINES['local-trust'],
      rationale: [
        locality ? `Ort belegt (${locality}) — Anschrift, Öffnungszeiten und Anfahrt stehen vorn.` : 'Branche mit lokalem Einzugsgebiet — Kontakt und Anschrift stehen vorn.',
        score('trust-signals') < 80 ? `Vertrauenssignale ${score('trust-signals')}/100 — belegte Signale direkt unter den Hero.` : 'Belegte Vertrauenssignale und Stimmen früh auf der Seite.',
      ],
    });
  } else {
    plans.push({
      key: 'premium-advisory', label: directionLabel('premium-advisory'), tagline: TAGLINES['premium-advisory'],
      rationale: [
        positioning.audience.value === 'b2b' ? 'Geschäftskunden-Zielgruppe — beratende statt verkaufende Anmutung.' : 'Beratende statt verkaufende Anmutung.',
        'Serifen-Überschriften, reduzierte Farbe, viel Raum für Inhalt.',
      ],
    });
  }
  return plans;
}

// ─────────────────────────────────────────────────────────────────────
// Aufbau
// ─────────────────────────────────────────────────────────────────────

const HOME_PLANS: Readonly<Record<DirectionKey, BlockKind[]>> = {
  'clean-enterprise': ['hero', 'trust-bar', 'services', 'problem-solution', 'process', 'case-study', 'testimonials', 'faq', 'contact-info', 'contact-form', 'governance'],
  'conversion-focus': ['hero', 'trust-bar', 'contact-form', 'services', 'process', 'testimonials', 'pricing', 'faq', 'cta', 'governance'],
  'local-trust': ['hero', 'trust-bar', 'services', 'about', 'testimonials', 'contact-info', 'map', 'contact-form', 'faq', 'governance'],
  'premium-advisory': ['hero', 'problem-solution', 'services', 'process', 'case-study', 'testimonials', 'faq', 'contact-form', 'governance'],
};

const FORM_ANCHOR = '#anfrage';
const SERVICES_ANCHOR = '#leistungen';

interface Ingredients {
  name: string;
  locality: string | null;
  offers: { label: string; description: string | null; ev: string }[];
  trust: { label: string; ev: string }[];
  testimonials: { quote: string; author: string | null; ev: string }[];
  process: { heading: string; steps: string[]; ev: string } | null;
  caseStudies: { title: string; text: string; ev: string }[];
  about: { heading: string; text: string; ev: string } | null;
  faqs: { question: string; answer: string; ev: string }[];
  prices: { label: string; price: string; ev: string }[];
  contact: { phone: string | null; phoneHref: string | null; email: string | null; address: string | null; hours: string | null; ev: string[] };
  formHint: FormTargetHint | null;
  formFields: string[];
  heroImage: { src: string; alt: string; ev: string } | null;
}

export interface BuildDirectionOptions {
  createdAt?: string;
  /**
   * Analyse-Lauf, aus dem abgeleitet wird (serverseitig vergeben). Landet
   * als `origin.rebuild` im Blueprint und damit in seinem Hash — Vorschau
   * und Übernahme leiten mit demselben Wert ab.
   */
  run?: { id: string; snapshotSha256: string };
}

export function buildDirection(
  snapshot: SourceSnapshot,
  positioning: Positioning,
  assessment: Assessment,
  key: DirectionKey,
  options: BuildDirectionOptions = {},
): DirectionBuild {
  const plan = planDirections(snapshot, positioning, assessment).find((p) => p.key === key)
    ?? { key, label: directionLabel(key), tagline: TAGLINES[key], rationale: [] };
  const ing = gatherIngredients(snapshot, positioning);
  const brand = readBrandSignals(snapshot);
  const design = deriveDesignSpec(brand, key);
  const industry = positioning.industry.value ?? 'sonstiges';
  const preset = getIndustryPreset(industry);

  const brief: SiteBrief = {
    name: ing.name,
    industry,
    locality: ing.locality,
    summary: composeSeo(snapshot, positioning).description,
    services: ing.offers.map((o) => o.label),
    highlights: ing.trust.map((t) => t.label),
    locale: 'de',
    industryConfident: positioning.industry.status === 'known',
  };

  const sections: SectionReport[] = [];
  const omitted: { kind: BlockKind; reason: string }[] = [];
  const seo = composeSeo(snapshot, positioning);
  const primary = primaryCta(snapshot, positioning, FORM_ANCHOR);
  // Ohne erkanntes Angebot gibt es keinen Leistungsblock und damit keinen
  // Anker `#leistungen` — dann lieber kein zweiter Knopf als einer ins Leere.
  const offered = secondaryCta(snapshot, primary, SERVICES_ANCHOR);
  const secondary = offered.href === SERVICES_ANCHOR && ing.offers.length === 0 ? null : offered;
  // Die Nachweiszeile im Hero nur, wo die Vertrauensleiste nicht ohnehin
  // direkt darunter steht — sonst stünde dasselbe zweimal übereinander.
  const trustFollowsHero = HOME_PLANS[key][1] === 'trust-bar' && ing.trust.length > 0;
  const hero = composeHero(snapshot, positioning, key, trustFollowsHero ? [] : proofLine(ing.trust));
  const rejectedClaims = [...hero.rejected];

  // ── Seitenplan ──────────────────────────────────────────────────────
  const pagePlan: { path: string; title: string }[] = [{ path: '/', title: 'Startseite' }];
  if (ing.offers.length > 0) pagePlan.push({ path: '/leistungen', title: industry === 'steuerberatung' || industry === 'rechtsanwalt' ? 'Beratungsfelder' : 'Leistungen' });
  if (ing.about) pagePlan.push({ path: '/ueber-uns', title: 'Über uns' });
  if (ing.testimonials.length + ing.caseStudies.length >= 2) pagePlan.push({ path: '/referenzen', title: 'Referenzen' });
  if (ing.prices.length >= 2) pagePlan.push({ path: '/preise', title: 'Preise' });
  pagePlan.push({ path: '/kontakt', title: 'Kontakt' });

  const navLinks = pagePlan.filter((p) => p.path !== '/').map((p) => ({ label: p.title, href: p.path }));
  const headerCta = design.headerCta ? { label: primary.label, href: primary.href.startsWith('#') ? `/kontakt${primary.href}` : primary.href } : undefined;

  const pages: SitePage[] = [];
  for (const planned of pagePlan) {
    const kinds: BlockKind[] = planned.path === '/'
      ? HOME_PLANS[key]
      : planned.path === '/leistungen'
        ? ['hero', 'services', 'process', 'faq', 'cta']
        : planned.path === '/ueber-uns'
          ? ['hero', 'about', 'trust-bar', 'cta']
          : planned.path === '/referenzen'
            ? ['hero', 'testimonials', 'case-study', 'cta']
            : planned.path === '/preise'
              ? ['hero', 'pricing', 'faq', 'cta']
              : ['hero', 'contact-info', 'map', 'contact-form'];

    const blocks: SiteBlock[] = [];
    const nav = buildBlock('navigation', 0, planned.path, brief, false);
    nav.content = { brand: ing.name, links: navLinks, ...(headerCta ? { cta: headerCta } : {}) };
    blocks.push(nav);

    for (const kind of kinds) {
      const index = blocks.length;
      const isHome = planned.path === '/';
      const made = makeBlock(kind, index, planned, { ing, hero, primary, secondary, design, isHome, brief, locality: ing.locality, name: ing.name, tone: positioning.tone.value ?? 'sie' });
      if (made === null) {
        if (isHome && !omitted.some((o) => o.kind === kind)) omitted.push({ kind, reason: omissionReason(kind, ing) });
        continue;
      }
      blocks.push(made.block);
      if (isHome && !sections.some((s) => s.kind === kind)) sections.push({ kind, origin: made.origin, evidence: made.evidence });
    }

    const footer = buildBlock('footer', blocks.length, planned.path, brief, false);
    footer.content = {
      ...footer.content,
      brand: ing.name,
      summary: trimToSentence(seo.description, 140),
      contactLines: [ing.contact.address, ing.contact.phone, ing.contact.email].filter((v): v is string => typeof v === 'string'),
      links: navLinks,
    };
    blocks.push(footer);

    pages.push({
      path: planned.path,
      title: planned.title,
      description: planned.path === '/' ? seo.description : subpageDescription(planned, ing),
      blocks,
      noindex: false,
    });
  }

  // Rechtsseiten: Pflicht, Text aus dem Legal-Modul (nie generiert).
  for (const legal of [
    { path: '/impressum', title: 'Impressum' },
    { path: '/datenschutz', title: 'Datenschutzerklärung' },
    { path: '/barrierefreiheit', title: 'Erklärung zur Barrierefreiheit' },
  ]) {
    const nav = buildBlock('navigation', 0, legal.path, brief, false);
    const footer = buildBlock('footer', 2, legal.path, brief, false);
    const blocks: SiteBlock[] = [
      { ...nav, content: { brand: ing.name, links: navLinks, ...(headerCta ? { cta: headerCta } : {}) } },
      buildBlock('legal-text', 1, legal.path, brief, false),
      { ...footer, content: { ...footer.content, brand: ing.name, links: navLinks } },
    ];
    pages.push({ path: legal.path, title: legal.title, description: `${legal.title} — ${ing.name}.`, blocks, noindex: false });
  }

  const compliance = deriveCompliance(brief, pages, preset.compliance);
  const organization = organizationFacts(snapshot);
  const structuredDataType = sourceSchemaType(snapshot) ?? preset.structuredDataType;

  const blueprint: SiteBlueprint = {
    schemaVersion: 1,
    slug: slugify(snapshot.host.replace(/^www\./, '')),
    name: ing.name,
    industry,
    locales: { default: 'de', supported: ['de'] },
    theme: themeFromDesign(design),
    pages,
    seo: {
      siteName: ing.name,
      defaultTitle: seo.title,
      defaultDescription: seo.description,
      keywords: keywordsOf(ing, preset.label),
      structuredDataType,
      locality: ing.locality,
      ...(organization ? { organization } : {}),
    },
    compliance,
    origin: {
      source: 'import',
      model: null,
      promptSha256: null,
      createdAt: options.createdAt ?? new Date(0).toISOString(),
      ...(options.run ? { rebuild: { runId: options.run.id, snapshotSha256: options.run.snapshotSha256 } } : {}),
    },
    design,
  };

  const kept = new Set(snapshot.pages.flatMap((p) => p.thirdParty).map((t) => `${t.host}|${t.category}`));
  const droppedThirdParties = [...kept]
    .map((entry) => {
      const [host, category] = entry.split('|');
      return { host, category };
    })
    .filter((t) => t.category !== 'cdn');

  // Speicherbar (siehe `well-formed.ts`): Kürzungen in der Copy dürfen kein
  // halbes Emoji in einen Blueprint tragen, den Postgres ablehnt.
  return toWellFormed({
    plan,
    blueprint,
    report: {
      sections,
      omitted,
      rejectedClaims,
      formTargetHint: ing.formHint,
      droppedThirdParties,
      redirects: redirectsFor(snapshot, pagePlan.map((p) => p.path)),
    },
  });
}

/** Baut alle geplanten Richtungen. */
export function buildDirections(snapshot: SourceSnapshot, positioning: Positioning, assessment: Assessment, options: BuildDirectionOptions = {}): DirectionBuild[] {
  return planDirections(snapshot, positioning, assessment).map((plan) => buildDirection(snapshot, positioning, assessment, plan.key, options));
}

// ─────────────────────────────────────────────────────────────────────
// Zutaten: was die Quelle belegt
// ─────────────────────────────────────────────────────────────────────

const PROCESS_HEADING = /(ablauf|so funktioniert|so arbeiten wir|in \d schritten|schritt für schritt|vorgehen|prozess|zusammenarbeit|wie wir arbeiten)/i;
const CASE_HEADING = /(referenz|projekt|case|erfolgsgeschicht|kundenprojekt|fallbeispiel)/i;
const ABOUT_HEADING = /(über uns|ueber uns|wir über uns|unternehmen|kanzlei|praxis|geschichte|philosophie|wer wir sind|warum)/i;
const CTA_LIKE = /\b(vereinbaren|anfragen|buchen|kontaktieren|sichern|starten|anrufen|jetzt)\b/i;
const CMS_FORM = /(wpcf7|wpforms|gform|elementor-form|ninja-forms|et_pb_contact|tx-powermail|fusion-form|forminator|caldera|formidable|jetpack-contact)/;

function gatherIngredients(snapshot: SourceSnapshot, positioning: Positioning): Ingredients {
  const pages = snapshot.pages;
  const company = positioning.companyName.value;
  const name = company ? displayName(company) : displayName(snapshot.host.replace(/^www\./, ''));

  // Leistungen mit Beschreibung aus dem jeweiligen Unterabschnitt.
  const offers: Ingredients['offers'] = [];
  const offerEvidence = positioning.offer.status === 'known' ? positioning.offer.evidence[0] ?? '' : '';
  for (const label of positioning.offer.value ?? []) {
    const section = pages.flatMap((p) => p.sections).find((s) => s.heading.toLowerCase() === label.toLowerCase() && s.text);
    offers.push({ label, description: section?.text ? trimToSentence(section.text, 170) : null, ev: section?.ev ?? offerEvidence });
  }

  // Vertrauenssignale: belegt, kurz, ohne Rechtslinks, ohne Teilaussagen.
  const trustRaw = pages.flatMap((p) => p.trust).filter((t) => !['imprint-link', 'privacy-link', 'testimonial'].includes(t.kind));
  const trust: Ingredients['trust'] = [];
  const kinds = new Set<string>();
  for (const signal of prioritizeTrust(trustRaw)) {
    const label = trustLabel(signal);
    if (!label || label.length > 64) continue;
    // Eine Aufforderung ist kein Nachweis („Kostenloses Erstgespräch vereinbaren").
    if (CTA_LIKE.test(label)) continue;
    // Eine Jahresangabe genügt („Seit 1998" und „Seit mehr als 25 Jahren" sagen dasselbe).
    if (signal.kind === 'years' && kinds.has('years')) continue;
    const lower = label.toLowerCase();
    if (trust.some((t) => t.label.toLowerCase().includes(lower) || lower.includes(t.label.toLowerCase()))) continue;
    trust.push({ label, ev: signal.ev });
    kinds.add(signal.kind);
    if (trust.length >= 5) break;
  }

  const testimonials = pages.flatMap((p) => p.trust).filter((t) => t.kind === 'testimonial').slice(0, 6)
    .map((t) => ({ quote: t.value, author: t.detail, ev: t.ev }));

  const processSection = pages.flatMap((p) => p.sections).find((s) => PROCESS_HEADING.test(s.heading) && s.items.length >= 2);
  const process = processSection
    ? { heading: processSection.heading, steps: processSection.items.slice(0, 6).map((i) => i.replace(/^\d+[.)]\s*/, '')), ev: processSection.ev }
    : null;

  const caseStudies = pages.flatMap((p) => p.sections).filter((s) => CASE_HEADING.test(s.heading) && s.text).slice(0, 4)
    .map((s) => ({ title: s.heading, text: trimToSentence(s.text as string, 240), ev: s.ev }));

  const aboutSection = pages.flatMap((p) => p.sections).find((s) => ABOUT_HEADING.test(s.heading) && s.text && s.text.length >= 80);
  const about = aboutSection ? { heading: aboutSection.heading, text: trimToSentence(aboutSection.text as string, 420), ev: aboutSection.ev } : null;

  const faqs = pages.flatMap((p) => p.faqs).slice(0, 8);
  const prices = pages.flatMap((p) => p.prices).slice(0, 6).map((p) => ({ label: p.label ?? 'Preis', price: p.text.replace(p.label ?? '', '').trim() || p.text, ev: p.ev }));

  const phones = pages.flatMap((p) => p.contact.phones);
  const phone = phones.find((p) => p.source === 'link') ?? phones.find((p) => p.source === 'text') ?? phones[0] ?? null;
  const email = pages.flatMap((p) => p.contact.emails)[0] ?? null;
  const address = pages.map((p) => p.contact.address).find((a) => a !== null) ?? null;
  const hours = pages.map((p) => p.contact.openingHours).find((h) => h !== null) ?? null;

  // Formularziel: Vorschlag aus dem ersten Anfrageformular — nicht übernommen.
  const leadForm = pages.flatMap((p) => p.forms).find((f) => f.purpose === 'contact' || f.purpose === 'booking');
  let formHint: FormTargetHint | null = null;
  if (leadForm && leadForm.action) {
    const evidence = snapshot.evidence.find((e) => e.id === leadForm.ev);
    const cms = CMS_FORM.test((evidence?.excerpt ?? '').toLowerCase());
    formHint = {
      url: leadForm.action,
      backend: leadForm.targetKind === 'mailto' ? 'mailto' : cms ? 'cms-plugin' : leadForm.targetKind === 'other-host' ? 'third-party' : 'endpoint',
      label: cms ? 'Formular-Plugin eines CMS' : leadForm.targetKind === 'mailto' ? 'E-Mail' : 'Formularziel der bisherigen Seite',
      evidence: leadForm.ev,
    };
  }
  const formFields = mapFormFields(leadForm?.fields.map((f) => `${f.name} ${f.type} ${f.label ?? ''}`) ?? []);

  const heroImage = pickHeroImage(snapshot, name);

  return {
    name,
    locality: positioning.locality.value,
    offers,
    trust,
    testimonials,
    process,
    caseStudies,
    about,
    faqs,
    prices,
    contact: {
      phone: phone?.value ?? null,
      phoneHref: phone ? phone.href ?? `tel:${phone.value.replace(/[^\d+]/g, '')}` : null,
      email: email?.value ?? null,
      address: address?.value ?? null,
      hours: hours?.value ?? null,
      ev: [phone?.ev, email?.ev, address?.ev, hours?.ev].filter((e): e is string => typeof e === 'string'),
    },
    formHint,
    formFields,
    heroImage,
  };
}

function prioritizeTrust(signals: TrustSignal[]): TrustSignal[] {
  const order: TrustSignal['kind'][] = ['rating', 'certification', 'membership', 'award', 'years', 'client-logos', 'review-widget', 'guarantee'];
  return [...signals].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.value.length - b.value.length);
}

function trustLabel(signal: TrustSignal): string | null {
  switch (signal.kind) {
    case 'rating':
      // Nur übernommen, wenn die Bewertung auf der Quelle sichtbar war
      // (`extract.ts`); die Plattform bleibt genannt, wo sie belegt ist.
      return signal.detail ? `${signal.value} bei ${signal.detail}` : signal.value;
    case 'review-widget':
      return `Bewertungsprofil bei ${signal.value}`;
    case 'client-logos':
      return signal.detail ? `Kunden: ${signal.detail.split(', ').slice(0, 3).join(', ')}` : null;
    default: {
      const value = signal.value.replace(/^…|…$/g, '').trim();
      return value.length >= 3 ? capitalizeFirst(value) : null;
    }
  }
}

function proofLine(trust: { label: string }[]): string[] {
  return trust.filter((t) => t.label.length <= 42).slice(0, 3).map((t) => t.label);
}

function mapFormFields(descriptors: string[]): string[] {
  const out: string[] = [];
  const add = (name: string) => {
    if (!out.includes(name)) out.push(name);
  };
  for (const descriptor of descriptors) {
    const d = descriptor.toLowerCase();
    if (/(e-?mail)/.test(d)) add('email');
    else if (/(tel|phone|fon|mobil)/.test(d)) add('phone');
    else if (/(textarea|nachricht|message|anliegen|anfrage|kommentar)/.test(d)) add('message');
    else if (/(date|time|termin|datum|wunschtermin)/.test(d)) add('slot');
    else if (/(name|vorname|nachname)/.test(d)) add('name');
  }
  // Die Kurzform bleibt kurz: Name, E-Mail, Telefon, Nachricht.
  const base = ['name', 'email', 'phone', 'message'].filter((f) => out.length === 0 || out.includes(f) || f === 'name' || f === 'email' || f === 'message');
  if (out.includes('slot')) base.push('slot');
  return base;
}

function pickHeroImage(snapshot: SourceSnapshot, name: string): Ingredients['heroImage'] {
  const home = snapshot.pages[0];
  if (!home) return null;
  const candidates = home.images.filter((i) => !i.isLogoCandidate && (i.width === null || i.width >= 480));
  const pick = candidates.find((i) => i.alt && i.alt.length >= 3) ?? candidates[0];
  if (pick) return { src: pick.src, alt: pick.alt && pick.alt.length >= 3 ? pick.alt : `${name} — Ansicht`, ev: pick.ev };
  if (home.ogImage) return { src: home.ogImage, alt: `${name} — Ansicht`, ev: home.documentEv };
  return null;
}

function omissionReason(kind: BlockKind, ing: Ingredients): string {
  switch (kind) {
    case 'trust-bar': return 'Keine belegten Vertrauenssignale (Siegel, Mitgliedschaften, Bewertungen) auf der Ausgangsseite.';
    case 'testimonials': return 'Keine Kundenstimmen auf der Ausgangsseite — es werden keine erfunden.';
    case 'case-study': return 'Keine Referenz- oder Projektbeschreibungen auf der Ausgangsseite.';
    case 'process': return 'Kein beschriebener Ablauf auf der Ausgangsseite.';
    case 'pricing': return 'Keine Preisangaben auf der Ausgangsseite.';
    case 'faq': return 'Keine beantworteten Fragen auf der Ausgangsseite.';
    case 'about': return 'Kein „Über uns"-Text auf der Ausgangsseite.';
    case 'contact-info': return 'Keine Kontaktdaten auf den gelesenen Seiten.';
    case 'map': return ing.contact.address ? 'Karte nur in der Richtung „Local Trust".' : 'Keine Anschrift belegt.';
    case 'problem-solution': return 'Angebot oder Nutzenversprechen nicht belegt.';
    case 'services': return 'Kein Angebot erkennbar.';
    default: return 'Keine belegten Inhalte.';
  }
}

// ─────────────────────────────────────────────────────────────────────
// Blöcke
// ─────────────────────────────────────────────────────────────────────

interface MakeContext {
  ing: Ingredients;
  hero: ReturnType<typeof composeHero>;
  primary: { label: string; href: string };
  secondary: { label: string; href: string } | null;
  design: NonNullable<SiteBlueprint['design']>;
  isHome: boolean;
  brief: SiteBrief;
  locality: string | null;
  name: string;
  tone: 'sie' | 'du';
}

function makeBlock(
  kind: BlockKind,
  index: number,
  page: { path: string; title: string },
  ctx: MakeContext,
): { block: SiteBlock; origin: SectionReport['origin']; evidence: string[] } | null {
  const { ing } = ctx;
  const base = buildBlock(kind, index, page.path, ctx.brief, false);
  const done = (content: Record<string, unknown>, origin: SectionReport['origin'], evidence: (string | null | undefined)[]) => ({
    // `undefined` entfernt ein Feld des Grundbausteins (z. B. den CTA im
    // Hero einer Unterseite) — es wird nicht als leerer Wert gespeichert.
    block: { ...base, content: compact({ ...base.content, ...content }) },
    origin,
    evidence: [...new Set(evidence.filter((e): e is string => typeof e === 'string' && e !== ''))],
  });
  // Startseite und Kontaktseite tragen das Formular selbst; Unterseiten
  // verlinken es auf der Kontaktseite.
  const formHref = (href: string) => (href.startsWith('#') && !ctx.isHome && page.path !== '/kontakt' ? `/kontakt${href}` : href);
  const t = (sie: string, du: string) => (ctx.tone === 'du' ? du : sie);

  switch (kind) {
    case 'hero': {
      if (!ctx.isHome) {
        const subpageSub: Record<string, string | null> = {
          '/leistungen': ing.offers.length > 0 ? `${joinList(ing.offers.map((o) => o.label), 4)}.` : null,
          '/kontakt': ing.contact.phone || ing.contact.email ? t('Schreiben Sie uns oder rufen Sie an.', 'Schreib uns oder ruf an.') : null,
        };
        return done({
          headline: page.title,
          subline: subpageSub[page.path] ?? null,
          primaryCta: page.path === '/kontakt' ? undefined : { label: ctx.primary.label, href: formHref(ctx.primary.href) },
          media: undefined,
          variant: 'compact',
          eyebrow: ctx.name,
        }, 'abgeleitet', []);
      }
      const media = ing.heroImage
        ? { kind: 'image', src: ing.heroImage.src, alt: ing.heroImage.alt, ratio: '4:3', rightsConfirmed: false }
        : { kind: 'placeholder', alt: `${ctx.name} — Ansicht`, ratio: '4:3' };
      return done({
        eyebrow: ctx.hero.eyebrow ?? undefined,
        headline: ctx.hero.headline,
        subline: ctx.hero.subline ?? undefined,
        primaryCta: { label: ctx.primary.label, href: ctx.primary.href },
        secondaryCta: ctx.secondary ? { label: ctx.secondary.label, href: ctx.secondary.href } : undefined,
        proof: ctx.hero.proof ?? undefined,
        media,
        variant: ctx.design.hero,
      }, ctx.hero.sources.headline === 'quelle' ? 'quelle' : 'abgeleitet', [ing.heroImage?.ev]);
    }
    case 'trust-bar':
      if (ing.trust.length === 0) return null;
      return done({ heading: null, items: ing.trust.map((t) => ({ label: t.label, source: t.ev })), requiresRealContent: true }, 'quelle', ing.trust.map((t) => t.ev));
    case 'services':
      if (ing.offers.length === 0) return null;
      return done({
        heading: page.path === '/leistungen' ? 'Im Überblick' : ctx.brief.industry === 'steuerberatung' ? 'Beratungsfelder' : 'Leistungen',
        anchor: 'leistungen',
        items: ing.offers.map((o) => (o.description ? { label: o.label, description: o.description } : { label: o.label })),
        variant: ctx.design.cards === 'bordered' ? 'numbered' : 'cards',
      }, 'quelle', ing.offers.map((o) => o.ev));
    case 'problem-solution': {
      const offers = ing.offers.map((o) => o.label);
      if (offers.length === 0) return null;
      const place = ctx.locality ? ` in ${ctx.locality}` : '';
      const solution = ctx.hero.subline ?? `${ctx.name} bietet ${joinList(offers)}${place}.`;
      return done({
        heading: 'Worum es geht',
        problem: t(`Sie suchen ${joinList(offers, 2)}${place}?`, `Du suchst ${joinList(offers, 2)}${place}?`),
        solution,
        // Ein einzelnes Angebot als Aufzählung wiederholte nur die Überschrift.
        points: offers.length >= 2 ? offers.slice(0, 4).map((label) => ({ label })) : [],
      }, 'abgeleitet', ing.offers.map((o) => o.ev));
    }
    case 'process':
      if (!ing.process) return null;
      return done({ heading: ing.process.heading, steps: ing.process.steps.map((title) => ({ title })) }, 'quelle', [ing.process.ev]);
    case 'case-study':
      if (ing.caseStudies.length === 0) return null;
      return done({ heading: 'Referenzen', items: ing.caseStudies.map((c) => ({ title: c.title, text: c.text, source: c.ev })), requiresRealContent: true }, 'quelle', ing.caseStudies.map((c) => c.ev));
    case 'testimonials':
      if (ing.testimonials.length === 0) return null;
      return done({
        heading: 'Stimmen',
        items: ing.testimonials.map((t) => (t.author ? { quote: t.quote, author: t.author, source: t.ev } : { quote: t.quote, source: t.ev })),
        requiresRealContent: true,
      }, 'quelle', ing.testimonials.map((t) => t.ev));
    case 'faq':
      if (ing.faqs.length < 2) return null;
      return done({ heading: 'Häufige Fragen', items: ing.faqs.map((f) => ({ question: f.question, answer: f.answer })) }, 'quelle', ing.faqs.map((f) => f.ev));
    case 'pricing':
      if (ing.prices.length === 0) return null;
      return done({
        heading: 'Preise',
        items: ing.prices.map((p) => ({ label: p.label, price: p.price, source: p.ev })),
        note: 'Preisangaben wie auf der bisherigen Website. Vor Veröffentlichung auf Aktualität prüfen.',
        requiresRealContent: true,
      }, 'quelle', ing.prices.map((p) => p.ev));
    case 'about':
      if (!ing.about) return null;
      return done({ heading: ing.about.heading, body: ing.about.text }, 'quelle', [ing.about.ev]);
    case 'contact-info': {
      const c = ing.contact;
      if (!c.phone && !c.email && !c.address) return null;
      return done({
        heading: 'Kontakt',
        ...(c.phone ? { phone: c.phone, phoneHref: c.phoneHref } : {}),
        ...(c.email ? { email: c.email } : {}),
        ...(c.address ? { address: c.address } : {}),
        ...(c.hours ? { hours: c.hours } : {}),
      }, 'quelle', c.ev);
    }
    case 'map':
      if (!ing.contact.address || (ctx.isHome && ctx.design.direction !== 'local-trust')) return null;
      return done({ heading: 'Anfahrt', locality: ctx.locality }, 'abgeleitet', ing.contact.ev);
    case 'contact-form':
      return done({
        heading: ctx.design.direction === 'premium-advisory' ? 'Gespräch vereinbaren' : 'Anfrage senden',
        intro: ing.contact.phone ? t(`Oder rufen Sie an: ${ing.contact.phone}`, `Oder ruf an: ${ing.contact.phone}`) : undefined,
        anchor: 'anfrage',
        fields: ing.formFields,
        variant: 'lead',
        purpose: 'contact',
        target: '',
        submitLabel: ctx.design.direction === 'premium-advisory' ? 'Anfrage senden' : ctx.primary.label.length <= 24 && !ctx.primary.href.startsWith('tel:') && !/^https?:/.test(ctx.primary.href) ? ctx.primary.label : 'Anfrage senden',
        ...(ing.formHint ? { targetHint: { url: ing.formHint.url, backend: ing.formHint.backend, label: ing.formHint.label } } : {}),
      }, 'system', [ing.formHint?.evidence]);
    case 'governance':
      return done({ heading: 'Datenschutz & Transparenz' }, 'system', []);
    case 'cta':
      return done({
        // Eine Einladung, keine Zusage: nichts über Reaktionszeiten, was die
        // Quelle nicht sagt.
        headline: t('Lassen Sie uns sprechen.', 'Lass uns sprechen.'),
        label: ctx.primary.label,
        href: formHref(ctx.primary.href),
        variant: 'band',
      }, 'abgeleitet', []);
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// SEO-Beiwerk
// ─────────────────────────────────────────────────────────────────────

/**
 * Beschreibung einer Unterseite aus belegten Angaben derselben Seite
 * (Leistungen, Kontaktdaten, Über-uns-Text) — Zielkorridor 50–160 Zeichen,
 * ohne Eigenschaften, die die Quelle nicht nennt.
 */
function subpageDescription(page: { path: string; title: string }, ing: Ingredients): string {
  const place = ing.locality ? ` in ${ing.locality}` : '';
  const offers = ing.offers.map((o) => o.label);
  let text: string;
  switch (page.path) {
    case '/leistungen':
      text = offers.length > 0 ? `${page.title} von ${ing.name}${place}: ${joinList(offers, 5)}.` : `${page.title} von ${ing.name}${place}.`;
      break;
    case '/ueber-uns':
      text = ing.about ? trimToSentence(ing.about.text, 155) : `Über ${ing.name}${place}.`;
      break;
    case '/referenzen':
      text = `Referenzen und Kundenstimmen: Projekte und Erfahrungen mit ${ing.name}${place}.`;
      break;
    case '/preise':
      text = `Preise von ${ing.name}${place}: ${joinList(ing.prices.map((p) => p.label), 4)}.`;
      break;
    case '/kontakt': {
      const ways = [ing.contact.phone ? `Telefon ${ing.contact.phone}` : null, ing.contact.email ? `E-Mail ${ing.contact.email}` : null, ing.contact.address].filter((v): v is string => typeof v === 'string');
      text = ways.length > 0 ? `Kontakt zu ${ing.name}${place}: ${ways.join(', ')}.` : `Kontakt zu ${ing.name}${place} — Anfrage über das Formular.`;
      break;
    }
    default:
      text = `${page.title} — ${ing.name}${place}.`;
  }
  return text.length <= 160 ? text : trimToSentence(text, 155);
}

function organizationFacts(snapshot: SourceSnapshot): NonNullable<SiteBlueprint['seo']['organization']> | null {
  const pages = snapshot.pages;
  const json = pages.map((p) => p.jsonLd).find((j) => j.name) ?? pages[0]?.jsonLd;
  const phone = pages.flatMap((p) => p.contact.phones)[0]?.value;
  const email = pages.flatMap((p) => p.contact.emails)[0]?.value;
  const out: NonNullable<SiteBlueprint['seo']['organization']> = {};
  if (json?.telephone ?? phone) out.telephone = (json?.telephone ?? phone) as string;
  if (json?.email ?? email) out.email = (json?.email ?? email) as string;
  if (json?.streetAddress) out.streetAddress = json.streetAddress;
  if (json?.postalCode) out.postalCode = json.postalCode;
  const sameAs = [...(json?.sameAs ?? []), ...pages.flatMap((p) => p.socialLinks.map((s) => s.href))];
  if (sameAs.length > 0) out.sameAs = [...new Set(sameAs)].slice(0, 6);
  return Object.keys(out).length > 0 ? out : null;
}

function sourceSchemaType(snapshot: SourceSnapshot): string | null {
  for (const page of snapshot.pages) {
    const type = page.jsonLd.types.find((t) => /^[A-Za-z]{3,40}$/.test(t) && !['WebSite', 'WebPage', 'BreadcrumbList', 'FAQPage', 'ImageObject', 'SiteNavigationElement', 'Person'].includes(t));
    if (type) return type;
  }
  return null;
}

function keywordsOf(ing: Ingredients, industryLabel: string): string[] {
  const keywords = new Set<string>();
  for (const offer of ing.offers.slice(0, 6)) keywords.add(offer.label.toLowerCase());
  if (ing.locality) {
    keywords.add(ing.locality.toLowerCase());
    for (const offer of ing.offers.slice(0, 2)) keywords.add(`${offer.label.toLowerCase()} ${ing.locality.toLowerCase()}`);
  }
  if (industryLabel !== 'Allgemein') keywords.add(industryLabel.split(' / ')[0].toLowerCase());
  return [...keywords].sort();
}

/**
 * Weiterleitungen für den aktuellen Stand eines Blueprints — nach
 * Bearbeitungen (Seiten hinzugefügt oder entfernt) aus derselben Quelle neu
 * abgeleitet, nicht aus dem Bericht der ersten Richtung übernommen.
 */
export function redirectsForBlueprint(snapshot: SourceSnapshot, blueprint: SiteBlueprint): { from: string; to: string }[] {
  return redirectsFor(snapshot, blueprint.pages.map((p) => p.path));
}

/** Alte Pfade der Quelle → neue Seiten (für `_redirects` im Export). */
function redirectsFor(snapshot: SourceSnapshot, newPaths: string[]): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = [];
  const targets: [RegExp, string][] = [
    [/(kontakt|contact|anfahrt|anfrage)/, '/kontakt'],
    [/(leistung|service|angebot|beratungsfeld|rechtsgebiet|schwerpunkt)/, '/leistungen'],
    [/(ueber-uns|uber-uns|über-uns|about|unternehmen|team|kanzlei|praxis)/, '/ueber-uns'],
    [/(referenz|projekt|kunden|case)/, '/referenzen'],
    [/(preis|pricing|kosten|tarif)/, '/preise'],
    [/(impressum|imprint)/, '/impressum'],
    [/(datenschutz|privacy)/, '/datenschutz'],
  ];
  const seen = new Set<string>();
  for (const link of snapshot.pages.flatMap((p) => p.internalLinks)) {
    let path: string;
    try {
      path = new URL(link).pathname;
    } catch {
      continue;
    }
    const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path;
    if (normalized === '/' || seen.has(normalized) || newPaths.includes(normalized)) continue;
    const hit = targets.find(([pattern]) => pattern.test(normalized.toLowerCase()));
    if (!hit || !newPaths.includes(hit[1])) continue;
    seen.add(normalized);
    out.push({ from: normalized, to: hit[1] });
    if (out.length >= 40) break;
  }
  return out;
}

function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Entfernt Felder mit `undefined` (sie gelten als „nicht gesetzt"). */
function compact(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) if (value !== undefined) out[key] = value;
  return out;
}
