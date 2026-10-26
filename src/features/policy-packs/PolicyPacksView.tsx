import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ShieldCheck, AlertTriangle, Check, Plus, RefreshCw, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { Button } from '../../enterprise-os/components/Button';
import { Card, CardHeader, CardBody } from '../../enterprise-os/components/Card';
import {
  computeCoverage,
  coverageBand,
  frameworkLabel,
  type ControlStatus,
  type MappingStatus,
} from '../../lib/policy-packs/coverage';
import {
  topRecommendations, deriveActiveFrameworks, RECOMMENDATION_TIER_LABEL,
  TENANT_INDUSTRY_OPTIONS,
  type PackRecommendation,
} from '../../lib/policy-packs/recommend';
import { countRiskInventory } from '../governance/aiActRiskInventoryApi';
import { fetchFrameworkControls, fetchTenantAssets, type DbFrameworkControl, type DbGovernanceAsset } from '../governance/governanceApi';
import { autoMapAsset, createAsset, upsertMapping } from '../governance/resourcesApi';
import { notifyTenantDataChanged, useTenantDataVersion } from '../governance/tenantDataEvents';
import { getSupabase } from '../../lib/supabase';
import { listCatalog, listActivations, listTenantMappings, setPackActive, type PolicyPack, type PacksError } from './policyPacksApi';
import { cheapestPlanForKeys } from '../../core/access/featureAccess';
import { planById } from '@/shared/pricing';

/** Mindestplan aus PLAN_ENTITLEMENTS statt Literal (früher fälschlich „Agency“; tatsächlich Starter). */
const PACKS_MIN_PLAN = (() => {
  const id = cheapestPlanForKeys(['policy.packs']);
  return id ? planById(id).name : null;
})();

const STATUS_OPTIONS: ReadonlyArray<{ value: Exclude<ControlStatus, 'not_started'>; label: string }> = [
  { value: 'implemented', label: 'Umgesetzt' },
  { value: 'in_progress', label: 'In Arbeit' },
  { value: 'gap', label: 'Lücke' },
  { value: 'not_applicable', label: 'Nicht anwendbar' },
];

const STATUS_LABEL: Readonly<Record<ControlStatus, string>> = {
  not_started: 'Offen',
  in_progress: 'In Arbeit',
  implemented: 'Umgesetzt',
  gap: 'Lücke',
  not_applicable: 'Nicht anwendbar',
};

/**
 * /app/policy-packs — Policy Packs Marketplace: aktivierbare, vorkonfigurierte
 * Compliance-Regelwerke (DSGVO, EU AI Act, NIS2, DORA, ISO 27001, TISAX + Kombi).
 * Ab dem günstigsten Plan mit Entitlement policy.packs (PLAN_ENTITLEMENTS, heute Starter). Abdeckung wird gegen die
 * asset_control_mappings des Tenants berechnet.
 */
export function PolicyPacksView() {
  return <AuthGate>{() => <PacksInner />}</AuthGate>;
}

function errorMessage(e: PacksError): string {
  switch (e.kind) {
    case 'forbidden': return 'Kein Zugriff auf diesen Mandanten.';
    case 'payment_required':
      return PACKS_MIN_PLAN
        ? `Policy Packs sind erst ab ${PACKS_MIN_PLAN} verfügbar.`
        : 'Policy Packs sind im aktuellen Plan nicht enthalten.';
    default: return e.message;
  }
}

function bandColor(b: 'high' | 'medium' | 'low'): string {
  return b === 'high' ? 'text-emerald-400' : b === 'medium' ? 'text-amber-400' : 'text-titanium-500';
}

