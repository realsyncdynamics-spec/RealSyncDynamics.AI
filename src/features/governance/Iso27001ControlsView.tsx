import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Lock, Loader2, AlertTriangle, CheckCircle2, CircleDot,
  TrendingUp, Filter,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';

interface Iso27001Control {
  id: string;
  control_code: string;
  control_name: string;
  status: 'not_started' | 'planned' | 'in_progress' | 'implemented' | 'optimized';
  maturity_level: number;
  category: string;
  last_review_date: string | null;
  next_review_date: string | null;
}

export function Iso27001ControlsView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [controls, setControls] = useState<Iso27001Control[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const reload = async () => {
    if (!activeTenantId) return;
    setError(null);
    setControls(null);

    try {
      const response = await fetch(
        `/functions/v1/governance-resources?tenant_id=${activeTenantId}&resource_type=iso27001`,
        { headers: { Authorization: `Bearer ${(await import('../../lib/auth')).getAuthToken()}` } }
      );
      if (!response.ok) throw new Error('Failed to load');
      const data = await response.json();
      setControls(data.controls || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
  };

  useEffect(() => { void reload(); }, [activeTenantId]);

  const filtered = controls?.filter(c =>
    filterStatus === 'all' || c.status === filterStatus
  ) || [];

  const implemented = controls?.filter(c => c.status === 'implemented' || c.status === 'optimized').length || 0;
  const total = controls?.length || 0;
  const compliance = total > 0 ? Math.round((implemented / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-sm">
              <Lock className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">ISO 27001</div>
              <div className="text-[11px] text-titanium-400 font-medium">Information Security Management System</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!activeTenantId ? (
          <div className="text-titanium-500 text-sm">Tenant wählen.</div>
        ) : controls === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Laden…
          </div>
        ) : (
          <div className="space-y-6">
            {/* Compliance Score */}
            <div className="bg-gradient-to-r from-indigo-900 to-blue-900 border border-indigo-800 rounded-none p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white mb-1">ISO 27001 Compliance Score</h3>
                  <p className="text-[12px] text-indigo-200">{implemented} von {total} Kontrollen implementiert</p>
                </div>
                <div className="text-right">
                  <div className="text-5xl font-bold text-white">{compliance}%</div>
                  <div className="text-[11px] text-indigo-200 mt-1">Maturity</div>
                </div>
              </div>
              <div className="mt-4 h-2 bg-indigo-950 rounded-none overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-blue-400" style={{ width: `${compliance}%` }} />
              </div>
            </div>

            {/* Filter & Stats */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-[12px]">
                <Filter className="h-4 w-4 text-titanium-400" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-obsidian-900 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium"
                >
                  <option value="all">Alle ({total})</option>
                  <option value="not_started">Nicht gestartet</option>
                  <option value="planned">Geplant</option>
                  <option value="in_progress">In Arbeit</option>
                  <option value="implemented">Implementiert ({implemented})</option>
                  <option value="optimized">Optimiert</option>
                </select>
              </div>
            </div>

            {/* Controls Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((control) => (
                <ControlCard key={control.id} control={control} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ControlCard({ control }: { control: Iso27001Control }) {
  const statusConfig = {
    not_started: { icon: CircleDot, color: 'text-titanium-400', bg: 'bg-obsidian-800' },
    planned: { icon: CircleDot, color: 'text-yellow-400', bg: 'bg-yellow-950' },
    in_progress: { icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-950' },
    implemented: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-950' },
    optimized: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-950' },
  }[control.status];

  const StatusIcon = statusConfig?.icon || CircleDot;

  return (
    <div className={`${statusConfig?.bg} border border-titanium-900 rounded-none p-4`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-semibold text-titanium-50 text-sm">{control.control_code}</h4>
          <p className="text-[11px] text-titanium-400 mt-1">{control.control_name}</p>
        </div>
        <StatusIcon className={`h-5 w-5 ${statusConfig?.color} shrink-0`} />
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-titanium-400">Status</span>
          <span className="text-[11px] font-semibold text-titanium-200 capitalize">
            {control.status.replace('_', ' ')}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-titanium-400">Maturity Level</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((level) => (
              <div
                key={level}
                className={`w-1.5 h-1.5 rounded-full ${
                  level <= control.maturity_level ? 'bg-blue-400' : 'bg-titanium-800'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {control.next_review_date && (
        <div className="text-[11px] text-titanium-400 border-t border-titanium-900 pt-2 mt-2">
          Review fällig: {new Date(control.next_review_date).toLocaleDateString('de-DE')}
        </div>
      )}
    </div>
  );
}
