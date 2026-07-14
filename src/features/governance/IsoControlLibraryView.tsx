import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Search, Filter, ChevronDown, CheckCircle2, AlertCircle,
  TrendingUp, Lock, Star, Zap, BarChart3, Download,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import {
  ISO27001_CONTROLS,
  ISO42001_CONTROLS,
  getMaturityColor,
  getMaturityLabel,
  searchControls,
  CONTROL_MATURITY_DESCRIPTIONS,
  type MaturityLevel,
} from '../../config/iso-control-templates';

interface ControlStatus {
  controlId: string;
  maturityLevel: MaturityLevel;
  implementationDate?: string;
  evidenceCount: number;
  owner?: string;
}

export function IsoControlLibraryView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { activeTenantId } = useTenant();
  const [framework, setFramework] = useState<'iso27001' | 'iso42001'>('iso27001');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClause, setSelectedClause] = useState<string | null>(null);
  const [minMaturity, setMinMaturity] = useState<MaturityLevel>(0);
  const [expandedControl, setExpandedControl] = useState<string | null>(null);
  const [controlStatuses, setControlStatuses] = useState<Record<string, ControlStatus>>({});

  const controls = framework === 'iso27001' ? ISO27001_CONTROLS : ISO42001_CONTROLS;

  const filteredControls = useMemo(() => {
    let result = controls;

    if (searchQuery) {
      result = searchControls(searchQuery).filter((c) => c.framework === framework);
    }

    if (selectedClause) {
      result = result.filter((c) => c.clause.startsWith(selectedClause));
    }

    const status = controlStatuses;
    result = result.filter((c) => {
      const currentMaturity = status[c.id]?.maturityLevel ?? 0;
      return currentMaturity >= minMaturity;
    });

    return result.sort((a, b) => a.clause.localeCompare(b.clause));
  }, [controls, searchQuery, selectedClause, minMaturity, controlStatuses]);

  const clauses = [...new Set(controls.map((c) => c.clause.split('.')[0]))].sort();
  const avgMaturity =
    Object.values(controlStatuses).length > 0
      ? Math.round(
          Object.values(controlStatuses).reduce((sum, s) => sum + s.maturityLevel, 0) /
            Object.values(controlStatuses).length
        )
      : 0;

  const handleMaturityChange = (controlId: string, level: MaturityLevel) => {
    setControlStatuses((prev) => ({
      ...prev,
      [controlId]: {
        ...prev[controlId],
        controlId,
        maturityLevel: level,
        implementationDate: new Date().toISOString().split('T')[0],
        evidenceCount: prev[controlId]?.evidenceCount ?? 0,
      },
    }));
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <Link to="/app/governance/iso27001" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="font-display font-bold text-sm text-titanium-50">ISO Control Library</div>
            <div className="text-[11px] text-titanium-400">Browse, assess, and manage controls</div>
          </div>
        </div>
        <button className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400">
          <Download className="h-4 w-4" />
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Framework Selector & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
            <div className="text-xs text-titanium-400 mb-2">Framework</div>
            <div className="flex gap-2">
              <button
                onClick={() => setFramework('iso27001')}
                className={`flex-1 px-3 py-2 text-xs font-semibold rounded-none transition-colors ${
                  framework === 'iso27001'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-obsidian-800 text-titanium-400 hover:bg-obsidian-700'
                }`}
              >
                ISO 27001
              </button>
              <button
                onClick={() => setFramework('iso42001')}
                className={`flex-1 px-3 py-2 text-xs font-semibold rounded-none transition-colors ${
                  framework === 'iso42001'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-obsidian-800 text-titanium-400 hover:bg-obsidian-700'
                }`}
              >
                ISO 42001
              </button>
            </div>
          </div>

          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
            <div className="text-xs text-titanium-400 mb-2">Total Controls</div>
            <div className="text-2xl font-bold text-cyan-300">{controls.length}</div>
          </div>

          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
            <div className="text-xs text-titanium-400 mb-2">Implemented</div>
            <div className="text-2xl font-bold text-green-400">
              {Object.values(controlStatuses).filter((s) => s.maturityLevel >= 2).length}
            </div>
          </div>

          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
            <div className="text-xs text-titanium-400 mb-2">Avg Maturity</div>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-amber-400">{avgMaturity}/5</div>
              <TrendingUp className="h-4 w-4 text-green-400" />
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-titanium-500" />
              <input
                type="text"
                placeholder="Search controls..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-cyan-600"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-titanium-500" />
              <select
                value={selectedClause || 'all'}
                onChange={(e) => setSelectedClause(e.target.value === 'all' ? null : e.target.value)}
                className="flex-1 px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-cyan-600"
              >
                <option value="all">All Clauses</option>
                {clauses.map((clause) => (
                  <option key={clause} value={clause}>
                    Clause {clause}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-titanium-500" />
              <select
                value={minMaturity}
                onChange={(e) => setMinMaturity(Number(e.target.value) as MaturityLevel)}
                className="flex-1 px-3 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-sm rounded-none focus:outline-none focus:border-cyan-600"
              >
                <option value="0">All Maturity Levels</option>
                <option value="2">Implemented or Higher</option>
                <option value="3">Established or Higher</option>
                <option value="4">Optimized or Higher</option>
              </select>
            </div>
          </div>
        </div>

        {/* Controls List */}
        <div className="space-y-3">
          {filteredControls.length === 0 ? (
            <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-8 text-center">
              <AlertCircle className="h-8 w-8 text-titanium-600 mx-auto mb-3" />
              <p className="text-titanium-400">No controls match your filters</p>
            </div>
          ) : (
            filteredControls.map((control) => {
              const status = controlStatuses[control.id];
              const maturity = status?.maturityLevel ?? 0;
              const isExpanded = expandedControl === control.id;

              return (
                <div
                  key={control.id}
                  className="bg-obsidian-900 border border-titanium-800 rounded-none hover:border-titanium-700 transition-colors"
                >
                  <button
                    onClick={() => setExpandedControl(isExpanded ? null : control.id)}
                    className="w-full px-4 py-3 flex items-start gap-3 hover:bg-obsidian-800/50"
                  >
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-xs font-mono text-titanium-500 bg-obsidian-800 px-2 py-1">
                          {control.clause}
                        </span>
                        <h3 className="font-semibold text-sm text-titanium-50">{control.title}</h3>
                      </div>
                      <p className="text-xs text-titanium-400 mb-2">{control.description}</p>

                      {/* Maturity Selector */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] text-titanium-500 uppercase">Maturity:</span>
                        <div className="flex gap-1">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <button
                              key={i}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMaturityChange(control.id, i as MaturityLevel);
                              }}
                              className={`w-6 h-6 rounded-none text-[10px] font-bold transition-colors ${
                                i <= maturity
                                  ? `${getMaturityColor(i as MaturityLevel)} text-white`
                                  : 'bg-obsidian-800 text-titanium-600 hover:bg-obsidian-700'
                              }`}
                              title={CONTROL_MATURITY_DESCRIPTIONS[i as MaturityLevel]}
                            >
                              {i}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 text-[11px]">
                        <span className="text-titanium-500">
                          {status?.evidenceCount ?? 0} evidence item{status?.evidenceCount !== 1 ? 's' : ''}
                        </span>
                        {status?.owner && <span className="text-cyan-400">Owner: {status.owner}</span>}
                        <span className="text-titanium-600">Effort: {control.estimatedEffort}</span>
                      </div>
                    </div>

                    <ChevronDown
                      className={`h-4 w-4 text-titanium-500 mt-0.5 transition-transform shrink-0 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 py-4 bg-obsidian-950/50 border-t border-titanium-800 space-y-4">
                      <div>
                        <h4 className="text-xs font-semibold text-titanium-50 mb-2">Objective</h4>
                        <p className="text-xs text-titanium-300">{control.objective}</p>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-titanium-50 mb-2">Guidance</h4>
                        <p className="text-xs text-titanium-300">{control.guidance}</p>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-titanium-50 mb-2 flex items-center gap-2">
                          <BarChart3 className="h-3 w-3" />
                          Maturity Progression
                        </h4>
                        <div className="space-y-2">
                          {control.maturityLevels.map((level) => (
                            <div key={level.level} className={`p-2 rounded-none border-l-2 ${getMaturityColor(level.level as MaturityLevel)}`}>
                              <div className="text-xs font-semibold text-white">
                                Level {level.level}: {CONTROL_MATURITY_DESCRIPTIONS[level.level as MaturityLevel]}
                              </div>
                              <p className="text-[10px] text-titanium-200">{level.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-titanium-50 mb-2 flex items-center gap-2">
                          <CheckCircle2 className="h-3 w-3" />
                          Recommended Evidence
                        </h4>
                        <ul className="space-y-1">
                          {control.recommendedEvidence.map((evidence, idx) => (
                            <li key={idx} className="text-[11px] text-titanium-300 flex items-start gap-2">
                              <span className="text-cyan-400 mt-0.5">•</span>
                              <span>{evidence}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {control.crossFrameworkMappings.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-titanium-50 mb-2">Mapped to Frameworks</h4>
                          <div className="flex flex-wrap gap-2">
                            {control.crossFrameworkMappings.map((mapping, idx) => (
                              <div key={idx} className="bg-obsidian-800 border border-titanium-700 rounded-none px-2 py-1">
                                <p className="text-[10px] font-semibold text-cyan-300 mb-1">{mapping.framework.toUpperCase()}</p>
                                <p className="text-[10px] text-titanium-400">{mapping.references.join(', ')}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Link
                          to={`/app/governance/evidence-vault-advanced?control=${control.id}`}
                          className="flex-1 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-none transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <Zap className="h-3 w-3" />
                          Add Evidence
                        </Link>
                        <button className="flex-1 px-3 py-2 border border-titanium-700 hover:border-titanium-600 text-titanium-300 text-xs font-semibold rounded-none transition-colors">
                          View Gaps
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
