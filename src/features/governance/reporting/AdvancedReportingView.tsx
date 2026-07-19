import React, { useState, useMemo } from 'react';
import {
  Plus, Trash2, AlertTriangle, CheckCircle2, Calendar, Download, Settings, X, FileText, Target, Zap, TrendingUp,
} from 'lucide-react';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from '../../../lib/hoc';
import { useReportBuilder, type ReportConfig, type ReportSection } from './useReportBuilder';
import { useCustomFrameworks } from '../frameworks/useCustomFrameworks';

function _AdvancedReportingView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const AdvancedReportingView = withPerformanceMonitoring(
  _AdvancedReportingView,
  'AdvancedReportingView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { reports, generatedReports, loading, createReport, updateReport, deleteReport, generateReport } = useReportBuilder();
  const { frameworks } = useCustomFrameworks();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportConfig | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'compliance' as const,
    framework: '',
    includeMetrics: true,
    includeEvidence: true,
    includeTrends: true,
    includeRisks: true,
    sections: [] as ReportSection[],
  });

  const metrics = useMemo(() => ({
    total: reports.length,
    draft: reports.filter(r => r.status === 'draft').length,
    generated: reports.filter(r => r.status === 'generated').length,
    archived: reports.filter(r => r.status === 'archived').length,
  }), [reports]);

  const handleCreateReport = async () => {
    if (!formData.name.trim()) return;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);

    const success = await createReport({
      name: formData.name,
      description: formData.description,
      type: formData.type,
      framework: formData.framework,
      frameworkIds: [],
      sections: formData.sections.length > 0 ? formData.sections : [],
      includeMetrics: formData.includeMetrics,
      includeEvidence: formData.includeEvidence,
      includeTrends: formData.includeTrends,
      includeRisks: formData.includeRisks,
      dateRange: { startDate, endDate },
      status: 'draft',
    });

    if (success) {
      setShowCreateModal(false);
      setFormData({
        name: '',
        description: '',
        type: 'compliance',
        framework: '',
        includeMetrics: true,
        includeEvidence: true,
        includeTrends: true,
        includeRisks: true,
        sections: [],
      });
    }
  };

  const handleGenerateReport = async (reportId: string) => {
    setGenerating(reportId);
    await generateReport(reportId, 'pdf');
    setGenerating(null);
  };

  const handleDeleteReport = async (reportId: string) => {
    if (confirm('Report wirklich löschen?')) {
      await deleteReport(reportId);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-obsidian-950 text-titanium-50">
      {/* Header */}
      <div className="border-b border-titanium-900 px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-teal-400" />
            <div>
              <h1 className="font-display text-2xl font-bold">Advanced Reporting</h1>
              <p className="text-sm text-titanium-400 mt-1">Compliance-Reports nach DSGVO, EU AI Act, ISO 42001</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 border border-teal-700 bg-teal-900/40 px-4 py-2 font-mono text-sm text-teal-200 hover:bg-teal-800/60"
          >
            <Plus className="h-4 w-4" />
            Report erstellen
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="border-b border-titanium-900 px-8 py-6">
        <div className="grid grid-cols-4 gap-4">
          <MetricCard label="Gesamt" value={String(metrics.total)} tone="titanium" />
          <MetricCard label="Entwürfe" value={String(metrics.draft)} tone="amber" />
          <MetricCard label="Generiert" value={String(metrics.generated)} tone="teal" />
          <MetricCard label="Archiviert" value={String(metrics.archived)} tone="titanium" />
        </div>
      </div>

      {/* Reports List */}
      <div className="flex-1 px-8 py-6 space-y-3 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Zap className="h-12 w-12 mx-auto text-titanium-600 mb-3 opacity-50 animate-pulse" />
              <p className="text-titanium-400">Lade Reports…</p>
            </div>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-titanium-600 mb-3 opacity-50" />
              <p className="text-titanium-400">Noch keine Reports erstellt</p>
            </div>
          </div>
        ) : (
          reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              isGenerating={generating === report.id}
              onGenerate={() => handleGenerateReport(report.id)}
              onDelete={() => handleDeleteReport(report.id)}
              onSelect={() => setSelectedReport(report)}
            />
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateReportModal
          formData={formData}
          frameworks={frameworks}
          onFormChange={setFormData}
          onSave={handleCreateReport}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}

function MetricCard({
  label, value, tone,
}: {
  label: string;
  value: string;
  tone?: 'teal' | 'amber' | 'titanium';
}) {
  const valCls =
    tone === 'teal' ? 'text-teal-400' :
    tone === 'amber' ? 'text-amber-400' :
    'text-titanium-100';

  return (
    <div className="border border-titanium-800 bg-obsidian-900 p-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold tracking-tight ${valCls}`}>{value}</p>
    </div>
  );
}

function ReportCard({
  report,
  isGenerating,
  onGenerate,
  onDelete,
  onSelect,
}: {
  report: ReportConfig;
  isGenerating: boolean;
  onGenerate: () => void;
  onDelete: () => void;
  onSelect: () => void;
}) {
  const statusColors: Record<string, string> = {
    draft: 'border-amber-800 bg-amber-950/20 text-amber-300',
    generated: 'border-teal-800 bg-teal-950/20 text-teal-300',
    archived: 'border-titanium-800 bg-obsidian-900 text-titanium-500',
  };

  const typeLabels: Record<string, string> = {
    compliance: 'Compliance Report',
    audit: 'Audit Report',
    executive: 'Executive Summary',
    remediation: 'Remediation Plan',
  };

  return (
    <div className="flex border border-titanium-900 bg-obsidian-900 hover:border-titanium-700 transition-colors">
      <div className="flex-1 min-w-0 p-4">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="font-display text-sm font-semibold text-titanium-50">{report.name}</span>
          <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${statusColors[report.status]}`}>
            {report.status}
          </span>
          <span className="border border-titanium-800 bg-obsidian-950 px-2 py-0.5 font-mono text-[10px] text-titanium-400">
            {typeLabels[report.type]}
          </span>
        </div>

        {report.description && (
          <p className="text-xs text-titanium-400 mb-2 line-clamp-2">{report.description}</p>
        )}

        <div className="flex flex-wrap gap-4 text-[10px] text-titanium-500 mb-3">
          <span className="font-mono">
            Framework: <span className="text-titanium-300">{report.framework || '–'}</span>
          </span>
          <span className="font-mono">
            Erstellt: <span className="text-titanium-300">{report.createdAt.toLocaleDateString('de-DE')}</span>
          </span>
          {report.generatedAt && (
            <span className="font-mono">
              Generiert: <span className="text-titanium-300">{report.generatedAt.toLocaleDateString('de-DE')}</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <ActionBtn
            icon={<FileText className="h-3 w-3" />}
            label="Details"
            onClick={onSelect}
          />
          <ActionBtn
            icon={<Zap className="h-3 w-3" />}
            label={isGenerating ? 'Generiert…' : 'Generieren'}
            onClick={onGenerate}
            disabled={isGenerating}
          />
          {report.fileUrl && (
            <ActionBtn
              icon={<Download className="h-3 w-3" />}
              label="Download"
              onClick={() => window.open(report.fileUrl, '_blank')}
            />
          )}
          <ActionBtn
            icon={<Trash2 className="h-3 w-3" />}
            label="Löschen"
            onClick={onDelete}
            variant="danger"
          />
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  icon,
  label,
  onClick,
  disabled = false,
  variant = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'danger';
}) {
  const btnCls = variant === 'danger'
    ? 'border-red-800 bg-red-950/20 hover:border-red-600 hover:text-red-300 text-red-400'
    : 'border-titanium-800 bg-obsidian-950 hover:border-titanium-600 hover:text-titanium-100 text-titanium-400';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1 border px-2 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${btnCls}`}
    >
      {icon}
      {label}
    </button>
  );
}

