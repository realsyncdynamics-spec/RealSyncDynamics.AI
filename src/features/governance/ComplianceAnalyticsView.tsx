import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, TrendingUp, TrendingDown, BarChart3, LineChart as LineChartIcon,
  Activity, AlertTriangle, CheckCircle2, Clock, Filter,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';

interface MetricSnapshot {
  date: string;
  framework: string;
  score: number;
  controlsCount: number;
  gapsCount: number;
  evidenceCount: number;
}

interface KPICard {
  label: string;
  value: string | number;
  unit?: string;
  trend?: number;
  trendDirection?: 'up' | 'down';
  icon: React.ReactNode;
  color: string;
}

export function ComplianceAnalyticsView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { activeTenantId } = useTenant();
  const [selectedFramework, setSelectedFramework] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  const frameworks = [
    { id: 'all', name: 'All Frameworks', color: 'bg-slate-600' },
    { id: 'iso27001', name: 'ISO 27001', color: 'bg-cyan-600' },
    { id: 'iso42001', name: 'ISO 42001', color: 'bg-emerald-600' },
    { id: 'ai_act', name: 'AI Act', color: 'bg-violet-600' },
    { id: 'dsgvo', name: 'DSGVO', color: 'bg-amber-600' },
    { id: 'nis2', name: 'NIS2', color: 'bg-red-600' },
  ];

  const kpis: KPICard[] = [
    {
      label: 'Overall Compliance Score',
      value: 78,
      unit: '%',
      trend: 3,
      trendDirection: 'up',
      icon: <Activity className="h-4 w-4" />,
      color: 'from-emerald-900 to-emerald-800',
    },
    {
      label: 'Controls Implemented',
      value: '342',
      unit: '/ 450',
      trend: 8,
      trendDirection: 'up',
      icon: <CheckCircle2 className="h-4 w-4" />,
      color: 'from-blue-900 to-blue-800',
    },
    {
      label: 'Active Gaps',
      value: 47,
      trend: -12,
      trendDirection: 'down',
      icon: <AlertTriangle className="h-4 w-4" />,
      color: 'from-red-900 to-red-800',
    },
    {
      label: 'Evidence Coverage',
      value: 92,
      unit: '%',
      trend: 5,
      trendDirection: 'up',
      icon: <CheckCircle2 className="h-4 w-4" />,
      color: 'from-purple-900 to-purple-800',
    },
  ];

  const mockMetrics: MetricSnapshot[] = [
    { date: '2026-06-01', framework: 'iso27001', score: 72, controlsCount: 95, gapsCount: 8, evidenceCount: 145 },
    { date: '2026-06-08', framework: 'iso27001', score: 74, controlsCount: 98, gapsCount: 7, evidenceCount: 152 },
    { date: '2026-06-15', framework: 'iso27001', score: 75, controlsCount: 100, gapsCount: 6, evidenceCount: 158 },
    { date: '2026-06-22', framework: 'iso27001', score: 76, controlsCount: 102, gapsCount: 5, evidenceCount: 165 },
    { date: '2026-06-29', framework: 'iso27001', score: 78, controlsCount: 105, gapsCount: 4, evidenceCount: 172 },
    { date: '2026-07-05', framework: 'iso27001', score: 80, controlsCount: 108, gapsCount: 3, evidenceCount: 180 },
  ];

  const frameworkScores = [
    { name: 'ISO 27001', score: 80, target: 85, trend: '+3%' },
    { name: 'ISO 42001', score: 71, target: 90, trend: '+5%' },
    { name: 'AI Act', score: 75, target: 88, trend: '+2%' },
    { name: 'DSGVO', score: 82, target: 95, trend: '+1%' },
    { name: 'NIS2', score: 65, target: 80, trend: '+7%' },
  ];

  const gapTrends = [
    { week: 'Week 1', opened: 8, closed: 2, net: 6 },
    { week: 'Week 2', opened: 5, closed: 3, net: 2 },
    { week: 'Week 3', opened: 3, closed: 5, net: -2 },
    { week: 'Week 4', opened: 2, closed: 4, net: -2 },
  ];

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="font-display font-bold text-sm text-titanium-50">Compliance Analytics</div>
            <div className="text-[11px] text-titanium-400">Trends, KPIs, and predictive forecasting</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-titanium-500" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-3 py-1.5 bg-obsidian-800 border border-titanium-800 text-titanium-100 text-xs rounded-none focus:outline-none focus:border-cyan-600"
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="quarter">Last Quarter</option>
            <option value="year">Last Year</option>
          </select>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Framework Selector */}
        <div className="flex gap-2 flex-wrap">
          {frameworks.map((fw) => (
            <button
              key={fw.id}
              onClick={() => setSelectedFramework(fw.id)}
              className={`px-4 py-2 font-semibold text-xs rounded-none transition-colors ${
                selectedFramework === fw.id
                  ? `${fw.color} text-white`
                  : 'bg-obsidian-900 border border-titanium-800 text-titanium-400 hover:border-titanium-700'
              }`}
            >
              {fw.name}
            </button>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, idx) => (
            <div key={idx} className={`bg-gradient-to-br ${kpi.color} border border-titanium-800 rounded-none p-4`}>
              <div className="flex items-start justify-between mb-3">
                <div className="text-titanium-300 text-[11px] font-semibold">{kpi.label}</div>
                <div className="text-cyan-400">{kpi.icon}</div>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <div className="text-3xl font-bold text-white">{kpi.value}</div>
                {kpi.unit && <div className="text-titanium-400 text-sm">{kpi.unit}</div>}
              </div>
              {kpi.trend && (
                <div className="flex items-center gap-1 text-xs">
                  {kpi.trendDirection === 'up' ? (
                    <>
                      <TrendingUp className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-300">+{kpi.trend}% from last period</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-3 w-3 text-green-400" />
                      <span className="text-green-300">{kpi.trend}% from last period</span>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Compliance Score Trends */}
        <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
          <h2 className="font-semibold text-titanium-50 mb-4 flex items-center gap-2">
            <LineChartIcon className="h-4 w-4 text-cyan-400" />
            Compliance Score Trend (Last 30 Days)
          </h2>
          <div className="space-y-4">
            {mockMetrics.map((metric, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-titanium-400">{metric.date}</span>
                  <span className="text-sm font-semibold text-cyan-400">{metric.score}%</span>
                </div>
                <div className="w-full bg-obsidian-800 rounded-none h-2">
                  <div
                    className="bg-gradient-to-r from-cyan-600 to-cyan-500 h-2 rounded-none transition-all"
                    style={{ width: `${metric.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Framework-Specific Scores */}
        <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
          <h2 className="font-semibold text-titanium-50 mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-emerald-400" />
            Framework Scores & Targets
          </h2>
          <div className="space-y-4">
            {frameworkScores.map((fw, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-titanium-200">{fw.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-cyan-400 font-mono text-sm">{fw.score}%</span>
                    <span className="text-emerald-400 text-xs">{fw.trend}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-obsidian-800 rounded-none h-2">
                    <div
                      className="bg-cyan-600 h-2 rounded-none"
                      style={{ width: `${fw.score}%` }}
                    />
                  </div>
                  <div className="flex-1 bg-obsidian-800 rounded-none h-2">
                    <div
                      className="bg-obsidian-700 h-2 rounded-none"
                      style={{ width: `${fw.target - fw.score}%` }}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-titanium-500 mt-1">
                  <span>Score</span>
                  <span>Target: {fw.target}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gap Trends */}
        <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6">
          <h2 className="font-semibold text-titanium-50 mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-amber-400" />
            Gap Movement Trends
          </h2>
          <div className="space-y-3">
            {gapTrends.map((gt, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <span className="text-sm text-titanium-400 w-16">{gt.week}</span>
                <div className="flex gap-2 flex-1">
                  <div className="flex-1 bg-obsidian-800 rounded-none p-2">
                    <div className="text-[10px] text-red-400 font-mono">Opened: {gt.opened}</div>
                    <div className="w-full bg-obsidian-700 h-1 rounded-none mt-1">
                      <div className="bg-red-600 h-1 rounded-none" style={{ width: `${gt.opened * 10}%` }} />
                    </div>
                  </div>
                  <div className="flex-1 bg-obsidian-800 rounded-none p-2">
                    <div className="text-[10px] text-emerald-400 font-mono">Closed: {gt.closed}</div>
                    <div className="w-full bg-obsidian-700 h-1 rounded-none mt-1">
                      <div className="bg-emerald-600 h-1 rounded-none" style={{ width: `${gt.closed * 10}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-center px-4 bg-obsidian-800 rounded-none min-w-16">
                    <span className={`font-semibold text-sm ${gt.net >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {gt.net >= 0 ? '+' : ''}{gt.net}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Readiness Score */}
        <div className="bg-gradient-to-br from-purple-900 to-purple-800 border border-titanium-800 rounded-none p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-semibold text-titanium-50 mb-1">Audit Readiness Score</h2>
              <p className="text-xs text-titanium-400">Assessment of readiness for external audit</p>
            </div>
            <Clock className="h-5 w-5 text-purple-300" />
          </div>
          <div className="flex items-baseline gap-3">
            <div className="text-4xl font-bold text-white">84</div>
            <div className="text-sm text-titanium-300">/100</div>
          </div>
          <div className="mt-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-titanium-300">Documentation Coverage</span>
              <span className="text-cyan-400 font-mono">92%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-titanium-300">Evidence Completeness</span>
              <span className="text-cyan-400 font-mono">88%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-titanium-300">Process Implementation</span>
              <span className="text-cyan-400 font-mono">79%</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
