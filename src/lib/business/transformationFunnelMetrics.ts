// Pure transformation-funnel metrics. No Stripe/Supabase dependencies.
// Keep event aggregation deterministic so pricing experiments can be replayed.

export type TransformationFunnelEventName =
  | 'preview_started'
  | 'preview_completed'
  | 'transformation_cta_clicked'
  | 'checkout_started'
  | 'transformation_paid'
  | 'transformation_ready'
  | 'core_activated'
  | 'capability_activated'
  | 'capacity_expanded';

export interface TransformationFunnelEvent {
  event_id: string;
  name: TransformationFunnelEventName;
  occurred_at: string;
  tenant_id: string | null;
  anonymous_session_id: string | null;
  experiment: 'reference_349' | 'launch_249' | null;
  amount_cents: number | null;
  currency: string | null;
}

export interface TransformationFunnelSnapshot {
  window_start: string;
  window_end: string;
  experiment: TransformationFunnelEvent['experiment'];
  preview_started: number;
  preview_completed: number;
  transformation_cta_clicked: number;
  checkout_started: number;
  transformation_paid: number;
  transformation_ready: number;
  core_activated: number;
  capability_activated: number;
  capacity_expanded: number;
  transformation_revenue_cents: number;
  conversion_rates: {
    preview_to_completed: number;
    completed_to_cta: number;
    cta_to_checkout: number;
    checkout_to_paid: number;
    paid_to_ready: number;
    paid_to_core: number;
  };
}

function inWindow(event: TransformationFunnelEvent, startMs: number, endMs: number): boolean {
  const t = Date.parse(event.occurred_at);
  return Number.isFinite(t) && t >= startMs && t <= endMs;
}

function safeRate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * Aggregate one pricing experiment cohort. Revenue is counted only from
 * transformation_paid events and is deliberately independent from recurring
 * subscription revenue; those are measured by business/metrics.ts.
 */
export function aggregateTransformationFunnel(
  events: readonly TransformationFunnelEvent[],
  startMs: number,
  endMs: number,
  experiment: TransformationFunnelEvent['experiment'],
): TransformationFunnelSnapshot {
  const scoped = events.filter((event) =>
    event.experiment === experiment && inWindow(event, startMs, endMs),
  );

  const count = (name: TransformationFunnelEventName) =>
    scoped.filter((event) => event.name === name).length;

  const previewStarted = count('preview_started');
  const previewCompleted = count('preview_completed');
  const ctaClicked = count('transformation_cta_clicked');
  const checkoutStarted = count('checkout_started');
  const paid = count('transformation_paid');
  const ready = count('transformation_ready');
  const core = count('core_activated');
  const capability = count('capability_activated');
  const capacity = count('capacity_expanded');

  const transformationRevenue = scoped
    .filter((event) => event.name === 'transformation_paid')
    .reduce((sum, event) => sum + Math.max(0, event.amount_cents ?? 0), 0);

  return {
    window_start: new Date(startMs).toISOString(),
    window_end: new Date(endMs).toISOString(),
    experiment,
    preview_started: previewStarted,
    preview_completed: previewCompleted,
    transformation_cta_clicked: ctaClicked,
    checkout_started: checkoutStarted,
    transformation_paid: paid,
    transformation_ready: ready,
    core_activated: core,
    capability_activated: capability,
    capacity_expanded: capacity,
    transformation_revenue_cents: transformationRevenue,
    conversion_rates: {
      preview_to_completed: safeRate(previewCompleted, previewStarted),
      completed_to_cta: safeRate(ctaClicked, previewCompleted),
      cta_to_checkout: safeRate(checkoutStarted, ctaClicked),
      checkout_to_paid: safeRate(paid, checkoutStarted),
      paid_to_ready: safeRate(ready, paid),
      paid_to_core: safeRate(core, paid),
    },
  };
}

export function compareTransformationExperiments(
  events: readonly TransformationFunnelEvent[],
  startMs: number,
  endMs: number,
) {
  return {
    reference_349: aggregateTransformationFunnel(events, startMs, endMs, 'reference_349'),
    launch_249: aggregateTransformationFunnel(events, startMs, endMs, 'launch_249'),
  };
}
