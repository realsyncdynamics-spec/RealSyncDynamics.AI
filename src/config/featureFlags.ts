/**
 * Zentrale Feature-Flags für vorübergehend abgeschaltete Oberflächen.
 *
 * GOVERNANCE_AI — Seite „Governance AI“ (`/app/assistant`,
 * `GovernanceAiWorkspace`). Standard: AUS.
 *
 * Grund: `GovernanceAiWorkspace` ruft die Edge Function `ai-gateway` mit dem
 * öffentlichen Anon-Key auf. Das Gateway prüft die Anmeldung bisher nur für
 * den Builder-Pfad (`feature: 'app_builder_code'`). Bis das Gateway für alle
 * Aufrufe Login und `tenant_id` verlangt, bleibt die Seite verborgen: keine
 * Route, keine Navigationseinträge, kein Mount des Workspace (also auch kein
 * Gateway-Aufruf und kein Laden des Chunks).
 *
 * Wieder einschalten: `VITE_GOVERNANCE_AI_ENABLED=true` beim Build setzen
 * oder `GOVERNANCE_AI_DEFAULT` unten auf `true` stellen.
 */

/** Standardwert, wenn keine Build-Env gesetzt ist. */
export const GOVERNANCE_AI_DEFAULT = false;

/** Route der Governance-AI-Seite. */
export const GOVERNANCE_AI_PATH = '/app/assistant';

/**
 * Liest den Schalter zur Laufzeit (nicht beim Modul-Import), damit Tests ihn
 * per `vi.stubEnv('VITE_GOVERNANCE_AI_ENABLED', 'true')` umschalten können.
 * Nur der exakte Wert `'true'` schaltet ein; `'false'` schaltet aus.
 */
export function isGovernanceAiEnabled(): boolean {
  const raw = import.meta.env?.VITE_GOVERNANCE_AI_ENABLED;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return GOVERNANCE_AI_DEFAULT;
}

/**
 * APP_BUILDER_SANDBOX_PREVIEW — Laufzeit-Vorschau per Sandbox im Code-Builder
 * (`/builder/:slug/code`). Spike vom 22.11.2026, Standard: AUS.
 *
 * Ohne Flag wird die Laufzeit-Vorschau weder gerendert noch geladen; die
 * srcDoc-Vorschau bleibt Standard und Rückfall. Serverseitig gilt zusätzlich
 * `APP_BUILDER_SANDBOX_PREVIEW=true` in der Edge Function `siteos` — ohne
 * beide Schalter startet keine Sandbox. Nur gegen einen Fake-Adapter getestet.
 * Bericht: `docs/builder/SPIKE_SANDBOX_PREVIEW_2026-11-22.md`.
 */
export const APP_BUILDER_SANDBOX_PREVIEW_DEFAULT = false;

export function isSandboxPreviewEnabled(): boolean {
  const raw = import.meta.env?.VITE_APP_BUILDER_SANDBOX_PREVIEW;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return APP_BUILDER_SANDBOX_PREVIEW_DEFAULT;
}
