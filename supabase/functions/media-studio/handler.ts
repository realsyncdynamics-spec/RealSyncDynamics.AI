// media-studio — Bild- und Video-Generierung für den Builder (Deno-frei, vitest-getestet).
//
// Ops (POST, JSON-Body):
//   capabilities  → welche Anbieter/Modelle für diesen Mandanten nutzbar sind
//   generate      → ein Bild oder Video erzeugen (sync) bzw. Auftrag anlegen (async)
//   status        → asynchronen Auftrag abfragen (nur mit mandantengebundenem Job-Token)
//
// Reihenfolge der Gates in `generate` (fail-closed, jeder Fehlerpfad lehnt ab):
//   1. Kill-Switch MEDIA_STUDIO_ENABLED (frisch gelesen)
//   2. Nutzer-JWT + Mitgliedschaft im Mandanten (requireAuthAndTenant)
//   3. Entitlement siteos.builder
//   4. Signatur-Secret vorhanden
//   5. Residency des Mandanten = cloud (Google/Higgsfield verarbeiten außerhalb der EU-Region
//      dieses Projekts; eu_local-Mandanten werden nie an sie geroutet)
//   6. Eingabe gültig, keine personenbezogenen Daten im Prompt
//   7. Referenzbild stammt nachweislich aus diesem Studio für diesen Mandanten
//   8. Modell konfiguriert
//   9. Rate-Limit je Nutzer/Mandant/Medienart
//  10. Evidence in ai_evidence_events — VOR dem Anbieteraufruf; scheitert der
//      Eintrag, wird nicht generiert.

import { jsonError, jsonResponse, type CorsHeaders } from '../_shared/gateway.ts';
import { redactString, sumHits } from '../_shared/redact.ts';
import { decideRateLimit, type WindowState } from '../_shared/aiGateway/rateLimit.ts';
import { buildAiCallEvidenceRow, type AiEvidenceEventInsert } from '../_shared/aiGateway/callEvidence.ts';
import {
  CAMERA_PRESETS,
  MEDIA_FEATURE,
  MEDIA_LIMITS,
  MEDIA_MODELS,
  type MediaKind,
  type MediaProviderId,
} from '../_shared/mediaStudio/catalog.ts';
import { validateGenerateInput } from '../_shared/mediaStudio/validate.ts';
import {
  type FetchLike,
  generateWithProvider,
  type GeneratedAsset,
  modelAvailable,
  pollHiggsfield,
  type ProviderConfig,
  providerConfigured,
  type ProviderResult,
  resolveModelId,
} from '../_shared/mediaStudio/providers.ts';
import {
  assetFingerprint,
  signAsset,
  signJob,
  usableSecret,
  verifyAsset,
  verifyJob,
} from '../_shared/mediaStudio/signing.ts';

export type Residency = 'cloud' | 'eu_local';

export interface VerifiedPrincipal {
  userId: string;
  tenantId: string;
}

export interface MediaStudioDeps {
  cors: CorsHeaders;
  /** Kill-Switch, bei jedem Request frisch gelesen. */
  enabled: () => boolean;
  /** requireAuthAndTenant; Response bei 400/401/403. */
  authenticate: (req: Request, clientTenantId: unknown) => Promise<VerifiedPrincipal | Response>;
  /** true nur bei bestätigtem Entitlement; Fehler = false. */
  hasEntitlement: (tenantId: string) => Promise<boolean>;
  /** Wirft bei nicht verifizierbarer Residency. */
  resolveResidency: (tenantId: string, userId: string) => Promise<Residency>;
  providerConfig: () => ProviderConfig;
  signingSecret: () => string | undefined;
  fetch: FetchLike;
  recordEvidence: (row: AiEvidenceEventInsert) => Promise<void>;
  now: () => number;
  requestId: () => string;
  minuteWindows: Map<string, WindowState>;
  hourWindows: Map<string, WindowState>;
  log: (entry: Record<string, unknown>) => void;
}

