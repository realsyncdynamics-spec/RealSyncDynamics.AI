import { useEffect, useState } from 'react';
import { useTenant } from '../../../core/access/TenantProvider';
import { ChatInput } from './ChatInput';
import { ChatMessageView } from './ChatMessageView';
import { useAgentChat } from './useAgentChat';

// Floating compliance-assistant widget, scoped to the current tenant.
// Calls the `governance-agent` Edge Function (PR #154). Renders only
// inside an authenticated /governance route via the GovernanceShell.

export function AgentWidget() {
  const { activeTenantId } = useTenant();
  const [open, setOpen] = useState(false);
  const chat = useAgentChat(activeTenantId);

  // Close on Escape.
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
        <header className="flex items-center justify-between border-b border-white/10 bg-black/40 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-black">
              RS
            </div>
            <div>
              <p className="text-sm font-semibold leading-none text-white">Compliance-Assistent</p>
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {activeTenantId ? 'tenant-scoped · auditierbar' : 'kein Tenant aktiv'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={chat.reset}
              title="Konversation zurücksetzen"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
            >
              ↺
            </button>
            <button
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
              aria-label="Schliessen"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        {chat.usRoutingRequired && (
          <div className="border-b border-amber-400/30 bg-amber-400/10 p-3 text-[12px] text-amber-200">
            <p className="font-semibold">Hinweis zur LLM-Routing-Geografie</p>
            <p className="mt-1 text-amber-100/80">
              Anthropic-direkt routet aktuell durch die USA. Mistral La Plateforme / Anthropic via Bedrock EU folgt in einer
              Folge-PR. Bestätige einmalig, um diese Session weiterzuführen.
            </p>
            <div className="mt-2 flex justify-end">
              <button
                onClick={chat.acknowledgeUsRouting}
                className="rounded-lg bg-amber-400 px-3 py-1 text-[12px] font-medium text-black transition-colors hover:bg-amber-300"
              >
                Verstanden, fortfahren
              </button>
            </div>
          </div>
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
