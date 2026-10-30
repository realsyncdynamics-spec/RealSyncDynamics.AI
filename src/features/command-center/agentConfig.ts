/**
 * M5 — Soll-Konfiguration je Agent: Details / Bibliothek / Computer.
 * Quelle: public.agent_config_versions (versioniert, unveränderlich, Aktivierung nur per RPC).
 * Soll ≠ Ist: Der Ist-Zustand externer Dienste wird hier nicht behauptet.
 */
export type ConfigSection = 'details' | 'library' | 'computer';
export const SECTIONS: ReadonlyArray<{ key: ConfigSection; label: string }> = [
  { key: 'details', label: 'Details' },
  { key: 'library', label: 'Bibliothek' },
  { key: 'computer', label: 'Computer' },
];

export interface ConfigVersionRow {
  id: string;
  agent_ref: string;
  section: ConfigSection;
  version: number;
  config: Record<string, unknown>;
  status: 'draft' | 'active' | 'superseded';
  change_note: string | null;
  created_at: string;
  activated_at: string | null;
}

/** Erlaubte Felder je Bereich (Soll-Schema). Unbekannte Felder werden abgelehnt. */
export const SECTION_FIELDS: Record<ConfigSection, Record<string, 'string' | 'string[]' | 'object[]'>> = {
  details: {
    role: 'string', responsibility: 'string', system_prompt: 'string',
    capabilities: 'string[]', approval_limits: 'string', autopilot_max_level: 'string',
  },
  library: { documents: 'object[]', project_knowledge: 'string[]', references: 'string[]', memories: 'string[]', knowledge_base_ids: 'string[]' },
  computer: { tools: 'string[]', services: 'string[]', permissions: 'string[]', environment: 'string', terminal: 'string', browser: 'string' },
};

export const FIELD_LABEL: Record<string, string> = {
  role: 'Rolle', responsibility: 'Zuständigkeit', system_prompt: 'System-Prompt', capabilities: 'Fähigkeiten',
  approval_limits: 'Freigabegrenzen', autopilot_max_level: 'Max. Autopilot-Level',
  documents: 'Dokumente', project_knowledge: 'Projektwissen', references: 'Referenzen', memories: 'Erinnerungen',
  knowledge_base_ids: 'Wissensbasis (agent_knowledge_base)',
  tools: 'Tools', services: 'Dienste', permissions: 'Rechte', environment: 'Umgebung', terminal: 'Terminal', browser: 'Browser',
};

const SECRET_KEY = /(secret|token|password|passwort|api[_-]?key|private[_-]?key|credential)/i;
const SECRET_VALUE = /(sk_(live|test)_|rk_live_|ghp_|github_pat_|xox[bp]-|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJhbGciOi)/;

export type ValidationResult = { ok: true; config: Record<string, unknown> } | { ok: false; errors: string[] };

/** Prüft eine Soll-Konfiguration. Secrets sind verboten (nur Verweise auf Secret-Namen erlaubt). */
export function validateConfig(section: ConfigSection, raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['Konfiguration muss ein Objekt sein'] };
  const fields = SECTION_FIELDS[section];
  const cfg = raw as Record<string, unknown>;
  for (const [k, v] of Object.entries(cfg)) {
    const t = fields[k];
    if (!t) { errors.push(`Unbekanntes Feld: ${k}`); continue; }
    if (t === 'string' && typeof v !== 'string') errors.push(`${k} muss Text sein`);
    if (t === 'string[]' && !(Array.isArray(v) && v.every((x) => typeof x === 'string'))) errors.push(`${k} muss Textliste sein`);
    if (t === 'object[]' && !(Array.isArray(v) && v.every((x) => x && typeof x === 'object' && !Array.isArray(x)))) errors.push(`${k} muss Objektliste sein`);
  }
  if (section === 'details' && typeof cfg.autopilot_max_level === 'string' && !/^L[0-4]$/.test(cfg.autopilot_max_level)) {
    errors.push('autopilot_max_level muss L0–L4 sein');
  }
  const json = JSON.stringify(cfg);
  if (SECRET_VALUE.test(json)) errors.push('Konfiguration enthält vermutlich ein Secret — nur Secret-Namen referenzieren');
  const walk = (o: unknown): void => {
    if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) {
      if (SECRET_KEY.test(k)) errors.push(`Feld „${k}“ deutet auf ein Secret hin — nicht erlaubt`);
      walk(v);
    }
  };
  walk(cfg);
  if (json.length > 50_000) errors.push('Konfiguration zu groß (max. 50 000 Zeichen)');
  return errors.length ? { ok: false, errors } : { ok: true, config: cfg };
}

export interface SectionView { active: ConfigVersionRow | null; drafts: ConfigVersionRow[]; history: ConfigVersionRow[] }

export function sectionView(rows: ReadonlyArray<ConfigVersionRow>, agentRef: string, section: ConfigSection): SectionView {
  const mine = rows.filter((r) => r.agent_ref === agentRef && r.section === section).sort((a, b) => b.version - a.version);
  return {
    active: mine.find((r) => r.status === 'active') ?? null,
    drafts: mine.filter((r) => r.status === 'draft'),
    history: mine.filter((r) => r.status === 'superseded'),
  };
}

/** Feld-für-Feld-Unterschied zweier Konfigurationen (für Entwurf vs. aktiv). */
export function diffConfig(a: Record<string, unknown> | null, b: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b)]);
  return [...keys].filter((k) => JSON.stringify((a ?? {})[k]) !== JSON.stringify(b[k])).sort();
}

export function formatValue(v: unknown): string {
  if (v === undefined || v === null || v === '') return 'nicht gesetzt';
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(', ') : 'leer';
  return typeof v === 'string' ? v : JSON.stringify(v);
}
