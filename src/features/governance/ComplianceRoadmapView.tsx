import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Calendar, TrendingUp, Target, AlertCircle, CheckCircle2,
  Clock, Zap, Download, Filter, ChevronDown,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';

interface RoadmapItem {
  id: string;
  title: string;
  framework: string;
  type: 'gap' | 'control' | 'milestone';
  status: 'planned' | 'in_progress' | 'completed' | 'blocked';
  startDate: string;
  targetDate: string;
  completedDate?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  owner: string;
  progress: number;
  dependencies?: string[];
  blockers?: string[];
}

export function ComplianceRoadmapView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { activeTenantId } = useTenant();
  const [framework, setFramework] = useState<string | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'planned' | 'in_progress' | 'completed' | 'blocked'>('all');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'gantt' | 'timeline'>('gantt');

  // Mock data for roadmap items
  const roadmapItems: RoadmapItem[] = [
    {
      id: 'gap-001',
      title: 'Implement MFA for all admin accounts',
      framework: 'iso27001',
      type: 'gap',
      status: 'in_progress',
      startDate: '2026-07-01',
      targetDate: '2026-08-15',
      priority: 'critical',
      owner: 'Security Team',
      progress: 65,
    },
    {
      id: 'gap-002',
      title: 'Deploy endpoint detection & response',
      framework: 'iso27001',
      type: 'gap',
      status: 'planned',
      startDate: '2026-08-01',
      targetDate: '2026-10-31',
      priority: 'high',
      owner: 'Infrastructure',
      progress: 0,
    },
    {
      id: 'ctrl-001',
      title: 'Achieve Level 3 maturity for A.8.2 (Privileged Access)',
      framework: 'iso27001',
      type: 'control',
      status: 'in_progress',
      startDate: '2026-06-15',
      targetDate: '2026-09-30',
      priority: 'high',
      owner: 'Access Management',
      progress: 45,
    },
    {
      id: 'gap-003',
      title: 'Complete ISO 42001 AI governance framework',
      framework: 'iso42001',
      type: 'gap',
      status: 'planned',
      startDate: '2026-09-01',
      targetDate: '2026-12-31',
      priority: 'high',
      owner: 'Compliance',
      progress: 0,
    },
    {
      id: 'gap-004',
      title: 'Establish DPA with all data processors',
      framework: 'dsgvo',
      type: 'gap',
      status: 'in_progress',
      startDate: '2026-07-15',
      targetDate: '2026-09-15',
      priority: 'critical',
      owner: 'Legal',
      progress: 30,
    },
    {
      id: 'mil-001',
      title: 'Q3 Compliance Milestone - ISO 27001 70%',
      framework: 'iso27001',
      type: 'milestone',
      status: 'planned',
      startDate: '2026-09-30',
      targetDate: '2026-09-30',
      priority: 'high',
      owner: 'Compliance',
      progress: 0,
    },
    {
      id: 'gap-005',
      title: 'Implement encryption for data at rest',
      framework: 'dsgvo',
      type: 'gap',
      status: 'blocked',
      startDate: '2026-08-01',
      targetDate: '2026-11-30',
      priority: 'critical',
      owner: 'Infrastructure',
      progress: 20,
      blockers: ['Awaiting budget approval', 'Vendor evaluation in progress'],
    },
  ];

  const filteredItems = useMemo(() => {
    let result = roadmapItems;

    if (framework !== 'all') {
      result = result.filter((item) => item.framework === framework);
    }

    if (statusFilter !== 'all') {
      result = result.filter((item) => item.status === statusFilter);
    }

    return result.sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());
  }, [framework, statusFilter]);

  const today = new Date();
  const minDate = new Date(Math.min(...filteredItems.map((item) => new Date(item.startDate).getTime())));
  const maxDate = new Date(Math.max(...filteredItems.map((item) => new Date(item.targetDate).getTime())));

  const getItemPosition = (itemDate: string): number => {
    const itemTime = new Date(itemDate).getTime();
    const minTime = minDate.getTime();
    const maxTime = maxDate.getTime();
    return ((itemTime - minTime) / (maxTime - minTime)) * 100;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'bg-green-900 border-green-700';
      case 'in_progress':
        return 'bg-blue-900 border-blue-700';
      case 'planned':
        return 'bg-amber-900 border-amber-700';
      case 'blocked':
        return 'bg-red-900 border-red-700';
      default:
        return 'bg-obsidian-800 border-titanium-800';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'planned':
        return 'Planned';
      case 'blocked':
        return 'Blocked';
      default:
        return 'Unknown';
    }
  };

  const getTypeIcon = (type: string): React.ReactNode => {
    switch (type) {
      case 'gap':
        return <AlertCircle className="h-3 w-3" />;
      case 'control':
        return <Target className="h-3 w-3" />;
      case 'milestone':
        return <TrendingUp className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const frameworks = [...new Set(roadmapItems.map((item) => item.framework))];

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <Link to="/app/governance/gaps" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="font-display font-bold text-sm text-titanium-50">Compliance Roadmap</div>
            <div className="text-[11px] text-titanium-400">Strategic timeline for gap closure and maturity progression</div>
          </div>
        </div>
        <button className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400">
          <Download className="h-4 w-4" />
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
            <div className="text-xs text-titanium-400 mb-2">Total Items</div>
            <div className="text-2xl font-bold text-cyan-300">{roadmapItems.length}</div>
          </div>

          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
            <div className="text-xs text-titanium-400 mb-2">In Progress</div>
            <div className="text-2xl font-bold text-blue-400">
              {roadmapItems.filter((i) => i.status === 'in_progress').length}
            </div>
          </div>

          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
            <div className="text-xs text-titanium-400 mb-2">Blocked</div>
            <div className="text-2xl font-bold text-red-400">
              {roadmapItems.filter((i) => i.status === 'blocked').length}
            </div>
          </div>

          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
            <div className="text-xs text-titanium-400 mb-2">Completion Rate</div>
            <div className="text-2xl font-bold text-green-400">
              {Math.round(
                (roadmapItems.filter((i) => i.status === 'completed').length / roadmapItems.length) * 100
              )}%
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4 flex flex-wrap gap-3 items-center">
          <Filter className="h-4 w-4 text-titanium-500" />

          <select
            value={framework}
            onChange={(e) => setFramework(e.target.value)}
            className="px-3 py-1.5 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-xs rounded-none focus:outline-none focus:border-cyan-600"
          >
            <option value="all">All Frameworks</option>
            {frameworks.map((fw) => (
              <option key={fw} value={fw}>
                {fw.toUpperCase()}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-xs rounded-none focus:outline-none focus:border-cyan-600"
          >
            <option value="all">All Status</option>
            <option value="planned">Planned</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="completed">Completed</option>
          </select>

          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setViewMode('gantt')}
              className={`px-3 py-1.5 rounded-none text-xs font-semibold transition-colors ${
                viewMode === 'gantt'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-obsidian-800 text-titanium-400 hover:bg-obsidian-700'
              }`}
            >
              Gantt Chart
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 rounded-none text-xs font-semibold transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-obsidian-800 text-titanium-400 hover:bg-obsidian-700'
              }`}
            >
              Timeline
            </button>
          </div>
        </div>

        {/* Gantt Chart View */}
        {viewMode === 'gantt' && (
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4 overflow-x-auto">
            <div className="space-y-2 min-w-min">
              {filteredItems.map((item) => {
                const startPos = getItemPosition(item.startDate);
                const endPos = getItemPosition(item.targetDate);
                const width = endPos - startPos;

                return (
                  <div key={item.id} className="flex items-center gap-2">
                    <div className="w-48 flex-shrink-0">
                      <button
                        onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                        className="flex items-center gap-2 w-full text-left p-2 rounded-none hover:bg-obsidian-800 transition-colors"
                      >
                        {getTypeIcon(item.type)}
                        <span className="text-xs font-semibold text-titanium-300 truncate">{item.title}</span>
                        <ChevronDown
                          className={`h-3 w-3 ml-auto shrink-0 transition-transform ${
                            expandedItem === item.id ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex-1 h-8 bg-obsidian-800 border border-titanium-800 rounded-none relative">
                      <div
                        className={`h-full border-l-2 rounded-none ${getStatusColor(item.status)}`}
                        style={{
                          left: `${startPos}%`,
                          width: `${Math.max(width, 2)}%`,
                        }}
                      >
                        <div className="h-full bg-gradient-to-r from-current to-current opacity-70 flex items-center px-2">
                          <span className="text-[10px] font-bold text-white whitespace-nowrap">{item.progress}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="w-24 flex-shrink-0 text-right">
                      <div className="text-[10px] text-titanium-400">{new Date(item.targetDate).toLocaleDateString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Timeline View */}
        {viewMode === 'timeline' && (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <div key={item.id} className={`border rounded-none p-4 ${getStatusColor(item.status)}`}>
                <button
                  onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                  className="w-full flex items-start gap-3 text-left"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getTypeIcon(item.type)}
                      <h3 className="font-semibold text-sm text-white">{item.title}</h3>
                      <span className="ml-auto text-[10px] font-semibold px-2 py-1 bg-black/30 rounded-none">
                        {getStatusLabel(item.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-titanium-200 mb-2">
                      <span className="text-titanium-500">{item.framework.toUpperCase()}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(item.targetDate).toLocaleDateString()}
                      </span>
                      <span>•</span>
                      <span>Owner: {item.owner}</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-black/30 rounded-none mb-2">
                      <div
                        className="h-full bg-white/50 rounded-none transition-all"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>

                  <ChevronDown
                    className={`h-4 w-4 text-titanium-400 mt-0.5 transition-transform shrink-0 ${
                      expandedItem === item.id ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Expanded Details */}
                {expandedItem === item.id && (
                  <div className="mt-3 pt-3 border-t border-current/30 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[10px] font-semibold text-titanium-300">Priority</div>
                        <div className="text-xs font-bold uppercase text-titanium-100">{item.priority}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-titanium-300">Progress</div>
                        <div className="text-xs font-bold text-titanium-100">{item.progress}%</div>
                      </div>
                    </div>

                    {item.blockers && item.blockers.length > 0 && (
                      <div>
                        <div className="text-[10px] font-semibold text-red-300 mb-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Blockers
                        </div>
                        <ul className="space-y-1">
                          {item.blockers.map((blocker, idx) => (
                            <li key={idx} className="text-[10px] text-titanium-300">• {blocker}</li>
                          ))}
                        </ul>
                      </div>
                    )}
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
