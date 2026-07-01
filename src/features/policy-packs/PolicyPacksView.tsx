import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, AlertTriangle, Check, Plus, RefreshCw } from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { Button } from '../../enterprise-os/components/Button';
import { Card, CardHeader, CardBody } from '../../enterprise-os/components/Card';
import { computeCoverage, coverageBand, frameworkLabel, type MappingStatus } from '../../lib/policy-packs/coverage';
import { listCatalog, listActivations, listTenantMappings, setPackActive, type PolicyPack, type PacksError } from './policyPacksApi';

/**
 * /app/policy-packs — Policy Packs Marketplace: aktivierbare, vorkonfigurierte
 * Compliance-Regelwerke (DSGVO, EU AI Act, NIS2, DORA, ISO 27001, TISAX + Kombi).
 * Ab Agency (Entitlement policy.packs). Abdeckung wird gegen die
 * asset_control_mappings des Tenants berechnet.
 */
export function PolicyPacksView() {
  return <AuthGate>{() => <PacksInner />}</AuthGate>;
}

function errorMessage(e: PacksError): string {
  switch (e.kind) {
    case 'forbidden': return 'Kein Zugriff auf diesen Mandanten.';
    case 'payment_required': return 'Policy Packs sind erst ab Agency verfügbar.';
    default: return e.message;
  }
}

function bandColor(b: 'high' | 'medium' | 'low'): string {
  return b === 'high' ? 'text-emerald-400' : b === 'medium' ? 'text-amber-400' : 'text-titanium-500';
}

function PacksInner() {
  const { activeTenantId, hasFeature } = useTenant();
  const enabled = hasFeature('policy.packs');

  const [catalog, setCatalog] = useState<PolicyPack[]>([]);
  const [active, setActive] = useState<Set<string>>(new Set());
  const [mappings, setMappings] = useState<MappingStatus[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const cat = await listCatalog();
      setCatalog(cat);
      if (activeTenantId) {
        const [acts, maps] = await Promise.all([listActivations(activeTenantId), listTenantMappings(activeTenantId)]);
        setActive(acts); setMappings(maps);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [activeTenantId]);

  useEffect(() => { reload(); }, [reload]);

  async function onToggle(pack: PolicyPack) {
    if (!activeTenantId) return;
    setBusy(pack.id); setError(null);
    const wasActive = active.has(pack.id);
    const r = await setPackActive({ tenant_id: activeTenantId, pack_id: pack.id, active: !wasActive });
    if (r.kind === 'ok') {
      setActive((prev) => { const n = new Set(prev); if (wasActive) n.delete(pack.id); else n.add(pack.id); return n; });
    } else {
      setError(errorMessage(r));
    }
    setBusy(null);
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="flex h-14 items-center justify-between border-b border-titanium-900 bg-obsidian-900 px-4">
        <div className="flex items-center gap-3">
          <Link to="/app" className="p-1.5 text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-700">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="font-display text-sm font-semibold tracking-tight text-titanium-50">Policy Packs</h1>
              <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                DSGVO · EU AI Act · NIS2 · DORA · ISO 27001 · TISAX
              </p>
            </div>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={reload}><RefreshCw className="h-3.5 w-3.5" /> Aktualisieren</Button>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6 sm:px-6">
        {!enabled && (
          <div className="flex items-start gap-3 border border-amber-500/40 bg-amber-500/5 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="text-xs text-titanium-300">
              <p className="font-semibold text-amber-300">Policy Packs sind in deinem Plan nicht freigeschaltet.</p>
              <p className="mt-1">Vorkonfigurierte Compliance-Regelwerke sind ab <strong>Agency</strong> aktivierbar.</p>
            </div>
          </div>
        )}

        {error && <div className="border border-risk-critical/40 bg-risk-critical/5 px-4 py-3 text-xs text-risk-critical">{error}</div>}

        <div className="grid gap-4 sm:grid-cols-2">
          {catalog.map((pack) => {
            const isActive = active.has(pack.id);
            const cov = computeCoverage(pack.controls, mappings);
            const band = coverageBand(cov.percent);
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
                      <div>
                        <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                          <span>Abdeckung</span>
                          <span className={bandColor(band)}>{cov.percent}% · {cov.implemented}/{cov.total}</span>
                        </div>
                        <div className="h-1.5 w-full bg-obsidian-800">
                          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${cov.percent}%` }} />
                        </div>
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
