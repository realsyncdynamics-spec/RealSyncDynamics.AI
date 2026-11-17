// media-studio: Gates, Kontingent-Reservierung, Aufträge, private Ablage, Anbieter-Mapping.
// Handler ist Deno-frei; Auth, Entitlement, Residency, Evidence, Store und fetch sind Fakes.
// Der Fake-Store bildet die Regeln der Migration 20261117180000_media_studio_jobs.sql nach.

import { describe, it, expect, vi } from 'vitest';
import {
  createMediaStudioHandler,
  type JobRow,
  type JobStatus,
  type MediaStore,
  type MediaStudioDeps,
  type VerifiedPrincipal,
} from '../../supabase/functions/media-studio/handler.ts';
import { validateGenerateInput } from '../../supabase/functions/_shared/mediaStudio/validate.ts';
import {
  buildGoogleBody,
  extractGoogleAssets,
  mapHiggsfieldStatus,
} from '../../supabase/functions/_shared/mediaStudio/providers.ts';
import { composeProviderPrompt, mediaUnits } from '../../supabase/functions/_shared/mediaStudio/catalog.ts';
import { assetPath, checkMedia, sniffMime } from '../../supabase/functions/_shared/mediaStudio/media.ts';

const T1 = '11111111-1111-4111-8111-111111111111';
const T2 = '22222222-2222-4222-8222-222222222222';
const URL_FN = 'https://x.supabase.co/functions/v1/media-studio';

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Fake der RPCs + Bucket; Regeln wie in der Migration. */
function fakeStore(limits: Record<string, number> = { [T1]: 100, [T2]: 100 }) {
  const jobs = new Map<string, JobRow & { units: number; key: string; error_code?: string }>();
  const files = new Map<string, string>();
  let seq = 0;
  const counts = (j: { status: JobStatus; error_code?: string }) =>
    ['reserved', 'submitted', 'completed'].includes(j.status) ||
    (j.status === 'failed' && ['PROVIDER_TIMEOUT', 'STORAGE_FAILED'].includes(j.error_code ?? ''));
  const store: MediaStore & { jobs: typeof jobs; files: typeof files; used(t: string): number } = {
    jobs,
    files,
    used: (t) => [...jobs.values()].filter((j) => j.tenant_id === t && counts(j)).reduce((n, j) => n + j.units, 0),
    async reserve(a) {
      const existing = [...jobs.values()].find((j) => j.tenant_id === a.tenantId && j.key === a.idempotencyKey);
      if (existing) return { ok: true, jobId: existing.id, replay: true, status: existing.status };
      const limit = limits[a.tenantId] ?? 0;
      const used = store.used(a.tenantId);
      if (used + a.units > limit) return { ok: false, code: 'BUDGET_EXCEEDED', used, limit };
      const id = `aaaaaaaa-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
      jobs.set(id, { id, tenant_id: a.tenantId, kind: a.kind, provider: a.provider, model: a.model, status: 'reserved', provider_request_id: null, asset_paths: [], units: a.units, key: a.idempotencyKey });
      return { ok: true, jobId: id, replay: false, status: 'reserved' };
    },
    async transition(id, tenantId, status, patch = {}) {
      const j = jobs.get(id);
      if (!j || j.tenant_id !== tenantId) return false;
      const allowed = (j.status === 'reserved' && ['submitted', 'completed', 'failed', 'released'].includes(status)) ||
        (j.status === 'submitted' && ['completed', 'failed'].includes(status));
      if (!allowed) return false;
      j.status = status;
      if (patch.providerRequestId) j.provider_request_id = patch.providerRequestId;
      if (patch.assetPaths) j.asset_paths = patch.assetPaths;
      if (patch.errorCode) j.error_code = patch.errorCode;
      return true;
    },
    async loadJob(id, tenantId) {
      const j = jobs.get(id);
      return j && j.tenant_id === tenantId ? { ...j } : null;
    },
    async putAsset(tenantId, jobId, index, asset) {
      const path = assetPath(tenantId, jobId, index, asset.kind === 'video' ? 'mp4' : 'png');
      files.set(path, asset.data_base64 ?? asset.url ?? '');
      return path;
    },
    async signedUrl(path, ttl) {
      return `https://storage.example/sign/${path}?ttl=${ttl}`;
    },
    async readAsset(path) {
      return { mime_type: 'image/png', data_base64: files.get(path) ?? '' };
    },
  };
  return store;
}

