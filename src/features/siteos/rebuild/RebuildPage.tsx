// Website-Rebuild — /app/siteos/rebuild[/:runId]
//
// DISCOVER → ASSESS → REBUILD auf dieser Seite; REFINE, PUBLISH, AUTOMATE
// und GOVERN im Workspace der gewählten Site (`/builder/:slug`).
//
// Was die Seite zeigt, kommt vom Server (Analyse) oder aus dem gespeicherten
// Lauf (RLS). Die Vorschauen der Richtungen werden aus demselben Snapshot
// mit demselben Kern abgeleitet wie auf dem Server — gleiche Eingabe, gleicher
// Blueprint. Weicht der Hash ab (andere Kern-Version), sagt die Seite das,
// statt eine Vorschau zu zeigen, die nicht übernommen würde.

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, CheckCircle2, ChevronLeft, CircleDashed, FileSearch, Globe, Loader2, Monitor, RefreshCw,
  ShieldCheck, Smartphone, Sparkles,
} from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { useSupabaseAuth } from '../../supabase/SupabaseAuthContext';
import {
  CRITERION_LABELS,
  assessSnapshot,
  buildDirection,
  canonicalHash,
  derivePositioning,
  evidenceById,
  getIndustryPreset,
  renderSite,
  type Assessment,
  type DirectionBuild,
  type DirectionKey,
  type EvidenceItem,
  type Known,
  type Positioning,
  type SourceSnapshot,
} from '../../../../packages/siteos-core/src/index';
import { analyzeWebsite, loadRun, selectDirection, type StoredRun } from './rebuildApi';
import { EvidenceDrawer, Pill, RebuildStepper, ScaledPreview, type StageKey } from './RebuildParts';

interface RunView {
  id: string;
  sourceUrl: string;
  resolvedUrl: string;
  host: string;
  status: 'analyzed' | 'selected';
  derivedAt: string;
  snapshot: SourceSnapshot;
  snapshotSha256: string;
  evidenceId: string | null;
  positioning: Positioning;
  assessment: Assessment;
  offered: { key: DirectionKey; blueprintSha256: string }[];
  siteSlug: string | null;
  selectedDirection: string | null;
}

type Phase = 'idle' | 'analyzing' | 'loading' | 'ready' | 'error';

const PROGRESS = [
  'robots.txt und Sitemap lesen',
  'Startseite und bis zu fünf Unterseiten abrufen',
  'Texte, Aufforderungen, Formulare, Marke und Vertrauenssignale belegen',
  'Acht Kriterien bewerten',
  'Richtungen aus der Marke ableiten',
  'Nachweis in die Evidence-Kette schreiben',
];

