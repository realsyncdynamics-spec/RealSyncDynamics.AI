import { useMemo, useState } from 'react';
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
import { SEOHead } from '../components/SEOHead';

type Range = '7d' | '30d' | '90d';

interface RevenuePoint {
  label: string;
  mrr: number;
  new_mrr: number;
  churn_mrr: number;
}

interface FunnelStep {
  step: string;
  count: number;
}

interface CustomerRow {
  name: string;
  plan: 'Founding' | 'Pro' | 'Team' | 'Enterprise';
  mrr: number;
  seats: number;
  health: 'green' | 'yellow' | 'red';
  industry: string;
}

interface ActivityRow {
  id: string;
  ts: string;
  actor: string;
  event: string;
  detail: string;
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

function generateRevenueSeries(range: Range): RevenuePoint[] {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const baseline = 38_400;
  let mrr = baseline;
  const out: RevenuePoint[] = [];
  for (let i = 0; i < days; i += 1) {
    const growth = 250 + Math.round(Math.sin(i / 3) * 80 + (i / days) * 600);
    const churn = 90 + Math.round(Math.cos(i / 4) * 30);
    mrr += growth - churn;
    const label = range === '90d' ? `KW ${Math.floor(i / 7) + 1}` : `T-${days - i}`;
    out.push({ label, mrr, new_mrr: growth, churn_mrr: churn });
  }
  return out;
}

const FUNNEL: FunnelStep[] = [
  { step: 'Visitors', count: 18_420 },
  { step: 'Sign-up', count: 2_180 },
  { step: 'Aktiviert', count: 1_240 },
  { step: 'Conversion (paid)', count: 312 },
  { step: 'Expansion', count: 84 },
];

const CUSTOMERS: CustomerRow[] = [
  { name: 'Helios HealthTech AG', plan: 'Enterprise', mrr: 4_900, seats: 42, health: 'green', industry: 'HealthTech' },
  { name: 'NordCapital Holding', plan: 'Enterprise', mrr: 4_200, seats: 30, health: 'green', industry: 'FinTech' },
  { name: 'KanzleiPro Berlin', plan: 'Team', mrr: 1_290, seats: 18, health: 'yellow', industry: 'Legal' },
  { name: 'Praxis Mainfeld GmbH', plan: 'Pro', mrr: 490, seats: 6, health: 'green', industry: 'Healthcare' },
  { name: 'Atlas E-Commerce', plan: 'Team', mrr: 980, seats: 12, health: 'red', industry: 'E-Commerce' },
  { name: 'Stadtwerke Westfalen', plan: 'Enterprise', mrr: 3_600, seats: 24, health: 'green', industry: 'Public Sector' },
  { name: 'Mosaic Insurance Group', plan: 'Pro', mrr: 690, seats: 8, health: 'yellow', industry: 'Insurance' },
];

const ACTIVITY: ActivityRow[] = [
  { id: 'a1', ts: 'vor 4 Min.', actor: 'Helios HealthTech AG', event: 'Plan upgrade', detail: 'Team → Enterprise (+€2.400 MRR)' },
  { id: 'a2', ts: 'vor 38 Min.', actor: 'Atlas E-Commerce', event: 'Risk flag', detail: 'Health score gefallen (red) — Renewal in 12 Tagen' },
  { id: 'a3', ts: 'vor 1 Std.', actor: 'KanzleiPro Berlin', event: 'Seat-Expansion', detail: '+6 Seats aktiviert' },
  { id: 'a4', ts: 'vor 3 Std.', actor: 'NordCapital Holding', event: 'Invoice paid', detail: '€12.600 (Q-Vorauszahlung)' },
  { id: 'a5', ts: 'vor 6 Std.', actor: 'Mosaic Insurance', event: 'Onboarding', detail: 'DSFA-Workflow abgeschlossen' },
  { id: 'a6', ts: 'gestern', actor: 'Stadtwerke Westfalen', event: 'Pilot → Subscription', detail: 'Founding Access aktiviert' },
];

const PLAN_MIX = [
  { plan: 'Founding', kunden: 14, mrr: 14_000 },
  { plan: 'Pro', kunden: 86, mrr: 8_900 },
  { plan: 'Team', kunden: 31, mrr: 11_600 },
  { plan: 'Enterprise', kunden: 9, mrr: 18_900 },
];

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
        <div
          className={
            'text-sm font-medium ' +
            (delta.positive ? 'text-emerald-400' : 'text-rose-400')
          }
        >
          {delta.positive ? '▲' : '▼'} {delta.value}
        </div>
      </div>
      <div className="mt-2 text-xs text-zinc-500">{hint}</div>
    </div>
  );
}

