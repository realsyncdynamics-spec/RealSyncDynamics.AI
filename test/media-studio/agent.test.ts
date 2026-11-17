// Regie-Agent: Planung (Routing, Verkettung, Format) und Ausführung (Freigabe,
// Keyframe-Übergabe, Polling, Wiederholungen, Abbruch).

import { describe, it, expect } from 'vitest';
import {
  approvePlan,
  planFromBrief,
  splitServices,
  summarizePlan,
  updateStep,
  type Brief,
  type ModelAvailability,
  type PlanStep,
} from '../../src/features/media-studio/agent/planner';
import {
  executionOrder,
  PlanNotApprovedError,
  runPlan,
  type AgentEvent,
  type GenerateOutcome,
  type GenerateRequest,
  type StudioTools,
} from '../../src/features/media-studio/agent/runner';

const g = (kind: 'image' | 'video', available = true): ModelAvailability => ({
  provider: 'google',
  kind,
  label: `Google ${kind}`,
  available,
  reason: available ? null : 'nicht hinterlegt',
  aspect_ratios: kind === 'image' ? ['1:1', '16:9', '9:16', '4:3', '3:4'] : ['16:9', '9:16'],
  duration_s: kind === 'video' ? { min: 3, max: 15, default: 8 } : null,
  accepts_reference: 'inline',
  delivery: 'sync',
});
const h = (kind: 'image' | 'video', available = true): ModelAvailability => ({
  provider: 'higgsfield',
  kind,
  label: `Higgsfield ${kind}`,
  available,
  reason: available ? null : 'nicht hinterlegt',
  aspect_ratios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
  duration_s: kind === 'video' ? { min: 3, max: 10, default: 5 } : null,
  accepts_reference: kind === 'video' ? 'url' : 'none',
  delivery: 'async',
});

const brief = (o: Partial<Brief> = {}): Brief => ({
  goal: 'Neu gedecktes Ziegeldach im Morgenlicht',
  useCase: 'landing_hero',
  industry: 'Dachdeckerei',
  style: 'photo',
  aspect: '16:9',
  withVideo: false,
  ...o,
});

function plan(b: Brief, models: ModelAvailability[]) {
  const r = planFromBrief(b, models);
  if (!r.ok) throw new Error(r.reason);
  return r.plan;
}

