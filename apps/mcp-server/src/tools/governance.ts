import { supabase } from '../services/supabase.js';
import { ComplianceStatus, FrameworkControl } from '../types/index.js';
import type { Database } from '../types/database.js';

/**
 * Signalisiert, dass ein Tool noch keine echten Daten liefert.
 *
 * Bewusst ein Fehler statt eines Platzhalter-Ergebnisses: Diese Tools werden
 * von KI-Agenten aufgerufen, die ihre Antwort ungeprüft weitergeben. Ein
 * zurückgegebenes `score: 0, compliant: false` liest sich wie ein Befund
 * ("nicht konform"), obwohl nichts gemessen wurde — in einem Compliance-
 * Produkt ist eine erfundene Bewertung schädlicher als eine klare Fehlermeldung.
 */
export class NotImplementedError extends Error {
  constructor(tool: string, blockedBy: string) {
    super(`${tool} ist noch nicht implementiert (offen: ${blockedBy})`);
    this.name = 'NotImplementedError';
  }
}

/**
 * ─── Zwei Kataloge in einer Tabelle ──────────────────────────────────────
 *
 * `framework_controls` trägt zwei unabhängig gewachsene Bestände nebeneinander,
 * gemessen am 2026-08-31 gegen das Live-Projekt:
 *
 * - **`relation`** — 27 Zeilen mit `framework_id` als Fremdschlüssel auf
 *   `compliance_frameworks`. Tragen `control_name` und `category`, kein `title`.
 * - **`label`** — 192 Zeilen mit einem Text in `framework` (`ISO_27001`,
 *   `GDPR`, …). Tragen `title` und `severity`, keine `category`, kein FK.
 *
 * Sie überschneiden sich inhaltlich und widersprechen sich in der Menge: ISO
 * 27001 hat 1 Control über den Fremdschlüssel und 97 über die Textspalte,
 * die DSGVO 2 gegenüber 24. ISO 42001 gibt es nur über den Fremdschlüssel
 * (21), DORA, SOC 2 und TISAX nur über die Textspalte (zusammen 38) — für
 * diese drei existiert nicht einmal ein Eintrag in `compliance_frameworks`.
 *
 * **Deshalb liest `listControls` beide Wege und führt sie zusammen.** Nur einen
 * abzufragen hieße, je nach Framework zwischen 4 % und 100 % des Katalogs
 * auszuliefern — ohne dass es dem Aufrufer auffiele. Jede Zeile trägt in
 * `source`, woher sie stammt.
 *
 * Das ist eine Brücke, keine Lösung. Die beiden Bestände gehören
 * zusammengeführt; das ist eine Datenentscheidung und gehört nicht in einen
 * lesenden Server.
 */

/** Auf Vergleichbarkeit reduziert: `ISO_27001`, `iso-27001`, `iso27001` → `iso27001`. */
function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Brücke zwischen den Schreibweisen beider Bestände.
 *
 * Aus den Daten abgelesen, nicht gewählt — `compliance_frameworks.code` und
 * `framework_controls.framework` benennen dieselben Frameworks verschieden
 * (`ai_act` gegenüber `EU_AI_ACT`). Eine rein algorithmische Ableitung scheitert
 * genau daran. Kommt ein Framework hinzu, gehört es hier ergänzt.
 */
const FRAMEWORK_ALIASES: ReadonlyArray<{
  /** Kanonischer Schlüssel, normalisiert. */
  key: string;
  /** Anzeigename. */
  name: string;
  /** Akzeptierte Eingaben, normalisiert. */
  accepts: readonly string[];
  /** Exakte Werte der Textspalte `framework`. */
  labels: readonly string[];
}> = [
  { key: 'iso42001', name: 'ISO/IEC 42001', accepts: ['iso42001'], labels: ['ISO_42001'] },
  { key: 'iso27001', name: 'ISO/IEC 27001', accepts: ['iso27001'], labels: ['ISO_27001'] },
  { key: 'gdpr', name: 'DSGVO', accepts: ['gdpr', 'dsgvo'], labels: ['GDPR'] },
  {
    key: 'ai_act',
    name: 'EU AI Act',
    accepts: ['aiact', 'euaiact', 'euaiactregulation'],
    labels: ['EU_AI_ACT'],
  },
  { key: 'nis2', name: 'NIS2-Richtlinie', accepts: ['nis2'], labels: ['NIS2'] },
  { key: 'dora', name: 'DORA', accepts: ['dora'], labels: ['DORA'] },
  { key: 'soc2', name: 'SOC 2', accepts: ['soc2'], labels: ['SOC_2'] },
  { key: 'tisax', name: 'TISAX', accepts: ['tisax'], labels: ['TISAX'] },
];

/** Bekannte Framework-Schlüssel — für Fehlermeldungen und die Werkzeugbeschreibung. */
export const KNOWN_FRAMEWORKS = FRAMEWORK_ALIASES.map((f) => ({ key: f.key, name: f.name }));

export class UnknownFrameworkError extends Error {
  override readonly name = 'UnknownFrameworkError';
  constructor(input: string) {
    super(
      `Unbekanntes Framework "${input}". Bekannt sind: ` +
        FRAMEWORK_ALIASES.map((f) => f.key).join(', '),
    );
  }
}

