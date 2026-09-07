// App Builder Workspace — /builder/:slug (Phase 2, PR A: die Shell).
//
// Eine Site des Mandanten, adressiert über ihren Slug. Der Slug ist heute der
// Identifikator: `siteos_blueprints` führt je (tenant_id, slug) eine
// append-only Versionskette; `website_projects` ist leer und wird nirgends
// verknüpft (gemessen 2026-09-07). Ein Projekt ist also die Kette.
//
// Was diese Seite tut: den jüngsten Stand laden, den Block-Editor aus #1248
// darauf setzen, Bearbeitungen als `PageEdit` an `siteos/edit` schicken,
// Vorschau über den einen Renderer zeigen, Probleme aus den vorhandenen
// Validatoren, Verlauf und Governance aus der Datenbank. Rechts vier Tabs
// (Assistent · Eigenschaften · Probleme · Governance), in der Kopfzeile der
// Governance-Status der gespeicherten Version — Zielbild
// `docs/product/app-builder-zielbild.md` §4.
//
// Seiten anlegen, umbenennen, verschieben, duplizieren, löschen (Schritt B)
// laufen als Seitenoperationen über denselben Pfad `siteos/edit` — der
// Server entscheidet, der Browser nennt nur die Absicht.
//
// Was sie nicht tut: keinen Blueprint aus dem Browser speichern (die
// Sicherheitsbasis aus #1248 bleibt), keinen LLM-Assistenten (PR C), nichts
// veröffentlichen (PR D — es gibt keinen Auslieferungspfad), keine Medien
// (PR E). Wo etwas fehlt, steht das dran.

import { Suspense, lazy, useCallback, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight, Check, ChevronLeft, Eye, Loader2, Monitor, PencilLine, Save, ShieldCheck,
  Smartphone, Sparkles, Tablet, Upload,
} from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { useSupabaseAuth } from '../../supabase/SupabaseAuthContext';
import { SandboxedPreviewFrame } from '../../../components/preview/SandboxedPreviewFrame';
import { createSiteOsCheckoutSession } from '../../billing/checkout';
import {
  analyzeBlueprint,
  applyPageEdits,
  canonicalize,
  renderSite,
  type PageOperation,
  type PublishGateEvaluation,
  type SiteBlueprint,
} from '../../../../packages/siteos-core/src/index';
import { applySiteDesignTemplate, SITE_DESIGN_TEMPLATES, type SiteDesignTemplate } from '../../../../packages/siteos-core/src/render/templates';
import {
  editSite, errorMessage, evaluatePublish, listAgentRuns, listBlueprintChain, listCustodyEvents,
  listEvaluations, loadLatestBlueprint,
  type AgentRunRow, type CustodyEventRow, type EvaluationRow, type StoredBlueprintRow,
} from '../siteOsApi';
import { toPageEdit, type PuckPageData } from '../editor/blueprintPuckAdapter';
import {
  AssistantPanel, ConsolePanel, GovernancePanel, GovernanceStatusChip, HistoryPanel, ProblemsPanel, ProjectNav,
  RIGHT_TABS, SECTION_LABEL, governanceStatus,
  type BottomTab, type ChainRow, type ConsoleEntry, type NavTab, type RightTab,
} from './panels';

const SiteOsBlockEditor = lazy(() => import('../editor/SiteOsBlockEditor'));

type Device = 'desktop' | 'tablet' | 'mobile';
type Mode = 'edit' | 'preview';
type MobilePane = 'left' | 'canvas' | 'right' | 'panels';
type LoadState = 'loading' | 'ready' | 'not_found' | 'error';
/** Sichtbarer Speicherzustand in der Kopfzeile — nie „gespeichert", wenn nichts persistiert wurde. */
export type SaveState = 'saved' | 'unsaved' | 'saving' | 'failed';

const DEVICE_WIDTH: Record<Device, string> = { desktop: '100%', tablet: '820px', mobile: '390px' };
const BOTTOM_TABS: ReadonlyArray<{ id: BottomTab; label: string }> = [
  { id: 'console', label: 'Konsole' },
  { id: 'history', label: 'Verlauf' },
];

