import { useState, type FormEvent } from 'react';
import { brandButtonClass } from '../../../components/brand';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  CircleDot,
  FileCheck2,
  Globe2,
  LockKeyhole,
  MousePointer2,
  Power,
  ScrollText,
  ShieldCheck,
  Type,
} from 'lucide-react';
import { useAuth } from '../../../lib/useAuth';
import {
  BrowserExecutorError,
  planBrowserTask,
  type AgentMode,
  type BrowserActionType,
  type BrowserExecutorAction,
  type BrowserPlanStep,
} from '../browser/browserExecutorClient';
import { useBrowserRuntime } from '../browser/useBrowserRuntime';
import {
  CAPABILITY_REASON_TEXT,
  EXECUTOR_REASON_TEXT,
  EXECUTOR_STATUS_LABEL,
  SESSION_STATUS_LABEL,
  describeAction,
  reasonText,
  runtimeErrorText,
} from '../browser/runtimeText';
import { PipelineSteps } from '../browser/PipelineSteps';
import { BrowserPreview } from '../browser/BrowserPreview';
import { ApprovalCard } from '../browser/ApprovalCard';
import { RuntimeScan } from '../browser/RuntimeScan';
import { approveApproval, rejectApproval } from '../approvalsApi';

export { describeAction };

type StepStatus = 'pending' | 'running' | 'done' | 'approval' | 'error';

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

export type RuntimeBadgeState = 'active' | 'inactive';

/**
 * Statusanzeigen der Runtime — nur aus geprüften Server-Zuständen
 * (op=capabilities): Navigation aktiv = Mandant per Mitgliedschaft bestätigt
 * UND Executor bereit; Evidence aktiv = zusätzlich Evidence-Speicher erreichbar.
 */
export function runtimeStatus(input: { tenantBound: boolean; executorReady: boolean; evidenceAvailable: boolean }): {
  navigation: RuntimeBadgeState;
  evidence: RuntimeBadgeState;
} {
  const navigation = input.tenantBound && input.executorReady ? 'active' : 'inactive';
  return {
    navigation,
    evidence: navigation === 'active' && input.evidenceAvailable ? 'active' : 'inactive',
  };
}

const COMPOSER_ACTIONS: Array<{ type: BrowserActionType; label: string }> = [
  { type: 'navigate', label: 'Navigate' },
  { type: 'scroll', label: 'Scroll' },
  { type: 'read_text', label: 'Text lesen' },
  { type: 'read_dom', label: 'Struktur lesen' },
  { type: 'screenshot', label: 'Screenshot' },
  { type: 'wait', label: 'Warten' },
  { type: 'back', label: 'Zurück' },
  { type: 'forward', label: 'Vorwärts' },
  { type: 'reload', label: 'Neu laden' },
  { type: 'click', label: 'Click · Freigabe' },
  { type: 'type', label: 'Type · Freigabe' },
  { type: 'select', label: 'Select · Freigabe' },
  { type: 'submit', label: 'Submit · Freigabe' },
  { type: 'download', label: 'Download · Freigabe' },
  { type: 'upload', label: 'Upload · Freigabe' },
];

const TILES: Array<{ type: BrowserActionType; label: string; icon: typeof Globe2 }> = [
  { type: 'navigate', label: 'Navigate', icon: Globe2 },
  { type: 'read_text', label: 'Read', icon: FileCheck2 },
  { type: 'scroll', label: 'Scroll', icon: ScrollText },
  { type: 'click', label: 'Click', icon: MousePointer2 },
  { type: 'type', label: 'Type', icon: Type },
  { type: 'download', label: 'Download', icon: ShieldCheck },
];

