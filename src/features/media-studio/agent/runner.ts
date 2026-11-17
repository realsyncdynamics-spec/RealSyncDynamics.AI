/**
 * Regie-Agent, Schritt 2: den freigegebenen Plan ausführen.
 *
 * - Läuft nur mit Freigabe (`approvedAt`); ohne → Fehler, kein Aufruf.
 * - Abhängige Schritte (Video aus Keyframe) warten auf ihren Vorgänger und
 *   übernehmen dessen erstes Ergebnis inklusive Server-Signatur als Referenz.
 * - Asynchrone Aufträge werden mit Intervall abgefragt (Obergrenze).
 * - Genau ein Wiederholversuch bei vorübergehenden Fehlern; Policy-Ablehnungen
 *   (PII, Residency, Inhaltsfilter, Signatur) werden nie wiederholt.
 * - Jeder Schritt erzeugt Ereignisse für den sichtbaren Prüfpfad.
 *
 * Die Kosten-/Rechtegrenze setzt der Server; die Freigabe hier ist die
 * menschliche Bestätigung vor dem Auslösen kostenpflichtiger Aufrufe.
 */
import type { AspectRatio, MediaKind, MediaProviderId } from '../../../../supabase/functions/_shared/mediaStudio/catalog';
import type { Plan, PlanStep, StudioAsset } from './planner';

export interface GenerateRequest {
  kind: MediaKind;
  provider: MediaProviderId;
  prompt: string;
  negative_prompt?: string;
  aspect_ratio: AspectRatio;
  duration_s?: number;
  camera?: string;
  reference?: { mime_type?: string; data_base64?: string; url?: string; sig: string };
  client_ref?: string;
}

export interface JobHandle {
  provider: MediaProviderId;
  kind: MediaKind;
  model: string;
  provider_request_id: string;
  token: string;
}

export type GenerateOutcome =
  | { kind: 'completed'; assets: StudioAsset[]; model: string; requestId: string }
  | { kind: 'pending'; job: JobHandle; requestId: string }
  | { kind: 'error'; code: string; message: string; retryable: boolean; retryAfterMs?: number };

export interface StudioTools {
  generate: (req: GenerateRequest) => Promise<GenerateOutcome>;
  status: (job: JobHandle) => Promise<GenerateOutcome>;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  now: () => number;
}

export type AgentEventType = 'start' | 'submitted' | 'poll' | 'done' | 'retry' | 'error' | 'skip' | 'abort';

export interface AgentEvent {
  at: number;
  stepId: string;
  type: AgentEventType;
  message: string;
  requestId?: string;
}

export interface RunOptions {
  signal?: AbortSignal;
  pollIntervalMs?: number;
  maxPolls?: number;
  maxRetries?: number;
}

const NEVER_RETRY = new Set([
  'PII_IN_PROMPT',
  'RESIDENCY_EU_LOCAL',
  'REFERENCE_NOT_SIGNED',
  'CONTENT_REJECTED',
  'NOT_ENTITLED',
  'MEDIA_STUDIO_DISABLED',
  'BAD_REQUEST',
  'JOB_NOT_OWNED',
]);

export class PlanNotApprovedError extends Error {
  constructor() {
    super('Plan ist nicht freigegeben.');
    this.name = 'PlanNotApprovedError';
  }
}

/** Reihenfolge: unabhängige Schritte zuerst, dann deren Abhängige. */
export function executionOrder(steps: PlanStep[]): PlanStep[] {
  const done = new Set<string>();
  const ordered: PlanStep[] = [];
  const pending = [...steps];
  while (pending.length > 0) {
    const idx = pending.findIndex((s) => !s.referenceFrom || done.has(s.referenceFrom));
    // Zyklus oder fehlender Vorgänger: Rest in Originalreihenfolge (wird dann übersprungen).
    const next = idx === -1 ? pending[0] : pending[idx];
    pending.splice(idx === -1 ? 0 : idx, 1);
    done.add(next.id);
    ordered.push(next);
  }
  return ordered;
}

export function toRequest(step: PlanStep, reference?: StudioAsset): GenerateRequest {
  return {
    kind: step.kind,
    provider: step.provider,
    prompt: step.prompt,
    negative_prompt: step.negativePrompt || undefined,
    aspect_ratio: step.aspect,
    duration_s: step.kind === 'video' ? step.durationS : undefined,
    camera: step.kind === 'video' ? step.camera : undefined,
    reference: reference
      ? reference.data_base64
        ? { mime_type: reference.mime_type, data_base64: reference.data_base64, sig: reference.sig }
        : { url: reference.url, sig: reference.sig }
      : undefined,
    client_ref: step.id,
  };
}

