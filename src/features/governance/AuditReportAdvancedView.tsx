import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Download, Loader2, AlertTriangle, CheckCircle2, BarChart3,
  TrendingUp, Filter, FileText, ChevronRight, Clock, Zap, Award,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';

interface AuditReport {
  id: string;
  title: string;
  frameworks_covered: string[];
  compliance_score: number;
  compliance_by_framework: Record<string, number>;
  findings_count: number;
  critical_findings: number;
  status: 'draft' | 'in_review' | 'finalized' | 'archived';
  scope: string;
  created_at: string;
  finalized_at: string | null;
  created_by: string;
  report_type: 'self_assessment' | 'internal_audit' | 'external_audit' | 'remediation_verification';
}

export function AuditReportAdvancedView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [reports, setReports] = useState<AuditReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const reload = async () => {
    if (!activeTenantId) return;
    setError(null);
    setReports(null);

    try {
      const response = await fetch(
        `/functions/v1/governance-resources?tenant_id=${activeTenantId}&resource_type=audit_reports`,
        { headers: { Authorization: `Bearer ${(await import('../../lib/auth')).getAuthToken()}` } }
      );
      if (!response.ok) throw new Error('Failed to load');
      const data = await response.json();
      setReports(data.reports || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
  };

  useEffect(() => { void reload(); }, [activeTenantId]);

  const filtered = reports?.filter(r =>
    (filterStatus === 'all' || r.status === filterStatus) &&
    (filterType === 'all' || r.report_type === filterType)
  ) || [];

  const finalizedReports = reports?.filter(r => r.status === 'finalized').length || 0;
  const criticalFindingsTotal = reports?.reduce((sum, r) => sum + r.critical_findings, 0) || 0;
  const avgCompliance = reports?.length ? Math.round(reports.reduce((sum, r) => sum + r.compliance_score, 0) / reports.length) : 0;

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Audit-Berichte</div>
              <div className="text-[11px] text-titanium-400 font-medium">Multi-Framework Compliance Reporting</div>
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
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-purple-400 disabled:opacity-50 transition-colors"
          >
            <FileText className="h-4 w-4" /> Bericht erstellen
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {criticalFindingsTotal > 0 && (
          <div className="mb-4 flex items-start gap-3 text-sm bg-red-950/50 border border-red-900 rounded-none p-3">
            <Zap className="h-5 w-5 shrink-0 mt-0.5 text-red-400" />
            <div>
              <div className="font-semibold text-red-300">{criticalFindingsTotal} kritische Befunde!</div>
              <div className="text-red-200 text-xs mt-1">Detaillierte Überprüfung und Maßnahmen erforderlich.</div>
            </div>
          </div>
        )}

        {!activeTenantId ? (
          <div className="text-titanium-500 text-sm">Tenant wählen.</div>
        ) : reports === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Laden…
          </div>
        ) : (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-purple-900 to-indigo-900 border border-purple-800 rounded-none p-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-white mb-1">Durchschnittliche Konformität</h3>
                    <p className="text-[12px] text-purple-200">Alle Berichte</p>
                  </div>
                  <Award className="h-6 w-6 text-purple-300" />
                </div>
                <div className="text-4xl font-bold text-white">{avgCompliance}%</div>
              </div>

              <div className="bg-obsidian-900 border border-green-900 rounded-none p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-[12px] text-green-300 font-semibold">FINALISIERT</span>
                </div>
                <div className="text-3xl font-bold text-green-400">{finalizedReports}</div>
                <p className="text-[11px] text-titanium-400 mt-1">Abgeschlossene Berichte</p>
              </div>

              <div className="bg-obsidian-900 border border-red-900 rounded-none p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <span className="text-[12px] text-red-300 font-semibold">KRITISCH</span>
                </div>
                <div className="text-3xl font-bold text-red-400">{criticalFindingsTotal}</div>
                <p className="text-[11px] text-titanium-400 mt-1">Kritische Befunde</p>
              </div>
            </div>

            {/* Explanation */}
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <h3 className="font-semibold text-titanium-50 mb-2 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Audit-Berichte
              </h3>
              <p className="text-[12px] text-titanium-300">
                Umfassende Compliance-Berichte, die mehrere regulatorische Frameworks (DSGVO, AI Act, NIS2, ISO 27001, ISO 42001) abdecken.
                Jeder Bericht enthält Befunde, Erkenntnisse und maßgeschneiderte Behebungsroadmaps.
              </p>
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
                  <option value="draft">Entwurf</option>
                  <option value="in_review">In Überprüfung</option>
                  <option value="finalized">Finalisiert</option>
                  <option value="archived">Archiviert</option>
                </select>
              </div>
              <div className="flex items-center gap-2 text-[12px]">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-obsidian-900 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium"
                >
                  <option value="all">Typ: Alle</option>
                  <option value="self_assessment">Selbstbewertung</option>
                  <option value="internal_audit">Interner Audit</option>
                  <option value="external_audit">Externer Audit</option>
                  <option value="remediation_verification">Behebungsverifikation</option>
                </select>
              </div>
            </div>

            {/* Reports Grid */}
            {filtered.length === 0 ? (
              <div className="text-center py-20 bg-obsidian-900 border border-titanium-900 rounded-none">
                <FileText className="h-12 w-12 text-titanium-600 mx-auto mb-3" />
                <h3 className="font-semibold text-titanium-50 mb-1">Keine Berichte gefunden</h3>
                <p className="text-titanium-400 text-sm">Erstellen Sie einen Audit-Bericht, um Ihre Multi-Framework-Compliance zu dokumentieren.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((report) => (
                  <AuditReportCard key={report.id} report={report} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function AuditReportCard({ report }: { report: AuditReport }) {
  const statusConfig = {
    draft: { bg: 'bg-slate-950', border: 'border-slate-800', text: 'text-slate-300', label: '📝 Entwurf' },
    in_review: { bg: 'bg-blue-950', border: 'border-blue-900', text: 'text-blue-300', label: '👁️ In Überprüfung' },
    finalized: { bg: 'bg-green-950', border: 'border-green-900', text: 'text-green-300', label: '✓ Finalisiert' },
    archived: { bg: 'bg-titanium-900', border: 'border-titanium-800', text: 'text-titanium-300', label: '📦 Archiviert' },
  }[report.status];

  const reportTypeLabel = {
    self_assessment: 'Selbstbewertung',
    internal_audit: 'Interner Audit',
    external_audit: 'Externer Audit',
    remediation_verification: 'Behebungsverifikation',
  }[report.report_type];

  const complianceColor = report.compliance_score >= 80 ? 'text-green-300' :
    report.compliance_score >= 60 ? 'text-yellow-300' :
    report.compliance_score >= 40 ? 'text-orange-300' : 'text-red-300';

  return (
    <div className={`${statusConfig.bg} border ${statusConfig.border} rounded-none p-4`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-titanium-50 line-clamp-2">{report.title}</h4>
          <p className="text-[11px] text-titanium-400 mt-1">{reportTypeLabel}</p>
        </div>
        <span className={`${statusConfig.text} text-[11px] font-semibold px-2 py-1 rounded-none whitespace-nowrap`}>
          {statusConfig.label}
        </span>
      </div>

      {/* Compliance Score & Frameworks */}
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <div className="text-[11px] text-titanium-400 mb-2">Gesamtkonformität</div>
          <div className={`text-2xl font-bold ${complianceColor}`}>{report.compliance_score}%</div>
        </div>
        <div>
          <div className="text-[11px] text-titanium-400 mb-2">Frameworks ({report.frameworks_covered.length})</div>
          <div className="flex flex-wrap gap-1">
            {report.frameworks_covered.map((fw) => (
              <span key={fw} className="bg-obsidian-900 border border-titanium-700 text-titanium-300 text-[10px] px-1.5 py-0.5 rounded-none">
                {fw.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Framework Scores */}
      {Object.keys(report.compliance_by_framework).length > 0 && (
        <div className="mb-3 bg-obsidian-900 border border-titanium-900 rounded-none p-2">
          <div className="text-[11px] text-titanium-400 mb-1 font-semibold">Scores pro Framework</div>
          <div className="space-y-1">
            {Object.entries(report.compliance_by_framework).map(([fw, score]) => (
              <div key={fw} className="flex items-center justify-between text-[10px]">
                <span className="text-titanium-300 font-mono uppercase">{fw}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1 bg-titanium-800 rounded-none overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-blue-400"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <span className="text-titanium-200 font-semibold w-6 text-right">{score}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Findings Summary */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-[11px]">
        <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-2">
          <div className="text-titanium-400">Befunde gesamt</div>
          <div className="text-titanium-200 font-semibold">{report.findings_count}</div>
        </div>
        <div className="bg-obsidian-900 border border-red-900 rounded-none p-2">
          <div className="text-red-400">🔴 Kritisch</div>
          <div className="text-red-200 font-semibold">{report.critical_findings}</div>
        </div>
        <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-2">
          <div className="text-titanium-400">Erstellt am</div>
          <div className="text-titanium-200 font-mono text-[10px]">
            {new Date(report.created_at).toLocaleDateString('de-DE')}
          </div>
        </div>
      </div>

      {/* Scope */}
      {report.scope && (
        <div className="mb-3 text-[11px] p-2 bg-obsidian-900 border border-titanium-900 rounded-none">
          <div className="text-titanium-400 font-semibold mb-1">Umfang</div>
          <p className="text-titanium-300 line-clamp-2">{report.scope}</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Link
          to={`/app/audit-report/${report.id}`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 border border-titanium-700 hover:border-purple-500 text-titanium-200 hover:text-purple-300 text-xs font-medium rounded-none transition-colors"
        >
          <FileText className="h-3 w-3" /> Details
        </Link>
        <button
          className="px-3 py-1.5 border border-titanium-700 hover:border-blue-500 text-titanium-400 hover:text-blue-300 text-xs font-medium rounded-none transition-colors flex items-center gap-1"
          title="Bericht herunterladen"
        >
          <Download className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
