/**
 * /build — App Builder + Frontend Designer Studio (Governance OS).
 *
 * Consumes Monetisierung keys only: `siteos.builder`, `siteos.publish`,
 * `limit.sites` (via useEntitlements + builderEntitlements adapter).
 * Frontend Designer follows siteos.builder. No invented run caps.
 *
 * Honesty:
 * - Publish / custom domain / live orchestrator = Preview / Coming Soon
 * - No fake deploy URL, no fake paid-subscription claim
 * - Dark / Gold / Cream only; cream CTA #e8ddc8
 * - No forbidden public outbound-contact CTAs
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  LayoutTemplate,
  Loader2,
  MessageSquare,
  Monitor,
  Palette,
  Smartphone,
  Sparkles,
  Tablet,
  Wand2,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import {
  renderSite,
  type SiteBlueprint,
} from '../../../packages/siteos-core/src/index';
import { SandboxedPreviewFrame } from '../../components/preview/SandboxedPreviewFrame';
import { resolveAuditContext } from '../../core/onboarding/funnelContext';
import {
  applyInstruction,
  clear as clearBuildSession,
  resumeBuild,
  startBuild,
  type BuildState,
  type BuildStep,
} from '../../features/siteos/buildSession';
import {
  canOpenAppBuilder,
  canPublishSite,
  resolveBuilderEntitlements,
  studioPreviewUntilSsot,
  upgradeHrefFromAccess,
} from '../../features/siteos/builderEntitlements';
import { BuilderUpgradePanel } from '../../features/siteos/BuilderUpgradePanel';
import { useEntitlements } from '../../core/billing/useEntitlements';
import { useSupabaseAuth } from '../../features/supabase/SupabaseAuthContext';
import { STATUS_LABEL } from '../../product/implementation-status';
import { OS_CREAM_BTN, OS_H1 } from '../../components/governance-os/osChrome';

type Device = 'desktop' | 'tablet' | 'mobile';
type StudioPane = 'builder' | 'designer';

const DEVICE_WIDTH: Record<Device, string> = {
  desktop: '100%',
  tablet: '834px',
  mobile: '390px',
};

const EXAMPLES: readonly string[] = [
  'Hochwertige Website für ein Architekturbüro in Leipzig. Dunkel, minimalistisch, viel Weißraum. Projekte, Team, Kontaktformular und Terminbuchung.',
  'Website für eine Zahnarztpraxis in Hamburg mit Prophylaxe, Implantologie und Online-Terminbuchung.',
  'Kanzlei für Arbeitsrecht in Köln — seriös, klare Leistungen, Kontaktformular.',
  'Handwerksbetrieb für Elektroinstallation in Kassel mit Referenzen und Anfahrtskarte.',
];

const QUICK_ACTIONS: readonly string[] = [
  'Mach das Farbschema dunkel.',
  'Die Ecken bitte runder.',
  'Nimm Gold als Akzentfarbe.',
  'Mach den Hero größer.',
  'Füge ein Kontaktformular hinzu.',
  'Füge eine Referenzseite hinzu.',
];

/** Designer presets — Dark/Gold/Cream only, no cyan/teal. */
const DESIGNER_THEME_ACTIONS: readonly { label: string; instruction: string }[] = [
  { label: 'Dunkel', instruction: 'Mach das Farbschema dunkel.' },
  { label: 'Hell', instruction: 'Mach das Farbschema hell.' },
  { label: 'Gold-Akzent', instruction: 'Nimm #e4cfa2 als Akzentfarbe.' },
  { label: 'Cream-Akzent', instruction: 'Nimm #e8ddc8 als Akzentfarbe.' },
  { label: 'Harte Kanten', instruction: 'Die Ecken bitte eckig.' },
  { label: 'Weichere Kanten', instruction: 'Die Ecken bitte runder.' },
  { label: 'Hero größer', instruction: 'Mach den Hero größer.' },
];

const STAGES: readonly string[] = [
  'Anforderungen aus Ihrer Beschreibung abgeleitet',
  'Seitenstruktur und Navigation erstellt',
  'Inhalte und Komponenten aufgebaut',
  'Pflichtseiten und KI-Hinweis ergänzt',
  'Acht Analysedimensionen geprüft',
  'Frontend gerendert',
];

