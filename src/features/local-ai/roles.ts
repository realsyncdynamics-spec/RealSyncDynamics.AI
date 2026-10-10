import type { GovernanceTestSummary, LocalAiRole, LocalAiRoleId } from './types';

export const DEFAULT_RUNTIME_URL = 'http://127.0.0.1:11434';
export const LAN_RUNTIME_URL_EXAMPLE = 'http://192.168.x.x:11434';
export const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download';
export const DEFAULT_PROFILE_NAME = 'Local Governance Runtime';

/**
 * Empfohlene Zuordnung Rolle → Modell. Die Modelle sind Empfehlungen; ob sie
 * auf dem Gerät installiert sind, entscheidet ausschließlich `/api/tags`.
 */
export const LOCAL_AI_ROLES: readonly LocalAiRole[] = [
  {
    id: 'governance',
    label: 'Governance Agent',
    description: 'Prüft KI-Einsätze auf DSGVO- und EU-AI-Act-Risiken. Basis für alle weiteren Rollen.',
    recommendedModel: 'granite4.2:8b',
    requiresPassedBaseTest: false,
  },
  {
    id: 'coding',
    label: 'Coding Agent',
    description: 'Code-Assistenz auf dem eigenen Gerät, ohne Quellcode an eine Cloud zu senden.',
    recommendedModel: 'qwen3.8:27b',
    requiresPassedBaseTest: false,
  },
  {
    id: 'vision',
    label: 'Vision / Dokumente',
    description: 'Liest Dokumente und Bilder lokal aus — Verträge, Scans, Formulare.',
    recommendedModel: 'glm-5.3-flash',
    requiresPassedBaseTest: false,
  },
  {
    id: 'persistent',
    label: 'Dauer-Agent',
    description: 'Lokaler Hintergrund-Agent. Erst nach bestandenem Governance-Basistest wählbar.',
    recommendedModel: 'muse-glimmer',
    requiresPassedBaseTest: true,
  },
];

export function getRole(id: LocalAiRoleId): LocalAiRole {
  const role = LOCAL_AI_ROLES.find((r) => r.id === id);
  if (!role) throw new Error(`Unbekannte Rolle: ${id}`);
  return role;
}

/** Fail-closed: nur ein vollständig bestandener Test schaltet gesperrte Rollen frei. */
export function isRoleUnlocked(role: LocalAiRole, baseTest: GovernanceTestSummary | null): boolean {
  if (!role.requiresPassedBaseTest) return true;
  return baseTest?.overall === 'success';
}

/**
 * Ollama-Cloud-Modelle erscheinen in `/api/tags` wie lokale Modelle, leiten
 * die Anfrage aber an Ollamas Cloud weiter (z. B. `glm-4.6:cloud`,
 * `gpt-oss:120b-cloud`). Für eine lokale Runtime sind sie nie zulässig:
 * Prompts und Dokumente würden das Gerät verlassen. Erkannt wird allein am
 * Namen — fail-closed, lieber ein lokales Modell zu viel sperren als ein
 * Cloud-Modell durchlassen.
 */
export function isCloudModel(model: string): boolean {
  const name = model.trim().toLowerCase();
  if (!name) return false;
  const colon = name.lastIndexOf(':');
  const base = colon === -1 ? name : name.slice(0, colon);
  const tag = colon === -1 ? '' : name.slice(colon + 1);
  return tag === 'cloud' || tag.endsWith('-cloud') || base.endsWith('-cloud');
}

/**
 * Ollama-Tags enthalten oft `:latest`. Ein Modell gilt als installiert, wenn
 * der Name exakt oder als `<name>:latest` vorkommt.
 */
export function isModelInstalled(model: string, installed: readonly string[]): boolean {
  const wanted = model.trim();
  if (!wanted) return false;
  return installed.some((m) => m === wanted || m === `${wanted}:latest`);
}
