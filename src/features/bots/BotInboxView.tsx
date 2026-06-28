import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Inbox, CalendarClock, ShoppingCart, MessageSquare } from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { Button } from '../../enterprise-os/components/Button';
import {
  listConversations, listMessages, listAppointments, listOrders,
  setAppointmentStatus, setOrderStatus,
} from './api';
import type { BotConversation, BotMessage, BotAppointment, BotOrder } from './types';

type Tab = 'conversations' | 'appointments' | 'orders';

/** /app/bots/inbox — Posteingang: Konversationen, Termine, Bestellungen. */
export function BotInboxView() {
  return <AuthGate>{() => <BotInboxInner />}</AuthGate>;
}

function fmt(ts: string | null): string {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString('de-DE'); } catch { return ts; }
}

function BotInboxInner() {
  const { activeTenantId } = useTenant();
  const [tab, setTab] = useState<Tab>('conversations');

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="flex h-14 items-center justify-between border-b border-titanium-900 bg-obsidian-900 px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/bots" className="p-1.5 text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-security-500 to-blue-700">
              <Inbox className="h-4 w-4 text-white" />
            </div>
            <h1 className="font-display text-sm font-semibold tracking-tight text-titanium-50">Bot-Posteingang</h1>
          </div>
        </div>
      </header>

      <div className="border-b border-titanium-900 bg-obsidian-900 px-4">
        <nav className="flex gap-1">
          <TabButton active={tab === 'conversations'} onClick={() => setTab('conversations')} icon={<MessageSquare className="h-3.5 w-3.5" />} label="Konversationen" />
          <TabButton active={tab === 'appointments'} onClick={() => setTab('appointments')} icon={<CalendarClock className="h-3.5 w-3.5" />} label="Termine" />
          <TabButton active={tab === 'orders'} onClick={() => setTab('orders')} icon={<ShoppingCart className="h-3.5 w-3.5" />} label="Bestellungen" />
        </nav>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {!activeTenantId ? (
          <p className="font-mono text-xs text-titanium-500">Kein Tenant ausgewählt.</p>
        ) : tab === 'conversations' ? (
          <ConversationsPane tenantId={activeTenantId} />
        ) : tab === 'appointments' ? (
          <AppointmentsPane tenantId={activeTenantId} />
        ) : (
          <OrdersPane tenantId={activeTenantId} />
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
        active ? 'border-security-500 text-titanium-50' : 'border-transparent text-titanium-500 hover:text-titanium-300'
      }`}
    >
      {icon} {label}
    </button>
  );
}

function useAsync<T>(loader: () => Promise<T>, deps: unknown[]): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(() => {
    setLoading(true); setError(null);
    loader().then(setData).catch((e) => setError((e as Error).message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { data, loading, error, reload: run };
}

function ConversationsPane({ tenantId }: { tenantId: string }) {
  const { data: convos, loading, error } = useAsync<BotConversation[]>(() => listConversations(tenantId), [tenantId]);
  const [selected, setSelected] = useState<string | null>(null);

  if (loading) return <p className="font-mono text-xs text-titanium-500">Lade…</p>;
  if (error) return <ErrorBox msg={error} />;
  if (!convos || convos.length === 0) return <EmptyBox msg="Noch keine Konversationen." />;

  return (
    <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
      <div className="space-y-1">
        {convos.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c.id)}
            className={`w-full border px-3 py-2 text-left transition-colors ${
              selected === c.id ? 'border-security-500 bg-obsidian-800' : 'border-titanium-800 hover:border-titanium-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="truncate text-xs text-titanium-200">{c.contact_label || c.external_ref || 'Anonym'}</span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-titanium-600">{c.channel}</span>
            </div>
            <span className="font-mono text-[10px] text-titanium-600">{fmt(c.last_message_at)}</span>
          </button>
        ))}
      </div>
      <div>{selected ? <MessageThread tenantId={tenantId} conversationId={selected} /> : <EmptyBox msg="Konversation auswählen." />}</div>
    </div>
  );
}

