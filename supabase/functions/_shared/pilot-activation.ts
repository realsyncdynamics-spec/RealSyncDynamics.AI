// Orchestrierung der Pilot-Aktivierung — frei von HTTP, Deno und Supabase.
//
// `pilot-activate/index.ts` ist nur noch die HTTP-Schale: Auth prüfen, Body
// lesen, `runPilotActivation` aufrufen, Ergebnis in eine Response übersetzen.
// Die eigentliche Reihenfolge, die Idempotenz und die Fehlercodes stehen hier
// und sind damit unter Vitest direkt testbar — statt in einem Modul, das wegen
// `Deno.serve` auf Modulebene gar nicht importierbar wäre.
//
// Der Datenzugriff läuft über den Port `PilotStore`. Produktiv implementiert
// ihn der Service-Role-Client, im Test ein In-Memory-Store. Dadurch prüfen die
// Tests die echte Ablauflogik und nicht eine Nachbildung davon.

import { normalizeDomain } from './domain.ts';
import { resolvePilotAction, isAuditExpired, PILOT_PLAN_KEY, type SubscriptionRow } from './pilot.ts';

export interface AuditRecord {
  id: string;
  domain: string;
  created_at: string;
  user_id: string | null;
  tenant_id: string | null;
  claimed_at: string | null;
}

export interface PilotAuditEvent {
  tenant_id: string;
  action:
    | 'pilot_activation_started'
    | 'pilot_activation_completed'
    | 'pilot_activation_failed'
    | 'audit_claimed'
    | 'domain_activated';
  target_type: string;
  target_id: string | null;
  payload: Record<string, unknown>;
}

/** Datenzugriffs-Port. Jede Methode wirft bei technischem Fehler. */
export interface PilotStore {
  loadAudit(auditId: string): Promise<AuditRecord | null>;
  resolveTenant(userId: string): Promise<string | null>;
  isMember(userId: string, tenantId: string): Promise<boolean>;
  /** true, wenn GENAU DIESER Aufruf den Claim gewonnen hat. */
  claimAudit(auditId: string, userId: string, tenantId: string, claimedAt: string): Promise<boolean>;
  /** Aktueller Eigentümer, nachdem der Claim keine Zeile getroffen hat. */
  readAuditOwner(auditId: string): Promise<{ tenant_id: string | null; user_id: string | null } | null>;
  upsertWebsite(tenantId: string, domain: string, auditId: string): Promise<void>;
  loadSubscription(tenantId: string): Promise<SubscriptionRow | null>;
  createTrial(tenantId: string, planKey: string, preserveTrialWindow: boolean): Promise<void>;
  enrollMonitoring(tenantId: string, url: string, name: string): Promise<void>;
  recordConsent(userId: string, auditId: string): Promise<void>;
  logEvent(event: PilotAuditEvent): Promise<void>;
}

export interface PilotActivationInput {
  auditId: string;
  domain: string;
  analyticsConsent: boolean;
}

export interface PilotActor {
  userId: string;
  email: string | null;
}

export type PilotErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_DOMAIN'
  | 'AUDIT_NOT_FOUND'
  | 'AUDIT_EXPIRED'
  | 'AUDIT_DOMAIN_MISMATCH'
  | 'AUDIT_ALREADY_CLAIMED'
  | 'TENANT_NOT_FOUND'
  | 'TENANT_ACCESS_DENIED'
  | 'SUBSCRIPTION_CREATION_FAILED'
  | 'DOMAIN_REGISTRATION_FAILED'
  | 'PILOT_ACTIVATION_FAILED';

export interface PilotSuccess {
  ok: true;
  tenantId: string;
  auditId: string;
  domain: string;
  idempotentReplay: boolean;
  monitoringEnrolled: boolean;
  subscription: SubscriptionRow | null;
  subscriptionAction: ReturnType<typeof resolvePilotAction>;
}

export interface PilotFailure {
  ok: false;
  status: number;
  code: PilotErrorCode;
  message: string;
}

export type PilotResult = PilotSuccess | PilotFailure;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(status: number, code: PilotErrorCode, message: string): PilotFailure {
  return { ok: false, status, code, message };
}

/**
 * Führt die Pilot-Aktivierung aus.
 *
 * Reihenfolge ist sicherheitsrelevant: Der atomare Audit-Claim steht VOR allen
 * irreversiblen Nebenwirkungen. Verliert dieser Aufruf das Rennen gegen einen
 * anderen Tenant, entstehen weder Subscription noch Domain noch
 * Monitoring-Eintrag — es bleibt kein verwaister Pilot zurück.
 *
 * @param requestId Korrelations-ID für den Prüfpfad (kein Geheimnis, kein Input).
 * @param now       Injizierbar, damit der Verfall deterministisch testbar ist.
 */
