import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Library, ShieldCheck, Check, AlertTriangle, Loader2,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import {
  groupedTemplates, CATEGORY_LABEL,
  type PolicyTemplate, type PolicyCategory,
} from './policyTemplates';
import { createPolicy } from './resourcesApi';
import type { GovernanceRiskLevel } from './types';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';

/**
 * /governance/policies/templates — one-click install for curated
 * policy presets. Each install fires create_policy on the
 * governance-resources Edge Function so installed templates are
 * just normal governance_policies rows from then on.
 */
function _PolicyTemplatesView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const PolicyTemplatesView = withPerformanceMonitoring(
  _PolicyTemplatesView,
  'PolicyTemplatesView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [installed, setInstalled] = useState<Record<string, 'busy' | 'done' | 'error'>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});

  const install = async (t: PolicyTemplate) => {
    if (!activeTenantId) return;
    setInstalled((m) => ({ ...m, [t.id]: 'busy' }));
    const r = await createPolicy({
      tenant_id: activeTenantId,
      name: t.name,
      description: t.description,
      policy_type: t.policy_type,
      severity: t.severity,
      action: t.action,
      condition: t.condition,
      enabled: t.enabled,
    });
    if (!r.ok) {
      setInstalled((m) => ({ ...m, [t.id]: 'error' }));
      setErrorMap((m) => ({ ...m, [t.id]: r.error?.message ?? 'Installation fehlgeschlagen' }));
      return;
    }
    setInstalled((m) => ({ ...m, [t.id]: 'done' }));
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/websites" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <Library className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Policy Template Library</div>
              <div className="text-[11px] text-titanium-400 font-medium">Kuratierte Best-Practice-Regeln, ein Klick installiert</div>
            </div>
          </div>
        </div>
        {tenants.length > 1 && (
          <select
            value={activeTenantId ?? ''}
            onChange={(e) => setActiveTenant(e.target.value)}
            className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800 max-w-[200px]"
          >
            {tenants.map((t) => <option key={t.tenantId} value={t.tenantId}>{t.name}</option>)}
          </select>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {!activeTenantId ? (
          <div className="text-titanium-500 text-sm">Wähle einen Tenant aus.</div>
        ) : (
          <div className="space-y-8">
            <p className="text-[13px] text-titanium-300 max-w-3xl leading-relaxed">
              Jedes Template installiert eine echte Policy in Deinen Tenant — die Engine wertet sie
              ab dem nächsten Event aus. Du kannst sie danach in <code>/governance</code> deaktivieren
              oder über die DB editieren.
            </p>

            {groupedTemplates().map(({ category, items }) => (
              <CategorySection
                key={category}
                category={category}
                items={items}
                installed={installed}
                errorMap={errorMap}
                onInstall={install}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function CategorySection({
  category, items, installed, errorMap, onInstall,
}: {
  category: PolicyCategory;
  items: PolicyTemplate[];
  installed: Record<string, 'busy' | 'done' | 'error'>;
  errorMap: Record<string, string>;
  onInstall: (t: PolicyTemplate) => void;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-300">
          {CATEGORY_LABEL[category]}
        </div>
        <div className="h-px flex-1 bg-titanium-900" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {items.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            state={installed[t.id]}
            error={errorMap[t.id]}
            onInstall={() => onInstall(t)}
          />
        ))}
      </div>
    </section>
  );
}

function TemplateCard({
  template, state, error, onInstall,
}: {
  template: PolicyTemplate;
  state?: 'busy' | 'done' | 'error';
  error?: string;
  onInstall: () => void;
}) {
  return (
    <div className="border border-titanium-900 bg-obsidian-900/60 p-4 flex flex-col">
      <div className="flex items-start gap-2 mb-2">
        <ShieldCheck className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
        <h3 className="font-semibold text-titanium-50 text-sm leading-snug">{template.name}</h3>
        <RiskBadge level={template.severity} />
      </div>
      <p className="text-[13px] text-titanium-300 leading-relaxed">{template.description}</p>
      <p className="mt-2 text-[12px] text-titanium-400 italic leading-relaxed">{template.rationale}</p>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-mono uppercase tracking-wider">
        <Chip label={`type · ${template.policy_type}`} />
        <Chip label={`action · ${template.action}`} tone={template.action === 'block' ? 'danger' : template.action === 'require_approval' ? 'warn' : 'neutral'} />
      </div>

      <pre className="mt-3 bg-obsidian-950 border border-titanium-900 text-[11px] font-mono text-titanium-300 p-2 overflow-x-auto">
{JSON.stringify(template.condition, null, 2)}
      </pre>

      {error && (
        <div className="mt-2 flex items-start gap-1.5 text-[11px] text-red-300 bg-red-950/50 border border-red-900 p-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <button
        onClick={onInstall}
        disabled={state === 'busy' || state === 'done'}
        className={`mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-none transition-colors ${
          state === 'done'
            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 cursor-default'
            : 'bg-amber-500 text-obsidian-950 hover:bg-amber-400 disabled:opacity-50'
        }`}
      >
        {state === 'done'
          ? <><Check className="h-3.5 w-3.5" /> Installiert</>
          : state === 'busy'
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Installiere…</>
            : <>+ Policy installieren</>}
      </button>
    </div>
  );
}

function Chip({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'warn' | 'danger' }) {
  const cls =
    tone === 'danger' ? 'border-red-500/40 text-red-300 bg-red-500/10' :
    tone === 'warn'   ? 'border-amber-500/40 text-amber-300 bg-amber-500/10' :
    'border-titanium-800 text-titanium-400 bg-titanium-900/40';
  return <span className={`inline-block px-1.5 py-0.5 border ${cls}`}>{label}</span>;
}

function RiskBadge({ level }: { level: GovernanceRiskLevel }) {
  const cls =
    level === 'critical' ? 'text-red-300 border-red-500/60 bg-red-500/10' :
    level === 'high'     ? 'text-amber-300 border-amber-500/60 bg-amber-500/10' :
    level === 'medium'   ? 'text-yellow-200 border-yellow-500/50 bg-yellow-500/10' :
    level === 'low'      ? 'text-sky-300 border-sky-500/50 bg-sky-500/10' :
                           'text-titanium-300 border-titanium-700 bg-titanium-800/30';
  return (
    <span className={`ml-auto shrink-0 border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${cls}`}>
      {level}
    </span>
  );
}
