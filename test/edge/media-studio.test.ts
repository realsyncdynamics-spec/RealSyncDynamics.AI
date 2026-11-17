// media-studio: Gates, Signaturen und Anbieter-Mapping.
// Handler ist Deno-frei; Auth, Entitlement, Residency, Evidence und fetch sind Fakes.

import { describe, it, expect, vi } from 'vitest';
import {
  createMediaStudioHandler,
  type MediaStudioDeps,
  type VerifiedPrincipal,
} from '../../supabase/functions/media-studio/handler.ts';
import { validateGenerateInput } from '../../supabase/functions/_shared/mediaStudio/validate.ts';
import {
  buildGoogleBody,
  extractGoogleAssets,
  mapHiggsfieldStatus,
} from '../../supabase/functions/_shared/mediaStudio/providers.ts';
import { signAsset, assetFingerprint, signJob } from '../../supabase/functions/_shared/mediaStudio/signing.ts';
import { composeProviderPrompt } from '../../supabase/functions/_shared/mediaStudio/catalog.ts';

const T1 = '11111111-1111-4111-8111-111111111111';
const T2 = '22222222-2222-4222-8222-222222222222';
const SECRET = 's'.repeat(40);
const URL_FN = 'https://x.supabase.co/functions/v1/media-studio';

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

type Overrides = Partial<MediaStudioDeps> & { principal?: VerifiedPrincipal | Response };

function makeDeps(o: Overrides = {}) {
  const evidence: unknown[] = [];
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes('generativelanguage')) {
      return jsonRes({ id: 'int-1', steps: [{ type: 'model_output', content: [{ type: 'image', data: 'QUJD', mime_type: 'image/png' }] }] });
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
    providerConfig: () => ({
      googleApiKey: 'g-key',
      higgsfieldKeyId: 'id',
      higgsfieldKeySecret: 'secret',
      modelOverrides: {},
    }),
    signingSecret: () => SECRET,
    fetch: fetchMock as unknown as MediaStudioDeps['fetch'],
    recordEvidence: async (row) => {
      evidence.push(row);
    },
    now: () => 1_000_000,
    requestId: () => 'req-1',
    minuteWindows: new Map(),
    hourWindows: new Map(),
    log: () => {},
    ...o,
  };
  return { deps, evidence, fetchMock };
}

