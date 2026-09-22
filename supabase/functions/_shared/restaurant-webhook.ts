import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { importSecretKey, open } from './secretBox.ts';
import type {
  RestaurantExecutionAdapter,
  RestaurantExecutionOrder,
  RestaurantExecutionSubmission,
  RestaurantExecutionTarget,
  RestaurantExecutionVerification,
} from './restaurant-execution.ts';

type SupabaseAdmin = SupabaseClient;

export class RestaurantWebhookError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface RestaurantWebhookCredentials {
  url: string;
  secret: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function pickCredential(
  value: Record<string, unknown>,
  keys: readonly string[],
): string {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return '';
}

function validateWebhookUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new RestaurantWebhookError('INVALID_WEBHOOK_URL', 'Webhook URL ist ungültig');
  }

  if (url.protocol !== 'https:') {
    throw new RestaurantWebhookError('WEBHOOK_HTTPS_REQUIRED', 'Webhook muss HTTPS verwenden');
  }
  if (url.username || url.password) {
    throw new RestaurantWebhookError('WEBHOOK_USERINFO_FORBIDDEN', 'Webhook URL darf keine Zugangsdaten enthalten');
  }
  if (url.port && url.port !== '443') {
    throw new RestaurantWebhookError('WEBHOOK_PORT_FORBIDDEN', 'Webhook darf nur HTTPS-Standardport verwenden');
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal'
  ) {
    throw new RestaurantWebhookError('WEBHOOK_HOST_FORBIDDEN', 'Lokale oder interne Webhook-Ziele sind nicht erlaubt');
  }

  // IP-Literale werden vollständig abgelehnt. Das verhindert die offensichtlichen
  // Loopback-/RFC1918-/Link-Local-Pfade; DNS-Rebinding ist damit nicht vollständig
  // gelöst und bleibt eine Grenze für einen späteren Egress-Proxy.
  if (/^\[?[0-9a-f:.]+\]?$/i.test(host)) {
    throw new RestaurantWebhookError('WEBHOOK_IP_LITERAL_FORBIDDEN', 'Webhook-Ziel muss ein öffentlicher DNS-Hostname sein');
  }

  return url.toString();
}

async function loadSealKey(admin: SupabaseAdmin): Promise<CryptoKey> {
  let b64 = Deno.env.get('INTEGRATION_CREDENTIALS_KEY') ?? null;
  if (!b64) {
    try {
      const { data } = await admin.rpc('get_app_secret', {
        secret_name: 'integration_credentials_key',
      });
      if (typeof data === 'string' && data.length > 0) b64 = data;
    } catch {
      // Kein Klartext-Fallback.
    }
  }
  if (!b64) {
    throw new RestaurantWebhookError('NO_SEAL_KEY', 'Zugangsdaten-Siegel ist nicht konfiguriert');
  }

  try {
    return await importSecretKey(b64);
  } catch {
    throw new RestaurantWebhookError('INVALID_SEAL_KEY', 'Zugangsdaten-Siegel ist ungültig');
  }
}

export function normalizeRestaurantWebhookCredentials(
  value: unknown,
): RestaurantWebhookCredentials {
  const opened = asRecord(value) ?? {};
  const url = pickCredential(opened, ['webhook_url', 'url', 'Webhook URL']);
  const secret = pickCredential(opened, ['secret', 'webhook_secret', 'Secret']);

  if (!url) {
    throw new RestaurantWebhookError('WEBHOOK_URL_MISSING', 'Webhook URL fehlt');
  }
  if (secret.length < 16) {
    throw new RestaurantWebhookError('WEBHOOK_SECRET_TOO_SHORT', 'Webhook Secret ist zu kurz');
  }

  return {
    url: validateWebhookUrl(url),
    secret,
  };
}

