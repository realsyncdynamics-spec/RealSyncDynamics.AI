import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import './inbox-workspace.css';
import { ArrowLeft, Inbox, CalendarClock, ShoppingCart, MessageSquare, Link2 } from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { useAuth } from '../../lib/useAuth';
import { Button } from '../../enterprise-os/components/Button';
import {
  listInboxConversations, listIntakes, listConversationEvents, inboxTakeOver, inboxResolve,
  listMessages, listAppointments, listOrders,
  setAppointmentStatus, setOrderStatus,
} from './api';
import {
  ACTION_LABEL, INBOX_FILTERS, availableAction, canHandoff, channelLabel, conversationTitle,
  handoffNotice, isMissingSchemaError, rpcFeedback, statusLabel, statusTone, statusesForFilter, parseInboxWorkspaceTab,
  type InboxFilter, type InboxWorkspaceTab,
} from './inbox';
import { SiteInboxBindingsPanel } from './SiteInboxBindingsPanel';
import type {
  BotConversation, BotConversationEvent, BotConversationIntake, BotMessage, BotAppointment, BotOrder,
} from './types';

type Tab = InboxWorkspaceTab;

/**
 * /app/bots/inbox — Posteingang: Anfragen mit Übergabe an Menschen
 * (Neu → In Bearbeitung → Erledigt, PR C), Termine, Bestellungen und die
 * Zuordnung veröffentlichter Seiten zu einem Eingang.
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
  const { activeTenantId, tenants } = useTenant();
  const activeRole = tenants.find((t) => t.tenantId === activeTenantId)?.role ?? null;
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseInboxWorkspaceTab(searchParams.get('tab'));
  const setTab = (next: Tab) => setSearchParams((previous) => {
    const params = new URLSearchParams(previous);
    if (next === 'conversations') params.delete('tab');
    else params.set('tab', next);
    return params;
  }, { replace: true });

  return (
    <div className="rs-inbox-workspace min-h-screen text-titanium-100">
      <header className="rs-inbox-masthead border-b">
        <div className="mx-auto max-w-6xl px-4 pb-6 pt-5 sm:px-6 sm:pb-8 sm:pt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rs-inbox-kicker">REALSYNC DYNAMICS.AI / OPERATIONS</span>
            <div className="flex flex-wrap items-center gap-4 font-mono text-[11px]">
              <Link to="/app/websites" className="rs-inbox-subtle-link">Websites</Link>
              <Link to="/app/bots" className="rs-inbox-subtle-link inline-flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> KI-Mitarbeiter
              </Link>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="rs-inbox-kicker mb-2">GOVERNANCE WORKSPACE · HUMAN HANDOFF</p>
              <h1 className="rs-inbox-heading">Anfragen <span>&amp;</span> Seiten-Formulare</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#b9b9b6]">
                Ein gemeinsamer Arbeitsbereich für eingehende Anfragen, Team-Übergaben und die Zuordnung Ihrer SiteOS-Seiten.
              </p>
            </div>
            <span className="rs-inbox-preview-tag">Vorschau · keine Live-Freigabe</span>
          </div>
        </div>
      </header>

      <div className="rs-inbox-nav border-b">
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6" aria-label="Posteingang Navigation">
          <TabButton active={tab === 'conversations'} onClick={() => setTab('conversations')} icon={<MessageSquare className="h-3.5 w-3.5" />} label="Anfragen" />
          <TabButton active={tab === 'appointments'} onClick={() => setTab('appointments')} icon={<CalendarClock className="h-3.5 w-3.5" />} label="Termine" />
          <TabButton active={tab === 'orders'} onClick={() => setTab('orders')} icon={<ShoppingCart className="h-3.5 w-3.5" />} label="Bestellungen" />
          <TabButton active={tab === 'sites'} onClick={() => setTab('sites')} icon={<Link2 className="h-3.5 w-3.5" />} label="Seiten-Formulare" />
        </nav>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {!activeTenantId ? (
          <p className="font-mono text-xs text-titanium-500">Kein Tenant ausgewählt.</p>
        ) : tab === 'conversations' ? (
          <ConversationsPane tenantId={activeTenantId} role={activeRole} />
        ) : tab === 'appointments' ? (
          <AppointmentsPane tenantId={activeTenantId} />
        ) : tab === 'orders' ? (
          <OrdersPane tenantId={activeTenantId} />
        ) : (
          <SiteInboxBindingsPanel tenantId={activeTenantId} role={activeRole} />
        )}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
        active ? 'border-[#d6ae52] text-[#f4f4f2]' : 'border-transparent text-[#8a8a88] hover:text-[#f4f4f2]'
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

interface InboxData {
  convos: BotConversation[];
  intakes: Map<string, BotConversationIntake>;
  /** false, solange die Migrationen aus PR C nicht angewendet sind. */
  handoffAvailable: boolean;
}

