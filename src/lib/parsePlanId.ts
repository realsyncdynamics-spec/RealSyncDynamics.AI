/**
 * Untrusted boundary → PlanId. URL, Stripe metadata, DB, request body may be
 * `string`. After this function the product domain must see `PlanId` only.
 *
 * `PLAN_ORDER` is the subscription ladder and excludes one-time products.
 * `governance_launch` is still a PlanId and must parse here.
 * Legacy `scale` is not a PlanId; `normalizePlanKey` handles PlanKey aliases.
 */
import { type PlanId } from '../../shared/pricing';

const PLAN_IDS = [
  'free',
  'starter',
  'growth',
  'agency',
  'enterprise',
  'partner',
  'governance_launch',
] as const satisfies readonly PlanId[];

export function parsePlanId(value: string | null | undefined): PlanId | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  return (PLAN_IDS as readonly string[]).includes(key) ? (key as PlanId) : null;
}
