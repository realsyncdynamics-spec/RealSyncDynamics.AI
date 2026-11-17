/**
 * xAI Imagine server-only HTTP adapter. No Edge route, browser import,
 * customer entitlement, DB migration or automatic cloud fallback is added.
 *
 * CALLER OBLIGATIONS (before enablement):
 * - verified Supabase user/tenant, entitlement, PDP/consent, rate limit;
 * - atomic tenant budget reservation before EACH provider request;
 * - measured/estimated settlement and idempotent video-job ownership;
 * - approval for third-country transfer and media retention.
 *
 * This is deliberately NOT wired into ai-gateway's EU-local chat profiles.
 */
import {
  assertProviderMediaUrl,
  parseImageRequest,
  parseVideoRequest,
  parseVideoRequestId,
  type ImageRequest,
  type VideoRequest,
} from './contract.ts';

const API_ORIGIN = 'https://api.x.ai';
const MAX_JSON_BYTES = 128 * 1024;
const TICKS_PER_USD = 10_000_000_000;

export class XaiImagineProviderError extends Error {
  readonly code = 'XAI_IMAGINE_UPSTREAM';
  constructor(readonly status: number | null = null) {
    super('xAI Imagine request unavailable');
    this.name = 'XaiImagineProviderError';
  }
}

export interface ImageResult {
  url: string;
  mimeType: string | null;
  costUsd: number | null;
}

export type VideoResult =
  | { status: 'pending'; costUsd: null }
  | { status: 'failed'; costUsd: number | null }
  | { status: 'done'; url: string; duration: number | null; costUsd: number | null };

export interface XaiImagineOptions {
  /** Must be a server-managed secret, never import.meta.env or VITE_*. */
  apiKey: string;
  /** Explicit feature flag; disabled or missing is fail-closed. */
  enabled: boolean;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function providerCostUsd(body: Record<string, unknown>): number | null {
  const ticks = record(body.usage)?.cost_in_usd_ticks;
  if (typeof ticks !== 'number' || !Number.isFinite(ticks) || ticks < 0) return null;
  return ticks / TICKS_PER_USD;
}

export class XaiImagineTransport {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: XaiImagineOptions) {
    if (options.enabled !== true || !options.apiKey?.trim()) {
      throw new Error('xAI Imagine integration disabled or not configured');
    }
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = Math.min(Math.max(options.timeoutMs ?? 30_000, 1_000), 60_000);
  }

  private async request(path: string, method: 'POST' | 'GET', body?: ImageRequest | VideoRequest): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${API_ORIGIN}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      // Do not forward provider/transport text; it might contain credentials.
      throw new XaiImagineProviderError();
    }
    if (!response.ok) throw new XaiImagineProviderError(response.status);
    if (Number(response.headers.get('content-length') ?? 0) > MAX_JSON_BYTES) {
      throw new XaiImagineProviderError();
    }
    let parsed: unknown;
    try {
      const text = await response.text();
      if (text.length > MAX_JSON_BYTES) throw new Error('oversized response');
      parsed = JSON.parse(text);
    } catch {
      throw new XaiImagineProviderError();
    }
    const data = record(parsed);
    if (!data) throw new XaiImagineProviderError();
    return data;
  }

  /** Paid API call: invoking code MUST already hold an atomic budget reservation. */
  async generateImage(input: unknown): Promise<ImageResult> {
    const req = parseImageRequest(input);
    const data = await this.request('/v1/images/generations', 'POST', req);
    const entries = data.data;
    if (!Array.isArray(entries) || entries.length !== 1) throw new XaiImagineProviderError();
    const first = record(entries[0]);
    if (!first) throw new XaiImagineProviderError();
    return {
      url: assertProviderMediaUrl(first.url, 'image'),
      mimeType: typeof first.mime_type === 'string' ? first.mime_type : null,
      costUsd: providerCostUsd(data),
    };
  }

  /** Paid API call: reserve before invocation, then persist request_id + owner. */
  async startVideo(input: unknown): Promise<{ requestId: string }> {
    const req = parseVideoRequest(input);
    const data = await this.request('/v1/videos/generations', 'POST', req);
    try {
      return { requestId: parseVideoRequestId(data.request_id) };
    } catch {
      throw new XaiImagineProviderError();
    }
  }

  /** Never expose directly: verify tenant and stored video-job ownership first. */
  async getVideoStatus(requestId: unknown): Promise<VideoResult> {
    const safeId = parseVideoRequestId(requestId);
    const data = await this.request(`/v1/videos/${encodeURIComponent(safeId)}`, 'GET');
    const costUsd = providerCostUsd(data);
    if (data.status === 'pending') return { status: 'pending', costUsd: null };
    if (data.status === 'failed') return { status: 'failed', costUsd };
    if (data.status !== 'done') throw new XaiImagineProviderError();
    const video = record(data.video);
    if (!video) throw new XaiImagineProviderError();
    const duration = video.duration;
    return {
      status: 'done',
      url: assertProviderMediaUrl(video.url, 'video'),
      duration: typeof duration === 'number' && Number.isFinite(duration) && duration > 0 ? duration : null,
      costUsd,
    };
  }
}
