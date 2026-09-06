/**
 * Agent-PEP (P1-5) — Tool-Aufrufe gegen den Policy Decision Point.
 *
 * Verantwortung dieses Moduls: die SANITISIERUNG. Es entscheidet, welche
 * Felder eines Tool-Aufrufs den Agent-Prozess überhaupt verlassen dürfen.
 * Die Abbildung auf eine Policy-Anfrage liegt bewusst NICHT hier, sondern
 * einmalig auf der PDP-Seite (_shared/pdp/toolcall.ts).
 *
 * Prompt Injection (Selbstkritik K6): Aus `input` werden ausschließlich
 * eine Allowlist strukturierter Felder und die ARGUMENTNAMEN entnommen.
 * Argumentwerte, freier Text und Modellausgabe verlassen den Prozess
 * nie — sie können damit die Entscheidung nicht beeinflussen.
 *
 * Ausfallverhalten: Anders als beim benutzerseitigen Gateway ist der
 * Default hier FAIL CLOSED. Begründung: Ein Agent handelt autonom, ohne
 * dass jemand zusieht. Eine blockierte Agentenaktion kostet einen Lauf;
 * eine ungeprüfte kostet die Zusage des Produkts. Wer das anders will,
 * setzt AGENT_PDP_FAILURE_MODE=allow — bewusst und sichtbar.
 */

export type PdpEnforcement = 'off' | 'shadow' | 'enforce';
export type PdpFailureMode = 'allow' | 'block';

export interface PdpConfig {
  url: string | null;
  key: string | null;
  enforcement: PdpEnforcement;
  failureMode: PdpFailureMode;
  timeoutMs: number;
}

export function loadPdpConfig(env: NodeJS.ProcessEnv = process.env): PdpConfig {
  const rawMode = (env.AGENT_PDP_ENFORCEMENT ?? 'shadow').toLowerCase();
  const enforcement: PdpEnforcement =
    rawMode === 'off' || rawMode === 'enforce' ? rawMode : 'shadow';
  const rawFail = (env.AGENT_PDP_FAILURE_MODE ?? 'block').toLowerCase();
  const failureMode: PdpFailureMode = rawFail === 'allow' ? 'allow' : 'block';
  const timeoutRaw = Number.parseInt(env.AGENT_PDP_TIMEOUT_MS ?? '', 10);
  return {
    url: env.AGENT_PDP_URL?.trim() || null,
    key: env.AGENT_PDP_KEY?.trim() || null,
    enforcement,
    failureMode,
    timeoutMs: Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 3000,
  };
}

/**
 * Felder, die aus `input` übernommen werden dürfen. Alles andere wird
 * verworfen. Die Liste ist die Vertrauensgrenze — sie wächst nur mit
 * einer bewussten Entscheidung, nie „weil das Feld nützlich wäre".
 */
const ALLOWED_STRING_FIELDS = [
  'targetSystemId', 'target_system_id',
  'vendor', 'model',
  'dataClassification', 'data_classification',
] as const;

const ALLOWED_ARRAY_FIELDS = [
  'dataTypes', 'data_types',
  'signals',
] as const;

export interface SanitizedToolCall {
  agent_id: string;
  agent_principal_id?: string;
  tool: string;
  task_type?: string;
  target_system_id?: string;
  vendor?: string;
  model?: string;
  data_classification?: string;
  data_types?: string[];
  signals?: string[];
  argument_keys?: string[];
  requires_human_review?: boolean;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v.slice(0, 200) : undefined;
}

function strArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 100));
  return out.length > 0 ? out : undefined;
}

/**
 * Reduziert einen Tool-Aufruf auf das, was den Prozess verlassen darf.
 * Rein und ohne IO — der Kern der Manipulationsgrenze und deshalb
 * separat testbar.
 */
