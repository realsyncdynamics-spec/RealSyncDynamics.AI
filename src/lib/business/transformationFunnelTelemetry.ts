import { getSupabase } from '../supabase';

export type TransformationFunnelEvent = 'preview_started' | 'preview_completed' | 'transformation_cta_clicked';

function eventId(): string {
  return crypto.randomUUID();
}

function anonymousId(): string {
  const key = 'rsd_transformation_anonymous_id';
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const value = crypto.randomUUID();
    window.localStorage.setItem(key, value);
    return value;
  } catch {
    return crypto.randomUUID();
  }
}

export async function trackTransformationEvent(
  eventName: TransformationFunnelEvent,
  metadata?: { variant?: string; source?: string },
): Promise<void> {
  try {
    await getSupabase().functions.invoke('transformation-funnel-event', {
      body: {
        event_id: eventId(),
        event_name: eventName,
        price_cohort: 'reference_349',
        anonymous_id: anonymousId(),
        metadata,
      },
    });
  } catch {
    // Funnel telemetry must never block preview or checkout.
  }
}