type Overrides = Partial<MediaStudioDeps> & { principal?: VerifiedPrincipal | Response };

function makeDeps(o: Overrides = {}) {
  const evidence: unknown[] = [];
  const order: string[] = [];
  const store = (o.store as ReturnType<typeof fakeStore>) ?? fakeStore();
  const fetchMock = vi.fn(async (url: string) => {
    order.push('provider');
    if (url.includes('generativelanguage')) {
      return jsonRes({ id: 'int-1', steps: [{ type: 'model_output', content: [
        { type: 'image', data: 'QUJD', mime_type: 'image/png' },
        { type: 'video', data: 'AAAA', mime_type: 'video/mp4' },
      ] }] });
    }
    if (url.endsWith('/status')) return jsonRes({ status: 'completed', images: [{ url: 'https://cdn.example.com/a.jpg' }] });
    return jsonRes({ request_id: 'd7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff', status: 'queued' });
  });
  const deps: MediaStudioDeps = {
    cors: {},
    enabled: () => true,
    authenticate: async () => o.principal ?? { userId: 'u1', tenantId: T1 },
    hasEntitlement: async () => true,
    resolveResidency: async () => 'cloud',
    providerConfig: () => ({ googleApiKey: 'g-key', higgsfieldKeyId: 'id', higgsfieldKeySecret: 'secret', modelOverrides: {} }),
    store,
    fetch: fetchMock as unknown as MediaStudioDeps['fetch'],
    recordEvidence: async (row) => {
      order.push('evidence');
      evidence.push(row);
    },
    sha256: async (t) => `sha:${t.length}`,
    now: () => 1_000_000,
    requestId: () => 'req-1',
    minuteWindows: new Map(),
    hourWindows: new Map(),
    log: () => {},
    ...o,
  };
  return { deps, evidence, fetchMock, store, order };
}

