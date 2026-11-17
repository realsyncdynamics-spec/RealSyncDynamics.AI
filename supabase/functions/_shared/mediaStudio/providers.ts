// Media Studio — Anbieter-Adapter (Google Gemini API, Higgsfield API).
//
// Rein bis auf das injizierte `fetch`; Schlüssel kommen ausschließlich aus
// Edge-Secrets (siehe media-studio/index.ts), nie aus dem Browser.
//
// Live-Stand: Die Request-Formate folgen den Anbieter-Docs vom 17.11.2026.
// Gegen die echten APIs ist dieser Adapter noch NICHT gelaufen (keine Keys in
// der Entwicklungsumgebung) — Abweichungen zeigen sich als PROVIDER_ERROR mit
// gekürzter Anbieter-Meldung im Prüfpfad.

import { composeProviderPrompt, type MediaKind, type MediaModel, type MediaProviderId } from './catalog.ts';
import type { GenerateInput } from './validate.ts';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ProviderConfig {
  googleApiKey?: string;
  higgsfieldKeyId?: string;
  higgsfieldKeySecret?: string;
  /** Env-Overrides: envModel-Name → Modell-ID. */
  modelOverrides: Record<string, string | undefined>;
  /** Timeout pro Anbieteraufruf. */
  timeoutMs?: number;
}

export interface GeneratedAsset {
  kind: MediaKind;
  mime_type: string;
  data_base64?: string;
  url?: string;
}

export type ProviderFailureCode =
  | 'PROVIDER_ERROR'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_RATE_LIMITED'
  | 'CONTENT_REJECTED';

export type ProviderResult =
  | { status: 'completed'; model: string; assets: GeneratedAsset[]; provider_request_id?: string }
  | { status: 'pending'; model: string; provider_request_id: string }
  | { status: 'failed'; code: ProviderFailureCode; message: string; retryable: boolean };

export const GOOGLE_BASE = 'https://generativelanguage.googleapis.com/v1beta';
export const GOOGLE_API_REVISION = '2026-05-20';
export const HIGGSFIELD_BASE = 'https://api.higgsfield.ai';
const DEFAULT_TIMEOUT_MS = 140_000;
const REQUEST_ID_RE = /^[A-Za-z0-9-]{8,80}$/;
const MODEL_PATH_RE = /^[a-z0-9][a-z0-9._/-]{2,120}$/i;

export function resolveModelId(model: MediaModel, cfg: ProviderConfig): string {
  const override = cfg.modelOverrides[model.envModel]?.trim();
  return override || model.defaultModelId;
}

export function providerConfigured(provider: MediaProviderId, cfg: ProviderConfig): boolean {
  if (provider === 'google') return Boolean(cfg.googleApiKey);
  return Boolean(cfg.higgsfieldKeyId && cfg.higgsfieldKeySecret);
}

/** Modell nutzbar = Anbieter konfiguriert + Modell-ID vorhanden und gültig. */
export function modelAvailable(model: MediaModel, cfg: ProviderConfig): boolean {
  if (!providerConfigured(model.provider, cfg)) return false;
  const id = resolveModelId(model, cfg);
  return Boolean(id) && MODEL_PATH_RE.test(id);
}

function failed(code: ProviderFailureCode, message: string, retryable: boolean): ProviderResult {
  return { status: 'failed', code, message: message.slice(0, 300), retryable };
}

function fromHttpStatus(status: number, detail: string): ProviderResult {
  if (status === 429) return failed('PROVIDER_RATE_LIMITED', 'Anbieter-Limit erreicht. Später erneut versuchen.', true);
  if (status >= 500) return failed('PROVIDER_ERROR', `Anbieterfehler ${status}.`, true);
  if (status === 400 && /safety|block|policy|nsfw|prohibit/i.test(detail)) {
    return failed('CONTENT_REJECTED', 'Der Anbieter hat den Inhalt abgelehnt.', false);
  }
  return failed('PROVIDER_ERROR', `Anbieter lehnte ab (${status}): ${detail}`, false);
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return '';
  }
}

async function timedFetch(fetchImpl: FetchLike, url: string, init: RequestInit, timeoutMs: number): Promise<Response | 'timeout'> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return 'timeout';
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function withNegative(prompt: string, negative?: string): string {
  return negative ? `${prompt}\n\nAvoid: ${negative}` : prompt;
}

