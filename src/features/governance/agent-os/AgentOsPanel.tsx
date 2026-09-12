/**
 * Agent OS panel — Intent field, 10-step session, finding card, mesh roster,
 * and read-only Product Evolution integrity strip.
 * Mounted on the canonical ComplianceStatusDashboard (/app), not a second app.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleDashed,
  Loader2,
  ShieldAlert,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useCommandCenter } from '../../dashboard/hooks/useCommandCenter';
import {
  EXAMPLE_VENDOR_FINDING,
  FINDING_ACTIONS,
  listMeshAgents,
  maturityBadgeDe,
  type FindingActionId,
  type CommandSession,
  type StepExecutionState,
} from '../../../core/realsync-os';
import { STATUS_LABEL, type ImplementationStatus } from '../../../product/implementation-status';
import { useEntitlements } from '../../../core/billing/useEntitlements';
import { planById } from '@/shared/pricing';

const COMPLIANCE_PROMPTS = [
  'Prüfe meine KI-Anwendung auf DSGVO und EU AI Act.',
  'Bewerte die Datenschutzlage meiner Website (DSGVO).',
  'Erstelle einen Prüfplan für EU AI Act Compliance.',
];

const PHASE_LABEL: Record<CommandSession['phase'], string> = {
  received: 'Empfangen',
  planned: 'Plan bereit',
  awaiting_approval: 'Freigabe erforderlich',
  approved: 'Freigegeben',
  rejected: 'Abgelehnt',
  running: 'Läuft',
  blocked: 'Blockiert',
  completed: 'Abgeschlossen',
  failed: 'Fehlgeschlagen',
};

function stepIcon(state: StepExecutionState) {
  if (state.status === 'succeeded') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
  if (state.status === 'failed') return <XCircle className="h-3.5 w-3.5 text-rose-400" />;
  if (state.status === 'blocked') return <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />;
  if (state.status === 'running') return <Loader2 className="h-3.5 w-3.5 animate-spin text-[#e8c98a]" />;
  if (state.status === 'awaiting_approval') return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
  return <CircleDashed className="h-3.5 w-3.5 text-titanium-600" />;
}

function badgeClass(maturity: ImplementationStatus | 'spec_only'): string {
  switch (maturity) {
    case 'live':
      return 'border-emerald-700 text-emerald-300 bg-emerald-950/40';
    case 'preview':
      return 'border-[#e8c98a]/40 text-[#e8c98a] bg-[#e8c98a]/5';
    case 'coming-soon':
      return 'border-titanium-800 text-titanium-500 bg-obsidian-800';
    case 'spec_only':
      return 'border-titanium-800 text-titanium-600 bg-obsidian-900';
  }
}

export function AgentOsPanel() {
  const location = useLocation();
  const commandCenter = useCommandCenter();
  const [intent, setIntent] = useState('');
  const [findingChoice, setFindingChoice] = useState<{
    action: FindingActionId;
    at: string;
    persisted: 'session' | 'failed';
  } | null>(null);
  const [findingAudit, setFindingAudit] = useState<string[]>([]);

  // Accept intent from Ctrl+K Command Center via navigation state.
  useEffect(() => {
    const state = location.state as { agentOsIntent?: string } | null;
    const seeded = state?.agentOsIntent?.trim();
    if (!seeded) return;
    setIntent(seeded);
    void commandCenter.open(seeded);
    // Clear one-shot state without remount churn.
    window.history.replaceState({}, document.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once from navigation
  }, []);

  const runIntent = useCallback(() => {
    const value = intent.trim();
    if (!value) return;
    void commandCenter.open(value);
  }, [commandCenter, intent]);

  const onFindingAction = useCallback((actionId: FindingActionId) => {
    const at = new Date().toISOString();
    // Client cannot write governance_events (service-role only) — keep an
    // honest session-local audit line (Preview).
    const line = `${at} · finding.${actionId} · ${EXAMPLE_VENDOR_FINDING.id} · session-preview`;
    setFindingAudit((prev) => [line, ...prev]);
    setFindingChoice({ action: actionId, at, persisted: 'session' });
  }, []);

  const isComplianceSession =
    commandCenter.session?.plan.steps.some((s) => s.agent === 'compliance') ?? false;

  return (
    <section
      data-testid="agent-os-panel"
      className="border border-titanium-900 bg-obsidian-900/80"
      aria-label="RealSync Agent OS"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-titanium-900 px-5 py-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#e8c98a] flex items-center gap-2">
            <Sparkles className="h-3 w-3" aria-hidden />
            RealSync Agent OS™ · Vorschau
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-titanium-50">
            Was möchtest du erledigen?
          </h2>
          <p className="mt-1 text-xs text-titanium-400">
            Intent → Policy → Freigabe → Aktion → Evidence. Kein Chatbot · kein Blind-Execute.
          </p>
        </div>
        <span className={`font-mono text-[9px] uppercase tracking-widest px-2 py-1 border ${badgeClass('preview')}`}>
          {STATUS_LABEL.preview}
        </span>
      </div>

      <div className="space-y-5 px-5 py-5">
        <div className="border border-titanium-800 bg-obsidian-950/60 p-3">
          <textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runIntent();
            }}
            rows={3}
            placeholder="z. B. Prüfe meine KI-Anwendung auf DSGVO und EU AI Act."
            aria-label="Was möchtest du erledigen?"
            className="w-full resize-none bg-transparent text-sm text-titanium-100 placeholder:text-titanium-600 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-titanium-900 pt-3">
            <div className="flex flex-wrap gap-2">
              {COMPLIANCE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setIntent(prompt)}
                  className="border border-titanium-800 px-2.5 py-1 font-mono text-[10px] text-titanium-400 hover:border-[#e8c98a]/40 hover:text-[#e8c98a]"
                >
                  {prompt.length > 42 ? `${prompt.slice(0, 42)}…` : prompt}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={runIntent}
              disabled={!intent.trim() || commandCenter.busy}
              className="inline-flex items-center gap-2 bg-[#e8c98a] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-obsidian-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {commandCenter.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Intent öffnen
            </button>
          </div>
          {commandCenter.error && (
            <p className="mt-3 text-xs text-rose-300" role="alert">
              {commandCenter.error}
            </p>
          )}
        </div>

        {commandCenter.session && (
          <ComplianceSessionView
            session={commandCenter.session}
            busy={commandCenter.busy}
            isCompliance={isComplianceSession}
            onApprove={() => void commandCenter.approve()}
            onReject={() => commandCenter.reject('user_rejected')}
            onReset={commandCenter.reset}
          />
        )}

        {commandCenter.session && isComplianceSession && (
          <FindingCard choice={findingChoice} audit={findingAudit} onAction={onFindingAction} />
        )}

        <MeshRoster />
        <ProductIntegrityPanel />
        <ChromeSidePanelSpec />
      </div>
    </section>
  );
}

function ComplianceSessionView({
  session,
  busy,
  isCompliance,
  onApprove,
  onReject,
  onReset,
}: {
  session: CommandSession;
  busy: boolean;
  isCompliance: boolean;
  onApprove: () => void;
  onReject: () => void;
  onReset: () => void;
}) {
  const awaiting = session.phase === 'awaiting_approval' || session.phase === 'planned';

  return (
    <div data-testid="agent-os-session" className="border border-titanium-800 bg-obsidian-950/40 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-titanium-500">
            {isCompliance ? 'Compliance-Session · 10 Artefakte' : 'Command Session'}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-titanium-50">{session.intent.text}</h3>
          <p className="mt-1 font-mono text-[10px] text-titanium-500">
            Phase {PHASE_LABEL[session.phase]} · Risiko {session.plan.risk} · Policy {session.policyVersion}
          </p>
        </div>
        <button type="button" onClick={onReset} className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 hover:text-titanium-200">
          Neue Anweisung
        </button>
      </div>

      <ol className="space-y-1.5">
        {session.plan.steps.map((step, index) => {
          const state = session.steps.find((item) => item.stepId === step.id);
          return (
            <li
              key={step.id}
              className="flex items-start gap-3 border border-titanium-900 bg-obsidian-900/60 px-3 py-2.5"
              data-testid={`agent-os-step-${step.id}`}
            >
              <span className="mt-0.5 font-mono text-[10px] text-titanium-600 w-5 shrink-0">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="mt-0.5">{state ? stepIcon(state) : <CircleDashed className="h-3.5 w-3.5 text-titanium-600" />}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-titanium-100">{step.title}</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-500 border border-titanium-800 px-1.5 py-0.5">
                    {step.agent}
                  </span>
                  {step.requiresApproval && (
                    <span className="font-mono text-[9px] uppercase tracking-widest text-amber-300 border border-amber-800 px-1.5 py-0.5">
                      Approval
                    </span>
                  )}
                </div>
                {state?.observation && typeof state.observation.note === 'string' && (
                  <p className="mt-1 font-mono text-[10px] text-titanium-500">{state.observation.note}</p>
                )}
                {state?.notImplemented && (
                  <p className="mt-1 text-xs text-amber-300">
                    NOT IMPLEMENTED{state.policyReason ? ` — ${state.policyReason}` : ''}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {awaiting && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onApprove}
            disabled={busy}
            className="bg-[#e8c98a] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-obsidian-950 disabled:opacity-40"
          >
            {busy ? 'Führt aus…' : 'Plan freigeben'}
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={busy}
            className="border border-titanium-700 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-titanium-300 disabled:opacity-40"
          >
            Ablehnen
          </button>
        </div>
      )}

      {session.events.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-titanium-600">Prüfpfad (Session)</p>
          <ul className="max-h-36 space-y-1 overflow-auto font-mono text-[10px] text-titanium-500">
            {session.events.map((event) => (
              <li key={event.id}>
                {event.occurredAt} · {event.stage}/{event.action} · {event.result}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FindingCard({
  choice,
  audit,
  onAction,
}: {
  choice: { action: FindingActionId; at: string; persisted: 'session' | 'failed' } | null;
  audit: string[];
  onAction: (id: FindingActionId) => void;
}) {
  return (
    <div data-testid="agent-os-finding-card" className="border border-amber-900/60 bg-amber-950/20 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-titanium-50">{EXAMPLE_VENDOR_FINDING.title}</h3>
            <span className={`font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 border ${badgeClass('preview')}`}>
              Preview
            </span>
          </div>
          <p className="mt-1 text-xs text-titanium-400 leading-relaxed">{EXAMPLE_VENDOR_FINDING.summary}</p>
          <p className="mt-2 font-mono text-[10px] text-titanium-600">
            {EXAMPLE_VENDOR_FINDING.framework} · {EXAMPLE_VENDOR_FINDING.vendor}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {FINDING_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => onAction(action.id)}
                className={`border px-3 py-1.5 text-xs font-medium ${
                  choice?.action === action.id
                    ? 'border-[#e8c98a] text-[#e8c98a] bg-[#e8c98a]/10'
                    : 'border-titanium-700 text-titanium-200 hover:border-[#e8c98a]/50'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
          {choice && (
            <p className="mt-3 font-mono text-[10px] text-titanium-500">
              Entscheidung „{FINDING_ACTIONS.find((a) => a.id === choice.action)?.label}“ · Session-Audit {choice.at}
              {' · '}Persistenz: Preview (kein Client-Write auf governance_events)
            </p>
          )}
          {audit.length > 0 && (
            <ul className="mt-2 max-h-20 space-y-0.5 overflow-auto font-mono text-[10px] text-titanium-600">
              {audit.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function MeshRoster() {
  const agents = listMeshAgents();
  return (
    <div data-testid="agent-os-mesh-roster">
      <div className="mb-3 flex items-center gap-2">
        <Bot className="h-4 w-4 text-[#e8c98a]" />
        <h3 className="text-sm font-semibold text-titanium-50">Specialist Mesh</h3>
        <span className="font-mono text-[10px] text-titanium-600">
          Orchestrator → Mesh · nur Compliance preview-runnable
        </span>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {agents.map((agent) => (
          <li
            key={agent.id}
            className="flex items-start justify-between gap-2 border border-titanium-900 bg-obsidian-950/50 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium text-titanium-100 truncate">{agent.label}</p>
              <p className="mt-0.5 font-mono text-[10px] text-titanium-600 truncate">{agent.role}</p>
            </div>
            <span className={`shrink-0 font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 border ${badgeClass(agent.maturity)}`}>
              {maturityBadgeDe(agent.maturity)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProductIntegrityPanel() {
  const { tier, loading, error, paymentState, features } = useEntitlements();
  const plan = planById(tier);
  const featureCount = Object.keys(features).length;

  return (
    <div data-testid="agent-os-integrity-panel" className="border border-titanium-900 bg-obsidian-950/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#e8c98a]">Product Evolution</p>
          <h3 className="text-sm font-semibold text-titanium-50">Integrity Panel · read-only</h3>
        </div>
        <span className={`font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 border ${badgeClass('preview')}`}>
          {STATUS_LABEL.preview}
        </span>
      </div>
      <p className="text-xs text-titanium-500 mb-3">
        Landing ↔ Pricing ↔ Stripe ↔ Entitlements ↔ Backend ↔ Dashboard ↔ Docs — kein Auto-Merge. Dominik approved.
      </p>
      {loading ? (
        <p className="text-xs text-titanium-500 flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Entitlements laden…
        </p>
      ) : error ? (
        <p className="text-xs text-amber-300">Entitlements nicht verfügbar: {error}</p>
      ) : (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-titanium-900 border border-titanium-900">
          <IntegrityCell label="Plan" value={plan?.name ?? tier} />
          <IntegrityCell label="Subscription" value={paymentState.status ?? 'none'} />
          <IntegrityCell label="Entitlement-Keys" value={String(featureCount)} />
          <IntegrityCell
            label="Grace"
            value={
              paymentState.graceDaysRemaining != null
                ? `${paymentState.graceDaysRemaining}d`
                : '—'
            }
          />
        </dl>
      )}
    </div>
  );
}

function IntegrityCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-obsidian-900 px-3 py-2.5">
      <dt className="font-mono text-[9px] uppercase tracking-widest text-titanium-600">{label}</dt>
      <dd className="mt-1 font-mono text-xs text-titanium-100 truncate">{value}</dd>
    </div>
  );
}

function ChromeSidePanelSpec() {
  return (
    <div
      data-testid="agent-os-chrome-spec"
      className="border border-dashed border-titanium-800 bg-obsidian-950/30 px-4 py-3 flex flex-wrap items-center justify-between gap-2"
    >
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-titanium-600">Chrome Side Panel</p>
        <p className="mt-1 text-xs text-titanium-500">
          Analyze Page · GDPR/AI Act Check · Evidence — Spec only. Keine Fake-Extension in diesem PR.
        </p>
      </div>
      <span className={`font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 border ${badgeClass('spec_only')}`}>
        SPEC ONLY
      </span>
    </div>
  );
}
