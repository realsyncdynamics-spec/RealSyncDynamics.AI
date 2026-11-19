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
import {
  appointmentStatusLabel, orderStatusLabel, conversationStatusLabel, channelLabel,
  statusTone, openCounts, sortAppointmentsOpenFirst, appointmentsForConversation, contactLabel,
  nextHumanReview, sortConversationsForReview,
} from './inboxLogic';

type Tab = 'conversations' | 'appointments' | 'orders';

/**
 * /app/bots/inbox — Posteingang des AI Receptionist: Anfragen (Konversationen),
 * Terminwünsche und Bestellungen. Alles, was eine menschliche Entscheidung
 * braucht, wird gezählt und zuerst gezeigt.
 */
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
  const { activeTenantId } = useTenant();
  const [tab, setTab] = useState<Tab>('conversations');

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="flex h-14 items-center justify-between border-b border-titanium-900 bg-obsidian-900 px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/bots" aria-label="Zurück zu den Bots" className="p-1.5 text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-security-500 to-blue-700">
              <Inbox className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="font-display text-sm font-semibold tracking-tight text-titanium-50">Posteingang</h1>
              <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-600">Anfragen · Terminwünsche · Übergabe an dein Team</p>
            </div>
          </div>
        </div>
      </header>

      {!activeTenantId ? (
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <p className="font-mono text-xs text-titanium-500">Kein Tenant ausgewählt.</p>
        </div>
      ) : (
        <TenantInbox tenantId={activeTenantId} tab={tab} onTab={setTab} />
      )}
    </div>
  );
}

function TenantInbox({ tenantId, tab, onTab }: { tenantId: string; tab: Tab; onTab: (t: Tab) => void }) {
  const appointments = useAsync<BotAppointment[]>(() => listAppointments(tenantId), [tenantId]);
  const orders = useAsync<BotOrder[]>(() => listOrders(tenantId), [tenantId]);
  const counts = openCounts(appointments.data, orders.data);

  return (
    <>
      <div className="border-b border-titanium-900 bg-obsidian-900 px-4">
        <nav className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Posteingang">
          <TabButton active={tab === 'conversations'} onClick={() => onTab('conversations')} icon={<MessageSquare className="h-3.5 w-3.5" />} label="Anfragen" />
          <TabButton active={tab === 'appointments'} onClick={() => onTab('appointments')} icon={<CalendarClock className="h-3.5 w-3.5" />} label="Terminwünsche" count={counts.appointments} countLabel="offen" />
          <TabButton active={tab === 'orders'} onClick={() => onTab('orders')} icon={<ShoppingCart className="h-3.5 w-3.5" />} label="Bestellungen" count={counts.orders} countLabel="neu" />
        </nav>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {tab === 'conversations' ? (
          <ConversationsPane tenantId={tenantId} appointments={appointments.data} onOpenAppointments={() => onTab('appointments')} />
        ) : tab === 'appointments' ? (
          <AppointmentsPane tenantId={tenantId} state={appointments} />
        ) : (
          <OrdersPane tenantId={tenantId} state={orders} />
        )}
      </div>
    </>
  );
}