function PacksInner() {
  const { activeTenantId, hasFeature, tenants, refresh } = useTenant();
  const enabled = hasFeature('policy.packs');
  const activeTenant = tenants.find((t) => t.tenantId === activeTenantId) ?? null;
  const canEditIndustry = activeTenant?.role === 'owner';
  const industry = activeTenant?.industry ?? null;
  const [savingIndustry, setSavingIndustry] = useState(false);

  const [catalog, setCatalog] = useState<PolicyPack[]>([]);
  const [active, setActive] = useState<Set<string>>(new Set());
  const [mappings, setMappings] = useState<MappingStatus[]>([]);
  const [frameworkControls, setFrameworkControls] = useState<DbFrameworkControl[]>([]);
  const [tenantAssets, setTenantAssets] = useState<DbGovernanceAsset[]>([]);
  const [highRisk, setHighRisk] = useState<number>(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [updatingControlKey, setUpdatingControlKey] = useState<string | null>(null);
  const [expandedPacks, setExpandedPacks] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const dataVersion = useTenantDataVersion(activeTenantId);
  const skipNextVersionReload = useRef(false);

  const reload = useCallback(async () => {
    try {
      const [cat, ctrls] = await Promise.all([
        listCatalog(),
        fetchFrameworkControls().catch(() => [] as DbFrameworkControl[]),
      ]);
      setCatalog(cat);
      setFrameworkControls(ctrls);
      if (activeTenantId) {
        const [acts, maps, counts, assets] = await Promise.all([
          listActivations(activeTenantId),
          listTenantMappings(activeTenantId),
          countRiskInventory(activeTenantId),
          fetchTenantAssets(activeTenantId).catch(() => [] as DbGovernanceAsset[]),
        ]);
        setActive(acts);
        setMappings(maps);
        setHighRisk(counts?.high_risk ?? 0);
        setTenantAssets(assets);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [activeTenantId]);

  useEffect(() => {
    if (skipNextVersionReload.current) {
      skipNextVersionReload.current = false;
      return;
    }
    void reload();
  }, [reload, dataVersion]);

  const controlByKey = useMemo(() => {
    const map = new Map<string, DbFrameworkControl>();
    for (const c of frameworkControls) {
      map.set(`${c.framework}::${c.control_code}`, c);
    }
    return map;
  }, [frameworkControls]);

  const statusByKey = useMemo(() => {
    const map = new Map<string, ControlStatus>();
    for (const m of mappings) {
      map.set(`${m.framework}::${m.control_code}`, m.status);
    }
    return map;
  }, [mappings]);

  async function onToggle(pack: PolicyPack) {
    if (!activeTenantId) return;
    setBusy(pack.id); setError(null);
    const wasActive = active.has(pack.id);
    const r = await setPackActive({ tenant_id: activeTenantId, pack_id: pack.id, active: !wasActive });
    if (r.kind === 'ok') {
      setActive((prev) => {
        const n = new Set(prev);
        if (wasActive) n.delete(pack.id);
        else n.add(pack.id);
        return n;
      });
      if (!wasActive) {
        setExpandedPacks((prev) => new Set(prev).add(pack.id));
        const latestMaps = await listTenantMappings(activeTenantId);
        if (latestMaps.length === 0 && tenantAssets.length > 0) {
          for (const asset of tenantAssets) {
            await autoMapAsset(asset.id).catch(() => undefined);
          }
        }
      }
      await reload();
      notifyTenantDataChanged(activeTenantId);
    } else {
      setError(errorMessage(r));
    }
    setBusy(null);
  }

  function toggleExpandControls(packId: string) {
    setExpandedPacks((prev) => {
      const next = new Set(prev);
      if (next.has(packId)) next.delete(packId);
      else next.add(packId);
      return next;
    });
  }

  async function ensureTargetAssetId(): Promise<string | null> {
    if (!activeTenantId) return null;
    if (tenantAssets.length > 0) return tenantAssets[0].id;
    const created = await createAsset({
      tenant_id: activeTenantId,
      asset_type: 'ai_system',
      name: 'Workspace-Governance-Scope',
      description: 'Standard-Scope für Policy-Pack-Controls',
    });
    if (created.ok && created.asset?.id) {
      setTenantAssets([created.asset]);
      return created.asset.id;
    }
    return null;
  }

  async function onControlStatusChange(
    framework: string,
    controlCode: string,
    nextStatus: Exclude<ControlStatus, 'not_started'>,
  ) {
    if (!activeTenantId) return;
    const key = `${framework}::${controlCode}`;
    const ctrl = controlByKey.get(key);
    if (!ctrl?.id) {
      setError(`Control ${framework} ${controlCode} ist im Katalog nicht auflösbar.`);
      return;
    }
    setUpdatingControlKey(key);
    setError(null);
    const prevMappings = mappings;
    setMappings((prev) => {
      const rest = prev.filter((m) => !(m.framework === framework && m.control_code === controlCode));
      return [...rest, { framework, control_code: controlCode, status: nextStatus }];
    });
    try {
      const assetId = await ensureTargetAssetId();
      if (!assetId) {
        setMappings(prevMappings);
        setError('Kein Governance-Asset für Control-Mapping verfügbar.');
        return;
      }
      const res = await upsertMapping(assetId, ctrl.id, nextStatus);
      if (!res.ok) {
        setMappings(prevMappings);
        setError(res.error?.message ?? 'Control-Status konnte nicht gespeichert werden.');
        return;
      }
      skipNextVersionReload.current = true;
      notifyTenantDataChanged(activeTenantId);
    } catch (e) {
      setMappings(prevMappings);
      setError((e as Error)?.message ?? 'Control-Status konnte nicht gespeichert werden.');
    } finally {
      setUpdatingControlKey((curr) => (curr === key ? null : curr));
    }
  }

  const activateById = (packId: string) => {
    const pack = catalog.find((p) => p.id === packId);
    if (pack) void onToggle(pack);
  };

  async function onIndustryChange(next: string) {
    if (!activeTenantId || !canEditIndustry) return;
    setSavingIndustry(true); setError(null);
    const value = next === '' ? null : next;
    const { error: e } = await getSupabase().from('tenants').update({ industry: value }).eq('id', activeTenantId);
    if (e) setError(e.message);
    else await refresh();
    setSavingIndustry(false);
  }

  // Auto-Empfehlung: rankt den Katalog gegen die Tenant-Signale (Branche,
  // in-scope Frameworks + Hochrisiko-KI), schließt bereits aktivierte Packs aus.
  const openGapControls = mappings
    .filter((m) => m.status === 'gap' || m.status === 'not_started')
    .map((m) => ({ framework: m.framework, control_code: m.control_code }));

  const recommendations: PackRecommendation[] = topRecommendations(
    catalog.map((p) => ({ id: p.id, name: p.name, industry: p.industry, frameworks: p.frameworks, controls: p.controls })),
    {
      activeFrameworks: deriveActiveFrameworks(mappings),
      hasHighRiskAI: highRisk > 0,
      highRiskCount: highRisk,
      industry,
      openGapControls,
    },
    { excludePackIds: Array.from(active), limit: 4 },
  );

  return (
    <div className="bg-obsidian-950 text-titanium-100" data-testid="policy-packs-view">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-titanium-900 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-700">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="font-display text-sm font-semibold tracking-tight text-titanium-50">Policy Packs</h2>
              <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                DSGVO · EU AI Act · NIS2 · DORA · ISO 27001 · TISAX
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void reload()}>
            <RefreshCw className="h-3.5 w-3.5" /> Aktualisieren
          </Button>
        </div>

        {!enabled && (
          <div className="flex items-start gap-3 border border-amber-500/40 bg-amber-500/5 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="text-xs text-titanium-300">
              <p className="font-semibold text-amber-300">Policy Packs sind in deinem Plan nicht freigeschaltet.</p>
              {PACKS_MIN_PLAN && (
                <p className="mt-1">Vorkonfigurierte Compliance-Regelwerke sind ab <strong>{PACKS_MIN_PLAN}</strong> aktivierbar.</p>
              )}
            </div>
          </div>
        )}

        {error && <div className="border border-risk-critical/40 bg-risk-critical/5 px-4 py-3 text-xs text-risk-critical" role="alert">{error}</div>}

        {enabled && (
          <div className="flex flex-wrap items-center gap-3 border border-titanium-900 bg-obsidian-900 px-4 py-2.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">Branche</span>
            {canEditIndustry ? (
              <select
                value={industry ?? ''}
                onChange={(e) => onIndustryChange(e.target.value)}
                disabled={savingIndustry}
                className="border border-titanium-800 bg-obsidian-950 px-2 py-1 text-xs text-titanium-200 outline-none disabled:opacity-50"
              >
                <option value="">— nicht gesetzt —</option>
                {TENANT_INDUSTRY_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-titanium-300">
                {TENANT_INDUSTRY_OPTIONS.find((o) => o.id === industry)?.label ?? 'nicht gesetzt'}
              </span>
            )}
            <span className="text-[11px] text-titanium-500">
              {industry
                ? 'schärft die Empfehlungen um passende Branchen-Packs'
                : canEditIndustry
                  ? 'Branche wählen für passgenauere Pack-Empfehlungen'
                  : 'nur der Workspace-Owner kann die Branche setzen'}
            </span>
          </div>
        )}

        {enabled && recommendations.length > 0 && (
          <section className="border border-indigo-500/30 bg-indigo-500/5">
            <div className="flex items-center gap-2 border-b border-indigo-500/20 px-4 py-2.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
                Empfohlen für Sie
              </h2>
              <span className="font-mono text-[10px] text-titanium-500">
                auf Basis Ihrer genutzten Frameworks &amp; KI-Systeme
              </span>
            </div>
            <div className="grid gap-px bg-titanium-900 sm:grid-cols-2">
              {recommendations.map((rec) => (
                <div key={rec.packId} className="flex flex-col gap-2 bg-obsidian-950 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-titanium-50">{rec.name}</div>
                      <span
                        className={`mt-0.5 inline-block px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                          rec.tier === 'essential'
                            ? 'bg-security-500/15 text-security-400'
                            : 'bg-indigo-500/15 text-indigo-300'
                        }`}
                      >
                        {RECOMMENDATION_TIER_LABEL[rec.tier]}
                      </span>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => activateById(rec.packId)}
                      disabled={busy === rec.packId || !activeTenantId}
                    >
                      <Plus className="h-3.5 w-3.5" /> {busy === rec.packId ? 'Aktiviere…' : 'Aktivieren'}
                    </Button>
                  </div>
                  <ul className="space-y-1">
                    {rec.reasons.map((reason, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-titanium-400">
                        <Check className="mt-0.5 h-3 w-3 shrink-0 text-indigo-400" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {catalog.map((pack) => {
            const isActive = active.has(pack.id);
            const cov = computeCoverage(pack.controls, mappings);
            const band = coverageBand(cov.percent);
            const isExpanded = expandedPacks.has(pack.id);
            return (
              <Card key={pack.id} className={isActive ? 'border-emerald-500/40' : undefined}>
                <CardHeader
                  title={pack.name}
                  eyebrow={pack.industry === 'all' ? 'Alle Branchen' : pack.industry}
                  subtitle={pack.description ?? undefined}
                />
                <CardBody>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {pack.frameworks.map((fw) => (
                        <span key={fw} className="border border-titanium-800 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-titanium-300">
                          {frameworkLabel(fw)}
                        </span>
                      ))}
                      <span className="px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                        {pack.controls.length} Controls
                      </span>
                    </div>

                    {isActive && (
                      <div className="space-y-2">
                        <div>
                          <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                            <span>Abdeckung</span>
                            <span className={bandColor(band)} data-testid={`pack-coverage-${pack.id}`}>
                              {cov.percent}% · {cov.implemented}/{cov.total}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-obsidian-800">
                            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${cov.percent}%` }} />
                          </div>
                        </div>

                        {pack.controls.length > 0 && (
                          <div>
                            <button
                              type="button"
                              data-testid={`toggle-controls-${pack.id}`}
                              aria-expanded={isExpanded}
                              onClick={() => toggleExpandControls(pack.id)}
                              className="flex w-full items-center justify-between border border-titanium-800 bg-obsidian-900 px-2.5 py-1.5 font-mono text-[11px] text-titanium-300 hover:bg-obsidian-800"
                            >
                              <span>
                                Controls ({pack.controls.length}) {isExpanded ? 'einklappen' : 'aufklappen'}
                              </span>
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>

                            {isExpanded && (
                              <div
                                className="mt-2 max-h-72 space-y-1.5 overflow-y-auto border border-titanium-800 bg-obsidian-900/70 p-2"
                                data-testid={`pack-controls-list-${pack.id}`}
                              >
                                {pack.controls.map((c) => {
                                  const key = `${c.framework}::${c.control_code}`;
                                  const status: ControlStatus = statusByKey.get(key) ?? 'not_started';
                                  const ctrl = controlByKey.get(key);
                                  const isUpdating = updatingControlKey === key;
                                  return (
                                    <div
                                      key={key}
                                      data-testid={`pack-control-${c.framework}-${c.control_code}`}
                                      className="flex flex-col gap-1.5 border border-titanium-800/80 bg-obsidian-950 p-2 text-xs"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <div className="font-mono text-[11px] text-titanium-200">
                                            {frameworkLabel(c.framework)} · {c.control_code}
                                          </div>
                                          {ctrl?.title && (
                                            <div className="truncate text-[11px] text-titanium-400" title={ctrl.title}>
                                              {ctrl.title}
                                            </div>
                                          )}
                                        </div>
                                        <span className="shrink-0 border border-titanium-800 px-1.5 py-0.5 font-mono text-[10px] text-titanium-300">
                                          {STATUS_LABEL[status]}
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap gap-1" role="group" aria-label={`${c.framework} ${c.control_code} Status`}>
                                        {STATUS_OPTIONS.map((opt) => {
                                          const activeOpt = status === opt.value;
                                          return (
                                            <button
                                              key={opt.value}
                                              type="button"
                                              aria-pressed={activeOpt}
                                              disabled={isUpdating || !activeTenantId}
                                              data-testid={`control-status-${c.framework}-${c.control_code}-${opt.value}`}
                                              onClick={() => void onControlStatusChange(c.framework, c.control_code, opt.value)}
                                              className={`border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                                                activeOpt
                                                  ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                                                  : 'border-titanium-800 bg-obsidian-900 text-titanium-400 hover:text-titanium-200'
                                              }`}
                                            >
                                              {opt.label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <Button
                      variant={isActive ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={() => onToggle(pack)}
                      disabled={busy === pack.id || !enabled || !activeTenantId}
                    >
                      {isActive
                        ? <><Check className="h-3.5 w-3.5" /> Aktiviert — deaktivieren</>
                        : <><Plus className="h-3.5 w-3.5" /> {busy === pack.id ? 'Aktiviere…' : 'Aktivieren'}</>}
                    </Button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
