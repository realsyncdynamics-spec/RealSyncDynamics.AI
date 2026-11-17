/**
 * Browser-Client für die Edge Function `media-studio`.
 * Hält keine Anbieter-Schlüssel. Mandant wird mitgeschickt und serverseitig
 * gegen die Mitgliedschaft geprüft (nie vertraut).
 */
import { getSupabase } from '../../lib/supabase';
import type { CameraPreset } from '../../../supabase/functions/_shared/mediaStudio/catalog';
import type { ModelAvailability, StudioAsset } from './agent/planner';
import type { GenerateOutcome, GenerateRequest, StudioTools } from './agent/runner';

export interface Capabilities {
  residency: 'cloud' | 'eu_local';
  models: (ModelAvailability & { model: string | null })[];
  camera_presets: CameraPreset[];
}

export type CapabilitiesResult = { ok: true; data: Capabilities } | { ok: false; code: string; message: string };

interface ErrorBody {
  error?: { code?: string; message?: string; details?: { retryable?: boolean; retry_after_ms?: number } };
}

async function readError(error: unknown): Promise<{ status: number; body: ErrorBody }> {
  const ctx = (error as { context?: Response }).context;
  const status = ctx?.status ?? 0;
  let body: ErrorBody = {};
  try {
    if (ctx && typeof ctx.json === 'function') body = (await ctx.clone().json()) as ErrorBody;
  } catch {
    body = {};
  }
  return { status, body };
}

function friendly(status: number, code: string | undefined, message: string | undefined): string {
  if (status === 404) return 'Media Studio ist auf dem Server noch nicht ausgerollt.';
  if (code === 'MEDIA_STUDIO_DISABLED') return 'Media Studio ist serverseitig abgeschaltet.';
  return message ?? 'Unbekannter Fehler.';
}

export async function fetchCapabilities(tenantId: string): Promise<CapabilitiesResult> {
  const { data, error } = await getSupabase().functions.invoke('media-studio', {
    body: { op: 'capabilities', tenant_id: tenantId },
  });
  if (error) {
    const { status, body } = await readError(error);
    const code = body.error?.code ?? `HTTP_${status || 'NETWORK'}`;
    return { ok: false, code, message: friendly(status, body.error?.code, body.error?.message) };
  }
  return { ok: true, data: data as Capabilities };
}

async function call(tenantId: string, payload: Record<string, unknown>): Promise<GenerateOutcome> {
  const { data, error } = await getSupabase().functions.invoke('media-studio', {
    body: { tenant_id: tenantId, ...payload },
  });
  if (error) {
    const { status, body } = await readError(error);
    const code = body.error?.code ?? `HTTP_${status || 'NETWORK'}`;
    const retryable = body.error?.details?.retryable ?? (status === 0 || status === 429 || status >= 500);
    return {
      kind: 'error',
      code,
      message: friendly(status, body.error?.code, body.error?.message),
      retryable: Boolean(retryable) && code !== 'MEDIA_STUDIO_DISABLED',
      retryAfterMs: body.error?.details?.retry_after_ms,
    };
  }
  const d = data as { status: string; request_id: string; job_id: string; assets?: unknown[] };
  if (d.status === 'pending') return { kind: 'pending', jobId: d.job_id, requestId: d.request_id };
  return {
    kind: 'completed',
    assets: (d.assets ?? []) as StudioAsset[],
    jobId: d.job_id,
    requestId: d.request_id,
  };
}

export function createStudioTools(tenantId: string): StudioTools {
  return {
    generate: (req: GenerateRequest) => call(tenantId, { op: 'generate', input: req }),
    status: (jobId: string) => call(tenantId, { op: 'status', job_id: jobId }),
    sleep: (ms, signal) =>
      new Promise<void>((resolve) => {
        const t = setTimeout(resolve, ms);
        signal?.addEventListener('abort', () => {
          clearTimeout(t);
          resolve();
        }, { once: true });
      }),
    now: () => Date.now(),
  };
}

/** Signierter Link aus dem privaten Bucket (zeitlich begrenzt gültig). */
export function assetSrc(a: { url: string }): string {
  return a.url;
}