function TabButton({ active, onClick, icon, label, count, countLabel }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number; countLabel?: string;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
        active ? 'border-security-500 text-titanium-50' : 'border-transparent text-titanium-500 hover:text-titanium-300'
      }`}
    >
      {icon} {label}
      {count !== undefined && count > 0 && (
        <span
          className="ml-1 border border-amber-500/50 px-1.5 py-px text-[9px] text-amber-400"
          aria-label={`${count} ${countLabel ?? ''}`.trim()}
        >
          {count}
        </span>
      )}
    </button>
  );
}

type AsyncState<T> = { data: T | null; loading: boolean; error: string | null; reload: () => void };

function useAsync<T>(loader: () => Promise<T>, deps: unknown[]): AsyncState<T> {
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

/**
 * Status-Änderung mit sichtbarem Fehler und Sperre gegen Doppelklicks.
 * Schlägt das Speichern fehl, bleibt der alte Status stehen und die Meldung
 * erscheint — nichts wird still verschluckt.
 */
function useStatusAction(reload: () => void) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const run = useCallback(async (id: string, action: () => Promise<void>) => {
    setPendingId(id); setActionError(null);
    try {
      await action();
      reload();
    } catch (e) {
      setActionError(`Status konnte nicht gespeichert werden: ${(e as Error).message}`);
    } finally {
      setPendingId(null);
    }
  }, [reload]);
  return { pendingId, actionError, run };
}

function ConversationsPane({ tenantId, appointments, onOpenAppointments }: {
  tenantId: string; appointments: BotAppointment[] | null; onOpenAppointments: () => void;
}) {
  const { data: convos, loading, error } = useAsync<BotConversation[]>(() => listConversations(tenantId), [tenantId]);
  const [selected, setSelected] = useState<string | null>(null);

  if (loading) return <p className="font-mono text-xs text-titanium-500">Lade…</p>;
  if (error) return <ErrorBox msg={error} />;
  if (!convos || convos.length === 0) {
    return <EmptyBox msg="Noch keine Anfragen. Sobald ein Assistent ein Gespräch führt, erscheint es hier." />;
  }

  const selectedConvo = convos.find((c) => c.id === selected) ?? null;
  const prioritizedConvos = sortConversationsForReview(convos, appointments);

  return (
    <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
      <div className="space-y-1">
        {prioritizedConvos.map((c) => {
          const review = nextHumanReview(c, appointments);
          return (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              aria-pressed={selected === c.id}
              className={`w-full border px-3 py-2 text-left transition-colors ${
                selected === c.id ? 'border-security-500 bg-obsidian-800' : 'border-titanium-800 hover:border-titanium-600'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-titanium-200">{contactLabel(c)}</span>
                <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-titanium-600">{channelLabel(c.channel)}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-titanium-600">{fmt(c.last_message_at)}</span>
                {review.kind !== 'none' && (
                  <span className="font-mono text-[9px] uppercase tracking-wider text-amber-400">{review.label}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div>
        {selectedConvo ? (
          <div className="space-y-4">
            <RequestCard
              conversation={selectedConvo}
              appointments={appointmentsForConversation(appointments, selectedConvo.id)}
              review={nextHumanReview(selectedConvo, appointments)}
              onOpenAppointments={onOpenAppointments}
            />
            <MessageThread tenantId={tenantId} conversationId={selectedConvo.id} />
          </div>
        ) : (
          <EmptyBox msg="Anfrage auswählen." />
        )}
      </div>
    </div>
  );
}

/** Kopf einer Anfrage: Kontakt, Kanal, Status und daraus entstandene Terminwünsche. */
function RequestCard({ conversation, appointments, review, onOpenAppointments }: {
  conversation: BotConversation; appointments: BotAppointment[];
  review: ReturnType<typeof nextHumanReview>; onOpenAppointments: () => void;
}) {
  return (
    <section aria-label="Anfrage" className="border border-titanium-800 bg-obsidian-900 px-4 py-3">
      <div className="grid gap-3 text-[11px] sm:grid-cols-3">
        <Field label="Kontakt" value={contactLabel(conversation)} />
        <Field label="Kanal" value={channelLabel(conversation.channel)} />
        <div>
          <p className="font-mono text-[9px] uppercase tracking-wider text-titanium-600">Status</p>
          <StatusChip status={conversation.status} label={conversationStatusLabel(conversation.status)} />
        </div>
      </div>

      <div className="mt-3 border-t border-titanium-900 pt-3" aria-label="Nächster menschlicher Prüfschritt">
        <p className="font-mono text-[9px] uppercase tracking-wider text-titanium-600">Nächster Prüfschritt</p>
        <p className="mt-1 text-xs text-titanium-200">{review.label}</p>
        <p className="mt-1 text-[11px] text-titanium-500">{review.explanation}</p>
      </div>

      <div className="mt-3 border-t border-titanium-900 pt-3">
        <p className="font-mono text-[9px] uppercase tracking-wider text-titanium-600">Terminwunsch</p>
        {appointments.length === 0 ? (
          <p className="mt-1 text-xs text-titanium-500">Kein Terminwunsch aus dieser Anfrage.</p>
        ) : (
          <ul className="mt-1 space-y-1.5">
            {appointments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-titanium-200">
                  {fmt(a.requested_at)}{a.service ? ` · ${a.service}` : ''}{a.contact ? ` · ${a.contact}` : ''}
                </span>
                <StatusChip status={a.status} label={appointmentStatusLabel(a.status)} />
              </li>
            ))}
          </ul>
        )}
        {appointments.some((a) => a.status === 'requested') && (
          <button
            onClick={onOpenAppointments}
            className="mt-2 font-mono text-[10px] uppercase tracking-wider text-security-400 hover:text-security-300"
          >
            Zu den offenen Terminwünschen →
          </button>
        )}
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[9px] uppercase tracking-wider text-titanium-600">{label}</p>
      <p className="truncate text-titanium-200">{value}</p>
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
            {m.role === 'assistant' ? 'Assistent' : m.role === 'user' ? 'Kunde' : 'System'} · {fmt(m.created_at)}
          </p>
          <p className="whitespace-pre-wrap text-sm text-titanium-100">{m.content}</p>
        </div>
      ))}
    </div>
  );
}

