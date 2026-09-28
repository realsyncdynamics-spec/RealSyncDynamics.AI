/**
 * RealSyncDynamics Local AI Onboarding — `/app/local-ai/onboarding`.
 *
 * Nicht „Ollama verbinden", sondern: lokale KI als kontrollierten
 * Governance-Agenten aktivieren. Sechs Schritte mit einheitlichem Status
 * (pending · checking · success · warning · failed):
 *   1 Installieren · 2 Verbindung · 3 Modellrolle · 4 Governance-Test ·
 *   5 Profil speichern · 6 optionaler lokaler Healthcheck-Loop.
 *
 * Grenzen (bewusst):
 * - Profil wird nur auf diesem Gerät gespeichert. Keine Behauptung, dass eine
 *   produktive Automatisierung läuft.
 * - Der Loop ist ein lokaler Healthcheck, kein autonomer Produktiv-Agent.
 * - tenant_id kommt nur aus dem TenantProvider (serverseitig geprüfte
 *   Mitgliedschaft), nie aus URL oder localStorage.
 * - Keine Mock-KPIs: jede Zahl stammt aus einer echten Messung.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Download,
  Loader2,
  Lock,
  Moon,
  Play,
  ShieldCheck,
  Square,
  Sun,
  XCircle,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import {
  DEFAULT_PROFILE_NAME,
  DEFAULT_RUNTIME_URL,
  LAN_RUNTIME_URL_EXAMPLE,
  LOCAL_AI_ROLES,
  OLLAMA_DOWNLOAD_URL,
  getRole,
  isCloudModel,
  isModelInstalled,
  isRoleUnlocked,
} from './roles';
import { connectionOutcome, probeRuntime } from './runtimeClient';
import { GOVERNANCE_TEST_CASE, GOVERNANCE_TEST_INSTRUCTION, runGovernanceTest, summarizeTest } from './governanceTest';
import {
  ProfileError,
  loadProfile,
  registerProfileWithTenant,
  saveProfile,
  type RegistrationResult,
} from './profileStore';
import { useLocalHealthLoop } from './healthLoop';
import {
  INITIAL_FLOW_STATE,
  canActivate,
  canRunTest,
  canStartLoop,
  deriveStepStatuses,
  type OnboardingFlowState,
} from './stepStatus';
import type { GovernanceTestSummary, LocalAiRoleId, LocalAiRuntimeProfile, StepStatus } from './types';

// ── Theme: gleiche Struktur hell/dunkel, lokal gescoped (kein globaler Token-Eingriff) ──

type Theme = 'dark' | 'light';
const THEME_KEY = 'realsync.localAi.theme';

const THEME_VARS: Record<Theme, CSSProperties> = {
  dark: {
    '--la-bg': '#070B14',
    '--la-panel': '#0D1322',
    '--la-inset': '#050810',
    '--la-line': '#1F2B48',
    '--la-text': '#F2F5FA',
    '--la-muted': '#8A95AC',
    '--la-accent': '#00B8D4',
    '--la-primary': '#1E5AFF',
    '--la-success': '#34D399',
    '--la-warning': '#FBBF24',
    '--la-failed': '#F87171',
  } as CSSProperties,
  light: {
    '--la-bg': '#F5F7FB',
    '--la-panel': '#FFFFFF',
    '--la-inset': '#EEF2F8',
    '--la-line': '#D5DCE8',
    '--la-text': '#0B1220',
    '--la-muted': '#566078',
    '--la-accent': '#007C91',
    '--la-primary': '#1E5AFF',
    '--la-success': '#047857',
    '--la-warning': '#B45309',
    '--la-failed': '#B91C1C',
  } as CSSProperties,
};

function readTheme(): Theme {
  try {
    return window.localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

// ── Bausteine ──────────────────────────────────────────────────────────────

const STATUS_META: Record<StepStatus, { label: string; color: string; Icon: typeof Circle }> = {
  pending: { label: 'Ausstehend', color: 'var(--la-muted)', Icon: Circle },
  checking: { label: 'Prüft …', color: 'var(--la-accent)', Icon: Loader2 },
  success: { label: 'Erfolgreich', color: 'var(--la-success)', Icon: CheckCircle2 },
  warning: { label: 'Warnung', color: 'var(--la-warning)', Icon: AlertTriangle },
  failed: { label: 'Fehlgeschlagen', color: 'var(--la-failed)', Icon: XCircle },
};

export function StatusBadge({ status, label }: { status: StepStatus; label?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      data-status={status}
      className="inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest"
      style={{ color: meta.color, borderColor: meta.color }}
    >
      <meta.Icon className={`h-3 w-3 ${status === 'checking' ? 'animate-spin' : ''}`} aria-hidden />
      {label ?? meta.label}
    </span>
  );
}

function StepCard({
  index,
  title,
  status,
  statusLabel,
  locked,
  children,
}: {
  index: string;
  title: string;
  status: StepStatus;
  statusLabel?: string;
  locked?: string | null;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`la-step-${index}`}
      className="border border-[var(--la-line)] bg-[var(--la-panel)] p-4 sm:p-5"
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id={`la-step-${index}`} className="flex items-center gap-3 text-base font-semibold text-[var(--la-text)]">
          <span className="font-mono text-xs text-[var(--la-accent)]">{index}</span>
          {title}
        </h2>
        <StatusBadge status={status} label={statusLabel} />
      </header>
      {locked ? (
        <p className="flex items-center gap-2 text-sm text-[var(--la-muted)]">
          <Lock className="h-4 w-4" aria-hidden /> {locked}
        </p>
      ) : (
        <div className="space-y-4">{children}</div>
      )}
    </section>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  variant = 'primary',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
  type?: 'button' | 'submit';
}) {
  const base =
    'inline-flex min-h-[44px] items-center justify-center gap-2 px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--la-accent)]';
  const look =
    variant === 'primary'
      ? 'bg-[var(--la-primary)] text-white hover:brightness-110'
      : 'border border-[var(--la-line)] text-[var(--la-text)] hover:border-[var(--la-accent)]';
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${look}`}>
      {children}
    </button>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return (
    <code className="break-all border border-[var(--la-line)] bg-[var(--la-inset)] px-1.5 py-0.5 font-mono text-xs text-[var(--la-text)]">
      {children}
    </code>
  );
}

function Notice({ tone, children }: { tone: 'warning' | 'failed' | 'success' | 'info'; children: ReactNode }) {
  const color = tone === 'info' ? 'var(--la-accent)' : `var(--la-${tone})`;
  return (
    <div role={tone === 'failed' ? 'alert' : 'status'} className="border-l-2 bg-[var(--la-inset)] px-3 py-2 text-sm text-[var(--la-text)]" style={{ borderColor: color }}>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border border-[var(--la-line)] bg-[var(--la-inset)] p-3">
      <dt className="font-mono text-[10px] uppercase tracking-widest text-[var(--la-muted)]">{label}</dt>
      <dd className="mt-1 text-sm text-[var(--la-text)]">{value}</dd>
    </div>
  );
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'medium' });
}

const OUTCOME_LABEL = {
  reachable: 'Runtime erreichbar',
  unreachable: 'Runtime nicht erreichbar',
  blocked: 'CORS / Netzwerk blockiert',
  no_models: 'Ollama läuft, aber kein Modell verfügbar',
  invalid: 'URL ungültig',
} as const;

// ── View ───────────────────────────────────────────────────────────────────

export function LocalAiOnboardingView() {
  const { activeTenantId, tenants, loading: tenantLoading } = useTenant();
  // Autorität: nur eine Mandanten-ID, deren Mitgliedschaft der Server geliefert hat.
  const verifiedTenantId = useMemo(
    () => (activeTenantId && tenants.some((t) => t.tenantId === activeTenantId) ? activeTenantId : null),
    [activeTenantId, tenants],
  );

  const [theme, setTheme] = useState<Theme>(readTheme);
  const [runtimeUrl, setRuntimeUrl] = useState(DEFAULT_RUNTIME_URL);
  const [profileName, setProfileName] = useState(DEFAULT_PROFILE_NAME);
  const [flow, setFlow] = useState<OnboardingFlowState>(INITIAL_FLOW_STATE);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [registration, setRegistration] = useState<RegistrationResult | null>(null);
  const [registering, setRegistering] = useState(false);
  const [loopArmed, setLoopArmed] = useState(false);

  const patch = useCallback((p: Partial<OnboardingFlowState>) => setFlow((f) => ({ ...f, ...p })), []);

  // Gespeichertes Profil dieses Geräts vorbelegen — der Status bleibt „pending",
  // bis in dieser Sitzung neu geprüft wurde.
  useEffect(() => {
    const stored = loadProfile(verifiedTenantId);
    patch({ savedProfile: stored });
    if (stored) {
      setRuntimeUrl(stored.runtime_url);
      setProfileName(stored.profile_name);
      patch({ role: stored.role, model: stored.model });
    }
  }, [verifiedTenantId, patch]);

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      /* reine Anzeige-Präferenz */
    }
  };

  const statuses = deriveStepStatuses(flow);
  const probe = flow.probe;
  const installedModels = probe?.ok ? probe.data.models : [];
  const currentTest = flow.test?.ok && flow.test.data.model === flow.model ? flow.test.data : null;
  // Basistest: irgendein in dieser Sitzung bestandener Test oder der gespeicherte.
  const baseTest: GovernanceTestSummary | null =
    flow.test?.ok && flow.test.data.overall === 'success'
      ? summarizeTest(flow.test.data)
      : flow.savedProfile?.test_result ?? null;

  const checkConnection = async () => {
    patch({ probing: true, test: null });
    const result = await probeRuntime(runtimeUrl);
    patch({ probing: false, probe: result });
  };

  const selectRole = (id: LocalAiRoleId) => {
    const role = getRole(id);
    if (!isRoleUnlocked(role, baseTest)) return;
    patch({ role: id, model: role.recommendedModel });
  };

  const runTest = async () => {
    if (!probe?.ok) return;
    patch({ testing: true });
    const result = await runGovernanceTest({ runtimeUrl: probe.data.runtimeUrl, model: flow.model });
    patch({ testing: false, test: result });
  };

  const activate = () => {
    setSaveError(null);
    setRegistration(null);
    if (!probe?.ok || !currentTest || !flow.role) return;
    const profile: LocalAiRuntimeProfile = {
      schema_version: 1,
      scope: 'device_local',
      profile_name: profileName.trim() || DEFAULT_PROFILE_NAME,
      runtime_url: probe.data.runtimeUrl,
      model: flow.model,
      role: flow.role,
      last_healthcheck: probe.data.checkedAt,
      test_result: summarizeTest(currentTest),
      enabled: true,
    };
    try {
      patch({ savedProfile: saveProfile(verifiedTenantId, profile) });
    } catch (err) {
      setSaveError(err instanceof ProfileError ? `${err.code}: ${err.message}` : 'Speichern fehlgeschlagen.');
    }
  };

  const register = async () => {
    if (!flow.savedProfile) return;
    setRegistering(true);
    setRegistration(await registerProfileWithTenant(flow.savedProfile, verifiedTenantId));
    setRegistering(false);
  };

  const loop = useLocalHealthLoop({
    running: flow.loopRunning,
    runtimeUrl: flow.savedProfile?.runtime_url ?? null,
    model: flow.savedProfile?.model ?? null,
    onSnapshot: (snap) => {
      if (!snap.runtimeReachable || !snap.modelReachable) return;
      setFlow((f) => {
        if (!f.savedProfile) return f;
        const next = { ...f.savedProfile, last_healthcheck: snap.checkedAt };
        try {
          return { ...f, savedProfile: saveProfile(verifiedTenantId, next) };
        } catch {
          return f;
        }
      });
    },
  });

  // Loop-Zustand in den Flow spiegeln, damit der Status abgeleitet werden kann.
  useEffect(() => {
    patch({ loopChecking: loop.checking, loopSnapshot: loop.snapshot });
  }, [loop.checking, loop.snapshot, patch]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const outcome = probe ? connectionOutcome(probe) : null;
  const role = flow.role ? getRole(flow.role) : null;
  const modelInstalled = isModelInstalled(flow.model, installedModels);

  return (
    <div
      data-theme={theme}
      data-testid="local-ai-onboarding"
      style={THEME_VARS[theme]}
      className="min-h-full bg-[var(--la-bg)] px-4 py-6 text-[var(--la-text)] sm:px-6 lg:px-10"
    >
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--la-accent)]">Local AI · Setup</p>
            <h1 className="mt-1 text-2xl font-semibold">Lokale KI als Governance-Agent aktivieren</h1>
            <p className="mt-1 text-sm text-[var(--la-muted)]">
              Installation, Verbindung, Modellrolle, Governance-Test, Profil. Erst danach wird freigeschaltet.
            </p>
          </div>
          <Btn variant="ghost" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
            {theme === 'dark' ? 'Hell' : 'Dunkel'}
          </Btn>
        </header>

        <ol aria-label="Fortschritt" className="flex gap-2 overflow-x-auto pb-1">
          {(
            [
              ['01', 'Installieren', statuses.install],
              ['02', 'Verbindung', statuses.connection],
              ['03', 'Rolle', statuses.role],
              ['04', 'Test', statuses.governance_test],
              ['05', 'Profil', statuses.profile],
              ['06', 'Loop', statuses.loop],
            ] as const
          ).map(([idx, label, st]) => (
            <li
              key={idx}
              data-status={st}
              className="flex shrink-0 items-center gap-1.5 border border-[var(--la-line)] bg-[var(--la-panel)] px-2 py-1 text-xs"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: STATUS_META[st].color }} aria-hidden />
              <span className="font-mono text-[var(--la-muted)]">{idx}</span> {label}
            </li>
          ))}
        </ol>

        {!tenantLoading && !verifiedTenantId && (
          <Notice tone="warning">
            Kein verifizierter Mandant aktiv. Verbindung und Test funktionieren, speichern ist erst mit aktivem Mandanten möglich.
          </Notice>
        )}

        {/* 1 · Installieren */}
        <StepCard
          index="01"
          title="Lokale KI vorbereiten"
          status={statuses.install}
          statusLabel={
            statuses.install === 'pending'
              ? 'Nicht geprüft'
              : statuses.install === 'success'
                ? 'Installiert'
                : statuses.install === 'warning'
                  ? 'Installiert · blockiert'
                  : statuses.install === 'failed'
                    ? 'Fehlt'
                    : undefined
          }
        >
          <p className="text-sm text-[var(--la-muted)]">
            Die lokale KI läuft auf deinem Gerät. RealSyncDynamics prüft nur Verbindung, Modell und Governance-Fähigkeit.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={OLLAMA_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 border border-[var(--la-line)] px-4 text-sm hover:border-[var(--la-accent)]"
            >
              <Download className="h-4 w-4" aria-hidden /> Ollama herunterladen
            </a>
            <Btn variant="ghost" onClick={checkConnection} disabled={flow.probing}>
              Installation prüfen
            </Btn>
          </div>
        </StepCard>

        {/* 2 · Verbindung */}
        <StepCard index="02" title="Verbindung prüfen" status={statuses.connection} statusLabel={outcome ? OUTCOME_LABEL[outcome] : undefined}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void checkConnection();
            }}
            className="space-y-3"
          >
            <label className="block space-y-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--la-muted)]">Local Server URL</span>
              <input
                type="url"
                inputMode="url"
                value={runtimeUrl}
                onChange={(e) => setRuntimeUrl(e.target.value)}
                className="w-full border border-[var(--la-line)] bg-[var(--la-inset)] px-3 py-2.5 font-mono text-sm text-[var(--la-text)] outline-none focus:border-[var(--la-accent)]"
                aria-describedby="la-url-help"
              />
            </label>
            <p id="la-url-help" className="text-xs text-[var(--la-muted)]">
              Standard <Mono>{DEFAULT_RUNTIME_URL}</Mono> · anderes Gerät im LAN <Mono>{LAN_RUNTIME_URL_EXAMPLE}</Mono>
            </p>
            <Btn type="submit" disabled={flow.probing}>
              {flow.probing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Verbindung testen
            </Btn>
          </form>

          {probe && !probe.ok && (
            <Notice tone={outcome === 'blocked' ? 'warning' : 'failed'}>
              <p>
                <span className="font-mono text-xs">{probe.error.code}</span> · {probe.error.message}
              </p>
              {probe.error.hint && <p className="mt-1 text-xs text-[var(--la-muted)]">{probe.error.hint}</p>}
            </Notice>
          )}
          {probe?.ok && (
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Metric label="Runtime" value={<span className="break-all font-mono text-xs">{probe.data.runtimeUrl}</span>} />
              <Metric label="Antwortzeit" value={`${probe.data.latencyMs} ms`} />
              <Metric label="Modelle installiert" value={probe.data.models.length} />
            </dl>
          )}
          {outcome === 'no_models' && (
            <Notice tone="warning">
              Ollama läuft, aber kein Modell ist installiert. Empfohlen für den Start: <Mono>ollama pull granite4.2:8b</Mono>
            </Notice>
          )}
        </StepCard>

        {/* 3 · Modellrolle */}
        <StepCard
          index="03"
          title="Modellrolle wählen"
          status={statuses.role}
          locked={statuses.connection === 'success' ? null : 'Erst nach erfolgreicher Verbindung verfügbar.'}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Modellrolle">
            {LOCAL_AI_ROLES.map((r) => {
              const unlocked = isRoleUnlocked(r, baseTest);
              const selected = flow.role === r.id;
              const installed = isModelInstalled(r.recommendedModel, installedModels);
              return (
                <button
                  key={r.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!unlocked}
                  onClick={() => selectRole(r.id)}
                  className={`min-h-[44px] border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected ? 'border-[var(--la-accent)] bg-[var(--la-inset)]' : 'border-[var(--la-line)] hover:border-[var(--la-accent)]'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2 text-sm font-medium">
                    {r.label}
                    {!unlocked && <Lock className="h-3.5 w-3.5 text-[var(--la-muted)]" aria-label="gesperrt" />}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--la-muted)]">{r.description}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px]">
                    {r.recommendedModel}
                    <span style={{ color: installed ? 'var(--la-success)' : 'var(--la-muted)' }}>
                      {installed ? '· installiert' : '· nicht installiert'}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {role && (
            <div className="space-y-2">
              <label className="block space-y-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--la-muted)]">Modell für {role.label}</span>
                <select
                  value={flow.model}
                  onChange={(e) => patch({ model: e.target.value })}
                  className="w-full border border-[var(--la-line)] bg-[var(--la-inset)] px-3 py-2.5 font-mono text-sm text-[var(--la-text)] outline-none focus:border-[var(--la-accent)]"
                >
                  <option value={role.recommendedModel}>{role.recommendedModel} (empfohlen)</option>
                  {installedModels
                    .filter((m) => m !== role.recommendedModel && m !== `${role.recommendedModel}:latest`)
                    .map((m) => (
                      <option key={m} value={m} disabled={isCloudModel(m)}>
                        {isCloudModel(m) ? `${m} (Cloud — nicht lokal)` : m}
                      </option>
                    ))}
                </select>
              </label>
              {isCloudModel(flow.model) ? (
                <Notice tone="failed">
                  {flow.model} ist ein Ollama-Cloud-Modell: Anfragen verlassen das Gerät. Für die lokale Runtime bitte ein
                  lokal installiertes Modell wählen. Cloud-Modelle gehören in einen freigegebenen Cloud-/Hybrid-Betrieb.
                </Notice>
              ) : !modelInstalled && (
                <Notice tone="warning">
                  {flow.model} ist auf diesem Gerät nicht installiert. Installieren mit <Mono>ollama pull {flow.model}</Mono>, danach
                  Verbindung erneut testen.
                </Notice>
              )}
            </div>
          )}
        </StepCard>

        {/* 4 · Governance-Test */}
        <StepCard
          index="04"
          title="Governance-Testlauf"
          status={statuses.governance_test}
          locked={statuses.role === 'success' ? null : 'Erst mit installiertem Modell für die gewählte Rolle verfügbar.'}
        >
          <div className="space-y-2 text-sm">
            <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--la-muted)]">Testprompt</p>
            <blockquote className="border-l-2 border-[var(--la-accent)] bg-[var(--la-inset)] px-3 py-2">
              <p>{GOVERNANCE_TEST_INSTRUCTION}</p>
              <p className="mt-2 text-xs text-[var(--la-muted)]">{GOVERNANCE_TEST_CASE}</p>
            </blockquote>
            <p className="text-xs text-[var(--la-muted)]">
              Der Testfall enthält keine Quelle. Bestanden ist nur, wer <Mono>"source": null</Mono> liefert.
            </p>
          </div>
          <Btn onClick={runTest} disabled={!canRunTest(flow)}>
            {flow.testing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
            Governance-Test ausführen
          </Btn>
          {flow.testing && <p className="text-xs text-[var(--la-muted)]">Beim ersten Aufruf lädt Ollama das Modell — das kann dauern.</p>}

          {flow.test && !flow.test.ok && (
            <Notice tone="failed">
              <p>
                <span className="font-mono text-xs">{flow.test.error.code}</span> · {flow.test.error.message}
              </p>
              {flow.test.error.hint && <p className="mt-1 text-xs text-[var(--la-muted)]">{flow.test.error.hint}</p>}
            </Notice>
          )}
          {currentTest && (
            <div className="space-y-3">
              <ul className="space-y-1.5" aria-label="Prüfpunkte">
                {currentTest.checks.map((c) => (
                  <li key={c.id} className="flex flex-col gap-1 border border-[var(--la-line)] p-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm">
                      {c.label}
                      <span className="block text-xs text-[var(--la-muted)]">{c.detail}</span>
                    </span>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
              <p className="text-xs text-[var(--la-muted)]">
                Modell {currentTest.model} · Dauer {currentTest.durationMs} ms · {formatTime(currentTest.ranAt)}
              </p>
              <details className="border border-[var(--la-line)]" open>
                <summary className="cursor-pointer px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-[var(--la-muted)]">
                  Testausgabe (roh)
                </summary>
                <pre data-testid="la-raw-output" className="max-h-72 overflow-auto whitespace-pre-wrap break-words bg-[var(--la-inset)] p-3 font-mono text-xs">
                  {currentTest.rawOutput}
                </pre>
              </details>
            </div>
          )}
        </StepCard>

        {/* 5 · Profil */}
        <StepCard
          index="05"
          title="Lokales Profil speichern"
          status={statuses.profile}
          statusLabel={statuses.profile === 'success' ? 'Aktiv auf diesem Gerät' : undefined}
          locked={canActivate(flow) || flow.savedProfile ? null : 'Erst nach bestandenem Governance-Test verfügbar.'}
        >
          <label className="block space-y-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--la-muted)]">Profilname</span>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="w-full border border-[var(--la-line)] bg-[var(--la-inset)] px-3 py-2.5 text-sm text-[var(--la-text)] outline-none focus:border-[var(--la-accent)]"
            />
          </label>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Metric label="runtime_url" value={<span className="break-all font-mono text-xs">{probe?.ok ? probe.data.runtimeUrl : flow.savedProfile?.runtime_url ?? '—'}</span>} />
            <Metric label="model · role" value={<span className="font-mono text-xs">{flow.model || '—'} · {flow.role ?? '—'}</span>} />
            <Metric label="last_healthcheck" value={formatTime(probe?.ok ? probe.data.checkedAt : flow.savedProfile?.last_healthcheck)} />
            <Metric label="test_result" value={currentTest?.overall ?? flow.savedProfile?.test_result?.overall ?? '—'} />
          </dl>
          <Notice tone="info">
            Gespeichert wird nur ein lokales Runtime-Profil auf diesem Gerät. Es wird keine produktive Automatisierung gestartet.
          </Notice>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={activate} disabled={!canActivate(flow) || !verifiedTenantId}>
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Lokale KI aktivieren
            </Btn>
            {flow.savedProfile && (
              <Btn variant="ghost" onClick={register} disabled={registering}>
                {registering && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Beim Mandanten melden (optional)
              </Btn>
            )}
          </div>
          {saveError && <Notice tone="failed">{saveError}</Notice>}
          {flow.savedProfile && (
            <p className="text-xs text-[var(--la-muted)]">
              Gespeichert: „{flow.savedProfile.profile_name}" · {flow.savedProfile.enabled ? 'aktiviert' : 'nicht aktiviert'} · letzter
              Healthcheck {formatTime(flow.savedProfile.last_healthcheck)}
            </p>
          )}
          {registration && (
            <Notice tone={registration.ok ? 'success' : 'warning'}>
              {registration.ok ? (
                `Beim Mandanten gemeldet: ${formatTime(registration.registeredAt)}`
              ) : (
                <>
                  <span className="font-mono text-xs">{registration.code}</span> · {registration.message}
                </>
              )}
            </Notice>
          )}
        </StepCard>

        {/* 6 · Loop */}
        <StepCard
          index="06"
          title="Dauer-Loop (lokaler Healthcheck)"
          status={statuses.loop}
          statusLabel={flow.loopRunning ? undefined : 'Aus'}
          locked={canStartLoop(flow) ? null : 'Erst mit aktiviertem lokalem Profil verfügbar.'}
        >
          <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3">
            <span className="text-sm">Lokalen Healthcheck aktivieren</span>
            <input
              type="checkbox"
              role="switch"
              checked={loopArmed}
              onChange={(e) => {
                setLoopArmed(e.target.checked);
                if (!e.target.checked) patch({ loopRunning: false });
              }}
              className="h-5 w-9 accent-[var(--la-accent)]"
            />
          </label>
          <p className="text-xs text-[var(--la-muted)]">
            Prüft jede Minute Runtime und Modell — nur solange diese Seite geöffnet ist. Kein autonomer Agent, keine Aufgaben.
          </p>
          <Btn onClick={() => patch({ loopRunning: !flow.loopRunning })} disabled={!loopArmed}>
            {flow.loopRunning ? <Square className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
            {flow.loopRunning ? 'Loop stoppen' : 'Loop starten'}
          </Btn>
          {flow.loopRunning && (
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Letzter Check" value={formatTime(loop.snapshot?.checkedAt)} />
              <Metric
                label="Modell erreichbar"
                value={loop.snapshot ? (loop.snapshot.modelReachable ? 'Ja' : `Nein · ${loop.snapshot.errorCode ?? ''}`) : '—'}
              />
              <Metric label="Antwortzeit" value={loop.snapshot?.latencyMs != null ? `${loop.snapshot.latencyMs} ms` : '—'} />
              <Metric
                label="Governance-Test"
                value={flow.savedProfile?.test_result?.overall === 'success' ? `Bestanden · ${formatTime(flow.savedProfile.test_result.ranAt)}` : 'Nicht bestanden'}
              />
            </dl>
          )}
          {flow.loopRunning && (
            <p className="flex items-center gap-1.5 text-xs text-[var(--la-muted)]">
              <Activity className="h-3.5 w-3.5" aria-hidden /> Antwortzeit = Round-Trip von <Mono>/api/tags</Mono>, gemessen in diesem Browser.
            </p>
          )}
        </StepCard>

        <p className="pb-6 text-xs text-[var(--la-muted)]">
          CORS-Freigabe für diese Seite: <Mono>OLLAMA_ORIGINS="{origin}" ollama serve</Mono>
        </p>
      </div>
    </div>
  );
}
