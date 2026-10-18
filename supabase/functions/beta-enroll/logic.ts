// Entscheidungslogik von `beta-enroll` — bewusst ohne Deno- und Supabase-
// Importe, damit vitest sie direkt prüfen kann (test/edge/beta-enroll.test.ts).
// Liegt im Function-Verzeichnis statt in `_shared/`: eine Änderung dort schaltet
// `deploy.yml` auf `deploy_all`.

import { planByKey } from '../_shared/pricing.generated.ts';

/**
 * Ende der offenen Beta: 31.01.2027, 24:00 Uhr Berlin (exklusiv).
 *
 * Wird als `trial_end`/`trial_ends_at` gespeichert. `tenant_entitlements_resolve()`
 * zählt `trialing` nur, solange dieses Ende in der Zukunft liegt — danach
 * fällt der Mandant ohne Job und ohne Statuswechsel auf seine freie Stufe
 * zurück (20260928160000_wp2a_trial_end_expiry.sql). `current_period_end`
 * liest der Auflöser nicht; es wird nur zur Anzeige mitgeschrieben.
 */
export const BETA_ENDS_AT = '2027-01-31T23:00:00.000Z';

/** Planstufe, deren Umfang Beta-Tester erhalten (Frontend: `BETA.testPlan`). */
export const BETA_PLAN_KEY = 'growth';

/** Kennzeichen in `subscriptions.source` und `trial_audit_logs.source`. */
export const BETA_SOURCE = 'beta';

/**
 * Freie Stufen dürfen überschrieben werden. Entschieden über den Kaufmodus der
 * Pricing-SSoT, nicht über Plan-Namen (check:plan-name-gates) — die
 * Alias-Tabelle löst dabei auch den Altwert auf, den der tenants-Trigger noch
 * schreibt (20260802000000_fix_free_tier_entitlements.sql).
 */
function isFreePlanKey(planKey: string): boolean {
  return planByKey(planKey)?.purchaseMode === 'free';
}

export interface CurrentSubscription {
  status: string | null;
  plan_key: string | null;
  source?: string | null;
  stripe_subscription_id?: string | null;
  trial_end?: string | null;
  trial_ends_at?: string | null;
}

export type EnrollDecision =
  | { kind: 'enroll' }
  | { kind: 'already' }
  | { kind: 'skip'; reason: 'STRIPE_SUBSCRIPTION' | 'ACTIVE_SUBSCRIPTION' | 'NEW_ENROLLMENT_CLOSED' };

/**
 * Darf die Beta über das bestehende Abo gelegt werden?
 *
 * Grundsatz: Die Beta ersetzt nur, was kostenlos oder abgelaufen ist. Ein
 * Abo, das Geld bewegt (Stripe) oder bewusst vergeben wurde (laufendes,
 * nicht-freies Abo), wird nie angefasst — `subscriptions` trägt
 * `UNIQUE (tenant_id)`, ein Upsert würde es ersetzen.
 */
export function decideEnrollment(
  current: CurrentSubscription | null,
  now: Date,
  { acceptNew = true }: { acceptNew?: boolean } = {},
): EnrollDecision {
  // Bestandsschutz zuerst: Ein gewährter Beta-Zugang bleibt, auch wenn die
  // Beta keine neuen Mandanten mehr aufnimmt.
  if (current?.source === BETA_SOURCE) return { kind: 'already' };
  const decision = decideNewEnrollment(current, now);
  if (decision.kind === 'enroll' && !acceptNew) return { kind: 'skip', reason: 'NEW_ENROLLMENT_CLOSED' };
  return decision;
}

function decideNewEnrollment(current: CurrentSubscription | null, now: Date): EnrollDecision {
  if (!current) return { kind: 'enroll' };

  // Stripe-Abos (auch gekündigte) bleiben unberührt: der Auflöser liest
  // zuerst `stripe_price_id`, und Stripe-Webhooks schreiben dieselbe Zeile.
  if (current.stripe_subscription_id) return { kind: 'skip', reason: 'STRIPE_SUBSCRIPTION' };

  const planKey = current.plan_key ?? '';
  if (isFreePlanKey(planKey)) return { kind: 'enroll' };

  // Kartenloser Growth-Test (create-trial-subscription): die Beta verlängert ihn.
  if (current.status === 'trialing' && planKey === BETA_PLAN_KEY) return { kind: 'enroll' };

  const end = current.trial_end ?? current.trial_ends_at ?? null;
  const trialRunning =
    current.status === 'trialing' && (end === null || new Date(end).getTime() > now.getTime());
  if (trialRunning || current.status === 'active' || current.status === 'past_due') {
    return { kind: 'skip', reason: 'ACTIVE_SUBSCRIPTION' };
  }

  // Abgelaufener Test, gekündigtes manuelles Abo o. Ä.: zählt ohnehin als frei.
  return { kind: 'enroll' };
}

/** Beta serverseitig offen? `BETA_PHASE=off` (Function-Secret) schließt sie. */
export function betaOpen(flag: string | undefined, now: Date): boolean {
  const f = (flag ?? 'on').toLowerCase();
  if (f === 'off' || f === 'false' || f === '0') return false;
  return now.getTime() < new Date(BETA_ENDS_AT).getTime();
}

/**
 * Nimmt die Beta neue Mandanten auf? `BETA_NEW_ENROLLMENT=off` (Function-Secret)
 * schließt nur die Neuaufnahme — bestehende Beta-Zugänge bleiben bestätigt,
 * anders als `BETA_PHASE=off`, das die Function ganz schließt. Default = an.
 */
export function newEnrollmentOpen(flag: string | undefined): boolean {
  const f = (flag ?? 'on').toLowerCase();
  return !(f === 'off' || f === 'false' || f === '0');
}

/** Marketing-Quelle aus dem Body — nur ein kurzer Slug, sonst `beta`. */
export function sanitizeSource(raw: unknown): string {
  return typeof raw === 'string' && /^[a-z0-9][a-z0-9-]{0,47}$/.test(raw) ? raw : BETA_SOURCE;
}