function resolveFramework(input: string) {
  const needle = normalizeKey(input);
  const hit = FRAMEWORK_ALIASES.find(
    (f) => f.key === needle || f.accepts.includes(needle) || f.labels.some((l) => normalizeKey(l) === needle),
  );
  if (!hit) throw new UnknownFrameworkError(input);
  return hit;
}

type ControlRow = Database['public']['Tables']['framework_controls']['Row'];

function mapControl(row: ControlRow, framework: string, source: 'relation' | 'label'): FrameworkControl {
  return {
    id: row.id,
    controlCode: row.control_code,
    // Die beiden Bestände füllen unterschiedliche Spalten: `label` trägt
    // `title`, `relation` trägt `control_name`. Fällt beides aus, bleibt der
    // Code als Bezeichnung — besser als ein leerer Name.
    name: row.title ?? row.control_name ?? row.control_code,
    description: row.description ?? undefined,
    guidance: row.guidance ?? undefined,
    category: row.category ?? undefined,
    severity: row.severity ?? undefined,
    framework,
    source,
  };
}

/**
 * Controls eines Frameworks aus dem globalen Katalog.
 *
 * **Kein Tenant-Bezug und kein Erfüllungsstand.** Die Antwort sagt, was das
 * Framework fordert — nicht, wie weit dieser Tenant es erfüllt. Der Parameter
 * `tenantId` wird deshalb nicht ausgewertet; er bleibt in der Signatur, weil
 * jeder Aufruf über den Prüfpfad einem Key zugeordnet wird.
 */
export async function listControls(
  _tenantId: string,
  frameworkId: string = 'iso42001',
): Promise<FrameworkControl[]> {
  const framework = resolveFramework(frameworkId);

  // Weg 1: über den Fremdschlüssel. Nicht jedes Framework hat einen Eintrag in
  // compliance_frameworks — DORA, SOC 2 und TISAX fehlen dort —, deshalb ist
  // ein leeres Ergebnis hier kein Fehler.
  const { data: fwRows, error: fwError } = await supabase
    .from('compliance_frameworks')
    .select('id')
    .eq('code', framework.key)
    .limit(1);

  if (fwError) {
    throw new Error(`Framework-Auflösung fehlgeschlagen: ${fwError.message}`);
  }

  const controls: FrameworkControl[] = [];
  const frameworkRowId = fwRows?.[0]?.id;

  if (frameworkRowId) {
    const { data, error } = await supabase
      .from('framework_controls')
      .select('*')
      .eq('framework_id', frameworkRowId)
      .order('control_code', { ascending: true });

    if (error) throw new Error(`Control-Abfrage fehlgeschlagen: ${error.message}`);
    for (const row of data ?? []) controls.push(mapControl(row, framework.key, 'relation'));
  }

  // Weg 2: über die Textspalte.
  const { data: labelled, error: labelError } = await supabase
    .from('framework_controls')
    .select('*')
    .in('framework', [...framework.labels])
    .order('control_code', { ascending: true });

  if (labelError) throw new Error(`Control-Abfrage fehlgeschlagen: ${labelError.message}`);
  for (const row of labelled ?? []) controls.push(mapControl(row, framework.key, 'label'));

  // Nach Code sortiert, damit die Reihenfolge nicht davon abhängt, welcher
  // Bestand zuerst gelesen wurde.
  return controls.sort((a, b) => a.controlCode.localeCompare(b.controlCode, 'de'));
}

/**
 * Compliance-Stand eines Frameworks (ISO 42001, EU AI Act, …).
 *
 * Noch nicht implementiert, und zwar aus einem Datengrund, nicht aus einem
 * Zeitgrund: Der Erfüllungsstand je Control steht in
 * `framework_implementations`. Diese Tabelle ist leer — am 2026-08-31 über
 * alle Tenants hinweg null Zeilen. Ein Score daraus wäre für jeden Tenant
 * „0 von 219" und läse sich als „nicht konform", obwohl in Wahrheit nur
 * niemand etwas erfasst hat.
 *
 * Sobald dort Daten stehen, ist die Berechnung eine reine Auszählung und
 * braucht keine Gewichtungsentscheidung.
 */
export async function getGovernanceStatus(
  _tenantId: string,
  frameworkId: string = 'iso42001',
): Promise<ComplianceStatus> {
  throw new NotImplementedError(
    `governance.get_status(${frameworkId})`,
    'framework_implementations ist leer — kein Tenant hat einen Control-Status erfasst',
  );
}

/**
 * Erfüllungsstand eines einzelnen Controls.
 *
 * Noch nicht implementiert, gleicher Grund wie oben: Weder
 * `framework_implementations` noch `asset_control_mappings` enthalten Zeilen,
 * es gibt also keine Verknüpfung zwischen einem Control und einem Nachweis,
 * die man auslesen könnte.
 */
export async function checkComplianceStatus(
  _tenantId: string,
  controlId: string,
): Promise<{ compliant: boolean; evidence_count: number; last_verified: Date | null }> {
  throw new NotImplementedError(
    `governance.check_compliance(${controlId})`,
    'framework_implementations und asset_control_mappings sind leer — keine Verknüpfung Control ↔ Nachweis',
  );
}
