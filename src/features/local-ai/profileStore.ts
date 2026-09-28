/**
 * Lokales Runtime-Profil — Speicherung und optionale Tenant-Meldung.
 *
 * 1. Gerätespeicher (localStorage): das Profil gilt nur für dieses Gerät.
 *    Der Schlüssel wird aus dem serverseitig verifizierten Mandanten gebildet;
 *    gespeicherte Daten tragen keine tenant_id und sind nie Autorität.
 * 2. Tenant-Meldung (Edge Function `local-ai-runtime`): noch nicht
 *    ausgerollt. Die Abstraktion ist fail-closed und liefert klare
 *    Fehlercodes; die Edge Function leitet den Mandanten aus dem JWT ab —
 *    der Client sendet bewusst keine tenant_id.
 */
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { normalizeRuntimeUrl } from './runtimeClient';
import { LOCAL_AI_ROLES } from './roles';
import type { GovernanceTestSummary, LocalAiRoleId, LocalAiRuntimeProfile } from './types';

const KEY_PREFIX = 'realsync.localAi.profile.v1';

export type ProfileErrorCode =
  | 'NO_VERIFIED_TENANT'
  | 'TEST_NOT_PASSED'
  | 'HEALTHCHECK_MISSING'
  | 'INVALID_PROFILE'
  | 'STORAGE_UNAVAILABLE';

export class ProfileError extends Error {
  constructor(readonly code: ProfileErrorCode, message: string) {
    super(message);
    this.name = 'ProfileError';
  }
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): KeyValueStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** `verifiedTenantId` muss aus dem TenantProvider stammen (Mitgliedschaft serverseitig geprüft). */
export function profileKey(verifiedTenantId: string | null): string {
  if (!verifiedTenantId) throw new ProfileError('NO_VERIFIED_TENANT', 'Kein verifizierter Mandant aktiv.');
  return `${KEY_PREFIX}:${verifiedTenantId}`;
}

const ROLE_IDS = new Set<LocalAiRoleId>(LOCAL_AI_ROLES.map((r) => r.id));

function parseSummary(raw: unknown): GovernanceTestSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (!['success', 'warning', 'failed'].includes(s.overall as string)) return null;
  if (typeof s.model !== 'string' || typeof s.ranAt !== 'string' || !Array.isArray(s.checks)) return null;
  return {
    overall: s.overall as GovernanceTestSummary['overall'],
    model: s.model,
    ranAt: s.ranAt,
    checks: s.checks
      .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
      .map((c) => ({ id: c.id, status: c.status }) as GovernanceTestSummary['checks'][number]),
  };
}

/**
 * Defensives Parsen: unbekannte Felder (auch eine eingeschleuste tenant_id)
 * werden verworfen. `enabled` bleibt nur wahr, wenn der gespeicherte Test
 * tatsächlich bestanden ist.
 */
export function parseProfile(raw: unknown): LocalAiRuntimeProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (p.schema_version !== 1) return null;
  if (typeof p.runtime_url !== 'string' || !normalizeRuntimeUrl(p.runtime_url).ok) return null;
  if (typeof p.model !== 'string' || !p.model.trim()) return null;
  if (typeof p.role !== 'string' || !ROLE_IDS.has(p.role as LocalAiRoleId)) return null;
  const testResult = parseSummary(p.test_result);
  return {
    schema_version: 1,
    scope: 'device_local',
    profile_name: typeof p.profile_name === 'string' && p.profile_name.trim() ? p.profile_name : 'Local Governance Runtime',
    runtime_url: p.runtime_url,
    model: p.model,
    role: p.role as LocalAiRoleId,
    last_healthcheck: typeof p.last_healthcheck === 'string' ? p.last_healthcheck : null,
    test_result: testResult,
    enabled: p.enabled === true && testResult?.overall === 'success',
  };
}