function MessageThread({ tenantId, conversationId }: { tenantId: string; conversationId: string }) {
  const { data: messages, loading, error } = useAsync<BotMessage[]>(() => listMessages(tenantId, conversationId), [tenantId, conversationId]);
  if (loading) return <p className="font-mono text-xs text-titanium-500">Lade Nachrichten…</p>;
  if (error) return <ErrorBox msg={error} />;
  if (!messages || messages.length === 0) return <EmptyBox msg="Keine Nachrichten." />;
  return (
    <div className="space-y-2">
      {messages.map((m) => (
        <div key={m.id} className={`max-w-[85%] border px-3 py-2 ${m.role === 'assistant' ? 'ml-auto border-security-500/40 bg-security-500/5' : 'border-titanium-800 bg-obsidian-900'}`}>
          <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-titanium-600">
            {m.role === 'assistant' ? 'Bot' : m.role === 'user' ? 'Nutzer' : 'System'} · {fmt(m.created_at)}
          </p>
          <p className="whitespace-pre-wrap text-sm text-titanium-100">{m.content}</p>
        </div>
      ))}
    </div>
  );
}

function AppointmentsPane({ tenantId }: { tenantId: string }) {
  const { data, loading, error, reload } = useAsync<BotAppointment[]>(() => listAppointments(tenantId), [tenantId]);
  async function setStatus(id: string, status: BotAppointment['status']) {
    await setAppointmentStatus(tenantId, id, status); reload();
  }
  if (loading) return <p className="font-mono text-xs text-titanium-500">Lade…</p>;
  if (error) return <ErrorBox msg={error} />;
  if (!data || data.length === 0) return <EmptyBox msg="Keine Terminanfragen." />;
  return (
    <div className="space-y-2">
      {data.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 border border-titanium-800 px-4 py-3">
          <div>
            <p className="text-sm text-titanium-100">{a.customer_name}{a.service ? ` · ${a.service}` : ''}</p>
            <p className="font-mono text-[10px] text-titanium-500">
              Wunsch: {fmt(a.requested_at)}{a.contact ? ` · ${a.contact}` : ''}
            </p>
            {a.notes && <p className="mt-1 text-xs text-titanium-400">{a.notes}</p>}
          </div>
          <div className="flex items-center gap-2">
            <StatusChip status={a.status} />
            {a.status === 'requested' && (
              <>
                <Button size="sm" variant="secondary" onClick={() => setStatus(a.id, 'confirmed')}>Bestätigen</Button>
                <Button size="sm" variant="ghost" onClick={() => setStatus(a.id, 'cancelled')}>Ablehnen</Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function OrdersPane({ tenantId }: { tenantId: string }) {
  const { data, loading, error, reload } = useAsync<BotOrder[]>(() => listOrders(tenantId), [tenantId]);
  async function setStatus(id: string, status: BotOrder['status']) {
    await setOrderStatus(tenantId, id, status); reload();
  }
  if (loading) return <p className="font-mono text-xs text-titanium-500">Lade…</p>;
  if (error) return <ErrorBox msg={error} />;
  if (!data || data.length === 0) return <EmptyBox msg="Keine Bestellungen." />;
  return (
    <div className="space-y-2">
      {data.map((o) => (
        <div key={o.id} className="border border-titanium-800 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-titanium-100">{o.customer_name}</p>
              <p className="font-mono text-[10px] text-titanium-500">{fmt(o.created_at)}{o.contact ? ` · ${o.contact}` : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-titanium-200">
                {o.total_amount.toLocaleString('de-DE', { style: 'currency', currency: o.currency || 'EUR' })}
              </span>
              <StatusChip status={o.status} />
              {o.status === 'new' && (
                <Button size="sm" variant="secondary" onClick={() => setStatus(o.id, 'confirmed')}>Bestätigen</Button>
              )}
              {(o.status === 'new' || o.status === 'confirmed') && (
                <Button size="sm" variant="ghost" onClick={() => setStatus(o.id, 'fulfilled')}>Erfüllt</Button>
              )}
            </div>
          </div>
          {o.items.length > 0 && (
            <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-titanium-400">
              {o.items.map((it, i) => (
                <li key={i}>{(it.qty ?? 1)}× {it.name}{typeof it.price === 'number' ? ` — ${it.price}` : ''}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const ok = status === 'confirmed' || status === 'fulfilled';
  const bad = status === 'cancelled';
  const cls = ok ? 'text-emerald-400 border-emerald-500/40' : bad ? 'text-titanium-600 border-titanium-800' : 'text-amber-400 border-amber-500/40';
  return <span className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${cls}`}>{status}</span>;
}

function ErrorBox({ msg }: { msg: string }) {
  return <div className="border border-risk-critical/40 bg-risk-critical/5 px-4 py-3 text-xs text-risk-critical">{msg}</div>;
}
function EmptyBox({ msg }: { msg: string }) {
  return <p className="font-mono text-xs text-titanium-500">{msg}</p>;
}
