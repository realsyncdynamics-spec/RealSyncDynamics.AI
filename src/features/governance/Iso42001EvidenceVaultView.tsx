import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Upload, FileText, Search, Filter, Trash2, Download, Eye, EyeOff,
  CheckCircle2, AlertCircle, Clock, Tag, Calendar, FileType, Lock, Archive,
  Plus, X, ChevronDown, ExternalLink,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getAuthToken } from '../../lib/auth';

interface EvidenceItem {
  id: string;
  title: string;
  description?: string;
  evidence_type: 'document' | 'certificate' | 'audit_report' | 'screenshot' | 'log' | 'policy' | 'training_record' | 'assessment' | 'other';
  file_path?: string;
  file_size_bytes?: number;
  mime_type?: string;
  framework_codes: string[];
  control_ids: string[];
  tags: string[];
  created_at: string;
  created_by_name?: string;
  expires_at?: string;
  archived_at?: string;
}

interface EvidenceFilter {
  evidence_type?: string;
  control_id?: string;
  search?: string;
  tag?: string;
  showArchived?: boolean;
}

const EVIDENCE_TYPE_LABELS: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  document: { label: 'Document', icon: FileText, color: 'blue' },
  certificate: { label: 'Certificate', icon: CheckCircle2, color: 'green' },
  audit_report: { label: 'Audit Report', icon: FileText, color: 'purple' },
  screenshot: { label: 'Screenshot', icon: FileText, color: 'cyan' },
  log: { label: 'Log File', icon: FileText, color: 'orange' },
  policy: { label: 'Policy', icon: FileText, color: 'indigo' },
  training_record: { label: 'Training Record', icon: FileText, color: 'emerald' },
  assessment: { label: 'Assessment', icon: FileText, color: 'pink' },
  other: { label: 'Other', icon: FileText, color: 'gray' },
};