function BuildOsChrome({ subtitle }: { subtitle?: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-titanium-900 bg-obsidian-950/95 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to="/"
          className="grid h-8 w-8 place-items-center bg-[#e4cfa2] text-obsidian-950 shrink-0"
          aria-label="RealSync Startseite"
        >
          <Sparkles size={15} />
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-sm font-semibold text-titanium-50">
              Governance OS
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 border border-[#e4cfa2]/40 text-[#e4cfa2] bg-[#e4cfa2]/5">
              {STATUS_LABEL.preview}
            </span>
          </div>
          <p className="font-mono text-[10px] text-titanium-500 truncate">
            {subtitle ?? 'App Builder · Frontend Designer · /build'}
          </p>
        </div>
      </div>
      <nav className="flex items-center gap-2 shrink-0">
        <Link
          to="/app"
          className="font-mono text-[10px] uppercase tracking-wider text-titanium-400 hover:text-[#e4cfa2] border border-titanium-800 px-2.5 py-1.5"
        >
          Command Center
        </Link>
        <Link
          to="/"
          className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 hover:text-titanium-200 px-2 py-1.5"
        >
          Startseite
        </Link>
      </nav>
    </header>
  );
}

export default function BuildStudioPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const {
    tier,
    loading: entitlementsLoading,
    features,
    canAccess,
  } = useEntitlements();

  const entitlements = useMemo(
    () => resolveBuilderEntitlements(tier, features),
    [tier, features],
  );
  const previewUntilSsot = studioPreviewUntilSsot(entitlements);
  const entitled = canOpenAppBuilder(entitlements);
  const publishOk = canPublishSite(entitlements);
  const builderAccess = canAccess('siteos.builder');
  const upgradeHref = upgradeHrefFromAccess(builderAccess.upgradeUrl);

  const [state, setState] = useState<BuildState | null>(null);
  const blueprint = state?.blueprint ?? null;
  const findings = state?.findings ?? [];
  const scores = state?.scores ?? null;
  const hash = state?.contentSha256 ?? '';

  const auditContext = useMemo(
    () => resolveAuditContext(params.toString()),
    [params],
  );

  const [draft, setDraft] = useState(
    params.get('prompt') ?? (auditContext.domain ? `Neue Website für ${auditContext.domain}. ` : ''),
  );
  const [brand, setBrand] = useState('');
  const [instruction, setInstruction] = useState('');
  const [device, setDevice] = useState<Device>('desktop');
  const [path, setPath] = useState('/');
  const [pane, setPane] = useState<StudioPane>('builder');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [log, setLog] = useState<BuildStep[]>([]);
  const [error, setError] = useState('');

  const startedRef = useRef(false);

  const adopt = useCallback((next: BuildState) => {
    setState(next);
    setPath((current) =>
      next.blueprint.pages.some((page) => page.path === current) ? current : '/',
    );
  }, []);

  const run = useCallback(
    async (task: () => Promise<BuildState | null>) => {
      setBusy(true);
      setError('');
      setStage(0);
      try {
        const outcome = await task();
        if (outcome) adopt(outcome);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Die Website konnte nicht erzeugt werden.',
        );
      } finally {
        setBusy(false);
      }
    },
    [adopt],
  );

  useEffect(() => {
    if (authLoading || entitlementsLoading) return;
    if (!isAuthenticated) return;
    if (!entitled && entitlements.ssotReady) return;
    if (startedRef.current) return;
    startedRef.current = true;

    const fromUrl = params.get('prompt')?.trim();
    if (fromUrl) {
      void run(() => startBuild(fromUrl, null));
      return;
    }
    void run(() => resumeBuild());
  }, [
    authLoading,
    entitlementsLoading,
    isAuthenticated,
    entitled,
    entitlements.ssotReady,
    params,
    run,
  ]);

  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(
      () => setStage((s) => Math.min(s + 1, STAGES.length)),
      260,
    );
    return () => window.clearInterval(timer);
  }, [busy]);

  const html = useMemo(() => {
    if (!blueprint) return '';
    const pages = renderSite(blueprint, { presentation: 'showcase' });
    return pages.find((page) => page.path === path)?.html ?? pages[0]?.html ?? '';
  }, [blueprint, path]);

  const expiryNote = useMemo(() => {
    if (!state?.expiresAt) return '';
    const at = new Date(state.expiresAt);
    if (Number.isNaN(at.getTime())) return '';
    const date = at.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const days = Math.ceil((at.getTime() - Date.now()) / 86_400_000);
    if (days <= 0) return `Die Frist dieses Entwurfs ist am ${date} abgelaufen.`;
    return `Ohne Übernahme wird der Entwurf am ${date} gelöscht — noch ${days} ${days === 1 ? 'Tag' : 'Tage'}.`;
  }, [state?.expiresAt]);

  // ── Auth / entitlement gates ──────────────────────────────────────────
  if (authLoading || entitlementsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian-950 text-titanium-400">
        <Loader2 className="h-5 w-5 animate-spin" aria-label="Sitzung wird geprüft" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/welcome?next=${encodeURIComponent('/build')}`} replace />;
  }

  if (!entitled && entitlements.ssotReady) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-50">
        <BuildOsChrome subtitle="App Builder · Freischaltung erforderlich" />
        <BuilderUpgradePanel
          snapshot={entitlements}
          reason="no_entitlement"
          upgradeHref={upgradeHref}
        />
      </div>
    );
  }

  const submitPrompt = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (text.length < 10) {
      setError('Bitte beschreiben Sie in einem Satz, was entstehen soll.');
      return;
    }
    setLog([]);
    void run(() => startBuild(text, brand));
  };

  const submitInstruction = (text: string) => {
    if (!state) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    setInstruction('');
    setBusy(true);
    setError('');

    void (async () => {
      try {
        const { state: next, step } = await applyInstruction(state, trimmed);
        setLog((entries) => [step, ...entries].slice(0, 12));
        adopt(next);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Die Änderung konnte nicht angewendet werden.',
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  const restart = () => {
    clearBuildSession();
    setState(null);
    setLog([]);
    setDraft('');
    setPane('builder');
  };

  // ── Einstieg: App-Builder Intent ──────────────────────────────────────
  if (!blueprint && !busy) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-50">
        <BuildOsChrome />
        {previewUntilSsot && <SsotPendingBanner />}
        <div className="mx-auto max-w-3xl px-6 py-12">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#e4cfa2]">
            App Builder · Intent → Blueprint · {STATUS_LABEL.preview}
          </p>
          <h1
            className="font-display font-semibold text-titanium-50"
            style={{ fontSize: OS_H1 }}
          >
            Was möchten Sie erstellen?
          </h1>
          {auditContext.domain && (
            <div className="mt-4 border border-[#e4cfa2]/25 bg-[#e4cfa2]/5 px-4 py-3 text-sm text-titanium-200">
              <div className="font-semibold text-titanium-100">
                Neubau für {auditContext.domain}
              </div>
              <p className="mt-1 text-titanium-400">
                Der Bau kennt Ihren Scan
                {auditContext.auditId
                  ? ` (Audit ${auditContext.auditId.slice(0, 8)})`
                  : ''}
                . Die Beschreibung unten ist ein Anfang — ergänzen Sie sie.
              </p>
            </div>
          )}
          <p className="mt-4 text-sm text-titanium-400 leading-relaxed max-w-2xl">
            Beschreiben Sie App oder Website auf Deutsch. siteos-core erzeugt
            Blueprint und Vorschau lokal. Live-Orchestrierung (Planner/Coder)
            und Veröffentlichung bleiben {STATUS_LABEL.preview} /{' '}
            {STATUS_LABEL['coming-soon']} — keine Fake-Deploy-URL.
          </p>

          <form onSubmit={submitPrompt} className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="build-brand"
                className="block text-sm font-medium text-titanium-200"
              >
                Wie heißt Ihr Unternehmen?{' '}
                <span className="text-titanium-500">(optional)</span>
              </label>
              <input
                id="build-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="z. B. Studio Vogt Architekten"
                className="mt-2 w-full border border-titanium-700 bg-obsidian-900 px-4 py-3 text-titanium-50 placeholder-titanium-500 transition-colors focus:border-[#e4cfa2]/60 focus:outline-none"
              />
            </div>

            <label
              htmlFor="build-prompt"
              className="block text-sm font-medium text-titanium-200"
            >
              Ihre Beschreibung
            </label>
            <textarea
              id="build-prompt"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              autoFocus
              placeholder="z. B. Hochwertige Website für ein Architekturbüro in Leipzig…"
              className="w-full resize-none border border-titanium-700 bg-obsidian-900 px-4 py-4 text-titanium-50 placeholder-titanium-500 transition-colors focus:border-[#e4cfa2]/60 focus:outline-none"
            />

            {error && (
              <div className="border border-red-700 bg-red-900/20 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              className={`w-full px-6 py-3.5 text-sm font-semibold uppercase tracking-wider transition-colors ${OS_CREAM_BTN}`}
            >
              Blueprint erzeugen
            </button>
          </form>

          <div className="mt-8">
            <div className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[.16em] text-titanium-500">
              Beispiele
            </div>
            <div className="space-y-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setDraft(example)}
                  className="w-full border border-titanium-800 px-4 py-3 text-left text-sm text-titanium-300 transition-colors hover:border-[#e4cfa2]/40 hover:text-titanium-100"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-10 border-t border-titanium-800 pt-6 text-sm text-titanium-400">
            Sie haben bereits eine Website?{' '}
            <button
              type="button"
              onClick={() => navigate('/audit')}
              className="text-[#e4cfa2] underline underline-offset-4 hover:text-[#f0e6d4]"
            >
              Bestehende Website analysieren
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Aufbau ────────────────────────────────────────────────────────────
  if (busy && !blueprint) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-50">
        <BuildOsChrome subtitle="App Builder · Entwurf wird erzeugt…" />
        {previewUntilSsot && <SsotPendingBanner />}
        <div className="grid place-items-center px-6 py-20">
          <div className="w-full max-w-md">
            <div className="mb-6 flex items-center gap-3">
              <Loader2 size={20} className="animate-spin text-[#e4cfa2]" />
              <span className="font-semibold">Blueprint wird aufgebaut</span>
            </div>
            <ul className="space-y-3">
              {STAGES.map((label, index) => (
                <li
                  key={label}
                  className={`flex items-center gap-3 text-sm ${index < stage ? 'text-titanium-200' : 'text-titanium-600'}`}
                >
                  <span
                    className={`grid h-5 w-5 place-items-center border ${index < stage ? 'border-[#e4cfa2] bg-[#e4cfa2]/15 text-[#e4cfa2]' : 'border-titanium-700'}`}
                  >
                    {index < stage ? <Check size={12} /> : null}
                  </span>
                  {label}
                </li>
              ))}
            </ul>
            <p className="mt-6 font-mono text-[10px] text-titanium-600">
              Fortschritt ist UI-Status — keine Fake-Produktmetrik.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!blueprint || !state) return null;

  const critical = findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'high',
  );
  const claimable = state.session.mode === 'server';

  // ── Two-pane studio ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-50">
      <BuildOsChrome
        subtitle={`${blueprint.name} · ${blueprint.pages.length} Seiten · ${hash.slice(0, 12)}…`}
      />
      {previewUntilSsot && <SsotPendingBanner />}

      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-titanium-900 bg-obsidian-950/90 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 place-items-center bg-[#e4cfa2]/15 text-[#e4cfa2]">
            <Sparkles size={15} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{blueprint.name}</div>
            <div className="font-mono text-[10px] text-titanium-500">
              Preview · kein Publish · kein Domain-Anschluss
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1 border border-titanium-800 bg-obsidian-800 p-1"
            role="tablist"
            aria-label="Studio-Fläche"
          >
            <PaneTab
              active={pane === 'builder'}
              onClick={() => setPane('builder')}
              icon={<MessageSquare size={13} />}
              label="App Builder"
            />
            <PaneTab
              active={pane === 'designer'}
              onClick={() => setPane('designer')}
              icon={<Palette size={13} />}
              label="Frontend Designer"
            />
          </div>

          <div className="flex items-center gap-1 border border-titanium-800 bg-obsidian-800 p-1">
            {(['desktop', 'tablet', 'mobile'] as const).map((key) => {
              const Icon = key === 'desktop' ? Monitor : key === 'tablet' ? Tablet : Smartphone;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDevice(key)}
                  aria-label={key}
                  aria-pressed={device === key}
                  className={`p-1.5 ${device === key ? 'bg-titanium-800 text-titanium-50' : 'text-titanium-500'}`}
                >
                  <Icon size={14} />
                </button>
              );
            })}
          </div>

          {!claimable && (
            <span className="inline-flex items-center gap-1.5 border border-amber-700 px-2.5 py-1 text-[10px] text-amber-400 font-mono uppercase tracking-wider">
              <AlertTriangle size={11} /> Nur lokal — nicht übernehmbar
            </span>
          )}
          {entitlements.ssotReady && !publishOk && (
            <span className="inline-flex items-center gap-1.5 border border-titanium-700 px-2.5 py-1 text-[10px] text-titanium-500 font-mono uppercase tracking-wider">
              Publish {STATUS_LABEL.preview}
            </span>
          )}

          <button
            type="button"
            onClick={() => navigate('/app/siteos/claim')}
            disabled={!claimable}
            title={
              claimable
                ? undefined
                : 'Übernehmen erst möglich, wenn der Dienst für gespeicherte Entwürfe erreichbar ist.'
            }
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-40 ${OS_CREAM_BTN}`}
          >
            Website übernehmen <ArrowRight size={14} />
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] min-h-[calc(100vh-8rem)]">
        {/* Left: App Builder chat OR Designer controls */}
        <aside className="border-b border-titanium-800 lg:border-b-0 lg:border-r flex flex-col min-h-0">
          {pane === 'builder' ? (
            <AppBuilderPane
              instruction={instruction}
              setInstruction={setInstruction}
              onSubmit={submitInstruction}
              busy={busy}
              log={log}
              error={error}
              onRestart={restart}
              pages={blueprint.pages}
              path={path}
              setPath={setPath}
            />
          ) : (
            <FrontendDesignerPane
              blueprint={blueprint}
              path={path}
              setPath={setPath}
              busy={busy}
              onThemeAction={submitInstruction}
              publishOk={publishOk}
            />
          )}
        </aside>

        {/* Right: live canvas — same blueprint the chat/designer edits */}
        <section className="min-w-0 p-3 sm:p-5 flex flex-col">
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-titanium-500">
            <LayoutTemplate size={12} className="text-[#e4cfa2]" />
            Canvas · Blueprint-Vorschau · kein Live-Deploy
          </div>
          <div className="flex min-h-[70vh] flex-1 justify-center overflow-auto border border-titanium-800 bg-obsidian-900 p-3 sm:p-5">
            <div
              style={{ width: DEVICE_WIDTH[device] }}
              className="overflow-hidden bg-white shadow-2xl transition-all"
            >
              <SandboxedPreviewFrame
                title={`Vorschau ${blueprint.name} — ${path}`}
                html={html}
                className="h-[78vh] w-full border-0"
              />
            </div>
          </div>
          {busy && (
            <div className="mt-3 flex items-center gap-2 text-xs text-titanium-400">
              <Loader2 size={13} className="animate-spin" /> Änderung wird angewendet …
            </div>
          )}
          {scores && (
            <div className="mt-4 border border-titanium-800 p-4">
              <div className="flex items-center gap-2 text-xs font-bold">
                <ShieldCheck size={14} className="text-[#e4cfa2]" /> Prüfstand des Entwurfs
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                {(
                  [
                    ['Health', scores.health],
                    ['Compliance', scores.compliance],
                    ['SEO', scores.dimensions.seo],
                    ['Barrierefreiheit', scores.dimensions.accessibility],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="bg-obsidian-800 px-3 py-2">
                    <dt className="text-titanium-500">{label}</dt>
                    <dd className="font-mono text-sm text-titanium-100">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[11px] leading-5 text-titanium-400">
                {findings.length === 0
                  ? 'Keine offenen Befunde in den acht Analysedimensionen.'
                  : `${findings.length} Befund${findings.length === 1 ? '' : 'e'}${critical.length > 0 ? `, davon ${critical.length} mit hoher Dringlichkeit` : ''}.`}
              </p>
              {expiryNote && (
                <p className="mt-2 font-mono text-[10px] text-titanium-500">{expiryNote}</p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SsotPendingBanner() {
  return (
    <div
      className="border-b border-[#e4cfa2]/25 bg-[#e4cfa2]/5 px-4 py-2 text-center font-mono text-[10px] text-[#e4cfa2]"
      data-testid="builder-ssot-pending-banner"
    >
      Plan-Freischaltung (siteos.builder / limit.sites) folgt dem Monetisierungs-PR — Studio läuft als{' '}
      {STATUS_LABEL.preview}, kein bezahltes Entitlement vorgetäuscht.
    </div>
  );
}

function PaneTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider ${
        active
          ? 'bg-titanium-800 text-titanium-50'
          : 'text-titanium-500 hover:text-titanium-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function AppBuilderPane({
  instruction,
  setInstruction,
  onSubmit,
  busy,
  log,
  error,
  onRestart,
  pages,
  path,
  setPath,
}: {
  instruction: string;
  setInstruction: (v: string) => void;
  onSubmit: (text: string) => void;
  busy: boolean;
  log: BuildStep[];
  error: string;
  onRestart: () => void;
  pages: SiteBlueprint['pages'];
  path: string;
  setPath: (p: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col p-4 sm:p-5 min-h-0">
      <div className="flex items-center gap-2 text-sm font-bold">
        <Wand2 size={16} className="text-[#e4cfa2]" /> App Builder
      </div>
      <p className="mt-1 text-xs leading-5 text-titanium-400">
        Intent auf Deutsch. Änderungen aktualisieren denselben Blueprint — kein
        getrenntes Mock.
      </p>

      <div className="mt-4 mb-3 text-[10px] font-bold uppercase tracking-[.16em] text-titanium-500">
        Seiten
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {pages.map((page) => (
          <button
            key={page.path}
            type="button"
            onClick={() => setPath(page.path)}
            className={`px-2.5 py-1.5 text-left text-[11px] border ${
              path === page.path
                ? 'border-[#e4cfa2]/50 bg-[#e4cfa2]/10 text-titanium-50'
                : 'border-titanium-800 text-titanium-400 hover:border-titanium-600'
            }`}
          >
            <span className="block truncate max-w-[140px]">{page.title}</span>
            <span className="block truncate font-mono text-[9px] text-titanium-600">
              {page.path}
            </span>
          </button>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(instruction);
        }}
        className="mt-auto"
      >
        <label htmlFor="refine" className="sr-only">
          Änderungswunsch
        </label>
        <textarea
          id="refine"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={3}
          placeholder="z. B. Mach den Hero größer."
          className="w-full resize-none border border-titanium-700 bg-obsidian-800 p-3 text-xs text-titanium-50 placeholder-titanium-600 focus:border-[#e4cfa2]/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!instruction.trim() || busy}
          className="mt-2 w-full border border-titanium-700 bg-titanium-800 px-3 py-2.5 text-xs font-bold text-titanium-50 disabled:opacity-40"
        >
          Änderung anwenden
        </button>
      </form>

      <div className="mt-4 text-[10px] font-bold uppercase tracking-[.16em] text-titanium-500">
        Schnell ändern
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action}
            type="button"
            disabled={busy}
            onClick={() => onSubmit(action)}
            className="border border-titanium-800 px-3 py-1.5 text-[11px] text-titanium-400 hover:border-[#e4cfa2]/40 hover:text-titanium-100 disabled:opacity-40"
          >
            {action}
          </button>
        ))}
      </div>

      {log.length > 0 && (
        <div className="mt-5 max-h-40 overflow-auto">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-titanium-500">
            Verlauf
          </div>
          <ul className="space-y-2">
            {log.map((step) => (
              <li
                key={`${step.at}-${step.instruction}`}
                className="border border-titanium-800 p-2 text-[11px] leading-5"
              >
                <div className="text-titanium-300">„{step.instruction}"</div>
                {step.changes.map((change) => (
                  <div key={change.code} className="mt-1 text-titanium-500">
                    · {change.summary}
                  </div>
                ))}
                {!step.understood && (
                  <div className="mt-1 text-amber-400">
                    Nicht verstanden — nichts geändert.
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="mt-3 border border-red-700 bg-red-900/20 p-2 text-[11px] text-red-300">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={onRestart}
        className="mt-4 w-full border border-titanium-800 px-3 py-2 text-xs text-titanium-400 hover:text-titanium-200"
      >
        Neu beginnen
      </button>
    </div>
  );
}

function FrontendDesignerPane({
  blueprint,
  path,
  setPath,
  busy,
  onThemeAction,
  publishOk,
}: {
  blueprint: SiteBlueprint;
  path: string;
  setPath: (p: string) => void;
  busy: boolean;
  onThemeAction: (instruction: string) => void;
  publishOk: boolean;
}) {
  const page = blueprint.pages.find((p) => p.path === path) ?? blueprint.pages[0];
  const theme = blueprint.theme;

  return (
    <div className="flex flex-1 flex-col p-4 sm:p-5 min-h-0 overflow-auto">
      <div className="flex items-center gap-2 text-sm font-bold">
        <Palette size={16} className="text-[#e4cfa2]" /> Frontend Designer
      </div>
      <p className="mt-1 text-xs leading-5 text-titanium-400">
        Layout, Typo und Dark/Gold/Cream-Tokens. Jede Änderung schreibt in den
        Blueprint — nicht in ein getrenntes Mock.
      </p>

      <div className="mt-5 border border-titanium-800 bg-obsidian-900 p-3">
        <div className="font-mono text-[9px] uppercase tracking-widest text-titanium-500 mb-2">
          Aktives Theme
        </div>
        <dl className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <dt className="text-titanium-600">Mode</dt>
            <dd className="font-mono text-titanium-200">{theme.mode}</dd>
          </div>
          <div>
            <dt className="text-titanium-600">Radius</dt>
            <dd className="font-mono text-titanium-200">{theme.radiusPx}px</dd>
          </div>
          <div>
            <dt className="text-titanium-600">Akzent</dt>
            <dd className="font-mono text-titanium-200 flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 border border-titanium-700"
                style={{ background: theme.accent }}
              />
              {theme.accent}
            </dd>
          </div>
          <div>
            <dt className="text-titanium-600">Display</dt>
            <dd className="font-mono text-titanium-200 truncate">{theme.fontDisplay}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-5 text-[10px] font-bold uppercase tracking-[.16em] text-titanium-500">
        Tokens anpassen
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {DESIGNER_THEME_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={busy}
            onClick={() => onThemeAction(action.instruction)}
            className="border border-titanium-800 px-3 py-1.5 text-[11px] text-titanium-300 hover:border-[#e4cfa2]/40 hover:text-[#e4cfa2] disabled:opacity-40"
          >
            {action.label}
          </button>
        ))}
      </div>

      <div className="mt-6 text-[10px] font-bold uppercase tracking-[.16em] text-titanium-500">
        Seite · Abschnitte
      </div>
      <div className="mt-2 space-y-1">
        {blueprint.pages.map((p) => (
          <button
            key={p.path}
            type="button"
            onClick={() => setPath(p.path)}
            className={`w-full px-3 py-2 text-left text-xs border ${
              path === p.path
                ? 'border-[#e4cfa2]/40 bg-[#e4cfa2]/5 text-titanium-50'
                : 'border-transparent text-titanium-400 hover:bg-obsidian-800'
            }`}
          >
            {p.title}
            <span className="ml-2 font-mono text-[9px] text-titanium-600">{p.path}</span>
          </button>
        ))}
      </div>

      {page && (
        <ul className="mt-4 space-y-1.5">
          {page.blocks.map((block) => (
            <li
              key={block.id}
              className="flex items-center justify-between border border-titanium-800 px-3 py-2 text-[11px]"
            >
              <span className="text-titanium-300">{block.kind}</span>
              <span className="font-mono text-[9px] text-titanium-600">{block.id.slice(0, 8)}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 font-mono text-[10px] leading-4 text-titanium-600">
        Veröffentlichung und Custom Domain: {STATUS_LABEL.preview}
        {publishOk
          ? ' — siteos.publish freigeschaltet, öffentliches Deploy bleibt Preview.'
          : ' — siteos.publish fehlt; kein Fake-Deploy.'}{' '}
        Kein erfolgreiches Deploy wird simuliert.
      </p>
    </div>
  );
}
