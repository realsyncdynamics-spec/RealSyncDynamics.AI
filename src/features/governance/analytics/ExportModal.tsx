import { useState } from 'react';
import { X, Download, Loader } from 'lucide-react';
import { useTenant } from '../../tenant/TenantContext';
import { exportKpiData } from './analyticsApi';
import type { AnalyticsExportRequest } from './types';

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportModal({ open, onOpenChange }: ExportModalProps) {
  const { activeTenant } = useTenant();
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleExport = async () => {
    if (!activeTenant?.id) return;

    setLoading(true);
    setError(null);
    setProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + Math.random() * 30, 90));
      }, 200);

      const request: AnalyticsExportRequest = {
        format,
        tenantId: activeTenant.id,
        dateRange: {
          start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0],
        },
        includeCharts: format === 'pdf' && includeCharts,
      };

      const response = await exportKpiData(request);

      clearInterval(progressInterval);
      setProgress(100);

      // Create download link
      const link = document.createElement('a');
      link.href = response.url;
      link.download = response.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Close modal after download
      setTimeout(() => {
        onOpenChange(false);
        setFormat('csv');
        setIncludeCharts(true);
        setProgress(0);
      }, 500);
    } catch (err) {
      console.error('Export failed:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to export data. Please try again.'
      );
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-obsidian-900 border border-titanium-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-titanium-800">
          <h2 className="text-lg font-semibold text-titanium-50">Export Analytics</h2>
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-titanium-400 hover:text-titanium-300 disabled:opacity-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-titanium-300 mb-3">
              Export Format
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-titanium-800 rounded cursor-pointer hover:bg-obsidian-800 transition-colors">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={(e) => setFormat(e.target.value as 'csv')}
                  disabled={loading}
                  className="w-4 h-4"
                />
                <div>
                  <div className="text-sm font-medium text-titanium-200">CSV</div>
                  <div className="text-xs text-titanium-500">Tab-separated values for spreadsheet apps</div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border border-titanium-800 rounded cursor-pointer hover:bg-obsidian-800 transition-colors">
                <input
                  type="radio"
                  name="format"
                  value="pdf"
                  checked={format === 'pdf'}
                  onChange={(e) => setFormat(e.target.value as 'pdf')}
                  disabled={loading}
                  className="w-4 h-4"
                />
                <div>
                  <div className="text-sm font-medium text-titanium-200">PDF</div>
                  <div className="text-xs text-titanium-500">Formatted report with charts</div>
                </div>
              </label>
            </div>
          </div>

          {/* Options */}
          {format === 'pdf' && (
            <div>
              <label className="flex items-center gap-2 p-3 border border-titanium-800 rounded cursor-pointer hover:bg-obsidian-800 transition-colors">
                <input
                  type="checkbox"
                  checked={includeCharts}
                  onChange={(e) => setIncludeCharts(e.target.checked)}
                  disabled={loading}
                  className="w-4 h-4"
                />
                <span className="text-sm text-titanium-300">Include charts in PDF</span>
              </label>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-700 rounded">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {/* Progress */}
          {loading && progress > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-titanium-400">Preparing export...</span>
                <span className="text-sm text-titanium-500">{Math.round(progress)}%</span>
              </div>
              <div className="w-full h-2 bg-obsidian-800 rounded overflow-hidden">
                <div
                  className="h-full bg-titanium-600 rounded transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-obsidian-950 border-t border-titanium-800 rounded-b-lg">
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-titanium-300 bg-obsidian-800 border border-titanium-700 rounded hover:bg-obsidian-700 disabled:opacity-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-obsidian-950 bg-titanium-600 rounded hover:bg-titanium-500 disabled:opacity-50 transition-all"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
