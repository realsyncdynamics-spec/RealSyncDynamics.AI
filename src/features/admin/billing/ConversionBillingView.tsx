import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CreditCard,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { getSupabase } from '../../../lib/supabase';
import { getConversionBillingFixture } from './conversionFixture';
import { loadConversionBilling } from './loadConversionBilling';
import { checkoutPathForPlan, openPortalForTenant } from './recheckoutActions';
import type {
  ConversionBillingSnapshot,
  ConversionOpenInvoiceRow,
  ConversionSubscriptionRow,
} from './conversionTypes';
import { formatEurFromCents, shortId } from './conversionTypes';

function wantsFixturePreview(): boolean {
  return typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('fixture') === '1';
}

export function ConversionBillingView() {
  // DEV-only: allow /admin/billing?fixture=1 without AuthGate so ops can
  // verify the Growth 249 € stub panels locally without a super_admin session.
  if (import.meta.env.DEV && wantsFixturePreview()) {
    return <Inner session={null} forceFixture />;
  }
  return <AuthGate>{(session) => <Inner session={session} />}</AuthGate>;
}

function Inner({
  session,
  forceFixture = false,
}: {
  session: Session | null;
  forceFixture?: boolean;
}) {
  const [allowed, setAllowed] = useState<boolean | null>(forceFixture ? true : null);
  const [snapshot, setSnapshot] = useState<ConversionBillingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    if (forceFixture) {
      void load();
      return;
    }
    if (!session) {
      setAllowed(false);
      setLoading(false);
      return;
    }
    const sb = getSupabase();
    (async () => {
      const { data: prof } = await sb
        .from('profiles')
        .select('is_super_admin')
        .eq('id', session.user.id)
        .maybeSingle();
      const isAdmin = !!prof?.is_super_admin;
      setAllowed(isAdmin);
      if (isAdmin) await load();
      else setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, forceFixture]);

  async function load() {
    setLoading(true);
    setError(null);
    setActionError(null);
    try {
      const useFixture = forceFixture || wantsFixturePreview();
      const data = useFixture
        ? getConversionBillingFixture()
        : await loadConversionBilling({ includeFixtureFallback: true });
      setSnapshot(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const onPortal = useCallback(async (tenantId: string | null, key: string) => {
    if (!tenantId) {
      setActionError('Kein tenant_id — Portal benötigt Tenant-Membership + stripe_customer_id.');
      return;
    }
    setBusyKey(key);
    setActionError(null);
    const result = await openPortalForTenant(tenantId);
    setBusyKey(null);
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    window.location.href = result.url;
  }, []);

  if (allowed === false) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
          <h1 className="font-display font-bold text-2xl text-titanium-50 mb-2">Zugriff verweigert</h1>
          <p className="text-sm text-titanium-300 mb-4">/admin/billing erfordert super_admin-Rechte.</p>
          <Link to="/" className="text-security-400 hover:underline text-sm">← Zurück zur Startseite</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/admin" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-rose-600 to-orange-700 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">
                Conversion — Failed / Open
              </div>
              <div className="text-[11px] text-titanium-400 font-medium">
                Anzeige + Re-Checkout Redirect · keine Zahlungslogik
              </div>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-xs rounded-none disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        {actionError && (
          <div className="flex items-start gap-2 text-sm text-amber-200 bg-amber-950/40 border border-amber-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Re-Checkout</p>
              <p className="text-xs mt-0.5 text-amber-200/90">{actionError}</p>
              <p className="text-[11px] mt-1 text-titanium-400 font-mono">
                stripe-portal verlangt owner/admin Membership im Tenant. Sonst Stripe Dashboard nutzen.
              </p>
            </div>
          </div>
        )}

        {loading && !snapshot ? (
          <div className="flex items-center justify-center gap-3 py-20 text-titanium-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Lade Conversion-Daten …
          </div>
        ) : snapshot ? (
          <>
            <KpiStrip snapshot={snapshot} />

            <section className="space-y-2">
              <SectionTitle
                title="1 · Admin Status"
                hint="Highlight: canceled+payment_failed · incomplete/incomplete_expired · past_due"
              />
              <StatusTable
                rows={snapshot.status_rows}
                busyKey={busyKey}
                onPortal={onPortal}
              />
            </section>

            <section className="space-y-2">
              <SectionTitle
                title="2 · Failed / Open Invoices"
                hint="Open invoices + payment_failed Subs — Re-Checkout CTA"
              />
              <OpenInvoiceTable
                rows={snapshot.open_invoices}
                statusRows={snapshot.status_rows}
                busyKey={busyKey}
                onPortal={onPortal}
              />
            </section>

            <section className="space-y-2">
              <SectionTitle
                title="3 · Re-Checkout Hinweis"
                hint="Keine Payment-Capture · bestehende Portal-/Checkout-Pfade"
              />
              <RecheckoutHints />
            </section>
          </>
        ) : null}

        <div className="flex flex-wrap gap-2 text-xs pt-2">
          <Link to="/admin/customers" className="px-3 py-1.5 bg-obsidian-900 border border-titanium-700 hover:border-security-500 text-titanium-200 rounded-none">
            → Customers
          </Link>
          <Link to="/dashboard/business" className="px-3 py-1.5 bg-obsidian-900 border border-titanium-700 hover:border-security-500 text-titanium-200 rounded-none">
            → Business Dashboard
          </Link>
          <Link to="/admin/system" className="px-3 py-1.5 bg-obsidian-900 border border-titanium-700 hover:border-security-500 text-titanium-200 rounded-none">
            → System Health
          </Link>
          <a
            href="https://dashboard.stripe.com/invoices?status=open"
            target="_blank"
            rel="noreferrer noopener"
            className="px-3 py-1.5 bg-obsidian-900 border border-titanium-700 hover:border-security-500 text-titanium-200 rounded-none inline-flex items-center gap-1"
          >
            Stripe Open Invoices <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </main>
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h2 className="font-display font-bold text-sm text-titanium-50">{title}</h2>
      <p className="text-[11px] text-titanium-500 font-mono mt-0.5">{hint}</p>
    </div>
  );
}

function KpiStrip({ snapshot }: { snapshot: ConversionBillingSnapshot }) {
  const failed = snapshot.status_rows.filter(
    (r) => r.cancel_reason === 'payment_failed' || r.status === 'past_due',
  ).length;
  const incomplete = snapshot.status_rows.filter(
    (r) => r.status === 'incomplete' || r.status === 'incomplete_expired',
  ).length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-titanium-500 font-mono">
        <span>source={snapshot.source}</span>
        <span>·</span>
        <span>{snapshot.generated_at}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Offene Rechnungen" value={`${snapshot.open_invoices_amount_eur.toFixed(0)} €`} accent danger />
        <Kpi label="Open Count" value={snapshot.open_invoices_count} danger />
        <Kpi label="payment_failed / past_due" value={failed} danger={failed > 0} />
        <Kpi label="incomplete*" value={incomplete} />
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
  danger,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
  danger?: boolean;
}) {
  const border = danger
    ? 'border-rose-900 bg-rose-950/20'
    : accent
      ? 'border-emerald-900 bg-emerald-950/20'
      : 'border-titanium-900 bg-obsidian-900';
  const text = danger ? 'text-rose-300' : accent ? 'text-emerald-300' : 'text-titanium-50';
  return (
    <div className={`p-3 border ${border} rounded-none`}>
      <div className="text-[11px] uppercase tracking-wider text-titanium-500 mb-1">{label}</div>
      <div className={`text-2xl font-display font-bold tabular-nums ${text}`}>{value}</div>
    </div>
  );
}

function StatusTable({
  rows,
  busyKey,
  onPortal,
}: {
  rows: ConversionSubscriptionRow[];
  busyKey: string | null;
  onPortal: (tenantId: string | null, key: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-titanium-500 border border-titanium-900 bg-obsidian-900 rounded-none">
        Keine Conversion-Status-Zeilen (canceled+payment_failed / incomplete* / past_due).
      </div>
    );
  }

  return (
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-obsidian-950 text-titanium-400 uppercase tracking-wider">
          <tr>
            <th className="text-left px-3 py-2.5">subscription_id</th>
            <th className="text-left px-3 py-2.5">status</th>
            <th className="text-left px-3 py-2.5">plan_key</th>
            <th className="text-left px-3 py-2.5 hidden md:table-cell">cancel_reason</th>
            <th className="text-left px-3 py-2.5 hidden lg:table-cell">period_end</th>
            <th className="text-left px-3 py-2.5 hidden lg:table-cell">customer_id</th>
            <th className="text-left px-3 py-2.5 hidden xl:table-cell">tenant_id</th>
            <th className="text-right px-3 py-2.5">amount</th>
            <th className="text-left px-3 py-2.5 hidden md:table-cell">invoice</th>
            <th className="text-left px-3 py-2.5">CTA</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-titanium-900">
          {rows.map((row) => {
            const highlight =
              row.cancel_reason === 'payment_failed'
              || row.status === 'past_due'
              || row.status === 'incomplete'
              || row.status === 'incomplete_expired';
            const key = `sub:${row.subscription_id}`;
            return (
              <tr
                key={row.subscription_id}
                className={highlight ? 'bg-rose-950/15 hover:bg-rose-950/25' : 'hover:bg-obsidian-950'}
              >
                <td className="px-3 py-2.5 font-mono text-[10px] text-titanium-300">
                  {shortId(row.subscription_id, 14)}
                </td>
                <td className="px-3 py-2.5">
                  <StatusChip status={row.status} />
                </td>
                <td className="px-3 py-2.5 font-mono text-titanium-200 uppercase text-[10px]">
                  {row.plan_key ?? '—'}
                </td>
                <td className="px-3 py-2.5 hidden md:table-cell font-mono text-[10px] text-rose-300">
                  {row.cancel_reason ?? '—'}
                </td>
                <td className="px-3 py-2.5 hidden lg:table-cell text-titanium-400 text-[11px]">
                  {row.current_period_end
                    ? new Date(row.current_period_end).toLocaleDateString('de-DE')
                    : '—'}
                </td>
                <td className="px-3 py-2.5 hidden lg:table-cell font-mono text-[10px] text-titanium-500">
                  {row.customer_id ? (
                    <a
                      href={`https://dashboard.stripe.com/customers/${row.customer_id}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-security-400 hover:underline inline-flex items-center gap-1"
                    >
                      {shortId(row.customer_id, 10)}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  ) : '—'}
                </td>
                <td className="px-3 py-2.5 hidden xl:table-cell font-mono text-[10px] text-titanium-500">
                  {shortId(row.tenant_id, 8)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-mono text-titanium-100">
                  {formatEurFromCents(row.unit_amount_cents, row.currency ?? 'eur')}
                </td>
                <td className="px-3 py-2.5 hidden md:table-cell font-mono text-[10px] text-titanium-400">
                  {row.latest_invoice_status ?? '—'}
                </td>
                <td className="px-3 py-2.5">
                  <RecheckoutButton
                    mode={row.recheckout}
                    planKey={row.plan_key}
                    tenantId={row.tenant_id}
                    customerId={row.customer_id}
                    busy={busyKey === key}
                    onPortal={() => onPortal(row.tenant_id, key)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OpenInvoiceTable({
  rows,
  statusRows,
  busyKey,
  onPortal,
}: {
  rows: ConversionOpenInvoiceRow[];
  statusRows: ConversionSubscriptionRow[];
  busyKey: string | null;
  onPortal: (tenantId: string | null, key: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-titanium-500 border border-titanium-900 bg-obsidian-900 rounded-none">
        Keine offenen Rechnungen.
      </div>
    );
  }

  const subById = new Map(statusRows.map((s) => [s.subscription_id, s]));

  return (
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-obsidian-950 text-titanium-400 uppercase tracking-wider">
          <tr>
            <th className="text-left px-3 py-2.5">invoice_id</th>
            <th className="text-right px-3 py-2.5">amount_due</th>
            <th className="text-right px-3 py-2.5">attempts</th>
            <th className="text-left px-3 py-2.5 hidden md:table-cell">customer_email</th>
            <th className="text-left px-3 py-2.5">plan_key</th>
            <th className="text-left px-3 py-2.5 hidden lg:table-cell">subscription_id</th>
            <th className="text-left px-3 py-2.5 hidden xl:table-cell">tenant_id</th>
            <th className="text-left px-3 py-2.5">Re-Checkout</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-titanium-900">
          {rows.map((row) => {
            const sub = row.subscription_id ? subById.get(row.subscription_id) : undefined;
            const mode = sub?.recheckout
              ?? (row.customer_id ? 'portal' as const : 'new_checkout' as const);
            const key = `inv:${row.invoice_id}`;
            const isGrowthFail =
              row.amount_due_cents === 24900 && row.plan_key === 'growth';
            return (
              <tr
                key={row.invoice_id}
                className={isGrowthFail ? 'bg-rose-950/20 hover:bg-rose-950/30' : 'hover:bg-obsidian-950'}
              >
                <td className="px-3 py-2.5 font-mono text-[10px] text-titanium-300">
                  <a
                    href={`https://dashboard.stripe.com/invoices/${row.invoice_id}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-security-400 hover:underline inline-flex items-center gap-1"
                  >
                    {shortId(row.invoice_id, 14)}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-mono font-bold text-rose-200">
                  {formatEurFromCents(row.amount_due_cents, row.currency)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-mono text-amber-300">
                  {row.attempt_count}
                </td>
                <td className="px-3 py-2.5 hidden md:table-cell text-titanium-300">
                  {row.customer_email
                    ? <a href={`mailto:${row.customer_email}`} className="hover:text-security-400">{row.customer_email}</a>
                    : '—'}
                </td>
                <td className="px-3 py-2.5 font-mono text-[10px] uppercase text-titanium-200">
                  {row.plan_key ?? '—'}
                </td>
                <td className="px-3 py-2.5 hidden lg:table-cell font-mono text-[10px] text-titanium-500">
                  {shortId(row.subscription_id, 14)}
                </td>
                <td className="px-3 py-2.5 hidden xl:table-cell font-mono text-[10px] text-titanium-500">
                  {shortId(row.tenant_id, 8)}
                </td>
                <td className="px-3 py-2.5">
                  <RecheckoutButton
                    mode={mode}
                    planKey={row.plan_key}
                    tenantId={row.tenant_id}
                    customerId={row.customer_id}
                    busy={busyKey === key}
                    onPortal={() => onPortal(row.tenant_id, key)}
                    portalLabel="Zahlungsmethode aktualisieren"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RecheckoutButton({
  mode,
  planKey,
  tenantId,
  customerId,
  busy,
  onPortal,
  portalLabel = 'Zahlung fehlgeschlagen — Zahlungsmethode aktualisieren',
}: {
  mode: 'portal' | 'new_checkout';
  planKey: string | null;
  tenantId: string | null;
  customerId: string | null;
  busy: boolean;
  onPortal: () => void;
  portalLabel?: string;
}) {
  if (mode === 'new_checkout') {
    return (
      <Link
        to={checkoutPathForPlan(planKey)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-security-500 hover:bg-security-400 text-white text-[10px] font-bold uppercase tracking-wider rounded-none"
      >
        <RotateCcw className="h-3 w-3" />
        Checkout erneut starten
      </Link>
    );
  }

  if (!customerId) {
    return (
      <span className="text-[10px] text-titanium-500 font-mono">kein stripe_customer_id</span>
    );
  }

  return (
    <button
      type="button"
      disabled={busy || !tenantId}
      onClick={onPortal}
      title={!tenantId ? 'tenant_id fehlt' : portalLabel}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-obsidian-950 border border-rose-700 hover:border-rose-500 text-rose-200 text-[10px] font-bold uppercase tracking-wider rounded-none disabled:opacity-50 max-w-[14rem] text-left leading-tight"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin shrink-0" /> : <CreditCard className="h-3 w-3 shrink-0" />}
      {portalLabel}
    </button>
  );
}

function StatusChip({ status }: { status: string }) {
  const colors: Record<string, string> = {
    past_due: 'border-orange-900 bg-orange-950/30 text-orange-300',
    canceled: 'border-red-900 bg-red-950/30 text-red-300',
    incomplete: 'border-amber-900 bg-amber-950/30 text-amber-300',
    incomplete_expired: 'border-amber-900 bg-amber-950/40 text-amber-200',
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 border ${colors[status] ?? 'border-titanium-800 text-titanium-300'} text-[10px] font-bold uppercase tracking-wider rounded-none font-mono`}
    >
      {status}
    </span>
  );
}

function RecheckoutHints() {
  return (
    <div className="border border-titanium-900 bg-obsidian-900 rounded-none p-4 space-y-3 text-sm text-titanium-300">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="border border-titanium-800 p-3 rounded-none">
          <p className="font-semibold text-titanium-100 text-xs uppercase tracking-wider mb-1">
            Bestehendes Abo / Zahlungsmethode
          </p>
          <p className="text-xs leading-relaxed">
            Button ruft <code className="font-mono text-[11px] text-security-300">POST /functions/v1/stripe-portal</code> mit
            {' '}<code className="font-mono text-[11px]">tenant_id</code> auf (benötigt <code className="font-mono text-[11px]">stripe_customer_id</code>).
          </p>
          <p className="text-[11px] text-titanium-500 mt-2 font-mono">
            Copy: „Zahlung fehlgeschlagen — Zahlungsmethode aktualisieren“
          </p>
        </div>
        <div className="border border-titanium-800 p-3 rounded-none">
          <p className="font-semibold text-titanium-100 text-xs uppercase tracking-wider mb-1">
            Incomplete / neuer Versuch
          </p>
          <p className="text-xs leading-relaxed">
            Redirect auf bestehenden Checkout <code className="font-mono text-[11px] text-security-300">/checkout/:planKey</code>.
            Nach Return verifiziert <code className="font-mono text-[11px]">/checkout/success</code> optional via
            {' '}<code className="font-mono text-[11px]">POST /functions/v1/stripe-checkout-verify</code>.
          </p>
          <p className="text-[11px] text-titanium-500 mt-2 font-mono">
            Copy: „Checkout erneut starten“
          </p>
        </div>
      </div>
      <p className="text-[11px] text-titanium-500">
        Out of scope: Zahlungs-Capture, Price-Schreiben, Duplikat-Deaktivierung.
      </p>
    </div>
  );
}

export default ConversionBillingView;