describe('planFromBrief', () => {
  it('ohne verfügbares Bildmodell: kein Plan, Grund vom Server', () => {
    const r = planFromBrief(brief(), [g('image', false), h('image', false)]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('nicht hinterlegt');
  });

  it('bevorzugt Google für Bilder und verkettet Google-Video mit Keyframe', () => {
    const p = plan(brief({ withVideo: true, aspect: '4:3' }), [g('image'), g('video'), h('image'), h('video')]);
    expect(p.steps.map((s) => s.id)).toEqual(['img-1', 'vid-1']);
    expect(p.steps[0].provider).toBe('google');
    expect(p.steps[1].referenceFrom).toBe('img-1');
    // 4:3 kann das Video nicht → beide auf 16:9, mit Begründung.
    expect(p.steps[0].aspect).toBe('16:9');
    expect(p.steps[1].aspect).toBe('16:9');
    expect(p.notes.some((n) => n.includes('Keyframe'))).toBe(true);
  });

  it('Higgsfield-Bild (nur URL) → Higgsfield-Video mit Keyframe, Dauer begrenzt', () => {
    const p = plan(brief({ withVideo: true, durationS: 15 }), [g('image', false), h('image'), h('video')]);
    const vid = p.steps.find((s) => s.kind === 'video')!;
    expect(vid.provider).toBe('higgsfield');
    expect(vid.referenceFrom).toBe('img-1');
    expect(vid.durationS).toBe(10);
  });

  it('ohne passendes Video vom selben Anbieter: Video ohne Keyframe', () => {
    const p = plan(brief({ withVideo: true }), [g('image', false), h('image'), g('video')]);
    const vid = p.steps.find((s) => s.kind === 'video')!;
    expect(vid.provider).toBe('google');
    expect(vid.referenceFrom).toBeUndefined();
  });

  it('Leistungs-Kacheln: ein Bild pro Leistung, höchstens vier', () => {
    expect(splitServices('Dachsanierung, Dachfenster; Solar\nRinne, Gaube')).toHaveLength(4);
    const p = plan(brief({ useCase: 'service_tiles', goal: 'Dachsanierung, Dachfenster, Solar' }), [g('image')]);
    expect(p.steps.filter((s) => s.kind === 'image')).toHaveLength(3);
  });

  it('Social-Clip ist Hochformat, Negativ-Prompt schließt echte Personen und Schrift aus', () => {
    const p = plan(brief({ useCase: 'social_clip', withVideo: true }), [g('image'), g('video')]);
    expect(p.steps.every((s) => s.aspect === '9:16')).toBe(true);
    expect(p.steps[0].negativePrompt).toContain('recognizable real people');
    expect(p.steps[0].negativePrompt).toContain('text');
  });

  it('Bearbeiten nach Freigabe hebt die Freigabe auf; Zusammenfassung zählt richtig', () => {
    const p = approvePlan(plan(brief({ withVideo: true }), [g('image'), g('video')]), 1);
    expect(p.approvedAt).toBe(1);
    expect(updateStep(p, 'img-1', { prompt: 'neu' }).approvedAt).toBeNull();
    expect(summarizePlan(p)).toEqual({ images: 1, videos: 1, videoSeconds: 8, providers: ['google'] });
  });
});

function tools(responses: Record<string, GenerateOutcome[]>, statusResponses: GenerateOutcome[] = []) {
  const calls: GenerateRequest[] = [];
  let statusCalls = 0;
  const t: StudioTools = {
    generate: async (req) => {
      calls.push(req);
      const queue = responses[req.client_ref!];
      return queue.length > 1 ? queue.shift()! : queue[0];
    },
    status: async () => statusResponses[Math.min(statusCalls++, statusResponses.length - 1)],
    sleep: async () => {},
    now: () => 0,
  };
  return { t, calls, statusCount: () => statusCalls };
}

const img = (jobId = 'job-img'): GenerateOutcome => ({
  kind: 'completed', jobId, requestId: 'r1',
  assets: [{ kind: 'image', mime_type: 'image/png', url: `https://storage.example/${jobId}/0.png`, job_id: jobId, index: 0 }],
});

describe('runPlan', () => {
  it('verweigert ohne Freigabe', async () => {
    const p = plan(brief(), [g('image')]);
    await expect(runPlan(p, tools({ 'img-1': [img()] }).t, () => {}, () => {})).rejects.toBeInstanceOf(PlanNotApprovedError);
  });

  it('übergibt das Keyframe als Auftragsverweis (keine Bilddaten) an den Video-Schritt', async () => {
    const p = approvePlan(plan(brief({ withVideo: true }), [g('image'), g('video')]), 1);
    const vid: GenerateOutcome = { kind: 'completed', jobId: 'job-vid', requestId: 'r2', assets: [{ kind: 'video', mime_type: 'video/mp4', url: 'https://storage.example/v.mp4', job_id: 'job-vid', index: 0 }] };
    const { t, calls } = tools({ 'img-1': [img('job-key')], 'vid-1': [vid] });
    const steps = await runPlan(p, t, () => {}, () => {}, { runId: 'run-a' });
    expect(steps.map((s) => s.status)).toEqual(['done', 'done']);
    expect(calls[1].reference).toEqual({ job_id: 'job-key', index: 0 });
    expect(calls[1].camera).toBe('dolly_in');
    expect(calls.map((c) => c.idempotency_key)).toEqual(['run-a:img-1:0', 'run-a:vid-1:0']);
  });

  it('Kontingent erschöpft wird nicht wiederholt', async () => {
    const p = approvePlan(plan(brief(), [g('image')]), 1);
    const budget: GenerateOutcome = { kind: 'error', code: 'BUDGET_EXCEEDED', message: 'leer', retryable: true };
    const { t, calls } = tools({ 'img-1': [budget] });
    const steps = await runPlan(p, t, () => {}, () => {});
    expect(calls).toHaveLength(1);
    expect(steps[0].status).toBe('failed');
  });

  it('überspringt das Video, wenn das Keyframe fehlschlägt; PII wird nicht wiederholt', async () => {
    const p = approvePlan(plan(brief({ withVideo: true }), [g('image'), g('video')]), 1);
    const pii: GenerateOutcome = { kind: 'error', code: 'PII_IN_PROMPT', message: 'PII', retryable: true };
    const { t, calls } = tools({ 'img-1': [pii], 'vid-1': [img()] });
    const events: AgentEvent[] = [];
    const steps = await runPlan(p, t, () => {}, (e) => events.push(e));
    expect(calls).toHaveLength(1);
    expect(steps[0].status).toBe('failed');
    expect(steps[1].status).toBe('skipped');
    expect(events.map((e) => e.type)).toEqual(['start', 'error', 'skip']);
  });

  it('wiederholt vorübergehende Fehler genau einmal', async () => {
    const p = approvePlan(plan(brief(), [g('image')]), 1);
    const transient: GenerateOutcome = { kind: 'error', code: 'PROVIDER_ERROR', message: '503', retryable: true };
    const { t, calls } = tools({ 'img-1': [transient, transient, img()] });
    const steps = await runPlan(p, t, () => {}, () => {}, { runId: 'run-b' });
    expect(calls).toHaveLength(2);
    expect(steps[0].status).toBe('failed');
    // Jeder Versuch hat einen eigenen Schlüssel; der Server reserviert neu.
    expect(calls.map((c) => c.idempotency_key)).toEqual(['run-b:img-1:0', 'run-b:img-1:1']);
  });

  it('fragt asynchrone Aufträge ab, bis sie fertig sind, mit Obergrenze', async () => {
    const p = approvePlan(plan(brief(), [g('image', false), h('image')]), 1);
    const pending: GenerateOutcome = { kind: 'pending', jobId: 'job-async', requestId: 'r1' };
    const ok = tools({ 'img-1': [pending] }, [pending, pending, img()]);
    const done = await runPlan(p, ok.t, () => {}, () => {});
    expect(done[0].status).toBe('done');
    expect(ok.statusCount()).toBe(3);

    const never = tools({ 'img-1': [pending] }, [pending]);
    const timeout = await runPlan(p, never.t, () => {}, () => {}, { maxPolls: 4 });
    expect(timeout[0].status).toBe('failed');
    expect(never.statusCount()).toBe(4);
  });

  it('Abbruch: keine weiteren Aufrufe', async () => {
    const p = approvePlan(plan(brief({ useCase: 'service_tiles', goal: 'A1 Dach, B2 Fenster' }), [g('image')]), 1);
    const ctrl = new AbortController();
    const { t, calls } = tools({ 'img-1': [img()], 'img-2': [img()] });
    const steps = await runPlan(p, t, (s: PlanStep) => { if (s.status === 'done') ctrl.abort(); }, () => {}, { signal: ctrl.signal });
    expect(calls).toHaveLength(1);
    expect(steps[1].status).toBe('skipped');
  });

  it('executionOrder stellt Abhängige hinter ihre Vorgänger', () => {
    const s = (id: string, referenceFrom?: string) => ({ id, referenceFrom }) as PlanStep;
    expect(executionOrder([s('v', 'i'), s('i')]).map((x) => x.id)).toEqual(['i', 'v']);
  });
});
