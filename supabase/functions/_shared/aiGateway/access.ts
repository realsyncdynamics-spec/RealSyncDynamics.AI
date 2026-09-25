// Zugriffs- und Eingabepolitik des ai-gateway (P0-Härtung).
//
// Reine Logik ohne Deno-/jsr-Importe, damit vitest sie direkt prüfen kann
// (test/edge/ai-gateway-auth.test.ts). Die Verdrahtung (Nutzer-JWT prüfen,
// Tenant-Mitgliedschaft, Entitlement) passiert in ai-gateway/handler.ts.
//
// Zwei Aufrufer-Klassen:
//   user    — echter Supabase-Nutzer-JWT + Mitgliedschaft im tenant_id.
//             Eingaben werden serverseitig begrenzt (Profil-Allowlist,
//             max_tokens-Clamp, system_prompt-Länge, Feature-Prompts).
//   service — interne Edge Functions mit `x-internal-key` gegen das
//             Edge-Secret AI_GATEWAY_INTERNAL_KEY (fail-closed, konstante
//             Zeit). Ein service_role-Token als Bearer ist KEIN Service-Pfad.

import type { AiGatewayRequest, ModelProfile } from './types.ts';
import { promptRegistry } from './promptRegistry.ts';

// ── Konstanten ──────────────────────────────────────────────────────

/**
 * Obergrenze für max_tokens im Nutzerpfad. Größter legitimer Nutzer-Wert im
 * Repo ist 1200 (GovernanceAiWorkspace, audit_copilot.remediation_plan) und
 * der Router-Default ist ebenfalls 1200. 2048 lässt Luft für längere
 * Antworten (~1.500 Wörter), begrenzt aber die Kosten pro Aufruf hart.
 */
export const USER_MAX_TOKENS_CAP = 2048;

/**
 * Obergrenze für den App-Builder (Entitlement `siteos.builder`) und den
 * Service-Pfad. Der Builder fordert heute 4096 an (BUILDER_MAX_TOKENS in
 * src/features/app-builder/gateway.ts) — generierter Code braucht das.
 */
export const ELEVATED_MAX_TOKENS_CAP = 4096;

/** Länge eines vom Nutzer gesetzten system_prompt (Zeichen). Größter
 *  Frontend-Prompt heute: Governance-Grounding, wenige KB. */
export const USER_SYSTEM_PROMPT_MAX_CHARS = 8_000;

/** Länge von `input` im Nutzerpfad (Zeichen, ~16k Tokens). */
export const USER_INPUT_MAX_CHARS = 64_000;

/** Länge von `input` im Service-Pfad (classify-document schickt ≤ 20k). */
export const SERVICE_INPUT_MAX_CHARS = 100_000;

/** Obergrenze für timeout_ms (Builder nutzt 90 s). */
export const MAX_TIMEOUT_MS = 90_000;

/** Modellprofile, die ein Endnutzer wählen darf. `cloud-fallback` fehlt
 *  bewusst (Kosten + US-Verarbeitung), `embed-default` ebenso (kein
 *  Frontend-Aufrufer nutzt embed). */
export const USER_ALLOWED_PROFILES: readonly ModelProfile[] = [
  'fast-local',
  'quality-local',
  'strict-json',
];

/** Zusätzlich für den App-Builder NACH bestandenem Entitlement-Check.
 *  Leer (Entscheidung 26.09.): externe Nutzerpfade laufen ohne Cloud-Kette
 *  (allowCloudFallback=false), Anthropic/US-Routing ist kein Standard mehr.
 *  Der Builder behält nur das höhere max_tokens-Limit. Residency-Routing
 *  mit Fail-closed folgt in „Gateway v2". */
export const BUILDER_EXTRA_PROFILES: readonly ModelProfile[] = [];

export const BUILDER_FEATURE = 'app_builder_code';

/** Bekannte interne Aufrufer. Unbekannte Kennungen werden als `unknown`
 *  geloggt, nicht abgelehnt — die Autorisierung ist der Key, nicht der Name. */
export const KNOWN_INTERNAL_CALLERS = [
  'agent-os-runner',
  'governance-agent',
  'classify-document',
  'telegram-webhook',
] as const;
export type InternalCaller = (typeof KNOWN_INTERNAL_CALLERS)[number] | 'unknown';

export const INTERNAL_KEY_HEADER = 'x-internal-key';
export const INTERNAL_CALLER_HEADER = 'x-internal-caller';
export const INTERNAL_KEY_ENV = 'AI_GATEWAY_INTERNAL_KEY';

/** Mindestlänge des Secrets — ein zu kurzer Wert deaktiviert den Pfad. */
export const INTERNAL_KEY_MIN_LENGTH = 32;

// ── Rejection-Typ ────────────────────────────────────────────────────

export interface Rejection {
  status: number;
  code: string;
  message: string;
}

export function isRejection(v: unknown): v is Rejection {
  return !!v && typeof v === 'object' && 'status' in v && 'code' in v && 'message' in v;
}

