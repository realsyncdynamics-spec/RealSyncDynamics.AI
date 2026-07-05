import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Brain, Loader2, AlertTriangle, CheckCircle2, Bot,
  Filter,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';

interface Iso42001Control {
  id: string;
  control_code: string;
  control_name: string;
  ai_system_id?: string;
  ai_system_name?: string;
  status: 'not_started' | 'planned' | 'in_progress' | 'implemented' | 'optimized';
  maturity_level: number;
  last_review_date: string | null;
}

export function Iso42001View() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [controls, setControls] = useState<Iso42001Control[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const reload = async () => {
    if (!activeTenantId) return;
    setError(null);
    setControls(null);

    try {
      const response = await fetch(
        `/functions/v1/governance-resources?tenant_id=${activeTenantId}&resource_type=iso42001`,
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
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-sm">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">ISO 42001</div>
              <div className="text-[11px] text-titanium-400 font-medium">AI Management System</div>
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
            {/* Explanation */}
            <div className="bg-obsidian-900 border border-green-900/30 rounded-none p-4">
              <h3 className="font-semibold text-titanium-50 mb-2 flex items-center gap-2">
                <Brain className="h-4 w-4" /> ISO/IEC 42001:2024
              </h3>
              <p className="text-[12px] text-titanium-300">
                Der internationale Standard für AI Management Systems. Definiert Anforderungen für die Etablierung,
                Implementierung, Aufrechterhaltung und Verbesserung eines AMS in Organisationen.
              </p>
            </div>

            {/* Compliance Score */}
            <div className="bg-gradient-to-r from-green-900 to-emerald-900 border border-green-800 rounded-none p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white mb-1">ISO 42001 Compliance Score</h3>
                  <p className="text-[12px] text-green-200">{implemented} von {total} Kontrollen implementiert</p>
                </div>
                <div className="text-right">
                  <div className="text-5xl font-bold text-white">{compliance}%</div>
                  <div className="text-[11px] text-green-200 mt-1">Maturity</div>
                </div>
              </div>
              <div className="mt-4 h-2 bg-green-950 rounded-none overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-green-400" style={{ width: `${compliance}%` }} />
              </div>
            </div>

            {/* Filter */}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

function ControlCard({ control }: { control: Iso42001Control }) {
  const statusColors = {
    not_started: 'border-titanium-900 bg-obsidian-900',
    planned: 'border-yellow-900 bg-yellow-950',
    in_progress: 'border-blue-900 bg-blue-950',
    implemented: 'border-green-900 bg-green-950',
    optimized: 'border-emerald-900 bg-emerald-950',
  }[control.status];

  const statusText = {
    not_started: 'text-titanium-300',
    planned: 'text-yellow-300',
    in_progress: 'text-blue-300',
    implemented: 'text-green-300',
    optimized: 'text-emerald-300',
  }[control.status];

  return (
    <div className={`border rounded-none p-4 ${statusColors}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-semibold text-titanium-50 text-sm">{control.control_code}</h4>
          <p className="text-[11px] text-titanium-400 mt-1">{control.control_name}</p>
        </div>
        {control.status === 'implemented' || control.status === 'optimized' ? (
          <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
        ) : (
          <Bot className="h-5 w-5 text-titanium-400 shrink-0" />
        )}
      </div>

      {control.ai_system_name && (
        <div className="text-[11px] text-titanium-400 mb-2 p-1.5 bg-obsidian-900 rounded-none border border-titanium-900">
          <div className="font-semibold text-titanium-300">Bezug: {control.ai_system_name}</div>
        </div>
      )}

      <div className="space-y-2 mb-3 pt-2 border-t border-white/10">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-titanium-400">Status</span>
          <span className={`text-[11px] font-semibold capitalize ${statusText}`}>
            {control.status.replace('_', ' ')}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-titanium-400">Maturity</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((level) => (
              <div
                key={level}
                className={`w-1.5 h-1.5 rounded-full ${
                  level <= control.maturity_level ? 'bg-green-400' : 'bg-titanium-800'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <Link
        to={`/app/iso42001/${control.id}`}
        className="inline-flex items-center text-[11px] font-semibold text-blue-400 hover:text-blue-300 hover:underline"
      >
        Implementierung Details →
      </Link>
    </div>
  );
}