function AppointmentsPane({ tenantId, state }: { tenantId: string; state: AsyncState<BotAppointment[]> }) {
  const { data, loading, error, reload } = state;
  const { pendingId, actionError, run } = useStatusAction(reload);

  if (loading && !data) return <p className="font-mono text-xs text-titanium-500">Lade…</p>;
  if (error) return <ErrorBox msg={error} />;
  if (!data || data.length === 0) return <EmptyBox msg="Keine Terminwünsche." />;
  return (
    <div className="space-y-3">
      <p className="border border-titanium-800 bg-obsidian-900 px-4 py-2 text-xs text-titanium-400">
        Der Assistent nimmt Terminwünsche nur auf. „Als bestätigt markieren“ ändert den Status hier im Posteingang –
        der Kunde wird dadurch nicht automatisch benachrichtigt. Markiere einen Termin erst, wenn er in deinem
        Kalender steht und dem Kunden zugesagt ist.
      </p>
      {actionError && <ErrorBox msg={actionError} />}
      {sortAppointmentsOpenFirst(data).map((a) => {
        const busy = pendingId === a.id;
        return (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 border border-titanium-800 px-4 py-3">
            <div>
              <p className="text-sm text-titanium-100">{a.customer_name}{a.service ? ` · ${a.service}` : ''}</p>
              <p className="font-mono text-[10px] text-titanium-500">
                Wunsch: {fmt(a.requested_at)}{a.contact ? ` · ${a.contact}` : ''}
              </p>
              {a.notes && <p className="mt-1 text-xs text-titanium-400">{a.notes}</p>}
            </div>
            <div className="flex items-center gap-2">
              <StatusChip status={a.status} label={appointmentStatusLabel(a.status)} />
              {a.status === 'requested' && (
                <>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(a.id, () => setAppointmentStatus(tenantId, a.id, 'confirmed'))}>
                    {busy ? 'Speichere…' : 'Als bestätigt markieren'}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(a.id, () => setAppointmentStatus(tenantId, a.id, 'cancelled'))}>
                    Ablehnen
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OrdersPane({ tenantId, state }: { tenantId: string; state: AsyncState<BotOrder[]> }) {
  const { data, loading, error, reload } = state;
  const { pendingId, actionError, run } = useStatusAction(reload);
  function setStatus(id: string, status: BotOrder['status']) {
    void run(id, () => setOrderStatus(tenantId, id, status));
  }
  if (loading && !data) return <p className="font-mono text-xs text-titanium-500">Lade…</p>;
  if (error) return <ErrorBox msg={error} />;
  if (!data || data.length === 0) return <EmptyBox msg="Keine Bestellungen." />;
  return (
    <div className="space-y-2">
      {actionError && <ErrorBox msg={actionError} />}
      {data.map((o) => {
        const busy = pendingId === o.id;
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
                <StatusChip status={o.status} label={orderStatusLabel(o.status)} />
                {o.status === 'new' && (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => setStatus(o.id, 'confirmed')}>
                    {isRestaurant ? 'Intern bestätigen' : 'Bestätigen'}
                  </Button>
                )}
                {(o.status === 'new' || o.status === 'confirmed') && (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setStatus(o.id, 'fulfilled')}>Erfüllt</Button>
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

function StatusChip({ status, label }: { status: string; label?: string }) {
  const tone = statusTone(status);
  const cls = tone === 'done'
    ? 'text-emerald-400 border-emerald-500/40'
    : tone === 'closed'
      ? 'text-titanium-500 border-titanium-800'
      : 'text-amber-400 border-amber-500/40';
  return <span className={`inline-block border px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${cls}`}>{label ?? status}</span>;
}

function ErrorBox({ msg }: { msg: string }) {
  return <div role="alert" className="border border-risk-critical/40 bg-risk-critical/5 px-4 py-3 text-xs text-risk-critical">{msg}</div>;
}
function EmptyBox({ msg }: { msg: string }) {
  return <p className="font-mono text-xs text-titanium-500">{msg}</p>;
}
