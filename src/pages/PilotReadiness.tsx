import { Link } from 'react-router-dom';
import { Suspense } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  AlertTriangle,
  CreditCard,
  Mail,
  Bot,
  ShieldCheck,
  Activity,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useTenant } from '../core/access/TenantProvider';
import { usePilotReadiness } from '../features/governance/usePilotReadiness';
import { usePageMeta } from '../lib/usePageMeta';
import { AuthGate } from '../features/kodee/connections/AuthGate';

export function PilotReadiness() {
  usePageMeta({
    title: 'Pilot Readiness — RealSyncDynamics.AI',
    description:
      'Live-Status der Pilot-Vorbereitung: Daten-Befüllung, Stripe, Resend, Governance-Agent, Security.',
  });
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      {/* Marker für Production Readiness Check */}
      <div className="sr-only">Pilot</div>
      <Suspense
        fallback={
          <div className="h-screen flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-titanium-300" />
          </div>
        }
      >
        <AuthGate>
          {() => <Inner />}
        </AuthGate>
      </Suspense>
      <noscript>
        <div className="h-screen flex items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">JavaScript erforderlich</h1>
            <p className="text-silver-300">Bitte aktiviere JavaScript um diese Seite zu nutzen.</p>
          </div>
        </div>
      </noscript>
    </div>
  );
}

