/**
 * Webhook remediator — generic outbound HTTP delivery.
 *
 * First concrete `Remediator` (see `src/core/runtime/remediation.ts`).
 * Generic enough to live in `src/core/remediators/` rather than next to
 * a specific external system: any tenant can register a webhook URL and
 * receive remediation payloads as JSON.
 *
 * Idempotency contract (from `Remediator.deliver`): receivers SHOULD
 * de-dup on `X-RSD-Remediation-Id` + `X-RSD-Fingerprint`. Both are sent
 * as headers and echoed in the body, so receivers can use either.
 *
 * Auth: if `signingSecret` is provided the body is HMAC-SHA-256-signed
 * and the signature shipped in `X-RSD-Signature` as `sha256=<hex>`
 * (GitHub-style). If `bearerToken` is provided it's shipped in
 * `Authorization: Bearer …`. Both can be combined; at least one SHOULD
 * be configured in production.
 *
 * Not in scope here: retry/backoff, queue persistence, multi-receiver
 * fan-out. Those belong in a dispatcher orchestrator on top — keeping
 * this implementation as a single HTTP call keeps the contract
 * trivially testable.
 */

import type {
  DeliveryResult,
  Remediation,
  RemediationAction,
  Remediator,
} from '../runtime/remediation';

export interface WebhookDispatcherOptions {
  /** Endpoint URL the remediation is POSTed to. */
  endpoint: string;
  /** Optional bearer token sent as `Authorization: Bearer …`. */
  bearerToken?: string;
  /**
   * Optional HMAC-SHA-256 secret. When provided, the body is signed
   * and the hex digest sent as `X-RSD-Signature: sha256=<hex>`.
   */
  signingSecret?: string;
  /** Extra headers merged after the dispatcher's own. */
  headers?: Readonly<Record<string, string>>;
  /** Request timeout. Default 5_000 ms. */
  timeoutMs?: number;
  /** Custom fetch (test override / non-browser runtimes). */
  fetchImpl?: typeof fetch;
}

export class WebhookDispatcher implements Remediator {
  readonly channel = 'webhook' as const;
  readonly #opts: Required<Pick<WebhookDispatcherOptions, 'endpoint' | 'timeoutMs'>> &
    Omit<WebhookDispatcherOptions, 'endpoint' | 'timeoutMs'>;
  readonly #fetch: typeof fetch;

  constructor(options: WebhookDispatcherOptions) {
    if (!options.endpoint) throw new Error('WebhookDispatcher: endpoint required');
    this.#opts = {
      endpoint: options.endpoint,
      timeoutMs: options.timeoutMs ?? 5_000,
      bearerToken: options.bearerToken,
      signingSecret: options.signingSecret,
      headers: options.headers,
    };
    this.#fetch = options.fetchImpl ?? globalThis.fetch;
  }

  // Webhooks are a fan-out mechanism, not action-specific. The runtime
  // can route any remediation through this channel; the receiver
  // decides what to do with each action.
  supports(_action: RemediationAction): boolean {
    return true;
  }

  async deliver(remediation: Remediation): Promise<DeliveryResult> {
    const body = JSON.stringify(buildBody(remediation));
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-rsd-remediation-id': remediation.id,
      'x-rsd-fingerprint': remediation.fingerprint,
      'x-rsd-tenant-id': remediation.tenant_id,
    };
    if (this.#opts.bearerToken) {
      headers.authorization = `Bearer ${this.#opts.bearerToken}`;
    }
    if (this.#opts.signingSecret) {
      const sig = await hmacSha256Hex(this.#opts.signingSecret, body);
      headers['x-rsd-signature'] = `sha256=${sig}`;
    }
    if (this.#opts.headers) {
      for (const [k, v] of Object.entries(this.#opts.headers)) {
        headers[k.toLowerCase()] = v;
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#opts.timeoutMs);
    try {
      const resp = await this.#fetch(this.#opts.endpoint, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      if (!resp.ok) {
        const text = await safeText(resp);
        return {
          ok: false,
          error: {
            code: `http_${resp.status}`,
            message: text || `HTTP ${resp.status}`,
          },
        };
      }

      // Receivers MAY echo an external id back; we accept either
      // a JSON `{ id }` body or fall back to the response location/etag.
      const externalId =
        (await tryParseJsonId(resp)) ??
        resp.headers.get('location') ??
        resp.headers.get('etag') ??
        undefined;

      return { ok: true, external_id: externalId ?? undefined };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const code = message.includes('abort') ? 'timeout' : 'network_error';
      return { ok: false, error: { code, message } };
    } finally {
      clearTimeout(timer);
    }
  }
}

// ─── Internals ──────────────────────────────────────────────────────────────

function buildBody(remediation: Remediation): Record<string, unknown> {
  return {
    remediation_id: remediation.id,
    fingerprint: remediation.fingerprint,
    tenant_id: remediation.tenant_id,
    status: remediation.status,
    delivery: remediation.delivery,
    problem: remediation.problem,
    action: remediation.action,
    drafted_at: remediation.drafted_at,
    decided_at: remediation.decided_at,
  };
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (!subtle) throw new Error('WebhookDispatcher: Web Crypto SubtleCrypto unavailable');
  const key = await subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const bytes = new Uint8Array(sig);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

async function safeText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return '';
  }
}

async function tryParseJsonId(resp: Response): Promise<string | undefined> {
  const ct = resp.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return undefined;
  try {
    const body = (await resp.json()) as { id?: unknown };
    return typeof body?.id === 'string' ? body.id : undefined;
  } catch {
    return undefined;
  }
}
