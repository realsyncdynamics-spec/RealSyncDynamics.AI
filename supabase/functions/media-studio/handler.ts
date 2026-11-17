// media-studio — Bild- und Video-Generierung für den Builder (Deno-frei, vitest-getestet).
//
// Zusammengeführt aus PR #2271 (Creative Studio: Reservierung vor jedem bezahlten
// Aufruf, Job-Lebenszyklus, private Ablage) und PR #2288 (Media Studio).
//
// Ops (POST, JSON-Body):
//   capabilities  → welche Anbieter/Modelle für diesen Mandanten nutzbar sind
//   generate      → Auftrag reservieren und ein Bild/Video erzeugen (sync) bzw. einreichen (async)
//   status        → Auftrag des eigenen Mandanten abfragen (job_id, mandantengebunden aus der DB)
//
// Reihenfolge der Gates in `generate` (fail-closed, jeder Fehlerpfad lehnt ab):
//   1. Kill-Switch MEDIA_STUDIO_ENABLED (frisch gelesen)
//   2. Nutzer-JWT + Mitgliedschaft im Mandanten (requireAuthAndTenant)
//   3. Entitlement siteos.builder
//   4. Residency des Mandanten = cloud (eu_local-Mandanten nie an Google/Higgsfield)
//   5. Eingabe gültig, keine personenbezogenen Daten im Prompt
//   6. Modell konfiguriert
//   7. Referenz = abgeschlossener Auftrag desselben Mandanten (aus der DB, nie aus dem Body)
//   8. Rate-Limit je Nutzer/Mandant/Medienart
//   9. Atomare Kontingent-Reservierung (media_job_reserve), idempotent je Schlüssel
//  10. Evidence in ai_evidence_events — VOR dem Anbieteraufruf
//  11. Ergebnis nur in den privaten Bucket; der Browser bekommt signierte URLs.

import { jsonError, jsonResponse, type CorsHeaders } from '../_shared/gateway.ts';
import { redactString, sumHits } from '../_shared/redact.ts';
import { decideRateLimit, type WindowState } from '../_shared/aiGateway/rateLimit.ts';
import { buildAiCallEvidenceRow, type AiEvidenceEventInsert } from '../_shared/aiGateway/callEvidence.ts';
import {
  CAMERA_PRESETS,
  MEDIA_FEATURE,
  MEDIA_LIMITS,
  MEDIA_MODELS,
  mediaUnits,
  REFERENCE_URL_TTL_S,
  SIGNED_URL_TTL_S,
  type MediaKind,
  type MediaProviderId,
} from '../_shared/mediaStudio/catalog.ts';
import { type GenerateInput, validateGenerateInput } from '../_shared/mediaStudio/validate.ts';
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
  type ResolvedReference,
} from '../_shared/mediaStudio/providers.ts';

export type Residency = 'cloud' | 'eu_local';
export type JobStatus = 'reserved' | 'submitted' | 'completed' | 'failed' | 'released';

export interface VerifiedPrincipal {
  userId: string;
  tenantId: string;
}

export interface JobRow {
  id: string;
  tenant_id: string;
  kind: MediaKind;
  provider: MediaProviderId;
  model: string;
  status: JobStatus;
  provider_request_id: string | null;
  asset_paths: string[];
}

export type ReserveResult =
  | { ok: true; jobId: string; replay: boolean; status: JobStatus }
  | { ok: false; code: string; used?: number; limit?: number };

/** Persistenz: Supabase (RPCs + privater Bucket) in index.ts, Fake im Test. */
export interface MediaStore {
  reserve(args: {
    tenantId: string;
    userId: string;
    kind: MediaKind;
    provider: MediaProviderId;
    model: string;
    units: number;
    idempotencyKey: string;
    params: Record<string, unknown>;
  }): Promise<ReserveResult>;
  transition(
    jobId: string,
    tenantId: string,
    status: JobStatus,
    patch?: { providerRequestId?: string; assetPaths?: string[]; errorCode?: string },
  ): Promise<boolean>;
  /** Nur Zeilen des angegebenen Mandanten; sonst null. */
  loadJob(jobId: string, tenantId: string): Promise<JobRow | null>;
  /** Legt ein Ergebnis im privaten Bucket ab (lädt Anbieter-URLs serverseitig herunter). */
  putAsset(tenantId: string, jobId: string, index: number, asset: GeneratedAsset): Promise<string>;
  signedUrl(path: string, ttlSeconds: number): Promise<string>;
  readAsset(path: string): Promise<{ mime_type: string; data_base64: string }>;
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
  store: MediaStore;
  fetch: FetchLike;
  recordEvidence: (row: AiEvidenceEventInsert) => Promise<void>;
  sha256: (text: string) => Promise<string>;
  now: () => number;
  requestId: () => string;
  minuteWindows: Map<string, WindowState>;
  hourWindows: Map<string, WindowState>;
  log: (entry: Record<string, unknown>) => void;
}

