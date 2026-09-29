// REFINE — gezielte Überarbeitung in Klartext.
//
// „seriöser", „mehr Vertrauen", „weniger Startup, mehr Mittelstand",
// „CTA stärker", „für Steuerberater" … Jede dieser Anweisungen ist hier eine
// **benannte Regel mit festem Umfang**. Sie ändert genau die Stellen, die zu
// ihr gehören, und meldet jede Änderung einzeln (`RefinementChange`) — nichts
// wird „neu gewürfelt".
//
// ## Was keine Regel tut
//
//   • Inhalte erfinden. Keine Regel schreibt eine Zahl, ein Siegel, eine
//     Referenz oder ein Versprechen. Neu gesetzte Texte sind feste,
//     behauptungsfreie Wendungen („Anfrage senden", „Gespräch vereinbaren");
//     alles andere wird gekürzt, verschoben oder aus belegten Blöcken
//     derselben Site übernommen (Kontaktdaten, Vertrauenssignale).
//   • Ausblenden rückgängig machen. Hat jemand einen Block ausgeblendet,
//     war das eine Entscheidung — die Regel nennt ihn, statt ihn zu zeigen.
//   • Pflichten abbauen. Ein Branchenwechsel („für Handwerker") senkt das
//     Compliance-Profil nie unter den bisherigen Stand (Untergrenze). Ob eine
//     frühere Einstufung falsch war, entscheidet eine Person im Publish Gate,
//     nicht eine Formulierung im Eingabefeld.
//
// ## Freitext
//
// Was keine Regel trifft („dunkler", „Akzent #0f766e", „Füge eine
// Referenzseite hinzu"), geht an die allgemeine Verfeinerung
// (`blueprint/refine.ts`). Deren Theme-Änderungen werden anschließend ins
// Design-System übertragen — sonst stünde eine neue Akzentfarbe im Theme,
// während die Seite weiter die alte zeigt.

import type { BlockKind, DesignSpec, IndustryKey, SiteBlock, SiteBlueprint, SitePage } from '../types.ts';
import { getIndustryPreset } from '../blueprint/industries.ts';
import { briefFromBlueprint, refineBlueprint, type RefinementChange } from '../blueprint/refine.ts';
import { buildBlock, deriveCompliance } from '../blueprint/synthesize.ts';
import { trimToSentence } from './copy.ts';
import {
  brandFromDesign,
  classifyFamily,
  deriveDesignSpec,
  directionLabel,
  neutralSurfaceAlt,
  repaletteDesign,
  themeFromDesign,
  type DirectionKey,
} from './design-system.ts';

// ─────────────────────────────────────────────────────────────────────
// Vokabular
// ─────────────────────────────────────────────────────────────────────

export type RevisionIntentKey =
  | 'serioeser'
  | 'mehr-vertrauen'
  | 'mittelstand'
  | 'mehr-lokal'
  | 'cta-staerker'
  | 'hero-kuerzer'
  | 'premium-beratung'
  | 'fuer-handwerker'
  | 'fuer-steuerberater'
  | 'fuer-ki-governance';

export interface RevisionIntent {
  key: RevisionIntentKey;
  /** Beschriftung des Vorschlags in der Oberfläche. */
  label: string;
  /** Was die Regel ändert — in einem Satz, vor dem Anwenden sichtbar. */
  effect: string;
  group: 'wirkung' | 'struktur' | 'zielgruppe';
}

/**
 * Die Regeln in Anwendungsreihenfolge. Die Reihenfolge ist fest, damit
 * dieselbe Anweisung immer dasselbe Ergebnis liefert: erst Zielgruppe
 * (setzt die Richtung), dann Wirkung (verfeinert sie), dann Struktur.
 * „seriöser, aber CTA stärker" endet so mit betonter Handlungsaufforderung.
 */
export const REVISION_INTENTS: readonly RevisionIntent[] = Object.freeze([
  { key: 'fuer-handwerker', label: 'Für Handwerker', effect: 'Branche Handwerk, Kontakt und Anruf früh, Anschrift vorn — Compliance-Profil bleibt mindestens so streng wie bisher.', group: 'zielgruppe' },
  { key: 'fuer-steuerberater', label: 'Für Steuerberater', effect: 'Branche Steuerberatung, sachliche Gestaltung, „Beratungsfelder", Ablauf und Fragen vor dem Gespräch.', group: 'zielgruppe' },
  { key: 'fuer-ki-governance', label: 'Für KI-Governance', effect: 'Sachliche Gestaltung, Datenschutz- und KI-Transparenz direkt nach dem Angebot, Gespräch statt Kauf.', group: 'zielgruppe' },
  { key: 'premium-beratung', label: 'Mehr wie Premium-Beratung', effect: 'Richtung „Premium Advisory": Serifen-Überschriften, ruhige Farbe, viel Raum, redaktioneller Hero.', group: 'wirkung' },
  { key: 'mittelstand', label: 'Weniger Startup, mehr Mittelstand', effect: 'Ruhigere Schrift, eckige Schaltflächen, Rahmen statt Schatten, Ablauf und Ansprechpartner früh.', group: 'wirkung' },
  { key: 'serioeser', label: 'Seriöser', effect: 'Leichtere Überschriften, keine Pillen, keine Schatten, zurückhaltende Handlungsaufforderung, keine Ausrufezeichen.', group: 'wirkung' },
  { key: 'mehr-vertrauen', label: 'Mehr Vertrauen', effect: 'Belegte Siegel direkt unter den Hero, Stimmen nach oben, Kontaktdaten und Datenschutz-Block auf die Startseite.', group: 'struktur' },
  { key: 'mehr-lokal', label: 'Mehr lokal', effect: 'Ort in Kopfzeile, Titel und Beschreibung; Anschrift und Anfahrt (nach Einwilligung) auf die Startseite.', group: 'struktur' },
  { key: 'cta-staerker', label: 'CTA stärker', effect: 'Betonte Schaltflächen, Handlungsaufforderung im Kopf, konkrete Beschriftung, zusätzliches Aufforderungsband.', group: 'struktur' },
  { key: 'hero-kuerzer', label: 'Hero kürzer', effect: 'Unterzeile auf einen Satz, Überschrift ohne Nachsatz, kompakter Kopfbereich.', group: 'struktur' },
]);

const ORDER: readonly RevisionIntentKey[] = REVISION_INTENTS.map((i) => i.key);

/**
 * Erkennt die Regeln in einer Anweisung. Wortanfänge statt ganzer Wörter:
 * „seriöser", „Mittelständler", „Handwerksbetrieb".
 *
 * Alle Muster sind linear (keine verschachtelten Quantoren, feste
 * Abstandsgrenzen) — die Eingabe kommt vom Nutzer.
 */
