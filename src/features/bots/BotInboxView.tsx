import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Inbox, CalendarClock, ShoppingCart, MessageSquare } from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { Button } from '../../enterprise-os/components/Button';
import {
  listConversations, listMessages, listAppointments, listOrders,
  setAppointmentStatus, setOrderStatus, getConversationIntake,
  takeOverConversation, resolveConversation,
} from './api';
import type {
  BotConversation, BotConversationIntake, BotConversationStatus, BotMessage, BotAppointment, BotOrder, InboxRpcResult,
} from './types';

type Tab = 'conversations' | 'appointments' | 'orders';

/** Filter im Posteingang. „Neu" ist der DB-Status `open` (E10 — kein Wert `neu`). */
type InboxFilter = 'open' | 'in_bearbeitung' | 'erledigt' | 'all';

const INBOX_FILTERS: ReadonlyArray<{ key: InboxFilter; label: string }> = [
  { key: 'open', label: 'Neu' },
  { key: 'in_bearbeitung', label: 'In Bearbeitung' },
  { key: 'erledigt', label: 'Erledigt' },
  { key: 'all', label: 'Alle' },
];

const STATUS_LABEL: Record<BotConversationStatus, string> = {
  open: 'Neu',
  in_bearbeitung: 'In Bearbeitung',
  erledigt: 'Erledigt',
  closed: 'Geschlossen',
};

const CHANNEL_LABEL: Record<string, string> = {
  form: 'Formular',
  chat: 'Web-Chat',
  voice: 'Telefon',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
};

export function channelLabel(channel: string): string {
  return CHANNEL_LABEL[channel] ?? channel;
}

const RPC_HINT: Record<Exclude<InboxRpcResult, 'ok'>, string> = {
  conflict: 'Der Status hat sich inzwischen geändert – vermutlich hat jemand anderes übernommen. Liste wurde aktualisiert.',
  not_found: 'Konversation nicht gefunden oder keine Berechtigung.',
};

/** Spiegelt die RPCs inbox_take_over/inbox_resolve: nur Owner/Admin (is_tenant_owner_or_admin). */
export const INBOX_ACTION_ROLES: ReadonlySet<string> = new Set(['owner', 'admin']);

/** /app/bots/inbox — Posteingang: Konversationen, Termine, Bestellungen. */
export function BotInboxView() {
  return <AuthGate>{() => <BotInboxInner />}</AuthGate>;
}

function fmt(ts: string | null): string {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString('de-DE'); } catch { return ts; }
}

