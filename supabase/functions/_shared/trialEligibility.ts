/**
 * First-trial eligibility for Self-Service Starter/Growth.
 * Grant only from plan.trialDays + unused trial. body.pilot is ignored.
 * Abandoned checkout sessions do not consume the trial.
 */

export const LIVE_SUBSCRIPTION_STATES = new Set(['active', 'trialing', 'past_due']);

export type TrialDecision =
  | { grant: true; days: number }
  | { grant: false; reason: 'NO_TRIAL_ON_PLAN' | 'NOT_CHECKOUT' | 'LIVE_SUBSCRIPTION' | 'TRIAL_CONSUMED' };

export type SubscriptionRow = {
  status: string | null;
  plan_key: string | null;
  trial_start: string | null;
  trial_end: string | null;
};

export function decideTrial(args: {
  trialDays: number;
  purchaseMode: string;
  current: SubscriptionRow | null;
  auditGrantExists: boolean;
}): TrialDecision {
  if (args.purchaseMode !== 'checkout' || args.trialDays <= 0) {
    return { grant: false, reason: args.trialDays <= 0 ? 'NO_TRIAL_ON_PLAN' : 'NOT_CHECKOUT' };
  }
  if (args.current && LIVE_SUBSCRIPTION_STATES.has(args.current.status ?? '')) {
    return { grant: false, reason: 'LIVE_SUBSCRIPTION' };
  }
  if (args.current?.trial_start || args.auditGrantExists) {
    return { grant: false, reason: 'TRIAL_CONSUMED' };
  }
  return { grant: true, days: args.trialDays };
}

export async function loadTrialInputs(
  admin: {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: SubscriptionRow | null }>;
          limit: (n: number) => { maybeSingle: () => Promise<{ data: { id?: string } | null }> };
        };
      };
    };
  },
  tenantId: string,
): Promise<{ current: SubscriptionRow | null; auditGrantExists: boolean }> {
  const { data: current } = await admin
    .from('subscriptions')
    .select('status, plan_key, trial_start, trial_end')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const { data: audit } = await admin
    .from('trial_audit_logs')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1)
    .maybeSingle();

  return { current: current ?? null, auditGrantExists: Boolean(audit?.id) };
}