export function matchIntents(instruction: string): RevisionIntentKey[] {
  const text = ` ${instruction.toLowerCase().replace(/\s+/g, ' ')} `;
  const found = new Set<RevisionIntentKey>();
  if (/[\s„"(]seri[öo]e?s|professioneller|sachlicher|weniger verspielt/.test(text)) found.add('serioeser');
  if (/vertrauen|vertrauensw|glaubw[üu]rdig/.test(text)) found.add('mehr-vertrauen');
  if (/mittelst[äa]nd|weniger startup|weniger start-up|bodenst[äa]ndig/.test(text)) found.add('mittelstand');
  if (/[\s„"(]lokal|[\s„"(]regional|vor ort|aus der region|ortsbezug/.test(text)) found.add('mehr-lokal');
  if (/(cta|call to action|call-to-action|handlungsaufforderung|button|schaltfl[äa]che)[^.!?]{0,30}(st[äa]rker|deutlicher|auff[äa]lliger|prominenter|gr[öo](ß|ss)er)/.test(text)
    || /(st[äa]rker|deutlicher|auff[äa]lliger|prominenter)[^.!?]{0,12}(cta|call to action|call-to-action|handlungsaufforderung|button)/.test(text)) found.add('cta-staerker');
  if (/(hero|kopfbereich|aufmacher|einstieg)[^.!?]{0,30}(k[üu]rzer|knapper|weniger text)/.test(text)
    || /(k[üu]rzer|knapper)[^.!?]{0,12}(hero|kopfbereich|aufmacher)/.test(text)) found.add('hero-kuerzer');
  if (/premium|hochwertig|[\s„"(]edle|[\s„"(]edler|exklusiv|boutique|wie eine (unternehmens)?beratung/.test(text)) found.add('premium-beratung');
  if (/handwerk/.test(text)) found.add('fuer-handwerker');
  if (/steuerber|steuerkanzlei/.test(text)) found.add('fuer-steuerberater');
  if (/(ki|ai)[- ](governance|compliance)|eu[- ]ai[- ]act|[\s„"(]ai act|ki-verordnung/.test(text)) found.add('fuer-ki-governance');
  return ORDER.filter((key) => found.has(key));
}

export function isRevisionIntentKey(value: unknown): value is RevisionIntentKey {
  return typeof value === 'string' && (ORDER as readonly string[]).includes(value);
}

// ─────────────────────────────────────────────────────────────────────
// Einstieg
// ─────────────────────────────────────────────────────────────────────

export interface RevisionRequest {
  /** Ausdrücklich gewählte Regeln (Vorschlags-Chips). */
  intents?: RevisionIntentKey[];
  /** Freitext. Wird zuerst auf Regeln geprüft, der Rest geht an `refineBlueprint`. */
  instruction?: string;
}

export interface RevisionResult {
  blueprint: SiteBlueprint;
  changes: RefinementChange[];
  /** Tatsächlich angewandte Regeln. */
  intents: RevisionIntentKey[];
  /** `false` heißt: nichts verstanden, nichts geändert — das muss die Oberfläche sagen. */
  understood: boolean;
  refusals: string[];
  /** Hinweise ohne Änderung („bereits umgesetzt", „kein Ort belegt"). */
  notes: string[];
  /** Hat der Freitext die allgemeine Verfeinerung erreicht? */
  usedGeneralRefine: boolean;
}

/**
 * Wendet Regeln und Freitext auf einen Blueprint an. Rein und
 * deterministisch: gleiche Eingabe ⇒ gleiches Ergebnis.
 *
 * Der Slug bleibt stehen — die Versionskette hängt an ihm. Eine
 * Umbenennung („nenne die Website …") ändert Name und Titel, nicht die
 * Kette.
 */
export function reviseBlueprint(blueprint: SiteBlueprint, request: RevisionRequest): RevisionResult {
  const instruction = (request.instruction ?? '').trim().slice(0, 600);
  const explicit = (request.intents ?? []).filter(isRevisionIntentKey);
  const matched = instruction ? matchIntents(instruction) : [];
  const intents = ORDER.filter((key) => explicit.includes(key) || matched.includes(key));

  const changes: RefinementChange[] = [];
  const notes: string[] = [];
  let bp = blueprint;
  for (const key of intents) bp = APPLY[key](bp, changes, notes);

  let refusals: string[] = [];
  let usedGeneralRefine = false;
  if (instruction) {
    const general = refineBlueprint(bp, instruction);
    if (general.changes.length > 0 || general.refusals.length > 0) {
      usedGeneralRefine = true;
      refusals = general.refusals;
      const bridged = bridgeThemeToDesign(bp, general.blueprint, general.changes, notes);
      changes.push(...bridged.changes);
      bp = bridged.blueprint;
    }
  }

  bp = recompile(blueprint, bp, changes);
  bp = { ...bp, slug: blueprint.slug };

  return {
    blueprint: bp,
    changes,
    intents,
    understood: intents.length > 0 || usedGeneralRefine,
    refusals,
    notes,
    usedGeneralRefine,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Die Regeln
// ─────────────────────────────────────────────────────────────────────

type Rule = (bp: SiteBlueprint, changes: RefinementChange[], notes: string[]) => SiteBlueprint;

const APPLY: Readonly<Record<RevisionIntentKey, Rule>> = {
  'fuer-handwerker': (bp, changes, notes) => retarget(bp, changes, notes, {
    code: 'handwerker', industry: 'handwerk', directions: ['local-trust', 'conversion-focus'],
    servicesLabel: 'Leistungen', formHeading: null, callSecondary: true,
    moves: [['trust-bar', ['hero']], ['contact-info', ['services', 'trust-bar', 'hero']]],
    ensureContactInfo: true, governanceAfterServices: false, governanceHeading: null,
  }),
  'fuer-steuerberater': (bp, changes, notes) => retarget(bp, changes, notes, {
    code: 'steuerberater', industry: 'steuerberatung', directions: ['clean-enterprise', 'premium-advisory'],
    servicesLabel: 'Beratungsfelder', formHeading: 'Gespräch vereinbaren', callSecondary: false,
    moves: [['process', ['services']], ['faq', ['testimonials', 'case-study', 'process', 'services']]],
    ensureContactInfo: false, governanceAfterServices: false, governanceHeading: null,
  }),
  'fuer-ki-governance': (bp, changes, notes) => retarget(bp, changes, notes, {
    code: 'ki-governance', industry: null, directions: ['clean-enterprise', 'premium-advisory'],
    servicesLabel: null, formHeading: 'Gespräch vereinbaren', callSecondary: false,
    // Angebot → Transparenz → Vorgehen. Der Ablauf folgt dem Transparenz-Block,
    // sonst schöben sich beide bei jeder Anwendung gegenseitig weg.
    moves: [['process', ['governance', 'services']]],
    ensureContactInfo: false, governanceAfterServices: true, governanceHeading: 'Datenschutz, KI & Transparenz',
  }),
  'premium-beratung': premium,
  mittelstand,
  serioeser,
  'mehr-vertrauen': moreTrust,
  'mehr-lokal': moreLocal,
  'cta-staerker': strongerCta,
  'hero-kuerzer': shorterHero,
};

// ── Seriöser ────────────────────────────────────────────────────────

function serioeser(bp: SiteBlueprint, changes: RefinementChange[], notes: string[]): SiteBlueprint {
  let next = bp;
  if (bp.design) {
    const d = bp.design;
    next = withDesign(next, {
      ...d,
      // Ein Zielzustand, keine Stufe: Zweimal „seriöser" ändert nichts mehr.
      typography: { ...d.typography, displayWeight: d.typography.displayWeight === 800 ? 700 : d.typography.displayWeight },
      buttons: { ...d.buttons, primary: 'solid' },
      elevation: 'flat',
      // Getönte Karten sind ruhig; nur der Schatten wirkt verkaufend.
      cards: d.cards === 'elevated' ? 'bordered' : d.cards,
      ctaEmphasis: 'standard',
      radius: { control: Math.min(d.radius.control, 8), card: Math.min(d.radius.card, 12) },
    }, changes, 'intent.serioeser.design', 'Seriöser');
  }

  // Ausrufezeichen verkaufen, sie belegen nichts.
  let removed = 0;
  next = mapBlocks(next, (block) => {
    const content = { ...block.content };
    let touched = false;
    for (const field of ['headline', 'subline', 'eyebrow', 'proof', 'label', 'submitLabel', 'heading'] as const) {
      const value = content[field];
      if (typeof value === 'string' && value.includes('!')) {
        content[field] = calm(value);
        touched = true;
        removed += 1;
      }
    }
    for (const field of ['primaryCta', 'secondaryCta', 'cta'] as const) {
      const cta = content[field] as { label?: unknown } | undefined;
      if (cta && typeof cta.label === 'string' && cta.label.includes('!')) {
        content[field] = { ...cta, label: calm(cta.label) };
        touched = true;
        removed += 1;
      }
    }
    return touched ? { ...block, content } : block;
  });
  if (removed > 0) {
    changes.push({ code: 'intent.serioeser.punctuation', summary: `Ausrufezeichen aus ${removed} Überschrift${removed === 1 ? '' : 'en'} bzw. Beschriftung${removed === 1 ? '' : 'en'} entfernt.`, complianceNote: null });
  }
  if (next === bp) notes.push('„Seriöser": Gestaltung und Texte sind bereits zurückhaltend — nichts geändert.');
  return next;
}

/**
 * „Jetzt anrufen!" → „Jetzt anrufen"; „Wir sind da! Rufen Sie an!" →
 * „Wir sind da. Rufen Sie an." Ein Satz verliert das Zeichen, mehrere Sätze
 * enden mit Punkt.
 */
export function calm(value: string): string {
  const inner = value.trim().replace(/!+(\s)/g, '.$1');
  const multiSentence = /[.?]\s/.test(inner);
  return inner.replace(/!+$/, multiSentence ? '.' : '').replace(/!+/g, '').replace(/\.{2,}/g, '.').trim();
}

// ── Mittelstand ─────────────────────────────────────────────────────

function mittelstand(bp: SiteBlueprint, changes: RefinementChange[], notes: string[]): SiteBlueprint {
  let next = bp;
  if (bp.design) {
    const d = bp.design;
    next = withDesign(next, {
      ...d,
      typography: {
        ...d.typography,
        scale: d.typography.scale === 'expressive' ? 'regular' : d.typography.scale,
        tracking: 'normal',
        displayWeight: d.typography.displayWeight === 800 ? 700 : d.typography.displayWeight,
      },
      buttons: { primary: 'solid', secondary: 'outline' },
      cards: 'bordered',
      elevation: 'flat',
      radius: { control: Math.min(d.radius.control, 6), card: Math.min(d.radius.card, 10) },
      palette: { ...d.palette, surfaceAlt: d.direction === 'conversion-focus' ? neutralSurfaceAlt(d.mode) : d.palette.surfaceAlt },
    }, changes, 'intent.mittelstand.design', 'Mittelstand');
  }
  next = moveOnHome(next, 'trust-bar', ['hero'], changes, 'intent.mittelstand.structure');
  next = moveOnHome(next, 'process', ['services'], changes, 'intent.mittelstand.structure');
  next = ensureContactInfoOnHome(next, ['process', 'services', 'trust-bar', 'hero'], changes, notes, 'intent.mittelstand.structure');
  if (next === bp) notes.push('„Mittelstand": bereits umgesetzt — nichts geändert.');
  return next;
}

// ── Premium-Beratung ────────────────────────────────────────────────

const PREMIUM_PLAN: readonly BlockKind[] = ['hero', 'problem-solution', 'services', 'process', 'case-study', 'testimonials', 'trust-bar', 'about', 'faq', 'contact-info', 'contact-form', 'map', 'cta', 'governance', 'automation'];

function premium(bp: SiteBlueprint, changes: RefinementChange[], notes: string[]): SiteBlueprint {
  let next = bp;
  if (bp.design && bp.design.direction !== 'premium-advisory') {
    next = switchDirection(next, 'premium-advisory', changes, 'intent.premium.design', 'Premium-Beratung');
  } else if (bp.design) {
    notes.push('„Premium-Beratung": Die Gestaltung folgt bereits dieser Richtung.');
  }
  next = reorderHome(next, PREMIUM_PLAN, changes, 'intent.premium.structure', 'Reihenfolge der Startseite: erst Anliegen und Angebot, dann Vorgehen und Nachweise, das Gespräch am Ende.');
  next = setFormHeading(next, 'Gespräch vereinbaren', changes, 'intent.premium.form');
  return next;
}

// ── Mehr Vertrauen ──────────────────────────────────────────────────

function moreTrust(bp: SiteBlueprint, changes: RefinementChange[], notes: string[]): SiteBlueprint {
  const code = 'intent.vertrauen.structure';
  const notesBefore = notes.length;
  let next = bp;
  const home = homeOf(next);
  const trustBar = home?.blocks.find((b) => b.kind === 'trust-bar');
  const trustItems = trustBar ? listOf(trustBar.content.items).filter((i) => typeof i.label === 'string' && i.label.trim() !== '') : [];

  if (!trustBar || trustItems.length === 0) {
    notes.push('Keine belegten Vertrauenssignale (Siegel, Mitgliedschaften, Bewertungen) auf der Site — es werden keine erfunden. Echte Nachweise lassen sich im Editor in der Vertrauensleiste eintragen.');
  } else if (trustBar.content.hidden === true) {
    notes.push('Die Vertrauensleiste ist ausgeblendet. Sie bleibt ausgeblendet, bis sie im Editor wieder eingeblendet wird.');
  } else {
    // Direkt unter den Hero — eine zusätzliche Nachweiszeile im Hero
    // wiederholte dann nur, was eine Zeile tiefer steht.
    next = moveOnHome(next, 'trust-bar', ['hero'], changes, code);
  }

  const testimonials = homeOf(next)?.blocks.find((b) => b.kind === 'testimonials');
  if (testimonials && listOf(testimonials.content.items).length > 0) {
    if (testimonials.content.hidden === true) notes.push('Kundenstimmen sind ausgeblendet und bleiben es.');
    else next = moveOnHome(next, 'testimonials', ['services', 'trust-bar', 'hero'], changes, code);
  }
  const cases = homeOf(next)?.blocks.find((b) => b.kind === 'case-study');
  if (cases && listOf(cases.content.items).length > 0 && cases.content.hidden !== true) {
    next = moveOnHome(next, 'case-study', ['testimonials', 'services', 'trust-bar'], changes, code);
  }
  next = ensureContactInfoOnHome(next, ['testimonials', 'services', 'trust-bar', 'hero'], changes, notes, code);
  next = ensureGovernanceOnHome(next, changes, notes, code, null);
  if (next === bp && notes.length === notesBefore) notes.push('„Mehr Vertrauen": bereits umgesetzt — nichts geändert.');
  return next;
}

// ── Mehr lokal ──────────────────────────────────────────────────────

function moreLocal(bp: SiteBlueprint, changes: RefinementChange[], notes: string[]): SiteBlueprint {
  let next = bp;
  const contact = findContactInfo(next);
  const address = typeof contact?.content.address === 'string' ? contact.content.address : null;
  let locality = next.seo.locality;
  if (!locality && address) {
    locality = localityFromAddress(address);
    if (locality) {
      next = { ...next, seo: { ...next.seo, locality } };
      changes.push({ code: 'intent.lokal.locality', summary: `Ort „${locality}" aus der Anschrift übernommen.`, complianceNote: null });
    }
  }

  if (!locality) {
    notes.push('Kein Ort belegt — Anschrift im Block „Kontaktdaten" ergänzen, dann „Mehr lokal" erneut anwenden. Ein Ort wird nicht geraten: Er wandert in Titel, strukturierte Daten und Impressumshinweise.');
  } else {
    // Kopfzeile des Heroes: Name · Ort.
    const hero = homeOf(next)?.blocks.find((b) => b.kind === 'hero');
    if (hero && !String(hero.content.eyebrow ?? '').includes(locality)) {
      const eyebrow = `${next.name} · ${locality}`;
      next = mapHomeBlocks(next, (b) => (b.id === hero.id ? { ...b, content: { ...b.content, eyebrow } } : b));
      changes.push({ code: 'intent.lokal.eyebrow', summary: `Kopfzeile im Hero: „${eyebrow}".`, complianceNote: null });
    }
    // Titel und Beschreibung.
    if (!next.seo.defaultTitle.includes(locality)) {
      const candidate = /\s[–—-]\s/.test(next.seo.defaultTitle) ? `${next.seo.defaultTitle} in ${locality}` : `${next.seo.defaultTitle} – ${locality}`;
      if (candidate.length <= 60) {
        next = { ...next, seo: { ...next.seo, defaultTitle: candidate } };
        changes.push({ code: 'intent.lokal.title', summary: `Seitentitel: „${candidate}".`, complianceNote: null });
      } else {
        notes.push(`Seitentitel nicht erweitert: Mit „${locality}" wäre er länger als 60 Zeichen und würde in Suchergebnissen abgeschnitten.`);
      }
    }
    const home = homeOf(next);
    if (home && !home.description.includes(locality)) {
      const description = `${home.description.replace(/\s+$/, '')}${/[.!?]$/.test(home.description.trim()) ? '' : '.'} Standort: ${locality}.`;
      if (description.length <= 160) {
        next = mapPage(next, '/', (p) => ({ ...p, description }));
        next = { ...next, seo: { ...next.seo, defaultDescription: next.seo.defaultDescription === home.description ? description : next.seo.defaultDescription } };
        changes.push({ code: 'intent.lokal.description', summary: 'Meta-Beschreibung der Startseite um den Standort ergänzt.', complianceNote: null });
      }
    }
    const keywords = new Set(next.seo.keywords);
    const before = keywords.size;
    keywords.add(locality.toLowerCase());
    const firstService = firstServiceLabel(next);
    if (firstService) keywords.add(`${firstService.toLowerCase()} ${locality.toLowerCase()}`);
    if (keywords.size !== before) next = { ...next, seo: { ...next.seo, keywords: [...keywords].sort() } };
  }

  next = ensureContactInfoOnHome(next, ['services', 'trust-bar', 'hero'], changes, notes, 'intent.lokal.structure');
  next = moveOnHome(next, 'contact-info', ['services', 'trust-bar', 'hero'], changes, 'intent.lokal.structure');
  if (address) next = ensureMapOnHome(next, locality, changes);
  return next;
}

function localityFromAddress(address: string): string | null {
  const match = /\b\d{5}\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.-]{1,40}(?:\s(?:an der|am|im|in der|bei)\s[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.-]{1,30}|\s[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.-]{1,30})?)/.exec(address);
  return match ? match[1].replace(/[.,]$/, '') : null;
}

// ── CTA stärker ─────────────────────────────────────────────────────

const VAGUE_CTA = /^(mehr|mehr erfahren|mehr infos?|weiter|weiterlesen|hier|hier klicken|details|entdecken|kontakt|zur seite|los geht'?s|start)$/i;

function strongerCta(bp: SiteBlueprint, changes: RefinementChange[], notes: string[]): SiteBlueprint {
  let next = bp;
  if (bp.design) {
    next = withDesign(next, { ...bp.design, ctaEmphasis: 'strong', headerCta: true }, changes, 'intent.cta.design', 'CTA stärker');
  }

  const hero = homeOf(next)?.blocks.find((b) => b.kind === 'hero');
  const primary = hero?.content.primaryCta as { label?: unknown; href?: unknown } | undefined;
  if (hero && primary && typeof primary.label === 'string' && typeof primary.href === 'string' && VAGUE_CTA.test(primary.label.trim())) {
    const label = concreteLabel(primary.href);
    next = mapHomeBlocks(next, (b) => (b.id === hero.id ? { ...b, content: { ...b.content, primaryCta: { ...primary, label } } } : b));
    changes.push({ code: 'intent.cta.label', summary: `Beschriftung der Hauptaktion: „${primary.label}" → „${label}".`, complianceNote: null });
  }

  next = ensureHeaderCta(next, changes);

  // Zweite Gelegenheit nach dem Angebot — ohne Versprechen über Reaktionszeiten.
  const home = homeOf(next);
  const heroNow = home?.blocks.find((b) => b.kind === 'hero');
  const cta = heroNow?.content.primaryCta as { label?: unknown; href?: unknown } | undefined;
  if (home && cta && typeof cta.href === 'string' && typeof cta.label === 'string' && !home.blocks.some((b) => b.kind === 'cta')) {
    const block = freshBlock(next, home, 'cta');
    block.content = { headline: toneOf(next) === 'du' ? 'Lass uns sprechen.' : 'Lassen Sie uns sprechen.', label: cta.label, href: cta.href, variant: 'band' };
    next = mapPage(next, '/', (p) => ({ ...p, blocks: insertAfter(p.blocks, block, ['services', 'testimonials', 'trust-bar', 'hero']) }));
    changes.push({ code: 'intent.cta.band', summary: 'Aufforderungsband nach dem Angebot ergänzt.', complianceNote: null });
  }
  if (next === bp) notes.push('„CTA stärker": bereits umgesetzt — nichts geändert.');
  return next;
}

function concreteLabel(href: string): string {
  if (href.startsWith('tel:')) return 'Jetzt anrufen';
  if (href.startsWith('mailto:')) return 'E-Mail schreiben';
  if (/(termin|booking|buchen|calendly|doctolib|etermin|shore\.com|treatwell)/i.test(href)) return 'Termin vereinbaren';
  return 'Anfrage senden';
}

// ── Hero kürzer ─────────────────────────────────────────────────────

function shorterHero(bp: SiteBlueprint, changes: RefinementChange[], notes: string[]): SiteBlueprint {
  const hero = homeOf(bp)?.blocks.find((b) => b.kind === 'hero');
  if (!hero) {
    notes.push('Die Startseite hat keinen Hero.');
    return bp;
  }
  const content = { ...hero.content };
  const done: string[] = [];

  if (typeof content.subline === 'string') {
    const short = trimToSentence(firstSentence(content.subline), 120);
    if (short !== content.subline) {
      content.subline = short;
      done.push('Unterzeile auf einen Satz gekürzt');
    }
  }
  if (typeof content.headline === 'string' && content.headline.split(/\s+/).length > 7) {
    const cut = headlineCore(content.headline);
    if (cut && cut !== content.headline) {
      content.headline = cut;
      done.push(`Überschrift ohne Nachsatz: „${cut}"`);
    }
  }
  if (content.emphasis !== 'compact') {
    content.emphasis = 'compact';
    done.push('Kopfbereich kompakter');
  }
  if (done.length === 0) {
    notes.push('„Hero kürzer": bereits knapp — nichts geändert.');
    return bp;
  }
  changes.push({ code: 'intent.hero.shorter', summary: `${done.join('; ')}.`, complianceNote: null });
  return mapHomeBlocks(bp, (b) => (b.id === hero.id ? { ...b, content } : b));
}

function firstSentence(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if ((ch === '.' || ch === '!' || ch === '?') && (clean[i + 1] === ' ' || clean[i + 1] === undefined) && i >= 20) return clean.slice(0, i + 1);
  }
  return clean;
}

/** Hauptaussage vor einem Nachsatz („A – B", „A: B"), wenn sie für sich trägt. */
function headlineCore(headline: string): string | null {
  for (const separator of [' – ', ' — ', ' - ', ': ']) {
    const at = headline.indexOf(separator);
    if (at > 0) {
      const head = headline.slice(0, at).trim();
      if (head.split(/\s+/).length >= 2) return head;
    }
  }
  return null;
}

// ── Zielgruppen ─────────────────────────────────────────────────────

interface RetargetSpec {
  code: string;
  /** `null`: Branche bleibt (KI-Governance ist Positionierung, keine Branche mit eigenem Profil). */
  industry: IndustryKey | null;
  /** Passende Richtungen; die erste ist das Ziel, wenn die aktuelle nicht passt. */
  directions: DirectionKey[];
  servicesLabel: string | null;
  formHeading: string | null;
  /** Anruf als Zweitaktion im Hero, wenn eine Nummer belegt ist. */
  callSecondary: boolean;
  moves: [BlockKind, BlockKind[]][];
  ensureContactInfo: boolean;
  governanceAfterServices: boolean;
  governanceHeading: string | null;
}

const DEFAULT_SERVICE_HEADINGS = new Set(['Leistungen', 'Unsere Leistungen', 'Beratungsfelder', 'Im Überblick', 'Angebot', 'Unser Angebot']);

function retarget(bp: SiteBlueprint, changes: RefinementChange[], notes: string[], spec: RetargetSpec): SiteBlueprint {
  const code = `intent.${spec.code}`;
  let next = bp;

  // ── Branche mit Untergrenze ─────────────────────────────────────────
  if (spec.industry && bp.industry !== spec.industry) {
    const before = getIndustryPreset(bp.industry);
    const after = getIndustryPreset(spec.industry);
    const keepType = bp.seo.structuredDataType !== before.structuredDataType && bp.seo.structuredDataType !== 'Organization';
    next = {
      ...next,
      industry: spec.industry,
      seo: {
        ...next.seo,
        structuredDataType: keepType ? bp.seo.structuredDataType : after.structuredDataType,
        keywords: [...new Set([...next.seo.keywords, after.label.split(' / ')[0].toLowerCase()])].sort(),
      },
    };
    changes.push({
      code: `${code}.industry`,
      summary: `Branche: ${before.label} → ${after.label}${keepType ? '' : ` (schema.org: ${after.structuredDataType})`}.`,
      complianceNote: 'Das Compliance-Profil bleibt mindestens so streng wie zuvor. Ob eine frühere Einstufung zu streng war, entscheidet eine berechtigte Person im Publish Gate.',
    });
  } else if (spec.industry) {
    notes.push(`Branche ist bereits ${getIndustryPreset(spec.industry).label}.`);
  } else {
    notes.push(`Branche bleibt ${getIndustryPreset(bp.industry).label}: KI-Governance ist eine Positionierung, keine Branche mit eigenem Compliance-Profil.`);
  }

  // ── Richtung ────────────────────────────────────────────────────────
  if (next.design && !spec.directions.includes(next.design.direction as DirectionKey)) {
    next = switchDirection(next, spec.directions[0], changes, `${code}.design`, REVISION_INTENTS.find((i) => i.key === `fuer-${spec.code}`)?.label ?? spec.code);
  }

  // ── Bezeichnungen ───────────────────────────────────────────────────
  if (spec.servicesLabel) next = relabelServices(next, spec.servicesLabel, changes, `${code}.labels`);
  if (spec.formHeading) next = setFormHeading(next, spec.formHeading, changes, `${code}.form`);

  // ── Struktur ────────────────────────────────────────────────────────
  if (spec.governanceAfterServices) {
    next = ensureGovernanceOnHome(next, changes, notes, `${code}.structure`, spec.governanceHeading);
    next = moveOnHome(next, 'governance', ['services', 'problem-solution', 'trust-bar', 'hero'], changes, `${code}.structure`);
  }
  for (const [kind, anchors] of spec.moves) next = moveOnHome(next, kind, anchors, changes, `${code}.structure`);
  if (spec.ensureContactInfo) next = ensureContactInfoOnHome(next, ['services', 'trust-bar', 'hero'], changes, notes, `${code}.structure`);

  if (spec.callSecondary) {
    const contact = findContactInfo(next);
    const hero = homeOf(next)?.blocks.find((b) => b.kind === 'hero');
    const secondary = hero?.content.secondaryCta as { href?: unknown } | undefined;
    const primary = hero?.content.primaryCta as { href?: unknown } | undefined;
    const phone = typeof contact?.content.phone === 'string' ? contact.content.phone : null;
    const phoneHref = typeof contact?.content.phoneHref === 'string' ? contact.content.phoneHref : phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : null;
    const callAlready = [secondary?.href, primary?.href].some((h) => typeof h === 'string' && h.startsWith('tel:'));
    if (hero && phone && phoneHref && !callAlready) {
      next = mapHomeBlocks(next, (b) => (b.id === hero.id ? { ...b, content: { ...b.content, secondaryCta: { label: `Anrufen: ${phone}`, href: phoneHref } } } : b));
      changes.push({ code: `${code}.call`, summary: `Anruf als zweite Aktion im Hero (${phone}).`, complianceNote: null });
    } else if (hero && !phone && !callAlready) {
      notes.push('Keine Telefonnummer belegt — der Anruf als zweite Aktion entfällt.');
    }
  }
  return next;
}

// ─────────────────────────────────────────────────────────────────────
// Bausteine der Regeln
// ─────────────────────────────────────────────────────────────────────

function homeOf(bp: SiteBlueprint): SitePage | undefined {
  return bp.pages.find((p) => p.path === '/');
}

function listOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null) : [];
}

function mapPage(bp: SiteBlueprint, path: string, fn: (page: SitePage) => SitePage): SiteBlueprint {
  return { ...bp, pages: bp.pages.map((p) => (p.path === path ? fn(p) : p)) };
}

function mapHomeBlocks(bp: SiteBlueprint, fn: (block: SiteBlock) => SiteBlock): SiteBlueprint {
  return mapPage(bp, '/', (p) => ({ ...p, blocks: p.blocks.map(fn) }));
}

function mapBlocks(bp: SiteBlueprint, fn: (block: SiteBlock) => SiteBlock): SiteBlueprint {
  let changed = false;
  const pages = bp.pages.map((p) => {
    const blocks = p.blocks.map((b) => {
      const next = fn(b);
      if (next !== b) changed = true;
      return next;
    });
    return changed ? { ...p, blocks } : p;
  });
  return changed ? { ...bp, pages } : bp;
}

/** Setzt `kind` direkt hinter den ersten vorhandenen Anker. Kein Anker, kein Block ⇒ unverändert. */
function moveOnHome(bp: SiteBlueprint, kind: BlockKind, anchors: BlockKind[], changes: RefinementChange[], code: string): SiteBlueprint {
  const home = homeOf(bp);
  if (!home) return bp;
  const from = home.blocks.findIndex((b) => b.kind === kind);
  if (from === -1) return bp;
  const blocks = [...home.blocks];
  const [block] = blocks.splice(from, 1);
  const anchorAt = anchors.map((a) => blocks.findIndex((b) => b.kind === a)).find((i) => i !== -1);
  if (anchorAt === undefined) return bp;
  blocks.splice(anchorAt + 1, 0, block);
  if (blocks.every((b, i) => b === home.blocks[i])) return bp;
  const anchor = blocks[anchorAt].kind;
  changes.push({ code, summary: `${KIND_LABEL[kind] ?? kind} direkt nach ${KIND_LABEL[anchor] ?? anchor}.`, complianceNote: null });
  return mapPage(bp, '/', (p) => ({ ...p, blocks }));
}

/** Ordnet die Inhaltsblöcke der Startseite nach Plan; nicht genannte bleiben hinter ihrem Vorgänger. */
function reorderHome(bp: SiteBlueprint, plan: readonly BlockKind[], changes: RefinementChange[], code: string, summary: string): SiteBlueprint {
  const home = homeOf(bp);
  if (!home) return bp;
  const pinnedTop = home.blocks.filter((b) => b.kind === 'navigation');
  const pinnedBottom = home.blocks.filter((b) => b.kind === 'ai-disclosure' || b.kind === 'footer');
  const body = home.blocks.filter((b) => !pinnedTop.includes(b) && !pinnedBottom.includes(b));
  const keyed = body.map((block, index) => ({ block, index, rank: plan.indexOf(block.kind) }));
  // Nicht genannte Blöcke erben den Rang ihres Vorgängers (stabil).
  let last = -1;
  for (const entry of keyed) {
    if (entry.rank === -1) entry.rank = last + 0.5;
    else last = entry.rank;
  }
  const sorted = [...keyed].sort((a, b) => a.rank - b.rank || a.index - b.index).map((e) => e.block);
  if (sorted.every((b, i) => b === body[i])) return bp;
  changes.push({ code, summary, complianceNote: null });
  return mapPage(bp, '/', (p) => ({ ...p, blocks: [...pinnedTop, ...sorted, ...pinnedBottom] }));
}

function insertAfter(blocks: SiteBlock[], block: SiteBlock, anchors: BlockKind[]): SiteBlock[] {
  const at = anchors.map((a) => blocks.findIndex((b) => b.kind === a)).find((i) => i !== -1);
  if (at === undefined) return insertBeforeClosing(blocks, block);
  return [...blocks.slice(0, at + 1), block, ...blocks.slice(at + 1)];
}

function insertBeforeClosing(blocks: SiteBlock[], block: SiteBlock): SiteBlock[] {
  let index = blocks.length;
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    if (!['ai-disclosure', 'footer', 'governance'].includes(blocks[i].kind)) break;
    index = i;
  }
  return [...blocks.slice(0, index), block, ...blocks.slice(index)];
}

/** Neuer Block über den einen Block-Bauer — mit freier ID auf der Seite. */
function freshBlock(bp: SiteBlueprint, page: SitePage, kind: BlockKind): SiteBlock {
  const ids = new Set(page.blocks.map((b) => b.id));
  const brief = briefFromBlueprint(bp);
  for (let index = page.blocks.length; ; index += 1) {
    const block = buildBlock(kind, index, page.path, brief, false);
    if (!ids.has(block.id)) return block;
  }
}

function findContactInfo(bp: SiteBlueprint): SiteBlock | undefined {
  const all = bp.pages.flatMap((p) => p.blocks).filter((b) => b.kind === 'contact-info');
  return all.find((b) => b.content.hidden !== true && (b.content.phone || b.content.email || b.content.address)) ?? all[0];
}

/**
 * Kontaktdaten auf die Startseite: aus dem belegten Block einer Unterseite
 * übernommen, nie neu formuliert.
 */
function ensureContactInfoOnHome(bp: SiteBlueprint, anchors: BlockKind[], changes: RefinementChange[], notes: string[], code: string): SiteBlueprint {
  const home = homeOf(bp);
  if (!home) return bp;
  const onHome = home.blocks.find((b) => b.kind === 'contact-info');
  if (onHome) {
    if (onHome.content.hidden === true) notes.push('Die Kontaktdaten auf der Startseite sind ausgeblendet und bleiben es.');
    return moveOnHome(bp, 'contact-info', anchors, changes, code);
  }
  const source = findContactInfo(bp);
  if (!source || !(source.content.phone || source.content.email || source.content.address)) {
    if (!notes.some((n) => n.startsWith('Keine Kontaktdaten'))) notes.push('Keine Kontaktdaten belegt — der Block „Kontaktdaten" bleibt leer, bis Telefon, E-Mail oder Anschrift eingetragen sind.');
    return bp;
  }
  const block = freshBlock(bp, home, 'contact-info');
  const content: Record<string, unknown> = { ...source.content };
  delete content.hidden;
  block.content = content;
  changes.push({ code, summary: 'Kontaktdaten (Telefon, E-Mail, Anschrift wie auf der Kontaktseite) auf die Startseite übernommen.', complianceNote: null });
  return mapPage(bp, '/', (p) => ({ ...p, blocks: insertAfter(p.blocks, block, anchors) }));
}

function ensureGovernanceOnHome(bp: SiteBlueprint, changes: RefinementChange[], notes: string[], code: string, heading: string | null): SiteBlueprint {
  const home = homeOf(bp);
  if (!home) return bp;
  const existing = home.blocks.find((b) => b.kind === 'governance');
  if (existing) {
    if (existing.content.hidden === true) notes.push('Der Block „Datenschutz & Transparenz" ist ausgeblendet und bleibt es.');
    if (heading && existing.content.heading !== heading) {
      changes.push({ code, summary: `Überschrift des Transparenz-Blocks: „${heading}".`, complianceNote: null });
      return mapHomeBlocks(bp, (b) => (b.id === existing.id ? { ...b, content: { ...b.content, heading } } : b));
    }
    return bp;
  }
  const block = freshBlock(bp, home, 'governance');
  if (heading) block.content = { ...block.content, heading };
  changes.push({ code, summary: 'Block „Datenschutz & Transparenz" ergänzt — seine Aussagen leitet der Renderer aus der Site ab (Formular-Rechtsgrundlage, Einwilligungsschranken, KI-Kennzeichnung).', complianceNote: null });
  return mapPage(bp, '/', (p) => ({ ...p, blocks: insertBeforeClosing(p.blocks, block) }));
}

function ensureMapOnHome(bp: SiteBlueprint, locality: string | null, changes: RefinementChange[]): SiteBlueprint {
  const home = homeOf(bp);
  if (!home || home.blocks.some((b) => b.kind === 'map')) return bp;
  const block = freshBlock(bp, home, 'map');
  if (locality) block.content = { ...block.content, locality };
  changes.push({
    code: 'intent.lokal.map',
    summary: 'Anfahrt auf der Startseite ergänzt.',
    complianceNote: 'Die Karte lädt erst nach Einwilligung (TDDDG § 25 Abs. 1) und ergänzt die Consent-Kategorie „karten".',
  });
  return mapPage(bp, '/', (p) => ({ ...p, blocks: insertAfter(p.blocks, block, ['contact-info', 'services']) }));
}

function ensureHeaderCta(bp: SiteBlueprint, changes: RefinementChange[]): SiteBlueprint {
  if (!bp.design?.headerCta) return bp;
  const hero = homeOf(bp)?.blocks.find((b) => b.kind === 'hero');
  const primary = hero?.content.primaryCta as { label?: unknown; href?: unknown } | undefined;
  if (!primary || typeof primary.label !== 'string' || typeof primary.href !== 'string') return bp;
  let added = 0;
  const next = {
    ...bp,
    pages: bp.pages.map((page) => ({
      ...page,
      blocks: page.blocks.map((b) => {
        if (b.kind !== 'navigation' || b.content.cta) return b;
        added += 1;
        const href = primary.href as string;
        return { ...b, content: { ...b.content, cta: { label: primary.label, href: href.startsWith('#') && page.path !== '/' ? `/kontakt${href}` : href } } };
      }),
    })),
  };
  if (added === 0) return bp;
  changes.push({ code: 'intent.cta.header', summary: `Hauptaktion „${primary.label}" zusätzlich im Kopfbereich.`, complianceNote: null });
  return next;
}

function setFormHeading(bp: SiteBlueprint, heading: string, changes: RefinementChange[], code: string): SiteBlueprint {
  let touched = 0;
  const next = mapBlocks(bp, (b) => {
    if (b.kind !== 'contact-form' || b.content.heading === heading) return b;
    if (!['Anfrage senden', 'Kontakt', 'Anfrage', 'Kontaktformular', 'Schreiben Sie uns'].includes(String(b.content.heading ?? ''))) return b;
    touched += 1;
    return { ...b, content: { ...b.content, heading } };
  });
  if (touched > 0) changes.push({ code, summary: `Überschrift des Formulars: „${heading}".`, complianceNote: null });
  return next;
}

function relabelServices(bp: SiteBlueprint, label: string, changes: RefinementChange[], code: string): SiteBlueprint {
  let touched = 0;
  const retitle = (page: SitePage): string => {
    if (page.path !== '/leistungen' || !DEFAULT_SERVICE_HEADINGS.has(page.title) || page.title === label) return page.title;
    touched += 1;
    return label;
  };
  const next = {
    ...bp,
    pages: bp.pages.map((page) => ({
      ...page,
      title: retitle(page),
      blocks: page.blocks.map((b) => {
        if (b.kind === 'services' && page.path === '/' && DEFAULT_SERVICE_HEADINGS.has(String(b.content.heading ?? '')) && b.content.heading !== label) {
          touched += 1;
          return { ...b, content: { ...b.content, heading: label } };
        }
        if (b.kind === 'navigation' || b.kind === 'footer') {
          const links = listOf(b.content.links);
          if (links.some((l) => l.href === '/leistungen' && DEFAULT_SERVICE_HEADINGS.has(String(l.label)) && l.label !== label)) {
            touched += 1;
            return { ...b, content: { ...b.content, links: links.map((l) => (l.href === '/leistungen' ? { ...l, label } : l)) } };
          }
        }
        if (b.kind === 'hero' && page.path === '/leistungen' && DEFAULT_SERVICE_HEADINGS.has(String(b.content.headline ?? '')) && b.content.headline !== label) {
          touched += 1;
          return { ...b, content: { ...b.content, headline: label } };
        }
        return b;
      }),
    })),
  };
  if (touched === 0) return bp;
  changes.push({ code, summary: `Bezeichnung „${label}" für das Angebot (Überschrift, Navigation, Seitentitel).`, complianceNote: null });
  return next;
}

function firstServiceLabel(bp: SiteBlueprint): string | null {
  const services = homeOf(bp)?.blocks.find((b) => b.kind === 'services');
  const first = listOf(services?.content.items)[0];
  return typeof first?.label === 'string' ? first.label : null;
}

function toneOf(bp: SiteBlueprint): 'sie' | 'du' {
  const text = bp.pages.flatMap((p) => p.blocks).map((b) => JSON.stringify(b.content)).join(' ');
  const du = (text.match(/\b(?:[Dd]u|[Dd]ich|[Dd]ir|[Dd]ein(?:e|en|em|er)?)\b/g) ?? []).length;
  const sie = (text.match(/\b(?:Sie|Ihnen|Ihr(?:e|en|em|er)?)\b/g) ?? []).length;
  return du > sie ? 'du' : 'sie';
}

const KIND_LABEL: Readonly<Partial<Record<BlockKind, string>>> = {
  hero: 'Hero', 'trust-bar': 'Vertrauensleiste', services: 'Leistungen', 'problem-solution': 'Anliegen & Lösung',
  process: 'Ablauf', testimonials: 'Kundenstimmen', 'case-study': 'Referenzen', faq: 'Häufige Fragen',
  'contact-info': 'Kontaktdaten', 'contact-form': 'Anfrageformular', map: 'Anfahrt', governance: 'Datenschutz & Transparenz',
  about: 'Über uns', pricing: 'Preise', cta: 'Aufforderungsband',
};

// ─────────────────────────────────────────────────────────────────────
// Design-System
// ─────────────────────────────────────────────────────────────────────

/** Setzt ein neues System, hält das Theme synchron und beschreibt den Unterschied. */
function withDesign(bp: SiteBlueprint, design: DesignSpec, changes: RefinementChange[], code: string, label: string): SiteBlueprint {
  if (!bp.design) return bp;
  const diff = describeDesignDiff(bp.design, design);
  if (diff.length === 0) return bp;
  changes.push({ code, summary: `${label} — Gestaltung: ${diff.join(', ')}.`, complianceNote: null });
  return { ...bp, design, theme: themeFromDesign(design) };
}

/** Wechselt die Richtung und leitet das System aus denselben Markensignalen neu ab. */
function switchDirection(bp: SiteBlueprint, direction: DirectionKey, changes: RefinementChange[], code: string, label: string): SiteBlueprint {
  if (!bp.design) return bp;
  const design = deriveDesignSpec(brandFromDesign(bp.design), direction);
  const next = withDesign(bp, design, changes, code, `${label} (Richtung ${directionLabel(direction)})`);
  // Der Hero der Startseite folgt der Richtung — die Richtungen setzen ihn ausdrücklich.
  return mapHomeBlocks(next, (b) => (b.kind === 'hero' && typeof b.content.variant === 'string' && b.content.variant !== design.hero
    ? { ...b, content: { ...b.content, variant: design.hero } }
    : b));
}

const SCALE_LABEL = { compact: 'kompakt', regular: 'ausgewogen', expressive: 'ausdrucksstark' } as const;
const CARD_LABEL = { bordered: 'mit Rahmen', elevated: 'mit Schatten', tinted: 'getönt' } as const;
const SPACING_LABEL = { compact: 'kompakt', regular: 'ausgewogen', airy: 'großzügig' } as const;
const HERO_LABEL = { split: 'zweispaltig', centered: 'zentriert', editorial: 'redaktionell' } as const;

export function describeDesignDiff(a: DesignSpec, b: DesignSpec): string[] {
  const out: string[] = [];
  if (a.mode !== b.mode) out.push(b.mode === 'dark' ? 'dunkles Farbschema' : 'helles Farbschema');
  if (a.palette.accent !== b.palette.accent) out.push(`Akzent ${a.palette.accent} → ${b.palette.accent}`);
  if (a.palette.surfaceAlt !== b.palette.surfaceAlt && a.palette.accent === b.palette.accent && a.mode === b.mode) out.push(`zweite Fläche ${a.palette.surfaceAlt} → ${b.palette.surfaceAlt}`);
  if (a.typography.display !== b.typography.display) out.push(isSerifStack(b.typography.display) ? 'Überschriften in Serifenschrift' : 'Überschriften in der Markenschrift');
  if (a.typography.displayWeight !== b.typography.displayWeight) out.push(`Überschriften ${a.typography.displayWeight} → ${b.typography.displayWeight}`);
  if (a.typography.scale !== b.typography.scale) out.push(`Schriftskala ${SCALE_LABEL[b.typography.scale]}`);
  if (a.typography.tracking !== b.typography.tracking) out.push(b.typography.tracking === 'tight' ? 'Überschriften enger gesetzt' : 'normale Laufweite');
  if (a.radius.control !== b.radius.control || a.radius.card !== b.radius.card) out.push(`Radien ${b.radius.control}/${b.radius.card} px`);
  if (a.buttons.primary !== b.buttons.primary) out.push(b.buttons.primary === 'pill' ? 'Schaltflächen als Pille' : 'Schaltflächen mit Ecken');
  if (a.buttons.secondary !== b.buttons.secondary) out.push(b.buttons.secondary === 'outline' ? 'Zweitaktion mit Rahmen' : 'Zweitaktion als Textschaltfläche');
  if (a.cards !== b.cards) out.push(`Karten ${CARD_LABEL[b.cards]}`);
  if (a.elevation !== b.elevation) out.push(b.elevation === 'flat' ? 'ohne Schatten' : 'mit weichem Schatten');
  if (a.sections !== b.sections) out.push(b.sections === 'banded' ? 'Abschnitte im Wechsel hinterlegt' : 'Abschnitte ohne Hinterlegung');
  if (a.spacing !== b.spacing) out.push(`Abstände ${SPACING_LABEL[b.spacing]}`);
  if (a.hero !== b.hero) out.push(`Hero ${HERO_LABEL[b.hero]}`);
  if (a.ctaEmphasis !== b.ctaEmphasis) out.push(b.ctaEmphasis === 'strong' ? 'Handlungsaufforderung betont' : 'Handlungsaufforderung zurückhaltend');
  if (a.headerCta !== b.headerCta) out.push(b.headerCta ? 'Handlungsaufforderung im Kopfbereich' : 'Kopfbereich ohne Handlungsaufforderung');
  if (a.motion !== b.motion) out.push(b.motion === 'none' ? 'ohne Bewegung' : 'dezente Einblendung');
  return out;
}

function isSerifStack(stack: string): boolean {
  const first = stack.split(',')[0].replace(/"/g, '').trim();
  return classifyFamily(first) === 'serif';
}

/**
 * Überträgt Theme-Änderungen der allgemeinen Verfeinerung ins
 * Design-System. Ohne das bliebe eine neue Akzentfarbe im Theme stehen,
 * während die gestaltete Seite die alte zeigt — eine Änderungsmeldung ohne
 * sichtbare Änderung.
 */
function bridgeThemeToDesign(
  before: SiteBlueprint,
  after: SiteBlueprint,
  generalChanges: RefinementChange[],
  notes: string[],
): { blueprint: SiteBlueprint; changes: RefinementChange[] } {
  if (!after.design) return { blueprint: after, changes: generalChanges };
  const t0 = before.theme;
  const t1 = after.theme;
  let design = after.design;
  const extra: string[] = [];

  if (t1.mode !== t0.mode || t1.accent.toLowerCase() !== t0.accent.toLowerCase()) {
    const patched = repaletteDesign(design, {
      ...(t1.mode !== t0.mode ? { mode: t1.mode } : {}),
      ...(t1.accent.toLowerCase() !== t0.accent.toLowerCase() ? { accent: t1.accent } : {}),
    });
    design = patched.design;
    extra.push(...patched.notes);
  }
  if (t1.radiusPx !== t0.radiusPx) {
    const control = Math.max(0, Math.min(16, t1.radiusPx));
    design = {
      ...design,
      radius: { control, card: design.direction === 'premium-advisory' ? control : Math.min(control + 4, 20) },
      buttons: control === 0 ? { ...design.buttons, primary: 'solid' } : design.buttons,
    };
  }
  if (t1.fontDisplay !== t0.fontDisplay || t1.fontBody !== t0.fontBody) {
    design = { ...design, typography: { ...design.typography, display: t1.fontDisplay, body: t1.fontBody } };
  }
  notes.push(...extra);

  // Änderungsmeldungen an das angleichen, was das System eingelöst hat:
  // Ein nicht möglicher Moduswechsel wird nicht gemeldet, und eine für AA
  // angepasste Farbe nennt den tatsächlichen Wert — nicht den gewünschten
  // mit dem Hinweis, er verfehle AA.
  const changes = generalChanges
    .filter((c) => !(c.code === 'theme.mode' && design.mode === before.design?.mode))
    .map((c) => {
      if (c.code !== 'theme.accent') return c;
      const adjusted = design.palette.accent.toLowerCase() !== t1.accent.toLowerCase();
      return {
        ...c,
        summary: adjusted
          ? `Akzentfarbe auf ${design.palette.accent} gesetzt (gewünscht ${t1.accent}, im selben Farbton für WCAG AA angepasst).`
          : c.summary,
        complianceNote: null,
      };
    });
  return { blueprint: { ...after, design, theme: themeFromDesign(design) }, changes };
}

// ─────────────────────────────────────────────────────────────────────
// Compliance
// ─────────────────────────────────────────────────────────────────────

/**
 * Leitet das Profil aus den Blöcken neu ab. Hat sich die Branche geändert,
 * gilt das bisherige Profil als Untergrenze: Pflichten der alten Einstufung
 * (besondere Kategorien, DSFA, Policy-Packs, Kontrollen, Rechtsgrundlagen)
 * bleiben stehen. Einwilligungskategorien folgen allein den Blöcken — eine
 * Kategorie ohne Block wäre eine Angabe ohne Gegenstand.
 */
function recompile(original: SiteBlueprint, bp: SiteBlueprint, changes: RefinementChange[]): SiteBlueprint {
  const preset = getIndustryPreset(bp.industry);
  const derived = deriveCompliance(briefFromBlueprint(bp), bp.pages, preset.compliance);
  const floor = original.industry !== bp.industry ? original.compliance : null;
  const union = (a: string[], b: string[]) => [...new Set([...a, ...b])].sort();
  const compliance = floor
    ? {
        specialCategories: derived.specialCategories || floor.specialCategories,
        legalBases: union(derived.legalBases, floor.legalBases),
        consentCategories: derived.consentCategories,
        policyPackIds: union(derived.policyPackIds, floor.policyPackIds),
        controlRefs: union(derived.controlRefs, floor.controlRefs),
        dpiaRequired: derived.dpiaRequired || floor.dpiaRequired,
      }
    : derived;
  if (compliance.dpiaRequired && !original.compliance.dpiaRequired && !changes.some((c) => c.code === 'compliance.dpia-required')) {
    changes.push({
      code: 'compliance.dpia-required',
      summary: 'Datenschutz-Folgenabschätzung ist jetzt erforderlich.',
      complianceNote: 'Art. 35 Abs. 3 lit. b DSGVO — besondere Kategorien treffen auf eine Online-Erhebung.',
    });
  }
  return { ...bp, compliance };
}
