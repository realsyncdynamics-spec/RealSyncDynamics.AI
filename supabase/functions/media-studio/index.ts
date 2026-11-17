// media-studio — Deno-Verdrahtung. Logik und Gates: handler.ts (vitest-getestet).
//
// Edge-Secrets (alle serverseitig, nie im Browser-Bundle):
//   MEDIA_STUDIO_ENABLED        'true' schaltet frei; alles andere = aus (Default aus)
//   GEMINI_API_KEY              Google Gemini API (AI Studio)
//   HIGGSFIELD_API_KEY_ID / HIGGSFIELD_API_KEY_SECRET
//   MEDIA_GOOGLE_IMAGE_MODEL, MEDIA_GOOGLE_VIDEO_MODEL,
//   MEDIA_HIGGSFIELD_IMAGE_MODEL, MEDIA_HIGGSFIELD_VIDEO_MODEL   optionale Modell-Overrides
//
// Datenbank: Migration 20261117180000_media_studio_jobs.sql (media_jobs,
// media_studio_limits, RPCs media_job_reserve/media_job_transition, Bucket
// media-studio). Ohne angewendete Migration scheitert die Reservierung →
// 503 BUDGET_UNAVAILABLE, es wird nichts generiert.
//
// Wirkt erst nach `supabase functions deploy media-studio` (Deploy-Freigabe nötig).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildCorsHeaders } from '../_shared/gateway.ts';
import { requireAuthAndTenant } from '../_shared/auth.ts';
import { gateFeature } from '../_shared/entitlements.ts';
import { requireVerifiedAiResidency } from '../_shared/residencyGuard.ts';
import { recordAiCallEvidence } from '../_shared/aiGateway/callEvidence.ts';
import { sha256Hex } from '../_shared/hash.ts';
import type { WindowState } from '../_shared/aiGateway/rateLimit.ts';
import { MEDIA_MAX_BYTES, MEDIA_MODELS } from '../_shared/mediaStudio/catalog.ts';
import { assetPath, base64ToBytes, bytesToBase64, checkMedia, sniffMime } from '../_shared/mediaStudio/media.ts';
import { createMediaStudioHandler, type JobRow, type MediaStore, type Residency } from './handler.ts';

const BUCKET = 'media-studio';
const MINUTE_WINDOWS = new Map<string, WindowState>();
const HOUR_WINDOWS = new Map<string, WindowState>();

// deno-lint-ignore no-explicit-any
let admin: any | null = null;
// deno-lint-ignore no-explicit-any
function getAdmin(): any {
  if (admin) return admin;
  const url = Deno.env.get('SUPABASE_URL');
  const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !srk) throw new Error('admin client not configured');
  admin = createClient(url, srk, { auth: { persistSession: false } });
  return admin;
}

/** Lädt ein Anbieter-Ergebnis (nur https) mit Größenlimit herunter. */
async function download(url: string): Promise<Uint8Array> {
  if (!url.startsWith('https://')) throw new Error('insecure url');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok || !res.body) throw new Error(`download ${res.status}`);
    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MEDIA_MAX_BYTES) throw new Error('too large');
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MEDIA_MAX_BYTES) throw new Error('too large');
      chunks.push(value);
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.length;
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}

