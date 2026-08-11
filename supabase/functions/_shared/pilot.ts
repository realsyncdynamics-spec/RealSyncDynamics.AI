// Reine Entscheidungslogik der Pilot-Aktivierung.
//
// Bewusst frei von Deno-Globals und Supabase-Client: `pilot-activate/index.ts`
// ruft `Deno.serve` auf Modulebene auf und ist damit unter Vitest nicht
// importierbar. Alles, was ohne Netzwerk und Datenbank entscheidbar ist, liegt
// deshalb hier und wird direkt getestet.

/** Ein unbeanspruchter Audit verfällt nach 14 Tagen. */
export const AUDIT_CLAIM_WINDOW_DAYS = 14;

/**
 * Plan-Key des Pilots.
 *
 * `tenant_entitlements()` (20260808120000) löst das Produkt über
 * `products.default_for_plan_key = subscriptions.plan_key` auf und prüft den
 * Status NICHT — eine `trialing`-Zeile zählt also voll. `useEntitlements`
 * akzeptiert `trialing` ebenfalls explizit. Erst `starter` schaltet damit die
 * Governance Runtime frei; `free_audit` würde auf den Free-Plan mappen und den
 * Nutzer im FreeTierDashboard belassen.
 */
export const PILOT_PLAN_KEY = 'starter';

export const CONSENT_TYPE = 'platform_improvement_analytics';
export const CONSENT_VERSION = '1.0';

export interface SubscriptionRow {
  id?: string;
  tenant_id?: string;
  plan_key: string | null;
  status: string | null;
  trial_start?: string | null;
  trial_end?: string | null;
}

/**
 * Was mit einer bestehenden Subscription geschieht.
 *
 * - `create`   — es gibt keine Zeile, der Pilot wird angelegt
 * - `reuse`    — laufender Trial, unverändert weiterverwenden
 * - `upgrade`  — Free-Audit-/beendete Zeile auf den Pilot heben
 * - `preserve` — bezahltes oder unbekanntes Abo, nicht anfassen
 */
export type PilotAction = 'create' | 'reuse' | 'upgrade' | 'preserve';

/**
 * Entscheidet über die Subscription beim Pilot-Start.
 *
 * Die naive Regel „existiert irgendeine Subscription → nichts tun" wäre falsch:
 * sie würde einen Tenant mit alter Free-Audit-Zeile dauerhaft vom Pilot
 * ausschließen. Ein bedingungsloser Upsert wäre genauso falsch — er würde ein
 * laufendes bezahltes Abo auf einen Starter-Trial herabstufen.
 */
export function resolvePilotAction(sub: SubscriptionRow | null | undefined): PilotAction {
  if (!sub) return 'create';

  const status = (sub.status ?? '').toLowerCase();
  const planKey = (sub.plan_key ?? '').toLowerCase();

  // Laufender Trial — egal welcher Plan. Wiederverwenden, NIEMALS verlängern:
  // ein Reload darf das Pilot-Ende nicht nach hinten schieben.
  if (status === 'trialing') return 'reuse';

  // Zahlendes oder in Zahlung befindliches Abo: unter keinen Umständen
  // herabstufen. Audit-Claim und Domain-Aktivierung laufen trotzdem durch —
  // der Kunde bekommt seine Runtime aus dem bestehenden Vertrag.
  const paying = status === 'active' || status === 'past_due' || status === 'incomplete';
  if (paying && planKey && planKey !== 'free_audit') return 'preserve';

  // Free-Audit-Zeile oder beendetes Abo: auf den Pilot heben.
  if (!planKey || planKey === 'free_audit' || status === 'canceled' || status === 'incomplete_expired') {
    return 'upgrade';
  }

  // Unbekannte Kombination: konservativ nichts anfassen, statt zu raten.
  return 'preserve';
}

/**
 * Nur valide IPv4/IPv6-Literale dürfen in eine INET-Spalte.
 * `x-forwarded-for` kann eine Liste sein — der erste Eintrag ist der Client.
 */
export function parseClientIp(header: string | null | undefined): string | null {
  if (!header) return null;
  const first = header.split(',')[0]?.trim();
  if (!first) return null;
  const m = first.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) return m.slice(1).every((o) => Number(o) <= 255) ? first : null;
  if (/^[0-9a-fA-F:]+$/.test(first) && first.includes(':')) return first;
  return null;
}

/** Ist der Audit für einen Claim zu alt? */
export function isAuditExpired(createdAt: string | null | undefined, now: number): boolean {
  if (!createdAt) return true;
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) return true;
  return now - created > AUDIT_CLAIM_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}
