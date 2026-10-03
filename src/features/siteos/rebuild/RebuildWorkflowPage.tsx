/**
 * /build/rebuild — AI Rebuild Workflow.
 *
 * DISCOVER → ASSESS → REBUILD → REFINE → PUBLISH → AUTOMATE → GOVERN
 *
 * Der Nutzer gibt eine bestehende Website-URL ein. Der Server liest sie,
 * der Kern bewertet sie mit Belegen und erzeugt zwei bis drei gestaltete
 * Richtungen. Alles Weitere — Klartext-Revision, Komponenten-Editor,
 * Publish-Prüfung, GO, nächste Schritte — läuft über denselben Zustand.
 *
 * Ehrlichkeit:
 * - Der Zustand kommt vom Server (`siteos/rebuild-*`); der Browser rendert
 *   nur. Mandant und Rolle prüft die Edge Function, nie diese Datei.
 * - Vorschauen entstehen im Browser aus dem Kern — deterministisch, mit
 *   demselben Hash, den der Server für die Freigabe bindet.
 * - Platzhalter bleiben Platzhalter. Kein Score, keine Referenz, kein
 *   Preis, den die Quelle nicht hergab.
 * - Veröffentlichung nur nach ausdrücklichem GO mit Begründung.
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Check, ChevronDown, ChevronUp, Eye, EyeOff, Loader2, Monitor, ShieldCheck, Smartphone, Sparkles, Tablet } from 'lucide-react';
import {
  ASSESSMENT_CRITERION_LABEL,
  COMPONENT_CATALOG,
  REBUILD_COMPONENT_LABEL,
  REBUILD_STAGES,
  REBUILD_STAGE_LABEL,
  previewHtml,
  reachableStages,
  selectedDirection,
  type AssessmentFinding,
  type ComponentOperation,
  type Evidence,
  type RebuildComponent,
  type RebuildDirection,
  type RebuildDirectionKey,
  type RebuildStage,
  type RebuildWorkflowState,
} from '../../../../packages/siteos-core/src/index';
import { SandboxedPreviewFrame } from '../../../components/preview/SandboxedPreviewFrame';
import { useEntitlements } from '../../../core/billing/useEntitlements';
import { useTenant } from '../../../core/access/TenantProvider';
import { STATUS_LABEL } from '../../../product/implementation-status';
import { useSupabaseAuth } from '../../supabase/SupabaseAuthContext';
import { BuilderUpgradePanel } from '../BuilderUpgradePanel';
import { canOpenAppBuilder, resolveBuilderEntitlements, upgradeHrefFromAccess } from '../builderEntitlements';
import { errorMessage } from '../siteOsApi';
import {
  approveRebuild,
  checkRebuildReadiness,
  getRebuild,
  listRebuilds,
  refineRebuild,
  startRebuild,
  type RebuildListRow,
  type RebuildResponse,
} from './rebuildApi';

type Device = 'desktop' | 'tablet' | 'mobile';
const DEVICE_WIDTH: Record<Device, string> = { desktop: '100%', tablet: '834px', mobile: '390px' };

const QUICK_INSTRUCTIONS: readonly string[] = [
  'seriöser',
  'mehr Vertrauen',
  'weniger Startup, mehr Mittelstand',
  'mehr lokal',
  'CTA stärker',
  'Hero kürzer',
  'mehr wie Premium-Beratung',
  'für Handwerker',
  'für Steuerberater',
  'für KI-Governance',
];

const GOLD = '#e4cfa2';

// ─────────────────────────────────────────────────────────────────────
// Chrome
// ─────────────────────────────────────────────────────────────────────

function Chrome({ subtitle }: { subtitle: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-titanium-900 bg-obsidian-950/95 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Link to="/" className="grid h-8 w-8 place-items-center bg-[#e4cfa2] text-obsidian-950 shrink-0" aria-label="RealSync Startseite">
          <Sparkles size={15} />
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-sm font-semibold text-titanium-50">AI Rebuild</span>
            <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 border border-[#e4cfa2]/40 text-[#e4cfa2] bg-[#e4cfa2]/5">{STATUS_LABEL.preview}</span>
          </div>
          <p className="font-mono text-[10px] text-titanium-500 truncate">{subtitle}</p>
        </div>
      </div>
      <nav className="flex items-center gap-2 shrink-0">
        <Link to="/build" className="font-mono text-[10px] uppercase tracking-wider text-titanium-400 hover:text-[#e4cfa2] border border-titanium-800 px-2.5 py-1.5">Studio</Link>
        <Link to="/app" className="font-mono text-[10px] uppercase tracking-wider text-titanium-400 hover:text-[#e4cfa2] border border-titanium-800 px-2.5 py-1.5">Command Center</Link>
      </nav>
    </header>
  );
}

function Stepper({ active, reachable, onSelect }: { active: RebuildStage; reachable: RebuildStage[]; onSelect: (s: RebuildStage) => void }) {
  return (
    <ol className="flex flex-wrap gap-1 border-b border-titanium-900 px-4 py-2" aria-label="Workflow-Stufen">
      {REBUILD_STAGES.map((stage, i) => {
        const can = reachable.includes(stage);
        const isActive = stage === active;
        return (
          <li key={stage}>
            <button
              type="button"
              disabled={!can}
              onClick={() => onSelect(stage)}
              className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1.5 border ${isActive ? 'border-[#e4cfa2] text-[#e4cfa2] bg-[#e4cfa2]/10' : can ? 'border-titanium-800 text-titanium-300 hover:text-titanium-50' : 'border-titanium-900 text-titanium-700 cursor-not-allowed'}`}
              aria-current={isActive ? 'step' : undefined}
            >
              {i + 1} · {REBUILD_STAGE_LABEL[stage]}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Panel({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border border-titanium-900 bg-obsidian-900/40">
      <header className="flex items-center justify-between gap-3 border-b border-titanium-900 px-4 py-2.5">
        <h2 className="font-display text-sm font-semibold text-titanium-50">{title}</h2>
        {aside}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Seite
// ─────────────────────────────────────────────────────────────────────

export default function RebuildWorkflowPage() {
  const [params, setParams] = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const { activeTenantId, loading: tenantLoading } = useTenant();
  const { tier, features, canAccess } = useEntitlements();
  const entitlements = useMemo(() => resolveBuilderEntitlements(tier, features), [tier, features]);
  const entitled = canOpenAppBuilder(entitlements);
  const upgradeHref = upgradeHrefFromAccess(canAccess('siteos.builder').upgradeUrl);

  const [response, setResponse] = useState<RebuildResponse | null>(null);
  const [recent, setRecent] = useState<RebuildListRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [stage, setStage] = useState<RebuildStage>('discover');
  const [device, setDevice] = useState<Device>('desktop');
  const [url, setUrl] = useState(params.get('url') ?? '');

  const wf: RebuildWorkflowState | null = response?.state ?? null;
  const direction = wf ? selectedDirection(wf) : null;
  const reachable = wf ? reachableStages(wf) : ['discover' as RebuildStage];

  const previews = useMemo(() => {
    if (!wf) return {} as Record<RebuildDirectionKey, string>;
    const out: Partial<Record<RebuildDirectionKey, string>> = {};
    for (const d of wf.directions) {
      try { out[d.key] = previewHtml(wf, d); } catch { out[d.key] = ''; }
    }
    return out as Record<RebuildDirectionKey, string>;
  }, [wf]);

  const rebuildId = params.get('id');

  const apply = useCallback((res: RebuildResponse, next?: RebuildStage) => {
    setResponse(res);
    setError('');
    if (next) setStage(next);
    else setStage(res.state.stage);
  }, []);

  // Wiederaufnahme über ?id=
  useEffect(() => {
    if (!isAuthenticated || !activeTenantId || !rebuildId || response?.rebuild_id === rebuildId) return;
    let cancelled = false;
    setBusy('Rebuild wird geladen…');
    getRebuild({ tenant_id: activeTenantId, rebuild_id: rebuildId }).then((r) => {
      if (cancelled) return;
      setBusy(null);
      if (r.kind === 'ok') apply(r.data); else setError(errorMessage(r));
    });
    return () => { cancelled = true; };
  }, [isAuthenticated, activeTenantId, rebuildId, response?.rebuild_id, apply]);

  useEffect(() => {
    if (!isAuthenticated || !activeTenantId) return;
    listRebuilds(activeTenantId).then(setRecent).catch(() => setRecent([]));
  }, [isAuthenticated, activeTenantId, response?.version]);

  const run = useCallback(async (label: string, call: () => Promise<{ kind: 'ok'; data: RebuildResponse } | { kind: string }>, next?: RebuildStage) => {
    setBusy(label);
    setError('');
    const r = await call();
    setBusy(null);
    if (r.kind === 'ok') {
      const res = (r as { kind: 'ok'; data: RebuildResponse }).data;
      apply(res, next);
      if (params.get('id') !== res.rebuild_id) setParams({ id: res.rebuild_id }, { replace: true });
      return res;
    }
    setError(errorMessage(r as Parameters<typeof errorMessage>[0]));
    return null;
  }, [apply, params, setParams]);

  const onStart = (event: FormEvent) => {
    event.preventDefault();
    if (!activeTenantId) return;
    const trimmed = url.trim();
    if (!/^https?:\/\/\S+$/i.test(trimmed)) { setError('Bitte eine vollständige URL mit http(s):// eingeben.'); return; }
    void run('Website wird gelesen und bewertet…', () => startRebuild({ tenant_id: activeTenantId, url: trimmed }), 'assess');
  };

  const onSelectDirection = (key: RebuildDirectionKey) => {
    if (!activeTenantId || !response) return;
    void run('Richtung wird übernommen…', () => refineRebuild({ tenant_id: activeTenantId, rebuild_id: response.rebuild_id, base_sha256: response.state_sha256, select: key }), 'refine');
  };

  const onInstruction = (instruction: string) => {
    if (!activeTenantId || !response || !instruction.trim()) return;
    void run('Anweisung wird angewandt…', () => refineRebuild({ tenant_id: activeTenantId, rebuild_id: response.rebuild_id, base_sha256: response.state_sha256, instruction: instruction.trim() }), 'refine');
  };

  const onOperations = (operations: ComponentOperation[]) => {
    if (!activeTenantId || !response || operations.length === 0) return;
    void run('Komponente wird geändert…', () => refineRebuild({ tenant_id: activeTenantId, rebuild_id: response.rebuild_id, base_sha256: response.state_sha256, operations }), 'refine');
  };

  const onReadiness = () => {
    if (!activeTenantId || !response) return;
    void run('Veröffentlichungsreife wird geprüft…', () => checkRebuildReadiness({ tenant_id: activeTenantId, rebuild_id: response.rebuild_id }), 'publish');
  };

  const onApprove = (reason: string) => {
    if (!activeTenantId || !response || !wf?.readiness) return;
    void run('GO wird festgehalten…', () => approveRebuild({ tenant_id: activeTenantId, rebuild_id: response.rebuild_id, artifact_sha256: wf.readiness!.artifactSha256, reason }), 'automate');
  };

  // ── Gates ─────────────────────────────────────────────────────────────
  if (authLoading || tenantLoading) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-50 grid place-items-center">
        <Loader2 className="h-5 w-5 animate-spin" aria-label="Sitzung wird geprüft" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to={`/welcome?next=${encodeURIComponent('/build/rebuild')}`} replace />;
  if (!entitled && entitlements.ssotReady) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-50">
        <Chrome subtitle="AI Rebuild · Freischaltung erforderlich" />
        <BuilderUpgradePanel snapshot={entitlements} reason="no_entitlement" upgradeHref={upgradeHref} />
      </div>
    );
  }
  if (!activeTenantId) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-50">
        <Chrome subtitle="AI Rebuild" />
        <p className="p-6 text-sm text-titanium-300">Kein aktiver Workspace. Bitte das Onboarding abschließen oder einen Workspace wählen.</p>
      </div>
    );
  }

  const subtitle = wf?.import
    ? `${wf.import.brand.name ?? wf.import.finalUrl} · ${wf.import.evidence.length} Belege · ${response?.state_sha256.slice(0, 12)}…`
    : 'Bestehende Website → belegte Analyse → gestalteter Rebuild';

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-50">
      <Chrome subtitle={subtitle} />
      <Stepper active={stage} reachable={reachable} onSelect={setStage} />

      {busy && (
        <div className="flex items-center gap-2 border-b border-titanium-900 bg-obsidian-900/60 px-4 py-2 text-xs text-titanium-300" role="status">
          <Loader2 size={14} className="animate-spin text-[#e4cfa2]" /> {busy}
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 border-b border-red-900/60 bg-red-950/30 px-4 py-2 text-xs text-red-200" role="alert">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <main className="p-4 space-y-4">
        {stage === 'discover' && (
          <DiscoverPanel url={url} setUrl={setUrl} onStart={onStart} busy={busy !== null} recent={recent} />
        )}
        {stage === 'assess' && wf?.assessment && wf.import && (
          <AssessPanel state={wf} onNext={() => setStage('rebuild')} />
        )}
        {stage === 'rebuild' && wf && (
          <DirectionsPanel state={wf} previews={previews} onSelect={onSelectDirection} busy={busy !== null} />
        )}
        {stage === 'refine' && wf && direction && (
          <RefinePanel
            state={wf}
            direction={direction}
            html={previews[direction.key] ?? ''}
            device={device}
            setDevice={setDevice}
            onInstruction={onInstruction}
            onOperations={onOperations}
            busy={busy !== null}
            approved={Boolean(response?.approved_at)}
            onNext={() => setStage('publish')}
          />
        )}
        {stage === 'publish' && wf && direction && (
          <PublishPanel state={wf} direction={direction} onReadiness={onReadiness} onApprove={onApprove} onOperations={onOperations} busy={busy !== null} approved={Boolean(response?.approved_at)} />
        )}
        {stage === 'automate' && wf && (
          <AutomatePanel state={wf} response={response} />
        )}
        {stage === 'govern' && wf && (
          <GovernPanel state={wf} response={response} />
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// DISCOVER
// ─────────────────────────────────────────────────────────────────────

function DiscoverPanel({ url, setUrl, onStart, busy, recent }: { url: string; setUrl: (v: string) => void; onStart: (e: FormEvent) => void; busy: boolean; recent: RebuildListRow[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
      <Panel title="1 · Discover — Website importieren">
        <form onSubmit={onStart} className="space-y-3">
          <label className="block text-xs text-titanium-400" htmlFor="rebuild-url">Bestehende Website-URL</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="rebuild-url"
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.ihre-website.de"
              className="min-w-0 flex-1 border border-titanium-800 bg-obsidian-950 px-3 py-2.5 text-sm text-titanium-50 placeholder:text-titanium-600 focus:border-[#e4cfa2] focus:outline-none"
              required
            />
            <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 bg-[#e4cfa2] px-4 py-2.5 text-sm font-semibold text-obsidian-950 disabled:opacity-60">
              Website analysieren <ArrowRight size={14} />
            </button>
          </div>
          <ul className="grid gap-1 text-[11px] text-titanium-500 sm:grid-cols-2">
            <li>Sitemap, Navigation, Texte, CTAs, Formulare</li>
            <li>Farben, Schriften, Logo, Bilder</li>
            <li>Trust-Signale und Positionierung — nur belegt</li>
            <li>Unsichere Felder bleiben leer, nichts wird geraten</li>
          </ul>
        </form>
      </Panel>
      <Panel title="Zuletzt">
        {recent.length === 0 ? (
          <p className="text-xs text-titanium-500">Noch kein Rebuild in diesem Workspace.</p>
        ) : (
          <ul className="space-y-1.5">
            {recent.map((r) => (
              <li key={r.id}>
                <Link to={`/build/rebuild?id=${r.id}`} className="block border border-titanium-900 px-3 py-2 hover:border-[#e4cfa2]/50">
                  <span className="block truncate text-xs text-titanium-100">{r.source_url}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">{REBUILD_STAGE_LABEL[r.stage]} · v{r.version}{r.approved_at ? ' · GO' : ''}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ASSESS
// ─────────────────────────────────────────────────────────────────────

function ScoreBar({ value }: { value: number }) {
  const tone = value >= 70 ? 'bg-emerald-400' : value >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="h-1.5 w-full bg-titanium-900" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <div className={`h-full ${tone}`} style={{ width: `${value}%` }} />
    </div>
  );
}

function EvidenceList({ ids, evidence }: { ids: string[]; evidence: Evidence[] }) {
  const items = evidence.filter((e) => ids.includes(e.id));
  if (items.length === 0) return null;
  return (
    <details className="mt-1.5">
      <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-[#e4cfa2]">{items.length} Beleg{items.length === 1 ? '' : 'e'}</summary>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((e) => (
          <li key={e.id} className="border border-titanium-900 bg-obsidian-950 p-2">
            <code className="block whitespace-pre-wrap break-all text-[10px] text-titanium-300">{e.excerpt}</code>
            <p className="mt-1 font-mono text-[9px] text-titanium-600">{e.kind} · {e.source} · {new Date(e.observedAt).toLocaleString('de-DE')} · sha256 {e.sha256.slice(0, 16)}…</p>
          </li>
        ))}
      </ul>
    </details>
  );
}

function FindingRow({ f, evidence }: { f: AssessmentFinding; evidence: Evidence[] }) {
  const tone = f.severity === 'critical' || f.severity === 'high' ? 'text-red-300' : f.severity === 'medium' ? 'text-amber-300' : 'text-titanium-300';
  return (
    <li className="border-t border-titanium-900 py-2">
      <div className="flex items-start gap-2">
        <span className={`font-mono text-[9px] uppercase tracking-wider ${tone} mt-0.5 w-14 shrink-0`}>{f.severity}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-titanium-100">{f.title}</p>
          <p className="text-[11px] text-titanium-400">{f.detail}</p>
          <p className="text-[11px] text-titanium-300"><span className="text-titanium-500">Empfehlung: </span>{f.recommendation}</p>
          <EvidenceList ids={f.evidenceIds} evidence={evidence} />
        </div>
      </div>
    </li>
  );
}

function AssessPanel({ state, onNext }: { state: RebuildWorkflowState; onNext: () => void }) {
  const a = state.assessment!;
  const imp = state.import!;
  return (
    <div className="space-y-4">
      <Panel
        title={`2 · Assess — Ist-Zustand von ${imp.brand.name ?? imp.finalUrl}`}
        aside={<button type="button" onClick={onNext} className="inline-flex items-center gap-1.5 bg-[#e4cfa2] px-3 py-1.5 text-xs font-semibold text-obsidian-950">Richtungen ansehen <ArrowRight size={12} /></button>}
      >
        <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
          <div className="border border-titanium-900 p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">Gesamtindex</p>
            <p className="font-display text-4xl font-semibold text-titanium-50">{a.overall}<span className="text-base text-titanium-500">/100</span></p>
            <ScoreBar value={a.overall} />
            <dl className="mt-3 space-y-1 text-[11px] text-titanium-400">
              <div className="flex justify-between"><dt>Befunde</dt><dd className="text-titanium-200">{a.findings.length}</dd></div>
              <div className="flex justify-between"><dt>Belege</dt><dd className="text-titanium-200">{imp.evidence.length}</dd></div>
              <div className="flex justify-between"><dt>Branche</dt><dd className="text-titanium-200">{imp.positioning.industry ?? 'unbekannt'}</dd></div>
              <div className="flex justify-between"><dt>Ziel</dt><dd className="text-titanium-200">{imp.positioning.conversionGoal}</dd></div>
              <div className="flex justify-between"><dt>Ort</dt><dd className="text-titanium-200">{imp.positioning.locality ?? 'unbekannt'}</dd></div>
            </dl>
            <p className="mt-3 font-mono text-[9px] text-titanium-600 break-all">Import sha256 {imp.htmlSha256.slice(0, 20)}…</p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {a.criteria.map((c) => (
              <li key={c.criterion} className="border border-titanium-900 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-titanium-100">{ASSESSMENT_CRITERION_LABEL[c.criterion]}</span>
                  <span className="font-mono text-xs text-titanium-300">{c.score}</span>
                </div>
                <ScoreBar value={c.score} />
                <p className="mt-1.5 text-[11px] text-titanium-400">{c.summary}</p>
                {c.findings.length > 0 && (
                  <ul className="mt-1">
                    {c.findings.map((f) => <FindingRow key={f.code} f={f} evidence={a.evidence} />)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      </Panel>
      <Panel title="Extrahierte Marke">
        <div className="grid gap-3 text-[11px] text-titanium-300 sm:grid-cols-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">Farben</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {imp.brand.colors.length === 0 && <li className="text-titanium-600">keine gesättigten Farben gefunden</li>}
              {imp.brand.colors.map((c) => <li key={c} className="flex items-center gap-1.5"><span className="inline-block h-4 w-4 border border-titanium-700" style={{ background: c }} /><code>{c}</code></li>)}
            </ul>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">Schriften</p>
            <p className="mt-1">{imp.brand.fonts.join(', ') || <span className="text-titanium-600">keine benannt</span>}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">Logo / Formulare / CTAs</p>
            <p className="mt-1">{imp.brand.logo ? 'Logo erkannt' : 'kein Logo erkannt'} · {imp.forms.length} Formular{imp.forms.length === 1 ? '' : 'e'} · {imp.ctas.length} CTAs · {imp.trust.length} Trust-Signale</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// REBUILD — Richtungen
// ─────────────────────────────────────────────────────────────────────

function Swatches({ d }: { d: RebuildDirection }) {
  const c = d.designSystem.colors;
  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] text-titanium-400">
      {[c.primary, c.accent, c.background, c.foreground].map((hex, i) => <span key={`${hex}-${i}`} className="inline-block h-4 w-4 border border-titanium-700" style={{ background: hex }} title={hex} />)}
      <span className="font-mono">{c.origin === 'brand' ? 'Markenfarbe' : c.origin === 'derived' ? 'aus Marke abgeleitet' : 'Fallback'}</span>
      <span>·</span>
      <span>{d.designSystem.typography.display.family.split(',')[0].replace(/"/g, '')}</span>
      <span>·</span>
      <span>{d.designSystem.mode === 'dark' ? 'dunkel' : 'hell'}</span>
    </div>
  );
}

function DirectionsPanel({ state, previews, onSelect, busy }: { state: RebuildWorkflowState; previews: Record<RebuildDirectionKey, string>; onSelect: (k: RebuildDirectionKey) => void; busy: boolean }) {
  return (
    <Panel title="3 · Rebuild — Richtungen">
      <div className="grid gap-4 lg:grid-cols-3">
        {state.directions.map((d) => (
          <article key={d.key} className={`flex flex-col border ${state.selectedDirection === d.key ? 'border-[#e4cfa2]' : 'border-titanium-900'}`}>
            <div className="border-b border-titanium-900 bg-white" style={{ height: 360 }}>
              <SandboxedPreviewFrame html={previews[d.key] ?? ''} title={`Vorschau ${d.label}`} decorative className="h-full w-full" style={{ transform: 'scale(0.5)', transformOrigin: '0 0', width: '200%', height: '200%' }} />
            </div>
            <div className="flex flex-1 flex-col gap-2 p-3">
              <h3 className="font-display text-base font-semibold text-titanium-50">{d.label}</h3>
              <p className="text-[11px] text-titanium-400">{d.tagline}</p>
              <p className="text-[11px] text-titanium-300">{d.rationale}</p>
              <Swatches d={d} />
              <p className="text-[11px] text-titanium-500">CTA: <span className="text-titanium-200">{d.primaryCta.label}</span>{d.secondaryCta ? <> · <span className="text-titanium-200">{d.secondaryCta.label}</span></> : null}</p>
              <p className="text-[11px] text-titanium-500">Platzhalter: {d.components.filter((c) => c.visible && c.placeholder).length} · Formularziel: {d.leadFlow.formTarget ? 'übernommen' : 'offen'}</p>
              <button type="button" disabled={busy} onClick={() => onSelect(d.key)} className="mt-auto inline-flex items-center justify-center gap-1.5 bg-[#e4cfa2] px-3 py-2 text-xs font-semibold text-obsidian-950 disabled:opacity-60">
                Diese Richtung verfeinern <ArrowRight size={12} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────────────
// REFINE — Klartext + Komponenten-Editor
// ─────────────────────────────────────────────────────────────────────

function DeviceToggle({ device, setDevice }: { device: Device; setDevice: (d: Device) => void }) {
  const items: { id: Device; icon: ReactNode; label: string }[] = [
    { id: 'desktop', icon: <Monitor size={13} />, label: 'Desktop' },
    { id: 'tablet', icon: <Tablet size={13} />, label: 'Tablet' },
    { id: 'mobile', icon: <Smartphone size={13} />, label: 'Mobil' },
  ];
  return (
    <div className="flex gap-1" role="group" aria-label="Gerät">
      {items.map((i) => (
        <button key={i.id} type="button" onClick={() => setDevice(i.id)} aria-pressed={device === i.id} aria-label={i.label} className={`grid h-7 w-7 place-items-center border ${device === i.id ? 'border-[#e4cfa2] text-[#e4cfa2]' : 'border-titanium-800 text-titanium-400'}`}>{i.icon}</button>
      ))}
    </div>
  );
}

function ComponentEditor({ c, index, count, onOperations, disabled }: { c: RebuildComponent; index: number; count: number; onOperations: (ops: ComponentOperation[]) => void; disabled: boolean }) {
  const spec = COMPONENT_CATALOG[c.kind];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [ctaLabel, setCtaLabel] = useState(c.cta?.label ?? '');
  const [ctaHref, setCtaHref] = useState(c.cta?.href ?? '');
  const [mediaSrc, setMediaSrc] = useState(c.media?.src ?? '');
  const [mediaAlt, setMediaAlt] = useState(c.media?.alt ?? '');
  const [target, setTarget] = useState(c.formTarget ?? '');

  const commitText = (field: string) => {
    const value = draft[field];
    if (value === undefined || value === (c.text[field] ?? '')) return;
    onOperations([{ op: 'set-text', id: c.id, field, value }]);
  };

  return (
    <li className={`border ${c.visible ? 'border-titanium-800' : 'border-titanium-900 opacity-70'} bg-obsidian-950`}>
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
          <span className="font-mono text-[9px] text-titanium-600 w-4">{index + 1}</span>
          <span className="truncate text-xs text-titanium-100">{REBUILD_COMPONENT_LABEL[c.kind]}</span>
          {c.placeholder && <span className="font-mono text-[9px] uppercase tracking-wider text-amber-300">Platzhalter</span>}
          {open ? <ChevronUp size={12} className="ml-auto text-titanium-500" /> : <ChevronDown size={12} className="ml-auto text-titanium-500" />}
        </button>
        <button type="button" disabled={disabled || index === 0} onClick={() => onOperations([{ op: 'move', id: c.id, to: index - 1 }])} aria-label="nach oben" className="grid h-6 w-6 place-items-center border border-titanium-800 text-titanium-400 disabled:opacity-30"><ChevronUp size={12} /></button>
        <button type="button" disabled={disabled || index === count - 1} onClick={() => onOperations([{ op: 'move', id: c.id, to: index + 1 }])} aria-label="nach unten" className="grid h-6 w-6 place-items-center border border-titanium-800 text-titanium-400 disabled:opacity-30"><ChevronDown size={12} /></button>
        <button type="button" disabled={disabled || c.kind === 'hero'} onClick={() => onOperations([{ op: 'set-visible', id: c.id, visible: !c.visible }])} aria-label={c.visible ? 'ausblenden' : 'einblenden'} aria-pressed={c.visible} className="grid h-6 w-6 place-items-center border border-titanium-800 text-titanium-400 disabled:opacity-30">{c.visible ? <Eye size={12} /> : <EyeOff size={12} />}</button>
      </div>
      {open && (
        <div className="space-y-2 border-t border-titanium-900 p-2 text-[11px]">
          <label className="block">
            <span className="font-mono text-[9px] uppercase tracking-wider text-titanium-500">Stilvariante</span>
            <select value={c.variant} disabled={disabled} onChange={(e) => onOperations([{ op: 'set-variant', id: c.id, variant: e.target.value }])} className="mt-0.5 block w-full border border-titanium-800 bg-obsidian-950 px-2 py-1 text-xs text-titanium-100">
              {spec.variants.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          {spec.textFields.map((field) => (
            <label key={field} className="block">
              <span className="font-mono text-[9px] uppercase tracking-wider text-titanium-500">{field}</span>
              <textarea
                rows={field === 'headline' || field === 'heading' ? 1 : 2}
                disabled={disabled}
                value={draft[field] ?? c.text[field] ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
                onBlur={() => commitText(field)}
                className="mt-0.5 block w-full border border-titanium-800 bg-obsidian-950 px-2 py-1 text-xs text-titanium-100"
              />
            </label>
          ))}
          {spec.cta && (
            <div className="grid grid-cols-2 gap-1.5">
              <label className="block"><span className="font-mono text-[9px] uppercase tracking-wider text-titanium-500">CTA-Text</span><input value={ctaLabel} disabled={disabled} onChange={(e) => setCtaLabel(e.target.value)} className="mt-0.5 block w-full border border-titanium-800 bg-obsidian-950 px-2 py-1 text-xs text-titanium-100" /></label>
              <label className="block"><span className="font-mono text-[9px] uppercase tracking-wider text-titanium-500">CTA-Ziel</span><input value={ctaHref} disabled={disabled} onChange={(e) => setCtaHref(e.target.value)} onBlur={() => { if (ctaLabel && ctaHref && (ctaLabel !== c.cta?.label || ctaHref !== c.cta?.href)) onOperations([{ op: 'set-cta', id: c.id, cta: { label: ctaLabel, href: ctaHref, origin: 'proposed' } }]); }} className="mt-0.5 block w-full border border-titanium-800 bg-obsidian-950 px-2 py-1 text-xs text-titanium-100" /></label>
            </div>
          )}
          {spec.media && (
            <div className="grid grid-cols-2 gap-1.5">
              <label className="block"><span className="font-mono text-[9px] uppercase tracking-wider text-titanium-500">Bild (https)</span><input value={mediaSrc} disabled={disabled} onChange={(e) => setMediaSrc(e.target.value)} className="mt-0.5 block w-full border border-titanium-800 bg-obsidian-950 px-2 py-1 text-xs text-titanium-100" /></label>
              <label className="block"><span className="font-mono text-[9px] uppercase tracking-wider text-titanium-500">Alt-Text</span><input value={mediaAlt} disabled={disabled} onChange={(e) => setMediaAlt(e.target.value)} onBlur={() => { if (mediaSrc !== (c.media?.src ?? '') || mediaAlt !== (c.media?.alt ?? '')) onOperations([{ op: 'set-media', id: c.id, media: mediaSrc ? { src: mediaSrc, alt: mediaAlt || null, origin: 'import' } : null }]); }} className="mt-0.5 block w-full border border-titanium-800 bg-obsidian-950 px-2 py-1 text-xs text-titanium-100" /></label>
            </div>
          )}
          {spec.formTarget && (
            <label className="block"><span className="font-mono text-[9px] uppercase tracking-wider text-titanium-500">Formularziel (https oder mailto)</span><input value={target} disabled={disabled} onChange={(e) => setTarget(e.target.value)} onBlur={() => { if (target !== (c.formTarget ?? '')) onOperations([{ op: 'set-form-target', id: c.id, formTarget: target || null }]); }} className="mt-0.5 block w-full border border-titanium-800 bg-obsidian-950 px-2 py-1 text-xs text-titanium-100" /></label>
          )}
        </div>
      )}
    </li>
  );
}

function RefinePanel({ state, direction, html, device, setDevice, onInstruction, onOperations, busy, approved, onNext }: {
  state: RebuildWorkflowState; direction: RebuildDirection; html: string; device: Device; setDevice: (d: Device) => void;
  onInstruction: (i: string) => void; onOperations: (ops: ComponentOperation[]) => void; busy: boolean; approved: boolean; onNext: () => void;
}) {
  const [draft, setDraft] = useState('');
  const last = state.revisions[state.revisions.length - 1] ?? null;
  const submit = (e: FormEvent) => { e.preventDefault(); onInstruction(draft); setDraft(''); };
  const disabled = busy || approved;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)_minmax(260px,340px)]">
      <Panel title="4 · Refine — per Klartext">
        {approved && <p className="mb-2 text-[11px] text-amber-300">Freigegeben — weitere Änderungen im Workspace am Blueprint.</p>}
        <form onSubmit={submit} className="space-y-2">
          <textarea value={draft} disabled={disabled} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="z. B. „seriöser“, „mehr Vertrauen“, „für Steuerberater“" className="block w-full border border-titanium-800 bg-obsidian-950 px-3 py-2 text-sm text-titanium-50 placeholder:text-titanium-600 focus:border-[#e4cfa2] focus:outline-none" />
          <button type="submit" disabled={disabled || draft.trim().length < 3} className="inline-flex items-center gap-1.5 bg-[#e4cfa2] px-3 py-2 text-xs font-semibold text-obsidian-950 disabled:opacity-60">Anwenden <ArrowRight size={12} /></button>
        </form>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {QUICK_INSTRUCTIONS.map((q) => (
            <li key={q}><button type="button" disabled={disabled} onClick={() => onInstruction(q)} className="border border-titanium-800 px-2 py-1 text-[11px] text-titanium-300 hover:border-[#e4cfa2]/60 hover:text-titanium-50 disabled:opacity-50">{q}</button></li>
          ))}
        </ul>
        {last && (
          <div className="mt-3 border-t border-titanium-900 pt-2 text-[11px]">
            <p className="font-mono text-[9px] uppercase tracking-wider text-titanium-500">Letzte Änderung{last.instruction ? ` — „${last.instruction}“` : ' — Editor'}</p>
            {!last.understood && <p className="text-amber-300">Nicht verstanden — nichts geändert.</p>}
            <ul className="mt-1 space-y-0.5 text-titanium-300">
              {last.changes.map((c, i) => <li key={`${c.code}-${i}`}><span className="text-titanium-500">[{c.scope}]</span> {c.summary}</li>)}
            </ul>
            {last.refusals.length > 0 && <ul className="mt-1 space-y-0.5 text-amber-200">{last.refusals.map((r, i) => <li key={i}>{r}</li>)}</ul>}
          </div>
        )}
        <p className="mt-3 text-[10px] text-titanium-600">{state.revisions.length} Revision{state.revisions.length === 1 ? '' : 'en'} · Tonalität {direction.tone}/100</p>
        <button type="button" onClick={onNext} className="mt-3 inline-flex items-center gap-1.5 border border-[#e4cfa2]/60 px-3 py-2 text-xs font-semibold text-[#e4cfa2]">Zur Publish-Prüfung <ArrowRight size={12} /></button>
      </Panel>

      <Panel title={`Vorschau — ${direction.label}`} aside={<DeviceToggle device={device} setDevice={setDevice} />}>
        <div className="mx-auto bg-white transition-all" style={{ width: DEVICE_WIDTH[device], maxWidth: '100%', height: 'min(78vh, 900px)' }}>
          <SandboxedPreviewFrame html={html} title={`Vorschau ${direction.label}`} className="h-full w-full" />
        </div>
        <p className="mt-2 font-mono text-[9px] text-titanium-600">Vorschau ohne externe Schriften und Skripte — was hier fehlt, fehlt später nicht durch Zufall.</p>
      </Panel>

      <Panel title="Komponenten">
        <ol className="space-y-1.5">
          {direction.components.map((c, i) => (
            <ComponentEditor key={c.id} c={c} index={i} count={direction.components.length} onOperations={onOperations} disabled={disabled} />
          ))}
        </ol>
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PUBLISH
// ─────────────────────────────────────────────────────────────────────

function PublishPanel({ state, direction, onReadiness, onApprove, onOperations, busy, approved }: {
  state: RebuildWorkflowState; direction: RebuildDirection; onReadiness: () => void; onApprove: (reason: string) => void; onOperations: (ops: ComponentOperation[]) => void; busy: boolean; approved: boolean;
}) {
  const r = state.readiness;
  const [reason, setReason] = useState('');
  const [target, setTarget] = useState(direction.leadFlow.formTarget ?? '');
  const lead = direction.components.find((c) => c.kind === 'lead-form');

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
      <Panel
        title="5 · Publish — Reife prüfen"
        aside={<button type="button" disabled={busy || approved} onClick={onReadiness} className="inline-flex items-center gap-1.5 border border-[#e4cfa2]/60 px-3 py-1.5 text-xs font-semibold text-[#e4cfa2] disabled:opacity-50">Reife prüfen</button>}
      >
        {!r ? (
          <p className="text-xs text-titanium-400">Noch nicht geprüft. Die Prüfung bewertet Vorschau, Mobile/Desktop, SEO, Performance-Basics, Formularziel, Platzhalter, Pflichtseiten und das Publish Gate — serverseitig.</p>
        ) : (
          <>
            <ul className="divide-y divide-titanium-900">
              {r.checks.map((c) => (
                <li key={c.code} className="flex items-start gap-2 py-1.5 text-[11px]">
                  <span className={`mt-0.5 w-14 shrink-0 font-mono text-[9px] uppercase tracking-wider ${c.status === 'pass' ? 'text-emerald-300' : c.status === 'warn' ? 'text-amber-300' : 'text-red-300'}`}>{c.status}</span>
                  <span className="min-w-0"><span className="text-titanium-100">{c.label}</span> <span className="text-titanium-400">— {c.detail}</span></span>
                </li>
              ))}
            </ul>
            <p className="mt-2 font-mono text-[9px] text-titanium-600 break-all">Artefakt sha256 {r.artifactSha256} · {new Date(r.evaluatedAt).toLocaleString('de-DE')}</p>
          </>
        )}
      </Panel>
      <div className="space-y-4">
        <Panel title="Formularziel">
          {lead ? (
            <label className="block text-[11px]">
              <span className="text-titanium-400">Wohin gehen Anfragen? (https oder mailto)</span>
              <input value={target} disabled={busy || approved} onChange={(e) => setTarget(e.target.value)} onBlur={() => { if (target !== (lead.formTarget ?? '')) onOperations([{ op: 'set-form-target', id: lead.id, formTarget: target || null }]); }} className="mt-1 block w-full border border-titanium-800 bg-obsidian-950 px-2 py-1.5 text-xs text-titanium-100" placeholder="https://… oder mailto:…" />
              <span className="mt-1 block text-titanium-600">{lead.formTarget ? 'Konfiguriert.' : 'Offen — ohne Ziel keine Veröffentlichung.'}</span>
            </label>
          ) : <p className="text-[11px] text-titanium-400">Kein Lead-Formular sichtbar.</p>}
        </Panel>
        <Panel title="Deploy-Pfad">
          <ul className="space-y-1.5 text-[11px]">
            {(r?.deployPaths ?? []).map((p) => (
              <li key={p.key} className="border border-titanium-900 px-2 py-1.5">
                <span className="text-titanium-100">{p.label}</span> <span className={`font-mono text-[9px] uppercase tracking-wider ${p.status === 'available' ? 'text-emerald-300' : p.status === 'requires-setup' ? 'text-amber-300' : 'text-titanium-500'}`}>{p.status}</span>
                <p className="text-titanium-400">{p.detail}</p>
              </li>
            ))}
            {!r && <li className="text-titanium-500">Nach der Prüfung sichtbar.</li>}
          </ul>
        </Panel>
        <Panel title="GO — ausdrückliche Freigabe">
          {approved ? (
            <p className="flex items-center gap-2 text-xs text-emerald-300"><Check size={14} /> Freigegeben am {state.approval.approvedAt ? new Date(state.approval.approvedAt).toLocaleString('de-DE') : '–'}.</p>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); onApprove(reason.trim()); }} className="space-y-2">
              <label className="block text-[11px]"><span className="text-titanium-400">Begründung (Pflicht, wird im Prüfpfad festgehalten)</span>
                <input value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy || !r?.ready} className="mt-1 block w-full border border-titanium-800 bg-obsidian-950 px-2 py-1.5 text-xs text-titanium-100" placeholder="z. B. Inhalte geprüft, Formularziel bestätigt" />
              </label>
              <button type="submit" disabled={busy || !r?.ready || reason.trim().length < 5} className="inline-flex items-center gap-1.5 bg-[#e4cfa2] px-3 py-2 text-xs font-semibold text-obsidian-950 disabled:opacity-50"><ShieldCheck size={13} /> GO — veröffentlichen freigeben</button>
              {r && !r.ready && <p className="text-[11px] text-amber-300">{r.blockers.length} Blocker offen. Erst beheben, dann GO.</p>}
              <p className="text-[10px] text-titanium-600">Nur Owner, Admin oder DPO. Gilt genau für den geprüften Hash.</p>
            </form>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// AUTOMATE + GOVERN
// ─────────────────────────────────────────────────────────────────────

function AutomatePanel({ state, response }: { state: RebuildWorkflowState; response: RebuildResponse | null }) {
  return (
    <Panel title="6 · Automate — nächste Schritte im RealSync-Betriebssystem">
      {state.suggestions.length === 0 ? (
        <p className="text-xs text-titanium-400">Vorschläge entstehen nach dem GO.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {state.suggestions.map((s) => (
            <li key={s.key} className="flex flex-col border border-titanium-900 p-3">
              <h3 className="text-sm font-semibold text-titanium-50">{s.label}</h3>
              <p className="mt-1 text-[11px] text-titanium-400">{s.why}</p>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-titanium-500">{s.connection === 'none' ? 'keine Verbindung' : 'Einrichtung nötig'} · Freigabe erforderlich · {s.evidenceIds.length} Belege</p>
              {s.route ? <Link to={s.route} className="mt-auto pt-2 text-[11px] text-[#e4cfa2]">Vorbereiten →</Link> : <span className="mt-auto pt-2 text-[11px] text-titanium-600">Noch keine Oberfläche</span>}
            </li>
          ))}
        </ul>
      )}
      {response?.slug && (
        <p className="mt-4 text-[11px] text-titanium-300">Der Blueprint liegt im Workspace: <Link to={`/builder/${response.slug}`} className="text-[#e4cfa2]">/builder/{response.slug}</Link></p>
      )}
    </Panel>
  );
}

function GovernPanel({ state, response }: { state: RebuildWorkflowState; response: RebuildResponse | null }) {
  const g = state.governance;
  return (
    <Panel title="7 · Govern — Prüfpfad und Verantwortung">
      <div className="grid gap-4 md:grid-cols-2">
        <dl className="space-y-1.5 text-[11px]">
          <div className="flex justify-between gap-3"><dt className="text-titanium-500">Mandanten-Autorität</dt><dd className="text-titanium-100">Server (Mitgliedschaft geprüft) — nie URL oder localStorage</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-titanium-500">Belege</dt><dd className="text-titanium-100">{g?.evidenceCount ?? state.import?.evidence.length ?? 0}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-titanium-500">Befunde</dt><dd className="text-titanium-100">{g?.findingCount ?? state.assessment?.findings.length ?? 0}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-titanium-500">Import-Hash</dt><dd className="font-mono text-titanium-300 break-all">{(g?.hashes.import ?? state.import?.htmlSha256 ?? '–').slice(0, 24)}…</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-titanium-500">Artefakt-Hash</dt><dd className="font-mono text-titanium-300 break-all">{(g?.hashes.artifact ?? state.readiness?.artifactSha256 ?? '–').slice(0, 24)}…</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-titanium-500">Freigabe</dt><dd className="text-titanium-100">{state.approval.approved ? `GO · ${state.approval.approvedAt ? new Date(state.approval.approvedAt).toLocaleString('de-DE') : ''}` : 'offen'}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-titanium-500">Blueprint</dt><dd className="text-titanium-100">{response?.blueprint_id ? <Link to={`/builder/${response.slug ?? ''}`} className="text-[#e4cfa2]">im Workspace</Link> : 'entsteht mit dem GO'}</dd></div>
        </dl>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">Offene Entscheidungen</p>
          <ul className="mt-1 space-y-1 text-[11px] text-titanium-300">
            {(g?.pendingApprovals ?? (state.approval.approved ? [] : ['Veröffentlichung (GO)'])).map((p, i) => <li key={i}>· {p}</li>)}
          </ul>
          {g?.compliance && (
            <>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-titanium-500">Compliance-Profil</p>
              <ul className="mt-1 space-y-0.5 text-[11px] text-titanium-300">
                <li>Rechtsgrundlagen: {g.compliance.legalBases.join(', ') || '–'}</li>
                <li>Einwilligungskategorien: {g.compliance.consentCategories.join(', ') || '–'}</li>
                <li>DSFA indiziert: {g.compliance.dpiaRequired ? 'ja' : 'nein'}</li>
                <li>Policy Packs: {g.compliance.policyPackIds.join(', ') || '–'}</li>
              </ul>
            </>
          )}
        </div>
      </div>
      <p className="mt-4 text-[10px]" style={{ color: GOLD }}>Jede Analyse hat Belege, jede Automation braucht Freigabe, jede Veröffentlichung ein GO.</p>
    </Panel>
  );
}
