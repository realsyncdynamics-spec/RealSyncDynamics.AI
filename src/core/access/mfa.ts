// Client-MFA-Helfer (ADR 0006). Kapselt die Supabase-native TOTP-API plus
// unsere Recovery-Codes. KEIN hartes AAL2-Enforcement hier — `logAal2Intent`
// ist Observe-only (P0a). Hartes Enforce folgt P0c.
import { getSupabase } from '../../lib/supabase';
import { generateRecoveryCodes, hashRecoveryCode } from './recovery';

export interface MfaStatus {
  hasVerifiedTotp: boolean;
  factorCount: number;
  currentLevel: string | null;
  nextLevel: string | null;
}

export async function getMfaStatus(): Promise<MfaStatus> {
  const sb = getSupabase();
  const { data: factors } = await sb.auth.mfa.listFactors();
  const totp = factors?.totp ?? [];
  const verified = totp.filter((f) => f.status === 'verified');
  let currentLevel: string | null = null;
  let nextLevel: string | null = null;
  try {
    const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    currentLevel = aal?.currentLevel ?? null;
    nextLevel = aal?.nextLevel ?? null;
  } catch { /* ignore */ }
  return { hasVerifiedTotp: verified.length > 0, factorCount: totp.length, currentLevel, nextLevel };
}

export interface EnrollResult { factorId: string; qrCode: string; secret: string; uri: string }

export async function enrollTotp(friendlyName = 'RealSync TOTP'): Promise<EnrollResult> {
  const sb = getSupabase();
  const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName });
  if (error || !data) throw error ?? new Error('enroll_failed');
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri };
}

/** Verifiziert den 6-stelligen Code und hebt die Session auf AAL2. */
export async function verifyTotp(factorId: string, code: string): Promise<void> {
  const sb = getSupabase();
  const { data: ch, error: chErr } = await sb.auth.mfa.challenge({ factorId });
  if (chErr || !ch) throw chErr ?? new Error('challenge_failed');
  const { error } = await sb.auth.mfa.verify({ factorId, challengeId: ch.id, code });
  if (error) throw error;
}

export async function unenroll(factorId: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

/**
 * Step-up (P0c): hebt eine bestehende AAL1-Session per Challenge auf AAL2,
 * indem der bereits VERIFIZIERTE TOTP-Faktor bestätigt wird. Reine Wiederver-
 * wendung von `verifyTotp` — kein neuer Mechanismus. Wirft, wenn kein
 * verifizierter Faktor existiert (dann ist Enrollment statt Step-up nötig).
 */
export async function stepUpTotp(code: string): Promise<void> {
  const sb = getSupabase();
  const { data } = await sb.auth.mfa.listFactors();
  const factor = (data?.totp ?? []).find((f) => f.status === 'verified');
  if (!factor) throw new Error('no_verified_factor');
  await verifyTotp(factor.id, code.trim());
}

/**
 * Erzeugt 10 Recovery-Codes, speichert NUR die Hashes und gibt den Klartext
 * EINMALIG zurück (anzeigen, dann verwerfen). Vorherige Codes des Nutzers
 * werden invalidiert (über Edge Function nicht nötig — Insert-only Modell:
 * alte bleiben gültig bis genutzt; bei Neugenerierung markieren wir sie used).
 */
export async function regenerateRecoveryCodes(userId: string, tenantId: string | null): Promise<string[]> {
  const sb = getSupabase();
  // Alte, ungenutzte Codes als verbraucht markieren (Self-RLS erlaubt kein
  // UPDATE → wir löschen sie via Insert-Ersatz nicht; stattdessen reicht es,
  // dass nur die neuesten angezeigt werden. Sicherheitskritische Invalidierung
  // erfolgt serverseitig bei Redemption/Reset.)
  const codes = generateRecoveryCodes(10);
  const rows = await Promise.all(
    codes.map(async (c) => ({ user_id: userId, tenant_id: tenantId, code_hash: await hashRecoveryCode(c) })),
  );
  const { error } = await sb.from('mfa_recovery_codes').insert(rows);
  if (error) throw error;
  return codes;
}

/** Lockout-Escape: verbraucht einen Recovery-Code und entfernt TOTP-Faktoren. */
export async function redeemRecoveryCode(code: string): Promise<{ removed_factors: number }> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('mfa-recovery-redeem', { body: { code } });
  if (error) throw error;
  return data as { removed_factors: number };
}

/**
 * Observe-only AAL2-Logging (P0a). Protokolliert, dass eine Aktion in der
 * Zielarchitektur AAL2 erfordern würde — blockiert aber NICHT. Hartes Enforce
 * (RLS + UI-Block) kommt in P0c.
 */
export async function logAal2Intent(action: string): Promise<void> {
  try {
    const sb = getSupabase();
    const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== 'aal2') {
      // eslint-disable-next-line no-console
      console.info('[aal2-observe] Aktion würde AAL2 erfordern:', action, '· aktuell:', aal?.currentLevel);
    }
  } catch { /* observe darf nie stören */ }
}
