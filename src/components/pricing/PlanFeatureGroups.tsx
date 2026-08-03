import * as Icons from 'lucide-react';
import {
  FEATURE_GROUPS,
  ORDERED_PLANS,
  PRODUCT_AREAS,
  formatLimit,
  modulesForArea,
  type FeatureGroupId,
  type Plan,
} from '@/shared/pricing';

function icon(name: string): Icons.LucideIcon {
  return (Icons as unknown as Record<string, Icons.LucideIcon>)[name] ?? Icons.Circle;
}

/**
 * Feature-Liste eines Plans, aufgeteilt in die vier verbindlichen Gruppen:
 * Audit & Evidence · AI Governance · Automation & Ops · Multi Tenant & Reseller.
 *
 * Es gibt bewusst keine ungeordnete Gesamtliste mehr — jede Zeile gehört
 * genau einer Gruppe an.
 */
export function PlanFeatureGroups({ plan }: { plan: Plan }) {
  return (
    <div className="space-y-4" data-testid={`feature-groups-${plan.id}`}>
      {FEATURE_GROUPS.map((group) => {
        const items = plan.features[group.id as FeatureGroupId];
        if (!items || items.length === 0) return null;
        const GroupIcon = icon(group.icon);
        return (
          <div key={group.id}>
            <div className="mb-2 flex items-center gap-1.5">
              <GroupIcon className="h-3 w-3 text-titanium-500" aria-hidden="true" />
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-titanium-500">
                {group.label}
              </span>
            </div>
            <ul className="space-y-1.5">
              {items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-silver-200">
                  <Icons.Check className="mt-1 h-3.5 w-3.5 shrink-0 text-titanium-100" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** Runtime-Limits eines Plans als kompakte Kennzahlen-Leiste. */
export function PlanRuntimeLimits({ plan }: { plan: Plan }) {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Bots', value: formatLimit(plan.limits.bots) },
    { label: 'Antworten / Monat', value: formatLimit(plan.limits.answersPerMonth) },
    { label: 'Domains', value: formatLimit(plan.limits.domains) },
    { label: 'Kanäle', value: plan.channels.length > 0 ? String(plan.channels.length) : '—' },
    { label: 'Automation-Runs', value: formatLimit(plan.limits.automationRunsPerMonth) },
    { label: 'API-Aufrufe / Monat', value: formatLimit(plan.limits.apiCallsPerMonth) },
    { label: 'Mandanten', value: formatLimit(plan.limits.tenants) },
    { label: 'Evidence-Speicher', value: plan.limits.evidenceStorageGb > 0 ? `${plan.limits.evidenceStorageGb} GB` : '—' },
  ];

  return (
    <dl
      className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-y border-titanium-900 py-3"
      data-testid={`runtime-limits-${plan.id}`}
    >
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-2">
          <dt className="font-mono text-[10px] uppercase tracking-wider text-titanium-600">{row.label}</dt>
          <dd className="font-mono text-xs tabular-nums text-titanium-200">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Module eines Plans, gruppiert nach GOVERN / AUTOMATE / ENGAGE. */
export function PlanModuleAreas({ plan }: { plan: Plan }) {
  return (
    <div className="space-y-3" data-testid={`module-areas-${plan.id}`}>
      {PRODUCT_AREAS.map((area) => {
        const modules = modulesForArea(plan, area.id);
        if (modules.length === 0) return null;
        return (
          <div key={area.id}>
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-titanium-500">
              {area.label}
              <span className="ml-1.5 text-titanium-700">{modules.length}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {modules.map((module) => (
                <span
                  key={module.id}
                  title={module.description}
                  className="inline-flex items-center border border-titanium-800 bg-obsidian-950 px-1.5 py-0.5 font-mono text-[10px] text-titanium-300"
                >
                  {module.name}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Vergleichstabelle über alle Pläne, gegliedert nach den vier Feature-Gruppen.
 * Zeigt je Gruppe, welche Module und Berechtigungen ein Plan mitbringt.
 */
export function PlanComparisonMatrix() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" data-testid="plan-comparison-matrix">
        <caption className="sr-only">
          Vergleich aller Pläne nach Audit &amp; Evidence, AI Governance, Automation &amp; Ops
          sowie Multi Tenant &amp; Reseller
        </caption>
        <thead>
          <tr className="border-b border-titanium-900">
            <th
              scope="col"
              className="w-52 py-3 pr-4 text-left font-mono text-[10px] uppercase tracking-widest text-titanium-600"
            >
              Bereich
            </th>
            {ORDERED_PLANS.map((plan) => (
              <th
                key={plan.id}
                scope="col"
                className="whitespace-nowrap px-3 py-3 text-center font-mono text-[10px] uppercase tracking-widest text-titanium-400"
              >
                {plan.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FEATURE_GROUPS.map((group, i) => (
            <tr
              key={group.id}
              className={`border-b border-titanium-900 ${i % 2 === 0 ? 'bg-obsidian-950' : 'bg-obsidian-900'}`}
            >
              <th scope="row" className="py-3 pr-4 text-left align-top font-medium text-titanium-100">
                {group.label}
                <span className="mt-0.5 block text-[11px] font-normal leading-snug text-titanium-500">
                  {group.summary}
                </span>
              </th>
              {ORDERED_PLANS.map((plan) => {
                const count = plan.features[group.id as FeatureGroupId]?.length ?? 0;
                return (
                  <td key={plan.id} className="px-3 py-3 text-center align-top">
                    {count > 0 ? (
                      <span className="font-mono text-xs tabular-nums text-emerald-400">{count}</span>
                    ) : (
                      <span className="text-titanium-800">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 font-mono text-[10px] text-titanium-600">
        Zahl = Anzahl der Leistungen des Plans in diesem Bereich. Details stehen auf der jeweiligen Plan-Karte.
      </p>
    </div>
  );
}
