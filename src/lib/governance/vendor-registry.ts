// Vendor- und AI-Widget-Registry für die Multi-Website-Governance-Pipeline
// (P1.8 in docs/pilot/technical-tasks.md)
//
// Lädt die committeten JSON-Listen, validiert sie zur Build-Zeit über
// TypeScript und exponiert deterministische Lookup-Funktionen. Keine
// I/O zur Laufzeit — alles in-memory, pure.
//
// Match-Strategie:
//   - Host-Match ist Suffix-basiert. "www.google-analytics.com" matcht
//     "google-analytics.com". Pfad-Matches (z. B. "google.com/recaptcha")
//     werden über substring-Vergleich gegen die volle URL geprüft.
//   - Widget-Detection nutzt scriptHosts (URL-Suffix), domSelectors
//     (vom Scanner ausgewertet, hier nur Daten) und globals (window-
//     Properties, ebenfalls vom Scanner ausgewertet).

import knownVendorsJson from './known-vendors.json';
import knownAiWidgetsJson from './known-ai-widgets.json';

export type VendorCategory =
  | 'analytics'
  | 'advertising'
  | 'social'
  | 'cdn'
  | 'fonts'
  | 'tag_manager'
  | 'payment'
  | 'video'
  | 'audio'
  | 'chat'
  | 'support'
  | 'cmp'
  | 'error_monitoring'
  | 'crm'
  | 'email_marketing'
  | 'captcha'
  | 'forms'
  | 'scheduling'
  | 'infra';

export interface VendorEntry {
  domain: string;
  vendor: string;
  category: VendorCategory;
  country: string;
}

export type AiWidgetType = 'chat' | 'ai_bot';

export interface AiWidgetEntry {
  id: string;
  vendor: string;
  type: AiWidgetType;
  country: string;
  scriptHosts: string[];
  domSelectors: string[];
  globals: string[];
}

const VENDORS: readonly VendorEntry[] = knownVendorsJson as VendorEntry[];
const AI_WIDGETS: readonly AiWidgetEntry[] = knownAiWidgetsJson as AiWidgetEntry[];

export const knownVendors = VENDORS;
export const knownAiWidgets = AI_WIDGETS;

/**
 * Normalisiert einen Host für Suffix-Match. Entfernt Protokoll, Port,
 * Pfad und vorangestellte Punkte; lowercase.
 */
export function normalizeHost(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '');
  s = s.replace(/^\/\//, '');
  // Nur Host-Teil — alles ab erstem '/' oder ':' wegschneiden, wenn
  // pfad-/portfrei gewünscht. Für Pfad-Patterns behalten wir den Pfad
  // aber, deshalb hier nur das, was vor einem Slash NICHT zum Host
  // gehört, behutsam normalisieren.
  return s.replace(/^\.+/, '');
}

function hostSuffixMatches(hostFromUrl: string, pattern: string): boolean {
  if (hostFromUrl === pattern) return true;
  return hostFromUrl.endsWith('.' + pattern);
}

/**
 * Findet einen Vendor zu einem gegebenen Host oder einer URL. Liefert
 * undefined wenn keine Regel matcht.
 */
export function lookupVendor(input: string): VendorEntry | undefined {
  if (!input) return undefined;
  const normalized = normalizeHost(input);
  // Pfad-Patterns (enthalten '/') matchen als Substring auf die normalisierte URL.
  // Reine Host-Patterns matchen suffix-basiert auf den Host-Teil (vor erstem '/').
  const hostOnly = normalized.split('/')[0];
  for (const entry of VENDORS) {
    if (entry.domain.includes('/')) {
      if (normalized.includes(entry.domain)) return entry;
    } else if (hostSuffixMatches(hostOnly, entry.domain)) {
      return entry;
    }
  }
  return undefined;
}

/** Convenience-Boolean um lookupVendor. */
export function isKnownVendor(input: string): boolean {
  return lookupVendor(input) !== undefined;
}

/**
 * Findet ein AI-/Chat-Widget zu einem Script-URL-Host. Liefert
 * undefined wenn keine Regel matcht. Für DOM-/globals-Detection läuft
 * der Scanner direkt gegen `widget.domSelectors` / `widget.globals` —
 * dafür stellen die Registry-Entries die Daten bereit.
 */
export function lookupAiWidgetByScriptHost(input: string): AiWidgetEntry | undefined {
  if (!input) return undefined;
  const normalized = normalizeHost(input);
  const hostOnly = normalized.split('/')[0];
  for (const widget of AI_WIDGETS) {
    for (const pattern of widget.scriptHosts) {
      if (hostSuffixMatches(hostOnly, pattern)) return widget;
    }
  }
  return undefined;
}

/** Liefert alle Vendoren einer Kategorie (z. B. alle CMPs). */
export function vendorsByCategory(category: VendorCategory): VendorEntry[] {
  return VENDORS.filter((v) => v.category === category);
}

/** Indikator für DSGVO-relevante Drittlandtransfers (EU-Schwerwarn-Liste). */
const NON_EU_COUNTRIES_OF_INTEREST = new Set(['US', 'CN', 'RU']);

export function isNonEuVendor(vendor: VendorEntry): boolean {
  return NON_EU_COUNTRIES_OF_INTEREST.has(vendor.country);
}
