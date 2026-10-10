import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { brandButtonClass } from '../../../components/brand';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDot,
  FileCheck2,
  Globe2,
  LockKeyhole,
  MousePointer2,
  ScrollText,
  ShieldCheck,
  Type,
} from 'lucide-react';
import { useBrowserSession } from '../../../lib/useBrowserSession';
import { useTenant } from '../../../core/access/TenantProvider';
import {
  BrowserExecutorError,
  executeBrowserActions,
  getBrowserExecutorHealth,
  planBrowserTask,
  type BrowserExecutorAction,
  type BrowserPlanStep,
} from '../browser/browserExecutorClient';
import { consumedApprovalMessage } from '../browser/consumedApproval';

type AgentMode = 'assist' | 'copilot' | 'autonomous';
type RunOutcome = 'ok' | 'approval' | 'error';
type StepStatus = 'pending' | 'running' | 'done' | 'approval' | 'error';

const MUTATING: ReadonlySet<BrowserExecutorAction['type']> = new Set(['click', 'type', 'select']);

/** Kurzbeschreibung eines Plan-Schritts für die Liste. */
export function describeAction(action: BrowserExecutorAction): string {
  switch (action.type) {
    case 'navigate': return `Öffnen: ${action.url}`;
    case 'scroll': return `Scrollen ${action.direction === 'up' ? 'nach oben' : 'nach unten'}${action.amount ? ` (${action.amount}px)` : ''}`;
    case 'click': return `Klicken: ${action.selector}`;
    case 'type': return `Eingeben in ${action.selector}: „${action.text}“`;
    case 'select': return `Auswählen in ${action.selector}: ${action.value}`;
    case 'extract': return action.selector ? `Text lesen: ${action.selector}` : 'Seitentext lesen';
    case 'wait': return `Warten ${action.milliseconds} ms`;
    case 'screenshot': return 'Screenshot';
  }
}

function planErrorMessage(error: unknown): string {
  if (error instanceof BrowserExecutorError) {
    if (error.status === 403) return 'Freitext-Planung ist ab dem Starter-Tarif enthalten.';
    if (error.code === 'QUOTA_EXCEEDED') return 'Das KI-Kontingent dieses Monats ist aufgebraucht.';
    if (error.code === 'PLAN_INVALID') return 'Der Planer hat keinen gültigen Plan geliefert. Bitte die Aufgabe konkreter formulieren.';
    if (error.status === 401) return 'Bitte erneut anmelden.';
  }
  return 'Planung fehlgeschlagen. Bitte später erneut versuchen.';
}
type RuntimeActionType = Exclude<BrowserExecutorAction['type'], 'wait'>;

function normalizeUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Eingabe ist eine URL (kein Leerzeichen, Protokoll oder Punkt) — sonst Aufgabe. */
export function urlFromInput(value: string): string | null {
  const raw = value.trim();
  if (!raw || /\s/.test(raw)) return null;
  if (!/^https?:\/\//i.test(raw) && !raw.includes('.')) return null;
  return normalizeUrl(raw);
}

export type RuntimeBadgeState = 'active' | 'preview' | 'inactive';

/**
 * Statusanzeigen der Runtime — nur aus geprüften Zuständen:
 *   navigation  active  = serverseitiger Executor erreichbar (Health-Probe)
 *               preview = nur clientseitige Browser-Preview (öffnet den Audit-Pfad)
 *   evidence    active  = Executor erreichbar; nur seine Aktionen erzeugen
 *               Evidence (browser-execute → governance_evidence). Die Preview
 *               schreibt keine.
 * Ohne mitgliedschaftsgebundenen Mandanten ist beides inaktiv.
 */
export function runtimeStatus(input: { tenantBound: boolean; executorConnected: boolean }): {
  navigation: RuntimeBadgeState;
  evidence: RuntimeBadgeState;
} {
  if (!input.tenantBound) return { navigation: 'inactive', evidence: 'inactive' };
  return {
    navigation: input.executorConnected ? 'active' : 'preview',
    evidence: input.executorConnected ? 'active' : 'inactive',
  };
}

function openGovernedBrowser(url: string) {
  window.dispatchEvent(new CustomEvent('realsync:browser-open', { detail: { url } }));
}

function approvalIdFrom(error: BrowserExecutorError): string | null {
  if (!error.details || typeof error.details !== 'object') return null;
  const value = (error.details as { approval_id?: unknown }).approval_id;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function resultSummary(result: unknown): string {
  if (!result || typeof result !== 'object') return 'Aktion erfolgreich ausgeführt.';
  const results = (result as { results?: unknown }).results;
  if (!Array.isArray(results) || results.length === 0) return 'Aktion erfolgreich ausgeführt.';
  const last = results[results.length - 1] as {
    ok?: boolean;
    url?: string;
    title?: string;
    text?: string;
    screenshot_base64?: string;
  };
  if (last?.text) return last.text.slice(0, 1200);
  if (last?.screenshot_base64) return `Screenshot erstellt (${Math.round(last.screenshot_base64.length / 1024)} KiB Base64).`;
  return [last?.ok === false ? 'Fehlgeschlagen' : 'Erfolgreich', last?.title, last?.url]
    .filter(Boolean)
    .join(' · ');
}

export function BrowserRuntimePanel({ activeTenantId }: { activeTenantId: string | null }) {
  const sessionId = useBrowserSession();
  const { tenants } = useTenant();
  // Aktiver Mandant stammt aus der RLS-gescopten memberships-Liste (TenantProvider).
  const tenantBound = activeTenantId !== null && (tenants ?? []).some((t) => t.tenantId === activeTenantId);
  const [mode, setMode] = useState<AgentMode>('assist');
  const [task, setTask] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [executorConnected, setExecutorConnected] = useState(false);
  const [executorChecking, setExecutorChecking] = useState(false);
  const [actionType, setActionType] = useState<RuntimeActionType>('scroll');
  const [selector, setSelector] = useState('');
  const [actionValue, setActionValue] = useState('');
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>('down');
  const [executing, setExecuting] = useState(false);
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<BrowserExecutorAction | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<{ summary: string; steps: BrowserPlanStep[] } | null>(null);
  const [stepStatus, setStepStatus] = useState<StepStatus[]>([]);
  const [runningPlan, setRunningPlan] = useState(false);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  /** Plan-Schritt, dessen Freigabe gerade aussteht (für den Status nach „Freigegeben ausführen“). */
  const [pendingStepIndex, setPendingStepIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!activeTenantId) {
      setExecutorConnected(false);
      return;
    }

    setExecutorChecking(true);
    getBrowserExecutorHealth({ tenantId: activeTenantId })
      .then(() => {
        if (!cancelled) setExecutorConnected(true);
      })
      .catch(() => {
        if (!cancelled) setExecutorConnected(false);
      })
      .finally(() => {
        if (!cancelled) setExecutorChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTenantId]);

  const capabilities = useMemo(
    () => [
      { label: 'Navigate', available: executorConnected, icon: Globe2 },
      { label: 'Scan', available: Boolean(activeTenantId), icon: ShieldCheck },
      { label: 'Evidence', available: tenantBound && executorConnected, icon: FileCheck2 },
      { label: 'Scroll', available: executorConnected, icon: ScrollText },
      { label: 'Click', available: executorConnected, icon: MousePointer2 },
      { label: 'Type', available: executorConnected, icon: Type },
    ],
    [executorConnected, activeTenantId, tenantBound],
  );
  const status = runtimeStatus({ tenantBound, executorConnected });

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const url = urlFromInput(task);
    if (url) {
      openGovernedBrowser(url);
      setMessage(
        executorConnected
          ? 'Browser-Preview geöffnet. Für serverseitige Aktionen nutze den Governed Action Composer darunter.'
          : 'Browser-Preview geöffnet. Der serverseitige Executor ist derzeit nicht erreichbar.',
      );
      return;
    }
    void planTask(task.trim());
  }

  async function planTask(text: string) {
    if (!text) return;
    if (!activeTenantId) {
      setMessage('Freitext-Planung braucht einen aktiven Mandanten.');
      return;
    }
    setPlanning(true);
    setPlan(null);
    setStepStatus([]);
    setPendingStepIndex(null);
    setActionResult(null);
    try {
      const response = await planBrowserTask({ tenantId: activeTenantId, task: text, currentUrl: lastUrl });
      if (response.kind === 'refused') {
        setMessage(`Nicht geplant: ${response.reason}`);
        return;
      }
      setPlan({ summary: response.summary, steps: response.steps });
      setStepStatus(response.steps.map(() => 'pending'));
      setMessage(
        executorConnected
          ? 'Plan erstellt. Prüfe die Schritte und führe sie einzeln oder im Co-Pilot-Modus nacheinander aus.'
          : 'Plan erstellt. Zum Ausführen muss der serverseitige Browser Executor erreichbar sein.',
      );
    } catch (error) {
      setMessage(planErrorMessage(error));
    } finally {
      setPlanning(false);
    }
  }

  function setStep(index: number, status: StepStatus) {
    setStepStatus((prev) => prev.map((s, i) => (i === index ? status : s)));
  }

  async function runStep(index: number, approvalId?: string): Promise<RunOutcome> {
    if (!plan) return 'error';
    setStep(index, 'running');
    const outcome = await runAction(plan.steps[index].action, approvalId);
    setStep(index, outcome === 'ok' ? 'done' : outcome);
    setPendingStepIndex(outcome === 'approval' ? index : null);
    return outcome;
  }

  /** Co-Pilot: offene Schritte der Reihe nach; Stopp bei Freigabe oder Fehler. */
  async function runPlan() {
    if (!plan) return;
    setRunningPlan(true);
    try {
      for (let i = 0; i < plan.steps.length; i++) {
        if (stepStatus[i] === 'done') continue;
        const outcome = await runStep(i);
        if (outcome !== 'ok') break;
      }
    } finally {
      setRunningPlan(false);
    }
  }

  function buildAction(): BrowserExecutorAction | null {
    switch (actionType) {
      case 'navigate': {
        const url = normalizeUrl(actionValue);
        return url ? { type: 'navigate', url } : null;
      }
      case 'scroll':
        return {
          type: 'scroll',
          direction: scrollDirection,
          amount: Number(actionValue) > 0 ? Math.min(Number(actionValue), 5000) : 700,
        };
      case 'click':
        return selector.trim() ? { type: 'click', selector: selector.trim() } : null;
      case 'type':
        return selector.trim() && actionValue.length > 0
          ? { type: 'type', selector: selector.trim(), text: actionValue }
          : null;
      case 'select':
        return selector.trim() && actionValue.length > 0
          ? { type: 'select', selector: selector.trim(), value: actionValue }
          : null;
      case 'extract':
        return { type: 'extract', ...(selector.trim() ? { selector: selector.trim() } : {}) };
      case 'screenshot':
        return { type: 'screenshot' };
    }
  }

  async function runAction(action: BrowserExecutorAction, approvalId?: string): Promise<RunOutcome> {
    if (!activeTenantId || !sessionId || !executorConnected) return 'error';
    setExecuting(true);
    setActionResult(null);
    try {
      const response = await executeBrowserActions({
        tenantId: activeTenantId,
        sessionId,
        actions: [action],
        approvalId,
      });
      setPendingApprovalId(null);
      setPendingAction(null);
      if (action.type === 'navigate') setLastUrl(action.url);
      setActionResult(resultSummary(response.result));
      return 'ok';
    } catch (error) {
      if (error instanceof BrowserExecutorError && error.code === 'APPROVAL_REQUIRED') {
        const approvalIdFromError = approvalIdFrom(error);
        if (approvalIdFromError) {
          setPendingApprovalId(approvalIdFromError);
          setPendingAction(action);
          setActionResult('Diese Aktion wurde nicht ausgeführt. Sie wartet auf eine menschliche Freigabe.');
          return 'approval';
        }
      }
      if (error instanceof BrowserExecutorError) {
        const consumed = consumedApprovalMessage(error);
        if (consumed) {
          setPendingApprovalId(null);
          setPendingAction(null);
          setActionResult(consumed);
          return 'error';
        }
      }
      setActionResult(
        error instanceof Error ? error.message : 'Browser-Aktion fehlgeschlagen.',
      );
      return 'error';
    } finally {
      setExecuting(false);
    }
  }

  async function submitAction(event: FormEvent) {
    event.preventDefault();
    const action = buildAction();
    if (!action) {
      setActionResult('Für diese Aktion fehlen gültige Eingaben.');
      return;
    }
    await runAction(action);
  }

  return (
    <section
      className="mx-4 mt-5 border border-titanium-800 bg-obsidian-950 lg:mx-6"
      aria-labelledby="browser-runtime-heading"
      data-testid="browser-runtime-panel"
    >
      <div className="flex flex-col gap-4 border-b border-titanium-800 px-5 py-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--brand-champ)]">
            <CircleDot className="h-3 w-3" aria-hidden="true" />
            RealSync Browser Runtime
          </div>
          <h2 id="browser-runtime-heading" className="text-2xl font-semibold tracking-tight text-titanium-50">
            Governed computer use for AI agents
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-titanium-400">
            Request → Identity → Tenant → Policy → Risk → Approval → Browser Action → Verification → Evidence
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-mono">
          {/* Nur geprüfte Zustände — siehe runtimeStatus(). */}
          <span
            data-testid="runtime-badge-navigation"
            className={
              status.navigation === 'active'
                ? 'border border-emerald-900 bg-emerald-950/30 px-2.5 py-1 text-emerald-300'
                : 'border border-titanium-800 px-2.5 py-1 text-titanium-500'
            }
          >
            {status.navigation === 'active'
              ? 'NAVIGATION ACTIVE'
              : status.navigation === 'preview'
                ? 'NAVIGATION PREVIEW'
                : 'NAVIGATION INACTIVE'}
          </span>
          <span
            data-testid="runtime-badge-evidence"
            className={
              status.evidence === 'active'
                ? 'border border-[var(--brand-line-dark)] bg-[rgba(242,201,138,0.06)] px-2.5 py-1 text-[var(--brand-champ)]'
                : 'border border-titanium-800 px-2.5 py-1 text-titanium-500'
            }
          >
            {status.evidence === 'active' ? 'EVIDENCE ACTIVE' : 'EVIDENCE INACTIVE'}
          </span>
          <span
            className={
              executorConnected
                ? 'border border-emerald-900 bg-emerald-950/30 px-2.5 py-1 text-emerald-300'
                : 'border border-amber-900 bg-amber-950/20 px-2.5 py-1 text-amber-300'
            }
          >
            {executorChecking
              ? 'EXECUTOR CHECKING'
              : executorConnected
                ? 'HEADLESS EXECUTOR READY'
                : 'EXECUTOR OFFLINE'}
          </span>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[1.15fr_.85fr]">
        <div className="border-b border-titanium-800 p-5 xl:border-b-0 xl:border-r">
          <form onSubmit={submit}>
            <label htmlFor="browser-runtime-task" className="text-xs font-semibold uppercase tracking-[0.16em] text-titanium-400">
              Was soll RealSync im Browser tun?
            </label>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                id="browser-runtime-task"
                value={task}
                onChange={(event) => setTask(event.target.value)}
                placeholder="URL oder Aufgabe, z. B. „Prüfe, ob example.com einen Cookie-Banner zeigt“"
                maxLength={1000}
                className="min-w-0 flex-1 border border-titanium-700 bg-obsidian-900 px-3 py-3 text-sm text-titanium-100 outline-none placeholder:text-titanium-600 focus:border-[var(--brand-champ)]"
              />
              <button
                type="submit"
                disabled={planning || !task.trim()}
                className={brandButtonClass({ size: 'md' })}
              >
                {planning ? 'Plane…' : !task.trim() || urlFromInput(task) ? 'Browser öffnen' : 'Planen'}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </form>

          {message && (
            <div className="mt-3 border border-titanium-800 bg-obsidian-900 px-3 py-2 text-xs leading-5 text-titanium-300" role="status">
              {message}
            </div>
          )}

          {plan && (
            <div className="mt-3 border border-[var(--brand-line-dark)] bg-obsidian-900 p-4" data-testid="browser-task-plan">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-champ)]">Aktionsplan</div>
                  {plan.summary && <p className="mt-1 text-sm text-titanium-200">{plan.summary}</p>}
                </div>
                {mode === 'copilot' && (
                  <button
                    type="button"
                    onClick={() => void runPlan()}
                    disabled={!executorConnected || executing || runningPlan || stepStatus.every((st) => st === 'done')}
                    className={brandButtonClass({ size: 'sm' })}
                  >
                    {runningPlan ? 'Läuft…' : 'Plan ausführen'}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
              <ol className="mt-3 space-y-2">
                {plan.steps.map((step, index) => {
                  const status = stepStatus[index] ?? 'pending';
                  return (
                    <li key={index} className="flex items-start gap-3 border border-titanium-800 px-3 py-2" data-testid="browser-plan-step">
                      <span className="mt-0.5 font-mono text-[10px] text-titanium-500">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="break-words text-xs text-titanium-100">{describeAction(step.action)}</div>
                        {step.reason && <div className="mt-0.5 text-[11px] text-titanium-500">{step.reason}</div>}
                        {MUTATING.has(step.action.type) && (
                          <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-mono uppercase text-amber-300">
                            <LockKeyhole className="h-3 w-3" aria-hidden="true" /> Freigabe nötig
                          </div>
                        )}
                      </div>
                      <span
                        className={`shrink-0 font-mono text-[10px] uppercase ${
                          status === 'done' ? 'text-emerald-300'
                            : status === 'error' ? 'text-red-300'
                              : status === 'approval' ? 'text-amber-300'
                                : status === 'running' ? 'text-[var(--brand-champ)]' : 'text-titanium-500'
                        }`}
                      >
                        {status === 'done' ? 'erledigt' : status === 'error' ? 'Fehler' : status === 'approval' ? 'wartet' : status === 'running' ? 'läuft' : 'offen'}
                      </span>
                      <button
                        type="button"
                        onClick={() => void runStep(index)}
                        disabled={!executorConnected || executing || runningPlan || status === 'done'}
                        className="shrink-0 border border-[var(--brand-line-dark-strong)] px-2 py-1 text-[11px] text-[var(--brand-champ-hi)] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Ausführen
                      </button>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-2 text-[10px] text-titanium-600">
                Jeder Schritt läuft einzeln durch Policy, Risiko-Bewertung und Evidenz. Klick, Eingabe und Auswahl warten auf eine menschliche Freigabe.
              </p>
            </div>
          )}

          <div className="mt-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-titanium-400">Agent Mode</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {([
                ['assist', 'Assist', true, 'Mensch führt, Governance protokolliert'],
                ['copilot', 'Co-Pilot', executorConnected, 'Governed Browser Actions aktiv'],
                ['autonomous', 'Autonomous', false, 'Autonome Ausführung ohne Freigabe ist gesperrt'],
              ] as const).map(([id, label, enabled, description]) => (
                <button
                  key={id}
                  type="button"
                  disabled={!enabled}
                  onClick={() => setMode(id)}
                  className={`border px-3 py-3 text-left text-sm transition ${
                    mode === id
                      ? 'border-[var(--brand-champ)] bg-[rgba(242,201,138,0.08)] text-[var(--brand-champ-hi)]'
                      : 'border-titanium-800 bg-obsidian-900 text-titanium-400'
                  } disabled:cursor-not-allowed disabled:opacity-45`}
                  title={description}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{label}</span>
                    {!enabled && <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />}
                  </div>
                  <div className="mt-1 text-[10px] text-titanium-600">{description}</div>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={submitAction} className="mt-5 border border-titanium-800 bg-obsidian-900 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-titanium-300">
                  Governed Action Composer
                </div>
                <div className="mt-1 text-[11px] leading-5 text-titanium-500">
                  Read-only Aktionen laufen direkt. Click, Type und Select benötigen Human Approval.
                </div>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--brand-champ)]">
                {mode === 'copilot' ? 'co-pilot' : 'assist'}
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-xs text-titanium-400">
                Aktion
                <select
                  value={actionType}
                  onChange={(event) => {
                    setActionType(event.target.value as RuntimeActionType);
                    setPendingApprovalId(null);
                    setPendingAction(null);
                  }}
                  disabled={!executorConnected}
                  className="mt-1 w-full border border-titanium-700 bg-obsidian-950 px-3 py-2.5 text-sm text-titanium-100"
                >
                  <option value="navigate">Navigate</option>
                  <option value="scroll">Scroll</option>
                  <option value="extract">Extract</option>
                  <option value="screenshot">Screenshot</option>
                  <option value="click">Click · approval</option>
                  <option value="type">Type · approval</option>
                  <option value="select">Select · approval</option>
                </select>
              </label>

              {actionType === 'scroll' ? (
                <label className="text-xs text-titanium-400">
                  Richtung
                  <select
                    value={scrollDirection}
                    onChange={(event) => setScrollDirection(event.target.value as 'up' | 'down')}
                    disabled={!executorConnected}
                    className="mt-1 w-full border border-titanium-700 bg-obsidian-950 px-3 py-2.5 text-sm text-titanium-100"
                  >
                    <option value="down">Down</option>
                    <option value="up">Up</option>
                  </select>
                </label>
              ) : (
                <label className="text-xs text-titanium-400">
                  Selector
                  <input
                    value={selector}
                    onChange={(event) => setSelector(event.target.value)}
                    disabled={!executorConnected || actionType === 'navigate' || actionType === 'screenshot'}
                    placeholder={actionType === 'extract' ? 'optional, z. B. main' : '#submit-button'}
                    className="mt-1 w-full border border-titanium-700 bg-obsidian-950 px-3 py-2.5 text-sm text-titanium-100 placeholder:text-titanium-700"
                  />
                </label>
              )}

              {['navigate', 'scroll', 'type', 'select'].includes(actionType) && (
                <label className="text-xs text-titanium-400 md:col-span-2">
                  {actionType === 'navigate'
                    ? 'URL'
                    : actionType === 'scroll'
                      ? 'Pixel (optional)'
                      : actionType === 'type'
                        ? 'Text'
                        : 'Option value'}
                  <input
                    value={actionValue}
                    onChange={(event) => setActionValue(event.target.value)}
                    disabled={!executorConnected}
                    type={actionType === 'scroll' ? 'number' : 'text'}
                    autoComplete="off"
                    className="mt-1 w-full border border-titanium-700 bg-obsidian-950 px-3 py-2.5 text-sm text-titanium-100"
                  />
                </label>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={!executorConnected || executing}
                className={brandButtonClass({ size: 'sm' })}
              >
                {executing ? 'Ausführung…' : 'Governed Action ausführen'}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>

              {pendingApprovalId && pendingAction && (
                <>
                  <Link
                    to="/app/approvals"
                    className="border border-amber-700 px-3 py-2.5 text-xs font-medium text-amber-200"
                  >
                    Approval öffnen
                  </Link>
                  <button
                    type="button"
                    disabled={executing}
                    onClick={() => void (pendingStepIndex !== null
                      ? runStep(pendingStepIndex, pendingApprovalId)
                      : runAction(pendingAction, pendingApprovalId))}
                    className="border border-[var(--brand-line-dark-strong)] px-3 py-2.5 text-xs font-medium text-[var(--brand-champ-hi)] disabled:opacity-45"
                  >
                    Nach Freigabe erneut ausführen
                  </button>
                </>
              )}
            </div>

            {actionResult && (
              <div className="mt-3 max-h-36 overflow-auto whitespace-pre-wrap border border-titanium-800 bg-obsidian-950 px-3 py-2 text-[11px] leading-5 text-titanium-300" role="status">
                {actionResult}
              </div>
            )}
          </form>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {capabilities.map(({ label, available, icon: Icon }) => (
              <div key={label} className="border border-titanium-800 bg-obsidian-900 px-3 py-3">
                <Icon className={`h-4 w-4 ${available ? 'text-[var(--brand-champ)]' : 'text-titanium-600'}`} aria-hidden="true" />
                <div className="mt-2 text-xs font-medium text-titanium-200">{label}</div>
                <div className={`mt-1 font-mono text-[9px] uppercase tracking-wider ${available ? 'text-emerald-400' : 'text-titanium-600'}`}>
                  {available ? 'available' : 'executor needed'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-titanium-400">
            <Bot className="h-4 w-4 text-[var(--brand-champ)]" aria-hidden="true" />
            Governance Control
          </div>

          <dl className="mt-4 divide-y divide-titanium-800 border border-titanium-800 bg-obsidian-900 text-xs">
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <dt className="text-titanium-500">Tenant authority</dt>
              <dd className={tenantBound ? 'text-emerald-300' : 'text-amber-300'}>
                {tenantBound ? 'membership-bound' : 'not resolved'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <dt className="text-titanium-500">Browser session</dt>
              <dd className="max-w-[180px] truncate font-mono text-titanium-300" title={sessionId || undefined}>
                {sessionId || 'initializing'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <dt className="text-titanium-500">Executor</dt>
              <dd className={executorConnected ? 'text-emerald-300' : 'text-amber-300'}>
                {executorChecking ? 'checking' : executorConnected ? 'headless ready' : 'offline'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <dt className="text-titanium-500">Policy authority</dt>
              <dd className="text-[var(--brand-champ)]">server-side</dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <dt className="text-titanium-500">Mutation approval</dt>
              <dd className="text-emerald-300">required</dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <dt className="text-titanium-500">Browser action log</dt>
              <dd className="text-emerald-300">evidence-backed</dd>
            </div>
          </dl>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <Link
              to="/app/approvals"
              className="inline-flex items-center justify-between border border-titanium-800 bg-obsidian-900 px-3 py-3 text-xs font-medium text-titanium-200 hover:border-[var(--brand-line-dark-strong)]"
            >
              Approvals
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/app/evidence"
              className="inline-flex items-center justify-between border border-titanium-800 bg-obsidian-900 px-3 py-3 text-xs font-medium text-titanium-200 hover:border-[var(--brand-line-dark-strong)]"
            >
              Evidence
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 flex items-start gap-2 border border-titanium-800 bg-obsidian-900 px-3 py-3 text-[11px] leading-5 text-titanium-500">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand-champ)]" aria-hidden="true" />
            Der Executor ist eine isolierte Headless-Runtime. Die eingebettete Browser-Preview ist noch kein Live-Video derselben Chromium-Session. Autonomous bleibt gesperrt, bis Planner und sichere Session-Visualisierung integriert sind.
          </div>
        </aside>
      </div>
    </section>
  );
}