async function loadInbox(tenantId: string, filter: InboxFilter): Promise<InboxData> {
  const convos = await listInboxConversations(tenantId, statusesForFilter(filter));
  try {
    const rows = await listIntakes(tenantId, convos.map((c) => c.id));
    return { convos, intakes: new Map(rows.map((r) => [r.conversation_id, r])), handoffAvailable: true };
  } catch (e) {
    if (isMissingSchemaError((e as Error).message)) {
      return { convos, intakes: new Map(), handoffAvailable: false };
    }
    throw e;
  }
}

function ConversationsPane({ tenantId, role }: { tenantId: string; role: string | null }) {
  const { user } = useAuth();
  const mayHandoff = canHandoff(role);
  const [filter, setFilter] = useState<InboxFilter>('aktiv');
  const { data, loading, error, reload } = useAsync<InboxData>(() => loadInbox(tenantId, filter), [tenantId, filter]);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const convos = data?.convos ?? [];
  const current = convos.find((c) => c.id === selected) ?? null;

  async function runAction(c: BotConversation) {
    const action = availableAction(c.status);
    if (!action || busy || !mayHandoff) return;
    setBusy(true); setFeedback(null);
    try {
      const result = action === 'take_over' ? await inboxTakeOver(c.id) : await inboxResolve(c.id);
      setFeedback(rpcFeedback(action, result));
    } catch (e) {
      setFeedback({ tone: 'error', text: (e as Error).message });
    } finally {
      setBusy(false);
      reload();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Status filtern">
        {INBOX_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => { setFilter(f.id); setSelected(null); setFeedback(null); }}
            className={`border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              filter === f.id ? 'border-security-500 text-titanium-50' : 'border-titanium-800 text-titanium-500 hover:text-titanium-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {data && !data.handoffAvailable && (
        <p className="border border-titanium-800 bg-obsidian-900 px-4 py-3 text-xs text-titanium-400">
          Übergabe an Menschen ist in diesem Arbeitsbereich noch nicht freigeschaltet. Konversationen sind lesbar;
          Übernehmen und Erledigen erscheinen, sobald die Funktion aktiv ist.
        </p>
      )}

      {feedback && <FeedbackBox tone={feedback.tone} text={feedback.text} />}

      {loading && !data ? (
        <p className="font-mono text-xs text-titanium-500">Lade…</p>
      ) : error ? (
        <ErrorBox msg={error} />
      ) : convos.length === 0 ? (
        <EmptyBox msg={filter === 'alle' ? 'Noch keine Konversationen.' : 'Keine Anfragen in diesem Status.'} />
      ) : (
        <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
          <ul className="space-y-1">
            {convos.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => { setSelected(c.id); setFeedback(null); }}
                  aria-current={selected === c.id ? 'true' : undefined}
                  className={`w-full border px-3 py-2 text-left transition-colors ${
                    selected === c.id ? 'border-security-500 bg-obsidian-800' : 'border-titanium-800 hover:border-titanium-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-titanium-200">
                      {conversationTitle(c, data?.intakes.get(c.id)?.kontakt_name)}
                    </span>
                    <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-titanium-600">{channelLabel(c.channel)}</span>
                  </div>
                  {handoffNotice(c.metadata) && (
                    <span className="mt-1 inline-block border border-amber-700/60 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                      Mensch angefragt
                    </span>
                  )}
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-titanium-600">{fmt(c.last_message_at ?? c.created_at)}</span>
                    <InboxStatusChip status={c.status} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <div>
            {current ? (
              <ConversationDetail
                tenantId={tenantId}
                conversation={current}
                intake={data?.intakes.get(current.id) ?? null}
                handoffAvailable={data?.handoffAvailable ?? false}
                mayHandoff={mayHandoff}
                currentUserId={user?.id ?? null}
                busy={busy}
                onAction={() => runAction(current)}
              />
            ) : (
              <EmptyBox msg="Anfrage auswählen." />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConversationDetail({
  tenantId, conversation: c, intake, handoffAvailable, mayHandoff, currentUserId, busy, onAction,
}: {
  tenantId: string;
  conversation: BotConversation;
  intake: BotConversationIntake | null;
  handoffAvailable: boolean;
  mayHandoff: boolean;
  currentUserId: string | null;
  busy: boolean;
  onAction: () => void;
}) {
  const handoffReason = handoffNotice(c.metadata);
  const nextAction = handoffAvailable ? availableAction(c.status) : null;
  const action = mayHandoff ? nextAction : null;
  const assignee = c.assigned_to
    ? (c.assigned_to === currentUserId ? 'Du' : 'Ein anderes Teammitglied')
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border border-titanium-800 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-titanium-100">{conversationTitle(c, intake?.kontakt_name)}</p>
          <p className="mt-1 font-mono text-[10px] text-titanium-500">
            {channelLabel(c.channel)} · eingegangen {fmt(c.created_at)}
            {assignee ? ` · zuständig: ${assignee}` : ''}
            {c.resolved_at ? ` · erledigt ${fmt(c.resolved_at)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <InboxStatusChip status={c.status} />
          {action && (
            <Button size="sm" variant={action === 'take_over' ? 'secondary' : 'ghost'} onClick={onAction} disabled={busy}>
              {busy ? 'Speichere…' : ACTION_LABEL[action]}
            </Button>
          )}
          {nextAction && !mayHandoff && (
            <span className="font-mono text-[10px] text-titanium-500" title="Übernehmen und Erledigen nur für Owner/Admin">
              nur lesend
            </span>
          )}
        </div>
      </div>

      {handoffReason && (
        <div role="note" className="border border-amber-700/50 bg-amber-900/10 px-4 py-3 text-sm text-amber-200">
          <p className="font-medium">
            {handoffReason === 'customer_request'
              ? 'Kunde wünscht einen Menschen oder Rückruf'
              : handoffReason === 'assistant_uncertain'
                ? 'Assistent empfiehlt menschliche Prüfung'
                : 'Menschliche Übergabe angefragt'}
          </p>
          <p className="mt-1 text-xs text-amber-100/80">
            Der Vermerk ist keine Zusage eines Rückrufs und keine bestätigte Terminbuchung.
            Maßgeblich bleibt der Bearbeitungsstatus der Anfrage.
          </p>
        </div>
      )}

      {intake && <IntakeCard intake={intake} />}

      {handoffAvailable && <EventTrail tenantId={tenantId} conversationId={c.id} currentUserId={currentUserId} status={c.status} />}

      {c.channel !== 'form' && <MessageThread tenantId={tenantId} conversationId={c.id} />}
    </div>
  );
}

function IntakeCard({ intake }: { intake: BotConversationIntake }) {
  return (
    <div className="border border-titanium-800 px-4 py-3">
      <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-titanium-600">Anfrage</p>
      {intake.anliegen && <p className="whitespace-pre-wrap text-sm text-titanium-100">{intake.anliegen}</p>}
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        {intake.kontakt_name && <IntakeField label="Name" value={intake.kontakt_name} />}
        {intake.kontakt_telefon && (
          <IntakeField label="Telefon" value={<a className="text-security-400 hover:underline" href={`tel:${intake.kontakt_telefon.replace(/[^0-9+]/g, '')}`}>{intake.kontakt_telefon}</a>} />
        )}
        {intake.kontakt_email && (
          <IntakeField label="E-Mail" value={<a className="break-all text-security-400 hover:underline" href={`mailto:${intake.kontakt_email}`}>{intake.kontakt_email}</a>} />
        )}
        {(intake.terminwunsch || intake.terminwunsch_zeit) && (
          <IntakeField
            label="Terminwunsch · nicht bestätigt"
            value={[intake.terminwunsch, intake.terminwunsch_zeit ? fmt(intake.terminwunsch_zeit) : null].filter(Boolean).join(' · ')}
          />
        )}
      </dl>
      {(intake.terminwunsch || intake.terminwunsch_zeit) && (
        <p className="mt-3 text-[11px] text-titanium-500">
          Der Terminwunsch ist nur ein Wunsch der anfragenden Person. Es wurde nichts gebucht oder zugesagt.
        </p>
      )}
    </div>
  );
}

function IntakeField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-wider text-titanium-600">{label}</dt>
      <dd className="mt-0.5 text-titanium-200">{value}</dd>
    </div>
  );
}

function EventTrail({ tenantId, conversationId, currentUserId, status }: { tenantId: string; conversationId: string; currentUserId: string | null; status: string }) {
  // `status` als Abhängigkeit: Nach Übernehmen/Erledigen neu laden.
  const { data, error } = useAsync<BotConversationEvent[]>(() => listConversationEvents(tenantId, conversationId), [tenantId, conversationId, status]);
  if (error) return null;
  if (!data || data.length === 0) return null;
  return (
    <div className="border border-titanium-800 px-4 py-3">
      <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-titanium-600">Prüfpfad</p>
      <ol className="space-y-1 font-mono text-[11px] text-titanium-400">
        {data.map((ev) => (
          <li key={ev.id}>
            {fmt(ev.created_at)} · {ev.event === 'taken_over' ? 'übernommen' : 'erledigt'} · {statusLabel(ev.from_status)} → {statusLabel(ev.to_status)}
            {ev.actor_id ? ` · ${ev.actor_id === currentUserId ? 'du' : 'Teammitglied'}` : ''}
          </li>
        ))}
      </ol>
    </div>
  );
}

function InboxStatusChip({ status }: { status: string }) {
  const tone = statusTone(status);
  const cls = tone === 'attention'
    ? 'text-amber-400 border-amber-500/40'
    : tone === 'progress'
      ? 'text-sky-400 border-sky-500/40'
      : tone === 'done'
        ? 'text-emerald-400 border-emerald-500/40'
        : 'text-titanium-600 border-titanium-800';
  return <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${cls}`}>{statusLabel(status)}</span>;
}

function FeedbackBox({ tone, text }: { tone: 'ok' | 'warn' | 'error'; text: string }) {
  const cls = tone === 'ok'
    ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-300'
    : tone === 'warn'
      ? 'border-amber-500/40 bg-amber-500/5 text-amber-300'
      : 'border-risk-critical/40 bg-risk-critical/5 text-risk-critical';
  return <div role="status" className={`border px-4 py-3 text-xs ${cls}`}>{text}</div>;
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