export async function loadRestaurantWebhookCredentials(
  admin: SupabaseAdmin,
  tenantId: string,
  integrationConfigId: string,
): Promise<RestaurantWebhookCredentials> {
  const { data: config, error: configError } = await admin
    .from('integration_configs')
    .select('id, tenant_id, integration_id, enabled, credentials_enc')
    .eq('id', integrationConfigId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (configError) {
    throw new RestaurantWebhookError('INTEGRATION_LOOKUP_FAILED', configError.message);
  }
  if (!config || config.enabled !== true) {
    throw new RestaurantWebhookError('INTEGRATION_NOT_CONFIGURED', 'Restaurant-Webhook ist nicht aktiv');
  }

  const { data: integration, error: integrationError } = await admin
    .from('integrations')
    .select('id, slug, enabled')
    .eq('id', config.integration_id)
    .maybeSingle();

  if (integrationError) {
    throw new RestaurantWebhookError('INTEGRATION_CATALOG_LOOKUP_FAILED', integrationError.message);
  }
  if (!integration || integration.slug !== 'restaurant-webhook' || integration.enabled !== true) {
    throw new RestaurantWebhookError('INTEGRATION_TYPE_MISMATCH', 'Integration ist kein Restaurant-Webhook');
  }
  if (!config.credentials_enc) {
    throw new RestaurantWebhookError('INTEGRATION_CREDENTIALS_MISSING', 'Webhook-Zugangsdaten fehlen');
  }

  const key = await loadSealKey(admin);

  let opened: Record<string, unknown>;
  try {
    const raw = await open(key, config.credentials_enc);
    opened = asRecord(raw) ?? {};
  } catch {
    throw new RestaurantWebhookError('INTEGRATION_SEAL_ERROR', 'Webhook-Zugangsdaten konnten nicht geöffnet werden');
  }

  return normalizeRestaurantWebhookCredentials(opened);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signRestaurantWebhook(
  secret: string,
  timestamp: string,
  body: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  return `sha256=${toHex(new Uint8Array(signature))}`;
}

interface RestaurantWebhookResponse {
  ok?: boolean;
  submission_id?: string;
  external_id?: string;
  status?: 'pending' | 'accepted' | 'failed';
  error_code?: string;
}

async function postWebhook(
  credentials: RestaurantWebhookCredentials,
  event: string,
  target: RestaurantExecutionTarget,
  orderId: string,
  idempotencyKey: string,
  payload: Record<string, unknown>,
): Promise<RestaurantWebhookResponse> {
  const body = JSON.stringify({
    contract: 'rsd.restaurant.execution.v1',
    event,
    target,
    order_id: orderId,
    ...payload,
  });
  const timestamp = new Date().toISOString();
  const signature = await signRestaurantWebhook(credentials.secret, timestamp, body);

  let response: Response;
  try {
    response = await fetch(credentials.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'RealSyncDynamics-Restaurant-Execution/1.0',
        'x-rsd-event': event,
        'x-rsd-timestamp': timestamp,
        'x-rsd-signature': signature,
        'idempotency-key': idempotencyKey,
      },
      body,
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new RestaurantWebhookError('WEBHOOK_NETWORK_ERROR', 'Webhook war nicht erreichbar');
  }

  const raw = (await response.text()).slice(0, 16_384);
  if (!response.ok) {
    throw new RestaurantWebhookError(
      `WEBHOOK_HTTP_${response.status}`,
      `Webhook antwortete mit HTTP ${response.status}`,
    );
  }

  try {
    return asRecord(JSON.parse(raw)) as RestaurantWebhookResponse ?? {};
  } catch {
    throw new RestaurantWebhookError('WEBHOOK_INVALID_JSON', 'Webhook-Antwort ist kein gültiges JSON');
  }
}

export function createRestaurantWebhookAdapter(
  id: string,
  target: RestaurantExecutionTarget,
  credentials: RestaurantWebhookCredentials,
): RestaurantExecutionAdapter {
  return {
    id,
    target,

    async submit(order: RestaurantExecutionOrder): Promise<RestaurantExecutionSubmission> {
      const idempotencyKey = `${order.order_id}:${target}:submit`;
      const response = await postWebhook(
        credentials,
        'restaurant.order.submit',
        target,
        order.order_id,
        idempotencyKey,
        {
          order: {
            customer_name: order.customer_name,
            contact: order.contact,
            items: order.items,
            total_amount: order.total_amount,
            currency: order.currency,
            fulfillment: order.fulfillment,
            delivery_address: order.delivery_address,
            notes: order.notes,
          },
        },
      );

      const submissionId = typeof response.submission_id === 'string'
        ? response.submission_id.trim().slice(0, 200)
        : '';
      if (!submissionId) {
        throw new RestaurantWebhookError('WEBHOOK_SUBMISSION_ID_MISSING', 'Webhook lieferte keine submission_id');
      }

      return {
        submission_id: submissionId,
        external_id: typeof response.external_id === 'string'
          ? response.external_id.trim().slice(0, 200)
          : null,
      };
    },

    async verify(
      order: RestaurantExecutionOrder,
      submission: RestaurantExecutionSubmission,
    ): Promise<RestaurantExecutionVerification> {
      const idempotencyKey = `${order.order_id}:${target}:verify:${submission.submission_id}`;
      const response = await postWebhook(
        credentials,
        'restaurant.order.verify',
        target,
        order.order_id,
        idempotencyKey,
        {
          submission_id: submission.submission_id,
          external_id: submission.external_id ?? null,
        },
      );

      const status = response.status;
      if (status !== 'pending' && status !== 'accepted' && status !== 'failed') {
        throw new RestaurantWebhookError('WEBHOOK_VERIFY_STATUS_INVALID', 'Webhook lieferte keinen gültigen Verify-Status');
      }

      return {
        status,
        external_id: typeof response.external_id === 'string'
          ? response.external_id.trim().slice(0, 200)
          : submission.external_id ?? null,
        error_code: status === 'failed' && typeof response.error_code === 'string'
          ? response.error_code.trim().slice(0, 120)
          : null,
      };
    },
  };
}

export async function createConfiguredRestaurantWebhookAdapter(
  admin: SupabaseAdmin,
  tenantId: string,
  integrationConfigId: string,
  target: RestaurantExecutionTarget,
): Promise<RestaurantExecutionAdapter> {
  const credentials = await loadRestaurantWebhookCredentials(admin, tenantId, integrationConfigId);
  return createRestaurantWebhookAdapter(
    `restaurant-webhook:${integrationConfigId}:${target}`,
    target,
    credentials,
  );
}

export async function testRestaurantWebhookConnection(
  credentials: RestaurantWebhookCredentials,
): Promise<void> {
  const response = await postWebhook(
    credentials,
    'restaurant.integration.test',
    'pos',
    '00000000-0000-0000-0000-000000000000',
    `restaurant-integration-test:${crypto.randomUUID()}`,
    { test: true },
  );
  if (response.ok !== true) {
    throw new RestaurantWebhookError('WEBHOOK_TEST_REJECTED', 'Webhook-Verbindungstest wurde nicht bestätigt');
  }
}