export default function RebuildPage(): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const { runId } = useParams<{ runId?: string }>();
  const { activeTenantId, loading: tenantLoading } = useTenant();
  const { isAuthenticated } = useSupabaseAuth();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialUrl = params.get('url') ?? params.get('domain') ?? '';
  const instruction = params.get('instruction') ?? '';

  const [urlInput, setUrlInput] = useState(initialUrl);
  const [phase, setPhase] = useState<Phase>(runId ? 'loading' : 'idle');
  const [error, setError] = useState('');
  const [run, setRun] = useState<RunView | null>(null);
  const [builds, setBuilds] = useState<DirectionBuild[] | null>(null);
  const [stale, setStale] = useState(false);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [drawer, setDrawer] = useState<{ title: string; ids: string[] } | null>(null);
  const [selecting, setSelecting] = useState<DirectionKey | null>(null);
  const [progress, setProgress] = useState(0);
  const autoStarted = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) navigate(`/welcome?next=${encodeURIComponent(location.pathname + location.search)}`);
  }, [isAuthenticated, navigate, location.pathname, location.search]);

  // ── Gespeicherten Lauf laden ─────────────────────────────────────────
  useEffect(() => {
    if (!runId || !activeTenantId) return;
    if (run?.id === runId) return;
    let cancelled = false;
    (async () => {
      setPhase('loading');
      try {
        const stored = await loadRun(activeTenantId, runId);
        if (cancelled) return;
        if (!stored) { setPhase('error'); setError('Diese Analyse gibt es in diesem Workspace nicht.'); return; }
        setRun(fromStored(stored));
        setPhase('ready');
      } catch (cause) {
        if (cancelled) return;
        setPhase('error');
        setError(cause instanceof Error ? cause.message : 'Die Analyse konnte nicht geladen werden.');
      }
    })();
    return () => { cancelled = true; };
  }, [runId, activeTenantId, run?.id]);

  // ── Richtungen ableiten (wie der Server) ─────────────────────────────
  useEffect(() => {
    if (!run) return;
    let cancelled = false;
    const positioning = derivePositioning(run.snapshot);
    const assessment = assessSnapshot(run.snapshot, positioning, run.derivedAt);
    // Mit derselben Laufbindung wie der Server (`origin.rebuild`): gleiche
    // Eingabe, gleicher Blueprint, gleicher Hash.
    const binding = { id: run.id, snapshotSha256: run.snapshotSha256 };
    const derived = run.offered.map((o) => buildDirection(run.snapshot, positioning, assessment, o.key, { createdAt: run.derivedAt, run: binding }));
    setBuilds(derived);
    (async () => {
      const hashes = await Promise.all(derived.map((b) => canonicalHash(b.blueprint)));
      if (!cancelled) setStale(hashes.some((h, i) => h !== run.offered[i].blueprintSha256));
    })();
    return () => { cancelled = true; };
  }, [run]);

  // ── Analyse starten ──────────────────────────────────────────────────
  const analyze = useCallback(async (raw: string) => {
    if (!activeTenantId) {
      setPhase('error');
      setError(tenantLoading ? 'Workspace wird noch geladen — bitte gleich erneut versuchen.' : 'Kein aktiver Workspace gefunden.');
      return;
    }
    const value = raw.trim();
    if (!value) { setError('Bitte die Adresse Ihrer bestehenden Website eingeben.'); return; }
    setPhase('analyzing'); setError(''); setProgress(0);
    const result = await analyzeWebsite({ tenant_id: activeTenantId, url: value });
    if (result.kind !== 'ok') {
      setPhase('error');
      setError(result.message);
      return;
    }
    const data = result.data;
    const view: RunView = {
      id: data.run.id,
      sourceUrl: data.snapshot.sourceUrl,
      resolvedUrl: data.snapshot.resolvedUrl,
      host: data.snapshot.host,
      status: 'analyzed',
      derivedAt: data.run.derived_at,
      snapshot: data.snapshot,
      snapshotSha256: data.run.snapshot_sha256,
      evidenceId: data.run.evidence_id,
      positioning: data.positioning,
      assessment: data.assessment,
      offered: data.directions.map((d) => ({ key: d.plan.key, blueprintSha256: d.blueprint_sha256 })),
      siteSlug: null,
      selectedDirection: null,
    };
    setRun(view);
    setPhase('ready');
    navigate(`/app/siteos/rebuild/${data.run.id}${instruction ? `?instruction=${encodeURIComponent(instruction)}` : ''}`, { replace: true });
  }, [activeTenantId, tenantLoading, navigate, instruction]);

  // Einstieg mit Adresse: vorausgefüllt, gestartet wird mit einem Klick.
  // Ein Link allein löst keinen Abruf aus — sonst könnte eine präparierte
  // Adresse die Sitzung eines angemeldeten Nutzers beliebige Seiten abrufen
  // und Nachweise in seinen Workspace schreiben lassen. Gleich gestartet
  // wird nur auf eine Absicht aus der App selbst (Navigationszustand, den
  // ein Link von außen nicht setzen kann), z. B. „neu analysieren" im Workspace.
  const inAppStart = (location.state as { autostart?: unknown } | null)?.autostart === true;
  useEffect(() => {
    if (runId || autoStarted.current || !initialUrl || !activeTenantId || !inAppStart) return;
    autoStarted.current = true;
    void analyze(initialUrl);
  }, [runId, initialUrl, activeTenantId, analyze, inAppStart]);

  // Ehrlicher Fortschritt: Stufen des Laufs der Reihe nach, ohne Prozentzahl.
  useEffect(() => {
    if (phase !== 'analyzing') return;
    const timer = window.setInterval(() => setProgress((p) => Math.min(p + 1, PROGRESS.length - 1)), 3500);
    return () => window.clearInterval(timer);
  }, [phase]);

  const evidence = useMemo(() => run ? evidenceById(run.snapshot) : new Map<string, EvidenceItem>(), [run]);
  const openEvidence = (title: string, ids: string[]) => setDrawer({ title, ids });

  const choose = async (key: DirectionKey) => {
    if (!run || !activeTenantId || selecting) return;
    setSelecting(key); setError('');
    const result = await selectDirection({ tenant_id: activeTenantId, run_id: run.id, direction: key });
    setSelecting(null);
    if (result.kind !== 'ok') { setError(result.message); return; }
    // Der Lauf reist nicht als Parameter mit: Der Workspace erfährt ihn vom
    // Server (Bindung im Blueprint), nicht aus der Adresse.
    const query = new URLSearchParams({ source: run.resolvedUrl, tab: 'refine' });
    if (instruction) query.set('instruction', instruction);
    navigate(`/builder/${encodeURIComponent(result.data.slug)}?${query.toString()}`);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void analyze(urlInput);
  };

  const stage: StageKey = !run ? 'discover' : run.status === 'selected' ? 'refine' : 'rebuild';
  const done: StageKey[] = run ? ['discover', 'assess', ...(run.status === 'selected' ? ['rebuild' as const] : [])] : [];

  return (
    <main className="min-h-screen bg-[#f3f5f7] text-[#111827]">
      <header className="sticky top-0 z-50 border-b border-black/[.08] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/app/siteos" className="rounded-lg p-2 hover:bg-black/[.05]" aria-label="Zur Übersicht"><ChevronLeft size={18} /></Link>
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#07111f] text-cyan-300"><Sparkles size={15} /></div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">Website-Rebuild</div>
              <div className="truncate text-[10px] text-black/45">{run ? run.host : 'Bestehende Website → belegter, gestalteter Neubau'}</div>
            </div>
          </div>
          {run && (
            <button type="button" onClick={() => openEvidence('Alle Belege der Analyse', run.snapshot.evidence.map((e) => e.id))} className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold text-emerald-700 sm:inline-flex" title={`Snapshot ${run.snapshotSha256}`}>
              <ShieldCheck size={13} /> {run.snapshot.evidence.length} Belege · {run.snapshotSha256.slice(0, 10)}…
            </button>
          )}
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-3 sm:px-6"><RebuildStepper current={stage} done={done} /></div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {(phase === 'idle' || (phase === 'error' && !run)) && (
          <section className="mx-auto max-w-2xl rounded-2xl border border-black/[.07] bg-white p-6 shadow-sm sm:p-8">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><Globe size={20} /></div>
            <h1 className="mt-4 text-xl font-bold tracking-tight">Welche Website sollen wir neu bauen?</h1>
            <p className="mt-2 text-sm leading-6 text-black/55">RealSync liest Ihre bestehende Website, bewertet sie mit Belegen und baut daraus zwei bis drei Richtungen — aus Ihren Inhalten und Ihrer Marke, nicht aus einer Vorlage.</p>
            <form onSubmit={submit} className="mt-5 flex flex-col gap-2 sm:flex-row">
              <label htmlFor="rebuild-url" className="sr-only">Adresse Ihrer bestehenden Website</label>
              <input id="rebuild-url" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} inputMode="url" autoComplete="url" placeholder="ihre-firma.de" className="min-w-0 flex-1 rounded-xl border border-black/[.1] px-4 py-3 text-sm outline-none focus:border-cyan-500" />
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#111827] px-5 py-3 text-sm font-bold text-white">Analysieren <ArrowRight size={15} /></button>
            </form>
            {initialUrl && phase === 'idle' && <p className="mt-2 text-[11px] leading-5 text-black/50">Adresse aus dem Link übernommen — bitte prüfen und mit „Analysieren" starten. Abgerufen wird erst nach Ihrem Klick.</p>}
            {error && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-700">{error}</p>}
            <ul className="mt-6 grid gap-2 text-xs leading-5 text-black/55 sm:grid-cols-2">
              <li className="flex gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" /> Bis zu sechs Seiten, robots.txt wird beachtet.</li>
              <li className="flex gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" /> Jede Aussage mit Beleg: Seite, Element, Auszug, Zeitpunkt, SHA-256.</li>
              <li className="flex gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" /> Kein HTML gespeichert — nur Auszüge und Hashes.</li>
              <li className="flex gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" /> Keine erfundenen Referenzen, Zahlen oder Siegel. Nichts geht ohne Ihr GO online.</li>
            </ul>
          </section>
        )}

        {phase === 'analyzing' && (
          <section className="mx-auto max-w-2xl rounded-2xl border border-black/[.07] bg-white p-6 shadow-sm sm:p-8" aria-live="polite">
            <div className="flex items-center gap-3"><Loader2 className="animate-spin text-cyan-600" size={20} /><h1 className="text-lg font-bold">Website wird gelesen …</h1></div>
            <p className="mt-2 text-xs text-black/50">Dauert meist 10–40 Sekunden.</p>
            <ol className="mt-5 space-y-2">
              {PROGRESS.map((label, index) => (
                <li key={label} className={`flex items-center gap-2 text-xs ${index < progress ? 'text-black/55' : index === progress ? 'font-semibold text-[#111827]' : 'text-black/35'}`}>
                  {index < progress ? <CheckCircle2 size={14} className="text-emerald-600" /> : index === progress ? <Loader2 size={14} className="animate-spin text-cyan-600" /> : <CircleDashed size={14} />}
                  {label}
                </li>
              ))}
            </ol>
          </section>
        )}

        {phase === 'loading' && <div className="grid min-h-[40vh] place-items-center text-xs text-black/45"><Loader2 className="animate-spin" size={18} /></div>}

        {phase === 'error' && run && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}

        {run && phase !== 'analyzing' && (
          <div className="space-y-6">
            {error && phase === 'ready' && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
            <DiscoverSummary run={run} onEvidence={openEvidence} />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <PositioningCard positioning={run.positioning} onEvidence={openEvidence} />
              <AssessmentCard assessment={run.assessment} onEvidence={openEvidence} />
            </div>

            <section aria-labelledby="richtungen">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="richtungen" className="text-lg font-bold tracking-tight">Richtungen</h2>
                  <p className="text-xs text-black/50">Dieselben belegten Inhalte, anders angeordnet und gewichtet. Leere Abschnitte werden weggelassen, nicht aufgefüllt.</p>
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-black/[.05] p-1" role="group" aria-label="Gerät der Vorschau">
                  <button type="button" onClick={() => setDevice('desktop')} aria-pressed={device === 'desktop'} className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] ${device === 'desktop' ? 'bg-white shadow' : ''}`}><Monitor size={13} /> Desktop</button>
                  <button type="button" onClick={() => setDevice('mobile')} aria-pressed={device === 'mobile'} className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] ${device === 'mobile' ? 'bg-white shadow' : ''}`}><Smartphone size={13} /> Mobil</button>
                </div>
              </div>
              {stale && (
                <p role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> Diese Analyse stammt aus einer älteren Version des Rebuilds; die Vorschau entspräche nicht dem, was übernommen würde.
                  <button type="button" onClick={() => void analyze(run.sourceUrl)} className="ml-auto shrink-0 font-bold underline">Neu analysieren</button>
                </p>
              )}
              <div className={`grid gap-4 ${builds && builds.length === 3 ? 'xl:grid-cols-3' : ''} lg:grid-cols-2`}>
                {builds?.map((build) => (
                  <DirectionCard
                    key={build.plan.key}
                    build={build}
                    device={device}
                    selected={run.selectedDirection === build.plan.key}
                    busy={selecting === build.plan.key}
                    disabled={stale || selecting !== null}
                    onChoose={() => void choose(build.plan.key)}
                  />
                ))}
              </div>
              {run.status === 'selected' && run.siteSlug && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
                  <span>Übernommen: {run.selectedDirection}. Weiter mit Verfeinern, Veröffentlichen und nächsten Schritten im Workspace.</span>
                  <Link to={`/builder/${encodeURIComponent(run.siteSlug)}?source=${encodeURIComponent(run.resolvedUrl)}&tab=refine`} className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-3 py-2 font-bold text-white">Zum Workspace <ArrowRight size={13} /></Link>
                </div>
              )}
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[.07] pt-4 text-[11px] text-black/45">
              <span>Analyse {run.id.slice(0, 8)} · Nachweis {run.evidenceId ? run.evidenceId.slice(0, 8) : '—'} · abgeleitet {new Date(run.derivedAt).toLocaleString('de-DE')}</span>
              <button type="button" onClick={() => void analyze(run.sourceUrl)} className="inline-flex items-center gap-1.5 rounded-lg border border-black/[.1] bg-white px-3 py-1.5 font-semibold text-black/70"><RefreshCw size={12} /> Neu analysieren</button>
            </div>
          </div>
        )}
      </div>

      {drawer && (
        <EvidenceDrawer
          title={drawer.title}
          items={drawer.ids.map((id) => evidence.get(id)).filter((e): e is EvidenceItem => e !== undefined)}
          onClose={() => setDrawer(null)}
        />
      )}
    </main>
  );
}