export function BrowserRuntimePanel({ activeTenantId }: { activeTenantId: string | null }) {
  const auth = useAuth();
  const rt = useBrowserRuntime(activeTenantId, auth.user?.id ?? null);
  const caps = rt.capabilities;
  const [mode, setMode] = useState<AgentMode>('assist');
  const [task, setTask] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [actionType, setActionType] = useState<BrowserActionType>('scroll');
  const [selector, setSelector] = useState('');
  const [actionValue, setActionValue] = useState('');
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>('down');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<{ summary: string; steps: BrowserPlanStep[] } | null>(null);
  const [stepStatus, setStepStatus] = useState<StepStatus[]>([]);
  const [runningPlan, setRunningPlan] = useState(false);
  const [deciding, setDeciding] = useState(false);

  const tenantBound = Boolean(caps?.tenant.verified && caps.tenant.id === activeTenantId);
  const executor = caps?.executor ?? null;
  const executorReady = executor?.status === 'ready' || executor?.status === 'busy';
  const status = runtimeStatus({ tenantBound, executorReady, evidenceAvailable: Boolean(caps?.evidence.available) });
  const canDecide = caps?.tenant.role === 'owner' || caps?.tenant.role === 'admin';
  const session = rt.sessionOpen ? rt.session : null;
  const modeOf = session?.mode ?? mode;
  const inputUrl = urlFromInput(task);
  const openBlockedReason = !activeTenantId
    ? 'Kein Mandant ausgewählt.'
    : !caps
      ? (rt.capabilitiesError ? 'Status nicht verfügbar.' : 'Status wird geprüft…')
      : !executorReady
        ? 'Executor nicht bereit.'
        : (mode === 'copilot' ? !caps.can_copilot : !caps.can_assist)
          ? `Modus nicht verfügbar: ${(mode === 'copilot' ? caps.reasons.copilot : caps.reasons.assist).map((r) => CAPABILITY_REASON_TEXT[r] ?? r).join(', ')}.`
          : null;
  const submitBlockedReason = !task.trim()
    ? null
    : inputUrl
      ? (session ? availability('navigate').reason : openBlockedReason)
      : (!activeTenantId ? 'Kein Mandant ausgewählt.' : null);

  const executorLine = !activeTenantId
    ? 'Kein Mandant ausgewählt.'
    : rt.capabilitiesError
      ? runtimeErrorText(rt.capabilitiesError)
      : !executor
        ? 'Executor-Status wird geprüft…'
        : executor.status === 'ready'
          ? null
          : `${executor.status === 'offline' ? 'Executor offline — Browser-Aktionen sind vorübergehend nicht verfügbar.' : `Executor ${EXECUTOR_STATUS_LABEL[executor.status]}.`}${executor.reason_code && EXECUTOR_REASON_TEXT[executor.reason_code] ? ` ${EXECUTOR_REASON_TEXT[executor.reason_code]}` : ''}`;

  function availability(type: BrowserActionType): { available: boolean; reason: string | null } {
    if (!caps) return { available: false, reason: rt.capabilitiesError ? 'Status nicht verfügbar' : 'wird geprüft' };
    const a = caps.actions[type];
    if (!a) return { available: false, reason: 'unbekannt' };
    if (!a.available) return { available: false, reason: reasonText(a.reason) };
    if (!session) return { available: false, reason: 'keine offene Session' };
    return { available: true, reason: null };
  }

  function setStep(index: number, s: StepStatus) {
    setStepStatus((prev) => prev.map((x, i) => (i === index ? s : x)));
  }

  async function openOrNavigate(url: string) {
    setMessage(null);
    try {
      if (session) {
        await rt.act({ type: 'navigate', url });
        setMessage('Navigation ausgeführt, geprüft und als Evidence gespeichert.');
      } else {
        await rt.openSession(mode, url);
        setMessage('Browser-Session geöffnet. Die Vorschau zeigt Bilder genau dieser Chromium-Session.');
      }
    } catch (error) {
      setMessage(runtimeErrorText(error));
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const url = urlFromInput(task);
    if (url) {
      await openOrNavigate(url);
      return;
    }
    await planTask(task.trim());
  }

  async function planTask(text: string) {
    if (!text || !activeTenantId) return;
    setPlanning(true);
    setPlan(null);
    setStepStatus([]);
    setMessage(null);
    try {
      const response = await planBrowserTask({ tenantId: activeTenantId, task: text, currentUrl: session?.current_url ?? null });
      if (response.kind === 'refused') {
        setMessage(`Nicht geplant: ${response.reason}`);
        return;
      }
      setPlan({ summary: response.summary, steps: response.steps });
      setStepStatus(response.steps.map(() => 'pending'));
      setMessage(session
        ? 'Plan erstellt. Jeder Schritt läuft einzeln durch Policy, Freigabe und Evidence.'
        : 'Plan erstellt. Zum Ausführen zuerst eine Browser-Session öffnen.');
    } catch (error) {
      if (error instanceof BrowserExecutorError && error.status === 403 && error.code !== 'FORBIDDEN') {
        setMessage('Freitext-Planung ist ab dem Starter-Tarif enthalten.');
      } else {
        setMessage(runtimeErrorText(error));
      }
    } finally {
      setPlanning(false);
    }
  }

  async function runStep(index: number, initiatedBy: 'human' | 'planner'): Promise<'ok' | 'approval' | 'error'> {
    if (!plan) return 'error';
    setStep(index, 'running');
    try {
      await rt.act(plan.steps[index].action, { initiatedBy, planStepIndex: index });
      setStep(index, 'done');
      return 'ok';
    } catch (error) {
      const approval = error instanceof BrowserExecutorError && error.code === 'APPROVAL_REQUIRED';
      setStep(index, approval ? 'approval' : 'error');
      setActionMessage(runtimeErrorText(error));
      return approval ? 'approval' : 'error';
    }
  }

  /** Co-Pilot: offene Schritte nacheinander; Stopp bei Freigabe oder Fehler. */
  async function runPlan() {
    if (!plan) return;
    setRunningPlan(true);
    try {
      for (let i = 0; i < plan.steps.length; i++) {
        if (stepStatus[i] === 'done') continue;
        if ((await runStep(i, 'planner')) !== 'ok') break;
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
        return { type: 'scroll', direction: scrollDirection, amount: Number(actionValue) > 0 ? Math.min(Number(actionValue), 5000) : 700 };
      case 'wait':
        return { type: 'wait', milliseconds: Number(actionValue) > 0 ? Math.min(Number(actionValue), 5000) : 1000 };
      case 'click':
      case 'submit':
      case 'download':
        return selector.trim() ? { type: actionType, selector: selector.trim() } : null;
      case 'type':
        return selector.trim() && actionValue.length > 0 ? { type: 'type', selector: selector.trim(), text: actionValue } : null;
      case 'select':
        return selector.trim() && actionValue.length > 0 ? { type: 'select', selector: selector.trim(), value: actionValue } : null;
      case 'read_text':
      case 'read_dom':
      case 'extract':
        return selector.trim() ? { type: actionType, selector: selector.trim() } : { type: actionType };
      case 'screenshot':
      case 'back':
      case 'forward':
      case 'reload':
        return { type: actionType };
      case 'upload':
        return null;
    }
  }

  async function submitAction(event: FormEvent) {
    event.preventDefault();
    const action = buildAction();
    if (!action) {
      setActionMessage(actionType === 'upload' ? reasonText('FILE_SOURCE_NOT_CONFIGURED') : 'Für diese Aktion fehlen gültige Eingaben.');
      return;
    }
    setActionMessage(null);
    try {
      const res = await rt.act(action);
      setActionMessage(res.verification.status === 'failed'
        ? 'Ausgeführt, aber die Verifikation ist fehlgeschlagen.'
        : 'Ausgeführt, verifiziert und als Evidence gespeichert.');
      if (action.type === 'type') setActionValue('');
    } catch (error) {
      setActionMessage(runtimeErrorText(error));
    }
  }

  async function approvePending() {
    if (!rt.pendingApproval) return;
    setDeciding(true);
    try {
      const r = await approveApproval(rt.pendingApproval.id);
      if (!r.ok) setActionMessage(r.error?.message ?? 'Freigeben fehlgeschlagen.');
      else rt.markApproval('approved');
    } finally {
      setDeciding(false);
    }
  }

  async function rejectPending(reason: string) {
    if (!rt.pendingApproval) return;
    setDeciding(true);
    try {
      const r = await rejectApproval(rt.pendingApproval.id, reason);
      if (!r.ok) setActionMessage(r.error?.message ?? 'Ablehnen fehlgeschlagen.');
      else rt.markApproval('rejected');
    } finally {
      setDeciding(false);
    }
  }

  async function executeApproved() {
    const pending = rt.pendingApproval;
    if (!pending) return;
    try {
      const res = await rt.act(pending.action, { approvalId: pending.id });
      if (pending.planStepIndex !== null) setStep(pending.planStepIndex, 'done');
      setActionMessage(res.verification.status === 'failed'
        ? 'Freigegebene Aktion ausgeführt, Verifikation fehlgeschlagen.'
        : 'Freigegebene Aktion genau einmal ausgeführt, verifiziert und als Evidence gespeichert.');
    } catch (error) {
      setActionMessage(runtimeErrorText(error));
    }
  }

  async function killAll() {
    try {
      const out = await rt.killAll();
      if (out) setMessage(`Notabschaltung: ${out.closed_sessions} Session(s) geschlossen, ${out.cancelled_approvals} Freigabe(n) zurückgezogen.`);
    } catch (error) {
      setMessage(runtimeErrorText(error));
    }
  }

  const last = rt.lastResponse;
  const modeButtons: Array<[AgentMode, string, boolean, string[], string]> = [
    ['assist', 'Assist', Boolean(caps?.can_assist), caps?.reasons.assist ?? [], 'Mensch führt, Governance protokolliert'],
    ['copilot', 'Co-Pilot', Boolean(caps?.can_copilot), caps?.reasons.copilot ?? [], 'Plant; lesende Schritte laufen nach Policy, Mutationen nach Freigabe'],
    ['autonomous', 'Autonomous', Boolean(caps?.can_autonomous), caps?.reasons.autonomous ?? [], 'Nur mit Autonomie-Policy, Visualisierung, Limits und Notabschaltung'],
  ];

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
            Request → Identity → Tenant → Entitlement → Policy → Risk → Approval → Execution → Verification → Evidence
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-mono">
          {/* Nur geprüfte Server-Zustände — siehe runtimeStatus(). */}
          <span
            data-testid="runtime-badge-navigation"
            className={status.navigation === 'active'
              ? 'border border-emerald-900 bg-emerald-950/30 px-2.5 py-1 text-emerald-300'
              : 'border border-titanium-800 px-2.5 py-1 text-titanium-500'}
          >
            {status.navigation === 'active' ? 'NAVIGATION ACTIVE' : 'NAVIGATION INACTIVE'}
          </span>
          <span
            data-testid="runtime-badge-evidence"
            className={status.evidence === 'active'
              ? 'border border-[var(--brand-line-dark)] bg-[rgba(242,201,138,0.06)] px-2.5 py-1 text-[var(--brand-champ)]'
              : 'border border-titanium-800 px-2.5 py-1 text-titanium-500'}
          >
            {status.evidence === 'active' ? 'EVIDENCE ACTIVE' : 'EVIDENCE INACTIVE'}
          </span>
          <span
            data-testid="runtime-badge-executor"
            className={executorReady
              ? 'border border-emerald-900 bg-emerald-950/30 px-2.5 py-1 text-emerald-300'
              : 'border border-amber-900 bg-amber-950/20 px-2.5 py-1 text-amber-300'}
          >
            {!executor
              ? 'EXECUTOR CHECKING'
              : executor.status === 'ready'
                ? 'HEADLESS EXECUTOR READY'
                : executor.status === 'offline'
                  ? 'EXECUTOR OFFLINE'
                  : `EXECUTOR ${executor.status.toUpperCase()}`}
          </span>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[1.15fr_.85fr]">
        <div className="border-b border-titanium-800 p-5 xl:border-b-0 xl:border-r">
          <form onSubmit={(e) => void submit(e)}>
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
                disabled={planning || rt.busy || !task.trim() || Boolean(submitBlockedReason)}
                title={submitBlockedReason ?? undefined}
                className={brandButtonClass({ size: 'md' })}
              >
                {planning ? 'Plane…' : !task.trim() || inputUrl ? (session ? 'Öffnen' : 'Browser öffnen') : 'Planen'}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {submitBlockedReason && (
              <p className="mt-2 text-[11px] text-titanium-500" data-testid="open-blocked-reason">{submitBlockedReason}</p>
            )}
          </form>

          {executorLine && (
            <div className="mt-3 border border-amber-900/60 bg-amber-950/10 px-3 py-2 text-xs leading-5 text-amber-200" role="status" data-testid="executor-status-line">
              {executorLine}
            </div>
          )}
          {message && (
            <div className="mt-3 border border-titanium-800 bg-obsidian-900 px-3 py-2 text-xs leading-5 text-titanium-300" role="status">
              {message}
            </div>
          )}

          {session && (
            <BrowserPreview
              session={session}
              frame={rt.frame}
              page={rt.page}
              frameError={rt.frameError}
              executor={executor}
              busy={rt.busy}
              onRefresh={() => void rt.refreshFrame()}
              onNavigate={(type) => { void rt.act({ type }).catch((e) => setActionMessage(runtimeErrorText(e))); }}
              onClose={() => { void rt.closeSession().catch((e) => setMessage(runtimeErrorText(e))); }}
            />
          )}

          {rt.pendingApproval && (
            <ApprovalCard
              approval={rt.pendingApproval}
              canDecide={canDecide}
              busy={deciding || rt.busy}
              onApprove={approvePending}
              onReject={rejectPending}
              onExecute={executeApproved}
              onCancel={async () => { await rt.cancelPendingApproval().catch((e) => setActionMessage(runtimeErrorText(e))); }}
            />
          )}

          {plan && (
            <div className="mt-3 border border-[var(--brand-line-dark)] bg-obsidian-900 p-4" data-testid="browser-task-plan">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-champ)]">Aktionsplan</div>
                  {plan.summary && <p className="mt-1 text-sm text-titanium-200">{plan.summary}</p>}
                </div>
                {modeOf === 'copilot' && (
                  <button
                    type="button"
                    onClick={() => void runPlan()}
                    disabled={!session || rt.busy || runningPlan || stepStatus.every((st) => st === 'done')}
                    className={brandButtonClass({ size: 'sm' })}
                  >
                    {runningPlan ? 'Läuft…' : 'Plan ausführen'}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
              <ol className="mt-3 space-y-2">
                {plan.steps.map((step, index) => {
                  const s = stepStatus[index] ?? 'pending';
                  const avail = availability(step.action.type);
                  return (
                    <li key={index} className="flex items-start gap-3 border border-titanium-800 px-3 py-2" data-testid="browser-plan-step">
                      <span className="mt-0.5 font-mono text-[10px] text-titanium-500">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="break-words text-xs text-titanium-100">{describeAction(step.action)}</div>
                        {step.reason && <div className="mt-0.5 text-[11px] text-titanium-500">{step.reason}</div>}
                        {caps?.actions[step.action.type]?.requires_approval && (
                          <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-mono uppercase text-amber-300">
                            <LockKeyhole className="h-3 w-3" aria-hidden="true" /> Freigabe nötig
                          </div>
                        )}
                      </div>
                      <span className={`shrink-0 font-mono text-[10px] uppercase ${
                        s === 'done' ? 'text-emerald-300' : s === 'error' ? 'text-red-300' : s === 'approval' ? 'text-amber-300' : s === 'running' ? 'text-[var(--brand-champ)]' : 'text-titanium-500'
                      }`}>
                        {s === 'done' ? 'erledigt' : s === 'error' ? 'Fehler' : s === 'approval' ? 'wartet' : s === 'running' ? 'läuft' : 'offen'}
                      </span>
                      <button
                        type="button"
                        onClick={() => void runStep(index, 'human')}
                        disabled={!avail.available || rt.busy || runningPlan || s === 'done'}
                        title={avail.reason ?? undefined}
                        className="shrink-0 border border-[var(--brand-line-dark-strong)] px-2 py-1 text-[11px] text-[var(--brand-champ-hi)] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Ausführen
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          <div className="mt-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-titanium-400">Agent Mode</div>
            <div className="grid gap-2 sm:grid-cols-3" data-testid="agent-modes">
              {modeButtons.map(([id, label, enabled, reasons, description]) => (
                <button
                  key={id}
                  type="button"
                  disabled={!enabled || Boolean(session)}
                  onClick={() => setMode(id)}
                  data-testid={`agent-mode-${id}`}
                  className={`border px-3 py-3 text-left text-sm transition ${
                    modeOf === id ? 'border-[var(--brand-champ)] bg-[rgba(242,201,138,0.08)] text-[var(--brand-champ-hi)]' : 'border-titanium-800 bg-obsidian-900 text-titanium-400'
                  } disabled:cursor-not-allowed ${!enabled ? 'opacity-45' : ''}`}
                  title={description}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{label}</span>
                    {!enabled && <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />}
                  </div>
                  <div className="mt-1 text-[10px] text-titanium-500">
                    {enabled ? description : (reasons.length ? reasons.map((r) => CAPABILITY_REASON_TEXT[r] ?? r).join(' · ') : 'wird geprüft')}
                  </div>
                </button>
              ))}
            </div>
            {session && <p className="mt-1 text-[10px] text-titanium-600">Modus der offenen Session: {session.mode}. Für einen anderen Modus die Session schließen.</p>}
          </div>

          <form onSubmit={(e) => void submitAction(e)} className="mt-5 border border-titanium-800 bg-obsidian-900 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-titanium-300">Governed Action Composer</div>
                <div className="mt-1 text-[11px] leading-5 text-titanium-500">
                  Der Server entscheidet: lesende Aktionen nach Policy, Click/Type/Select/Submit/Download nur nach Freigabe.
                </div>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--brand-champ)]">{modeOf}</span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-xs text-titanium-400">
                Aktion
                <select
                  value={actionType}
                  onChange={(event) => setActionType(event.target.value as BrowserActionType)}
                  className="mt-1 w-full border border-titanium-700 bg-obsidian-950 px-3 py-2.5 text-sm text-titanium-100"
                >
                  {COMPOSER_ACTIONS.map(({ type, label }) => {
                    const a = availability(type);
                    return (
                      <option key={type} value={type} disabled={!a.available && Boolean(caps)}>
                        {label}{a.available ? '' : ` — ${a.reason}`}
                      </option>
                    );
                  })}
                </select>
              </label>

              {actionType === 'scroll' ? (
                <label className="text-xs text-titanium-400">
                  Richtung
                  <select value={scrollDirection} onChange={(event) => setScrollDirection(event.target.value as 'up' | 'down')} className="mt-1 w-full border border-titanium-700 bg-obsidian-950 px-3 py-2.5 text-sm text-titanium-100">
                    <option value="down">Down</option>
                    <option value="up">Up</option>
                  </select>
                </label>
              ) : ['click', 'type', 'select', 'submit', 'download', 'read_text', 'read_dom', 'upload'].includes(actionType) ? (
                <label className="text-xs text-titanium-400">
                  Selector
                  <input
                    value={selector}
                    onChange={(event) => setSelector(event.target.value)}
                    placeholder={actionType === 'read_text' || actionType === 'read_dom' ? 'optional, z. B. main' : '#submit-button'}
                    className="mt-1 w-full border border-titanium-700 bg-obsidian-950 px-3 py-2.5 text-sm text-titanium-100 placeholder:text-titanium-700"
                  />
                </label>
              ) : <div />}

              {['navigate', 'scroll', 'type', 'select', 'wait'].includes(actionType) && (
                <label className="text-xs text-titanium-400 md:col-span-2">
                  {actionType === 'navigate' ? 'URL' : actionType === 'scroll' ? 'Pixel (optional)' : actionType === 'wait' ? 'Millisekunden (max. 5000)' : actionType === 'type' ? 'Text (wird nie gespeichert)' : 'Option value'}
                  <input
                    value={actionValue}
                    onChange={(event) => setActionValue(event.target.value)}
                    type={actionType === 'scroll' || actionType === 'wait' ? 'number' : actionType === 'type' ? 'password' : 'text'}
                    autoComplete="off"
                    className="mt-1 w-full border border-titanium-700 bg-obsidian-950 px-3 py-2.5 text-sm text-titanium-100"
                  />
                </label>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={!availability(actionType).available || rt.busy}
                title={availability(actionType).reason ?? undefined}
                className={brandButtonClass({ size: 'sm' })}
              >
                {rt.busy ? 'Ausführung…' : 'Governed Action ausführen'}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              {!availability(actionType).available && (
                <span className="text-[11px] text-titanium-500" data-testid="composer-disabled-reason">{availability(actionType).reason}</span>
              )}
            </div>

            {rt.pipeline && <PipelineSteps steps={rt.pipeline} />}

            {actionMessage && (
              <div className="mt-3 border border-titanium-800 bg-obsidian-950 px-3 py-2 text-[11px] leading-5 text-titanium-300" role="status">
                {actionMessage}
              </div>
            )}

            {last && (
              <div className="mt-3 space-y-2 text-[11px] text-titanium-300" data-testid="governed-action-result">
                <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-titanium-400">
                  <span>Policy {last.decision.decision} · {last.decision.policy_id}@{last.decision.policy_version}</span>
                  <span>Risiko {last.decision.risk_level}</span>
                  <span>Verifikation {last.verification.status}</span>
                  {last.evidence && <span>Hash {last.evidence.content_hash.slice(0, 16)}…</span>}
                </div>
                {last.result.text && (
                  <pre className="max-h-36 overflow-auto whitespace-pre-wrap border border-titanium-800 bg-obsidian-950 px-3 py-2">{last.result.text.slice(0, 4000)}</pre>
                )}
                {last.result.dom && (
                  <ul className="max-h-36 overflow-auto border border-titanium-800 bg-obsidian-950 px-3 py-2 font-mono">
                    {last.result.dom.nodes.slice(0, 60).map((n, i) => (
                      <li key={i}>{`<${n.tag}${n.id ? `#${n.id}` : ''}${n.name ? ` name=${n.name}` : ''}${n.role ? ` role=${n.role}` : ''}>`} {n.text ?? ''}</li>
                    ))}
                  </ul>
                )}
                {last.result.download && (
                  <div>Download geprüft (nicht gespeichert): {last.result.download.filename} · {last.result.download.bytes} B · SHA-256 {last.result.download.sha256.slice(0, 16)}…</div>
                )}
                {last.result.screenshot && (
                  <img src={`data:image/png;base64,${last.result.screenshot.base64}`} alt="Screenshot der Session" className="max-h-48 border border-titanium-800" />
                )}
                {last.evidence?.event_id && (
                  <Link to={`/app/events/${last.evidence.event_id}`} className="inline-flex items-center gap-1 text-[var(--brand-champ)] underline">
                    Evidence-Datensatz öffnen <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}
          </form>

          <RuntimeScan
            tenantId={activeTenantId}
            targetUrl={session?.current_url && /^https?:/.test(session.current_url) ? session.current_url : urlFromInput(task)}
            disabledReason={!tenantBound ? (rt.capabilitiesError ? 'Mandant nicht bestätigt.' : null) : null}
          />

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" data-testid="runtime-capability-tiles">
            {TILES.map(({ type, label, icon: Icon }) => {
              const a = caps?.actions[type];
              const ok = Boolean(a?.available);
              return (
                <div key={type} className="border border-titanium-800 bg-obsidian-900 px-3 py-3" data-capability={type} data-available={ok}>
                  <Icon className={`h-4 w-4 ${ok ? 'text-[var(--brand-champ)]' : 'text-titanium-600'}`} aria-hidden="true" />
                  <div className="mt-2 text-xs font-medium text-titanium-200">{label}</div>
                  <div className={`mt-1 font-mono text-[9px] uppercase tracking-wider ${ok ? 'text-emerald-400' : 'text-titanium-600'}`}>
                    {!a ? 'prüfe' : ok ? (a.requires_approval ? 'available · approval' : 'available') : reasonText(a.reason)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-titanium-400">
            <Bot className="h-4 w-4 text-[var(--brand-champ)]" aria-hidden="true" />
            Governance Control
          </div>

          <dl className="mt-4 divide-y divide-titanium-800 border border-titanium-800 bg-obsidian-900 text-xs" data-testid="governance-control">
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <dt className="text-titanium-500">Tenant authority</dt>
              <dd className={tenantBound ? 'text-emerald-300' : 'text-amber-300'}>
                {tenantBound ? `membership-bound · ${caps?.tenant.role}` : rt.capabilitiesError ? 'nicht bestätigt' : 'prüfe…'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <dt className="text-titanium-500">Browser session</dt>
              <dd className="max-w-[200px] truncate font-mono text-titanium-300" title={session?.id}>
                {session ? `${session.id.slice(0, 8)} · ${SESSION_STATUS_LABEL[session.status]}` : 'keine offene Session'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <dt className="text-titanium-500">Executor</dt>
              <dd className={executorReady ? 'text-emerald-300' : 'text-amber-300'} data-testid="governance-control-executor">
                {executor ? EXECUTOR_STATUS_LABEL[executor.status] : 'prüfe…'}
                {executor?.version ? ` · v${executor.version}` : ''}
                {executor && executor.active_sessions !== null && executor.max_sessions !== null ? ` · ${executor.active_sessions}/${executor.max_sessions}` : ''}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <dt className="text-titanium-500">Last seen</dt>
              <dd className="text-titanium-300">{executor?.last_seen_at ? new Date(executor.last_seen_at).toLocaleString('de-DE') : 'nie erreicht'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <dt className="text-titanium-500">Policy authority</dt>
              <dd className="text-right text-[var(--brand-champ)]">
                {caps ? `server · ${caps.policy.policy_id}@${caps.policy.policy_version}` : 'prüfe…'}
                {caps && !caps.policy.tenant_policies_loaded && <span className="block text-amber-300">Mandanten-Policies nicht ladbar</span>}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <dt className="text-titanium-500">Mutation approval</dt>
              <dd className="text-emerald-300">
                {caps ? `erforderlich · einmalig · ${Math.round(caps.policy.limits.approvalTtlMs / 60_000)} min` : 'prüfe…'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <dt className="text-titanium-500">Browser action log</dt>
              <dd className={caps?.evidence.available ? 'text-emerald-300' : 'text-amber-300'}>
                {caps ? (caps.evidence.available ? 'evidence-backed · gekettet' : 'Evidence-Speicher nicht erreichbar') : 'prüfe…'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <dt className="text-titanium-500">Notabschaltung</dt>
              <dd className={caps?.kill_switch.engaged ? 'text-red-300' : 'text-titanium-300'}>
                {caps ? (caps.kill_switch.engaged ? 'aktiv — alles gestoppt' : 'bereit') : 'prüfe…'}
              </dd>
            </div>
          </dl>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <Link to="/app/approvals" className="inline-flex items-center justify-between border border-titanium-800 bg-obsidian-900 px-3 py-3 text-xs font-medium text-titanium-200 hover:border-[var(--brand-line-dark-strong)]">
              Approvals <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to={last?.evidence?.event_id ? `/app/events/${last.evidence.event_id}` : '/app/evidence'}
              className="inline-flex items-center justify-between border border-titanium-800 bg-obsidian-900 px-3 py-3 text-xs font-medium text-titanium-200 hover:border-[var(--brand-line-dark-strong)]"
            >
              Evidence <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {canDecide && (
            <button
              type="button"
              onClick={() => void killAll()}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 border border-red-900 px-3 py-2 text-xs text-red-300 hover:bg-red-950/30"
              data-testid="runtime-kill-all"
            >
              <Power className="h-3.5 w-3.5" /> Alle Browser-Sessions beenden
            </button>
          )}

          <div className="mt-4 border border-titanium-800 bg-obsidian-900 px-3 py-3 text-[11px] leading-5 text-titanium-500">
            Die Vorschau zeigt Einzelbilder derselben Chromium-Session, in der die Aktionen laufen (alle 4 s aktualisiert, kein Video-Stream).
            Autonomous bleibt gesperrt, solange der Server es nicht freigibt
            {caps && !caps.can_autonomous && caps.reasons.autonomous.length > 0
              ? `: ${caps.reasons.autonomous.map((r) => CAPABILITY_REASON_TEXT[r] ?? r).join(', ')}.`
              : '.'}
          </div>
        </aside>
      </div>
    </section>
  );
}
