import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart3, Cpu, Layers, ShieldCheck } from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { QuotaBar } from '../../core/access/QuotaBar';
import { AuthGate } from '../kodee/connections/AuthGate';

export function UsageView() {
  return (
    <AuthGate>
      {() => <UsageInner />}
    </AuthGate>
  );
}

function UsageInner() {
  const { tenants, activeTenantId, setActiveTenant, entitlements, loading } = useTenant();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="h-14 border-b border-slate-200/60 bg-white flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-700">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-slate-900">Verbrauch & Limits</div>
              <div className="text-[11px] text-slate-500 font-medium">Aktueller Monat</div>
            </div>
          </div>
        </div>

        {tenants.length > 1 && (
          <select
            value={activeTenantId ?? ''}
            onChange={(e) => setActiveTenant(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-slate-100 max-w-[200px]"
          >
            {tenants.map((t) => (
              <option key={t.tenantId} value={t.tenantId}>{t.name}</option>
            ))}
          </select>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="text-slate-400 text-sm">Lade…</div>
        ) : !activeTenantId ? (
          <EmptyTenants />
        ) : !entitlements ? (
          <div className="text-slate-400 text-sm">Keine Entitlements für diesen Tenant gefunden.</div>
        ) : (
          <div className="space-y-8">
            <Section icon={Cpu} title="AI">
              <QuotaBar feature="limit.ai_calls_monthly"          label="AI-Aufrufe / Monat" />
              <QuotaBar feature="limit.ai_tokens_monthly"         label="AI-Token / Monat" />
              <QuotaBar
                feature="limit.ai_cost_monthly_cents"
                label="AI-Kosten / Monat"
                format={(n) => `$${(n / 100).toFixed(2)}`}
              />
            </Section>

            <Section icon={Layers} title="Assets & Workflows">
              <QuotaBar feature="limit.active_assets"             label="Aktive Assets" />
              <QuotaBar feature="limit.monthly_registrations"     label="Asset-Registrierungen / Monat" />
              <QuotaBar feature="limit.bulk_jobs_monthly"         label="Bulk-Jobs / Monat" />
              <QuotaBar feature="limit.compliance_exports_monthly" label="Compliance-Exports / Monat" />
            </Section>

            <Section icon={ShieldCheck} title="Team & API">
              <QuotaBar feature="limit.team_seats"                label="Team-Seats" />
              <QuotaBar feature="limit.api_calls_monthly"         label="API-Calls / Monat" />
            </Section>
          </div>
        )}
      </main>
    </div>
  );
}

function Section({
  icon: Icon, title, children,
}: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-slate-400" />
        <h2 className="font-display font-bold text-slate-900 tracking-tight">{title}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {children}
      </div>
    </section>
  );
}

function EmptyTenants() {
  return (
    <div className="text-center py-16">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-4">
        <BarChart3 className="h-6 w-6 text-slate-300" />
      </div>
      <h2 className="font-display text-lg font-bold text-slate-900 mb-1">Noch kein Tenant</h2>
      <p className="text-sm text-slate-500">
        Sobald du Mitglied eines Tenants bist, siehst du hier deinen Verbrauch.
      </p>
    </div>
  );
}
