/**
 * Untrusted boundary → PlanId. URL, Stripe metadata, DB, request body may be
 * `string`. After this function the product domain must see `PlanId` only.
 * Legacy `scale` is not a PlanId; `normalizePlanKey` handles PlanKey aliases.
 */
import { PLAN_ORDER, type PlanId } from '../../shared/pricing';

const PLAN_IDS: readonly PlanId[] = PLAN_ORDER;

export function parsePlanId(value: string | null | undefined): PlanId | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  return PLAN_IDS.includes(key as PlanId) ? (key as PlanId) : null;
}