function HealthDot({ health }: { health: CustomerRow['health'] }) {
  const cls =
    health === 'green'
      ? 'bg-emerald-400'
      : health === 'yellow'
        ? 'bg-amber-400'
        : 'bg-rose-400';
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />;
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
            (value === r
              ? 'bg-white text-black'
              : 'text-zinc-400 hover:text-white')
          }
        >
          {RANGE_LABEL[r]}
        </button>
      ))}
    </div>
  );
}

export function BusinessDashboard() {
  const [range, setRange] = useState<Range>('30d');
  const series = useMemo(() => generateRevenueSeries(range), [range]);

  const currentMrr = series[series.length - 1]?.mrr ?? 0;
  const startMrr = series[0]?.mrr ?? 0;
  const mrrDeltaPct = startMrr > 0 ? ((currentMrr - startMrr) / startMrr) * 100 : 0;
  const newMrr = series.reduce((s, p) => s + p.new_mrr, 0);
  const churnMrr = series.reduce((s, p) => s + p.churn_mrr, 0);
  const netNewMrr = newMrr - churnMrr;

  const totalCustomers = PLAN_MIX.reduce((s, p) => s + p.kunden, 0);
  const arr = currentMrr * 12;
  const grossChurnRate = (churnMrr / Math.max(startMrr, 1)) * 100;

  return (
    <>
      <SEOHead
        title="Business Dashboard | RealSync Dynamics"
        description="Business overview: MRR, ARR, net new revenue, customer health, plan mix and recent activity."
        canonical="/dashboard/business"
        noIndex
      />
      <main className="min-h-screen bg-[#05070d] px-6 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <div className="mb-4 inline-flex rounded-full border border-[#d4af37]/40 bg-[#d4af37]/10 px-4 py-2 text-sm text-[#d4af37]">
                Business Dashboard
              </div>
              <h1 className="text-4xl font-semibold tracking-tight">Revenue, Customers &amp; Health</h1>
              <p className="mt-3 max-w-3xl text-zinc-400">
                Zentrale Sicht auf MRR-Entwicklung, Plan-Mix, Customer Health und letzte Geschäftsaktivität.
                Daten sind aktuell Demonstrationswerte — verbinde Stripe + Supabase, um Live-Zahlen zu sehen.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 md:items-end">
              <RangeTabs value={range} onChange={setRange} />
              <Link
                to="/billing/usage"
                className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:text-white"
              >
                Zur Usage &amp; Billing
              </Link>
            </div>
          </div>

          <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Monthly Recurring Revenue"
              value={FORMAT_EUR.format(currentMrr)}
              delta={{ value: `${mrrDeltaPct.toFixed(1)}%`, positive: mrrDeltaPct >= 0 }}
              hint="vs. Periodenanfang"
            />
            <KpiCard
              label="Annual Run Rate"
              value={FORMAT_EUR.format(arr)}
              delta={{ value: FORMAT_EUR.format(arr - startMrr * 12), positive: arr >= startMrr * 12 }}
              hint="MRR × 12"
            />
            <KpiCard
              label="Net New MRR"
              value={FORMAT_EUR.format(netNewMrr)}
              delta={{ value: FORMAT_EUR.format(newMrr) + ' neu', positive: netNewMrr >= 0 }}
              hint={`Churn: ${FORMAT_EUR.format(churnMrr)}`}
            />
            <KpiCard
              label="Aktive Kunden"
              value={FORMAT_NUM.format(totalCustomers)}
              delta={{ value: `${grossChurnRate.toFixed(2)}% Churn`, positive: grossChurnRate < 3 }}
              hint="Gross Revenue Churn (Periode)"
            />
          </section>

          <section className="mt-10 grid gap-6 lg:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 lg:col-span-2">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">MRR-Entwicklung</h2>
                <span className="text-xs text-zinc-500">{RANGE_LABEL[range]}</span>
              </div>
              <div className="mt-6 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
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
                      formatter={(v: number) => FORMAT_EUR.format(v)}
                    />
                    <Area type="monotone" dataKey="mrr" stroke="#d4af37" strokeWidth={2} fill="url(#mrrFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">Net New vs. Churn</h2>
              <p className="mt-1 text-xs text-zinc-500">Tägliche Bewegung in {RANGE_LABEL[range]}</p>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: '#0b0d14',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 12,
                        color: '#fafafa',
                      }}
                      formatter={(v: number) => FORMAT_EUR.format(v)}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} />
                    <Line type="monotone" dataKey="new_mrr" name="Neu" stroke="#34d399" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="churn_mrr" name="Churn" stroke="#fb7185" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="mt-10 grid gap-6 lg:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">Plan Mix</h2>
              <p className="mt-1 text-xs text-zinc-500">MRR-Anteil je Plan</p>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={PLAN_MIX} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
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
                      formatter={(v: number) => FORMAT_EUR.format(v)}
                    />
                    <Bar dataKey="mrr" fill="#d4af37" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-zinc-400">
                {PLAN_MIX.map((p) => (
                  <div key={p.plan} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                    <span>{p.plan}</span>
                    <span className="text-zinc-200">{p.kunden} Kunden</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 lg:col-span-2">
              <h2 className="text-xl font-semibold">Top Kunden nach MRR</h2>
              <p className="mt-1 text-xs text-zinc-500">Inkl. Health Score und Branche</p>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-zinc-500">
                      <th className="pb-3 text-left font-medium">Kunde</th>
                      <th className="pb-3 text-left font-medium">Plan</th>
                      <th className="pb-3 text-left font-medium">Branche</th>
                      <th className="pb-3 text-right font-medium">Seats</th>
                      <th className="pb-3 text-right font-medium">MRR</th>
                      <th className="pb-3 text-center font-medium">Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {[...CUSTOMERS].sort((a, b) => b.mrr - a.mrr).map((c) => (
                      <tr key={c.name} className="text-zinc-300">
                        <td className="py-3 text-white">{c.name}</td>
                        <td className="py-3 text-zinc-400">{c.plan}</td>
                        <td className="py-3 text-zinc-400">{c.industry}</td>
                        <td className="py-3 text-right tabular-nums">{c.seats}</td>
                        <td className="py-3 text-right tabular-nums">{FORMAT_EUR.format(c.mrr)}</td>
                        <td className="py-3 text-center"><HealthDot health={c.health} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="mt-10 grid gap-6 lg:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">Conversion Funnel</h2>
              <p className="mt-1 text-xs text-zinc-500">Letzte 30 Tage</p>
              <div className="mt-5 space-y-3">
                {FUNNEL.map((f, idx) => {
                  const max = FUNNEL[0].count;
                  const pct = (f.count / max) * 100;
                  const conv = idx === 0 ? null : (f.count / FUNNEL[idx - 1].count) * 100;
                  return (
                    <div key={f.step}>
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>{f.step}</span>
                        <span className="tabular-nums text-zinc-200">
                          {FORMAT_NUM.format(f.count)}
                          {conv !== null && (
                            <span className="ml-2 text-zinc-500">({conv.toFixed(1)}%)</span>
                          )}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-[#d4af37]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 lg:col-span-2">
              <h2 className="text-xl font-semibold">Recent Business Activity</h2>
              <p className="mt-1 text-xs text-zinc-500">Upgrades, Health-Flags, Onboarding, Zahlungen</p>
              <ul className="mt-5 divide-y divide-white/5">
                {ACTIVITY.map((a) => (
                  <li key={a.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm text-white">{a.actor}</div>
                      <div className="text-xs text-zinc-500">{a.event} · {a.detail}</div>
                    </div>
                    <div className="text-xs text-zinc-500">{a.ts}</div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Quick Actions</h2>
                <p className="mt-1 text-sm text-zinc-400">Springe direkt in die relevanten Operations-Flächen.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/billing/usage"
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-zinc-200 hover:bg-white/[0.07]"
                >
                  Usage &amp; Billing
                </Link>
                <Link
                  to="/governance/admin"
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-zinc-200 hover:bg-white/[0.07]"
                >
                  Governance Admin
                </Link>
                <Link
                  to="/dashboard/enterprise-ai-os"
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-zinc-200 hover:bg-white/[0.07]"
                >
                  Enterprise AI OS
                </Link>
                <Link
                  to="/pricing"
                  className="rounded-2xl bg-[#d4af37] px-4 py-2 text-sm font-semibold text-black hover:bg-[#e6c350]"
                >
                  Pricing &amp; Plans
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

export default BusinessDashboard;
