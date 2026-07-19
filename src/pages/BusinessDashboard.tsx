import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { SEOHead } from '../components/SEOHead';
import { AuthGate } from '../features/kodee/connections/AuthGate';
import { getSupabase } from '../lib/supabase';
import {
  type BusinessMetricsSnapshot,
  type PlanDistributionEntry,
  type RecentFailedPaymentEntry,
  type RecentPaymentEntry,
} from '../lib/business/metrics';

type Range = '7d' | '30d' | '90d';

interface SnapshotRow extends BusinessMetricsSnapshot {
  captured_at: string;
  duration_ms: number | null;
}

interface TimeseriesRow {
  day: string;
  currency: string;
  mrr_cents: number;
  paid_invoice_cents: number;
  failed_invoice_cents: number;
  new_subscriptions: number;
  churned_subscriptions: number;
}

const RANGE_LABEL: Record<Range, string> = {
  '7d': 'Letzte 7 Tage',
  '30d': 'Letzte 30 Tage',
  '90d': 'Letzte 90 Tage',
};

const FORMAT_EUR = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const FORMAT_NUM = new Intl.NumberFormat('de-DE');

function eur(cents: number): string {
  return FORMAT_EUR.format(Math.round(cents / 100));
}

export function BusinessDashboard() {
  return <AuthGate>{(session) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }: { session: Session }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotRow | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesRow[]>([]);
  const [range, setRange] = useState<Range>('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    (async () => {
      const { data: prof, error: profErr } = await sb
        .from('profiles')
        .select('is_super_admin')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profErr) {
        setError(profErr.message);
        setAllowed(false);
        setLoading(false);
        return;
      }

      const isAdmin = !!prof?.is_super_admin;
      setAllowed(isAdmin);
      if (!isAdmin) {
        setLoading(false);
        return;
      }
      await loadData();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const sb = getSupabase();

      const [snapRes, tsRes] = await Promise.all([
        sb.from('business_metric_snapshots')
          .select('*')
          .order('captured_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        sb.from('business_revenue_timeseries')
          .select('*')
          .eq('currency', 'eur')
          .gte('day', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
          .order('day', { ascending: true }),
      ]);

      if (snapRes.error) throw snapRes.error;
      if (tsRes.error) throw tsRes.error;

      setSnapshot((snapRes.data as SnapshotRow | null) ?? null);
      setTimeseries((tsRes.data as TimeseriesRow[] | null) ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const rangedSeries = useMemo(() => {
    if (timeseries.length === 0) return [];
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    return timeseries.slice(-days);
  }, [timeseries, range]);

  const chartSeries = useMemo(
    () =>
      rangedSeries.map((row) => ({
        label: row.day.slice(5),
        mrr: Math.round(row.mrr_cents / 100),
        new_subs: row.new_subscriptions,
        churn_subs: row.churned_subscriptions,
        paid: Math.round(row.paid_invoice_cents / 100),
        failed: Math.round(row.failed_invoice_cents / 100),
      })),
    [rangedSeries],
  );

  if (allowed === false) {
    return <AccessDenied />;
  }

  if (allowed === null || loading) {
    return (
      <div className="min-h-screen bg-[#05070d] text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Lade Business-Metriken …</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Business Dashboard | RealSync Dynamics"
        description="Business overview: MRR, ARR, active customers, churn, failed payments and recent activity."
        canonical="/dashboard/business"
        noIndex
      />
      <main className="min-h-screen bg-[#05070d] px-6 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <Header
            range={range}
            onRangeChange={setRange}
            capturedAt={snapshot?.captured_at ?? null}
            error={error}
          />

          {!snapshot ? (
            <EmptyState />
          ) : (
            <DashboardBody
              snapshot={snapshot}
              chartSeries={chartSeries}
              range={range}
            />
          )}
        </div>
      </main>
    </>
  );
}

function Header({
  range,
  onRangeChange,
  capturedAt,
  error,
}: {
  range: Range;
  onRangeChange: (r: Range) => void;
  capturedAt: string | null;
  error: string | null;
}) {
  return (
    <>
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <div className="mb-4 inline-flex rounded-full border border-[#d4af37]/40 bg-[#d4af37]/10 px-4 py-2 text-sm text-[#d4af37]">
            Business Dashboard
          </div>
          <h1 className="text-4xl font-semibold tracking-tight">Revenue, Customers &amp; Health</h1>
          <p className="mt-3 max-w-3xl text-zinc-400">
            Live-Aggregation aus Stripe (über Webhook in Supabase) und der business-metrics-cron Edge-Function.
            {capturedAt && (
              <>
                {' '}
                Snapshot: <span className="text-zinc-200">{new Date(capturedAt).toLocaleString('de-DE')}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          <RangeTabs value={range} onChange={onRangeChange} />
          <div className="flex gap-2">
            <Link
              to="/dashboard/agents"
              className="rounded-2xl border border-violet-700/50 px-4 py-2 text-sm text-violet-200 hover:text-white hover:border-violet-500/80"
            >
              Agent OS · Live
            </Link>
            <Link
              to="/billing/usage"
              className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:text-white"
            >
              Zur Usage &amp; Billing
            </Link>
          </div>
        </div>
      </div>
      {error && (
        <div className="mt-6 flex items-start gap-2 rounded-2xl border border-rose-900/60 bg-rose-950/40 p-4 text-sm text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}
    </>
  );
}

function DashboardBody({
  snapshot,
  chartSeries,
  range,
}: {
  snapshot: SnapshotRow;
  chartSeries: ReturnType<typeof useMemo<Array<{ label: string; mrr: number; new_subs: number; churn_subs: number; paid: number; failed: number }>>>;
  range: Range;
}) {
  const startMrr = chartSeries[0]?.mrr ?? 0;
  const currentMrr = chartSeries.at(-1)?.mrr ?? Math.round(snapshot.mrr_cents / 100);
  const mrrDeltaPct = startMrr > 0 ? ((currentMrr - startMrr) / startMrr) * 100 : 0;
  const totalNew = chartSeries.reduce((s, p) => s + p.new_subs, 0);
  const totalChurn = chartSeries.reduce((s, p) => s + p.churn_subs, 0);

  return (
    <>
      <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Monthly Recurring Revenue"
          value={eur(snapshot.mrr_cents)}
          delta={{ value: `${mrrDeltaPct.toFixed(1)}%`, positive: mrrDeltaPct >= 0 }}
          hint="vs. Periodenanfang"
        />
        <KpiCard
          label="Annual Run Rate"
          value={eur(snapshot.arr_cents)}
          delta={{ value: 'MRR × 12', positive: true }}
          hint="Hochrechnung aus heutigem MRR"
        />
        <KpiCard
          label="Net New MRR (30T)"
          value={eur(snapshot.net_new_mrr_cents_30d)}
          delta={{
            value: `${FORMAT_NUM.format(snapshot.churned_subscriptions_30d)} Churn`,
            positive: snapshot.net_new_mrr_cents_30d >= 0,
          }}
          hint={`${FORMAT_NUM.format(snapshot.trial_users)} Trial-User aktiv`}
        />
        <KpiCard
          label="Aktive Kunden"
          value={FORMAT_NUM.format(snapshot.active_customers)}
          delta={{
            value: `${FORMAT_NUM.format(snapshot.active_subscriptions)} Subs`,
            positive: snapshot.active_customers > 0,
          }}
          hint={`${FORMAT_NUM.format(snapshot.failed_payments_30d)} failed Payments (30T)`}
        />
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">MRR-Entwicklung</h2>
            <span className="text-xs text-zinc-500">{RANGE_LABEL[range]}</span>
          </div>
          {chartSeries.length === 0 ? (
            <NoSeriesYet />
          ) : (
            <div className="mt-6 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartSeries} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d4af37" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#d4af37" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fill: '#71717a', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#0b0d14',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 12,
                      color: '#fafafa',
                    }}
                    formatter={(v: any) => typeof v === 'number' ? FORMAT_EUR.format(v) : ''}
                  />
                  <Area type="monotone" dataKey="mrr" stroke="#d4af37" strokeWidth={2} fill="url(#mrrFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-xl font-semibold">Subscription Movement</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Neu / Churn (Anzahl Subscriptions in {RANGE_LABEL[range]})
          </p>
          {chartSeries.length === 0 ? (
            <NoSeriesYet />
          ) : (
            <>
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartSeries} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: '#0b0d14',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 12,
                        color: '#fafafa',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} />
                    <Line type="monotone" dataKey="new_subs" name="Neu" stroke="#34d399" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="churn_subs" name="Churn" stroke="#fb7185" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <div className="text-zinc-500">Neu (Periode)</div>
                  <div className="text-emerald-300 tabular-nums">{FORMAT_NUM.format(totalNew)}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <div className="text-zinc-500">Churn (Periode)</div>
                  <div className="text-rose-300 tabular-nums">{FORMAT_NUM.format(totalChurn)}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-3">
        <PlanMixCard plans={snapshot.plan_distribution} />
        <RecentPaymentsCard
          payments={snapshot.recent_payments}
          failed={snapshot.recent_failed_payments}
        />
      </section>

      <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Quick Actions</h2>
            <p className="mt-1 text-sm text-zinc-400">Springe direkt in die relevanten Operations-Flächen.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/customers"
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-zinc-200 hover:bg-white/[0.07]"
            >
              Customers
            </Link>
            <Link
              to="/billing/usage"
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-zinc-200 hover:bg-white/[0.07]"
            >
              Usage &amp; Billing
            </Link>
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-2xl bg-[#d4af37] px-4 py-2 text-sm font-semibold text-black hover:bg-[#e6c350]"
            >
              Stripe Dashboard
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

function PlanMixCard({ plans }: { plans: PlanDistributionEntry[] }) {
  if (plans.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-xl font-semibold">Plan Mix</h2>
        <p className="mt-1 text-xs text-zinc-500">Noch keine aktiven Subscriptions.</p>
      </div>
    );
  }
  const chartData = plans.map((p) => ({
    plan: p.plan_key,
    mrr: Math.round(p.mrr_cents / 100),
    customers: p.customers,
  }));
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-xl font-semibold">Plan Mix</h2>
      <p className="mt-1 text-xs text-zinc-500">MRR-Anteil je Plan (aktuelle aktive Subs)</p>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="plan" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: '#71717a', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
            />
            <Tooltip
              contentStyle={{
                background: '#0b0d14',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                color: '#fafafa',
              }}
              formatter={(v: any) => typeof v === 'number' ? FORMAT_EUR.format(v) : ''}
            />
            <Bar dataKey="mrr" fill="#d4af37" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-zinc-400">
        {plans.map((p) => (
          <div
            key={p.plan_key}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2"
          >
            <span className="uppercase tracking-wider">{p.plan_key}</span>
            <span className="text-zinc-200">{p.customers} Kunden</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentPaymentsCard({
  payments,
  failed,
}: {
  payments: RecentPaymentEntry[];
  failed: RecentFailedPaymentEntry[];
}) {
  const rows: Array<{
    key: string;
    when: string;
    label: string;
    amount: string;
    status: 'paid' | 'failed';
    customer: string | null;
    detail: string | null;
  }> = [
    ...payments.map((p) => ({
      key: `inv:${p.stripe_invoice_id}`,
      when: p.paid_at ?? '',
      label: 'Invoice paid',
      amount: eur(p.amount_cents),
      status: 'paid' as const,
      customer: p.stripe_customer_id,
      detail: null,
    })),
    ...failed.map((f) => ({
      key: `evt:${f.stripe_event_id}`,
      when: f.occurred_at,
      label: 'Payment failed',
      amount: eur(f.amount_cents),
      status: 'failed' as const,
      customer: f.stripe_customer_id,
      detail: f.failure_code ?? f.failure_message,
    })),
  ]
    .sort((a, b) => Date.parse(b.when) - Date.parse(a.when))
    .slice(0, 12);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 lg:col-span-2">
      <h2 className="text-xl font-semibold">Recent Payment Activity</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Letzte erfolgreiche und fehlgeschlagene Zahlungen (Stripe Webhook)
      </p>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">
          Noch keine Payment-Events erfasst. Sobald der erste Stripe-Webhook eintrifft, erscheinen hier
          Live-Aktivitäten.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-white/5">
          {rows.map((r) => (
            <li
              key={r.key}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <span
                  className={
                    'inline-block h-2 w-2 rounded-full ' +
                    (r.status === 'paid' ? 'bg-emerald-400' : 'bg-rose-400')
                  }
                />
                <div>
                  <div className="text-sm text-white">{r.label}</div>
                  <div className="text-xs text-zinc-500">
                    {r.customer
                      ? (
                        <a
                          href={`https://dashboard.stripe.com/customers/${r.customer}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="hover:underline"
                        >
                          {r.customer}
                        </a>
                      )
                      : 'Unbekannter Kunde'}
                    {r.detail && <span className="ml-2 text-zinc-600">· {r.detail}</span>}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-start sm:items-end">
                <div className="text-sm tabular-nums text-zinc-200">{r.amount}</div>
                <div className="text-xs text-zinc-500">
                  {r.when ? new Date(r.when).toLocaleString('de-DE') : '—'}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  delta: { value: string; positive: boolean };
  hint: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <div className="text-sm text-zinc-400">{label}</div>
      <div className="mt-3 flex items-baseline gap-3">
        <div className="text-3xl font-semibold text-white">{value}</div>
        <div className={'text-sm font-medium ' + (delta.positive ? 'text-emerald-400' : 'text-rose-400')}>
          {delta.positive ? '▲' : '▼'} {delta.value}
        </div>
      </div>
      <div className="mt-2 text-xs text-zinc-500">{hint}</div>
    </div>
  );
}

function RangeTabs({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const ranges: Range[] = ['7d', '30d', '90d'];
  return (
    <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
      {ranges.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={
            'rounded-full px-4 py-1.5 text-xs font-medium transition-colors ' +
            (value === r ? 'bg-white text-black' : 'text-zinc-400 hover:text-white')
          }
        >
          {RANGE_LABEL[r]}
        </button>
      ))}
    </div>
  );
}

function NoSeriesYet() {
  return (
    <p className="mt-6 text-sm text-zinc-500">
      Noch keine Zeitreihendaten — der erste tägliche Rollup wird durch business-metrics-cron erstellt.
    </p>
  );
}

function EmptyState() {
  return (
    <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-8">
      <h2 className="text-xl font-semibold">Noch kein Snapshot</h2>
      <p className="mt-2 max-w-2xl text-sm text-zinc-400">
        Die Tabelle <code className="rounded bg-black/40 px-1 py-0.5 text-xs">business_metric_snapshots</code> ist leer.
        Sobald die Edge-Function <code className="rounded bg-black/40 px-1 py-0.5 text-xs">business-metrics-cron</code>{' '}
        einmal gelaufen ist (alle 15 Min. per pg_cron), erscheinen hier Live-Kennzahlen.
      </p>
      <p className="mt-3 text-xs text-zinc-500">
        Setup: Vault-Secret <code>business_metrics_shared_secret</code> setzen, Edge Function deployen, Migration
        ausführen.
      </p>
    </section>
  );
}

function AccessDenied() {
  return (
    <main className="min-h-screen bg-[#05070d] text-white flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
        <h1 className="text-2xl font-semibold tracking-tight">Zugriff verweigert</h1>
        <p className="mt-3 text-sm text-zinc-400">
          /dashboard/business erfordert super_admin-Rechte. Wende dich an einen Admin oder logge dich mit einem
          autorisierten Account ein.
        </p>
        <Link to="/" className="mt-4 inline-block text-[#d4af37] hover:underline text-sm">
          ← Zurück zur Startseite
        </Link>
      </div>
    </main>
  );
}

export default BusinessDashboard;