function metadataText(metadata: Record<string, unknown> | undefined, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function metadataNumber(metadata: Record<string, unknown> | undefined, key: string): number | null {
  const value = metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function money(value: number, currency: string): string {
  return value.toLocaleString('de-DE', { style: 'currency', currency: currency || 'EUR' });
}

function BotInboxInner() {
  const { activeTenantId, tenants } = useTenant();
  const role = tenants.find((t) => t.tenantId === activeTenantId)?.role as string | undefined;
  const canAct = role !== undefined && INBOX_ACTION_ROLES.has(role);
  const [tab, setTab] = useState<Tab>('conversations');

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="flex h-14 items-center justify-between border-b border-titanium-900 bg-obsidian-900 px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/bots" aria-label="Zurück zu den KI-Mitarbeitern" className="p-1.5 text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-200">
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
          <ConversationsPane tenantId={activeTenantId} canAct={canAct} />
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

function ConversationsPane({ tenantId, canAct }: { tenantId: string; canAct: boolean }) {
  const [filter, setFilter] = useState<InboxFilter>('open');
  const { data: convos, loading, error, reload } = useAsync<BotConversation[]>(
    () => listConversations(tenantId, 100, filter === 'all' ? undefined : filter), [tenantId, filter]);
  const [selected, setSelected] = useState<string | null>(null);
  const [hint, setHint] = useState<{ msg: string; tone: 'ok' | 'error' } | null>(null);

  const current = convos?.find((c) => c.id === selected) ?? null;

  async function act(kind: 'take_over' | 'resolve', id: string) {
    setHint(null);
    try {
      const result = kind === 'take_over' ? await takeOverConversation(id) : await resolveConversation(id);
      if (result === 'ok') {
        setHint({ msg: kind === 'take_over' ? 'Übernommen.' : 'Als erledigt markiert.', tone: 'ok' });
      } else {
        setHint({ msg: RPC_HINT[result], tone: 'error' });
      }
    } catch (e) {
      setHint({ msg: (e as Error).message, tone: 'error' });
    }
    reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Status-Filter">
        {INBOX_FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => { setFilter(f.key); setSelected(null); }}
            className={`border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              filter === f.key ? 'border-security-500 bg-obsidian-800 text-titanium-50' : 'border-titanium-800 text-titanium-500 hover:text-titanium-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {hint && (
        <div
          role="status"
          className={`border px-3 py-2 text-xs ${hint.tone === 'ok' ? 'border-emerald-500/40 text-emerald-400' : 'border-amber-500/40 text-amber-400'}`}
        >
          {hint.msg}
        </div>
      )}

      {loading && !convos ? (
        <p className="font-mono text-xs text-titanium-500">Lade…</p>
      ) : error ? (
        <ErrorBox msg={error} />
      ) : !convos || convos.length === 0 ? (
        <EmptyBox msg={filter === 'open' ? 'Keine neuen Anfragen.' : 'Keine Konversationen in diesem Filter.'} />
      ) : (
        <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
          {/* Mobil: Liste ODER Detail, Desktop: beides. */}
          <div className={`space-y-1 ${selected ? 'hidden md:block' : ''}`}>
            {convos.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={`w-full border px-3 py-2 text-left transition-colors ${
                  selected === c.id ? 'border-security-500 bg-obsidian-800' : 'border-titanium-800 hover:border-titanium-600'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-titanium-200">{c.contact_label || c.external_ref || 'Anonym'}</span>
                  <InboxStatusChip status={c.status} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-titanium-600">{fmt(c.last_message_at)}</span>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-titanium-600">{channelLabel(c.channel)}</span>
                </div>
              </button>
            ))}
          </div>
          <div className={selected ? '' : 'hidden md:block'}>
            {current ? (
              <ConversationDetail
                tenantId={tenantId}
                conversation={current}
                canAct={canAct}
                onBack={() => setSelected(null)}
                onTakeOver={() => act('take_over', current.id)}
                onResolve={() => act('resolve', current.id)}
              />
            ) : (
              <EmptyBox msg="Konversation auswählen." />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConversationDetail({ tenantId, conversation, canAct, onBack, onTakeOver, onResolve }: {
  tenantId: string;
  conversation: BotConversation;
  canAct: boolean;
  onBack: () => void;
  onTakeOver: () => void;
  onResolve: () => void;
}) {
  const c = conversation;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-titanium-800 bg-obsidian-900 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <button onClick={onBack} className="p-1 text-titanium-400 hover:text-titanium-200 md:hidden" aria-label="Zurück zur Liste">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm text-titanium-100">{c.contact_label || c.external_ref || 'Anonym'}</p>
            <p className="font-mono text-[10px] text-titanium-500">
              {channelLabel(c.channel)} · {fmt(c.last_message_at ?? c.created_at)}
              {c.handed_off_at ? ` · übernommen ${fmt(c.handed_off_at)}` : ''}
              {c.resolved_at ? ` · erledigt ${fmt(c.resolved_at)}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <InboxStatusChip status={c.status} />
          {canAct && c.status === 'open' && (
            <Button size="sm" variant="secondary" onClick={onTakeOver}>Übernehmen</Button>
          )}
          {canAct && c.status === 'in_bearbeitung' && (
            <Button size="sm" variant="secondary" onClick={onResolve}>Erledigt</Button>
          )}
        </div>
      </div>
      {!canAct && (c.status === 'open' || c.status === 'in_bearbeitung') && (
        <p className="font-mono text-[10px] text-titanium-500">Übernehmen und Erledigen können nur Owner und Admins.</p>
      )}
      <IntakeCard tenantId={tenantId} conversationId={c.id} />
      <MessageThread tenantId={tenantId} conversationId={c.id} />
    </div>
  );
}

function IntakeCard({ tenantId, conversationId }: { tenantId: string; conversationId: string }) {
  const { data, loading, error } = useAsync<BotConversationIntake | null>(
    () => getConversationIntake(tenantId, conversationId), [tenantId, conversationId]);
  if (loading || error || !data) return null;
  const i = data;
  const contact = [i.kontakt_name, i.kontakt_telefon, i.kontakt_email].filter(Boolean).join(' · ');
  return (
    <div className="grid gap-3 border border-titanium-800 px-4 py-3 text-xs sm:grid-cols-2">
      {i.anliegen && (
        <div className="sm:col-span-2">
          <p className="font-mono text-[9px] uppercase tracking-wider text-titanium-600">Anliegen</p>
          <p className="whitespace-pre-wrap text-titanium-100">{i.anliegen}</p>
        </div>
      )}
      <div>
        <p className="font-mono text-[9px] uppercase tracking-wider text-titanium-600">Kontakt</p>
        <p className="text-titanium-200">{contact || '—'}</p>
      </div>
      <div>
        <p className="font-mono text-[9px] uppercase tracking-wider text-titanium-600">Terminwunsch</p>
        <p className="text-titanium-200">
          {i.terminwunsch ?? (i.terminwunsch_zeit ? fmt(i.terminwunsch_zeit) : '—')}
        </p>
        {(i.terminwunsch || i.terminwunsch_zeit) && (
          <p className="mt-0.5 text-[10px] text-amber-400">Wunsch der anfragenden Person – kein bestätigter Termin.</p>
        )}
      </div>
      {i.einwilligung_at && (
        <p className="font-mono text-[10px] text-titanium-600 sm:col-span-2">Einwilligung {fmt(i.einwilligung_at)}</p>
      )}
    </div>
  );
}

function InboxStatusChip({ status }: { status: BotConversationStatus }) {
  const cls = status === 'open'
    ? 'text-amber-400 border-amber-500/40'
    : status === 'in_bearbeitung'
      ? 'text-security-400 border-security-500/40'
      : status === 'erledigt'
        ? 'text-emerald-400 border-emerald-500/40'
        : 'text-titanium-600 border-titanium-800';
  return <span className={`shrink-0 border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${cls}`}>{STATUS_LABEL[status] ?? status}</span>;
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
      {data.map((o) => {
        const isRestaurant = o.metadata?.vertical === 'restaurant';
        const fulfillment = metadataText(o.metadata, 'fulfillment');
        const deliveryAddress = metadataText(o.metadata, 'delivery_address');
        const pricingAuthority = metadataText(o.metadata, 'pricing_authority');
        const subtotal = metadataNumber(o.metadata, 'subtotal');
        const deliveryFee = metadataNumber(o.metadata, 'delivery_fee');
        const customerConfirmed = o.metadata?.customer_confirmed === true;
        const eta = metadataNumber(o.metadata, 'estimated_delivery_minutes');

        return (
          <div key={o.id} className="border border-titanium-800 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-titanium-100">{o.customer_name}</p>
                  {isRestaurant && (
                    <span className="border border-security-500/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-security-400">
                      Restaurant
                    </span>
                  )}
                  {fulfillment && (
                    <span className="border border-titanium-700 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-titanium-400">
                      {fulfillment === 'delivery' ? 'Lieferung' : fulfillment === 'pickup' ? 'Abholung' : fulfillment}
                    </span>
                  )}
                </div>
                <p className="font-mono text-[10px] text-titanium-500">
                  {fmt(o.created_at)}{o.contact ? ` · ${o.contact}` : ''}
                </p>
                {deliveryAddress && (
                  <p className="mt-1 text-xs text-titanium-400">Lieferadresse: {deliveryAddress}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-titanium-200">
                  {money(o.total_amount, o.currency)}
                </span>
                <StatusChip status={o.status} />
                {o.status === 'new' && (
                  <Button size="sm" variant="secondary" onClick={() => setStatus(o.id, 'confirmed')}>
                    {isRestaurant ? 'Intern bestätigen' : 'Bestätigen'}
                  </Button>
                )}
                {(o.status === 'new' || o.status === 'confirmed') && (
                  <Button size="sm" variant="ghost" onClick={() => setStatus(o.id, 'fulfilled')}>Erfüllt</Button>
                )}
              </div>
            </div>

            {o.items.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-titanium-900 pt-3 font-mono text-[11px] text-titanium-400">
                {o.items.map((it, i) => {
                  const unitPrice = typeof it.unit_price === 'number'
                    ? it.unit_price
                    : typeof it.price === 'number'
                      ? it.price
                      : null;
                  const lineTotal = typeof it.line_total === 'number'
                    ? it.line_total
                    : unitPrice !== null
                      ? unitPrice * (it.qty ?? 1)
                      : null;
                  return (
                    <li key={it.item_id ?? i} className="flex flex-wrap justify-between gap-2">
                      <span>{(it.qty ?? 1)}× {it.name}</span>
                      {lineTotal !== null && (
                        <span className="text-titanium-300">
                          {money(lineTotal, o.currency)}
                          {unitPrice !== null && (it.qty ?? 1) > 1 ? ` · ${money(unitPrice, o.currency)} / Stück` : ''}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {isRestaurant && (
              <div className="mt-3 grid gap-2 border-t border-titanium-900 pt-3 text-[11px] sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-titanium-600">Kundenbestätigung</p>
                  <p className={customerConfirmed ? 'text-emerald-400' : 'text-amber-400'}>
                    {customerConfirmed ? 'bestätigt' : 'nicht nachgewiesen'}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-titanium-600">Preisquelle</p>
                  <p className={pricingAuthority ? 'text-emerald-400' : 'text-amber-400'}>
                    {pricingAuthority === 'bots.config.restaurant.menu' ? 'serverseitiges Bot-Menü' : pricingAuthority ?? 'nicht ausgewiesen'}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-titanium-600">Warenwert / Lieferung</p>
                  <p className="text-titanium-300">
                    {subtotal !== null ? money(subtotal, o.currency) : '—'}
                    {deliveryFee !== null ? ` + ${money(deliveryFee, o.currency)}` : ''}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-titanium-600">Lieferzeit-Richtwert</p>
                  <p className="text-titanium-300">{eta !== null ? `ca. ${Math.round(eta)} Min.` : '—'}</p>
                </div>
              </div>
            )}

            {o.notes && <p className="mt-2 text-xs text-titanium-500">{o.notes}</p>}
          </div>
        );
      })}
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