export function sanitizeToolCall(req: {
  agentId: string;
  taskType: string;
  requestedTool: string;
  input: Record<string, unknown>;
  principalId?: string;
  requiresHumanReview?: boolean;
}): SanitizedToolCall {
  const input = req.input ?? {};
  const picked: Record<string, unknown> = {};

  for (const field of ALLOWED_STRING_FIELDS) {
    const v = str(input[field]);
    if (v !== undefined) {
      // camelCase und snake_case auf denselben Zielnamen abbilden
      const target = field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
      picked[target] ??= v;
    }
  }
  for (const field of ALLOWED_ARRAY_FIELDS) {
    const v = strArray(input[field]);
    if (v !== undefined) {
      const target = field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
      picked[target] ??= v;
    }
  }

  // Nur die NAMEN der Argumente — nie deren Werte.
  const argument_keys = Object.keys(input).sort().slice(0, 50);

  return {
    agent_id: req.agentId,
    tool: req.requestedTool,
    task_type: req.taskType,
    ...(req.principalId ? { agent_principal_id: req.principalId } : {}),
    ...(picked.target_system_id ? { target_system_id: picked.target_system_id as string } : {}),
    ...(picked.vendor ? { vendor: picked.vendor as string } : {}),
    ...(picked.model ? { model: picked.model as string } : {}),
    ...(picked.data_classification ? { data_classification: picked.data_classification as string } : {}),
    ...(picked.data_types ? { data_types: picked.data_types as string[] } : {}),
    ...(picked.signals ? { signals: picked.signals as string[] } : {}),
    ...(argument_keys.length > 0 ? { argument_keys } : {}),
    ...(req.requiresHumanReview !== undefined ? { requires_human_review: req.requiresHumanReview } : {}),
  };
}

export type PdpVerdict =
  | { outcome: 'allow'; reasons: string[] }
  | { outcome: 'warn'; reasons: string[] }
  | { outcome: 'block'; reasons: string[] }
  | { outcome: 'require_approval'; reasons: string[]; gateId: string | null }
  | { outcome: 'unavailable'; reasons: string[] };

interface DecideResponse {
  ok?: boolean;
  decision?: string;
  reasons?: Array<{ text_de?: string }>;
  approval?: { gate_id?: string | null };
  error?: { message?: string };
}

/**
 * Fragt den PDP. Liefert `unavailable`, wenn er nicht antwortet — der
 * Aufrufer wendet dann das konfigurierte Ausfallverhalten an. Wirft nie.
 */
export async function askPdp(
  config: PdpConfig,
  toolCall: SanitizedToolCall,
): Promise<PdpVerdict> {
  if (!config.url || !config.key) {
    return { outcome: 'unavailable', reasons: ['PDP ist nicht konfiguriert'] };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const res = await fetch(config.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.key}`,
      },
      body: JSON.stringify({ contract: 'v1', tool_call: toolCall }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { outcome: 'unavailable', reasons: [`PDP antwortete mit HTTP ${res.status}`] };
    }
    const data = (await res.json()) as DecideResponse;
    const reasons = (data.reasons ?? [])
      .map((r) => r.text_de)
      .filter((t): t is string => typeof t === 'string' && t.length > 0);

    switch (data.decision) {
      case 'block':
        return { outcome: 'block', reasons };
      case 'require_approval':
        return { outcome: 'require_approval', reasons, gateId: data.approval?.gate_id ?? null };
      case 'warn':
        return { outcome: 'warn', reasons };
      case 'allow':
      case 'log_only':
        return { outcome: 'allow', reasons };
      default:
        return { outcome: 'unavailable', reasons: ['PDP lieferte kein bekanntes Verdikt'] };
    }
  } catch (e) {
    return {
      outcome: 'unavailable',
      reasons: [`PDP nicht erreichbar: ${(e as Error).name}`],
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Setzt ein Verdikt in eine Durchlassentscheidung um.
 * `shadow` und `off` lassen immer durch — sie ändern das Verhalten nicht,
 * sondern nur das Protokoll.
 */
export function applyVerdict(
  config: PdpConfig,
  verdict: PdpVerdict,
): { allowed: boolean; reason: string | null } {
  if (config.enforcement !== 'enforce') return { allowed: true, reason: null };

  switch (verdict.outcome) {
    case 'allow':
    case 'warn':
      return { allowed: true, reason: null };
    case 'block':
      return {
        allowed: false,
        reason: verdict.reasons[0] ?? 'Durch eine Unternehmensrichtlinie blockiert.',
      };
    case 'require_approval':
      return {
        allowed: false,
        reason: verdict.reasons[0]
          ?? 'Diese Aktion erfordert eine Freigabe gemäß Unternehmensrichtlinie.',
      };
    case 'unavailable':
      return config.failureMode === 'allow'
        ? { allowed: true, reason: null }
        : {
            allowed: false,
            reason: 'Die Governance-Prüfung ist nicht erreichbar; der Lauf wird vorsorglich angehalten.',
          };
  }
}
