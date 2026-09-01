// Prompt → Brief.
//
// Der AI Builder nimmt einen Freitext-Prompt entgegen
// („Erstelle eine Website für einen Zahnarzt in Hamburg.") und leitet daraus
// zuerst einen strukturierten Brief ab. Diese Ableitung ist DETERMINISTISCH
// und modellfrei:
//
//   • Sie liefert einen belastbaren Fallback, wenn kein Modell erreichbar ist
//     (EU-lokaler Betrieb, Ollama-Ausfall, Rate-Limit).
//   • Sie ist testbar — Branche und Compliance-Gerüst dürfen nicht davon
//     abhängen, wie ein Modell einen Prompt an einem Dienstag interpretiert.
//
// Ein Sprachmodell darf den Brief anschließend anreichern (Copy, Leistungen,
// FAQ). Es darf ihn nicht ersetzen: `mergeBrief` lässt nur Felder zu, die
// keine Compliance-Wirkung haben.

import type { IndustryKey, Locale } from '../types.ts';
import { INDUSTRY_PRESETS } from './industries.ts';

export interface SiteBrief {
  /** Anzeigename der Site. */
  name: string;
  industry: IndustryKey;
  /** Ort für lokale Suche und Impressumspflicht; `null` wenn unbekannt. */
  locality: string | null;
  /** Kurzbeschreibung für Meta-Description und Hero-Subline. */
  summary: string;
  /** Angebotene Leistungen — füllt `services`-Blöcke. */
  services: string[];
  /**
   * Belege für den „Warum wir"-Block — ausschließlich aus dem Scan oder aus
   * Redaktion, nie erfunden.
   *
   * Bis zum 2026-09-01 stand an dieser Stelle nichts, und der Block trug
   * stattdessen drei fest verdrahtete Sätze („Persönliche Betreuung — Feste
   * Ansprechpartner statt Warteschleife."). Die gingen an jeden Kunden
   * jeder Branche, unabhängig davon, was gescannt wurde. Eine erfundene
   * Aussage über ein fremdes Unternehmen ist keine Vorschau, sondern eine
   * Behauptung, für die niemand einstehen kann (§ 5 UWG).
   *
   * Leer ist deshalb ein gültiger Zustand und der Normalfall: Der Block
   * geht dann leer und als `requiresRealContent` markiert in den Blueprint
   * und wird von `analysis/blueprint.ts` als
   * `content.awaiting-real-content` gemeldet.
   */
  highlights: string[];
  locale: Locale;
  /** Wurde die Branche sicher erkannt oder auf `sonstiges` zurückgefallen? */
  industryConfident: boolean;
}

/** Vom Modell befüllbare Felder — bewusst ohne Compliance-Wirkung. */
export interface BriefEnrichment {
  name?: string;
  summary?: string;
  services?: string[];
  /** Echte Vorzüge aus Scan oder Redaktion. Ohne Angabe bleibt der Block leer. */
  highlights?: string[];
  locality?: string | null;
}

// Füllwörter, die vor dem Ortsnamen stehen dürfen bzw. ihn beenden.
const LOCALITY_STOPWORDS = new Set([
  'und', 'oder', 'mit', 'ohne', 'für', 'die', 'der', 'das', 'eine', 'einen',
  'einem', 'sowie', 'inkl', 'inklusive', 'plus',
]);

/**
 * Erkennt die Branche über die Preset-Begriffe. Der erste Treffer im Text
 * gewinnt; bei Gleichstand entscheidet die Reihenfolge der Presets, damit
 * das Ergebnis unabhängig von der Objekt-Iteration stabil bleibt.
 */
export function detectIndustry(prompt: string): { industry: IndustryKey; confident: boolean } {
  const haystack = prompt.toLowerCase();
  let best: { industry: IndustryKey; at: number } | null = null;

  for (const preset of Object.values(INDUSTRY_PRESETS)) {
    for (const term of preset.promptTerms) {
      const at = haystack.indexOf(term);
      if (at === -1) continue;
      if (best === null || at < best.at) best = { industry: preset.key, at };
    }
  }

  if (best === null) return { industry: 'sonstiges', confident: false };
  return { industry: best.industry, confident: true };
}

/**
 * Zieht den Ort aus einer „in <Ort>"-Wendung. Bewusst konservativ: lieber
 * `null` als ein falscher Ort, weil der Ort ins Impressum und in die
 * JSON-LD-Geo-Angabe wandert.
 */
export function detectLocality(prompt: string): string | null {
  // Groß geschriebenes Wort (ggf. mehrteilig, mit Bindestrich) nach „in ".
  const match = /\bin\s+([A-ZÄÖÜ][\wäöüß-]+(?:\s+[A-ZÄÖÜ][\wäöüß-]+)?)/u.exec(prompt);
  if (!match) return null;

  const parts = match[1].split(/\s+/).filter((p) => !LOCALITY_STOPWORDS.has(p.toLowerCase()));
  if (parts.length === 0) return null;

  // Satzzeichen am Ende abschneiden.
  const locality = parts.join(' ').replace(/[.,;:!?]+$/u, '').trim();
  return locality.length >= 2 ? locality : null;
}

