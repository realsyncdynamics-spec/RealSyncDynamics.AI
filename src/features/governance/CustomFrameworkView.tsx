import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Edit2, BarChart3, TrendingUp, AlertCircle,
  ChevronDown, Copy, Download, Share2,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';

interface CustomFramework {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  basedOn?: string;
  controlCount: number;
  mappedFrameworks: string[];
  version: string;
  complianceScore: number;
  lastUpdated: string;
  createdBy: string;
  isPublished: boolean;
}

export function CustomFrameworkView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { activeTenantId } = useTenant();
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedFramework, setSelectedFramework] = useState<CustomFramework | null>(null);

  const [frameworks, setFrameworks] = useState<CustomFramework[]>([
    {
      id: 'cf-001',
      tenantId: activeTenantId || 'demo',
      name: 'Our ISO 27001 Customized',
      description: 'ISO 27001 adapted for our organization with additional AI governance controls',
      basedOn: 'iso27001',
      controlCount: 115,
      mappedFrameworks: ['ai_act', 'dsgvo'],
      version: '1.2.0',
      complianceScore: 82,
      lastUpdated: '2026-07-04T16:30:00Z',
      createdBy: 'Alice Chen',
      isPublished: true,
    },
    {
      id: 'cf-002',
      tenantId: activeTenantId || 'demo',
      name: 'AI Governance Framework',
      description: 'Custom framework combining ISO 42001 and AI Act requirements',
      basedOn: 'iso42001',
      controlCount: 48,
      mappedFrameworks: ['ai_act', 'nis2'],
      version: '1.0.0',
      complianceScore: 71,
      lastUpdated: '2026-06-28T10:15:00Z',
      createdBy: 'Bob Johnson',
      isPublished: true,
    },
  ]);

  const [expandedFramework, setExpandedFramework] = useState<string | null>(null);

  const handleViewDetail = (framework: CustomFramework) => {
    setSelectedFramework(framework);
    setView('detail');
  };

  const handleDeleteFramework = (frameworkId: string) => {
    if (confirm('Delete this framework? This cannot be undone.')) {
      setFrameworks(frameworks.filter((f) => f.id !== frameworkId));
    }
  };

  const handleDuplicateFramework = (framework: CustomFramework) => {
    const newFramework: CustomFramework = {
      ...framework,
      id: `cf-${Date.now()}`,
      name: `${framework.name} (Copy)`,
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      createdBy: 'Current User',
    };
    setFrameworks([...frameworks, newFramework]);
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 80) return 'bg-emerald-900/30';
    if (score >= 60) return 'bg-amber-900/30';
    return 'bg-red-900/30';
  };

  if (view === 'detail' && selectedFramework) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100">
        <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4 justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('list')}
              className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="font-display font-bold text-sm text-titanium-50">{selectedFramework.name}</div>
              <div className="text-[11px] text-titanium-400">Version {selectedFramework.version}</div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          {/* Header Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={`${getScoreBgColor(selectedFramework.complianceScore)} border border-titanium-800 rounded-none p-4`}>
              <div className="text-[11px] font-semibold text-titanium-400 mb-1">Compliance Score</div>
              <div className={`text-2xl font-bold ${getScoreColor(selectedFramework.complianceScore)}`}>
                {selectedFramework.complianceScore}%
              </div>
              <div className="text-[10px] text-titanium-500 mt-1">→ +3% from last week</div>
            </div>

            <div className="bg-blue-900/30 border border-titanium-800 rounded-none p-4">
              <div className="text-[11px] font-semibold text-titanium-400 mb-1">Controls</div>
              <div className="text-2xl font-bold text-blue-400">{selectedFramework.controlCount}</div>
              <div className="text-[10px] text-titanium-500 mt-1">Custom + inherited</div>
            </div>

            <div className="bg-cyan-900/30 border border-titanium-800 rounded-none p-4">
              <div className="text-[11px] font-semibold text-titanium-400 mb-1">Mapped Frameworks</div>
              <div className="text-2xl font-bold text-cyan-400">{selectedFramework.mappedFrameworks.length}</div>
              <div className="text-[10px] text-titanium-500 mt-1 truncate">
                {selectedFramework.mappedFrameworks.join(', ')}
              </div>
            </div>

            <div className="bg-titanium-900/30 border border-titanium-800 rounded-none p-4">
              <div className="text-[11px] font-semibold text-titanium-400 mb-1">Last Updated</div>
              <div className="text-sm font-bold text-titanium-200">
                {new Date(selectedFramework.lastUpdated).toLocaleDateString()}
              </div>
              <div className="text-[10px] text-titanium-500 mt-1">by {selectedFramework.createdBy}</div>
            </div>
          </div>

          {/* Framework Description */}
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
            <h2 className="font-semibold text-titanium-50 mb-2">Framework Details</h2>
            <p className="text-sm text-titanium-300 mb-4">{selectedFramework.description}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-[11px] font-semibold text-titanium-400 mb-1">Based On</div>
                <div className="text-titanium-200 font-mono">{selectedFramework.basedOn?.toUpperCase() || 'Custom'}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-titanium-400 mb-1">Status</div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${selectedFramework.isPublished ? 'bg-green-500' : 'bg-amber-500'}`} />
                  <span className="text-titanium-200">{selectedFramework.isPublished ? 'Published' : 'Draft'}</span>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-titanium-400 mb-1">ID</div>
                <div className="text-titanium-200 font-mono text-[10px]">{selectedFramework.id}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-titanium-400 mb-1">Created By</div>
                <div className="text-titanium-200">{selectedFramework.createdBy}</div>
              </div>
            </div>
          </div>

          {/* Compliance Gap Summary */}
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
            <h2 className="font-semibold text-titanium-50 mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-cyan-400" />
              Gap Analysis
            </h2>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-titanium-300">Implemented Controls</span>
                  <span className="text-sm font-mono text-cyan-400">94/115</span>
                </div>
                <div className="w-full bg-obsidian-800 rounded-none h-2">
                  <div className="bg-emerald-600 h-2 rounded-none" style={{ width: '81.7%' }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-titanium-300">In Progress</span>
                  <span className="text-sm font-mono text-amber-400">15/115</span>
                </div>
                <div className="w-full bg-obsidian-800 rounded-none h-2">
                  <div className="bg-amber-600 h-2 rounded-none" style={{ width: '13%' }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-titanium-300">Not Started</span>
                  <span className="text-sm font-mono text-red-400">6/115</span>
                </div>
                <div className="w-full bg-obsidian-800 rounded-none h-2">
                  <div className="bg-red-600 h-2 rounded-none" style={{ width: '5.2%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Link
              to={`/app/governance/iso-control-library`}
              className="px-4 py-2 bg-obsidian-800 border border-titanium-700 hover:border-titanium-600 text-titanium-200 font-semibold rounded-none transition-colors flex items-center gap-2"
            >
              <Edit2 className="h-4 w-4" />
              Edit Framework
            </Link>
            <button className="px-4 py-2 bg-obsidian-800 border border-titanium-700 hover:border-titanium-600 text-titanium-200 font-semibold rounded-none transition-colors flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Share
            </button>
            <button
              onClick={() => handleDuplicateFramework(selectedFramework)}
              className="px-4 py-2 bg-obsidian-800 border border-titanium-700 hover:border-titanium-600 text-titanium-200 font-semibold rounded-none transition-colors flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              Duplicate
            </button>
            <button className="px-4 py-2 bg-obsidian-800 border border-titanium-700 hover:border-titanium-600 text-titanium-200 font-semibold rounded-none transition-colors flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export
            </button>
            <button
              onClick={() => handleDeleteFramework(selectedFramework.id)}
              className="ml-auto px-4 py-2 border border-red-700/50 hover:border-red-600 text-red-400 font-semibold rounded-none transition-colors flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="font-display font-bold text-sm text-titanium-50">Custom Frameworks</div>
            <div className="text-[11px] text-titanium-400">View, manage, and customize compliance frameworks</div>
          </div>
        </div>
        <Link
          to="/app/governance/custom-framework-builder"
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-none transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Framework
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {frameworks.length === 0 ? (
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-8 text-center">
            <AlertCircle className="h-8 w-8 text-titanium-600 mx-auto mb-3" />
            <p className="text-titanium-400 mb-4">No custom frameworks yet</p>
            <Link
              to="/app/governance/custom-framework-builder"
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-none inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create First Framework
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {frameworks.map((framework) => (
              <div key={framework.id} className="bg-obsidian-900 border border-titanium-900 rounded-none">
                <button
                  onClick={() => {
                    setExpandedFramework(expandedFramework === framework.id ? null : framework.id);
                  }}
                  className="w-full px-4 py-4 flex items-start justify-between hover:bg-obsidian-800/50 transition-colors"
                >
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-3 mb-1">
                      <div className={`w-2 h-2 rounded-full ${framework.isPublished ? 'bg-green-500' : 'bg-amber-500'}`} />
                      <h3 className="font-semibold text-titanium-50">{framework.name}</h3>
                      <span className="text-[10px] font-mono text-titanium-500 bg-obsidian-800 px-2 py-1">
                        v{framework.version}
                      </span>
                    </div>
                    <p className="text-xs text-titanium-400 mb-3">{framework.description}</p>
                    <div className="flex items-center gap-4 text-[11px]">
                      <span className="text-titanium-500">
                        {framework.controlCount} controls
                      </span>
                      <span className="text-titanium-500">
                        {framework.mappedFrameworks.length} mapped frameworks
                      </span>
                      <span className={`font-semibold ${getScoreColor(framework.complianceScore)}`}>
                        {framework.complianceScore}% compliance
                      </span>
                      <span className="text-titanium-500">
                        Updated {new Date(framework.lastUpdated).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <ChevronDown
                    className={`h-4 w-4 text-titanium-500 mt-1 transition-transform shrink-0 ${
                      expandedFramework === framework.id ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {expandedFramework === framework.id && (
                  <div className="px-4 py-4 bg-obsidian-950/50 border-t border-titanium-800 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-[11px] font-semibold text-titanium-400 mb-1">Based On</div>
                        <div className="text-titanium-200 font-mono">{framework.basedOn?.toUpperCase() || 'Custom'}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-titanium-400 mb-1">Created By</div>
                        <div className="text-titanium-200">{framework.createdBy}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-titanium-400 mb-1">Mapped Frameworks</div>
                        <div className="text-titanium-200 text-[10px]">{framework.mappedFrameworks.join(', ')}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-titanium-400 mb-1">ID</div>
                        <div className="text-titanium-200 font-mono text-[10px]">{framework.id}</div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleViewDetail(framework)}
                        className="px-3 py-2 bg-cyan-900/30 border border-cyan-700 hover:bg-cyan-900/50 text-cyan-300 text-xs font-semibold rounded-none transition-colors flex items-center gap-2"
                      >
                        <BarChart3 className="h-3 w-3" />
                        View Details
                      </button>
                      <button
                        onClick={() => handleDuplicateFramework(framework)}
                        className="px-3 py-2 border border-titanium-700 hover:border-titanium-600 text-titanium-300 text-xs font-semibold rounded-none transition-colors flex items-center gap-2"
                      >
                        <Copy className="h-3 w-3" />
                        Duplicate
                      </button>
                      <button
                        onClick={() => handleDeleteFramework(framework.id)}
                        className="ml-auto px-3 py-2 border border-red-700/50 hover:border-red-600 text-red-400 text-xs font-semibold rounded-none transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