export function loadProfile(verifiedTenantId: string | null, storage = defaultStorage()): LocalAiRuntimeProfile | null {
  if (!storage || !verifiedTenantId) return null;
  try {
    const raw = storage.getItem(profileKey(verifiedTenantId));
    return raw ? parseProfile(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Gate für „Lokale KI aktivieren": fail-closed ohne bestandenen Test und Healthcheck. */
export function assertActivatable(profile: LocalAiRuntimeProfile): void {
  if (!profile.last_healthcheck) {
    throw new ProfileError('HEALTHCHECK_MISSING', 'Ohne erfolgreichen Verbindungstest kann nicht aktiviert werden.');
  }
  if (profile.test_result?.overall !== 'success' || profile.test_result.model !== profile.model) {
    throw new ProfileError('TEST_NOT_PASSED', 'Der Governance-Test für dieses Modell ist nicht bestanden.');
  }
}

export function saveProfile(
  verifiedTenantId: string | null,
  profile: LocalAiRuntimeProfile,
  storage = defaultStorage(),
): LocalAiRuntimeProfile {
  const key = profileKey(verifiedTenantId);
  const parsed = parseProfile(profile);
  if (!parsed) throw new ProfileError('INVALID_PROFILE', 'Das Profil ist unvollständig oder ungültig.');
  if (parsed.enabled) assertActivatable(parsed);
  if (!storage) throw new ProfileError('STORAGE_UNAVAILABLE', 'Gerätespeicher ist nicht verfügbar (privates Fenster?).');
  try {
    storage.setItem(key, JSON.stringify(parsed));
  } catch {
    throw new ProfileError('STORAGE_UNAVAILABLE', 'Gerätespeicher ist nicht verfügbar (privates Fenster?).');
  }
  return parsed;
}

export function clearProfile(verifiedTenantId: string | null, storage = defaultStorage()): void {
  if (!storage || !verifiedTenantId) return;
  try {
    storage.removeItem(profileKey(verifiedTenantId));
  } catch {
    /* nichts zu tun */
  }
}

// ── Tenant-Meldung (Edge-Abstraktion, fail-closed) ─────────────────────────

export type RegistrationErrorCode =
  | 'BACKEND_NOT_CONFIGURED'
  | 'BACKEND_NOT_DEPLOYED'
  | 'NOT_AUTHORIZED'
  | 'BACKEND_ERROR';

export type RegistrationResult =
  | { ok: true; registeredAt: string }
  | { ok: false; code: RegistrationErrorCode; message: string };

export const LOCAL_AI_EDGE_FUNCTION = 'local-ai-runtime';

type InvokeFn = (
  name: string,
  options: { body: unknown },
) => Promise<{ data: unknown; error: unknown }>;

function defaultInvoke(): InvokeFn | null {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  return (name, options) => sb.functions.invoke(name, options as { body: Record<string, unknown> });
}

/**
 * Meldet Metadaten des Profils an den Mandanten. Gesendet werden nur Rolle,
 * Modell und Testergebnis — keine Runtime-URL (LAN-Topologie bleibt lokal)
 * und keine tenant_id (die Edge Function nimmt sie aus dem JWT).
 */
export async function registerProfileWithTenant(
  profile: LocalAiRuntimeProfile,
  invoke: InvokeFn | null = defaultInvoke(),
): Promise<RegistrationResult> {
  if (!invoke) {
    return { ok: false, code: 'BACKEND_NOT_CONFIGURED', message: 'Backend ist nicht konfiguriert. Profil bleibt nur auf diesem Gerät.' };
  }
  let result: { data: unknown; error: unknown };
  try {
    result = await invoke(LOCAL_AI_EDGE_FUNCTION, {
      body: {
        action: 'register_profile',
        profile_name: profile.profile_name,
        role: profile.role,
        model: profile.model,
        test_result: profile.test_result,
        enabled: profile.enabled,
      },
    });
  } catch (err) {
    return { ok: false, code: 'BACKEND_ERROR', message: (err as Error)?.message ?? 'Netzwerkfehler' };
  }
  if (result.error) {
    const status = (result.error as { context?: { status?: number } }).context?.status;
    if (status === 404) {
      return { ok: false, code: 'BACKEND_NOT_DEPLOYED', message: 'Tenant-Registrierung ist noch nicht ausgerollt. Profil bleibt nur auf diesem Gerät.' };
    }
    if (status === 401 || status === 403) {
      return { ok: false, code: 'NOT_AUTHORIZED', message: 'Keine Berechtigung für diesen Mandanten.' };
    }
    return { ok: false, code: 'BACKEND_ERROR', message: (result.error as { message?: string }).message ?? 'Unbekannter Fehler' };
  }
  const registeredAt = (result.data as { registered_at?: unknown } | null)?.registered_at;
  if (typeof registeredAt !== 'string') {
    // Keine eindeutige Bestätigung → nicht als registriert werten.
    return { ok: false, code: 'BACKEND_ERROR', message: 'Backend hat die Registrierung nicht bestätigt.' };
  }
  return { ok: true, registeredAt };
}