/**
 * Baut aus dem Prompt einen vollständigen Brief. Wirft nie — ein leerer
 * Prompt ergibt einen generischen, aber gültigen Brief.
 */
export function parseBrief(prompt: string, locale: Locale = 'de'): SiteBrief {
  const trimmed = prompt.trim();
  const { industry, confident } = detectIndustry(trimmed);
  const locality = detectLocality(trimmed);
  const preset = INDUSTRY_PRESETS[industry];

  // Der Preset-Name ist ein Katalogeintrag („Agentur / Dienstleistung"),
  // kein Firmenname. Bis der Kunde einen echten nennt, wird wenigstens die
  // Schrägstrich-Form vermieden — als Wortmarke im Kopf der Website liest
  // sie sich wie ein Fehler.
  const label = preset.label.split(' / ')[0];
  const name = locality ? `${label} ${locality}` : label;
  const summary = locality
    ? `${label} in ${locality} — persönliche Beratung, transparente Leistungen und kurze Wege.`
    : `${label} — persönliche Beratung, transparente Leistungen und kurze Wege.`;

  return {
    name,
    industry,
    locality,
    summary,
    services: defaultServices(industry),
    // Aus einem Prompt allein lassen sich keine Vorzüge belegen. Der Brief
    // sagt hier bewusst „nichts bekannt" statt etwas Plausibles.
    highlights: [],
    locale,
    industryConfident: confident,
  };
}

/**
 * Übernimmt Modell-Vorschläge in den Brief. Branche, Locale und das daraus
 * abgeleitete Compliance-Profil bleiben unangetastet — ein halluziniertes
 * `industry: 'sonstiges'` darf eine Zahnarztpraxis nicht aus der
 * Art.-9-Behandlung herausfallen lassen.
 */
export function mergeBrief(base: SiteBrief, enrichment: BriefEnrichment): SiteBrief {
  const services = enrichment.services?.map((s) => s.trim()).filter((s) => s.length > 0);
  const highlights = enrichment.highlights?.map((s) => s.trim()).filter((s) => s.length > 0);
  const name = enrichment.name?.trim() || base.name;

  return {
    ...base,
    name,
    summary: enrichment.summary?.trim() || renameInSummary(base, name),
    services: services && services.length > 0 ? services.slice(0, 12) : base.services,
    highlights: highlights && highlights.length > 0 ? highlights.slice(0, 6) : base.highlights,
    // `null` ist eine gültige Korrektur („kein Ort erkennbar"), `undefined`
    // heißt „keine Aussage" — nur dann bleibt der Basiswert stehen.
    locality: enrichment.locality === undefined ? base.locality : enrichment.locality,
  };
}

/**
 * Zieht einen neuen Namen in die Zusammenfassung nach.
 *
 * Ohne das steht im Hero „Studio Vogt Architekten" und direkt darunter
 * „Agentur in Leipzig — …": Die Kurzbeschreibung stammt aus dem
 * Branchen-Preset und trüge weiterhin den Katalogbegriff. Sie landet als
 * Meta-Description und als Hero-Unterzeile im ausgelieferten Dokument — der
 * Widerspruch wäre also sichtbar und indexiert.
 *
 * Ersetzt wird ausschließlich der führende Katalogbegriff. Eine
 * Zusammenfassung, die anders beginnt (weil ein Modell sie geliefert hat),
 * bleibt unangetastet.
 */
function renameInSummary(base: SiteBrief, name: string): string {
  if (name === base.name) return base.summary;

  const label = INDUSTRY_PRESETS[base.industry].label.split(' / ')[0];
  return base.summary.startsWith(label) ? name + base.summary.slice(label.length) : base.summary;
}

const SERVICE_DEFAULTS: Readonly<Partial<Record<IndustryKey, string[]>>> = Object.freeze({
  zahnarzt: ['Prophylaxe', 'Zahnerhaltung', 'Implantologie', 'Ästhetische Zahnheilkunde', 'Kinderzahnheilkunde'],
  arztpraxis: ['Vorsorgeuntersuchungen', 'Diagnostik', 'Impfberatung', 'Chronikerbetreuung'],
  rechtsanwalt: ['Arbeitsrecht', 'Familienrecht', 'Vertragsrecht', 'Erbrecht'],
  steuerberatung: ['Jahresabschluss', 'Lohnbuchhaltung', 'Steuererklärung', 'Betriebsprüfung'],
  handwerk: ['Beratung vor Ort', 'Ausführung', 'Wartung', 'Notdienst'],
  gastronomie: ['Mittagstisch', 'Abendkarte', 'Veranstaltungen', 'Catering'],
  immobilien: ['Bewertung', 'Vermarktung', 'Vermietung', 'Hausverwaltung'],
  agentur: ['Strategie', 'Umsetzung', 'Betreuung', 'Schulung'],
  ecommerce: ['Sortiment', 'Versand', 'Rückgabe', 'Kundenservice'],
});

function defaultServices(industry: IndustryKey): string[] {
  return SERVICE_DEFAULTS[industry] ?? ['Beratung', 'Umsetzung', 'Betreuung'];
}
