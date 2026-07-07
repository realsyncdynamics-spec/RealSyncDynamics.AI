import { useState, useEffect } from 'react';
import { useSupabaseAuth } from '../supabase/SupabaseAuthContext';
import { useTenant } from '../../core/access/TenantProvider';
import {
  DownloadCloud,
  FileText,
  CheckCircle,
  AlertCircle,
  Calendar,
  Filter,
  Loader,
} from 'lucide-react';

type ReportType = 'dsgvo_access_log' | 'eu_ai_act_audit' | 'data_processing' | 'export_history';
type ReportFormat = 'json' | 'csv';

interface ReportGeneration {
  type: ReportType;
  format: ReportFormat;
  startDate: string;
  endDate: string;
  loading: boolean;
  error: string | null;
}

interface ComplianceMetric {
  label: string;
  value: string | number;
  status: 'compliant' | 'warning' | 'error';
  icon: 'check' | 'alert' | 'info';
}

export function ComplianceReportPanel() {
  const { session } = useSupabaseAuth();
  const { activeTenantId } = useTenant();
  const [reportGen, setReportGen] = useState<ReportGeneration>({
    type: 'dsgvo_access_log',
    format: 'json',
    startDate: getDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
    endDate: getDateString(new Date()),
    loading: false,
    error: null,
  });

  const [complianceMetrics, setComplianceMetrics] = useState<ComplianceMetric[]>([]);
  const [auditSummary, setAuditSummary] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    loadAuditSummary();
  }, [activeTenantId]);

  async function loadAuditSummary() {
    if (!session?.access_token || !activeTenantId) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/seo_audit_summary?tenant_id=eq.${activeTenantId}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            Accept: 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setAuditSummary(data[0]);
          updateComplianceMetrics(data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load audit summary:', error);
    }
  }

  function updateComplianceMetrics(summary: Record<string, unknown>) {
    const totalOps = (summary.total_operations as number) || 0;
    const uniqueUsers = (summary.unique_users as number) || 0;
    const exportCount = (summary.export_count as number) || 0;
    const errorCount = (summary.error_count as number) || 0;

    const metrics: ComplianceMetric[] = [
      {
        label: 'Gesamtoperationen',
        value: totalOps,
        status: 'compliant',
        icon: 'check',
      },
      {
        label: 'Eindeutige Benutzer',
        value: uniqueUsers,
        status: 'compliant',
        icon: 'check',
      },
      {
        label: 'Exporte erfasst',
        value: exportCount,
        status: exportCount > 0 ? 'compliant' : 'warning',
        icon: exportCount > 0 ? 'check' : 'alert',
      },
      {
        label: 'Fehlerrate',
        value: `${(((errorCount / Math.max(totalOps, 1)) * 100).toFixed(2))}%`,
        status: errorCount > 0 ? 'warning' : 'compliant',
        icon: errorCount > 0 ? 'alert' : 'check',
      },
    ];
    setComplianceMetrics(metrics);
  }

  async function generateReport() {
    if (!session?.access_token || !activeTenantId) return;

    setReportGen(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-compliance-report`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenant_id: activeTenantId,
            report_type: reportGen.type,
            start_date: reportGen.startDate,
            end_date: reportGen.endDate,
            format: reportGen.format,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Report generation failed: ${response.statusText}`);
      }

      // Download file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportGen.type}_${getDateString(new Date())}.${reportGen.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setReportGen(prev => ({ ...prev, loading: false }));
    } catch (error) {
      setReportGen(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Fehler beim Generieren des Berichts',
      }));
    }
  }

  const reportTypeLabels: Record<ReportType, string> = {
    dsgvo_access_log: 'DSGVO Zugriffsverlauf',
    eu_ai_act_audit: 'EU AI Act Audit-Trail',
    data_processing: 'Datenverarbeitung',
    export_history: 'Exportverlauf',
  };

  return (
    <div className="space-y-6">
      {/* Compliance Status Cards */}
      <div className="bg-obsidian-900 border border-obsidian-700 rounded-sm p-4">
        <h3 className="text-titanium-200 font-mono text-sm mb-4">COMPLIANCE-STATUS</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {complianceMetrics.map((metric, idx) => (
            <div key={idx} className="p-3 bg-obsidian-800 border border-obsidian-700 rounded-sm">
              <div className="flex items-center gap-2 mb-2">
                {metric.icon === 'check' && (
                  <CheckCircle size={16} className="text-green-500" />
                )}
                {metric.icon === 'alert' && (
                  <AlertCircle size={16} className="text-yellow-500" />
                )}
                <span className="text-titanium-400 text-xs font-mono">{metric.label}</span>
              </div>
              <div className="text-titanium-50 text-lg font-mono">{metric.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Report Generator */}
      <div className="bg-obsidian-900 border border-obsidian-700 rounded-sm p-4">
        <h3 className="text-titanium-200 font-mono text-sm mb-4">COMPLIANCE-BERICHT</h3>

        {reportGen.error && (
          <div className="mb-4 p-3 bg-red-950 border border-red-700 rounded-sm">
            <div className="flex gap-2 items-start">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-red-200 text-sm font-mono">{reportGen.error}</span>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Report Type Selection */}
          <div>
            <label className="text-titanium-300 text-xs font-mono block mb-2">Berichtstyp</label>
            <select
              value={reportGen.type}
              onChange={e => setReportGen(prev => ({ ...prev, type: e.target.value as ReportType }))}
              disabled={reportGen.loading}
              className="w-full bg-obsidian-800 border border-obsidian-600 text-titanium-50 px-3 py-2 rounded-sm text-sm font-mono focus:outline-none focus:border-security-blue disabled:opacity-50"
            >
              {Object.entries(reportTypeLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-titanium-300 text-xs font-mono block mb-2">Von</label>
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-titanium-500" />
                <input
                  type="date"
                  value={reportGen.startDate}
                  onChange={e => setReportGen(prev => ({ ...prev, startDate: e.target.value }))}
                  disabled={reportGen.loading}
                  className="flex-1 bg-obsidian-800 border border-obsidian-600 text-titanium-50 px-3 py-2 rounded-sm text-sm font-mono focus:outline-none focus:border-security-blue disabled:opacity-50"
                />
              </div>
            </div>
            <div>
              <label className="text-titanium-300 text-xs font-mono block mb-2">Bis</label>
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-titanium-500" />
                <input
                  type="date"
                  value={reportGen.endDate}
                  onChange={e => setReportGen(prev => ({ ...prev, endDate: e.target.value }))}
                  disabled={reportGen.loading}
                  className="flex-1 bg-obsidian-800 border border-obsidian-600 text-titanium-50 px-3 py-2 rounded-sm text-sm font-mono focus:outline-none focus:border-security-blue disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <label className="text-titanium-300 text-xs font-mono block mb-2">Format</label>
            <div className="flex gap-2">
              {(['json', 'csv'] as ReportFormat[]).map(format => (
                <button
                  key={format}
                  onClick={() => setReportGen(prev => ({ ...prev, format }))}
                  disabled={reportGen.loading}
                  className={`flex-1 px-3 py-2 rounded-sm text-sm font-mono transition-colors ${
                    reportGen.format === format
                      ? 'bg-security-blue text-titanium-50'
                      : 'bg-obsidian-800 text-titanium-300 border border-obsidian-600 hover:border-obsidian-500'
                  } disabled:opacity-50`}
                >
                  {format.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={generateReport}
            disabled={reportGen.loading}
            className="w-full bg-security-blue text-titanium-50 px-4 py-2 rounded-sm font-mono text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {reportGen.loading ? (
              <>
                <Loader size={16} className="animate-spin" />
                Wird generiert...
              </>
            ) : (
              <>
                <DownloadCloud size={16} />
                Bericht generieren
              </>
            )}
          </button>
        </div>
      </div>

      {/* Report Information */}
      <div className="bg-obsidian-800 border border-obsidian-700 rounded-sm p-4">
        <div className="flex gap-3 items-start">
          <FileText size={16} className="text-titanium-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-titanium-200 text-sm font-mono mb-2">Verfügbare Berichte</h4>
            <ul className="space-y-1 text-titanium-400 text-xs font-mono">
              <li>• <strong>DSGVO-Zugriffsverlauf:</strong> Alle Benutzer-Zugriffe und Operationen im Zeitraum</li>
              <li>• <strong>EU AI Act Audit:</strong> Detaillierte Aufzeichnung von KI-System-Entscheidungen und Fehler</li>
              <li>• <strong>Datenverarbeitung:</strong> Verarbeitete Datenmengen, Aufbewahrungsrichtlinien und Compliance-Status</li>
              <li>• <strong>Exportverlauf:</strong> Alle durchgeführten Datenexporte mit Klassifizierung</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function getDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