const store: MediaStore = {
  async reserve(a) {
    const { data, error } = await getAdmin().rpc('media_job_reserve', {
      p_tenant_id: a.tenantId,
      p_user_id: a.userId,
      p_kind: a.kind,
      p_provider: a.provider,
      p_model: a.model,
      p_units: a.units,
      p_idempotency_key: a.idempotencyKey,
      p_params: a.params,
    });
    if (error || !data || typeof data !== 'object') throw new Error(`reserve: ${error?.message ?? 'no data'}`);
    if (data.ok === true) return { ok: true, jobId: data.job_id, replay: Boolean(data.replay), status: data.status };
    return { ok: false, code: String(data.code ?? 'UNKNOWN'), used: data.used, limit: data.limit };
  },
  async transition(jobId, tenantId, status, patch = {}) {
    const { data, error } = await getAdmin().rpc('media_job_transition', {
      p_job_id: jobId,
      p_tenant_id: tenantId,
      p_status: status,
      p_provider_request_id: patch.providerRequestId ?? null,
      p_asset_paths: patch.assetPaths ?? null,
      p_error_code: patch.errorCode ?? null,
    });
    if (error) throw new Error(`transition: ${error.message}`);
    return data === true;
  },
  async loadJob(jobId, tenantId) {
    const { data, error } = await getAdmin()
      .from('media_jobs')
      .select('id, tenant_id, kind, provider, model, status, provider_request_id, asset_paths')
      .eq('id', jobId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw new Error(`loadJob: ${error.message}`);
    return (data as JobRow | null) ?? null;
  },
  async putAsset(tenantId, jobId, index, asset) {
    const bytes = asset.data_base64 ? base64ToBytes(asset.data_base64) : await download(asset.url ?? '');
    const { mime, ext } = checkMedia(bytes, asset.kind);
    const path = assetPath(tenantId, jobId, index, ext);
    const { error } = await getAdmin().storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
    if (error) throw new Error(`upload: ${error.message}`);
    return path;
  },
  async signedUrl(path, ttl) {
    const { data, error } = await getAdmin().storage.from(BUCKET).createSignedUrl(path, ttl);
    if (error || !data?.signedUrl) throw new Error(`sign: ${error?.message ?? 'no url'}`);
    return data.signedUrl as string;
  },
  async readAsset(path) {
    const { data, error } = await getAdmin().storage.from(BUCKET).download(path);
    if (error || !data) throw new Error(`download: ${error?.message ?? 'no data'}`);
    const bytes = new Uint8Array(await data.arrayBuffer());
    const mime = sniffMime(bytes);
    if (!mime || mime === 'video/mp4') throw new Error('reference is not an image');
    return { mime_type: mime, data_base64: bytesToBase64(bytes) };
  },
};

Deno.serve(
  createMediaStudioHandler({
    cors: buildCorsHeaders('POST, OPTIONS'),
    enabled: () => (Deno.env.get('MEDIA_STUDIO_ENABLED') ?? '').toLowerCase() === 'true',
    authenticate: async (req, clientTenantId) => {
      const auth = await requireAuthAndTenant(req, typeof clientTenantId === 'string' ? clientTenantId : null);
      if (auth instanceof Response) return auth;
      return { userId: auth.user.id, tenantId: auth.tenantId };
    },
    hasEntitlement: async (tenantId) => {
      try {
        await gateFeature(getAdmin(), tenantId, 'siteos.builder');
        return true;
      } catch {
        return false;
      }
    },
    resolveResidency: async (tenantId, userId): Promise<Residency> => {
      const result = await getAdmin().rpc('resolve_ai_residency', { p_tenant_id: tenantId, p_user_id: userId });
      return requireVerifiedAiResidency(result);
    },
    providerConfig: () => ({
      googleApiKey: Deno.env.get('GEMINI_API_KEY') ?? undefined,
      higgsfieldKeyId: Deno.env.get('HIGGSFIELD_API_KEY_ID') ?? undefined,
      higgsfieldKeySecret: Deno.env.get('HIGGSFIELD_API_KEY_SECRET') ?? undefined,
      modelOverrides: Object.fromEntries(MEDIA_MODELS.map((m) => [m.envModel, Deno.env.get(m.envModel) ?? undefined])),
    }),
    store,
    fetch: (input, init) => fetch(input, init),
    recordEvidence: (row) => recordAiCallEvidence(getAdmin(), row),
    sha256: (text) => sha256Hex(text),
    now: () => Date.now(),
    requestId: () => crypto.randomUUID(),
    minuteWindows: MINUTE_WINDOWS,
    hourWindows: HOUR_WINDOWS,
    log: (entry) => console.log(JSON.stringify(entry)),
  }),
);
