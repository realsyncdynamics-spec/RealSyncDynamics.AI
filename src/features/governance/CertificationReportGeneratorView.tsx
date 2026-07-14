import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, FileText, Loader2, AlertTriangle, Download, Eye, Zap,
  Settings, Calendar, Users, CheckCircle2, BarChart3, Lock,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getAuthToken } from '../../lib/auth';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  format: 'pdf' | 'html' | 'markdown';
  includes_evidence: boolean;
  includes_findings: boolean;
  includes_timeline: boolean;
  estimated_pages: number;
}

interface ReportGenerationState {
  status: 'idle' | 'generating' | 'complete' | 'error';
  progress: number;
  error_message?: string;
  generated_report?: {
    id: string;
    filename: string;
    format: string;
    size_kb: number;
    generated_at: string;
    download_url?: string;
  };
}

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'template-1',
    name: 'Executive Summary',
    description: 'Kurzübersicht für Geschäftsführung und Zertifizierungsstelle (5-10 Seiten)',
    format: 'pdf',
    includes_evidence: false,
    includes_findings: true,
    includes_timeline: true,
    estimated_pages: 8,
  },
  {
    id: 'template-2',
    name: 'Comprehensive Assessment Report',
    description: 'Vollständiger Bericht mit allen Kontrollen, Evidenz und Bewertungen (20-50 Seiten)',
    format: 'pdf',
    includes_evidence: true,
    includes_findings: true,
    includes_timeline: true,
    estimated_pages: 35,
  },
  {
    id: 'template-3',
    name: 'Technical Implementation Details',
    description: 'Technische Dokumentation für Auditor Review (10-30 Seiten)',
    format: 'pdf',
    includes_evidence: true,
    includes_findings: false,
    includes_timeline: false,
    estimated_pages: 20,
  },
  {
    id: 'template-4',
    name: 'Gap Analysis Report',
    description: 'Identifizierte Lücken mit Remediation Plan (5-15 Seiten)',
    format: 'pdf',
    includes_evidence: false,
    includes_findings: true,
    includes_timeline: true,
    estimated_pages: 10,
  },
  {
    id: 'template-5',
    name: 'Interactive HTML Report',
    description: 'Web-basierter Report mit Suchfunktion und Filterung (1 Datei)',
    format: 'html',
    includes_evidence: true,
    includes_findings: true,
    includes_timeline: true,
    estimated_pages: 0,
  },
  {
    id: 'template-6',
    name: 'Markdown Documentation',
    description: 'Versionskontrollierbare Markdown-Dokumentation (GitHub-kompatibel)',
    format: 'markdown',
    includes_evidence: true,
    includes_findings: true,
    includes_timeline: false,
    estimated_pages: 0,
  },
];

