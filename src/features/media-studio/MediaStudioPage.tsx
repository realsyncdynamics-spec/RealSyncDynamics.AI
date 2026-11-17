/**
 * Media Studio — Bild- und Video-Builder mit Regie-Agent.
 *
 * Ablauf: Briefing → Agent plant (Anbieter, Format, Keyframe-Verkettung) →
 * Mensch prüft und gibt frei → Agent führt aus, fragt Aufträge ab, protokolliert
 * jeden Schritt im Prüfpfad. Server-Gates: supabase/functions/media-studio.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../core/access/TenantProvider';
import type { AspectRatio } from '../../../supabase/functions/_shared/mediaStudio/catalog';
import { CAMERA_PRESETS } from '../../../supabase/functions/_shared/mediaStudio/catalog';
import {
  approvePlan,
  planFromBrief,
  STYLES,
  summarizePlan,
  updateStep,
  USE_CASES,
  type Brief,
  type Plan,
  type PlanStep,
  type StepStatus,
} from './agent/planner';
import { runPlan, type AgentEvent } from './agent/runner';
import { assetSrc, createStudioTools, fetchCapabilities, type Capabilities } from './mediaStudioApi';

const ASPECTS: AspectRatio[] = ['16:9', '4:3', '1:1', '3:4', '9:16'];

const STATUS_LABEL: Record<StepStatus, string> = {
  planned: 'GEPLANT',
  running: 'LÄUFT',
  waiting: 'WARTET',
  done: 'FERTIG',
  failed: 'FEHLER',
  skipped: 'ÜBERSPRUNGEN',
};

const STATUS_CLASS: Record<StepStatus, string> = {
  planned: 'border-rs-border-strong text-rs-fg-2',
  running: 'border-rs-primary text-rs-primary-light',
  waiting: 'border-rs-warning text-rs-warning',
  done: 'border-rs-success text-rs-success',
  failed: 'border-rs-danger text-rs-danger',
  skipped: 'border-rs-border-strong text-rs-fg-3',
};

const field = 'w-full border border-rs-border-strong bg-rs-bg-0 px-3 py-2 text-sm text-rs-fg-0 focus:border-rs-primary focus:outline-none';
const label = 'mb-1 block font-mono text-[11px] uppercase tracking-wider text-rs-fg-2';
const btnPrimary = 'border border-rs-primary bg-rs-primary px-4 py-2 text-sm font-semibold text-white hover:bg-rs-primary-hover disabled:cursor-not-allowed disabled:opacity-40';
const btnGhost = 'border border-rs-border-strong px-4 py-2 text-sm text-rs-fg-1 hover:border-rs-fg-2 disabled:cursor-not-allowed disabled:opacity-40';

function time(at: number): string {
  return new Date(at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fileName(step: PlanStep, i: number, mime: string): string {
  const ext = mime.includes('mp4') ? 'mp4' : mime.includes('jpeg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
  return `realsync-${step.id}-${i + 1}.${ext}`;
}

export default function MediaStudioPage(): ReactElement {
  const { activeTenantId, loading: tenantLoading } = useTenant();
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [capsError, setCapsError] = useState<string | null>(null);
  const [brief, setBrief] = useState<Brief>({
    goal: '',
    useCase: 'landing_hero',
    industry: '',
    style: 'photo',
    aspect: '16:9',
    withVideo: false,
  });
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!activeTenantId) return;
    let cancelled = false;
    setCaps(null);
    setCapsError(null);
    void fetchCapabilities(activeTenantId).then((r) => {
      if (cancelled) return;
      if (r.ok) setCaps(r.data);
      else setCapsError(r.message);
    });
    return () => {
      cancelled = true;
    };
  }, [activeTenantId]);

  const anyAvailable = useMemo(() => caps?.models.some((m) => m.available) ?? false, [caps]);
  const videoAvailable = useMemo(() => caps?.models.some((m) => m.kind === 'video' && m.available) ?? false, [caps]);

  const makePlan = useCallback(() => {
    if (!caps) return;
    const r = planFromBrief(brief, caps.models);
    if (r.ok) {
      setPlan(r.plan);
      setPlanError(null);
      setEvents([]);
    } else {
      setPlan(null);
      setPlanError(r.reason);
    }
  }, [brief, caps]);

  const execute = useCallback(async () => {
    if (!plan || !activeTenantId) return;
    const approved = approvePlan(plan, Date.now());
    setPlan(approved);
    setRunning(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const steps = await runPlan(
        approved,
        createStudioTools(activeTenantId),
        (step) => setPlan((p) => (p ? { ...p, steps: p.steps.map((s) => (s.id === step.id ? step : s)) } : p)),
        (ev) => setEvents((list) => [...list, ev]),
        { signal: ctrl.signal },
      );
      // Nach dem Lauf ist die Freigabe verbraucht; erneutes Ausführen braucht eine neue.
      setPlan((p) => (p ? { ...p, steps, approvedAt: null } : p));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [plan, activeTenantId]);

  const resetForRerun = useCallback(() => {
    setPlan((p) => (p ? { ...p, approvedAt: null, steps: p.steps.map((s) => ({ ...s, status: 'planned', error: undefined, assets: undefined })) } : p));
    setEvents([]);
  }, []);

  const summary = plan ? summarizePlan(plan) : null;
  const pendingSteps = plan?.steps.some((s) => s.status === 'planned') ?? false;

  if (tenantLoading) return <div className="p-8 font-mono text-sm text-rs-fg-2">Lade Mandant …</div>;
  if (!activeTenantId) return <div className="p-8 text-sm text-rs-fg-1">Kein Mandant ausgewählt.</div>;

  return (
    <div className="min-h-screen bg-rs-bg-0 text-rs-fg-0">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rs-border px-6 py-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-rs-fg-3">Builder · Media Studio · Beta</div>
          <h1 className="text-xl font-semibold">Bilder und Videos für Ihre Seiten</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase">
          {caps && (
            <span className={`border px-2 py-1 ${caps.residency === 'cloud' ? 'border-rs-border-strong text-rs-fg-2' : 'border-rs-warning text-rs-warning'}`}>
              Residency: {caps.residency === 'cloud' ? 'Cloud freigegeben' : 'EU-lokal'}
            </span>
          )}
          {caps?.models.map((m) => (
            <span
              key={`${m.provider}-${m.kind}`}
              title={m.reason ?? m.model ?? ''}
              className={`border px-2 py-1 ${m.available ? 'border-rs-success text-rs-success' : 'border-rs-border-strong text-rs-fg-3'}`}
            >
              {m.provider} {m.kind === 'image' ? 'Bild' : 'Video'}
            </span>
          ))}
          <Link to="/build" className="border border-rs-border-strong px-2 py-1 text-rs-fg-1 hover:border-rs-fg-2">Zum Seiten-Builder</Link>
        </div>
      </header>

      {capsError && (
        <div className="mx-6 mt-4 border border-rs-danger px-4 py-3 text-sm text-rs-fg-1">{capsError}</div>
      )}
      {caps && !anyAvailable && (
        <div className="mx-6 mt-4 border border-rs-warning px-4 py-3 text-sm text-rs-fg-1">
          Für diesen Mandanten ist kein Bild- oder Videomodell nutzbar.{' '}
          {caps.models.find((m) => m.reason)?.reason}
        </div>
      )}

      <main className="grid gap-6 p-6 lg:grid-cols-[400px_1fr]">
        {/* ── Briefing + Plan ───────────────────────────────────────── */}
        <section className="space-y-6">
          <div className="border border-rs-border bg-rs-bg-1 p-4">
            <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-rs-fg-2">01 · Briefing an den Regie-Agenten</h2>
            <div className="space-y-3">
              <div>
                <span className={label}>Einsatz</span>
                <div className="grid grid-cols-2 gap-1">
                  {USE_CASES.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      title={u.hint}
                      onClick={() => setBrief((b) => ({ ...b, useCase: u.id, aspect: u.id === 'social_clip' ? '9:16' : b.aspect, withVideo: u.id === 'social_clip' ? true : b.withVideo }))}
                      className={`border px-2 py-2 text-left text-xs ${brief.useCase === u.id ? 'border-rs-primary text-rs-fg-0' : 'border-rs-border-strong text-rs-fg-2 hover:border-rs-fg-2'}`}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-rs-fg-3">{USE_CASES.find((u) => u.id === brief.useCase)?.hint}</p>
              </div>
              <label className="block">
                <span className={label}>Branche</span>
                <input className={field} value={brief.industry} placeholder="z. B. Dachdeckerei" onChange={(e) => setBrief({ ...brief, industry: e.target.value })} />
              </label>
              <label className="block">
                <span className={label}>Motiv</span>
                <textarea
                  className={`${field} min-h-24`}
                  value={brief.goal}
                  placeholder={brief.useCase === 'service_tiles' ? 'Dachsanierung, Dachfenster, Solar-Montage' : 'Neu gedecktes Ziegeldach im Morgenlicht, Einfamilienhaus'}
                  onChange={(e) => setBrief({ ...brief, goal: e.target.value })}
                />
                <span className="mt-1 block text-xs text-rs-fg-3">Keine Namen, Telefonnummern oder E-Mail-Adressen — der Server lehnt sie ab.</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={label}>Stil</span>
                  <select className={field} value={brief.style} onChange={(e) => setBrief({ ...brief, style: e.target.value as Brief['style'] })}>
                    {STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className={label}>Format</span>
                  <select className={field} value={brief.aspect} onChange={(e) => setBrief({ ...brief, aspect: e.target.value as AspectRatio })}>
                    {ASPECTS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </label>
              </div>
              <label className={`flex items-center gap-2 text-sm ${videoAvailable ? 'text-rs-fg-1' : 'text-rs-fg-3'}`}>
                <input type="checkbox" disabled={!videoAvailable} checked={brief.withVideo && videoAvailable} onChange={(e) => setBrief({ ...brief, withVideo: e.target.checked })} />
                Zusätzlich bewegtes Video erzeugen {videoAvailable ? '' : '(kein Videomodell verfügbar)'}
              </label>
              {brief.withVideo && videoAvailable && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className={label}>Kamera</span>
                    <select className={field} value={brief.camera ?? ''} onChange={(e) => setBrief({ ...brief, camera: e.target.value || undefined })}>
                      <option value="">Agent wählt</option>
                      {CAMERA_PRESETS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className={label}>Dauer (s)</span>
                    <input className={field} type="number" min={3} max={15} value={brief.durationS ?? 8} onChange={(e) => setBrief({ ...brief, durationS: Number(e.target.value) || undefined })} />
                  </label>
                </div>
              )}
              <button type="button" className={btnPrimary} disabled={!caps || !anyAvailable || running} onClick={makePlan}>
                Plan erstellen
              </button>
              {planError && <p className="text-sm text-rs-danger">{planError}</p>}
            </div>
          </div>

          {plan && (
            <div className="border border-rs-border bg-rs-bg-1 p-4">
              <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-rs-fg-2">02 · Plan prüfen und freigeben</h2>
              {plan.notes.length > 0 && (
                <ul className="mb-3 space-y-1 border-l-2 border-rs-primary pl-3 text-xs text-rs-fg-2">
                  {plan.notes.map((n) => <li key={n}>{n}</li>)}
                </ul>
              )}
              <ol className="space-y-3">
                {plan.steps.map((s) => (
                  <li key={s.id} className="border border-rs-border-strong p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{s.title}</span>
                      <span className={`border px-1.5 py-0.5 font-mono text-[10px] ${STATUS_CLASS[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                    </div>
                    <div className="mb-2 font-mono text-[11px] text-rs-fg-3">
                      {s.kind.toUpperCase()} · {s.provider} · {s.aspect}
                      {s.kind === 'video' ? ` · ${s.durationS}s · ${CAMERA_PRESETS.find((c) => c.id === s.camera)?.label ?? '—'}` : ''}
                      {s.referenceFrom ? ` · Keyframe ← ${s.referenceFrom}` : ''}
                    </div>
                    <textarea
                      className={`${field} min-h-20 text-xs`}
                      value={s.prompt}
                      disabled={running}
                      onChange={(e) => setPlan(updateStep(plan, s.id, { prompt: e.target.value }))}
                    />
                    {s.error && <p className="mt-1 text-xs text-rs-danger">{s.error}</p>}
                  </li>
                ))}
              </ol>
              {summary && (
                <div className="mt-4 border border-rs-border-strong bg-rs-bg-0 p-3 text-xs text-rs-fg-1">
                  <div className="mb-1 font-mono uppercase tracking-wider text-rs-fg-2">Freigabe löst aus</div>
                  {summary.images} Bild(er), {summary.videos} Video(s){summary.videos ? ` mit zusammen ${summary.videoSeconds} s` : ''} über{' '}
                  {summary.providers.join(', ')}. Die Verarbeitung erfolgt beim jeweiligen Anbieter außerhalb unserer EU-Infrastruktur;
                  Kosten entstehen im dort hinterlegten Anbieterkonto. Jeder Aufruf wird im Nachweis-Log Ihres Mandanten protokolliert.
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {!running && pendingSteps && (
                  <button type="button" className={btnPrimary} onClick={() => void execute()}>
                    Freigeben und ausführen
                  </button>
                )}
                {!running && !pendingSteps && (
                  <button type="button" className={btnGhost} onClick={resetForRerun}>Plan erneut vorbereiten</button>
                )}
                {running && (
                  <button type="button" className={btnGhost} onClick={() => abortRef.current?.abort()}>Abbrechen</button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── Ergebnisse + Prüfpfad ─────────────────────────────────── */}
        <section className="space-y-6">
          <div className="border border-rs-border bg-rs-bg-1 p-4">
            <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-rs-fg-2">03 · Ergebnisse</h2>
            {!plan?.steps.some((s) => s.assets?.length) && (
              <p className="text-sm text-rs-fg-3">Noch keine Ergebnisse. Erstellen Sie einen Plan und geben Sie ihn frei.</p>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {plan?.steps.flatMap((s) =>
                (s.assets ?? []).map((a, i) => (
                  <figure key={`${s.id}-${i}`} className="border border-rs-border-strong bg-rs-bg-0">
                    {a.kind === 'video' ? (
                      <video src={assetSrc(a)} controls loop muted playsInline className="block w-full" />
                    ) : (
                      <img src={assetSrc(a)} alt={s.title} className="block w-full" loading="lazy" />
                    )}
                    <figcaption className="flex flex-wrap items-center justify-between gap-2 p-2">
                      <span className="font-mono text-[11px] text-rs-fg-2">{s.title} · {s.model}</span>
                      <span className="flex gap-2">
                        <a className="border border-rs-border-strong px-2 py-1 text-xs text-rs-fg-1 hover:border-rs-fg-2" href={assetSrc(a)} download={fileName(s, i, a.mime_type)} target="_blank" rel="noreferrer">
                          Herunterladen
                        </a>
                      </span>
                    </figcaption>
                  </figure>
                )),
              )}
            </div>
            <p className="mt-3 text-xs text-rs-fg-3">
              Übernahme in den Seiten-Builder: Datei herunterladen und im Editor als Bild einsetzen. Eine direkte Ablage im
              Projekt folgt mit dem Asset-Speicher. Anbieter-Links (Higgsfield) sind laut Anbieter mindestens 7 Tage abrufbar.
            </p>
          </div>

          <div className="border border-rs-border bg-rs-bg-1 p-4">
            <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-rs-fg-2">Prüfpfad des Agenten</h2>
            {events.length === 0 ? (
              <p className="text-sm text-rs-fg-3">Noch keine Schritte ausgeführt.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="font-mono uppercase text-rs-fg-3">
                  <tr><th className="py-1 pr-3">Zeit</th><th className="pr-3">Schritt</th><th className="pr-3">Ereignis</th><th className="pr-3">Meldung</th><th>Request-ID</th></tr>
                </thead>
                <tbody>
                  {events.map((e, i) => (
                    <tr key={i} className="border-t border-rs-border align-top">
                      <td className="py-1 pr-3 font-mono text-rs-fg-2">{time(e.at)}</td>
                      <td className="pr-3 font-mono">{e.stepId}</td>
                      <td className="pr-3 font-mono uppercase">{e.type}</td>
                      <td className="pr-3 text-rs-fg-1">{e.message}</td>
                      <td className="font-mono text-rs-fg-3">{e.requestId?.slice(0, 8) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