export default function AppBuilderWorkspacePage(): ReactElement {
  const navigate = useNavigate();
  const { slug = '' } = useParams<{ slug: string }>();
  const { activeTenantId, loading: tenantLoading } = useTenant();
  const { isAuthenticated } = useSupabaseAuth();
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  // Nur der Erstbau kennt die Ausgangs-URL; er reicht sie als Parameter
  // weiter. Ohne sie gibt es hier weder KI-Neubau noch Checkout — beides
  // braucht die Quelle, und sie wird nicht erraten.
  const sourceUrl = useMemo(() => {
    const raw = params.get('source');
    if (!raw) return null;
    try { return new URL(raw).toString(); } catch { return null; }
  }, [params]);

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [stored, setStored] = useState<StoredBlueprintRow | null>(null);
  const [pageData, setPageData] = useState<Record<string, PuckPageData>>({});
  const [revision, setRevision] = useState(0);
  const [pagePath, setPagePath] = useState('/');
  const [mode, setMode] = useState<Mode>('edit');
  const [device, setDevice] = useState<Device>('desktop');
  const [template, setTemplate] = useState<SiteDesignTemplate>('modern-minimal');
  const [navTab, setNavTab] = useState<NavTab>('pages');
  const [rightTab, setRightTab] = useState<RightTab>('assistant');
  const [bottomTab, setBottomTab] = useState<BottomTab>('console');
  const [bottomOpen, setBottomOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>('canvas');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  /** Zeitpunkt der letzten tatsächlichen Persistenz — beim Laden der der Version. */
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [gate, setGate] = useState<PublishGateEvaluation | null>(null);
  const [checking, setChecking] = useState(false);
  const [console_, setConsole] = useState<ConsoleEntry[]>([]);
  const [chain, setChain] = useState<ChainRow[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRow[]>([]);
  const [custody, setCustody] = useState<CustodyEventRow[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRunRow[]>([]);

  const log = useCallback((level: ConsoleEntry['level'], text: string) => {
    setConsole((prev) => [...prev.slice(-199), { at: new Date().toISOString(), level, text }]);
  }, []);

  const assetRef = activeTenantId ? `siteos:blueprint:${activeTenantId}:${slug}` : '';

  // ── Laden ────────────────────────────────────────────────────────────
  const loadGovernance = useCallback(async (tenantId: string, siteSlug: string) => {
    try {
      const rows = await listBlueprintChain(tenantId, siteSlug);
      setChain(rows);
      const ids = rows.map((r) => r.id);
      const [evals, custodyRows, runs] = await Promise.all([
        listEvaluations(tenantId, ids),
        listCustodyEvents(tenantId, `siteos:blueprint:${tenantId}:${siteSlug}`),
        listAgentRuns(tenantId),
      ]);
      setEvaluations(evals);
      setCustody(custodyRows);
      setAgentRuns(runs.filter((run) => run.blueprint_id !== null && ids.includes(run.blueprint_id)));
    } catch (cause) {
      log('error', `Governance-Daten konnten nicht geladen werden: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }, [log]);

  useEffect(() => {
    if (!isAuthenticated) { navigate(`/welcome?next=${encodeURIComponent(location.pathname + location.search)}`); return; }
    if (!activeTenantId) {
      if (!tenantLoading) { setLoadState('error'); setLoadError('Kein aktiver Workspace gefunden. Bitte erneut anmelden oder das Onboarding abschließen.'); }
      return;
    }
    if (!slug) { setLoadState('not_found'); return; }
    let cancelled = false;
    (async () => {
      setLoadState('loading');
      try {
        const row = await loadLatestBlueprint(activeTenantId, slug);
        if (cancelled) return;
        if (!row) { setLoadState('not_found'); log('error', `Kein Projekt „${slug}" in diesem Workspace.`); return; }
        setStored(row);
        setSavedAt(row.created_at);
        setPageData({});
        setRevision((r) => r + 1);
        setPagePath(row.blueprint.pages.some((p) => p.path === '/') ? '/' : (row.blueprint.pages[0]?.path ?? '/'));
        setLoadState('ready');
        log('info', `Version ${row.version} geladen (${row.content_sha256.slice(0, 12)}…).`);
        void loadGovernance(activeTenantId, slug);
      } catch (cause) {
        if (cancelled) return;
        setLoadState('error');
        setLoadError(cause instanceof Error ? cause.message : 'Das Projekt konnte nicht geladen werden.');
      }
    })();
    return () => { cancelled = true; };
  }, [activeTenantId, tenantLoading, isAuthenticated, navigate, slug, log, loadGovernance, location.pathname, location.search]);

  // ── Lokale Fassung ───────────────────────────────────────────────────
  const edits = useMemo(() => Object.entries(pageData).map(([path, data]) => toPageEdit(path, data)), [pageData]);
  // Dieselbe Logik wie der Server: Die Leinwand zeigt, was gespeichert würde.
  const localBlueprint = useMemo<SiteBlueprint | null>(
    () => stored ? (edits.length > 0 ? applyPageEdits(stored.blueprint, edits).blueprint : stored.blueprint) : null,
    [stored, edits],
  );
  const dirty = useMemo(
    () => Boolean(stored && localBlueprint && canonicalize(localBlueprint) !== canonicalize(stored.blueprint)),
    [stored, localBlueprint],
  );
  const findings = useMemo(() => localBlueprint ? analyzeBlueprint(localBlueprint) : [], [localBlueprint]);
  const saveState: SaveState = saving ? 'saving' : saveError ? 'failed' : dirty ? 'unsaved' : 'saved';
  // Status der **gespeicherten** Version aus der jüngsten Bewertung — nur
  // gelesen (`siteos_publish_evaluations`), nie aus der lokalen Fassung
  // abgeleitet. Ohne Bewertung steht „keine" da, nicht „in Ordnung".
  const govStatus = useMemo(() => governanceStatus(evaluations, stored?.id ?? ''), [evaluations, stored?.id]);

  const previewBlueprint = useMemo(() => localBlueprint ? applySiteDesignTemplate(localBlueprint, template) : null, [localBlueprint, template]);
  const previewHtml = useMemo(
    () => previewBlueprint ? renderSite(previewBlueprint, { baseUrl: sourceUrl ?? undefined, presentation: 'showcase' }).find((p) => p.path === pagePath)?.html ?? '' : '',
    [previewBlueprint, sourceUrl, pagePath],
  );

  // ── Speichern — Redaktion und Seitenoperationen, ein Weg ─────────────
  // Seitenoperationen laufen nie nur im Browser: Sie gehen mit den
  // ungespeicherten Bearbeitungen in **einer** Anfrage an `siteos/edit`, der
  // Server prüft (Slug, Schutz der Rechtsseiten, Navigation) und legt eine
  // Version an. Was er abweist, steht in der Konsole — nicht still.
  const persist = async (ops: PageOperation[] = []) => {
    if (!activeTenantId || !stored || saving) return;
    if (edits.length === 0 && ops.length === 0) return;
    setSaving(true); setSaveError('');
    try {
      const result = await editSite({
        tenant_id: activeTenantId, slug: stored.blueprint.slug, base_sha256: stored.content_sha256,
        ...(edits.length > 0 ? { edits } : {}),
        ...(ops.length > 0 ? { pages: ops } : {}),
      });
      if (result.kind !== 'ok') throw new Error(errorMessage(result));
      const saved = result.data;
      for (const r of saved.rejected) log('error', `Abgewiesen: ${r}`);
      if (saved.unchanged) {
        // Der Server hat nichts geschrieben — das ist kein Erfolg, sondern
        // ein leeres Ergebnis. Der Zustand bleibt, wie er ist.
        log('info', 'Keine Änderungen zu speichern — Server hat keine neue Version angelegt.');
        return;
      }
      setStored({
        ...stored,
        id: saved.blueprint_id ?? stored.id,
        version: saved.version,
        blueprint: saved.blueprint,
        content_sha256: saved.content_sha256,
        prev_hash: saved.prev_hash ?? stored.content_sha256,
        status: 'draft',
      });
      setSavedAt(new Date().toISOString());
      setPageData({});
      setRevision((r) => r + 1);
      setGate(null);
      log('ok', `Version ${saved.version} gespeichert und geprüft (${saved.changes.length} Änderung${saved.changes.length === 1 ? '' : 'en'}${saved.rejected.length > 0 ? `, ${saved.rejected.length} abgewiesen` : ''}).`);
      for (const change of saved.changes) log('info', `${change.summary}${change.complianceNote ? ` — ${change.complianceNote}` : ''}`);
      // Nach einer Strukturänderung die passende Seite öffnen: die neue,
      // die verschobene, oder die Startseite, wenn die aktuelle weg ist.
      const created = saved.changes.find((c) => c.code === 'page.created' || c.code === 'page.duplicated');
      const moved = saved.changes.find((c) => c.code === 'page.moved' && 'previousPath' in c && c.previousPath === pagePath);
      if (created) setPagePath(created.path);
      else if (moved) setPagePath(moved.path);
      else if (!saved.blueprint.pages.some((p) => p.path === pagePath)) setPagePath('/');
      void loadGovernance(activeTenantId, stored.blueprint.slug);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Die Änderungen konnten nicht gespeichert werden.';
      setSaveError(message);
      log('error', `Speichern fehlgeschlagen: ${message}`);
    } finally { setSaving(false); }
  };
  const save = () => persist();

  // ── Ungespeichertes schützen ─────────────────────────────────────────
  // Der Browser fragt vor Reload/Schließen, der Zurück-Link vor dem Verlassen.
  // Der KI-Neubau fragt selbst (unten); Seitenwechsel behalten die
  // Bearbeitung je Seite, Seitenoperationen speichern sie mit.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // ── Prüfen (Publish Gate) ────────────────────────────────────────────
  const check = async () => {
    if (!activeTenantId || !stored || dirty || checking) return;
    setChecking(true);
    try {
      const result = await evaluatePublish({ tenant_id: activeTenantId, blueprint_id: stored.id, base_url: sourceUrl ?? undefined });
      if (result.kind !== 'ok') throw new Error(errorMessage(result));
      setGate(result.data.evaluation);
      setRightTab('problems'); setMobilePane('right');
      log(result.data.evaluation.publishable ? 'ok' : 'info', `Publish Gate: ${result.data.evaluation.status}${result.data.evaluation.publishable ? ' · veröffentlichbar' : ''} (${result.data.evaluation.blockers.length} Blocker).`);
      void loadGovernance(activeTenantId, stored.blueprint.slug);
    } catch (cause) {
      log('error', `Prüfung fehlgeschlagen: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally { setChecking(false); }
  };

  // ── KI-Neubau (vorhandener Pfad, kein LLM) ───────────────────────────
  const rebuild = (text: string) => {
    if (!sourceUrl) return;
    if (dirty && !window.confirm('Die KI baut die Website aus der Ausgangsseite neu. Ungespeicherte Änderungen gehen dabei verloren. Fortfahren?')) return;
    navigate(`/unified-entry/transformation?url=${encodeURIComponent(sourceUrl)}&instruction=${encodeURIComponent(text)}`);
  };

  const checkout = async () => {
    if (!activeTenantId || !stored || !sourceUrl) return;
    setBusy(true);
    try {
      const result = await createSiteOsCheckoutSession({ tenantId: activeTenantId, sourceUrl, siteSlug: stored.blueprint.slug, projectName: stored.blueprint.name });
      if (!result.ok || !result.url) throw new Error(result.error?.message ?? 'Checkout konnte nicht vorbereitet werden.');
      window.location.assign(result.url);
    } catch (cause) {
      log('error', cause instanceof Error ? cause.message : 'Checkout konnte nicht vorbereitet werden.');
      setBusy(false);
    }
  };

  // ── Zustände ohne Projekt ────────────────────────────────────────────
  if (loadState !== 'ready' || !stored || !localBlueprint) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f5f7] p-6 text-[#111827]">
        <div className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-2xl">
          {loadState === 'loading' && (<><Loader2 className="mx-auto animate-spin text-cyan-600" size={22} /><p className="mt-4 text-sm text-black/60">Projekt wird geladen …</p></>)}
          {loadState === 'not_found' && (
            <>
              <h1 className="text-lg font-bold">Projekt nicht gefunden</h1>
              <p className="mt-2 text-sm leading-6 text-black/55">Unter <code className="font-mono">{slug || '—'}</code> gibt es in diesem Workspace keine Site. Entweder wurde sie nie gebaut, oder sie gehört zu einem anderen Workspace.</p>
              <div className="mt-5 flex flex-col gap-2">
                <Link to="/app/siteos" className="rounded-lg bg-[#111827] px-4 py-2.5 text-xs font-bold text-white">Zur Übersicht</Link>
                <Link to="/unified-entry/transformation" className="rounded-lg border border-black/[.12] px-4 py-2.5 text-xs font-bold">Neue Website bauen</Link>
              </div>
            </>
          )}
          {loadState === 'error' && (<><h1 className="text-lg font-bold">Laden fehlgeschlagen</h1><p className="mt-2 text-sm leading-6 text-rose-700">{loadError}</p></>)}
        </div>
      </main>
    );
  }

  // ── Bausteine der Shell ──────────────────────────────────────────────
  const savedClock = savedAt ? new Date(savedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null;
  const saveLabel: Record<SaveState, string> = {
    saved: `Gespeichert · v${stored.version}${savedClock ? ` · ${savedClock}` : ''}`,
    unsaved: 'Ungespeicherte Änderungen',
    saving: 'Speichern …',
    failed: `Speichern fehlgeschlagen: ${saveError}`,
  };
  // Kurzform für schmale Bildschirme — dieselbe Wahrheit, weniger Zeichen.
  const saveShort: Record<SaveState, string> = {
    saved: `v${stored.version} gesichert`,
    unsaved: 'Ungespeichert',
    saving: 'Speichern …',
    failed: 'Fehler',
  };

  const topbar = (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between gap-3 border-b border-black/[.08] bg-white/95 px-3 backdrop-blur sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <Link
          to="/app/siteos"
          onClick={(event) => { if (dirty && !window.confirm('Es gibt ungespeicherte Änderungen. Ohne Speichern verlassen?')) event.preventDefault(); }}
          className="shrink-0 rounded-lg p-2 hover:bg-black/[.05]"
          aria-label="Zur Übersicht"
        ><ChevronLeft size={18} /></Link>
        <div className="hidden h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#07111f] text-cyan-300 sm:grid"><Sparkles size={15} /></div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{stored.blueprint.name}</div>
          <div className="truncate font-mono text-[10px] text-black/45">{slug} · v{stored.version} · {stored.content_sha256.slice(0, 12)}…</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <GovernanceStatusChip status={govStatus} onClick={() => { setRightTab('governance'); setMobilePane('right'); }} />
        <span
          data-testid="save-state"
          data-state={saveState}
          title={saveLabel[saveState]}
          className={`inline-flex max-w-[40vw] items-center truncate rounded-full px-2 py-1 text-[10px] font-semibold sm:max-w-none sm:px-3 sm:py-1.5 ${saveState === 'failed' ? 'bg-rose-50 text-rose-700' : saveState === 'unsaved' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}
        >
          <span className="hidden sm:inline">{saveLabel[saveState]}</span>
          <span className="sm:hidden">{saveShort[saveState]}</span>
        </span>
        <button
          onClick={() => void save()}
          disabled={!dirty || saving || busy}
          aria-label="Speichern"
          className="inline-flex items-center gap-2 rounded-lg border border-black/[.12] bg-white px-2.5 py-2 text-xs font-bold text-[#111827] disabled:opacity-40 sm:px-3"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}<span className="hidden sm:inline">Speichern</span>
        </button>
        <div className="hidden items-center gap-1 rounded-lg bg-black/[.04] p-1 sm:flex" role="group" aria-label="Ansicht">
          <button onClick={() => setMode('edit')} aria-pressed={mode === 'edit'} className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] ${mode === 'edit' ? 'bg-white shadow' : ''}`}><PencilLine size={13} /> Bearbeiten</button>
          <button onClick={() => setMode('preview')} aria-pressed={mode === 'preview'} className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] ${mode === 'preview' ? 'bg-white shadow' : ''}`}><Eye size={13} /> Vorschau</button>
        </div>
        <button
          onClick={() => void check()}
          disabled={dirty || checking || busy}
          title={dirty ? 'Erst speichern — geprüft wird die gespeicherte Version.' : 'Publish Gate für die gespeicherte Version bewerten'}
          aria-label="Prüfen"
          className="inline-flex items-center gap-2 rounded-lg border border-black/[.12] bg-white px-2.5 py-2 text-xs font-bold disabled:opacity-40 sm:px-3"
        >
          {checking ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}<span className="hidden sm:inline">Prüfen</span>
        </button>
        {/* Veröffentlichen gibt es noch nicht: Es existiert kein Pfad vom
            Artefakt zu einer öffentlichen Adresse (gemessen 2026-09-07).
            Der Knopf steht hier, damit die Kopfzeile ihre Form hat — und
            sagt, warum er nichts tut, statt so zu tun als ob. */}
        <button
          disabled
          aria-disabled="true"
          title="Auslieferung nicht verdrahtet: Es gibt noch keinen Pfad von der geprüften Version zu einer öffentlichen Adresse. Folgt mit dem Publish-Schritt."
          aria-label="Veröffentlichen"
          className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-2.5 py-2 text-xs font-bold text-white opacity-40 sm:px-3"
        >
          <Upload size={14} /><span className="hidden sm:inline">Veröffentlichen</span>
        </button>
      </div>
    </header>
  );

  const mobileTabs = (
    <div className="flex gap-1 border-b border-black/[.08] bg-white px-2 py-1.5 lg:hidden" role="tablist" aria-label="Bereich">
      {([['left', 'Projekt'], ['canvas', mode === 'edit' ? 'Editor' : 'Vorschau'], ['right', 'Assistent'], ['panels', 'Protokoll']] as const).map(([id, label]) => (
        <button key={id} role="tab" aria-selected={mobilePane === id} onClick={() => setMobilePane(id)} className={`rounded-md px-3 py-1.5 text-[11px] ${mobilePane === id ? 'bg-black/[.06] font-semibold' : 'text-black/55'}`}>{label}</button>
      ))}
    </div>
  );

  const canvasHeader = (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/[.07] bg-white px-3 py-2 shadow-sm">
      <div className="min-w-0 truncate text-xs font-semibold">{pagePath === '/' ? 'Startseite' : (localBlueprint.pages.find((p) => p.path === pagePath)?.title ?? pagePath)} <span className="font-mono text-[10px] text-black/45">{pagePath}</span></div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-black/[.04] p-1 sm:hidden" role="group" aria-label="Ansicht">
          <button onClick={() => setMode('edit')} aria-pressed={mode === 'edit'} className={`rounded-md p-1.5 ${mode === 'edit' ? 'bg-white shadow' : ''}`} aria-label="Bearbeiten"><PencilLine size={14} /></button>
          <button onClick={() => setMode('preview')} aria-pressed={mode === 'preview'} className={`rounded-md p-1.5 ${mode === 'preview' ? 'bg-white shadow' : ''}`} aria-label="Vorschau"><Eye size={14} /></button>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-black/[.04] p-1" role="group" aria-label="Gerät">
          <button onClick={() => setDevice('desktop')} className={`rounded-md p-1.5 ${device === 'desktop' ? 'bg-white shadow' : ''}`} aria-label="Desktop" aria-pressed={device === 'desktop'}><Monitor size={14} /></button>
          <button onClick={() => setDevice('tablet')} className={`rounded-md p-1.5 ${device === 'tablet' ? 'bg-white shadow' : ''}`} aria-label="Tablet" aria-pressed={device === 'tablet'}><Tablet size={14} /></button>
          <button onClick={() => setDevice('mobile')} className={`rounded-md p-1.5 ${device === 'mobile' ? 'bg-white shadow' : ''}`} aria-label="Mobil" aria-pressed={device === 'mobile'}><Smartphone size={14} /></button>
        </div>
      </div>
    </div>
  );

  const designPanel = (
    <div className="mt-7 border-t border-black/[.07] pt-5">
      <div className={SECTION_LABEL}>Design</div>
      {SITE_DESIGN_TEMPLATES.map((item) => (
        <button key={item.id} onClick={() => setTemplate(item.id)} aria-pressed={template === item.id} className={`mb-2 flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-xs ${template === item.id ? 'border-cyan-400/40 bg-cyan-50 text-cyan-800' : 'border-black/[.07]'}`}>{item.label}{template === item.id && <Check size={14} />}</button>
      ))}
      <p className="text-[11px] leading-5 text-black/45">Die Vorlage wirkt auf Vorschau und Leinwand; gespeichert wird sie nicht — der Blueprint trägt sein eigenes Theme.</p>
    </div>
  );

  const assistant = (
    <AssistantPanel sourceUrl={sourceUrl} instruction={instruction} onInstruction={setInstruction} onRebuild={rebuild} busy={busy || saving}>
      {sourceUrl && (
        <button onClick={() => void checkout()} disabled={busy} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-xs font-bold text-[#06111f] disabled:opacity-40">Website fertig umsetzen <ArrowRight size={14} /></button>
      )}
      {dirty && sourceUrl && <div className="mt-2 text-[10px] leading-4 text-black/45">Ungespeicherte Änderungen werden nicht übernommen — vorher speichern.</div>}
      {designPanel}
    </AssistantPanel>
  );

  // Rechte Spalte: vier Tabs (Zielbild §4). „Eigenschaften" sind die
  // Puck-Felder des ausgewählten Bausteins — die gibt es nur im
  // Bearbeiten-Modus; die Vorschau sagt das, statt ein leeres Feld zu zeigen.
  const rightColumn = (fields: ReactNode | null) => (
    <div>
      <div className="mb-4 flex flex-wrap gap-1" role="tablist" aria-label="Werkzeuge">
        {RIGHT_TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={rightTab === tab.id}
            onClick={() => setRightTab(tab.id)}
            className={`rounded-md px-2 py-1 text-[11px] ${rightTab === tab.id ? 'bg-black/[.06] font-semibold' : 'text-black/55 hover:bg-black/[.03]'}`}
          >
            {tab.label}{tab.id === 'problems' && findings.length > 0 ? ` (${findings.length})` : ''}
          </button>
        ))}
      </div>
      <div hidden={rightTab !== 'assistant'}>{assistant}</div>
      {rightTab === 'properties' && (
        fields ? (
          <div>
            <div className={SECTION_LABEL}>Ausgewählter Baustein</div>
            {fields}
          </div>
        ) : (
          <p className="text-[11px] leading-5 text-black/45">Eigenschaften stehen im Bearbeiten-Modus bereit — dort den Baustein in der Leinwand oder der Seitenstruktur auswählen.</p>
        )
      )}
      {rightTab === 'problems' && <ProblemsPanel findings={findings} gate={gate} />}
      {rightTab === 'governance' && <GovernancePanel stored={stored} local={localBlueprint} evaluations={evaluations} custody={custody} agentRuns={agentRuns} assetRef={assetRef} />}
    </div>
  );

  const bottomPanels = (
    <section className="border-t border-black/[.08] bg-white" aria-label="Protokoll">
      <div className="flex flex-wrap items-center gap-1 px-3 py-1.5" role="tablist" aria-label="Leisten">
        {BOTTOM_TABS.map((tab) => (
          <button key={tab.id} role="tab" aria-selected={bottomTab === tab.id && bottomOpen} onClick={() => { setBottomTab(tab.id); setBottomOpen(true); }} className={`rounded-md px-3 py-1.5 text-[11px] ${bottomTab === tab.id && bottomOpen ? 'bg-black/[.06] font-semibold' : 'text-black/55 hover:bg-black/[.03]'}`}>
            {tab.label}
          </button>
        ))}
        <button onClick={() => setBottomOpen((o) => !o)} className="ml-auto rounded-md px-2 py-1 text-[11px] text-black/45 hover:bg-black/[.03]" aria-expanded={bottomOpen}>{bottomOpen ? 'Einklappen' : 'Ausklappen'}</button>
      </div>
      {bottomOpen && (
        <div className="max-h-72 overflow-auto border-t border-black/[.06] px-4 py-3">
          {bottomTab === 'console' && <ConsolePanel entries={console_} />}
          {bottomTab === 'history' && <HistoryPanel chain={chain} currentId={stored.id} />}
        </div>
      )}
    </section>
  );

  const editorPane: 'left' | 'canvas' | 'right' = mobilePane === 'panels' ? 'canvas' : mobilePane;

  return (
    <main className="min-h-screen bg-[#f3f5f7] text-[#111827]">
      {topbar}
      {mobileTabs}
      <div className={mobilePane === 'panels' ? 'hidden lg:block' : 'block'}>
        {mode === 'edit' ? (
          <Suspense fallback={<div className="grid min-h-[50vh] place-items-center text-xs text-black/45"><Loader2 className="mr-2 animate-spin" size={14} /> Editor wird geladen …</div>}>
            <SiteOsBlockEditor
              storedBlueprint={stored.blueprint}
              localBlueprint={localBlueprint}
              template={template}
              pagePath={pagePath}
              pageData={pageData[pagePath]}
              onPageDataChange={(path, data) => setPageData((prev) => ({ ...prev, [path]: data }))}
              canvasWidth={DEVICE_WIDTH[device]}
              revision={revision}
              canvasHeader={canvasHeader}
              renderRight={(parts) => rightColumn(parts.fields)}
              mobilePane={editorPane}
              renderLeft={(parts) => (
                <ProjectNav tab={navTab} onTab={setNavTab} blueprint={localBlueprint} pagePath={pagePath} onOpenPage={setPagePath} onPageOperations={(ops) => void persist(ops)} busy={saving || busy} puck={parts} />
              )}
            />
          </Suspense>
        ) : (
          <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[260px_minmax(0,1fr)_320px]">
            <aside className={`${editorPane === 'left' ? 'block' : 'hidden'} border-r border-black/[.07] bg-white p-4 lg:block`}>
              <ProjectNav tab={navTab} onTab={setNavTab} blueprint={localBlueprint} pagePath={pagePath} onOpenPage={setPagePath} onPageOperations={(ops) => void persist(ops)} busy={saving || busy} />
            </aside>
            <section className={`${editorPane === 'canvas' ? 'block' : 'hidden'} min-w-0 p-3 sm:p-5 lg:block`}>
              {canvasHeader}
              <div className="flex min-h-[calc(100vh-10rem)] items-start justify-center overflow-auto rounded-2xl border border-black/[.08] bg-[#dfe4ea] p-3 sm:p-6">
                <div style={{ width: DEVICE_WIDTH[device] }} className="overflow-hidden rounded-xl bg-white shadow-2xl">
                  <SandboxedPreviewFrame title="Vorschau der lokalen Fassung" html={previewHtml} className="h-[760px] w-full border-0 bg-white" />
                </div>
              </div>
            </section>
            <aside className={`${editorPane === 'right' ? 'block' : 'hidden'} border-t border-black/[.07] bg-white p-4 lg:block lg:border-l lg:border-t-0 sm:p-5`}>{rightColumn(null)}</aside>
          </div>
        )}
      </div>
      <div className={mobilePane === 'panels' ? 'block' : 'hidden lg:block'}>{bottomPanels}</div>
    </main>
  );
}
