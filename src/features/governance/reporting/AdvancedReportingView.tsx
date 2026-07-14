import React, { useState } from 'react';
import {
  Plus, Trash2, AlertTriangle, CheckCircle2, Calendar, Download, Settings, X, FileText, Target,
} from 'lucide-react';
import { useReportBuilder, type ReportConfig } from './useReportBuilder';
import { useCustomFrameworks } from '../frameworks/useCustomFrameworks';

export function AdvancedReportingView() {
  const { reports, generatedReports, loading, error, createReport, updateReport, deleteReport, generateReport } = useReportBuilder();
  const { frameworks } = useCustomFrameworks();

  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    type: 'compliance' | 'audit' | 'executive' | 'remediation';
    framework: string;
    frameworkIds: string[];
    includeMetrics: boolean;
    includeEvidence: boolean;
    includeTrends: boolean;
    includeRisks: boolean;
    startDate: string;
    endDate: string;
  }>({
    name: '',
    description: '',
    type: 'compliance',
    framework: '',
    frameworkIds: [],
    includeMetrics: true,
    includeEvidence: true,
    includeTrends: true,
    includeRisks: true,
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const handleCreateOrUpdate = async () => {
    if (!formData.name.trim()) {
      setFormError('Report name is required');
      return;
    }

    if (formData.frameworkIds.length === 0) {
      setFormError('At least one framework must be selected');
      return;
    }

    try {
      setFormError(null);

      const reportData = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        framework: formData.framework,
        frameworkIds: formData.frameworkIds,
        sections: [],
        includeMetrics: formData.includeMetrics,
        includeEvidence: formData.includeEvidence,
        includeTrends: formData.includeTrends,
        includeRisks: formData.includeRisks,
        dateRange: {
          startDate: new Date(formData.startDate),
          endDate: new Date(formData.endDate),
        },
        status: 'draft' as const,
      };

      if (editingId) {
        const success = await updateReport(editingId, reportData);
        if (!success) {
          setFormError('Failed to update report');
          return;
        }
      } else {
        const result = await createReport(reportData);
        if (!result) {
          setFormError('Failed to create report');
          return;
        }
      }

      resetForm();
      setShowNewForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleGenerateReport = async (reportId: string, format: 'pdf' | 'docx' | 'xlsx' = 'pdf') => {
    try {
      setGeneratingId(reportId);
      setFormError(null);

      const result = await generateReport(reportId, format);
      if (!result) {
        setFormError('Failed to generate report');
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGeneratingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this report configuration?')) {
      return;
    }

    try {
      const success = await deleteReport(id);
      if (!success) {
        setFormError('Failed to delete report');
      } else if (selectedReportId === id) {
        setSelectedReportId(null);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete report');
    }
  };

  const editReport = (report: ReportConfig) => {
    setFormData({
      name: report.name,
      description: report.description,
      type: report.type,
      framework: report.framework,
      frameworkIds: report.frameworkIds,
      includeMetrics: report.includeMetrics,
      includeEvidence: report.includeEvidence,
      includeTrends: report.includeTrends,
      includeRisks: report.includeRisks,
      startDate: report.dateRange.startDate.toISOString().split('T')[0],
      endDate: report.dateRange.endDate.toISOString().split('T')[0],
    });
    setEditingId(report.id);
    setShowNewForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'compliance',
      framework: '',
      frameworkIds: [],
      includeMetrics: true,
      includeEvidence: true,
      includeTrends: true,
      includeRisks: true,
      startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
    });
    setEditingId(null);
    setFormError(null);
  };

  const toggleFramework = (frameworkId: string) => {
    setFormData({
      ...formData,
      frameworkIds: formData.frameworkIds.includes(frameworkId)
        ? formData.frameworkIds.filter((id) => id !== frameworkId)
        : [...formData.frameworkIds, frameworkId],
    });
  };

  const selectedReport = reports.find((r) => r.id === selectedReportId);
  const selectedGeneratedReports = selectedReportId
    ? generatedReports.filter((gr) => gr.configId === selectedReportId)
    : [];

  return (
    <div className="min-h-screen bg-obsidian-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-titanium-50 mb-2 flex items-center gap-2">
              <FileText className="w-8 h-8" />
              Advanced Reporting
            </h1>
            <p className="text-titanium-400">
              Create custom compliance reports across multiple frameworks and generate comprehensive documentation.
            </p>
          </div>

          <button
            onClick={() => {
              resetForm();
              setShowNewForm(!showNewForm);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-ai-cyan-500 hover:bg-ai-cyan-600 text-obsidian-950 font-semibold rounded-none transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Report
          </button>
        </div>

        {/* New/Edit Form */}
        {showNewForm && (
          <div className="bg-obsidian-900 border border-titanium-800 p-6 rounded-none space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-titanium-50">
                {editingId ? 'Edit Report Configuration' : 'Create New Report'}
              </h2>
              <button
                onClick={() => {
                  setShowNewForm(false);
                  resetForm();
                }}
                className="p-2 text-titanium-400 hover:text-titanium-50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="flex items-start gap-2 p-3 bg-rose-950/30 border border-rose-500/30 rounded-none">
                <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                <p className="text-sm text-rose-300">{formError}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-titanium-300 mb-2">
                  Report Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Q1 2024 Compliance Report"
                  className="w-full px-3 py-2 bg-obsidian-950 border border-titanium-700 rounded-none text-titanium-50 placeholder-titanium-500 focus:border-ai-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-titanium-300 mb-2">
                  Report Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-3 py-2 bg-obsidian-950 border border-titanium-700 rounded-none text-titanium-50 focus:border-ai-cyan-500 focus:outline-none"
                >
                  <option value="compliance">Compliance</option>
                  <option value="audit">Audit</option>
                  <option value="executive">Executive</option>
                  <option value="remediation">Remediation</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-titanium-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the purpose and scope of this report..."
                rows={2}
                className="w-full px-3 py-2 bg-obsidian-950 border border-titanium-700 rounded-none text-titanium-50 placeholder-titanium-500 focus:border-ai-cyan-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-titanium-300 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 bg-obsidian-950 border border-titanium-700 rounded-none text-titanium-50 focus:border-ai-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-titanium-300 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-3 py-2 bg-obsidian-950 border border-titanium-700 rounded-none text-titanium-50 focus:border-ai-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-titanium-300 mb-3">
                Frameworks to Include *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {frameworks.map((framework) => (
                  <label key={framework.id} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-obsidian-950 rounded-none transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.frameworkIds.includes(framework.id)}
                      onChange={() => toggleFramework(framework.id)}
                      className="w-4 h-4 rounded-none border border-titanium-700 bg-obsidian-950 text-ai-cyan-500 cursor-pointer"
                    />
                    <span className="text-sm text-titanium-300">{framework.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-titanium-300">Report Sections</label>
              <div className="space-y-2">
                {[
                  { key: 'includeMetrics', label: 'Compliance Metrics & Charts' },
                  { key: 'includeEvidence', label: 'Evidence & Documentation' },
                  { key: 'includeTrends', label: 'Compliance Trends' },
                  { key: 'includeRisks', label: 'Risk Assessment' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(formData as any)[key]}
                      onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })}
                      className="w-4 h-4 rounded-none border border-titanium-700 bg-obsidian-950 text-ai-cyan-500 cursor-pointer"
                    />
                    <span className="text-sm text-titanium-300">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-titanium-800">
              <button
                onClick={handleCreateOrUpdate}
                className="flex-1 px-4 py-2.5 bg-ai-cyan-500 hover:bg-ai-cyan-600 text-obsidian-950 font-semibold rounded-none transition-colors"
              >
                {editingId ? 'Update Report' : 'Create Report'}
              </button>
              <button
                onClick={() => {
                  setShowNewForm(false);
                  resetForm();
                }}
                className="flex-1 px-4 py-2.5 border border-titanium-700 text-titanium-300 hover:text-titanium-50 rounded-none transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Reports List */}
          <div className="lg:col-span-1 bg-obsidian-900 border border-titanium-800 rounded-none p-6">
            <h2 className="text-lg font-semibold text-titanium-50 mb-4">
              Report Configurations ({reports.length})
            </h2>

            {loading ? (
              <p className="text-titanium-400 text-center py-8">Loading reports...</p>
            ) : error ? (
              <div className="flex items-start gap-2 p-4 bg-rose-950/30 border border-rose-500/30 rounded-none">
                <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                <p className="text-sm text-rose-300">{error}</p>
              </div>
            ) : reports.length === 0 ? (
              <p className="text-titanium-400 text-center py-8">No reports yet.</p>
            ) : (
              <div className="space-y-2">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    onClick={() => setSelectedReportId(report.id)}
                    className={`flex items-start justify-between p-3 rounded-none border cursor-pointer transition-colors ${
                      selectedReportId === report.id
                        ? 'bg-obsidian-950 border-ai-cyan-500'
                        : 'bg-obsidian-950 border-titanium-800 hover:border-titanium-700'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-titanium-50 truncate">
                        {report.name}
                      </p>
                      <p className="text-xs text-titanium-500 truncate">
                        {report.type} • {report.frameworkIds.length} framework
                        {report.frameworkIds.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(report.id);
                      }}
                      className="p-1 text-titanium-400 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Report Details & Generation */}
          <div className="lg:col-span-2 bg-obsidian-900 border border-titanium-800 rounded-none p-6">
            {selectedReport ? (
              <>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-titanium-50 mb-1">
                      {selectedReport.name}
                    </h2>
                    <p className="text-sm text-titanium-400">{selectedReport.description}</p>
                  </div>
                  <button
                    onClick={() => editReport(selectedReport)}
                    className="p-2 text-titanium-400 hover:text-titanium-50 hover:bg-titanium-800 rounded-none transition-colors"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  <div className="bg-obsidian-950 border border-titanium-800 p-3 rounded-none">
                    <p className="text-xs text-titanium-500 mb-1">Type</p>
                    <p className="text-sm font-semibold text-titanium-50 capitalize">
                      {selectedReport.type}
                    </p>
                  </div>
                  <div className="bg-obsidian-950 border border-titanium-800 p-3 rounded-none">
                    <p className="text-xs text-titanium-500 mb-1">Frameworks</p>
                    <p className="text-sm font-semibold text-titanium-50">
                      {selectedReport.frameworkIds.length}
                    </p>
                  </div>
                  <div className="bg-obsidian-950 border border-titanium-800 p-3 rounded-none">
                    <p className="text-xs text-titanium-500 mb-1">Status</p>
                    <p className="text-sm font-semibold text-titanium-50 capitalize">
                      {selectedReport.status}
                    </p>
                  </div>
                  <div className="bg-obsidian-950 border border-titanium-800 p-3 rounded-none">
                    <p className="text-xs text-titanium-500 mb-1">Generated</p>
                    <p className="text-sm font-semibold text-titanium-50">
                      {selectedReport.generatedAt ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-titanium-50 mb-3">Generate Report</h3>
                  <div className="flex gap-2">
                    {(['pdf', 'docx', 'xlsx'] as const).map((format) => (
                      <button
                        key={format}
                        onClick={() => handleGenerateReport(selectedReport.id, format)}
                        disabled={generatingId === selectedReport.id}
                        className="flex-1 px-3 py-2 bg-ai-cyan-500 hover:bg-ai-cyan-600 disabled:opacity-50 text-obsidian-950 font-medium rounded-none transition-colors flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        {format.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedGeneratedReports.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-titanium-50 mb-3">
                      Generated Files ({selectedGeneratedReports.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedGeneratedReports.map((gen) => (
                        <div
                          key={gen.id}
                          className="flex items-center justify-between p-3 bg-obsidian-950 border border-titanium-800 rounded-none"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-titanium-50">
                              {gen.fileFormat.toUpperCase()} • {(gen.fileSize / 1024 / 1024).toFixed(2)} MB
                            </p>
                            <p className="text-xs text-titanium-500">
                              {gen.generatedAt.toLocaleDateString('de-DE')} • {gen.downloadCount} downloads
                            </p>
                          </div>
                          <a
                            href={gen.fileUrl}
                            download
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-none transition-colors flex items-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <Target className="w-8 h-8 text-titanium-600 mx-auto mb-3" />
                <p className="text-titanium-400">
                  Select a report configuration to view details and generate reports
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