export interface ClientAsset {
  kind: MediaKind;
  mime_type: string;
  url: string;
  job_id: string;
  index: number;
}

const ROUTE = '/media-studio';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Ausgang ungewiss → Einheiten bleiben angerechnet (siehe media_units_used). */
const UNCERTAIN_FAILURES = new Set(['PROVIDER_TIMEOUT', 'STORAGE_FAILED']);

function mimeOfPath(path: string, kind: MediaKind): string {
  if (path.endsWith('.mp4')) return 'video/mp4';
  if (path.endsWith('.jpg')) return 'image/jpeg';
  if (path.endsWith('.webp')) return 'image/webp';
  return kind === 'video' ? 'video/mp4' : 'image/png';
}

export function createMediaStudioHandler(deps: MediaStudioDeps) {
  const err = (status: number, code: string, message: string, details?: unknown) =>
    jsonError(status, code, message, deps.cors, details);
  const ok = (body: unknown) => jsonResponse({ ok: true, ...(body as object) }, 200, deps.cors);
  const logErr = (event: string, requestId: string, e: unknown) =>
    deps.log({ scope: 'media-studio', event, request_id: requestId, error: String((e as Error)?.message ?? e).slice(0, 200) });

  async function blockedEvidence(p: VerifiedPrincipal, provider: string | null, reason: string, requestId: string): Promise<void> {
    try {
      await deps.recordEvidence(
        await buildAiCallEvidenceRow({
          tenantId: p.tenantId,
          path: 'user',
          userId: p.userId,
          feature: MEDIA_FEATURE,
          route: ROUTE,
          op: 'generate',
          provider,
          residency: 'cloud',
          blocked: true,
          verdict: 'block',
          reasons: [reason],
          requestId,
        }),
      );
    } catch (e) {
      logErr('blocked_evidence_failed', requestId, e);
    }
  }

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

  async function clientAssets(job: Pick<JobRow, 'id' | 'kind'>, paths: string[]): Promise<ClientAsset[]> {
    const out: ClientAsset[] = [];
    for (let i = 0; i < paths.length; i++) {
      out.push({
        kind: job.kind,
        mime_type: mimeOfPath(paths[i], job.kind),
        url: await deps.store.signedUrl(paths[i], SIGNED_URL_TTL_S),
        job_id: job.id,
        index: i,
      });
    }
    return out;
  }

  async function capabilities(p: VerifiedPrincipal): Promise<Response> {
    const residency = await residencyOf(p);
    if (residency instanceof Response) return residency;
    const cfg = deps.providerConfig();
    const models = MEDIA_MODELS.map((m) => {
      let reason: string | null = null;
      if (residency === 'eu_local') reason = 'Ihr Mandant ist auf EU-lokale KI festgelegt. Dieser Anbieter verarbeitet außerhalb.';
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

  async function resolveReference(p: VerifiedPrincipal, input: GenerateInput, accepts: 'none' | 'inline' | 'url'): Promise<ResolvedReference | Response | undefined> {
    if (!input.reference) return undefined;
    const job = await deps.store.loadJob(input.reference.job_id, p.tenantId);
    const path = job?.status === 'completed' && job.kind === 'image' ? job.asset_paths[input.reference.index] : undefined;
    if (!job || !path) {
      return err(403, 'REFERENCE_NOT_FOUND', 'Referenz muss ein fertiges Bild aus diesem Studio und Ihrem Mandanten sein.');
    }
    if (accepts === 'inline') return deps.store.readAsset(path);
    return { url: await deps.store.signedUrl(path, REFERENCE_URL_TTL_S) };
  }

  /** Speichert Ergebnisse privat und schließt den Auftrag ab. */
  async function finishCompleted(p: VerifiedPrincipal, job: Pick<JobRow, 'id' | 'kind'>, assets: GeneratedAsset[], requestId: string): Promise<Response> {
    const paths: string[] = [];
    try {
      for (let i = 0; i < assets.length && i < 4; i++) paths.push(await deps.store.putAsset(p.tenantId, job.id, i, assets[i]));
    } catch (e) {
      logErr('storage_failed', requestId, e);
      await safeTransition(job.id, p.tenantId, 'failed', { errorCode: 'STORAGE_FAILED' }, requestId);
      return err(502, 'STORAGE_FAILED', 'Ergebnis konnte nicht gespeichert werden.', { retryable: false, request_id: requestId });
    }
    await safeTransition(job.id, p.tenantId, 'completed', { assetPaths: paths }, requestId);
    return ok({ status: 'completed', request_id: requestId, job_id: job.id, assets: await clientAssets(job, paths) });
  }

  async function safeTransition(
    jobId: string,
    tenantId: string,
    status: JobStatus,
    patch: { providerRequestId?: string; assetPaths?: string[]; errorCode?: string },
    requestId: string,
  ): Promise<void> {
    try {
      const moved = await deps.store.transition(jobId, tenantId, status, patch);
      if (!moved) deps.log({ scope: 'media-studio', event: 'transition_rejected', request_id: requestId, job_id: jobId, status });
    } catch (e) {
      // Auftrag bleibt im vorherigen Zustand und damit angerechnet (konservativ).
      logErr('transition_failed', requestId, e);
    }
  }

  async function handleProviderResult(
    p: VerifiedPrincipal,
    job: Pick<JobRow, 'id' | 'kind'>,
    result: ProviderResult,
    requestId: string,
    clientRef?: string,
  ): Promise<Response> {
    if (result.status === 'failed') {
      await safeTransition(job.id, p.tenantId, 'failed', { errorCode: result.code }, requestId);
      const status = result.code === 'CONTENT_REJECTED' ? 422 : result.code === 'PROVIDER_RATE_LIMITED' ? 429 : 502;
      return err(status, result.code, result.message, {
        retryable: result.retryable,
        request_id: requestId,
        units_kept: UNCERTAIN_FAILURES.has(result.code),
      });
    }
    if (result.status === 'pending') {
      await safeTransition(job.id, p.tenantId, 'submitted', { providerRequestId: result.provider_request_id }, requestId);
      return ok({ status: 'pending', request_id: requestId, job_id: job.id, client_ref: clientRef ?? null });
    }
    return finishCompleted(p, job, result.assets, requestId);
  }

  async function generate(p: VerifiedPrincipal, body: Record<string, unknown>, requestId: string): Promise<Response> {
    const residency = await residencyOf(p);
    if (residency instanceof Response) return residency;

    const parsed = validateGenerateInput(body.input);
    if (!parsed.ok) return err(400, parsed.code, parsed.message);
    const input = parsed.value;
    const model = parsed.model;

    if (residency !== 'cloud') {
      await blockedEvidence(p, input.provider, 'residency_eu_local', requestId);
      return err(403, 'RESIDENCY_EU_LOCAL', 'Ihr Mandant ist auf EU-lokale KI festgelegt. Bild-/Video-Anbieter außerhalb sind gesperrt.');
    }

    const pii = sumHits(redactString(`${input.prompt}\n${input.negative_prompt ?? ''}`).hits);
    if (pii > 0) {
      await blockedEvidence(p, input.provider, 'pii_in_prompt', requestId);
      return err(422, 'PII_IN_PROMPT', 'Der Prompt enthält personenbezogene Daten (z. B. E-Mail, Telefon, IBAN). Bitte entfernen.');
    }

    const cfg = deps.providerConfig();
    if (!modelAvailable(model, cfg)) {
      return err(503, 'PROVIDER_NOT_CONFIGURED', `${model.label} ist nicht konfiguriert.`);
    }

    let ref: ResolvedReference | Response | undefined;
    try {
      ref = await resolveReference(p, input, model.acceptsReference);
    } catch (e) {
      logErr('reference_failed', requestId, e);
      return err(503, 'REFERENCE_UNAVAILABLE', 'Referenzbild konnte nicht geladen werden.');
    }
    if (ref instanceof Response) {
      await blockedEvidence(p, input.provider, 'reference_not_found', requestId);
      return ref;
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
        retryable: true,
      });
    }

    const modelId = resolveModelId(model, cfg);
    const units = mediaUnits(input.kind, input.duration_s);
    let reservation: ReserveResult;
    try {
      reservation = await deps.store.reserve({
        tenantId: p.tenantId,
        userId: p.userId,
        kind: input.kind,
        provider: input.provider,
        model: modelId,
        units,
        idempotencyKey: input.idempotency_key,
        params: {
          prompt_sha256: await deps.sha256(input.prompt),
          aspect_ratio: input.aspect_ratio,
          duration_s: input.duration_s ?? null,
          camera: input.camera ?? null,
          reference_job_id: input.reference?.job_id ?? null,
          request_id: requestId,
        },
      });
    } catch (e) {
      logErr('reserve_failed', requestId, e);
      return err(503, 'BUDGET_UNAVAILABLE', 'Kontingent nicht prüfbar; es wurde nichts generiert.');
    }
    if (!reservation.ok) {
      if (reservation.code === 'BUDGET_EXCEEDED') {
        await blockedEvidence(p, input.provider, 'budget_exceeded', requestId);
        return err(402, 'BUDGET_EXCEEDED', 'Das Media-Kontingent Ihres Mandanten für diesen Monat ist erschöpft oder nicht eingerichtet.', {
          used: reservation.used ?? null,
          limit: reservation.limit ?? null,
          needed: units,
        });
      }
      return err(400, reservation.code, 'Reservierung abgelehnt.');
    }

    const job = { id: reservation.jobId, kind: input.kind };
    if (reservation.replay) {
      // Wiederholter Aufruf mit demselben Schlüssel: nie ein zweiter Anbieteraufruf.
      if (reservation.status === 'completed') {
        const row = await deps.store.loadJob(job.id, p.tenantId);
        return ok({ status: 'completed', request_id: requestId, job_id: job.id, assets: await clientAssets(job, row?.asset_paths ?? []), replay: true });
      }
      if (reservation.status === 'submitted') return ok({ status: 'pending', request_id: requestId, job_id: job.id, replay: true });
      if (reservation.status === 'reserved') return err(409, 'IN_PROGRESS', 'Dieser Auftrag läuft bereits.');
      return err(409, 'ALREADY_FAILED', 'Dieser Auftrag ist bereits fehlgeschlagen. Neuer Versuch braucht einen neuen Schlüssel.');
    }

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
          reasons: [`job:${job.id}`, `units:${units}`, ...(input.reference ? ['studio_reference'] : [])],
          requestId,
          input: input.prompt,
        }),
      );
    } catch (e) {
      logErr('evidence_failed', requestId, e);
      await safeTransition(job.id, p.tenantId, 'released', { errorCode: 'EVIDENCE_UNAVAILABLE' }, requestId);
      return err(503, 'EVIDENCE_UNAVAILABLE', 'Nachweis konnte nicht geschrieben werden; es wurde nichts generiert.');
    }

    const started = deps.now();
    let result: ProviderResult;
    try {
      result = await generateWithProvider(input, model, cfg, deps.fetch, ref);
    } catch (e) {
      logErr('provider_throw', requestId, e);
      result = { status: 'failed', code: 'PROVIDER_TIMEOUT', message: 'Anbieter nicht erreichbar; Ergebnis unklar.', retryable: true };
    }
    deps.log({
      scope: 'media-studio',
      event: 'generate',
      request_id: requestId,
      tenant_id: p.tenantId,
      job_id: job.id,
      provider: input.provider,
      model: modelId,
      kind: input.kind,
      units,
      status: result.status,
      latency_ms: deps.now() - started,
    });
    return handleProviderResult(p, job, result, requestId, input.client_ref);
  }

  async function status(p: VerifiedPrincipal, body: Record<string, unknown>, requestId: string): Promise<Response> {
    const jobId = body.job_id;
    if (typeof jobId !== 'string' || !UUID_RE.test(jobId)) return err(400, 'BAD_REQUEST', 'job_id fehlt oder ist ungültig.');
    let job: JobRow | null;
    try {
      job = await deps.store.loadJob(jobId, p.tenantId);
    } catch (e) {
      logErr('load_failed', requestId, e);
      return err(503, 'JOBS_UNAVAILABLE', 'Auftrag nicht lesbar.');
    }
    // Fremde Aufträge sind für diesen Mandanten nicht existent.
    if (!job) return err(404, 'JOB_NOT_FOUND', 'Auftrag nicht gefunden.');

    if (job.status === 'completed') {
      return ok({ status: 'completed', request_id: requestId, job_id: job.id, assets: await clientAssets(job, job.asset_paths) });
    }
    if (job.status === 'failed' || job.status === 'released') return err(409, 'ALREADY_FAILED', 'Auftrag ist fehlgeschlagen.');
    if (job.status === 'reserved' || job.provider !== 'higgsfield' || !job.provider_request_id) {
      return ok({ status: 'pending', request_id: requestId, job_id: job.id });
    }

    const cfg = deps.providerConfig();
    if (!providerConfigured('higgsfield', cfg)) return err(503, 'PROVIDER_NOT_CONFIGURED', 'Higgsfield ist nicht konfiguriert.');
    let result: ProviderResult;
    try {
      result = await pollHiggsfield(job.provider_request_id, job.kind, job.model, cfg, deps.fetch);
    } catch {
      result = { status: 'failed', code: 'PROVIDER_ERROR', message: 'Anbieter nicht erreichbar.', retryable: true };
    }
    if (result.status === 'failed' && result.retryable) {
      // Statusabfrage gestört ≠ Auftrag fehlgeschlagen.
      return err(502, result.code, result.message, { retryable: true, request_id: requestId });
    }
    if (result.status === 'pending') return ok({ status: 'pending', request_id: requestId, job_id: job.id });
    return handleProviderResult(p, job, result, requestId);
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