export async function runPilotActivation(
  store: PilotStore,
  actor: PilotActor,
  input: PilotActivationInput,
  requestId: string,
  now: number = Date.now(),
): Promise<PilotResult> {
  // ── Eingabe validieren ─────────────────────────────────────────────────
  const auditId = (input.auditId ?? '').trim();
  if (!UUID_RE.test(auditId)) {
    return fail(400, 'INVALID_INPUT', 'audit_id must be a uuid');
  }

  const requestedDomain = normalizeDomain(input.domain);
  if (!requestedDomain) {
    return fail(400, 'INVALID_DOMAIN', 'domain is not a valid hostname');
  }

  // ── Audit laden ────────────────────────────────────────────────────────
  const auditRow = await store.loadAudit(auditId);
  if (!auditRow) return fail(404, 'AUDIT_NOT_FOUND', 'audit not found');

  // Bereits beanspruchte Audits sind vom Verfall ausgenommen — sonst würde ein
  // legitimer Replay nach 14 Tagen plötzlich AUDIT_EXPIRED liefern.
  if (!auditRow.claimed_at && isAuditExpired(auditRow.created_at, now)) {
    return fail(410, 'AUDIT_EXPIRED', 'audit is older than 14 days and can no longer be claimed');
  }

  // `gdpr-audit` speichert den Hostnamen inklusive `www.` — beide Seiten werden
  // identisch normalisiert, sonst scheitert ein völlig gültiger Claim.
  const auditDomain = normalizeDomain(auditRow.domain);
  if (!auditDomain || auditDomain !== requestedDomain) {
    return fail(400, 'AUDIT_DOMAIN_MISMATCH', 'domain does not match the audit');
  }

  // ── Tenant auflösen und Mitgliedschaft prüfen ──────────────────────────
  const tenantId = await store.resolveTenant(actor.userId);
  if (!tenantId) return fail(404, 'TENANT_NOT_FOUND', 'no workspace found for this account');
  if (!(await store.isMember(actor.userId, tenantId))) {
    return fail(403, 'TENANT_ACCESS_DENIED', 'no access to this workspace');
  }

  const logFailure = async (code: PilotErrorCode) => {
    await store.logEvent({
      tenant_id: tenantId,
      action: 'pilot_activation_failed',
      target_type: 'gdpr_audit',
      target_id: auditId,
      payload: { request_id: requestId, code, domain: requestedDomain },
    });
  };

  await store.logEvent({
    tenant_id: tenantId,
    action: 'pilot_activation_started',
    target_type: 'gdpr_audit',
    target_id: auditId,
    payload: { request_id: requestId, domain: requestedDomain },
  });

  // ── Atomarer Claim ─────────────────────────────────────────────────────
  const claimedAt = new Date(now).toISOString();
  const won = await store.claimAudit(auditId, actor.userId, tenantId, claimedAt);

  let idempotentReplay = false;
  if (!won) {
    const owner = await store.readAuditOwner(auditId);
    if (owner?.tenant_id === tenantId) {
      // Derselbe Tenant — legitimer Replay, der Ablauf läuft idempotent weiter.
      idempotentReplay = true;
    } else {
      await logFailure('AUDIT_ALREADY_CLAIMED');
      return fail(409, 'AUDIT_ALREADY_CLAIMED', 'this audit already belongs to another workspace');
    }
  } else {
    await store.logEvent({
      tenant_id: tenantId,
      action: 'audit_claimed',
      target_type: 'gdpr_audit',
      target_id: auditId,
      payload: { request_id: requestId, domain: requestedDomain, claimed_at: claimedAt },
    });
  }

  // ── Domain in der kanonischen Registry ─────────────────────────────────
  // `websites` hat unique(tenant_id, domain) — der Upsert ist damit atomar
  // idempotent, ohne dass eine neue Constraint nötig wäre.
  try {
    await store.upsertWebsite(tenantId, requestedDomain, auditId);
  } catch {
    await logFailure('DOMAIN_REGISTRATION_FAILED');
    return fail(500, 'DOMAIN_REGISTRATION_FAILED', 'could not register domain');
  }

  // ── Pilot-Subscription ─────────────────────────────────────────────────
  const existing = await store.loadSubscription(tenantId);
  const action = resolvePilotAction(existing);

  if (action === 'create' || action === 'upgrade') {
    try {
      // Bei `upgrade` existiert womöglich schon ein Trial-Fenster. Es darf
      // weder zurückgesetzt noch verlängert werden.
      await store.createTrial(tenantId, PILOT_PLAN_KEY, action === 'upgrade');
    } catch {
      await logFailure('SUBSCRIPTION_CREATION_FAILED');
      return fail(502, 'SUBSCRIPTION_CREATION_FAILED', 'could not start the pilot');
    }
  }

  const subscription = await store.loadSubscription(tenantId);

  // ── Monitoring-Enrollment ──────────────────────────────────────────────
  // Die Domain ist registriert und der Pilot läuft. Ein fehlgeschlagenes
  // Enrollment ist ein Betriebsfehler, kein Grund die Aktivierung
  // zurückzuweisen — es wird gemeldet, nicht verschluckt.
  let monitoringEnrolled = true;
  try {
    await store.enrollMonitoring(tenantId, requestedDomain, requestedDomain);
    await store.logEvent({
      tenant_id: tenantId,
      action: 'domain_activated',
      target_type: 'website',
      target_id: null,
      payload: { request_id: requestId, domain: requestedDomain },
    });
  } catch {
    monitoringEnrolled = false;
  }

  // ── Einwilligung ───────────────────────────────────────────────────────
  // Nur bei ausdrücklichem `true`; diese Funktion ist die einzige Stelle, die
  // den Consent für den Pilot-Pfad schreibt.
  if (input.analyticsConsent) {
    try {
      await store.recordConsent(actor.userId, auditId);
    } catch {
      // Fehlender Consent-Eintrag darf die Aktivierung nicht kippen.
    }
  }

  await store.logEvent({
    tenant_id: tenantId,
    action: 'pilot_activation_completed',
    target_type: 'gdpr_audit',
    target_id: auditId,
    payload: {
      request_id: requestId,
      domain: requestedDomain,
      subscription_action: action,
      idempotent_replay: idempotentReplay,
      status: 'success',
    },
  });

  return {
    ok: true,
    tenantId,
    auditId,
    domain: requestedDomain,
    idempotentReplay,
    monitoringEnrolled,
    subscription,
    subscriptionAction: action,
  };
}