export function CertificationReportGeneratorView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { activeTenantId } = useTenant();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [reportState, setReportState] = useState<ReportGenerationState>({ status: 'idle', progress: 0 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [includeSignature, setIncludeSignature] = useState(false);
  const [reportMetadata, setReportMetadata] = useState({
    organization_name: '',
    audit_date: new Date().toISOString().split('T')[0],
    auditor_name: '',
    certification_body: 'TBD',
  });

  const handleGenerateReport = async () => {
    if (!selectedTemplate || !activeTenantId) return;

    setLoading(true);
    setError(null);
    setReportState({ status: 'generating', progress: 0 });

    try {
      const token = await getAuthToken();
      const response = await fetch(
        `/functions/v1/generate-certification-report`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenant_id: activeTenantId,
            template_id: selectedTemplate,
            include_signature: includeSignature,
            metadata: reportMetadata,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to generate report');

      const data = await response.json();
      setReportState({
        status: 'complete',
        progress: 100,
        generated_report: data.report,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Fehler beim Generieren';
      setError(errorMsg);
      setReportState({ status: 'error', progress: 0, error_message: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  if (!activeTenantId) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center">
        <div className="text-titanium-500 text-sm">Tenant wählen.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Report Generator</div>
              <div className="text-[11px] text-titanium-400 font-medium">Zertifizierungsberichte erstellen</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-6 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Report Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* Report Metadata */}
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <h3 className="font-semibold text-titanium-50 mb-4 flex items-center gap-2 text-[12px] uppercase tracking-wide">
                <Settings className="h-4 w-4" /> Berichtsmetadaten
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-titanium-300 uppercase tracking-wide block mb-1.5">
                    Organisationsname
                  </label>
                  <input
                    type="text"
                    value={reportMetadata.organization_name}
                    onChange={(e) =>
                      setReportMetadata({ ...reportMetadata, organization_name: e.target.value })
                    }
                    placeholder="z.B. RealSyncDynamics AG"
                    className="w-full bg-obsidian-800 border border-titanium-800 text-titanium-200 text-sm rounded-none px-3 py-2 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-titanium-300 uppercase tracking-wide block mb-1.5">
                      Audit-Datum
                    </label>
                    <input
                      type="date"
                      value={reportMetadata.audit_date}
                      onChange={(e) =>
                        setReportMetadata({ ...reportMetadata, audit_date: e.target.value })
                      }
                      className="w-full bg-obsidian-800 border border-titanium-800 text-titanium-200 text-sm rounded-none px-3 py-2 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-titanium-300 uppercase tracking-wide block mb-1.5">
                      Prüfer
                    </label>
                    <input
                      type="text"
                      value={reportMetadata.auditor_name}
                      onChange={(e) =>
                        setReportMetadata({ ...reportMetadata, auditor_name: e.target.value })
                      }
                      placeholder="Name des Auditors"
                      className="w-full bg-obsidian-800 border border-titanium-800 text-titanium-200 text-sm rounded-none px-3 py-2 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-titanium-300 uppercase tracking-wide block mb-1.5">
                    Zertifizierungsstelle
                  </label>
                  <input
                    type="text"
                    value={reportMetadata.certification_body}
                    onChange={(e) =>
                      setReportMetadata({ ...reportMetadata, certification_body: e.target.value })
                    }
                    placeholder="z.B. KPMG Zertifizierung"
                    className="w-full bg-obsidian-800 border border-titanium-800 text-titanium-200 text-sm rounded-none px-3 py-2 outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-titanium-900">
                  <input
                    type="checkbox"
                    id="include-signature"
                    checked={includeSignature}
                    onChange={(e) => setIncludeSignature(e.target.checked)}
                    className="w-4 h-4 rounded border-titanium-700"
                  />
                  <label htmlFor="include-signature" className="text-[11px] text-titanium-300 cursor-pointer">
                    Digitale Signatur einfügen (für offizielle Vorlage)
                  </label>
                </div>
              </div>
            </div>

            {/* Template Selection */}
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <h3 className="font-semibold text-titanium-50 mb-4 flex items-center gap-2 text-[12px] uppercase tracking-wide">
                <FileText className="h-4 w-4" /> Berichtsvorlage wählen
              </h3>

              <div className="space-y-2">
                {REPORT_TEMPLATES.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`p-3 border rounded-none cursor-pointer transition-all ${
                      selectedTemplate === template.id
                        ? 'border-blue-700 bg-blue-950/40'
                        : 'border-titanium-800 hover:border-titanium-700 hover:bg-obsidian-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-titanium-50 text-[12px]">{template.name}</h4>
                        <p className="text-[11px] text-titanium-400 mt-1">{template.description}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {template.includes_evidence && (
                            <span className="text-[10px] px-2 py-1 bg-blue-950 border border-blue-800 text-blue-300 rounded-none">
                              Mit Evidenz
                            </span>
                          )}
                          {template.includes_findings && (
                            <span className="text-[10px] px-2 py-1 bg-orange-950 border border-orange-800 text-orange-300 rounded-none">
                              Mit Befunden
                            </span>
                          )}
                          {template.includes_timeline && (
                            <span className="text-[10px] px-2 py-1 bg-green-950 border border-green-800 text-green-300 rounded-none">
                              Mit Timeline
                            </span>
                          )}
                          {template.estimated_pages > 0 && (
                            <span className="text-[10px] px-2 py-1 bg-gray-950 border border-gray-800 text-gray-300 rounded-none">
                              ~{template.estimated_pages} Seiten
                            </span>
                          )}
                        </div>
                      </div>
                      {selectedTemplate === template.id && (
                        <CheckCircle2 className="h-5 w-5 text-blue-400 shrink-0 mt-1" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Generation Progress */}
            {reportState.status !== 'idle' && (
              <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
                <h3 className="font-semibold text-titanium-50 mb-4 flex items-center gap-2 text-[12px] uppercase tracking-wide">
                  <Zap className="h-4 w-4" /> Generierungsstatus
                </h3>

                {reportState.status === 'generating' && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                      <span className="text-[12px] text-titanium-300">Bericht wird generiert…</span>
                    </div>
                    <div className="h-2 bg-obsidian-800 rounded-none overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all"
                        style={{ width: `${reportState.progress}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-titanium-400 mt-2">{reportState.progress}%</div>
                  </div>
                )}

                {reportState.status === 'complete' && reportState.generated_report && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="text-[12px] font-semibold">Bericht erfolgreich generiert!</span>
                    </div>
                    <div className="bg-obsidian-800 border border-green-900 rounded-none p-3 text-[11px]">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-titanium-400">Dateiname:</span>
                          <span className="text-titanium-200 font-mono">
                            {reportState.generated_report.filename}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-titanium-400">Größe:</span>
                          <span className="text-titanium-200">{reportState.generated_report.size_kb} KB</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-titanium-400">Format:</span>
                          <span className="text-titanium-200 uppercase">{reportState.generated_report.format}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {reportState.status === 'error' && (
                  <div className="flex items-start gap-2 text-red-300">
                    <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                    <span className="text-[11px]">{reportState.error_message}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Action Panel */}
          <div className="space-y-4">
            {/* Generate Button */}
            <button
              onClick={() => void handleGenerateReport()}
              disabled={!selectedTemplate || loading || reportState.status === 'generating'}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-700 to-purple-700 text-white rounded-none hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-all"
            >
              <Zap className="h-4 w-4" />
              {loading ? 'Wird generiert…' : 'Bericht generieren'}
            </button>

            {/* Download Button */}
            {reportState.status === 'complete' && reportState.generated_report?.download_url && (
              <a
                href={reportState.generated_report.download_url}
                download
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-700 text-white rounded-none hover:bg-green-600 font-medium text-sm transition-all"
              >
                <Download className="h-4 w-4" />
                Herunterladen
              </a>
            )}

            {/* Preview Button */}
            {reportState.status === 'complete' && reportState.generated_report?.format === 'html' && (
              <button className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-titanium-700 text-titanium-300 rounded-none hover:bg-obsidian-800 font-medium text-sm transition-all">
                <Eye className="h-4 w-4" />
                Vorschau ansehen
              </button>
            )}

            {/* Info Cards */}
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <h4 className="font-semibold text-titanium-50 mb-3 text-[11px] uppercase tracking-wide">Hinweise</h4>
              <div className="space-y-2 text-[10px] text-titanium-400">
                <div className="flex gap-2">
                  <Lock className="h-4 w-4 shrink-0 text-blue-400 mt-0.5" />
                  <span>Berichte enthalten Tenant-RLS-Daten. Nicht für externe Parteien teilen.</span>
                </div>
                <div className="flex gap-2">
                  <Users className="h-4 w-4 shrink-0 text-green-400 mt-0.5" />
                  <span>Auditor-Kontakt wird aus dem Audit-Engagement automatisch eingefügt.</span>
                </div>
                <div className="flex gap-2">
                  <Calendar className="h-4 w-4 shrink-0 text-yellow-400 mt-0.5" />
                  <span>Berichte werden mit Timestamp versioniert für Nachverfolgung.</span>
                </div>
              </div>
            </div>

            {/* Previous Reports */}
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <h4 className="font-semibold text-titanium-50 mb-3 text-[11px] uppercase tracking-wide flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Bisherige Berichte
              </h4>
              <div className="text-[11px] text-titanium-400">
                Keine Berichte generiert
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