export async function runPlan(
  plan: Plan,
  tools: StudioTools,
  onStep: (step: PlanStep) => void,
  onEvent: (event: AgentEvent) => void,
  opts: RunOptions = {},
): Promise<PlanStep[]> {
  if (!plan.approvedAt) throw new PlanNotApprovedError();
  const pollMs = opts.pollIntervalMs ?? 5_000;
  const maxPolls = opts.maxPolls ?? 72;
  const maxRetries = opts.maxRetries ?? 1;
  const results = new Map<string, PlanStep>();
  const emit = (stepId: string, type: AgentEventType, message: string, requestId?: string) =>
    onEvent({ at: tools.now(), stepId, type, message, requestId });
  const update = (step: PlanStep, patch: Partial<PlanStep>): PlanStep => {
    const next = { ...step, ...patch };
    results.set(step.id, next);
    onStep(next);
    return next;
  };

  for (const original of executionOrder(plan.steps)) {
    let step = original;
    if (opts.signal?.aborted) {
      update(step, { status: 'skipped', error: 'Abgebrochen.' });
      emit(step.id, 'abort', 'Ausführung abgebrochen.');
      continue;
    }
    if (step.status === 'skipped' || step.status === 'done') {
      results.set(step.id, step);
      continue;
    }

    let reference: StudioAsset | undefined;
    if (step.referenceFrom) {
      const parent = results.get(step.referenceFrom);
      reference = parent?.status === 'done' ? parent.assets?.[0] : undefined;
      if (!reference) {
        update(step, { status: 'skipped', error: 'Keyframe fehlt, weil der vorherige Schritt nicht fertig wurde.' });
        emit(step.id, 'skip', 'Übersprungen: Keyframe fehlt.');
        continue;
      }
    }

    step = update(step, { status: 'running', error: undefined });
    emit(step.id, 'start', `${step.kind === 'video' ? 'Video' : 'Bild'} über ${step.provider}${reference ? ' mit Keyframe' : ''}.`);

    let attempt = 0;
    let outcome: GenerateOutcome;
    for (;;) {
      outcome = await tools.generate(toRequest(step, reference));
      if (outcome.kind !== 'error' || !outcome.retryable || NEVER_RETRY.has(outcome.code) || attempt >= maxRetries || opts.signal?.aborted) break;
      attempt++;
      const wait = Math.min(outcome.retryAfterMs ?? 3_000, 60_000);
      emit(step.id, 'retry', `${outcome.message} Neuer Versuch in ${Math.round(wait / 1000)} s.`);
      await tools.sleep(wait, opts.signal);
    }

    let polls = 0;
    while (outcome.kind === 'pending') {
      if (polls === 0) {
        step = update(step, { status: 'waiting', requestId: outcome.requestId });
        emit(step.id, 'submitted', 'Auftrag angenommen, warte auf Ergebnis.', outcome.requestId);
      }
      if (opts.signal?.aborted) {
        outcome = { kind: 'error', code: 'ABORTED', message: 'Abgebrochen; der Anbieterauftrag läuft ggf. weiter.', retryable: false };
        break;
      }
      if (polls >= maxPolls) {
        outcome = { kind: 'error', code: 'POLL_TIMEOUT', message: 'Zeitlimit beim Warten auf den Anbieter.', retryable: false };
        break;
      }
      await tools.sleep(pollMs, opts.signal);
      polls++;
      const job: JobHandle = outcome.job;
      outcome = await tools.status(job);
      if (outcome.kind === 'error' && outcome.retryable) {
        emit(step.id, 'poll', `Statusabfrage gestört (${outcome.message}), versuche weiter.`);
        outcome = { kind: 'pending', job, requestId: step.requestId ?? '' };
      }
    }

    if (outcome.kind === 'completed') {
      update(step, { status: 'done', assets: outcome.assets, model: outcome.model, requestId: outcome.requestId });
      emit(step.id, 'done', `${outcome.assets.length} Ergebnis(se) von ${outcome.model}.`, outcome.requestId);
    } else if (outcome.kind === 'error') {
      update(step, { status: 'failed', error: outcome.message });
      emit(step.id, outcome.code === 'ABORTED' ? 'abort' : 'error', `${outcome.code}: ${outcome.message}`);
    }
  }

  return plan.steps.map((s) => results.get(s.id) ?? s);
}