function _Iso42001EvidenceVaultView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const Iso42001EvidenceVaultView = withPerformanceMonitoring(
  _Iso42001EvidenceVaultView,
  'Iso42001EvidenceVaultView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { activeTenantId } = useTenant();
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [filter, setFilter] = useState<EvidenceFilter>({});
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadEvidence = async () => {
    if (!activeTenantId) return;
    setLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();
      const response = await fetch(
        `/functions/v1/iso42001-evidence-vault?tenant_id=${activeTenantId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error('Failed to load evidence');
      const data = await response.json();
      setEvidenceItems(data.evidence_items || []);
      applyFilters(data.evidence_items || [], filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading evidence');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (items: EvidenceItem[], filters: EvidenceFilter) => {
    let result = items;

    if (!filters.showArchived) {
      result = result.filter(item => !item.archived_at);
    }

    if (filters.evidence_type) {
      result = result.filter(item => item.evidence_type === filters.evidence_type);
    }

    if (filters.control_id) {
      result = result.filter(item => item.control_ids.includes(filters.control_id!));
    }

    if (filters.tag) {
      result = result.filter(item => item.tags.includes(filters.tag!));
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q)
      );
    }

    setFilteredItems(result);
  };

  const handleFilterChange = (newFilter: EvidenceFilter) => {
    setFilter(newFilter);
    applyFilters(evidenceItems, newFilter);
  };

  const handleUpload = async (file: File, title: string, description: string, controlIds: string[], tags: string[]) => {
    if (!activeTenantId) return;
    setUploading(true);

    try {
      const token = await getAuthToken();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('description', description);
      formData.append('control_ids', JSON.stringify(controlIds));
      formData.append('tags', JSON.stringify(tags));

      const response = await fetch(
        `/functions/v1/iso42001-evidence-vault?tenant_id=${activeTenantId}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      if (!response.ok) throw new Error('Upload failed');
      setShowUploadModal(false);
      await loadEvidence();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload error');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    void loadEvidence();
  }, [activeTenantId]);

  if (!activeTenantId) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center">
        <div className="text-titanium-500 text-sm">Select tenant.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/governance/iso42001-hub" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <Archive className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Evidence Vault</div>
              <div className="text-[11px] text-titanium-400 font-medium">ISO 42001 artifact management</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-6 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-6">
          {/* Control Bar */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-titanium-50 mb-1">Evidence Collection</h1>
              <p className="text-sm text-titanium-400">{filteredItems.length} artifact{filteredItems.length !== 1 ? 's' : ''}</p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-none transition"
            >
              <Upload className="h-4 w-4" />
              Upload Evidence
            </button>
          </div>

          {/* Filter Bar */}
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
            <div className="space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-titanium-400" />
                <input
                  type="text"
                  placeholder="Search evidence by title or description..."
                  value={filter.search || ''}
                  onChange={(e) => handleFilterChange({ ...filter, search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 bg-obsidian-800 border border-titanium-800 rounded-none text-titanium-100 placeholder-titanium-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select
                  value={filter.evidence_type || ''}
                  onChange={(e) => handleFilterChange({ ...filter, evidence_type: e.target.value || undefined })}
                  className="px-3 py-2 bg-obsidian-800 border border-titanium-800 rounded-none text-titanium-100 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">All Types</option>
                  {Object.entries(EVIDENCE_TYPE_LABELS).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>

                <select
                  value={filter.tag || ''}
                  onChange={(e) => handleFilterChange({ ...filter, tag: e.target.value || undefined })}
                  className="px-3 py-2 bg-obsidian-800 border border-titanium-800 rounded-none text-titanium-100 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">All Tags</option>
                  <option value="incident">Incident</option>
                  <option value="breach">Breach</option>
                  <option value="training">Training</option>
                  <option value="audit">Audit</option>
                  <option value="compliance">Compliance</option>
                </select>

                <label className="flex items-center gap-2 px-3 py-2 bg-obsidian-800 border border-titanium-800 rounded-none cursor-pointer hover:bg-obsidian-700">
                  <input
                    type="checkbox"
                    checked={filter.showArchived || false}
                    onChange={(e) => handleFilterChange({ ...filter, showArchived: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-titanium-100">Include Archived</span>
                </label>
              </div>
            </div>
          </div>

          {/* Evidence Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-titanium-400">Loading evidence...</div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <Archive className="h-12 w-12 text-titanium-600 mx-auto mb-4" />
              <p className="text-titanium-400 mb-4">No evidence found</p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-none transition"
              >
                <Plus className="h-4 w-4" />
                Upload First Evidence
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((evidence) => (
                <EvidenceCard
                  key={evidence.id}
                  evidence={evidence}
                  onSelect={setSelectedEvidence}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onUpload={handleUpload}
          uploading={uploading}
        />
      )}

      {/* Detail Panel */}
      {selectedEvidence && (
        <DetailPanel
          evidence={selectedEvidence}
          onClose={() => setSelectedEvidence(null)}
        />
      )}
    </div>
  );
}

const COLOR_CLASSES: Record<string, string> = {
  blue: 'text-blue-400',
  green: 'text-green-400',
  purple: 'text-purple-400',
  cyan: 'text-cyan-400',
  orange: 'text-orange-400',
  indigo: 'text-indigo-400',
  emerald: 'text-emerald-400',
  pink: 'text-pink-400',
  gray: 'text-gray-400',
};

function EvidenceCard({ evidence, onSelect }: { evidence: EvidenceItem; onSelect: (e: EvidenceItem) => void }) {
  const typeInfo = EVIDENCE_TYPE_LABELS[evidence.evidence_type];
  const isExpiring = evidence.expires_at &&
    new Date(evidence.expires_at).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;

  return (
    <button
      onClick={() => onSelect(evidence)}
      className="bg-obsidian-900 border border-titanium-900 rounded-none p-4 hover:border-titanium-700 hover:bg-obsidian-800/50 transition-all text-left group"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-2 flex-1">
          <FileText className={`h-5 w-5 shrink-0 mt-0.5 ${COLOR_CLASSES[typeInfo.color]}`} />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-titanium-50 text-sm group-hover:text-white truncate">
              {evidence.title}
            </h3>
            {evidence.archived_at && (
              <p className="text-[11px] text-titanium-500 mt-1 flex items-center gap-1">
                <Archive className="h-3 w-3" /> Archived
              </p>
            )}
          </div>
        </div>
      </div>

      {evidence.description && (
        <p className="text-[11px] text-titanium-400 mb-2 line-clamp-2">{evidence.description}</p>
      )}

      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-1 text-[10px] text-titanium-400">
          <Calendar className="h-3 w-3" />
          {new Date(evidence.created_at).toLocaleDateString('de-DE')}
        </div>

        {isExpiring && evidence.expires_at && (
          <div className="flex items-center gap-1 text-[10px] text-orange-400">
            <Clock className="h-3 w-3" />
            Expires {new Date(evidence.expires_at).toLocaleDateString('de-DE')}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {evidence.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-obsidian-800 border border-titanium-800 rounded-none text-[10px] text-titanium-300">
            <Tag className="h-3 w-3" />
            {tag}
          </span>
        ))}
        {evidence.tags.length > 2 && (
          <span className="inline-flex items-center px-2 py-1 text-[10px] text-titanium-500">
            +{evidence.tags.length - 2}
          </span>
        )}
      </div>

      <div className="text-[11px] font-semibold text-titanium-500">
        {evidence.control_ids.length} control{evidence.control_ids.length !== 1 ? 's' : ''}
      </div>
    </button>
  );
}

function UploadModal({
  onClose,
  onUpload,
  uploading,
}: {
  onClose: () => void;
  onUpload: (file: File, title: string, description: string, controlIds: string[], tags: string[]) => void;
  uploading: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [controlIds, setControlIds] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) return;
    onUpload(file, title, description, controlIds, tags);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6 w-full max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-titanium-50">Upload Evidence</h2>
          <button onClick={onClose} className="p-1 hover:bg-obsidian-800 text-titanium-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File Input */}
          <div>
            <label className="block text-sm font-semibold text-titanium-200 mb-2">File</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-titanium-800 rounded-none p-6 text-center cursor-pointer hover:border-titanium-700 transition"
            >
              {file ? (
                <div className="text-sm">
                  <FileText className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                  <p className="text-titanium-100 font-semibold">{file.name}</p>
                  <p className="text-titanium-500 text-xs mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div className="text-sm">
                  <Upload className="h-8 w-8 text-titanium-600 mx-auto mb-2" />
                  <p className="text-titanium-300">Drop file or click to browse</p>
                  <p className="text-titanium-500 text-xs mt-1">PDF, Document, Image, Log up to 50MB</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-titanium-200 mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Evidence title"
              className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 rounded-none text-titanium-100 placeholder-titanium-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-titanium-200 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional context about this evidence..."
              rows={3}
              className="w-full px-3 py-2 bg-obsidian-800 border border-titanium-800 rounded-none text-titanium-100 placeholder-titanium-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-semibold text-titanium-200 mb-2">Tags</label>
            <div className="flex flex-wrap gap-2">
              {['incident', 'breach', 'training', 'audit', 'compliance'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTags(tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag])}
                  className={`px-3 py-1 rounded-none text-sm font-semibold transition ${
                    tags.includes(tag)
                      ? 'bg-blue-600 text-white'
                      : 'bg-obsidian-800 border border-titanium-800 text-titanium-400 hover:border-titanium-700'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-obsidian-800 border border-titanium-800 rounded-none text-titanium-200 text-sm font-semibold hover:bg-obsidian-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || !title || uploading}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-titanium-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-none transition"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DetailPanel({
  evidence,
  onClose,
}: {
  evidence: EvidenceItem;
  onClose: () => void;
}) {
  const typeInfo = EVIDENCE_TYPE_LABELS[evidence.evidence_type];

  const handleDownload = () => {
    if (evidence.file_path) {
      window.open(`/download?path=${encodeURIComponent(evidence.file_path)}`, '_blank');
    }
  };

  const handleArchive = async () => {
    if (!window.confirm('Archive this evidence? It will be hidden from the default view.')) return;
    try {
      // TODO: Implement archive API call
      console.log('Archive evidence:', evidence.id);
    } catch (err) {
      console.error('Archive failed:', err);
    }
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 w-full md:w-96 bg-obsidian-900 border-l border-titanium-900 shadow-2xl z-40 flex flex-col">
      <div className="h-14 border-b border-titanium-900 flex items-center justify-between px-4">
        <span className="text-sm font-semibold text-titanium-50">Evidence Details</span>
        <button onClick={onClose} className="p-1 hover:bg-obsidian-800 text-titanium-400">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Type Badge */}
        <div className="flex items-center gap-2 px-3 py-2 bg-obsidian-800 border border-titanium-800 rounded-none w-fit">
          <FileText className={`h-4 w-4 ${COLOR_CLASSES[typeInfo.color]}`} />
          <span className="text-sm font-semibold text-titanium-100">{typeInfo.label}</span>
        </div>

        {/* Title */}
        <div>
          <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Title</p>
          <p className="text-sm text-titanium-100">{evidence.title}</p>
        </div>

        {/* Description */}
        {evidence.description && (
          <div>
            <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Description</p>
            <p className="text-sm text-titanium-300">{evidence.description}</p>
          </div>
        )}

        {/* Metadata */}
        <div className="space-y-2">
          <div>
            <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Created</p>
            <p className="text-sm text-titanium-100">
              {new Date(evidence.created_at).toLocaleDateString('de-DE')}
              {evidence.created_by_name && ` by ${evidence.created_by_name}`}
            </p>
          </div>

          {evidence.file_size_bytes && (
            <div>
              <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">File Size</p>
              <p className="text-sm text-titanium-100">
                {(evidence.file_size_bytes / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}

          {evidence.expires_at && (
            <div>
              <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Expires</p>
              <p className={`text-sm ${
                new Date(evidence.expires_at).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000
                  ? 'text-orange-400'
                  : 'text-titanium-100'
              }`}>
                {new Date(evidence.expires_at).toLocaleDateString('de-DE')}
              </p>
            </div>
          )}
        </div>

        {/* Tags */}
        {evidence.tags.length > 0 && (
          <div>
            <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-2">Tags</p>
            <div className="flex flex-wrap gap-1">
              {evidence.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-obsidian-800 border border-titanium-800 rounded-none text-[10px] text-titanium-300">
                  <Tag className="h-3 w-3" />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        {evidence.control_ids.length > 0 && (
          <div>
            <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-2">Linked to {evidence.control_ids.length} Control{evidence.control_ids.length !== 1 ? 's' : ''}</p>
            <div className="space-y-1">
              {evidence.control_ids.map((cid) => (
                <div key={cid} className="text-[11px] text-blue-400 truncate font-mono">{cid}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-titanium-900 p-4 flex gap-2">
        {evidence.file_path && (
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-none transition"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        )}
        <button
          onClick={handleArchive}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-obsidian-800 border border-titanium-800 hover:bg-obsidian-700 text-titanium-200 text-sm font-semibold rounded-none transition"
        >
          <Trash2 className="h-4 w-4" />
          Archive
        </button>
      </div>
    </div>
  );
}
