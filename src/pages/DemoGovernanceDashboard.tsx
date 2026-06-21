import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '../features/supabase/SupabaseAuthContext';
import { useDashboardData } from '../features/supabase/useDashboardData';
import { ChevronRight, LogOut, AlertCircle, CheckCircle } from 'lucide-react';

// Animated counter component
function AnimatedCounter({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setCount(Math.floor(progress * target));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    const rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);

  return <>{count.toLocaleString()}</>;
}

// Animated progress bar
function AnimatedProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const percentage = (value / max) * 100;

  useEffect(() => {
    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / 1500, 1);
      setDisplayValue(progress * percentage);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    const rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [percentage]);

  return (
    <div className="w-full bg-obsidian-800 rounded-full h-3 overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-300"
        style={{ width: `${displayValue}%` }}
      />
    </div>
  );
}

// Pulse animation component for monitoring status
function PulseIndicator() {
  return (
    <div className="relative inline-block">
      <div className="w-3 h-3 rounded-full bg-green-500"></div>
      <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
    </div>
  );
}

// Status card component
function StatusCard({
  title,
  value,
  icon: Icon,
  color = 'green',
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color?: 'green' | 'orange' | 'blue';
}) {
  const bgColor = {
    green: 'bg-green-500/10',
    orange: 'bg-orange-500/10',
    blue: 'bg-blue-500/10',
  }[color];

  const borderColor = {
    green: 'border-green-500/30',
    orange: 'border-orange-500/30',
    blue: 'border-blue-500/30',
  }[color];

  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg p-4 animate-fade-in`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-titanium-400 text-sm font-medium">{title}</span>
        <div className="text-green-400">{Icon}</div>
      </div>
      <div className="text-xl font-bold text-titanium-100">{value}</div>
    </div>
  );
}

// Evidence list item
function EvidenceItem({
  id,
  title,
  date,
  status,
}: {
  id: string;
  title: string;
  date: string;
  status: 'verified' | 'pending' | 'expired';
}) {
  const statusConfig = {
    verified: { color: 'text-green-400', bg: 'bg-green-500/10', label: 'Verified' },
    pending: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Pending' },
    expired: { color: 'text-red-400', bg: 'bg-red-500/10', label: 'Expired' },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center justify-between py-3 border-b border-titanium-800/30 hover:bg-obsidian-800/30 px-3 rounded transition-colors">
      <div className="flex-1">
        <div className="text-titanium-100 text-sm font-medium">{title}</div>
        <div className="text-titanium-500 text-xs mt-1">{date}</div>
      </div>
      <div className={`${config.bg} ${config.color} px-2 py-1 rounded text-xs font-semibold`}>
        {config.label}
      </div>
    </div>
  );
}

export function DemoGovernanceDashboard() {
  const navigate = useNavigate();
  const { logout, user } = useSupabaseAuth();
  const { data: dashboardData } = useDashboardData(user?.id);

  const handleLogout = async () => {
    await logout();
    navigate('/demo-login', { replace: true });
  };

  // Convert evidence list to the format needed by EvidenceItem
  const evidenceItems = dashboardData.evidenceList.map((item) => ({
    id: item.id,
    title: item.title,
    date: item.date,
    status: 'verified' as const,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-obsidian-950 via-obsidian-900 to-obsidian-950">
      {/* Header */}
      <header className="border-b border-titanium-800/30 bg-obsidian-900/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-titanium-100">Governance Dashboard</h1>
              <p className="text-titanium-400 text-sm mt-1">Welcome, {user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded text-red-400 text-sm font-medium transition-colors"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Risk Score Card */}
          <div className="bg-obsidian-900/50 border border-titanium-800/30 rounded-lg p-6 backdrop-blur-xl animate-fade-in">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-titanium-400 text-sm font-medium">Governance Score</h3>
              <div className="text-orange-400">
                <AlertCircle size={20} />
              </div>
            </div>

            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-4xl font-bold text-titanium-100">{dashboardData.riskScore}</span>
              <span className="text-titanium-500">/100</span>
            </div>

            <div className="mb-3">
              <AnimatedProgressBar value={dashboardData.riskScore} />
            </div>

            <p className="text-titanium-500 text-xs">Strong governance posture</p>
          </div>

          {/* Evidence Count Card */}
          <div className="bg-obsidian-900/50 border border-titanium-800/30 rounded-lg p-6 backdrop-blur-xl animate-fade-in" style={{ animationDelay: '100ms' }}>
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-titanium-400 text-sm font-medium">Evidence Count</h3>
              <div className="text-blue-400">
                <CheckCircle size={20} />
              </div>
            </div>

            <div className="text-4xl font-bold text-titanium-100 mb-4">
              <AnimatedCounter target={dashboardData.evidenceCount} duration={2000} />
            </div>

            <p className="text-titanium-500 text-xs">Compliance artifacts collected</p>
          </div>

          {/* DSGVO Status */}
          <StatusCard
            title="DSGVO Status"
            value="Compliant"
            icon={<PulseIndicator />}
            color="green"
          />

          {/* AI Act Status */}
          <StatusCard
            title="AI Act Status"
            value="Ready"
            icon={<PulseIndicator />}
            color="green"
          />
        </div>

        {/* Monitoring & Evidence Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monitoring Status */}
          <div className="lg:col-span-1 bg-obsidian-900/50 border border-titanium-800/30 rounded-lg p-6 backdrop-blur-xl animate-fade-in" style={{ animationDelay: '200ms' }}>
            <h2 className="text-titanium-100 font-semibold mb-6">Monitoring Status</h2>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-obsidian-800/30 rounded">
                <PulseIndicator />
                <div>
                  <div className="text-titanium-100 text-sm font-medium">System Monitoring</div>
                  <div className="text-titanium-500 text-xs">Live</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-obsidian-800/30 rounded">
                <PulseIndicator />
                <div>
                  <div className="text-titanium-100 text-sm font-medium">Evidence Sync</div>
                  <div className="text-titanium-500 text-xs">Active</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-obsidian-800/30 rounded">
                <PulseIndicator />
                <div>
                  <div className="text-titanium-100 text-sm font-medium">Compliance Alerts</div>
                  <div className="text-titanium-500 text-xs">0 issues</div>
                </div>
              </div>
            </div>
          </div>

          {/* Evidence List */}
          <div className="lg:col-span-2 bg-obsidian-900/50 border border-titanium-800/30 rounded-lg p-6 backdrop-blur-xl animate-fade-in" style={{ animationDelay: '300ms' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-titanium-100 font-semibold">Recent Evidence</h2>
              <button className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-sm transition-colors">
                View All <ChevronRight size={16} />
              </button>
            </div>

            <div className="space-y-0">
              {evidenceItems.map((item) => (
                <EvidenceItem key={item.id} {...item} />
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between text-titanium-400 text-sm">
              <span>Showing 1-{evidenceItems.length} of {dashboardData.evidenceCount}</span>
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-obsidian-800/50 border border-titanium-700/30 rounded hover:bg-obsidian-700 transition-colors disabled:opacity-50" disabled>
                  Previous
                </button>
                <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded transition-colors">
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 bg-obsidian-900/50 border border-titanium-800/30 rounded-lg hover:border-blue-500/30 transition-colors group">
            <div className="text-blue-400 mb-2">📊</div>
            <div className="text-titanium-100 font-semibold text-sm">Run Compliance Scan</div>
            <div className="text-titanium-500 text-xs mt-1">Analyze your infrastructure</div>
          </button>

          <button className="p-4 bg-obsidian-900/50 border border-titanium-800/30 rounded-lg hover:border-blue-500/30 transition-colors group">
            <div className="text-blue-400 mb-2">📋</div>
            <div className="text-titanium-100 font-semibold text-sm">Generate Report</div>
            <div className="text-titanium-500 text-xs mt-1">Export compliance documentation</div>
          </button>

          <button className="p-4 bg-obsidian-900/50 border border-titanium-800/30 rounded-lg hover:border-blue-500/30 transition-colors group">
            <div className="text-blue-400 mb-2">⚙️</div>
            <div className="text-titanium-100 font-semibold text-sm">Settings</div>
            <div className="text-titanium-500 text-xs mt-1">Manage your workspace</div>
          </button>
        </div>
      </main>
    </div>
  );
}