function post(body: unknown): Request {
  return new Request(URL_FN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

let keySeq = 0;
const key = () => `run-test:img-1:${++keySeq}`;
const imageInput = () => ({ kind: 'image', provider: 'google', prompt: 'Dachdecker auf einem Steildach bei Sonnenaufgang', aspect_ratio: '16:9', idempotency_key: key() });
const videoFrom = (jobId: string, provider = 'google') => ({
  kind: 'video', provider, prompt: 'Kamerafahrt über das Dach', aspect_ratio: '16:9', duration_s: 5, idempotency_key: key(),
  reference: { job_id: jobId, index: 0 },
});

describe('media-studio gates', () => {
  it('Kill-Switch aus → 503, kein Anbieteraufruf', async () => {
    const { deps, fetchMock } = makeDeps({ enabled: () => false });
    const res = await createMediaStudioHandler(deps)(post({ op: 'generate', tenant_id: T1, input: imageInput() }));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('MEDIA_STUDIO_DISABLED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Auth-Fehler wird durchgereicht (fremder Mandant → 403)', async () => {
    const { deps, fetchMock } = makeDeps({ principal: jsonRes({ ok: false }, 403) });
    const res = await createMediaStudioHandler(deps)(post({ op: 'generate', tenant_id: T2, input: imageInput() }));
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ohne Entitlement → 403; Entitlement-Fehler gilt als nicht berechtigt', async () => {
    const { deps } = makeDeps({ hasEntitlement: async () => { throw new Error('db down'); } });
    const res = await createMediaStudioHandler(deps)(post({ op: 'capabilities', tenant_id: T1 }));
    expect(res.status).toBe(403);
  });

  it('Residency nicht prüfbar → 503', async () => {
    const { deps, fetchMock } = makeDeps({ resolveResidency: async () => { throw new Error('rpc'); } });
    const res = await createMediaStudioHandler(deps)(post({ op: 'generate', tenant_id: T1, input: imageInput() }));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('RESIDENCY_UNAVAILABLE');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('eu_local-Mandant → 403, Block-Evidence, keine Reservierung', async () => {
    const { deps, fetchMock, evidence, store } = makeDeps({ resolveResidency: async () => 'eu_local' });
    const res = await createMediaStudioHandler(deps)(post({ op: 'generate', tenant_id: T1, input: imageInput() }));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('RESIDENCY_EU_LOCAL');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.jobs.size).toBe(0);
    expect((evidence[0] as { event_type: string }).event_type).toBe('ai:call_blocked');
  });

  it('PII im Prompt → 422, kein Anbieteraufruf, keine Reservierung', async () => {
    const { deps, fetchMock, store } = makeDeps();
    const res = await createMediaStudioHandler(deps)(
      post({ op: 'generate', tenant_id: T1, input: { ...imageInput(), prompt: 'Visitenkarte mit max@example.com' } }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('PII_IN_PROMPT');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.jobs.size).toBe(0);
  });

  it('ohne Kontingentzeile (Limit 0) → 402, kein Anbieteraufruf (fail-closed)', async () => {
    const { deps, fetchMock } = makeDeps({ store: fakeStore({}) });
    const res = await createMediaStudioHandler(deps)(post({ op: 'generate', tenant_id: T1, input: imageInput() }));
    expect(res.status).toBe(402);
    expect((await res.json()).error.code).toBe('BUDGET_EXCEEDED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Reservierung nicht möglich (RPC-Fehler) → 503, kein Anbieteraufruf', async () => {
    const store = fakeStore();
    store.reserve = async () => { throw new Error('function media_job_reserve does not exist'); };
    const { deps, fetchMock } = makeDeps({ store });
    const res = await createMediaStudioHandler(deps)(post({ op: 'generate', tenant_id: T1, input: imageInput() }));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('BUDGET_UNAVAILABLE');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Video-Kontingent zählt Sekunden: 8-s-Video bei Restkontingent 5 → 402', async () => {
    const { deps, fetchMock } = makeDeps({ store: fakeStore({ [T1]: 5 }) });
    const input = { kind: 'video', provider: 'google', prompt: 'Handwerker montiert Solarmodul', aspect_ratio: '16:9', duration_s: 8, idempotency_key: key() };
    const res = await createMediaStudioHandler(deps)(post({ op: 'generate', tenant_id: T1, input }));
    expect(res.status).toBe(402);
    expect((await res.json()).error.details).toMatchObject({ needed: 8, limit: 5 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Evidence-Fehler → 503, Reservierung freigegeben, kein Anbieteraufruf', async () => {
    const { deps, fetchMock, store } = makeDeps({ recordEvidence: async () => { throw new Error('insert failed'); } });
    const res = await createMediaStudioHandler(deps)(post({ op: 'generate', tenant_id: T1, input: imageInput() }));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('EVIDENCE_UNAVAILABLE');
    expect(fetchMock).not.toHaveBeenCalled();
    expect([...store.jobs.values()][0].status).toBe('released');
    expect(store.used(T1)).toBe(0);
  });

  it('Rate-Limit Video: drittes Video in einer Minute → 429', async () => {
    const { deps } = makeDeps({
      fetch: (async () => jsonRes({ steps: [{ content: [{ type: 'video', data: 'AAAA', mime_type: 'video/mp4' }] }] })) as MediaStudioDeps['fetch'],
    });
    const handle = createMediaStudioHandler(deps);
    const video = () => ({ kind: 'video', provider: 'google', prompt: 'Handwerker montiert Solarmodul', aspect_ratio: '16:9', duration_s: 4, idempotency_key: key() });
    expect((await handle(post({ op: 'generate', tenant_id: T1, input: video() }))).status).toBe(200);
    expect((await handle(post({ op: 'generate', tenant_id: T1, input: video() }))).status).toBe(200);
    expect((await handle(post({ op: 'generate', tenant_id: T1, input: video() }))).status).toBe(429);
  });
});

describe('media-studio Aufträge und Ablage', () => {
  it('Google Bild: Evidence vor Anbieter, Ergebnis privat gespeichert, Browser bekommt nur signierte URL', async () => {
    const { deps, evidence, fetchMock, store, order } = makeDeps();
    const res = await createMediaStudioHandler(deps)(post({ op: 'generate', tenant_id: T1, input: imageInput() }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('completed');
    expect(order).toEqual(['evidence', 'provider']);
    const job = store.jobs.get(body.job_id)!;
    expect(job.status).toBe('completed');
    expect(job.asset_paths).toEqual([`${T1}/${body.job_id}/0.png`]);
    expect(body.assets[0]).toEqual({ kind: 'image', mime_type: 'image/png', url: `https://storage.example/sign/${T1}/${body.job_id}/0.png?ttl=3600`, job_id: body.job_id, index: 0 });
    expect(JSON.stringify(body)).not.toContain('QUJD');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain('key=');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('g-key');
    expect(JSON.stringify(evidence[0])).not.toContain('Dachdecker');
    expect(JSON.stringify(job)).not.toContain('Dachdecker');
  });

  it('gleicher Idempotenz-Schlüssel → kein zweiter Anbieteraufruf, gleiches Ergebnis', async () => {
    const { deps, fetchMock } = makeDeps();
    const handle = createMediaStudioHandler(deps);
    const input = imageInput();
    const first = await (await handle(post({ op: 'generate', tenant_id: T1, input }))).json();
    const second = await (await handle(post({ op: 'generate', tenant_id: T1, input }))).json();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.replay).toBe(true);
    expect(second.job_id).toBe(first.job_id);
  });

  it('Referenz: eigenes fertiges Bild ok; fremder Mandant oder Video als Referenz → 403', async () => {
    const store = fakeStore();
    const { deps } = makeDeps({ store });
    const handle = createMediaStudioHandler(deps);
    const img = await (await handle(post({ op: 'generate', tenant_id: T1, input: imageInput() }))).json();

    const own = await handle(post({ op: 'generate', tenant_id: T1, input: videoFrom(img.job_id) }));
    expect(own.status).toBe(200);
    const vid = await own.json();

    const notImage = await handle(post({ op: 'generate', tenant_id: T1, input: videoFrom(vid.job_id) }));
    expect(notImage.status).toBe(403);

    const stranger = makeDeps({ store, principal: { userId: 'u2', tenantId: T2 } });
    const foreign = await createMediaStudioHandler(stranger.deps)(post({ op: 'generate', tenant_id: T2, input: videoFrom(img.job_id) }));
    expect(foreign.status).toBe(403);
    expect((await foreign.json()).error.code).toBe('REFERENCE_NOT_FOUND');
    expect(stranger.fetchMock).not.toHaveBeenCalled();
  });

  it('Referenzbild geht inline an Google (aus dem Bucket, nicht aus dem Request)', async () => {
    const { deps, fetchMock } = makeDeps();
    const handle = createMediaStudioHandler(deps);
    const img = await (await handle(post({ op: 'generate', tenant_id: T1, input: imageInput() }))).json();
    await handle(post({ op: 'generate', tenant_id: T1, input: videoFrom(img.job_id) }));
    const last = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as unknown as [string, RequestInit];
    const body = JSON.parse(last[1].body as string);
    expect(body.input[0]).toEqual({ type: 'image', data: 'QUJD', mime_type: 'image/png' });
  });

  it('Higgsfield: submitted mit job_id; Status nur für eigenen Mandanten; Ergebnis wird abgelegt', async () => {
    const store = fakeStore();
    const { deps, fetchMock } = makeDeps({ store });
    const handle = createMediaStudioHandler(deps);
    const res = await handle(post({ op: 'generate', tenant_id: T1, input: { ...imageInput(), provider: 'higgsfield' } }));
    const body = await res.json();
    expect(body.status).toBe('pending');
    expect(store.jobs.get(body.job_id)!.status).toBe('submitted');
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Key id:secret');

    const stranger = makeDeps({ store, principal: { userId: 'u2', tenantId: T2 } });
    const denied = await createMediaStudioHandler(stranger.deps)(post({ op: 'status', tenant_id: T2, job_id: body.job_id }));
    expect(denied.status).toBe(404);
    expect(stranger.fetchMock).not.toHaveBeenCalled();

    const done = await (await handle(post({ op: 'status', tenant_id: T1, job_id: body.job_id }))).json();
    expect(done.status).toBe('completed');
    expect(done.assets[0].url).toContain(`${T1}/${body.job_id}/0`);
    expect(done.assets[0].url).not.toContain('cdn.example.com');
    expect(store.jobs.get(body.job_id)!.status).toBe('completed');
  });

  it('Anbieter-Timeout bleibt angerechnet, Inhaltsfilter gibt frei', async () => {
    const timeoutStore = fakeStore();
    const t = makeDeps({ store: timeoutStore, fetch: (async () => { throw new Error('socket hang up'); }) as MediaStudioDeps['fetch'] });
    const r1 = await createMediaStudioHandler(t.deps)(post({ op: 'generate', tenant_id: T1, input: imageInput() }));
    expect(r1.status).toBe(502);
    expect((await r1.json()).error.details.units_kept).toBe(true);
    expect(timeoutStore.used(T1)).toBe(1);

    const rejectStore = fakeStore();
    const r = makeDeps({ store: rejectStore, fetch: (async () => jsonRes({ steps: [] })) as MediaStudioDeps['fetch'] });
    const r2 = await createMediaStudioHandler(r.deps)(post({ op: 'generate', tenant_id: T1, input: imageInput() }));
    expect(r2.status).toBe(422);
    expect(rejectStore.used(T1)).toBe(0);
  });

  it('Ablage scheitert → 502 STORAGE_FAILED, Einheiten bleiben angerechnet', async () => {
    const store = fakeStore();
    store.putAsset = async () => { throw new Error('bucket missing'); };
    const { deps } = makeDeps({ store });
    const res = await createMediaStudioHandler(deps)(post({ op: 'generate', tenant_id: T1, input: imageInput() }));
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe('STORAGE_FAILED');
    expect(store.used(T1)).toBe(1);
  });

  it('capabilities: nicht konfigurierter Anbieter wird mit Grund gemeldet, kein Secret im Output', async () => {
    const { deps } = makeDeps({ providerConfig: () => ({ googleApiKey: 'g-key', modelOverrides: {} }) });
    const body = await (await createMediaStudioHandler(deps)(post({ op: 'capabilities', tenant_id: T1 }))).json();
    const hf = body.models.find((m: { provider: string; kind: string }) => m.provider === 'higgsfield' && m.kind === 'image');
    expect(hf.available).toBe(false);
    expect(hf.reason).toMatch(/nicht hinterlegt/);
    expect(JSON.stringify(body)).not.toContain('g-key');
  });
});

describe('media-studio Eingaben, Medien und Mapping', () => {
  it('verlangt Idempotenz-Schlüssel und gültige Referenz-ID', () => {
    const base = { kind: 'image', provider: 'google', prompt: 'abc def', aspect_ratio: '16:9' };
    expect(validateGenerateInput(base).ok).toBe(false);
    expect(validateGenerateInput({ ...base, idempotency_key: 'run-1:img-1:0' }).ok).toBe(true);
    expect(validateGenerateInput({ kind: 'video', provider: 'google', prompt: 'abc def', aspect_ratio: '16:9', idempotency_key: 'run-1:v:0', reference: { job_id: '../../etc', index: 0 } }).ok).toBe(false);
    expect(validateGenerateInput({ ...base, provider: 'higgsfield', idempotency_key: 'run-1:img-1:0', reference: { job_id: 'aaaaaaaa-0000-4000-8000-000000000001', index: 0 } }).ok).toBe(false);
  });

  it('lehnt Kamera für Bilder, falsches Seitenverhältnis und zu lange Videos ab', () => {
    const k = { idempotency_key: 'run-1:x:000' };
    expect(validateGenerateInput({ ...imageInput(), camera: 'orbit' }).ok).toBe(false);
    expect(validateGenerateInput({ kind: 'video', provider: 'google', prompt: 'abc def', aspect_ratio: '1:1', ...k }).ok).toBe(false);
    expect(validateGenerateInput({ kind: 'video', provider: 'google', prompt: 'abc def', aspect_ratio: '16:9', duration_s: 30, ...k }).ok).toBe(false);
    const ok = validateGenerateInput({ kind: 'video', provider: 'google', prompt: 'abc def', aspect_ratio: '16:9', ...k });
    expect(ok.ok && ok.value.duration_s).toBe(8);
  });

  it('Einheiten: Bild 1, Video je Sekunde', () => {
    expect(mediaUnits('image')).toBe(1);
    expect(mediaUnits('video', 8)).toBe(8);
  });

  it('Dateityp über Magic Bytes; Medienart muss passen; Mandant ist erstes Pfadsegment', () => {
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    const mp4 = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]);
    expect(sniffMime(png)).toBe('image/png');
    expect(sniffMime(mp4)).toBe('video/mp4');
    expect(sniffMime(new TextEncoder().encode('<html>'))).toBeNull();
    expect(checkMedia(png, 'image')).toEqual({ mime: 'image/png', ext: 'png' });
    expect(() => checkMedia(png, 'video')).toThrow();
    expect(() => checkMedia(new TextEncoder().encode('<script>'), 'image')).toThrow();
    expect(assetPath(T1, 'job', 0, 'png').split('/')[0]).toBe(T1);
  });

  it('Google-Body: Video mit Dauer, Kamera-Regie im Prompt, Referenz vor Text', () => {
    const v = validateGenerateInput({ kind: 'video', provider: 'google', prompt: 'Werkstatt', aspect_ratio: '9:16', duration_s: 6, camera: 'orbit', idempotency_key: 'run-1:v:0' });
    if (!v.ok) throw new Error(v.message);
    const body = buildGoogleBody(v.value, 'gemini-omni-1.2-flash', { mime_type: 'image/png', data_base64: 'QUJD' }) as { input: { type: string; text?: string }[]; response_format: Record<string, unknown> };
    expect(body.response_format).toMatchObject({ type: 'video', duration: '6s', aspect_ratio: '9:16', delivery: 'inline' });
    expect(body.input[0].type).toBe('image');
    expect(body.input[1].text).toBe(composeProviderPrompt('Werkstatt', 'orbit'));
  });

  it('extractGoogleAssets liest steps[].content[] und ignoriert andere Medienarten', () => {
    const json = { steps: [{ type: 'model_output', content: [{ type: 'text', text: 'x' }, { type: 'image', data: 'QQ==' }] }] };
    expect(extractGoogleAssets(json, 'image')).toEqual([{ kind: 'image', mime_type: 'image/png', data_base64: 'QQ==' }]);
    expect(extractGoogleAssets(json, 'video')).toEqual([]);
  });

  it('Higgsfield-Status: nsfw → CONTENT_REJECTED, http-URLs werden verworfen', () => {
    expect(mapHiggsfieldStatus({ status: 'nsfw' }, 'image', 'm', 'r')).toMatchObject({ status: 'failed', code: 'CONTENT_REJECTED' });
    expect(mapHiggsfieldStatus({ status: 'completed', images: [{ url: 'http://insecure/x.jpg' }] }, 'image', 'm', 'r')).toMatchObject({ status: 'failed' });
    expect(mapHiggsfieldStatus({ status: 'in_progress' }, 'video', 'm', 'r')).toMatchObject({ status: 'pending' });
  });
});
