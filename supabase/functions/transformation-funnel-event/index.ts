import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonError, jsonResponse } from '../_shared/gateway.ts';
import { writeTransformationEvent, type TransformationEventName, type TransformationPriceCohort } from '../_shared/transformation-event-ledger.ts';

const ALLOWED_EVENTS = new Set<TransformationEventName>([
  'preview_started',
  'preview_completed',
  'transformation_cta_clicked',
]);
const ALLOWED_METADATA = new Set(['variant', 'source']);

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getServerPriceCohort(): TransformationPriceCohort {
  // Public telemetry never trusts a client-supplied pricing cohort.
  // A launch experiment, if enabled, is an operator-controlled server setting.
  return Deno.env.get('TRANSFORMATION_PRICING_COHORT') === 'launch_249'
    ? 'launch_249'
    : 'reference_349';
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_METHOD', 'POST only');

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_JSON', 'invalid json');
  }

  const eventName = body.event_name;
  const eventId = body.event_id;
  if (typeof eventName !== 'string' || !ALLOWED_EVENTS.has(eventName as TransformationEventName)) {
    return jsonError(400, 'INVALID_EVENT', 'unsupported transformation event');
  }
  if (!isUuid(eventId)) return jsonError(400, 'INVALID_EVENT_ID', 'event_id must be a UUID');

  const rawMetadata = body.metadata;
  const metadata = rawMetadata && typeof rawMetadata === 'object' && !Array.isArray(rawMetadata)
    ? Object.fromEntries(Object.entries(rawMetadata).filter(([key, value]) => ALLOWED_METADATA.has(key) && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null)))
    : undefined;

  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return jsonError(500, 'CONFIG', 'server credentials unavailable');

  let tenantId: string | undefined;
  const auth = req.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (anonKey) {
      const client = createClient(url, anonKey, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
      const { data } = await client.auth.getUser();
      tenantId = data.user?.id;
    }
  }

  try {
    await writeTransformationEvent({
      event_id: eventId,
      event_name: eventName as TransformationEventName,
      occurred_at: typeof body.occurred_at === 'string' ? body.occurred_at : undefined,
      anonymous_id: typeof body.anonymous_id === 'string' ? body.anonymous_id.slice(0, 128) : undefined,
      tenant_id: tenantId,
      price_cohort: getServerPriceCohort(),
      metadata,
    });
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonError(500, 'EVENT_WRITE_FAILED', error instanceof Error ? error.message : 'event write failed');
  }
});
