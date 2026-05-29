import { useEffect, useState } from 'react';
import { useTenant } from '../../../core/access/TenantProvider';
import { ChatInput, ANON_QUICK } from './ChatInput';
import { ChatMessageView } from './ChatMessageView';
import { useAgentChat } from './useAgentChat';
import { useAnonChat } from './useAgentChat';

// Floating compliance-assistant widget.
//
// mode="tenant" (default): scoped to the current tenant, auth-gated, renders
//   its own FAB trigger button. Used inside /governance routes.
//
// mode="anon": public, rate-limited, no tenant data access. The panel is
//   controlled externally (open/onClose props from AssistentChip). No FAB.
//
// mode="audit_copilot": Phase 4 (Hostinger-Pattern). Right-Panel-Variante
//   nach einem Audit. Erlaubt Tool-Calls `explain_finding` und
//   `generate_fix_snippet` ueber den anon-Pfad. `auditId` ist Pflicht,
//   weil die Tools alle Calls an den Audit knuepfen. Der bestehende
//   AuditCopilotPanel.tsx liefert die konkrete UI — hier ist die Surface
//   als duenne Weiche, damit Aufrufer `<AgentWidget mode="audit_copilot"
//   auditId={...} />` einheitlich benutzen koennen.

type AgentWidgetMode = 'tenant' | 'anon' | 'audit_copilot';

import { lazy, Suspense } from 'react';
const AuditCopilotShell = lazy(() => import('./AuditCopilotShell').then((m) => ({ default: m.AuditCopilotShell })));

interface AgentWidgetProps {
  mode?: AgentWidgetMode;
  // Required in anon mode: controlled open/close from AssistentChip.
  open?: boolean;
  onClose?: () => void;
  // Phase 4: required in audit_copilot mode. Identifies the audit
  // the copilot is anchored to; child components pass this id along
  // with every tool call (explain_finding, generate_fix_snippet).
  auditId?: string;
}

export function AgentWidget({ mode = 'tenant', open: controlledOpen, onClose, auditId }: AgentWidgetProps) {
  if (mode === 'anon') {
    return <AnonWidget open={controlledOpen ?? false} onClose={onClose ?? (() => {})} />;
  }
  if (mode === 'audit_copilot') {
    if (!auditId) {
      // Defensive: ohne auditId hat das Panel keinen Bezug. Statt
      // stillschweigend Tenant-Tab zu rendern, liefern wir einen klaren
      // Hinweis — das vermeidet stille Mis-Mounts in Tests.
      return (
        <div className="p-4 text-xs text-rose-300 border border-rose-500/40 bg-rose-500/10">
          AgentWidget mode="audit_copilot" benoetigt eine auditId.
        </div>
      );
    }
    return (
      <Suspense fallback={<div className="p-4 text-xs text-titanium-500">Audit-Copilot wird geladen ...</div>}>
        <AuditCopilotShell auditId={auditId} />
      </Suspense>
    );
  }
  return <TenantWidget />;
}

// ── Tenant widget (unchanged behaviour) ──────────────────────────────────────

function TenantWidget() {
  const { activeTenantId } = useTenant();
  const [open, setOpen] = useState(false);
  const chat = useAgentChat(activeTenantId);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <div
        className={[
          'fixed bottom-20 right-4 z-50 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-2xl transition-all duration-200',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
        ].join(' ')}
        style={{ height: 520 }}
        role="dialog"
        aria-label="Compliance-Assistent"
      >
        <WidgetHeader
          label="Compliance-Assistent"
          badge={activeTenantId ? 'tenant-scoped · auditierbar' : 'kein Tenant aktiv'}
          onReset={chat.reset}
          onClose={() => setOpen(false)}
        />

        {chat.usRoutingRequired && (
          <UsRoutingBanner onAck={chat.acknowledgeUsRouting} />
        )}

        <div className="flex-1 space-y-4 overflow-y-auto p-4 scroll-smooth">
          {chat.messages.map((m) => (
            <ChatMessageView key={m.id} message={m} />
          ))}
          <div ref={chat.bottomRef} />
        </div>

        <ChatInput
          onSend={chat.send}
          isLoading={chat.isLoading}
          showQuickActions={chat.showQuickActions}
          disabled={!activeTenantId}
        />
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-50 flex h-13 w-13 items-center justify-center rounded-full bg-amber-400 text-black shadow-lg shadow-amber-400/25 transition-all hover:scale-105 hover:bg-amber-300 active:scale-95"
        style={{ width: 52, height: 52 }}
        aria-label={open ? 'Assistent schliessen' : 'Compliance-Assistent öffnen'}
      >
        {open ? (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        )}
      </button>
    </>
  );
}

// ── Anon widget (public, controlled by AssistentChip) ────────────────────────

function AnonWidget({ open, onClose }: { open: boolean; onClose: () => void }) {
  const chat = useAnonChat();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div
      className={[
        'fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-titanium-800 bg-obsidian-950 shadow-2xl transition-all duration-200',
        open ? 'pointer-events-auto opacity-100 translate-y-0' : 'pointer-events-none translate-y-3 opacity-0',
      ].join(' ')}
      style={{ height: 500 }}
      role="dialog"
      aria-label="Compliance-Assistent"
      aria-hidden={!open}
    >
      <WidgetHeader
        label="KI-Assistent"
        badge="Öffentlich · EU · keine Rechtsberatung"
        onReset={chat.reset}
        onClose={onClose}
      />

      {chat.rateLimited && (
        <div className="border-b border-orange-400/30 bg-orange-400/10 px-4 py-2.5 text-[12px] text-orange-200">
          Anfrage-Limit erreicht (5/min). Bitte in einer Minute erneut versuchen.
        </div>
      )}

      {chat.usRoutingRequired && (
        <UsRoutingBanner onAck={chat.acknowledgeUsRouting} />
      )}

      <div className="flex-1 space-y-4 overflow-y-auto p-4 scroll-smooth">
        {chat.messages.map((m) => (
          <ChatMessageView key={m.id} message={m} />
        ))}
        <div ref={chat.bottomRef} />
      </div>

      <ChatInput
        onSend={chat.send}
        isLoading={chat.isLoading}
        showQuickActions={chat.showQuickActions}
        quickActions={ANON_QUICK}
        placeholder="DSGVO-Frage stellen…"
      />
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function WidgetHeader({
  label,
  badge,
  onReset,
  onClose,
}: {
  label: string;
  badge: string;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <header className="flex items-center justify-between border-b border-white/10 bg-black/40 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-black">
          RS
        </div>
        <div>
          <p className="text-sm font-semibold leading-none text-white">{label}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {badge}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onReset}
          title="Konversation zurücksetzen"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
        >
          ↺
        </button>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
          aria-label="Schliessen"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </header>
  );
}

function UsRoutingBanner({ onAck }: { onAck: () => void }) {
  return (
    <div className="border-b border-amber-400/30 bg-amber-400/10 p-3 text-[12px] text-amber-200">
      <p className="font-semibold">Hinweis zur LLM-Routing-Geografie</p>
      <p className="mt-1 text-amber-100/80">
        Anthropic-direkt routet aktuell durch die USA. Bestätige einmalig, um fortzufahren.
      </p>
      <div className="mt-2 flex justify-end">
        <button
          onClick={onAck}
          className="rounded-lg bg-amber-400 px-3 py-1 text-[12px] font-medium text-black transition-colors hover:bg-amber-300"
        >
          Verstanden, fortfahren
        </button>
      </div>
    </div>
  );
}
