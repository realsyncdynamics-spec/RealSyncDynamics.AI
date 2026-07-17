import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Brain, Loader2, AlertTriangle, Search, Filter,
  ChevronRight, BookOpen, Lightbulb, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getAuthToken } from '../../lib/auth';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';

interface ControlLibraryItem {
  id: string;
  control_code: string;
  control_name: string;
  description: string;
  guidance?: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  category: string;
  implementation_status?: 'not_started' | 'planned' | 'in_progress' | 'implemented' | 'optimized';
}

const CATEGORIES = [
  'governance',
  'resources',
  'operations',
  'monitoring',
  'improvement',
  'data',
  'documentation',
];

const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];

function _Iso42001ControlsLibraryView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const Iso42001ControlsLibraryView = withPerformanceMonitoring(
  _Iso42001ControlsLibraryView,
  'Iso42001ControlsLibraryView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { activeTenantId } = useTenant();
  const [controls, setControls] = useState<ControlLibraryItem[]>([]);
  const [filteredControls, setFilteredControls] = useState<ControlLibraryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
  const [expandedControl, setExpandedControl] = useState<string | null>(null);

  const loadControls = async () => {
    if (!activeTenantId) return;
    setLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();
      const response = await fetch(
        `/functions/v1/iso42001-controls-library?tenant_id=${activeTenantId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error('Failed to load controls');
      const data = await response.json();
      setControls(data.controls || []);
      setFilteredControls(data.controls || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadControls();
  }, [activeTenantId]);

  // Apply filters
  useEffect(() => {
    let filtered = controls;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.control_code.toLowerCase().includes(search) ||
          c.control_name.toLowerCase().includes(search) ||
          c.description.toLowerCase().includes(search)
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter((c) => c.category === selectedCategory);
    }

    if (selectedSeverity) {
      filtered = filtered.filter((c) => c.severity === selectedSeverity);
    }

    setFilteredControls(filtered);
  }, [searchTerm, selectedCategory, selectedSeverity, controls]);

  if (!activeTenantId) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center">
        <div className="text-titanium-500 text-sm">Tenant wählen.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center">
        <div className="flex items-center gap-2 text-titanium-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Laden…
        </div>
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
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-sm">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Controls Library</div>
              <div className="text-[11px] text-titanium-400 font-medium">ISO 42001 Kontrollkatalog</div>
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

        <div className="space-y-6">
          {/* Search and Filters */}
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
            <div className="flex flex-col gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-titanium-500" />
                <input
                  type="text"
                  placeholder="Kontrolle suchen (Code, Name, Beschreibung)…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-obsidian-800 border border-titanium-800 text-titanium-200 text-sm rounded-none px-3 py-2 pl-9 outline-none"
                />
              </div>

              {/* Category Filter */}
              <div>
                <label className="text-[11px] font-semibold text-titanium-300 uppercase tracking-wide block mb-2 flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5" /> Kategorie
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`text-xs px-3 py-1.5 rounded-none border transition-colors ${
                      selectedCategory === null
                        ? 'bg-blue-700 border-blue-600 text-white'
                        : 'border-titanium-800 text-titanium-300 hover:border-titanium-600'
                    }`}
                  >
                    Alle
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`text-xs px-3 py-1.5 rounded-none border transition-colors capitalize ${
                        selectedCategory === cat
                          ? 'bg-blue-700 border-blue-600 text-white'
                          : 'border-titanium-800 text-titanium-300 hover:border-titanium-600'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Severity Filter */}
              <div>
                <label className="text-[11px] font-semibold text-titanium-300 uppercase tracking-wide block mb-2">
                  Schweregrad
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedSeverity(null)}
                    className={`text-xs px-3 py-1.5 rounded-none border transition-colors ${
                      selectedSeverity === null
                        ? 'bg-blue-700 border-blue-600 text-white'
                        : 'border-titanium-800 text-titanium-300 hover:border-titanium-600'
                    }`}
                  >
                    Alle
                  </button>
                  {SEVERITIES.map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setSelectedSeverity(sev)}
                      className={`text-xs px-3 py-1.5 rounded-none border transition-colors capitalize ${
                        selectedSeverity === sev
                          ? 'bg-blue-700 border-blue-600 text-white'
                          : `border-titanium-800 text-titanium-300 hover:border-titanium-600 ${getSeverityBgHover(sev)}`
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Results Count */}
          <div className="text-sm text-titanium-400">
            {filteredControls.length} von {controls.length} Kontrollen
          </div>

          {/* Controls List */}
          <div className="space-y-2">
            {filteredControls.length === 0 ? (
              <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-8 text-center">
                <AlertCircle className="h-8 w-8 text-titanium-500 mx-auto mb-2" />
                <p className="text-titanium-400 text-sm">Keine Kontrollen gefunden</p>
              </div>
            ) : (
              filteredControls.map((control) => (
                <ControlCard
                  key={control.id}
                  control={control}
                  isExpanded={expandedControl === control.id}
                  onToggle={() =>
                    setExpandedControl(expandedControl === control.id ? null : control.id)
                  }
                />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function ControlCard({
  control,
  isExpanded,
  onToggle,
}: {
  control: ControlLibraryItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const severityColors = {
    critical: 'border-red-900 bg-red-950/40 text-red-300',
    high: 'border-orange-900 bg-orange-950/40 text-orange-300',
    medium: 'border-yellow-900 bg-yellow-950/40 text-yellow-300',
    low: 'border-blue-900 bg-blue-950/40 text-blue-300',
    info: 'border-cyan-900 bg-cyan-950/40 text-cyan-300',
  };

  const categoryIcons: Record<string, typeof Brain> = {
    governance: Brain,
    resources: AlertCircle,
    operations: CheckCircle2,
    monitoring: Brain,
    improvement: Lightbulb,
    data: AlertTriangle,
    documentation: BookOpen,
  };

  const Icon = categoryIcons[control.category] || Brain;

  return (
    <div className={`border rounded-none transition-all ${severityColors[control.severity]}`}>
      <button
        onClick={onToggle}
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-black/20 transition-colors"
      >
        <Icon className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-titanium-50 text-sm">{control.control_code}</h3>
              <p className="text-xs text-titanium-300 mt-1">{control.control_name}</p>
            </div>
            <ChevronRight
              className={`h-4 w-4 shrink-0 mt-0.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-white/10 px-4 py-3 bg-black/20">
          <div className="space-y-3">
            {/* Description */}
            <div>
              <h4 className="text-[11px] font-semibold text-titanium-300 uppercase tracking-wide mb-1">
                Beschreibung
              </h4>
              <p className="text-[12px] text-titanium-400 leading-relaxed">
                {control.description}
              </p>
            </div>

            {/* Guidance */}
            {control.guidance && (
              <div>
                <h4 className="text-[11px] font-semibold text-titanium-300 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5" /> Implementierungsleitfaden
                </h4>
                <p className="text-[12px] text-titanium-400 leading-relaxed">
                  {control.guidance}
                </p>
              </div>
            )}

            {/* Metadata */}
            <div className="flex flex-wrap gap-3 text-[11px] pt-2 border-t border-white/5">
              <div>
                <span className="text-titanium-500">Kategorie:</span>
                <span className="text-titanium-300 ml-2 capitalize">{control.category}</span>
              </div>
              <div>
                <span className="text-titanium-500">Schweregrad:</span>
                <span className="text-titanium-300 ml-2 capitalize">{control.severity}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getSeverityBgHover(severity: string): string {
  const map: Record<string, string> = {
    critical: 'hover:bg-red-950/20',
    high: 'hover:bg-orange-950/20',
    medium: 'hover:bg-yellow-950/20',
    low: 'hover:bg-blue-950/20',
    info: 'hover:bg-cyan-950/20',
  };
  return map[severity] || '';
}