function Inner() {
  const { activeTenantId, tenants } = useTenant();
  const { data, loading, error } = usePilotReadiness(activeTenantId);

  const dataItems: Array<{
    key: keyof typeof data;
    label: string;
    desc: string;
    minimum: number;
  }> = [
    { key: 'assets',     label: 'Governance Assets',  desc: 'Mind. eine Website oder ein AI-System inventarisiert', minimum: 1 },
    { key: 'policies',   label: 'Policies',           desc: 'Mind. eine aktive Policy', minimum: 1 },
    { key: 'events',     label: 'Telemetry Events',   desc: 'Mind. ein Event aus Extension/SDK', minimum: 10 },
    { key: 'evidence',   label: 'Evidence Records',   desc: 'Mind. ein Audit-Nachweis erzeugt', minimum: 1 },
    { key: 'vendors',    label: 'Vendor Inventory',   desc: 'Mind. ein Vendor erfasst', minimum: 1 },
    { key: 'dpias',      label: 'DPIAs',              desc: 'DPIA für jeden Hochrisiko-Asset', minimum: 0 },
    { key: 'incidents',  label: 'Incidents',          desc: 'Incident-Workflow funktionsfähig', minimum: 0 },
    { key: 'agent_runs', label: 'Agent Runs',         desc: 'Mind. ein Chat-Run mit dem Governance-Agent', minimum: 0 },
  ];

  const manualChecks = [
    {
      key: 'stripe',
      icon: CreditCard,
      title: 'Stripe Production Checkout',
      desc: 'Live-Key + Webhook-Endpoint + Price IDs für alle Plans.',
      runbook: 'docs/runbooks/stripe-production-checkout.md',
    },
    {
      key: 'resend',
      icon: Mail,
      title: 'Resend Email Sending',
      desc: 'Verifizierte Domain + DKIM/SPF/DMARC + API-Key in Vault.',
      runbook: 'docs/runbooks/resend-production-email.md',
    },
    {
      key: 'agent',
      icon: Bot,
      title: 'Governance Agent activatable',
      desc: 'anthropic_api_key in Vault + US-Routing acked oder Mistral-Wire gewartet.',
      runbook: 'docs/runbooks/governance-agent-activation.md',
    },
    {
      key: 'security',
      icon: ShieldCheck,
      title: 'Security Hardening sweep',
      desc: 'Letzter Advisor-Run, kein ERROR, alle bekannten WARNs klassifiziert.',
      runbook: 'docs/runbooks/security-hardening-checklist.md',
    },
  ];

  const dataReady = dataItems
    .filter((i) => i.minimum > 0)
    .every((i) => (data[i.key] ?? 0) >= i.minimum);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <Link to="/governance" className="flex items-center gap-2 text-titanium-300 hover:text-titanium-100 text-sm">
          <ArrowLeft className="h-4 w-4" /> Governance Dashboard
        </Link>
        <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-titanium-100">
          Pilot Readiness
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <section className="mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
            Pilot Launch Readiness
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-tight">
            Pilot Readiness Check
          </h1>
          <p className="mt-3 text-silver-300 text-base sm:text-lg leading-relaxed max-w-3xl">
            Live-Status für den aktiven Tenant ·{' '}
            <span className="font-mono text-titanium-100">
              {tenants.find((t) => t.tenantId === activeTenantId)?.name ?? 'kein Tenant'}
            </span>
            .
          </p>
        </section>

        {/* Top-level verdict */}
        <section
          className={`p-5 mb-10 border ${
            loading
              ? 'border-silver-700/30 bg-obsidian-900/60'
              : dataReady
                ? 'border-emerald-400/30 bg-emerald-400/5'
                : 'border-amber-400/30 bg-amber-400/5'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 flex items-center justify-center border ${
                loading
                  ? 'border-silver-700/30 text-silver-400'
                  : dataReady
                    ? 'border-emerald-400/30 text-emerald-300'
                    : 'border-amber-400/30 text-amber-300'
              }`}
            >
              {loading ? <Circle className="h-5 w-5 animate-pulse" /> : dataReady ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="font-display font-bold text-xl text-titanium-50">
                {loading ? 'Lade Status…' : dataReady ? 'Daten-Loop ist geschlossen' : 'Daten-Loop hat Lücken'}
              </h2>
              <p className="text-sm text-silver-300 mt-0.5">
                {dataReady
                  ? 'Mindest-Counts für Pilot-Demo erreicht. Manuelle Checks unten prüfen.'
                  : 'Mindestens ein Pflicht-Datenpunkt fehlt. Onboarding durchziehen → Extension installieren → 10 Events erzeugen.'}
              </p>
            </div>
          </div>
          {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
        </section>

        {/* Data counts */}
        <section className="mb-12">
          <h2 className="font-display font-bold text-2xl text-titanium-50 mb-1">Live-Daten</h2>
          <p className="text-sm text-silver-400 mb-5">
            Counts aus dem Tenant-Scope. RLS-validiert.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {dataItems.map((i) => {
              const count = data[i.key] ?? 0;
              const meets = count >= i.minimum;
              const Icon = meets ? CheckCircle2 : i.minimum > 0 ? Circle : Activity;
              const tone = meets ? 'text-emerald-300 border-emerald-400/30' : i.minimum > 0 ? 'text-amber-300 border-amber-400/30' : 'text-silver-400 border-silver-700/30';
              return (
                <article key={i.key} className="border border-silver-700/30 bg-obsidian-900/60 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-silver-400">
                      {i.label}
                    </span>
                    <Icon className={`h-4 w-4 ${tone.split(' ')[0]}`} />
                  </div>
                  <div className="font-display font-bold text-3xl text-titanium-50">
                    {loading ? '—' : count}
                  </div>
                  {i.minimum > 0 && (
                    <div className={`mt-1 text-[10px] font-mono ${tone.split(' ')[0]}`}>
                      min {i.minimum} · {meets ? 'ok' : 'fehlt'}
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-silver-400 leading-relaxed">{i.desc}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* Manual checks */}
        <section className="mb-12">
          <h2 className="font-display font-bold text-2xl text-titanium-50 mb-1">Manuelle Checks</h2>
          <p className="text-sm text-silver-400 mb-5">
            Diese Punkte sind nicht auf DB-Counts reduzierbar — sie brauchen ein 1-Min-Manual.
            Jeder Punkt verlinkt das passende Runbook.
          </p>
          <div className="space-y-3">
            {manualChecks.map((c) => {
              const Icon = c.icon;
              return (
                <article
                  key={c.key}
                  className="border border-silver-700/30 bg-obsidian-900/60 p-4 flex items-start gap-4"
                >
                  <div className="h-9 w-9 flex items-center justify-center border border-titanium-100/30 text-titanium-100 shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-semibold text-base text-titanium-50">{c.title}</h3>
                    <p className="text-xs text-silver-400 mt-1 leading-relaxed">{c.desc}</p>
                    <p className="mt-2 font-mono text-[10px] text-silver-500">{c.runbook}</p>
                  </div>
                  <div className="shrink-0">
                    <a
                      href={`https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/blob/main/${c.runbook}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
                    >
                      Runbook <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Next actions */}
        <section className="border border-titanium-100/20 bg-titanium-100/5 p-6">
          <h2 className="font-display font-bold text-xl text-titanium-50 mb-3">Was als Nächstes</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-silver-300">
            <li>Wenn Daten-Counts noch lückig sind: <Link to="/governance/onboarding" className="text-amber-300 hover:underline">Onboarding</Link> durchziehen.</li>
            <li>Wenn manuelle Checks offen sind: <span className="font-mono text-titanium-100">docs/runbooks/p0-pilot-blockers.md</span> ist der 25-Minuten-Sweep.</li>
            <li>Wenn Pilot-bereit: nach Production-Deploy <span className="font-mono text-titanium-100">npm run check:production</span> lokal ausführen.</li>
          </ol>
        </section>
      </main>
    </div>
  );
}
