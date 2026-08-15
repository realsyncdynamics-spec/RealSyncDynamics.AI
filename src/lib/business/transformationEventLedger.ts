export const TRANSFORMATION_EVENTS = [
  'preview_started',
  'preview_completed',
  'transformation_cta_clicked',
  'checkout_started',
  'transformation_paid',
  'transformation_completed',
  'core_activated',
  'capability_activated',
  'capacity_expanded',
] as const;

export type TransformationEventName = (typeof TRANSFORMATION_EVENTS)[number];

export type TransformationPriceCohort = 'reference_349' | 'launch_249' | 'not_applicable';

export interface TransformationEvent {
  event_id: string;
  event_name: TransformationEventName;
  occurred_at: string;
  anonymous_id?: string;
  tenant_id?: string;
  project_id?: string;
  transformation_id?: string;
  price_cohort: TransformationPriceCohort;
  currency?: 'EUR';
  amount_cents?: number;
  metadata?: Record<string, string | number | boolean | null>;
}

export function isTransformationEventName(value: string): value is TransformationEventName {
  return (TRANSFORMATION_EVENTS as readonly string[]).includes(value);
}

export function isValidTransformationEvent(event: TransformationEvent): boolean {
  if (!event.event_id || !event.occurred_at || !isTransformationEventName(event.event_name)) return false;
  if (!['reference_349', 'launch_249', 'not_applicable'].includes(event.price_cohort)) return false;
  if (event.amount_cents !== undefined && (!Number.isInteger(event.amount_cents) || event.amount_cents < 0)) return false;
  return Number.isFinite(Date.parse(event.occurred_at));
}

/**
 * Deterministically removes PII-like free-form metadata from an event.
 * The ledger is for funnel economics, not customer-content storage.
 */
export function sanitizeTransformationEvent(event: TransformationEvent): TransformationEvent {
  const allowedKeys = new Set([
    'variant',
    'checkout_mode',
    'capability',
    'capacity_band',
    'source',
  ]);

  const metadata = event.metadata
    ? Object.fromEntries(Object.entries(event.metadata).filter(([key]) => allowedKeys.has(key)))
    : undefined;

  return {
    ...event,
    metadata: metadata && Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}
