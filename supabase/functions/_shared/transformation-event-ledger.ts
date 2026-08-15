import { createClient } from 'jsr:@supabase/supabase-js@2';

export type TransformationEventName =
  | 'preview_started'
  | 'preview_completed'
  | 'transformation_cta_clicked'
  | 'checkout_started'
  | 'transformation_paid'
  | 'transformation_completed'
  | 'core_activated'
  | 'capability_activated'
  | 'capacity_expanded';

export type TransformationPriceCohort = 'reference_349' | 'launch_249' | 'not_applicable';

export interface TransformationEventInput {
  event_id: string;
  event_name: TransformationEventName;
  occurred_at?: string;
  anonymous_id?: string;
  tenant_id?: string;
  project_id?: string;
  transformation_id?: string;
  price_cohort: TransformationPriceCohort;
  currency?: 'EUR';
  amount_cents?: number;
  metadata?: Record<string, string | number | boolean | null>;
}

const ALLOWED_METADATA = new Set(['variant', 'checkout_mode', 'capability', 'capacity_band', 'source']);

function sanitizeMetadata(metadata?: TransformationEventInput['metadata']) {
  if (!metadata) return null;
  const clean = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => ALLOWED_METADATA.has(key)),
  );
  return Object.keys(clean).length ? clean : null;
}

export async function writeTransformationEvent(event: TransformationEventInput): Promise<void> {
  if (!event.event_id || !event.event_name || !event.price_cohort) {
    throw new Error('invalid transformation event');
  }
  if (event.amount_cents !== undefined && (!Number.isInteger(event.amount_cents) || event.amount_cents < 0)) {
    throw new Error('invalid event amount');
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) throw new Error('Supabase service credentials unavailable');

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin.from('transformation_events').upsert({
    event_id: event.event_id,
    event_name: event.event_name,
    occurred_at: event.occurred_at ?? new Date().toISOString(),
    anonymous_id: event.anonymous_id ?? null,
    tenant_id: event.tenant_id ?? null,
    project_id: event.project_id ?? null,
    transformation_id: event.transformation_id ?? null,
    price_cohort: event.price_cohort,
    currency: event.currency ?? null,
    amount_cents: event.amount_cents ?? null,
    metadata: sanitizeMetadata(event.metadata),
  }, { onConflict: 'event_id', ignoreDuplicates: true });

  if (error) throw new Error(`transformation event write failed: ${error.message}`);
}