function CreateReportModal({
  formData,
  frameworks,
  onFormChange,
  onSave,
  onClose,
}: {
  formData: any;
  frameworks: any[];
  onFormChange: (data: any) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto border border-titanium-800 bg-obsidian-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-titanium-900 px-4 py-3">
          <h2 className="font-display text-sm font-bold text-titanium-50">Report erstellen</h2>
          <button type="button" onClick={onClose} className="text-titanium-400 hover:text-titanium-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <ModalField label="Report-Name *">
            <input
              value={formData.name}
              onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
              placeholder="z.B. Q3 2026 Compliance Report"
              className="w-full border border-titanium-800 bg-obsidian-950 px-3 py-2 text-sm text-titanium-100 outline-none focus:border-teal-600"
            />
          </ModalField>

          <ModalField label="Beschreibung">
            <textarea
              value={formData.description}
              onChange={(e) => onFormChange({ ...formData, description: e.target.value })}
              placeholder="Report-Zweck und Inhalt…"
              rows={3}
              className="w-full resize-y border border-titanium-800 bg-obsidian-950 px-3 py-2 text-sm text-titanium-100 outline-none focus:border-teal-600"
            />
          </ModalField>

          <ModalField label="Report-Typ">
            <select
              value={formData.type}
              onChange={(e) => onFormChange({ ...formData, type: e.target.value })}
              className="w-full border border-titanium-800 bg-obsidian-950 px-3 py-2 text-sm text-titanium-100 outline-none focus:border-teal-600"
            >
              <option value="compliance">Compliance Report</option>
              <option value="audit">Audit Report</option>
              <option value="executive">Executive Summary</option>
              <option value="remediation">Remediation Plan</option>
            </select>
          </ModalField>

          <ModalField label="Framework">
            <select
              value={formData.framework}
              onChange={(e) => onFormChange({ ...formData, framework: e.target.value })}
              className="w-full border border-titanium-800 bg-obsidian-950 px-3 py-2 text-sm text-titanium-100 outline-none focus:border-teal-600"
            >
              <option value="">Kein Framework</option>
              <option value="dsgvo">DSGVO</option>
              <option value="eu-ai-act">EU AI Act</option>
              <option value="iso-42001">ISO 42001</option>
              <option value="nis2">NIS 2</option>
            </select>
          </ModalField>

          <div className="space-y-2 border border-titanium-800 bg-obsidian-950 p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-400">Abschnitte</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.includeMetrics}
                onChange={(e) => onFormChange({ ...formData, includeMetrics: e.target.checked })}
                className="rounded"
              />
              <span className="text-titanium-300">Metriken einbinden</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.includeEvidence}
                onChange={(e) => onFormChange({ ...formData, includeEvidence: e.target.checked })}
                className="rounded"
              />
              <span className="text-titanium-300">Nachweise einbinden</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.includeTrends}
                onChange={(e) => onFormChange({ ...formData, includeTrends: e.target.checked })}
                className="rounded"
              />
              <span className="text-titanium-300">Trends anzeigen</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.includeRisks}
                onChange={(e) => onFormChange({ ...formData, includeRisks: e.target.checked })}
                className="rounded"
              />
              <span className="text-titanium-300">Risiken einbinden</span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-titanium-900 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 font-mono text-xs text-titanium-400 hover:text-titanium-100"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!formData.name.trim()}
            className="border border-teal-700 bg-teal-900/40 px-4 py-1.5 font-mono text-xs text-teal-200 hover:bg-teal-800/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Erstellen
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-titanium-400">
        {label}
      </span>
      {children}
    </label>
  );
}