export interface SignedAsset extends GeneratedAsset {
  sig: string;
}

const ROUTE = '/media-studio';

export function createMediaStudioHandler(deps: MediaStudioDeps) {
  const err = (status: number, code: string, message: string, details?: unknown) =>
    jsonError(status, code, message, deps.cors, details);
  const ok = (body: unknown) => jsonResponse({ ok: true, ...(body as object) }, 200, deps.cors);

  async function signAssets(secret: string, tenantId: string, assets: GeneratedAsset[]): Promise<SignedAsset[]> {
    const out: SignedAsset[] = [];
    for (const a of assets) out.push({ ...a, sig: await signAsset(secret, tenantId, await assetFingerprint(a)) });
    return out;
  }

  async function blockedEvidence(
    p: VerifiedPrincipal,
    op: string,
    provider: string | null,
    reason: string,
    requestId: string,
  ): Promise<void> {
    try {
      await deps.recordEvidence(
        await buildAiCallEvidenceRow({
          tenantId: p.tenantId,
          path: 'user',
          userId: p.userId,
          feature: MEDIA_FEATURE,
          route: ROUTE,
          op,
          provider,
          residency: 'cloud',
          blocked: true,
          verdict: 'block',
          reasons: [reason],
          requestId,
        }),
      );
    } catch (e) {
      deps.log({ scope: 'media-studio', event: 'blocked_evidence_failed', request_id: requestId, error: String((e as Error)?.message ?? e).slice(0, 200) });
    }
  }

  // Gemeinsame Gates 1–3 für alle Ops.
  async function gate(req: Request, body: Record<string, unknown>): Promise<VerifiedPrincipal | Response> {
    if (!deps.enabled()) return err(503, 'MEDIA_STUDIO_DISABLED', 'Media Studio ist serverseitig abgeschaltet.');
    const principal = await deps.authenticate(req, body.tenant_id);
    if (principal instanceof Response) return principal;
    let entitled = false;
    try {
      entitled = await deps.hasEntitlement(principal.tenantId);
    } catch {
      entitled = false;
    }
    if (!entitled) return err(403, 'NOT_ENTITLED', 'Ihr Tarif enthält den Builder nicht.');
    return principal;
  }

  async function residencyOf(p: VerifiedPrincipal): Promise<Residency | Response> {
    try {
      const r = await deps.resolveResidency(p.tenantId, p.userId);
      if (r !== 'cloud' && r !== 'eu_local') throw new Error('unknown');
      return r;
    } catch {
      return err(503, 'RESIDENCY_UNAVAILABLE', 'Datenresidenz nicht prüfbar; Generierung gesperrt.');
    }
  }

  async function capabilities(p: VerifiedPrincipal): Promise<Response> {
    const residency = await residencyOf(p);
    if (residency instanceof Response) return residency;
    const cfg = deps.providerConfig();
    const signing = usableSecret(deps.signingSecret());
    const models = MEDIA_MODELS.map((m) => {
      let reason: string | null = null;
      if (residency === 'eu_local') reason = 'Ihr Mandant ist auf EU-lokale KI festgelegt. Dieser Anbieter verarbeitet außerhalb.';
      else if (!signing) reason = 'Serverkonfiguration unvollständig (Signatur-Secret).';
      else if (!providerConfigured(m.provider, cfg)) reason = 'Anbieter-Zugang ist nicht hinterlegt.';
      else if (!modelAvailable(m, cfg)) reason = 'Modell ist nicht konfiguriert.';
      return {
        provider: m.provider,
        kind: m.kind,
        label: m.label,
        model: resolveModelId(m, cfg) || null,
        aspect_ratios: m.aspectRatios,
        duration_s: m.durationS ?? null,
        accepts_reference: m.acceptsReference,
        delivery: m.delivery,
        available: reason === null,
        reason,
      };
    });
    return ok({ residency, models, camera_presets: CAMERA_PRESETS, limits: MEDIA_LIMITS });
  }

  async function generate(p: VerifiedPrincipal, body: Record<string, unknown>, requestId: string): Promise<Response> {
    const secret = deps.signingSecret();
    if (!usableSecret(secret)) return err(503, 'NOT_CONFIGURED', 'Serverkonfiguration unvollständig.');

    const residency = await residencyOf(p);
    if (residency instanceof Response) return residency;

    const parsed = validateGenerateInput(body.input);
    if (!parsed.ok) return err(400, parsed.code, parsed.message);
    const input = parsed.value;
    const model = parsed.model;

    if (residency !== 'cloud') {
      await blockedEvidence(p, 'generate', input.provider, 'residency_eu_local', requestId);
      return err(403, 'RESIDENCY_EU_LOCAL', 'Ihr Mandant ist auf EU-lokale KI festgelegt. Bild-/Video-Anbieter außerhalb sind gesperrt.');
    }

    const pii = sumHits(redactString(`${input.prompt}\n${input.negative_prompt ?? ''}`).hits);
    if (pii > 0) {
      await blockedEvidence(p, 'generate', input.provider, 'pii_in_prompt', requestId);
      return err(422, 'PII_IN_PROMPT', 'Der Prompt enthält personenbezogene Daten (z. B. E-Mail, Telefon, IBAN). Bitte entfernen.');
    }

    if (input.reference && !(await verifyAsset(secret, p.tenantId, input.reference, input.reference.sig))) {
      await blockedEvidence(p, 'generate', input.provider, 'reference_not_signed', requestId);
      return err(403, 'REFERENCE_NOT_SIGNED', 'Referenzbilder müssen in diesem Studio für Ihren Mandanten erzeugt worden sein.');
    }

    const cfg = deps.providerConfig();
    if (!modelAvailable(model, cfg)) {
      return err(503, 'PROVIDER_NOT_CONFIGURED', `${model.label} ist nicht konfiguriert.`);
    }

    const limit = decideRateLimit({
      key: `ms:${p.tenantId}:${p.userId}:${input.kind}`,
      feature: `${MEDIA_FEATURE}.${input.kind}`,
      now: deps.now(),
      minuteWindows: deps.minuteWindows,
      hourWindows: deps.hourWindows,
      limits: MEDIA_LIMITS[input.kind],
    });
    if (!limit.ok) {
      return err(429, 'RATE_LIMITED', `Limit für ${input.kind === 'video' ? 'Videos' : 'Bilder'} erreicht.`, {
        scope: limit.scope,
        retry_after_ms: limit.retryAfterMs,
      });
    }

    const modelId = resolveModelId(model, cfg);
    try {
      await deps.recordEvidence(
        await buildAiCallEvidenceRow({
          tenantId: p.tenantId,
          path: 'user',
          userId: p.userId,
          feature: MEDIA_FEATURE,
          route: ROUTE,
          op: `generate_${input.kind}`,
          provider: input.provider,
          model: modelId,
          residency: 'cloud',
          verdict: 'allow',
          reasons: input.reference ? ['signed_reference'] : [],
          requestId,
          input: input.prompt,
        }),
      );
    } catch (e) {
      deps.log({ scope: 'media-studio', event: 'evidence_failed', request_id: requestId, error: String((e as Error)?.message ?? e).slice(0, 200) });
      return err(503, 'EVIDENCE_UNAVAILABLE', 'Nachweis konnte nicht geschrieben werden; es wurde nichts generiert.');
    }

    const started = deps.now();
    let result: ProviderResult;
    try {
      result = await generateWithProvider(input, model, cfg, deps.fetch);
    } catch (e) {
      deps.log({ scope: 'media-studio', event: 'provider_throw', request_id: requestId, error: String((e as Error)?.message ?? e).slice(0, 200) });
      result = { status: 'failed', code: 'PROVIDER_ERROR', message: 'Anbieter nicht erreichbar.', retryable: true };
    }
    deps.log({
      scope: 'media-studio',
      event: 'generate',
      request_id: requestId,
      tenant_id: p.tenantId,
      provider: input.provider,
      model: modelId,
      kind: input.kind,
      status: result.status,
      latency_ms: deps.now() - started,
    });
    return respondWith(result, p, secret, input.provider, input.kind, requestId, input.client_ref);
  }

  async function respondWith(
    result: ProviderResult,
    p: VerifiedPrincipal,
    secret: string,
    provider: MediaProviderId,
    kind: MediaKind,
    requestId: string,
    clientRef?: string,
  ): Promise<Response> {
    if (result.status === 'failed') {
      const status = result.code === 'CONTENT_REJECTED' ? 422 : result.code === 'PROVIDER_RATE_LIMITED' ? 429 : 502;
      return err(status, result.code, result.message, { retryable: result.retryable, request_id: requestId });
    }
    if (result.status === 'pending') {
      return ok({
        status: 'pending',
        request_id: requestId,
        client_ref: clientRef ?? null,
        job: {
          provider,
          kind,
          model: result.model,
          provider_request_id: result.provider_request_id,
          token: await signJob(secret, p.tenantId, provider, result.provider_request_id),
        },
      });
    }
    return ok({
      status: 'completed',
      request_id: requestId,
      client_ref: clientRef ?? null,
      provider,
      model: result.model,
      assets: await signAssets(secret, p.tenantId, result.assets),
    });
  }

  async function status(p: VerifiedPrincipal, body: Record<string, unknown>, requestId: string): Promise<Response> {
    const secret = deps.signingSecret();
    if (!usableSecret(secret)) return err(503, 'NOT_CONFIGURED', 'Serverkonfiguration unvollständig.');
    const job = (body.job ?? null) as Record<string, unknown> | null;
    const provider = job?.provider;
    const kind = job?.kind;
    const reqId = job?.provider_request_id;
    const token = job?.token;
    const model = job?.model;
    if (provider !== 'higgsfield' || (kind !== 'image' && kind !== 'video') || typeof reqId !== 'string' || typeof token !== 'string' || typeof model !== 'string') {
      return err(400, 'BAD_REQUEST', 'Ungültiger Auftrag.');
    }
    if (!(await verifyJob(secret, p.tenantId, provider, reqId, token))) {
      return err(403, 'JOB_NOT_OWNED', 'Dieser Auftrag gehört nicht zu Ihrem Mandanten.');
    }
    const cfg = deps.providerConfig();
    if (!providerConfigured('higgsfield', cfg)) return err(503, 'PROVIDER_NOT_CONFIGURED', 'Higgsfield ist nicht konfiguriert.');
    let result: ProviderResult;
    try {
      result = await pollHiggsfield(reqId, kind, model, cfg, deps.fetch);
    } catch {
      result = { status: 'failed', code: 'PROVIDER_ERROR', message: 'Anbieter nicht erreichbar.', retryable: true };
    }
    if (result.status === 'pending') {
      return ok({ status: 'pending', request_id: requestId, job: { provider, kind, model, provider_request_id: reqId, token } });
    }
    return respondWith(result, p, secret, 'higgsfield', kind, requestId);
  }

  return async function handle(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: deps.cors });
    if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'Nur POST.');
    const requestId = deps.requestId();

    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not object');
      body = parsed as Record<string, unknown>;
    } catch {
      return err(400, 'BAD_REQUEST', 'Ungültiges JSON.');
    }

    const op = body.op;
    if (op !== 'capabilities' && op !== 'generate' && op !== 'status') {
      return err(400, 'BAD_REQUEST', 'op muss capabilities, generate oder status sein.');
    }

    const principal = await gate(req, body);
    if (principal instanceof Response) return principal;

    if (op === 'capabilities') return capabilities(principal);
    if (op === 'generate') return generate(principal, body, requestId);
    return status(principal, body, requestId);
  };
}