function post(body: unknown): Request {
  return new Request(URL_FN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

const imageInput = { kind: 'image', provider: 'google', prompt: 'Dachdecker auf einem Steildach bei Sonnenaufgang', aspect_ratio: '16:9' };

describe('media-studio gates', () => {
  it('Kill-Switch aus → 503, kein Anbieteraufruf', async () => {
    const { deps, fetchMock } = makeDeps({ enabled: () => false });
    const res = await createMediaStudioHandler(deps)(post({ op: 'generate', tenant_id: T1, input: imageInput }));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('MEDIA_STUDIO_DISABLED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Auth-Fehler wird durchgereicht (fremder Mandant → 403)', async () => {
    const { deps, fetchMock } = makeDeps({ principal: jsonRes({ ok: false }, 403) });
    const res = await createMediaStudioHandler(deps)(post({ op: 'generate', tenant_id: T2, input: imageInput }));
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
    const res = await createMediaStudioHandler(deps)(post({ op: 'generate', tenant_id: T1, input: imageInput }));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('RESIDENCY_UNAVAILABLE');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('eu_local-Mandant → 403 und Block-Evidence', async () => {
    const { deps, fetchMock, evidence } = makeDeps({ resolveResidency: async () => 'eu_local' });
    const res = await createMediaStudioHandler(deps)(post({ op: 'generate', tenant_id: T1, input: imageInput }));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('RESIDENCY_EU_LOCAL');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(evidence).toHaveLength(1);
    expect((evidence[0] as { event_type: string }).event_type).toBe('ai:call_blocked');
  });

  it('PII im Prompt → 422, kein Anbieteraufruf', async () => {
    const { deps, fetchMock } = makeDeps();
    const res = await createMediaStudioHandler(deps)(
      post({ op: 'generate', tenant_id: T1, input: { ...imageInput, prompt: 'Visitenkarte mit max@example.com' } }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('PII_IN_PROMPT');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fehlendes Signatur-Secret → 503', async () => {
    const { deps } = makeDeps({ signingSecret: () => 'kurz' });
    const res = await createMediaStudioHandler(deps)(post({ op: 'generate', tenant_id: T1, input: imageInput }));
    expect(res.status).toBe(503);
  });

  it('Evidence-Fehler → 503, kein Anbieteraufruf (fail-closed)', async () => {
    const { deps, fetchMock } = makeDeps({ recordEvidence: async () => { throw new Error('insert failed'); } });
    const res = await createMediaStudioHandler(deps)(post({ op: 'generate', tenant_id: T1, input: imageInput }));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('EVIDENCE_UNAVAILABLE');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Rate-Limit Video: drittes Video in einer Minute → 429', async () => {
    const { deps } = makeDeps({
      fetch: (async () => jsonRes({ steps: [{ content: [{ type: 'video', data: 'AAAA', mime_type: 'video/mp4' }] }] })) as MediaStudioDeps['fetch'],
    });
    const handle = createMediaStudioHandler(deps);
    const video = { kind: 'video', provider: 'google', prompt: 'Handwerker montiert Solarmodul', aspect_ratio: '16:9', duration_s: 8 };
    expect((await handle(post({ op: 'generate', tenant_id: T1, input: video }))).status).toBe(200);
    expect((await handle(post({ op: 'generate', tenant_id: T1, input: video }))).status).toBe(200);
    expect((await handle(post({ op: 'generate', tenant_id: T1, input: video }))).status).toBe(429);
  });
});

describe('media-studio generate + status', () => {
  it('Google Bild: completed mit signiertem Asset, Evidence vor dem Aufruf, Key nur im Header', async () => {
    const { deps, evidence, fetchMock } = makeDeps();
    const res = await createMediaStudioHandler(deps)(post({ op: 'generate', tenant_id: T1, input: imageInput }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('completed');
    expect(body.assets[0].data_base64).toBe('QUJD');
    expect(body.assets[0].sig).toBe(await signAsset(SECRET, T1, await assetFingerprint({ data_base64: 'QUJD' })));
    expect(evidence).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect(url).not.toContain('key=');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('g-key');
    // Evidence enthält keinen Prompt-Klartext.
    expect(JSON.stringify(evidence[0])).not.toContain('Dachdecker');
  });

  it('Referenz ohne gültige Signatur → 403', async () => {
    const { deps, fetchMock } = makeDeps();
    const input = {
      kind: 'video', provider: 'google', prompt: 'Kamerafahrt über das Dach', aspect_ratio: '16:9',
      reference: { mime_type: 'image/png', data_base64: 'QUJD', sig: 'f'.repeat(64) },
    };
    const res = await createMediaStudioHandler(deps)(post({ op: 'generate', tenant_id: T1, input }));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('REFERENCE_NOT_SIGNED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Referenz eines anderen Mandanten wird abgelehnt, eigene angenommen', async () => {
    const { deps } = makeDeps({
      fetch: (async () => jsonRes({ steps: [{ content: [{ type: 'video', data: 'AAAA' }] }] })) as MediaStudioDeps['fetch'],
    });
    const handle = createMediaStudioHandler(deps);
    const fp = await assetFingerprint({ data_base64: 'QUJD' });
    const base = { kind: 'video', provider: 'google', prompt: 'Kamerafahrt über das Dach', aspect_ratio: '16:9' };
    const foreign = await handle(post({ op: 'generate', tenant_id: T1, input: { ...base, reference: { mime_type: 'image/png', data_base64: 'QUJD', sig: await signAsset(SECRET, T2, fp) } } }));
    expect(foreign.status).toBe(403);
    const own = await handle(post({ op: 'generate', tenant_id: T1, input: { ...base, reference: { mime_type: 'image/png', data_base64: 'QUJD', sig: await signAsset(SECRET, T1, fp) } } }));
    expect(own.status).toBe(200);
  });

  it('Higgsfield: pending mit Job-Token; status nur für eigenen Mandanten', async () => {
    const { deps, fetchMock } = makeDeps();
    const handle = createMediaStudioHandler(deps);
    const res = await handle(post({ op: 'generate', tenant_id: T1, input: { ...imageInput, provider: 'higgsfield' } }));
    const body = await res.json();
    expect(body.status).toBe('pending');
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Key id:secret');

    const stranger = makeDeps({ principal: { userId: 'u2', tenantId: T2 } });
    const denied = await createMediaStudioHandler(stranger.deps)(post({ op: 'status', tenant_id: T2, job: body.job }));
    expect(denied.status).toBe(403);
    expect(stranger.fetchMock).not.toHaveBeenCalled();

    const done = await handle(post({ op: 'status', tenant_id: T1, job: body.job }));
    const doneBody = await done.json();
    expect(doneBody.status).toBe('completed');
    expect(doneBody.assets[0].url).toBe('https://cdn.example.com/a.jpg');
    expect(doneBody.assets[0].sig).toHaveLength(64);
  });

  it('status mit manipulierter request_id → 403', async () => {
    const { deps } = makeDeps();
    const token = await signJob(SECRET, T1, 'higgsfield', 'aaaaaaaa-1111');
    const res = await createMediaStudioHandler(deps)(
      post({ op: 'status', tenant_id: T1, job: { provider: 'higgsfield', kind: 'image', model: 'm', provider_request_id: 'bbbbbbbb-2222', token } }),
    );
    expect(res.status).toBe(403);
  });

  it('capabilities: nicht konfigurierter Anbieter wird mit Grund gemeldet, kein Secret im Output', async () => {
    const { deps } = makeDeps({ providerConfig: () => ({ googleApiKey: 'g-key', modelOverrides: {} }) });
    const res = await createMediaStudioHandler(deps)(post({ op: 'capabilities', tenant_id: T1 }));
    const body = await res.json();
    const hf = body.models.find((m: { provider: string; kind: string }) => m.provider === 'higgsfield' && m.kind === 'image');
    expect(hf.available).toBe(false);
    expect(hf.reason).toMatch(/nicht hinterlegt/);
    const g = body.models.find((m: { provider: string; kind: string }) => m.provider === 'google' && m.kind === 'image');
    expect(g.available).toBe(true);
    expect(JSON.stringify(body)).not.toContain('g-key');
  });
});

describe('media-studio Eingaben und Mapping', () => {
  it('lehnt Kamera für Bilder, falsches Seitenverhältnis und zu lange Videos ab', () => {
    expect(validateGenerateInput({ ...imageInput, camera: 'orbit' }).ok).toBe(false);
    expect(validateGenerateInput({ kind: 'video', provider: 'google', prompt: 'abc def', aspect_ratio: '1:1' }).ok).toBe(false);
    expect(validateGenerateInput({ kind: 'video', provider: 'google', prompt: 'abc def', aspect_ratio: '16:9', duration_s: 30 }).ok).toBe(false);
    const ok = validateGenerateInput({ kind: 'video', provider: 'google', prompt: 'abc def', aspect_ratio: '16:9' });
    expect(ok.ok && ok.value.duration_s).toBe(8);
  });

  it('Higgsfield nimmt Referenz nur als https-Link, Google nur inline', () => {
    const sig = 'a'.repeat(64);
    expect(validateGenerateInput({ kind: 'video', provider: 'google', prompt: 'abc def', aspect_ratio: '16:9', reference: { url: 'https://x/y.jpg', sig } }).ok).toBe(false);
    expect(validateGenerateInput({ kind: 'video', provider: 'higgsfield', prompt: 'abc def', aspect_ratio: '16:9', reference: { url: 'http://x/y.jpg', sig } }).ok).toBe(false);
    expect(validateGenerateInput({ kind: 'video', provider: 'higgsfield', prompt: 'abc def', aspect_ratio: '16:9', reference: { url: 'https://x/y.jpg', sig } }).ok).toBe(true);
  });

  it('Google-Body: Video mit Dauer, Kamera-Regie im Prompt, Referenz vor Text', () => {
    const v = validateGenerateInput({
      kind: 'video', provider: 'google', prompt: 'Werkstatt', aspect_ratio: '9:16', duration_s: 6, camera: 'orbit',
      reference: { mime_type: 'image/png', data_base64: 'QUJD', sig: 'a'.repeat(64) },
    });
    if (!v.ok) throw new Error(v.message);
    const body = buildGoogleBody(v.value, 'gemini-omni-1.2-flash') as { input: { type: string; text?: string }[]; response_format: Record<string, unknown> };
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
