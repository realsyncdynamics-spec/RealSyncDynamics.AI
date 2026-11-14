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
 * creative_studio_editor — Social-Design-Editor (`/app/creative-studio`).
 * Standard: AUS. Einschalten nur mit `VITE_CREATIVE_STUDIO_EDITOR_ENABLED=true`.
 *
 * In `ENTITLEMENT_KEYS` gibt es keinen Key für diesen Editor. Die Fläche
 * hängt deshalb nur an diesem Flag. Solange Mandanten-Entitlements laden,
 * bleibt sie zusätzlich zu (fail-closed), siehe `creativeStudioGate`.
 */
export const CREATIVE_STUDIO_EDITOR_FLAG = 'creative_studio_editor' as const;

export const CREATIVE_STUDIO_EDITOR_DEFAULT = false;

export const CREATIVE_STUDIO_PATH = '/app/creative-studio';

export function isCreativeStudioEditorEnabled(): boolean {
  const raw = import.meta.env?.VITE_CREATIVE_STUDIO_EDITOR_ENABLED;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return CREATIVE_STUDIO_EDITOR_DEFAULT;
}