// ─── Google Gemini API (Interactions) ──────────────────────────────────────

export function buildGoogleBody(input: GenerateInput, modelId: string): Record<string, unknown> {
  const text = withNegative(composeProviderPrompt(input.prompt, input.camera), input.negative_prompt);
  const parts: Record<string, unknown>[] = [];
  if (input.reference?.data_base64) {
    parts.push({ type: 'image', data: input.reference.data_base64, mime_type: input.reference.mime_type });
  }
  parts.push({ type: 'text', text });

  const response_format: Record<string, unknown> =
    input.kind === 'image'
      ? { type: 'image', mime_type: 'image/png', aspect_ratio: input.aspect_ratio }
      : {
          type: 'video',
          aspect_ratio: input.aspect_ratio,
          resolution: input.resolution ?? '720p',
          duration: `${input.duration_s}s`,
          delivery: 'inline',
        };
  return { model: modelId, input: parts, response_format };
}

/** Sucht Medien in der Interactions-Antwort (REST: `steps[].content[]`). */
export function extractGoogleAssets(json: unknown, kind: MediaKind): GeneratedAsset[] {
  const out: GeneratedAsset[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const o = node as Record<string, unknown>;
    if (o.type === kind && typeof o.data === 'string' && o.data.length > 0) {
      out.push({
        kind,
        mime_type: typeof o.mime_type === 'string' ? o.mime_type : kind === 'image' ? 'image/png' : 'video/mp4',
        data_base64: o.data,
      });
      return;
    }
    for (const v of Object.values(o)) if (v && typeof v === 'object') visit(v);
  };
  const root = json as Record<string, unknown> | null;
  visit(root?.steps);
  if (out.length === 0) {
    // SDK-Komfortfelder, falls die REST-Antwort sie mitliefert.
    const conv = (root?.[kind === 'image' ? 'output_image' : 'output_video'] ?? null) as Record<string, unknown> | null;
    if (conv && typeof conv.data === 'string') {
      out.push({ kind, mime_type: (conv.mime_type as string) ?? (kind === 'image' ? 'image/png' : 'video/mp4'), data_base64: conv.data });
    }
  }
  return out;
}

async function generateGoogle(input: GenerateInput, model: MediaModel, cfg: ProviderConfig, fetchImpl: FetchLike): Promise<ProviderResult> {
  const modelId = resolveModelId(model, cfg);
  const res = await timedFetch(
    fetchImpl,
    `${GOOGLE_BASE}/interactions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': cfg.googleApiKey ?? '',
        'Api-Revision': GOOGLE_API_REVISION,
      },
      body: JSON.stringify(buildGoogleBody(input, modelId)),
    },
    cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  if (res === 'timeout') return failed('PROVIDER_TIMEOUT', 'Google hat nicht rechtzeitig geantwortet.', true);
  if (!res.ok) return fromHttpStatus(res.status, await safeText(res));

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return failed('PROVIDER_ERROR', 'Antwort von Google war kein JSON.', true);
  }
  const assets = extractGoogleAssets(json, input.kind);
  if (assets.length === 0) {
    return failed('CONTENT_REJECTED', 'Google hat kein Medium geliefert (möglicherweise Inhaltsfilter).', false);
  }
  const id = (json as Record<string, unknown>)?.id;
  return { status: 'completed', model: modelId, assets, provider_request_id: typeof id === 'string' ? id : undefined };
}

// ─── Higgsfield API ────────────────────────────────────────────────────────

function higgsfieldAuth(cfg: ProviderConfig): string {
  return `Key ${cfg.higgsfieldKeyId}:${cfg.higgsfieldKeySecret}`;
}

export function buildHiggsfieldBody(input: GenerateInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    prompt: withNegative(composeProviderPrompt(input.prompt, input.camera), input.negative_prompt),
    aspect_ratio: input.aspect_ratio,
  };
  if (input.kind === 'video') body.duration = input.duration_s;
  if (input.reference?.url) body.image_url = input.reference.url;
  return body;
}

async function submitHiggsfield(input: GenerateInput, model: MediaModel, cfg: ProviderConfig, fetchImpl: FetchLike): Promise<ProviderResult> {
  const modelPath = resolveModelId(model, cfg);
  if (!modelPath || !MODEL_PATH_RE.test(modelPath)) {
    return failed('PROVIDER_ERROR', 'Higgsfield-Modell ist nicht konfiguriert.', false);
  }
  const res = await timedFetch(
    fetchImpl,
    `${HIGGSFIELD_BASE}/${modelPath}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: higgsfieldAuth(cfg) },
      body: JSON.stringify(buildHiggsfieldBody(input)),
    },
    30_000,
  );
  if (res === 'timeout') return failed('PROVIDER_TIMEOUT', 'Higgsfield hat nicht rechtzeitig geantwortet.', true);
  if (!res.ok) return fromHttpStatus(res.status, await safeText(res));
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const requestId = json?.request_id;
  if (typeof requestId !== 'string' || !REQUEST_ID_RE.test(requestId)) {
    return failed('PROVIDER_ERROR', 'Higgsfield lieferte keine gültige request_id.', false);
  }
  return mapHiggsfieldStatus(json!, input.kind, modelPath, requestId);
}