function fromStored(stored: StoredRun): RunView {
  return {
    id: stored.id,
    sourceUrl: stored.source_url,
    resolvedUrl: stored.resolved_url,
    host: stored.host,
    status: stored.status,
    derivedAt: stored.directions.derivedAt,
    snapshot: stored.snapshot,
    snapshotSha256: stored.snapshot_sha256,
    evidenceId: stored.evidence_id,
    positioning: stored.positioning,
    assessment: stored.assessment,
    offered: stored.directions.items.map((i) => ({ key: i.plan.key, blueprintSha256: i.blueprint_sha256 })),
    siteSlug: stored.site_slug,
    selectedDirection: stored.selected_direction,
  };
}

// ─────────────────────────────────────────────────────────────────────
// DISCOVER
// ─────────────────────────────────────────────────────────────────────

function DiscoverSummary({ run, onEvidence }: { run: RunView; onEvidence: (title: string, ids: string[]) => void }): ReactElement {
  const { snapshot } = run;
  return (
    <section className="rounded-2xl border border-black/[.07] bg-white p-5 shadow-sm" aria-labelledby="gelesen">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="gelesen" className="text-sm font-bold">Gelesen: {snapshot.pages.length} Seite{snapshot.pages.length === 1 ? '' : 'n'} von {run.host}</h2>
          <p className="mt-1 text-xs text-black/50">
            robots.txt {snapshot.robots.found ? 'vorhanden und beachtet' : 'nicht vorhanden'} · Sitemap {snapshot.sitemap.found ? `mit ${snapshot.sitemap.urlCount} Adressen` : 'nicht gefunden'}
            {snapshot.crawl.skipped.length > 0 ? ` · ${snapshot.crawl.skipped.length} nicht gelesen` : ''}
          </p>
        </div>
        <a href={run.resolvedUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-cyan-700 underline-offset-2 hover:underline">Ausgangsseite öffnen</a>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {snapshot.pages.map((page) => (
          <li key={page.url} className="rounded-xl border border-black/[.06] px-3 py-2">
            <div className="truncate text-xs font-semibold">{page.title ?? new URL(page.url).pathname}</div>
            <div className="truncate font-mono text-[10px] text-black/45">{new URL(page.url).pathname} · HTTP {page.statusCode} · {(page.bytes / 1024).toFixed(0)} KB</div>
            <button type="button" onClick={() => onEvidence(`Dokument ${new URL(page.url).pathname}`, [page.documentEv])} className="mt-1 font-mono text-[10px] text-black/40 hover:text-cyan-700">sha256 {page.documentSha256?.slice(0, 16) ?? '—'}…</button>
          </li>
        ))}
      </ul>
      {snapshot.crawl.skipped.length > 0 && (
        <details className="mt-3 text-[11px] text-black/50">
          <summary className="cursor-pointer font-semibold">Nicht gelesen ({snapshot.crawl.skipped.length})</summary>
          <ul className="mt-2 space-y-1">{snapshot.crawl.skipped.slice(0, 20).map((s) => <li key={s.url} className="break-all font-mono text-[10px]">{s.url} — {s.reason}</li>)}</ul>
        </details>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ASSESS
// ─────────────────────────────────────────────────────────────────────

const AUDIENCE: Record<string, string> = { b2b: 'Geschäftskunden', b2c: 'Privatkunden', beides: 'Geschäfts- und Privatkunden' };
const GOAL: Record<string, string> = { anfrage: 'Anfrage', termin: 'Termin', anruf: 'Anruf', kauf: 'Kauf', demo: 'Demo' };

function PositioningCard({ positioning, onEvidence }: { positioning: Positioning; onEvidence: (title: string, ids: string[]) => void }): ReactElement {
  const rows: [string, Known<unknown>, (v: unknown) => string][] = [
    ['Unternehmen', positioning.companyName, (v) => String(v)],
    ['Angebot', positioning.offer, (v) => (v as string[]).join(', ')],
    ['Branche', positioning.industry, (v) => getIndustryPreset(v as Parameters<typeof getIndustryPreset>[0]).label],
    ['Zielgruppe', positioning.audience, (v) => AUDIENCE[String(v)] ?? String(v)],
    ['Ziel der Seite', positioning.conversionGoal, (v) => GOAL[String(v)] ?? String(v)],
    ['Ort', positioning.locality, (v) => String(v)],
    ['Ansprache', positioning.tone, (v) => (v === 'du' ? 'Du' : 'Sie')],
    ['Nutzenversprechen', positioning.valueProposition, (v) => String(v)],
  ];
  return (
    <section className="rounded-2xl border border-black/[.07] bg-white p-5 shadow-sm" aria-labelledby="positionierung">
      <h2 id="positionierung" className="text-sm font-bold">Positionierung</h2>
      <p className="mt-1 text-xs text-black/50">Aus dem Wortlaut der Seite abgeleitet. Was nicht sicher bestimmbar ist, bleibt offen.</p>
      <dl className="mt-4 divide-y divide-black/[.06]">
        {rows.map(([label, field, format]) => (
          <div key={label} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 py-2.5">
            <dt className="text-[11px] font-semibold text-black/50">{label}</dt>
            <dd className="min-w-0 text-xs leading-5">
              {field.status === 'known' ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 break-words">{format(field.value)}</span>
                  <button type="button" onClick={() => onEvidence(label, field.evidence)} className="inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-700 hover:underline"><FileSearch size={11} /> {field.evidence.length} Beleg{field.evidence.length === 1 ? '' : 'e'}</button>
                  {field.confidence !== 'high' && <Pill tone="muted">{field.confidence === 'medium' ? 'mittlere Sicherheit' : 'geringe Sicherheit'}</Pill>}
                </span>
              ) : (
                <span className="text-black/45"><Pill tone="warn">offen</Pill> <span className="ml-1">{field.reason}</span></span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function AssessmentCard({ assessment, onEvidence }: { assessment: Assessment; onEvidence: (title: string, ids: string[]) => void }): ReactElement {
  const [open, setOpen] = useState(false);
  const findings = open ? assessment.findings : assessment.findings.slice(0, 5);
  return (
    <section className="rounded-2xl border border-black/[.07] bg-white p-5 shadow-sm" aria-labelledby="bewertung">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="bewertung" className="text-sm font-bold">Bewertung</h2>
          <p className="mt-1 text-xs text-black/50">Heuristik aus benannten, belegten Befunden — keine Conversion-Prognose.</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums">{assessment.overall}</div>
          <div className="text-[10px] text-black/40">von 100</div>
        </div>
      </div>
      <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {assessment.criteria.map((c) => (
          <li key={c.criterion}>
            <div className="flex items-center justify-between text-[11px]"><span className="font-semibold text-black/70">{CRITERION_LABELS[c.criterion]}</span><span className="tabular-nums text-black/50">{c.score}</span></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/[.06]" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.score} aria-label={CRITERION_LABELS[c.criterion]}>
              <div className={`h-full rounded-full ${c.status === 'good' ? 'bg-emerald-500' : c.status === 'fair' ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${c.score}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <h3 className="mt-5 text-[10px] font-bold uppercase tracking-[.16em] text-black/40">Befunde ({assessment.findings.length})</h3>
      <ul className="mt-2 space-y-2">
        {findings.map((f) => (
          <li key={`${f.code}-${f.pageUrl}`} className="rounded-xl border border-black/[.06] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={f.severity === 'high' ? 'bad' : f.severity === 'medium' ? 'warn' : 'muted'}>{f.severity === 'high' ? 'hoch' : f.severity === 'medium' ? 'mittel' : f.severity === 'low' ? 'niedrig' : 'Hinweis'}</Pill>
              <span className="text-xs font-semibold">{f.title}</span>
            </div>
            <p className="mt-1 text-[11px] leading-5 text-black/55">{f.detail}</p>
            <p className="mt-1 text-[11px] leading-5 text-emerald-800">→ {f.recommendation}</p>
            <button type="button" onClick={() => onEvidence(f.title, f.evidence)} className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-700 hover:underline"><FileSearch size={11} /> {f.evidence.length} Beleg{f.evidence.length === 1 ? '' : 'e'}</button>
          </li>
        ))}
      </ul>
      {assessment.findings.length > 5 && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-2 text-[11px] font-semibold text-black/60 hover:underline" aria-expanded={open}>{open ? 'Weniger anzeigen' : `Alle ${assessment.findings.length} Befunde anzeigen`}</button>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// REBUILD
// ─────────────────────────────────────────────────────────────────────

const ORIGIN_LABEL = { quelle: 'Wortlaut der Quelle', abgeleitet: 'aus Belegen zusammengesetzt', system: 'von der Plattform' } as const;
const KIND_LABEL: Record<string, string> = {
  hero: 'Hero', 'trust-bar': 'Vertrauensleiste', services: 'Leistungen', 'problem-solution': 'Anliegen & Lösung', process: 'Ablauf',
  testimonials: 'Kundenstimmen', 'case-study': 'Referenzen', faq: 'Häufige Fragen', 'contact-info': 'Kontaktdaten', 'contact-form': 'Anfrageformular',
  map: 'Anfahrt', governance: 'Datenschutz & Transparenz', about: 'Über uns', pricing: 'Preise', cta: 'Aufforderungsband',
};

function DirectionCard({ build, device, selected, busy, disabled, onChoose }: {
  build: DirectionBuild; device: 'desktop' | 'mobile'; selected: boolean; busy: boolean; disabled: boolean; onChoose: () => void;
}): ReactElement {
  const html = useMemo(() => renderSite(build.blueprint, { presentation: 'showcase' }).find((p) => p.path === '/')?.html ?? '', [build.blueprint]);
  const design = build.blueprint.design;
  return (
    <article className={`flex flex-col rounded-2xl border bg-white p-4 shadow-sm ${selected ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-black/[.07]'}`} aria-label={`Richtung ${build.plan.label}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold">{build.plan.label}</h3>
          <p className="mt-0.5 text-[11px] leading-5 text-black/55">{build.plan.tagline}</p>
        </div>
        {design && (
          <div className="flex shrink-0 items-center gap-1" aria-label="Farben des Design-Systems">
            {[design.palette.accent, design.palette.surface, design.palette.surfaceAlt, design.palette.foreground].map((c) => (
              <span key={c} title={c} className="h-4 w-4 rounded-full border border-black/10" style={{ background: c }} />
            ))}
          </div>
        )}
      </div>
      <div className="mt-3"><ScaledPreview html={html} title={`Vorschau ${build.plan.label}`} device={device} height={device === 'mobile' ? 560 : 440} /></div>
      <ul className="mt-3 space-y-1">
        {build.plan.rationale.map((r) => <li key={r} className="flex gap-2 text-[11px] leading-5 text-black/60"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600" />{r}</li>)}
      </ul>
      <details className="mt-3 text-[11px] text-black/55">
        <summary className="cursor-pointer font-semibold text-black/65">Abschnitte und Herkunft</summary>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {build.report.sections.map((s) => <li key={s.kind}><Pill tone={s.origin === 'quelle' ? 'ok' : s.origin === 'abgeleitet' ? 'info' : 'muted'}>{KIND_LABEL[s.kind] ?? s.kind} · {ORIGIN_LABEL[s.origin]}</Pill></li>)}
        </ul>
        {build.report.omitted.length > 0 && (
          <>
            <div className="mt-3 font-semibold text-black/65">Weggelassen</div>
            <ul className="mt-1 space-y-1">{build.report.omitted.map((o) => <li key={o.kind}>{KIND_LABEL[o.kind] ?? o.kind}: {o.reason}</li>)}</ul>
          </>
        )}
        {build.report.rejectedClaims.length > 0 && (
          <>
            <div className="mt-3 font-semibold text-black/65">Verworfene Formulierungen (unbelegt)</div>
            <ul className="mt-1 space-y-1">{build.report.rejectedClaims.map((r) => <li key={r}>{r}</li>)}</ul>
          </>
        )}
        {design && design.notes.length > 0 && (
          <>
            <div className="mt-3 font-semibold text-black/65">Design-System</div>
            <ul className="mt-1 space-y-1">{design.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </>
        )}
      </details>
      <button type="button" onClick={onChoose} disabled={disabled} className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#111827] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">
        {busy ? <Loader2 size={14} className="animate-spin" /> : null}
        {selected ? 'Erneut übernehmen' : 'Diese Richtung übernehmen'} <ArrowRight size={13} />
      </button>
    </article>
  );
}
