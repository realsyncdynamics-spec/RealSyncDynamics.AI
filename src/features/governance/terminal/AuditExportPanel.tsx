import { useState } from 'react';
import { Download, FileText, CheckCircle2, Clock, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';

interface ExportRecord {
  id: string;
  audit_id: string;
  format: 'pdf' | 'csv' | 'xlsx';
  file_path: string;
  file_size: number;
  signature_hash: string;
  signature_verified_at: string;
  expires_at: string;
  created_at: string;
}

interface AuditExportPanelProps {
  session_id: string | null;
  audit_id?: string;
}

const FORMAT_ICONS: Record<'pdf' | 'csv' | 'xlsx', React.ReactNode> = {
  pdf: <FileText size={14} className="text-red-400" />,
  csv: <FileText size={14} className="text-green-400" />,
  xlsx: <FileText size={14} className="text-blue-400" />,
};

const FORMAT_LABELS: Record<'pdf' | 'csv' | 'xlsx', string> = {
  pdf: 'PDF',
  csv: 'CSV',
  xlsx: 'Excel',
};

export function AuditExportPanel({ session_id, audit_id }: AuditExportPanelProps) {
  const { activeTenantId } = useTenant();
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'csv' | 'xlsx'>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');

  const fetchExports = async () => {
    if (!activeTenantId || !isSupabaseConfigured()) return;

    try {
      setLoading(true);
      const sb = getSupabase();

      const query = sb
        .from('audit_exports')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (audit_id) {
        query.eq('audit_id', audit_id);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setExports(data || []);
      setError(null);
      setConnectionStatus('connected');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch exports';
      setError(errorMsg);
      console.error('Fetch exports error:', err);
      setConnectionStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!audit_id || !activeTenantId || !isSupabaseConfigured()) return;

    try {
      setIsExporting(true);
      setError(null);
      const sb = getSupabase();

      const { data, error: callError } = await sb.functions.invoke('export-audit', {
        body: {
          audit_id,
          format: selectedFormat,
        },
      });

      if (callError) throw callError;
      if (!data.ok) throw new Error(data.message);

      // Refetch exports to show new one
      await fetchExports();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to export audit';
      setError(errorMsg);
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = async (exportRecord: ExportRecord) => {
    try {
      const sb = getSupabase();
      const { data, error: downloadError } = await sb.storage
        .from('audit-exports')
        .download(exportRecord.file_path);

      if (downloadError) throw downloadError;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-${exportRecord.audit_id.slice(0, 8)}.${exportRecord.format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to download file';
      setError(errorMsg);
      console.error('Download error:', err);
    }
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="space-y-4 p-4 bg-obsidian-900 border-l border-titanium-700 max-w-sm">
      {/* Header */}
      <div>
        <h3 className="font-mono text-xs uppercase tracking-wider text-titanium-400 mb-3">
          Audit Export
        </h3>
      </div>

      {/* Error */}
      {error && (
        <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-700">
          {error}
        </div>
      )}

      {/* Connection Status */}
      <div className="flex items-center justify-between px-3 py-2 bg-obsidian-800 rounded border border-titanium-700">
        <div className="flex items-center gap-2">
          {connectionStatus === 'connected' ? (
            <Wifi size={12} className="text-green-400 animate-pulse" />
          ) : (
            <WifiOff size={12} className="text-yellow-400" />
          )}
          <span className="font-mono text-[10px] text-titanium-500">
            {connectionStatus === 'connected' ? 'Connected' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Export Section */}
      {audit_id && (
        <div className="space-y-3 p-3 bg-obsidian-800 rounded border border-titanium-700">
          <div className="text-xs text-titanium-300">
            <div className="font-mono mb-2">Audit {audit_id.slice(0, 8)}</div>
          </div>

          {/* Format Selector */}
          <div className="space-y-2">
            <label className="text-[10px] text-titanium-500 uppercase">Format</label>
            <div className="flex gap-2">
              {(['pdf', 'csv', 'xlsx'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setSelectedFormat(fmt)}
                  className={`flex-1 px-2 py-1 text-xs font-mono rounded transition-colors ${
                    selectedFormat === fmt
                      ? 'bg-blue-900 text-blue-300 border border-blue-600'
                      : 'bg-obsidian-900 text-titanium-400 border border-titanium-700 hover:border-titanium-500'
                  }`}
                >
                  {FORMAT_LABELS[fmt]}
                </button>
              ))}
            </div>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full px-2 py-1 bg-cyan-900 hover:bg-cyan-800 disabled:opacity-50 disabled:cursor-not-allowed text-cyan-300 font-mono text-xs rounded transition-colors flex items-center justify-center gap-1"
          >
            <Download size={12} />
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      )}

      {/* Exports History */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs text-titanium-300 font-mono">
            History ({exports.length})
          </div>
          <button
            onClick={() => fetchExports()}
            disabled={loading}
            className="text-[10px] text-titanium-600 hover:text-titanium-400 transition-colors"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {loading && exports.length === 0 && (
          <div className="text-xs text-titanium-400 italic">
            Loading exports...
          </div>
        )}

        {!loading && exports.length === 0 && (
          <div className="text-xs text-titanium-500 italic">
            No exports yet
          </div>
        )}

        {exports.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {exports.map((exp) => {
              const expired = isExpired(exp.expires_at);
              return (
                <div
                  key={exp.id}
                  className={`p-2 rounded border text-xs ${
                    expired
                      ? 'bg-red-900/20 border-red-700 text-red-300'
                      : 'bg-green-900/20 border-green-700 text-green-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1 min-w-0">
                      {FORMAT_ICONS[exp.format]}
                      <span className="font-mono truncate">
                        {FORMAT_LABELS[exp.format]} • {formatFileSize(exp.file_size)}
                      </span>
                    </div>
                    {!expired && (
                      <button
                        onClick={() => handleDownload(exp)}
                        className="text-green-300 hover:text-green-200 transition-colors flex-shrink-0"
                        title="Download"
                      >
                        <Download size={12} />
                      </button>
                    )}
                  </div>

                  <div className="text-[9px] text-titanium-500 space-y-0.5">
                    <div className="font-mono">
                      {expired ? (
                        <span className="flex items-center gap-1">
                          <AlertCircle size={10} />
                          Expired {new Date(exp.expires_at).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 size={10} />
                          Expires {new Date(exp.expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="font-mono">SHA256: {exp.signature_hash.slice(0, 16)}...</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