export function mapHiggsfieldStatus(
  json: Record<string, unknown>,
  kind: MediaKind,
  model: string,
  requestId: string,
): ProviderResult {
  const status = json.status;
  switch (status) {
    case 'queued':
    case 'in_progress':
      return { status: 'pending', model, provider_request_id: requestId };
    case 'completed': {
      const assets: GeneratedAsset[] = [];
      if (kind === 'image' && Array.isArray(json.images)) {
        for (const img of json.images as Record<string, unknown>[]) {
          if (typeof img?.url === 'string' && img.url.startsWith('https://')) {
            assets.push({ kind: 'image', mime_type: 'image/*', url: img.url });
          }
        }
      }
      const video = json.video as Record<string, unknown> | undefined;
      if (kind === 'video' && typeof video?.url === 'string' && video.url.startsWith('https://')) {
        assets.push({ kind: 'video', mime_type: 'video/mp4', url: video.url });
      }
      if (assets.length === 0) return failed('PROVIDER_ERROR', 'Higgsfield meldet fertig, aber ohne Ergebnis-URL.', false);
      return { status: 'completed', model, assets, provider_request_id: requestId };
    }
    case 'nsfw':
      return failed('CONTENT_REJECTED', 'Higgsfield hat den Inhalt abgelehnt (Moderation).', false);
    case 'canceled':
      return failed('PROVIDER_ERROR', 'Auftrag wurde abgebrochen.', false);
    case 'failed':
      return failed('PROVIDER_ERROR', `Higgsfield-Auftrag fehlgeschlagen${typeof json.error === 'string' ? `: ${json.error}` : '.'}`, false);
    default:
      return failed('PROVIDER_ERROR', `Unbekannter Higgsfield-Status: ${String(status)}`, false);
  }
}

export async function pollHiggsfield(
  requestId: string,
  kind: MediaKind,
  model: string,
  cfg: ProviderConfig,
  fetchImpl: FetchLike,
): Promise<ProviderResult> {
  if (!REQUEST_ID_RE.test(requestId)) return failed('PROVIDER_ERROR', 'Ungültige request_id.', false);
  const res = await timedFetch(
    fetchImpl,
    `${HIGGSFIELD_BASE}/requests/${requestId}/status`,
    { method: 'GET', headers: { Accept: 'application/json', Authorization: higgsfieldAuth(cfg) } },
    20_000,
  );
  if (res === 'timeout') return failed('PROVIDER_TIMEOUT', 'Statusabfrage zeitlich überschritten.', true);
  if (!res.ok) return fromHttpStatus(res.status, await safeText(res));
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!json) return failed('PROVIDER_ERROR', 'Statusantwort war kein JSON.', true);
  return mapHiggsfieldStatus(json, kind, model, requestId);
}

// ─── Einstieg ──────────────────────────────────────────────────────────────

export async function generateWithProvider(
  input: GenerateInput,
  model: MediaModel,
  cfg: ProviderConfig,
  fetchImpl: FetchLike,
): Promise<ProviderResult> {
  if (!modelAvailable(model, cfg)) {
    return failed('PROVIDER_ERROR', `${model.label} ist nicht konfiguriert.`, false);
  }
  return input.provider === 'google'
    ? generateGoogle(input, model, cfg, fetchImpl)
    : submitHiggsfield(input, model, cfg, fetchImpl);
}
