// Beispieldaten für Beta-Mandanten (WP-4, docs/claude/BETA_V5_WORKPLAN.md).
// Bewusst ohne Deno-/Supabase-Importe: vitest prüft diese Datei direkt
// (test/edge/beta-sample-data.test.ts). Liegt im Function-Verzeichnis statt
// in `_shared/`, weil eine Änderung dort `deploy_all` auslöst.

/** Markierung in `governance_assets.metadata` — EINE Quelle für Laden, Anzeige und Entfernen. */
export const SAMPLE_FLAG = 'sample';
export const SAMPLE_SET = 'beta-v1';
/** Sichtbarer Präfix im Namen — der Tester erkennt Beispiel-Einträge ohne Metadaten. */
export const SAMPLE_NAME_PREFIX = '[Beispiel] ';

export type SampleAction = 'load' | 'remove';

export function parseAction(raw: unknown): SampleAction | null {
  return raw === 'load' || raw === 'remove' ? raw : null;
}

export interface SampleAsset {
  asset_type: 'ai_system' | 'website' | 'api' | 'dataset' | 'workflow' | 'vendor';
  name: string;
  description: string;
  ai_act_class: 'minimal' | 'limited' | 'high' | 'unknown';
  data_types: string[];
  risk_score: number;
  vendor: string | null;
  system_url: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Fünf Einträge, die einen typischen deutschen Mittelständler abbilden —
 * genug, damit Inventar, Risikoverteilung und Hochrisiko-Pfad etwas zeigen,
 * aber kein Branchenbezug (keine Patientendaten wie im alten Seed-Skript).
 *
 * Risiko-Scores sind bewusst gestreut (35–82), damit die Verteilung nicht
 * nur eine Säule zeigt. Jeder Eintrag trägt `metadata.sample = true`.
 */
export const SAMPLE_ASSETS: readonly SampleAsset[] = [
  {
    asset_type: 'ai_system',
    name: 'Bewerber-Vorauswahl (Recruiting)',
    description:
      'KI-gestützte Vorsortierung eingehender Bewerbungen nach Passung. Annex III Nr. 4 (Beschäftigung) – Hochrisiko nach EU AI Act.',
    ai_act_class: 'high',
    data_types: ['personal_data', 'email', 'cv', 'employment_history'],
    risk_score: 82,
    vendor: null,
    system_url: null,
    metadata: { system_type: 'decision_support', annex_iii: 'employment' },
  },
  {
    asset_type: 'ai_system',
    name: 'Website-Chatbot (Kundenservice)',
    description:
      'Generativer Assistent auf der Unternehmenswebsite. Transparenzpflicht nach Art. 50: Nutzer müssen erkennen, dass sie mit KI sprechen.',
    ai_act_class: 'limited',
    data_types: ['personal_data', 'email', 'chat_history'],
    risk_score: 48,
    vendor: 'OpenAI (über EU-Proxy)',
    system_url: 'https://www.example.de/chat',
    metadata: { system_type: 'chatbot', art50: true },
  },
  {
    asset_type: 'website',
    name: 'Unternehmenswebsite www.example.de',
    description:
      'Öffentliche Website mit Kontaktformular, Newsletter und Analytics. Prüfbereich für Cookies, Tracking und Datenschutzerklärung.',
    ai_act_class: 'minimal',
    data_types: ['personal_data', 'email', 'ip_address', 'cookies'],
    risk_score: 41,
    vendor: null,
    system_url: 'https://www.example.de',
    metadata: {},
  },
  {
    asset_type: 'api',
    name: 'CRM-Anbindung (Lead-Scoring)',
    description:
      'Schnittstelle zum CRM; ein Scoring-Modell priorisiert Leads. Auftragsverarbeitung (Art. 28 DSGVO) mit dem CRM-Anbieter prüfen.',
    ai_act_class: 'limited',
    data_types: ['personal_data', 'email', 'phone', 'company'],
    risk_score: 57,
    vendor: 'HubSpot',
    system_url: null,
    metadata: { system_type: 'scoring' },
  },
  {
    asset_type: 'workflow',
    name: 'Auskunftsanfragen (Art. 15) automatisiert',
    description:
      'Workflow sammelt personenbezogene Daten für Betroffenenanfragen. Fristen (1 Monat) und Vollständigkeit sind nachweispflichtig.',
    ai_act_class: 'minimal',
    data_types: ['personal_data', 'email', 'address'],
    risk_score: 35,
    vendor: null,
    system_url: null,
    metadata: { system_type: 'automation' },
  },
];

/** Zeile für `governance_assets` — Name mit Präfix, Metadaten mit Markierung. */
export function toInsertRow(asset: SampleAsset, tenantId: string): Record<string, unknown> {
  return {
    tenant_id: tenantId,
    asset_type: asset.asset_type,
    name: `${SAMPLE_NAME_PREFIX}${asset.name}`,
    description: asset.description,
    ai_act_class: asset.ai_act_class,
    data_types: asset.data_types,
    risk_score: asset.risk_score,
    vendor: asset.vendor,
    system_url: asset.system_url,
    owner_email: null,
    status: 'active',
    metadata: { ...asset.metadata, [SAMPLE_FLAG]: true, sample_set: SAMPLE_SET },
  };
}

/** Erkennung über die Metadaten, nicht über den Namen (der ist editierbar). */
export function isSampleAsset(row: { metadata?: unknown }): boolean {
  const m = row.metadata;
  return typeof m === 'object' && m !== null && (m as Record<string, unknown>)[SAMPLE_FLAG] === true;
}

export type LoadDecision = { kind: 'load' } | { kind: 'already'; count: number };

/** Idempotent: liegen schon Beispiel-Einträge vor, wird nichts verdoppelt. */
export function decideLoad(existingSampleCount: number): LoadDecision {
  return existingSampleCount > 0 ? { kind: 'already', count: existingSampleCount } : { kind: 'load' };
}
