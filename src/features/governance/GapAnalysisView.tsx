import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, AlertTriangle, CheckCircle2, Clock, Zap, Filter,
  TrendingDown, Target, FileText, ChevronRight,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';

interface ComplianceGap {
  id: string;
  framework_code: string;
  control_id: string;
  control_name: string;
  description: string;
  status: 'identified' | 'planned' | 'in_progress' | 'resolved' | 'accepted_risk' | 'deferred';
  severity: 'low' | 'medium' | 'high' | 'critical';
  risk_level: number;
  priority: number;
  remediation_plan?: string;
  target_resolution_date: string | null;
  created_at: string;
}

export function GapAnalysisView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [gaps, setGaps] = useState<ComplianceGap[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  const reload = async () => {
    if (!activeTenantId) return;
    setError(null);
    setGaps(null);

    try {
      const response = await fetch(
        `/functions/v1/governance-resources?tenant_id=${activeTenantId}&resource_type=compliance_gaps`,
        { headers: { Authorization: `Bearer ${(await import('../../lib/auth')).getAuthToken()}` } }
      );
      if (!response.ok) throw new Error('Failed to load');
      const data = await response.json();
      setGaps(data.gaps || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
  };

  useEffect(() => { void reload(); }, [activeTenantId]);

  const filtered = gaps?.filter(g =>
    (filterStatus === 'all' || g.status === filterStatus) &&
    (filterSeverity === 'all' || g.severity === filterSeverity)
  ) || [];

  const criticalCount = gaps?.filter(g => g.severity === 'critical').length || 0;
  const highCount = gaps?.filter(g => g.severity === 'high').length || 0;
  const resolvedCount = gaps?.filter(g => g.status === 'resolved').length || 0;
  const totalGaps = gaps?.length || 0;
  const complianceScore = totalGaps > 0 ? Math.round(((resolvedCount + (gaps?.filter(g => g.status === 'accepted_risk').length || 0)) / totalGaps) * 100) : 0;

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
              <Target className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Gap-Analyse</div>
              <div className="text-[11px] text-titanium-400 font-medium">Identifizierte Compliance-Lücken</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tenants.length > 1 && (
            <select
              value={activeTenantId ?? ''}
              onChange={(e) => setActiveTenant(e.target.value)}
              className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800 max-w-[200px]"
            >
              {tenants.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>{t.name}</option>
              ))}
            </select>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {criticalCount > 0 && (
          <div className="mb-4 flex items-start gap-3 text-sm bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-red-400" />
            <div>
              <div className="font-semibold text-red-300">{criticalCount} kritische Lücken!</div>
              <div className="text-red-200 text-xs mt-1">Sofortige Remediation erforderlich.</div>
            </div>
          </div>
        )}

        {!activeTenantId ? (
          <div className="text-titanium-500 text-sm">Tenant wählen.</div>
        ) : gaps === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Laden…
          </div>
        ) : (
          <div className="space-y-6">
            {/* Compliance Score */}
            <div className="bg-gradient-to-r from-amber-900 to-orange-900 border border-amber-800 rounded-none p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white mb-1">Gap-Remediation Fortschritt</h3>
                  <p className="text-[12px] text-amber-200">{resolvedCount} von {totalGaps} Lücken behoben</p>
                </div>
                <div className="text-right">
                  <div className="text-5xl font-bold text-white">{complianceScore}%</div>
                  <div className="text-[11px] text-amber-200 mt-1">Bereinigung</div>
                </div>
              </div>
              <div className="mt-4 h-2 bg-amber-950 rounded-none overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-400 to-amber-400" style={{ width: `${complianceScore}%` }} />
              </div>
            </div>

            {/* Critical Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-obsidian-900 border border-red-900 rounded-none p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-red-400" />
                  <span className="text-[12px] text-red-300 font-semibold">KRITISCH</span>
                </div>
                <div className="text-3xl font-bold text-red-400">{criticalCount}</div>
                <p className="text-[11px] text-titanium-400 mt-1">Sofortige Maßnahmen</p>
              </div>

              <div className="bg-obsidian-900 border border-orange-900 rounded-none p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-orange-400" />
                  <span className="text-[12px] text-orange-300 font-semibold">HOCH</span>
                </div>
                <div className="text-3xl font-bold text-orange-400">{highCount}</div>
                <p className="text-[11px] text-titanium-400 mt-1">Hohe Priorität</p>
              </div>

              <div className="bg-obsidian-900 border border-green-900 rounded-none p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-[12px] text-green-300 font-semibold">BEHOBEN</span>
                </div>
                <div className="text-3xl font-bold text-green-400">{resolvedCount}</div>
                <p className="text-[11px] text-titanium-400 mt-1">Lücken behoben</p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-[12px]">
                <Filter className="h-4 w-4 text-titanium-400" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-obsidian-900 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium"
                >
                  <option value="all">Status: Alle</option>
                  <option value="identified">Identifiziert</option>
                  <option value="planned">Geplant</option>
                  <option value="in_progress">In Arbeit</option>
                  <option value="resolved">Behoben</option>
                  <option value="accepted_risk">Risiko akzeptiert</option>
                  <option value="deferred">Aufgeschoben</option>
                </select>
              </div>
              <div className="flex items-center gap-2 text-[12px]">
                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  className="bg-obsidian-900 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium"
                >
                  <option value="all">Schweregrad: Alle</option>
                  <option value="critical">Kritisch</option>
                  <option value="high">Hoch</option>
                  <option value="medium">Mittel</option>
                  <option value="low">Niedrig</option>
                </select>
              </div>
            </div>

            {/* Gaps Grid */}
            {filtered.length === 0 ? (
              <div className="text-center py-20 bg-obsidian-900 border border-titanium-900 rounded-none">
                <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
                <h3 className="font-semibold text-titanium-50 mb-1">Keine Lücken gefunden</h3>
                <p className="text-titanium-400 text-sm">Alle gefilterten Compliance-Lücken wurden behoben.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.sort((a, b) => {
                  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                  return (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
                }).map((gap) => (
                  <GapCard key={gap.id} gap={gap} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function GapCard({ gap }: { gap: ComplianceGap }) {
  const severityConfig = {
    critical: { bg: 'bg-red-950', border: 'border-red-900', text: 'text-red-300', label: '🔴 KRITISCH', icon: Zap },
    high: { bg: 'bg-orange-950', border: 'border-orange-900', text: 'text-orange-300', label: '🟠 HOCH', icon: AlertTriangle },
    medium: { bg: 'bg-yellow-950', border: 'border-yellow-900', text: 'text-yellow-300', label: '🟡 MITTEL', icon: Clock },
    low: { bg: 'bg-slate-900', border: 'border-slate-800', text: 'text-slate-300', label: '⚪ NIEDRIG', icon: TrendingDown },
  }[gap.severity];

  const statusLabel = {
    identified: 'Identifiziert',
    planned: 'Geplant',
    in_progress: 'In Arbeit',
    resolved: 'Behoben',
    accepted_risk: 'Risiko akzeptiert',
    deferred: 'Aufgeschoben',
  }[gap.status];

  const SeverityIcon = severityConfig?.icon || AlertTriangle;

  return (
    <div className={`${severityConfig?.bg} border ${severityConfig?.border} rounded-none p-4`}>
      <div className="flex items-start gap-4">
        <div className="shrink-0 mt-0.5">
          <SeverityIcon className={`h-5 w-5 ${severityConfig?.text}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h4 className="font-semibold text-titanium-50">{gap.control_name}</h4>
              <p className="text-[11px] text-titanium-400 mt-1 line-clamp-2">{gap.description}</p>
            </div>
            <div className={`text-[11px] font-semibold px-2 py-1 rounded-none whitespace-nowrap ${severityConfig?.text}`}>
              {severityConfig?.label}
            </div>
          </div>

          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-titanium-400">Framework</span>
              <span className="font-mono text-[11px] text-titanium-200">{gap.framework_code.toUpperCase()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-titanium-400">Status</span>
              <span className="text-[11px] font-semibold text-titanium-200 capitalize">
                {statusLabel}
              </span>
            </div>
            {gap.target_resolution_date && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-titanium-400">Zieltermin</span>
                <span className="text-[11px] font-mono text-titanium-200">
                  {new Date(gap.target_resolution_date).toLocaleDateString('de-DE')}
                </span>
              </div>
            )}
          </div>

          {gap.remediation_plan && (
            <div className="mb-3 p-2 bg-obsidian-900 border border-titanium-900 rounded-none text-[11px] text-titanium-300">
              <div className="font-semibold text-titanium-200 mb-1 flex items-center gap-1">
                <FileText className="h-3 w-3" /> Maßnahmen
              </div>
              <p className="line-clamp-2">{gap.remediation_plan}</p>
            </div>
          )}

          <Link
            to={`/app/gaps/${gap.id}`}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-blue-400 hover:text-blue-300 hover:underline"
          >
            Details & Remediation <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