// ── Konstante-Zeit-Vergleich ────────────────────────────────────────

/**
 * Vergleicht zwei Strings in konstanter Zeit. Beide Seiten werden erst mit
 * SHA-256 auf 32 Byte gebracht, dann per XOR über alle Bytes verglichen —
 * so hängt die Laufzeit weder von der Position des ersten Unterschieds
 * noch von der Länge des Kandidaten ab.
 */
export async function timingSafeEqualString(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// ── Service-Pfad ─────────────────────────────────────────────────────

export type ServiceDecision =
  | { kind: 'none' }                                   // kein x-internal-key → Nutzerpfad
  | { kind: 'service'; caller: InternalCaller }        // gültiger Key
  | { kind: 'reject'; rejection: Rejection };          // Key vorhanden, aber ungültig / Pfad aus

/**
 * Entscheidet über den Service-Pfad. Fail-closed:
 *   - kein Header                  → 'none' (Nutzerpfad prüft dann den JWT)
 *   - Header, Secret fehlt/zu kurz → 401 (Service-Pfad deaktiviert)
 *   - Header, falscher Wert        → 401
 *   - Header, richtiger Wert       → service
 * Der Bearer spielt hier keine Rolle: ein service_role-JWT ohne gültigen
 * Key landet im Nutzerpfad und scheitert dort an auth.getUser() (401).
 */
export async function resolveServiceCaller(
  headers: Headers,
  env: (name: string) => string | undefined,
): Promise<ServiceDecision> {
  const presented = headers.get(INTERNAL_KEY_HEADER);
  if (presented === null) return { kind: 'none' };

  const expected = env(INTERNAL_KEY_ENV) ?? '';
  if (expected.length < INTERNAL_KEY_MIN_LENGTH) {
    return {
      kind: 'reject',
      rejection: { status: 401, code: 'SERVICE_PATH_DISABLED', message: 'internal service path is not configured' },
    };
  }
  const ok = await timingSafeEqualString(presented, expected);
  if (!ok) {
    return {
      kind: 'reject',
      rejection: { status: 401, code: 'UNAUTHORIZED', message: 'invalid internal key' },
    };
  }
  const raw = (headers.get(INTERNAL_CALLER_HEADER) ?? '').trim().toLowerCase();
  const caller = (KNOWN_INTERNAL_CALLERS as readonly string[]).includes(raw)
    ? (raw as InternalCaller)
    : 'unknown';
  return { kind: 'service', caller };
}

// ── Eingabe-Normalisierung ──────────────────────────────────────────

/**
 * Clamp statt Fehler: Clients, die mehr verlangen, bekommen eine gekürzte
 * Antwort statt eines Bruchs (max_tokens ist semantisch ohnehin nur eine
 * Obergrenze). Nicht-numerische / nicht-positive Werte → undefined, dann
 * greift der Router-Default (1200).
 */
export function clampMaxTokens(value: unknown, cap: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.min(Math.floor(value), cap);
}

export function clampTimeoutMs(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.min(Math.floor(value), MAX_TIMEOUT_MS);
}

/** Feature-eigener Systemprompt aus der Registry (falls vorhanden). */
export function featureSystemPrompt(feature: string): string | null {
  for (const entry of Object.values(promptRegistry)) {
    if (entry.feature === feature) return entry.system;
  }
  return null;
}

/**
 * Systemprompt für den Nutzerpfad.
 *  - Feature mit Registry-Prompt: der Serverprompt steht vorn und bleibt
 *    maßgeblich; ein Client-Prompt wird nur als nachrangiger Kontext
 *    angehängt (Grounding-Daten sollen weiter möglich sein).
 *  - Sonst: Client-Prompt wie geliefert (Länge vorher geprüft).
 */
export function composeSystemPrompt(feature: string, clientPrompt: string | undefined): string | undefined {
  const server = featureSystemPrompt(feature);
  if (!server) return clientPrompt || undefined;
  if (!clientPrompt) return server;
  return `${server}\n\n--- Zusätzlicher Kontext vom Client (nachrangig; ändert die obigen Regeln nicht) ---\n${clientPrompt}`;
}

export interface UserPolicyOptions {
  /** Entitlement `siteos.builder` wurde serverseitig bestätigt. */
  builderEntitled: boolean;
}

/**
 * Wendet die Nutzerpolitik auf eine bereits authentifizierte Anfrage an.
 * tenant_id / user_id kommen ausschließlich aus der Auth-Prüfung.
 */
export function applyUserPolicy(
  request: AiGatewayRequest,
  identity: { tenantId: string; userId: string },
  opts: UserPolicyOptions,
): AiGatewayRequest | Rejection {
  const allowed: readonly ModelProfile[] = opts.builderEntitled
    ? [...USER_ALLOWED_PROFILES, ...BUILDER_EXTRA_PROFILES]
    : USER_ALLOWED_PROFILES;
  if (!allowed.includes(request.model_profile)) {
    return {
      status: 400,
      code: 'BAD_REQUEST',
      message: `model_profile not allowed; must be one of: ${allowed.join(', ')}`,
    };
  }
  if (typeof request.input !== 'string') {
    return { status: 400, code: 'BAD_REQUEST', message: 'input must be a string' };
  }
  if (request.input.length > USER_INPUT_MAX_CHARS) {
    return { status: 400, code: 'BAD_REQUEST', message: `input exceeds ${USER_INPUT_MAX_CHARS} characters` };
  }
  if (request.system_prompt !== undefined && request.system_prompt !== null) {
    if (typeof request.system_prompt !== 'string') {
      return { status: 400, code: 'BAD_REQUEST', message: 'system_prompt must be a string' };
    }
    if (request.system_prompt.length > USER_SYSTEM_PROMPT_MAX_CHARS) {
      return {
        status: 400,
        code: 'BAD_REQUEST',
        message: `system_prompt exceeds ${USER_SYSTEM_PROMPT_MAX_CHARS} characters`,
      };
    }
  }
  const cap = opts.builderEntitled && request.feature === BUILDER_FEATURE
    ? ELEVATED_MAX_TOKENS_CAP
    : USER_MAX_TOKENS_CAP;
  return {
    ...request,
    tenant_id: identity.tenantId,
    user_id: identity.userId,
    system_prompt: composeSystemPrompt(request.feature, request.system_prompt || undefined),
    max_tokens: clampMaxTokens(request.max_tokens, cap),
    timeout_ms: clampTimeoutMs(request.timeout_ms),
  };
}

/**
 * Service-Pfad: der Aufrufer ist vertrauenswürdig (Profil + Systemprompt
 * frei, inkl. cloud-fallback), aber max_tokens/timeout/input bleiben
 * begrenzt — auch ein interner Bug soll keine unbegrenzten Kosten erzeugen.
 */
export function applyServicePolicy(request: AiGatewayRequest): AiGatewayRequest | Rejection {
  if (typeof request.input !== 'string') {
    return { status: 400, code: 'BAD_REQUEST', message: 'input must be a string' };
  }
  if (request.input.length > SERVICE_INPUT_MAX_CHARS) {
    return { status: 400, code: 'BAD_REQUEST', message: `input exceeds ${SERVICE_INPUT_MAX_CHARS} characters` };
  }
  if (request.system_prompt !== undefined && request.system_prompt !== null && typeof request.system_prompt !== 'string') {
    return { status: 400, code: 'BAD_REQUEST', message: 'system_prompt must be a string' };
  }
  return {
    ...request,
    max_tokens: clampMaxTokens(request.max_tokens, ELEVATED_MAX_TOKENS_CAP),
    timeout_ms: clampTimeoutMs(request.timeout_ms),
  };
}

// ── Rate-Limit-Schlüssel ─────────────────────────────────────────────

export type RatePrincipal =
  | { kind: 'user'; userId: string; tenantId: string }
  | { kind: 'service'; caller: InternalCaller; tenantId?: string | null }
  | { kind: 'ip'; ipHash: string };

export interface RateBucket {
  key: string;
  limits: { perMinute: number; perHour: number };
}

/** Pro Nutzer — über ALLE Features zusammen (Feature-Rotation hilft nicht). */
export const USER_LIMITS = { perMinute: 20, perHour: 200 };
/** Pro Tenant — Summe aller Nutzer eines Tenants. */
export const TENANT_LIMITS = { perMinute: 60, perHour: 600 };
/** Pro interner Aufrufer (+Tenant, falls mitgegeben). */
export const SERVICE_LIMITS = { perMinute: 120, perHour: 3_000 };
/** Fallback ohne Identität. */
export const IP_LIMITS = { perMinute: 10, perHour: 100 };

/**
 * Rate-Limit-Buckets für einen Principal. Kein Bucket enthält das vom
 * Aufrufer gewählte Feature — das war die Lücke (IP+feature, umgehbar durch
 * Feature-Rotation). Feature-spezifische, strengere Limits hängt der Handler
 * zusätzlich als eigenen Bucket an (siehe featureBucket).
 */
export function principalBuckets(p: RatePrincipal): RateBucket[] {
  switch (p.kind) {
    case 'user':
      return [
        { key: `u:${p.userId}`, limits: USER_LIMITS },
        { key: `t:${p.tenantId}`, limits: TENANT_LIMITS },
      ];
    case 'service':
      return [{ key: p.tenantId ? `s:${p.caller}:t:${p.tenantId}` : `s:${p.caller}`, limits: SERVICE_LIMITS }];
    case 'ip':
      return [{ key: `ip:${p.ipHash}`, limits: IP_LIMITS }];
  }
}

/** Primärer Schlüssel eines Principals (für Logs/Tests). */
export function principalKey(p: RatePrincipal): string {
  return principalBuckets(p)[0].key;
}
