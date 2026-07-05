import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Loader2, AlertTriangle, Bot, Trash2, Edit2, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';

interface AiSystem {
  id: string;
  name: string;
  vendor: string;
  model_name: string;
  purpose: string;
  data_types: string[];
  ai_act_class: 'minimal' | 'limited' | 'high' | 'prohibited' | 'unknown';
  risk_score: number;
  status: 'draft' | 'active' | 'under_review' | 'approved' | 'archived';
  created_at: string;
}

export function AiRegisterView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [systems, setSystems] = useState<AiSystem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    if (!activeTenantId) return;
    setError(null);
    setSystems(null);

    try {
      const response = await fetch(
        `/functions/v1/governance-resources?tenant_id=${activeTenantId}&resource_type=ai_system`,
        { headers: { Authorization: `Bearer ${(await import('../../lib/auth')).getAuthToken()}` } }
      );
      if (!response.ok) throw new Error('Failed to load AI systems');
      const data = await response.json();
      setSystems(data.systems || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    }
  };

  useEffect(() => { void reload(); }, [activeTenantId]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">KI-Register</div>
              <div className="text-[11px] text-titanium-400 font-medium">Erfassungs- & Klassifizierungsübersicht</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tenants.length > 1 && (
            <select
              value={activeTenantId ?? ''}
              onChange={(e) => setActiveTenant(e.target.value)}
              className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800 max-w-[200px]"
            >
              {tenants.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>{t.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setCreating(true)}
            disabled={!activeTenantId}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-cyan-400 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4" /> KI-System
          </button>
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
          <div className="text-titanium-500 text-sm">Tenant wählen zum Starten.</div>
        ) : systems === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Laden…
          </div>
        ) : systems.length === 0 ? (
          <EmptyState onAdd={() => setCreating(true)} />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {systems.map((sys) => (
                <SystemCard key={sys.id} system={sys} onReload={reload} />
              ))}
            </div>
          </div>
        )}
      </main>

      {creating && activeTenantId && (
        <CreateSystemModal
          tenantId={activeTenantId}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); void reload(); }}
        />
      )}
    </div>
  );
}

function SystemCard({ system, onReload }: { system: AiSystem; onReload: () => void }) {
  const riskColor = {
    minimal: 'text-green-400',
    limited: 'text-yellow-400',
    high: 'text-orange-400',
    prohibited: 'text-red-400',
    unknown: 'text-titanium-400',
  }[system.ai_act_class];

  const statusIcon = system.status === 'approved' ? (
    <CheckCircle2 className="h-4 w-4 text-green-400" />
  ) : system.status === 'under_review' ? (
    <AlertCircle className="h-4 w-4 text-amber-400" />
  ) : (
    <AlertCircle className="h-4 w-4 text-titanium-400" />
  );

  return (
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4 hover:border-cyan-500/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-titanium-50 text-sm mb-1">{system.name}</h3>
          <p className="text-[12px] text-titanium-400 font-mono">{system.vendor} · {system.model_name}</p>
        </div>
        <div className="flex items-center gap-1">
          {statusIcon}
        </div>
      </div>

      <p className="text-[12px] text-titanium-300 mb-3 line-clamp-2">{system.purpose}</p>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-titanium-400">AI-Act:</span>
          <span className={`text-[11px] font-semibold ${riskColor}`}>
            {system.ai_act_class === 'minimal' && '✓ Minimal Risk'}
            {system.ai_act_class === 'limited' && '⚠ Limited Risk'}
            {system.ai_act_class === 'high' && '⚠ High Risk'}
            {system.ai_act_class === 'prohibited' && '✗ Prohibited'}
            {system.ai_act_class === 'unknown' && '? Unknown'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-titanium-400">Risk Score:</span>
          <div className="flex-1 bg-obsidian-950 h-2 rounded-none overflow-hidden">
            <div
              className={`h-full ${
                system.risk_score < 30 ? 'bg-green-500' : system.risk_score < 70 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${system.risk_score}%` }}
            />
          </div>
          <span className="text-[11px] text-titanium-300 font-mono w-8">{system.risk_score}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to={`/app/ai-register/${system.id}`}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 border border-titanium-700 hover:border-cyan-500 text-titanium-200 hover:text-cyan-300 text-xs font-medium rounded-none transition-colors"
        >
          <Edit2 className="h-3 w-3" /> Details
        </Link>
        <button
          onClick={() => {
            // Delete handler
            if (confirm('System löschen?')) {
              void onReload();
            }
          }}
          className="p-1.5 border border-titanium-900 hover:border-red-500 text-titanium-400 hover:text-red-400 rounded-none transition-colors"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-20 max-w-2xl mx-auto">
      <div className="w-16 h-16 mx-auto rounded-none bg-obsidian-900 border border-titanium-900 flex items-center justify-center mb-6">
        <Bot className="h-7 w-7 text-titanium-500" />
      </div>
      <h2 className="font-display text-2xl font-bold text-titanium-50 mb-3">
        KI-Register leer
      </h2>
      <p className="text-titanium-300 leading-relaxed mb-8">
        Erfassen Sie alle KI-Systeme, die Ihr Unternehmen nutzt.
        Automatische AI-Act-Klassifizierung & Risk-Scoring.
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-cyan-400 transition-colors"
      >
        <Plus className="h-4 w-4" /> Erste KI erfassen
      </button>
    </div>
  );
}

function CreateSystemModal({
  tenantId,
  onClose,
  onCreated,
}: {
  tenantId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [vendor, setVendor] = useState('');
  const [modelName, setModelName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Call governance-resources to create AI system
      const response = await fetch('/functions/v1/governance-resources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await import('../../lib/auth')).getAuthToken()}`,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          action: 'create_ai_system',
          data: { name, vendor, model_name: modelName, purpose },
        }),
      });

      if (!response.ok) throw new Error('Creation failed');
      onCreated();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-6 max-w-md w-full mx-4 space-y-4">
        <h2 className="font-display font-bold text-titanium-50">KI-System erfassen</h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Name (z.B. ChatGPT Integration)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full bg-obsidian-950 border border-titanium-900 text-titanium-200 text-sm rounded-none px-3 py-2 outline-none placeholder:text-titanium-600"
          />
          <input
            type="text"
            placeholder="Vendor (z.B. OpenAI)"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            className="w-full bg-obsidian-950 border border-titanium-900 text-titanium-200 text-sm rounded-none px-3 py-2 outline-none placeholder:text-titanium-600"
          />
          <input
            type="text"
            placeholder="Modell (z.B. gpt-4)"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            className="w-full bg-obsidian-950 border border-titanium-900 text-titanium-200 text-sm rounded-none px-3 py-2 outline-none placeholder:text-titanium-600"
          />
          <textarea
            placeholder="Zweck der Nutzung"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            required
            className="w-full bg-obsidian-950 border border-titanium-900 text-titanium-200 text-sm rounded-none px-3 py-2 outline-none placeholder:text-titanium-600 min-h-20"
          />

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-cyan-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-cyan-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Erfassen
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-titanium-700 text-titanium-200 text-sm font-semibold rounded-none hover:border-titanium-500 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
