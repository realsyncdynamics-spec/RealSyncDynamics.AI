import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Clock, TrendingUp, Filter, Search,
  Zap, Target, AlertCircle, BarChart3, ArrowRight, X,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getAuthToken } from '../../lib/auth';

interface Gap {
  id: string;
  control_id: string;
  control_name: string;
  gap_description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  impact_score: number; // 1-10
  effort_days: number;
  status: 'identified' | 'planned' | 'in_progress' | 'resolved';
  root_cause: string;
  affected_controls: string[];
  estimated_fix_date?: string;
  owner?: string;
}

interface GapFilter {
  severity?: string;
  status?: string;
  search?: string;
  control_id?: string;
}

const SEVERITY_COLORS = {
  critical: { label: 'Critical', bg: 'bg-red-950', border: 'border-red-900', text: 'text-red-400' },
  high: { label: 'High', bg: 'bg-orange-950', border: 'border-orange-900', text: 'text-orange-400' },
  medium: { label: 'Medium', bg: 'bg-yellow-950', border: 'border-yellow-900', text: 'text-yellow-400' },
  low: { label: 'Low', bg: 'bg-blue-950', border: 'border-blue-900', text: 'text-blue-400' },
};

const STATUS_LABELS = {
  identified: 'Identified',
  planned: 'Planned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

export function Iso42001GapAnalysisView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { activeTenantId } = useTenant();
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [filteredGaps, setFilteredGaps] = useState<Gap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGap, setSelectedGap] = useState<Gap | null>(null);
  const [filter, setFilter] = useState<GapFilter>({});

  const loadGaps = async () => {
    if (!activeTenantId) return;
    setLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();
      const response = await fetch(
        `/functions/v1/iso42001-gap-analysis?tenant_id=${activeTenantId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error('Failed to load gap analysis');
      const data = await response.json();
      setGaps(data.gaps || []);
      applyFilters(data.gaps || [], filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading gaps');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (items: Gap[], filters: GapFilter) => {
    let result = items;

    if (filters.severity) {
      result = result.filter(gap => gap.severity === filters.severity);
    }

    if (filters.status) {
      result = result.filter(gap => gap.status === filters.status);
    }

    if (filters.control_id) {
      result = result.filter(gap => gap.control_id === filters.control_id);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(gap =>
        gap.gap_description.toLowerCase().includes(q) ||
        gap.control_name.toLowerCase().includes(q) ||
        gap.root_cause.toLowerCase().includes(q)
      );
    }

    // Sort by severity (critical first) then by impact
    result.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return b.impact_score - a.impact_score;
    });

    setFilteredGaps(result);
  };

  const handleFilterChange = (newFilter: GapFilter) => {
    setFilter(newFilter);
    applyFilters(gaps, newFilter);
  };

  useEffect(() => {
    void loadGaps();
  }, [activeTenantId]);

  if (!activeTenantId) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center">
        <div className="text-titanium-500 text-sm">Select tenant.</div>
      </div>
    );
  }

  const criticalCount = filteredGaps.filter(g => g.severity === 'critical').length;
  const totalEffort = filteredGaps.reduce((sum, g) => sum + g.effort_days, 0);
  const avgRisk = filteredGaps.length > 0 ? Math.round(filteredGaps.reduce((sum, g) => sum + g.impact_score, 0) / filteredGaps.length) : 0;

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/governance/iso42001-hub" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-sm">
              <AlertTriangle className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Gap Analysis</div>
              <div className="text-[11px] text-titanium-400 font-medium">Compliance gaps & remediation planning</div>
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
          {/* Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <div className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Total Gaps</div>
              <div className="text-3xl font-bold text-titanium-50">{filteredGaps.length}</div>
              <div className="text-[11px] text-titanium-400 mt-1">identified issues</div>
            </div>

            <div className="bg-obsidian-900 border border-red-900 rounded-none p-4">
              <div className="text-[11px] text-red-400 uppercase font-semibold tracking-wide mb-1">Critical</div>
              <div className="text-3xl font-bold text-red-400">{criticalCount}</div>
              <div className="text-[11px] text-red-500 mt-1">requires immediate action</div>
            </div>

            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <div className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Effort</div>
              <div className="text-3xl font-bold text-titanium-50">{totalEffort}</div>
              <div className="text-[11px] text-titanium-400 mt-1">days to remediate</div>
            </div>

            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
              <div className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Avg Impact</div>
              <div className="text-3xl font-bold text-titanium-50">{avgRisk}/10</div>
              <div className="text-[11px] text-titanium-400 mt-1">compliance risk</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-titanium-400" />
                <input
                  type="text"
                  placeholder="Search gaps by description or root cause..."
                  value={filter.search || ''}
                  onChange={(e) => handleFilterChange({ ...filter, search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 bg-obsidian-800 border border-titanium-800 rounded-none text-titanium-100 placeholder-titanium-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select
                  value={filter.severity || ''}
                  onChange={(e) => handleFilterChange({ ...filter, severity: e.target.value || undefined })}
                  className="px-3 py-2 bg-obsidian-800 border border-titanium-800 rounded-none text-titanium-100 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>

                <select
                  value={filter.status || ''}
                  onChange={(e) => handleFilterChange({ ...filter, status: e.target.value || undefined })}
                  className="px-3 py-2 bg-obsidian-800 border border-titanium-800 rounded-none text-titanium-100 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="identified">Identified</option>
                  <option value="planned">Planned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>

                <input
                  type="text"
                  placeholder="Filter by control..."
                  value={filter.control_id || ''}
                  onChange={(e) => handleFilterChange({ ...filter, control_id: e.target.value || undefined })}
                  className="px-3 py-2 bg-obsidian-800 border border-titanium-800 rounded-none text-titanium-100 text-sm placeholder-titanium-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Gaps List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-titanium-400">Loading gap analysis...</div>
            </div>
          ) : filteredGaps.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-titanium-400 mb-2">No gaps found</p>
              <p className="text-titanium-500 text-sm">All ISO 42001 controls are fully implemented</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredGaps.map((gap) => (
                <GapCard
                  key={gap.id}
                  gap={gap}
                  onSelect={setSelectedGap}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Detail Panel */}
      {selectedGap && (
        <GapDetailPanel
          gap={selectedGap}
          onClose={() => setSelectedGap(null)}
        />
      )}
    </div>
  );
}

function GapCard({ gap, onSelect }: { gap: Gap; onSelect: (g: Gap) => void }) {
  const severityInfo = SEVERITY_COLORS[gap.severity];

  return (
    <button
      onClick={() => onSelect(gap)}
      className={`w-full text-left border rounded-none p-4 hover:bg-obsidian-800/50 transition-all ${severityInfo.border} ${severityInfo.bg}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${severityInfo.text}`} />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-titanium-50 text-sm">{gap.control_name}</h3>
            <p className="text-[11px] text-titanium-400 mt-1">{gap.gap_description}</p>
          </div>
        </div>
        <div className={`px-2 py-1 rounded-none text-[10px] font-semibold whitespace-nowrap ${severityInfo.bg} ${severityInfo.text}`}>
          {severityInfo.label}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 text-[11px]">
        <div>
          <span className="text-titanium-500">Impact:</span> <span className="text-titanium-100">{gap.impact_score}/10</span>
        </div>
        <div>
          <span className="text-titanium-500">Effort:</span> <span className="text-titanium-100">{gap.effort_days}d</span>
        </div>
        <div>
          <span className="text-titanium-500">Status:</span> <span className="text-titanium-100">{STATUS_LABELS[gap.status]}</span>
        </div>
        <div>
          <span className="text-titanium-500">Controls:</span> <span className="text-titanium-100">{gap.affected_controls.length}</span>
        </div>
      </div>
    </button>
  );
}

function GapDetailPanel({
  gap,
  onClose,
}: {
  gap: Gap;
  onClose: () => void;
}) {
  const severityInfo = SEVERITY_COLORS[gap.severity];

  return (
    <div className="fixed right-0 top-0 bottom-0 w-full md:w-96 bg-obsidian-900 border-l border-titanium-900 shadow-2xl z-40 flex flex-col">
      <div className="h-14 border-b border-titanium-900 flex items-center justify-between px-4">
        <span className="text-sm font-semibold text-titanium-50">Gap Details</span>
        <button onClick={onClose} className="p-1 hover:bg-obsidian-800 text-titanium-400">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Severity Badge */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-none w-fit border ${severityInfo.border} ${severityInfo.bg}`}>
          <AlertTriangle className={`h-4 w-4 ${severityInfo.text}`} />
          <span className={`text-sm font-semibold ${severityInfo.text}`}>{severityInfo.label}</span>
        </div>

        {/* Control */}
        <div>
          <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Control</p>
          <p className="text-sm font-mono text-titanium-100">{gap.control_id}</p>
          <p className="text-sm text-titanium-300">{gap.control_name}</p>
        </div>

        {/* Description */}
        <div>
          <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Gap Description</p>
          <p className="text-sm text-titanium-300">{gap.gap_description}</p>
        </div>

        {/* Root Cause */}
        <div>
          <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Root Cause</p>
          <p className="text-sm text-titanium-300">{gap.root_cause}</p>
        </div>

        {/* Metrics */}
        <div className="space-y-2">
          <div>
            <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Impact Score</p>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 bg-obsidian-800 rounded-none overflow-hidden">
                <div className="h-full bg-red-500" style={{ width: `${(gap.impact_score / 10) * 100}%` }} />
              </div>
              <span className="text-sm font-semibold text-titanium-100">{gap.impact_score}/10</span>
            </div>
          </div>

          <div>
            <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Estimated Effort</p>
            <p className="text-sm text-titanium-100">{gap.effort_days} days</p>
          </div>

          <div>
            <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Status</p>
            <p className="text-sm text-titanium-100">{STATUS_LABELS[gap.status]}</p>
          </div>
        </div>

        {/* Affected Controls */}
        {gap.affected_controls.length > 0 && (
          <div>
            <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-2">Affects {gap.affected_controls.length} Control{gap.affected_controls.length !== 1 ? 's' : ''}</p>
            <div className="space-y-1">
              {gap.affected_controls.map((cid) => (
                <div key={cid} className="text-[11px] text-blue-400 font-mono">{cid}</div>
              ))}
            </div>
          </div>
        )}

        {/* Fix Date */}
        {gap.estimated_fix_date && (
          <div>
            <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Est. Fix Date</p>
            <p className="text-sm text-titanium-100">{new Date(gap.estimated_fix_date).toLocaleDateString('de-DE')}</p>
          </div>
        )}

        {/* Owner */}
        {gap.owner && (
          <div>
            <p className="text-[11px] text-titanium-500 uppercase font-semibold tracking-wide mb-1">Owner</p>
            <p className="text-sm text-titanium-100">{gap.owner}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-titanium-900 p-4 flex gap-2">
        <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-none transition">
          <Target className="h-4 w-4" />
          Create Remediation
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-obsidian-800 border border-titanium-800 hover:bg-obsidian-700 text-titanium-200 text-sm font-semibold rounded-none transition">
          <TrendingUp className="h-4 w-4" />
          Track Progress
        </button>
      </div>
    </div>
  );
}
