import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Loader2, AlertTriangle, FileText, Trash2, Edit2,
  ExternalLink, Database, Users, Lock,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';

interface DataProcessing {
  id: string;
  name: string;
  purpose: string;
  data_categories: string[];
  recipients: string[];
  retention_period: string;
  legal_basis: 'consent' | 'contract' | 'legal_obligation' | 'vital_interests' | 'public_task' | 'legitimate_interests';
  international_transfer: boolean;
  created_at: string;
}

function _DsgvoDirectoryView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const DsgvoDirectoryView = withPerformanceMonitoring(
  _DsgvoDirectoryView,
  'DsgvoDirectoryView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [processings, setProcessings] = useState<DataProcessing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    if (!activeTenantId) return;
    setError(null);
    setProcessings(null);

    try {
      const response = await fetch(
        `/functions/v1/governance-resources?tenant_id=${activeTenantId}&resource_type=data_processing`,
        { headers: { Authorization: `Bearer ${(await import('../../lib/auth')).getAuthToken()}` } }
      );
      if (!response.ok) throw new Error('Failed to load');
      const data = await response.json();
      setProcessings(data.processings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
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
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">DSGVO-Verzeichnis</div>
              <div className="text-[11px] text-titanium-400 font-medium">Art. 5 · Verarbeitungsverzeichnis</div>
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-violet-400 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4" /> Verarbeitung
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!activeTenantId ? (
          <div className="text-titanium-500 text-sm">Tenant wählen.</div>
        ) : processings === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Laden…
          </div>
        ) : processings.length === 0 ? (
          <EmptyState onAdd={() => setCreating(true)} />
        ) : (
          <div className="space-y-4">
            {processings.map((proc) => (
              <ProcessingCard key={proc.id} processing={proc} onReload={reload} />
            ))}
          </div>
        )}
      </main>

      {creating && activeTenantId && (
        <CreateProcessingModal
          tenantId={activeTenantId}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); void reload(); }}
        />
      )}
    </div>
  );
}

function ProcessingCard({ processing, onReload }: { processing: DataProcessing; onReload: () => void }) {
  const legalBasisLabel = {
    consent: 'Einwilligung',
    contract: 'Vertrag',
    legal_obligation: 'Rechtliche Verpflichtung',
    vital_interests: 'Lebenswichtige Interessen',
    public_task: 'Öffentliche Aufgabe',
    legitimate_interests: 'Berechtigte Interessen',
  }[processing.legal_basis];

  return (
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4 hover:border-violet-500/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-titanium-50">{processing.name}</h3>
          <p className="text-[12px] text-titanium-400 mt-1">{processing.purpose}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => alert('Link to edit')}
            className="p-1.5 text-titanium-400 hover:text-violet-400 hover:bg-obsidian-800 rounded-none transition-colors"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              if (confirm('Löschen?')) void onReload();
            }}
            className="p-1.5 text-titanium-400 hover:text-red-400 hover:bg-obsidian-800 rounded-none transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
        <div className="bg-obsidian-950 border border-titanium-900 rounded-none p-2">
          <div className="text-titanium-400 flex items-center gap-1 mb-1">
            <Database className="h-3 w-3" /> Daten-Kategorien
          </div>
          <div className="text-titanium-200 font-mono text-[11px] line-clamp-2">
            {processing.data_categories.slice(0, 2).join(', ')}
          </div>
        </div>
        <div className="bg-obsidian-950 border border-titanium-900 rounded-none p-2">
          <div className="text-titanium-400 flex items-center gap-1 mb-1">
            <Users className="h-3 w-3" /> Empfänger
          </div>
          <div className="text-titanium-200 font-mono text-[11px] line-clamp-2">
            {processing.recipients.slice(0, 2).join(', ')}
          </div>
        </div>
        <div className="bg-obsidian-950 border border-titanium-900 rounded-none p-2">
          <div className="text-titanium-400 flex items-center gap-1 mb-1">
            <Lock className="h-3 w-3" /> Rechtliche Grundlage
          </div>
          <div className="text-titanium-200 text-[11px]">{legalBasisLabel}</div>
        </div>
        <div className="bg-obsidian-950 border border-titanium-900 rounded-none p-2">
          <div className="text-titanium-400 text-[11px] mb-1">Speicherfrist</div>
          <div className="text-titanium-200 text-[11px]">{processing.retention_period}</div>
        </div>
      </div>

      {processing.international_transfer && (
        <div className="text-[11px] text-amber-400 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> Internationale Datenübermittlung
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        <Link
          to={`/app/dsgvo-directory/${processing.id}`}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 border border-titanium-700 hover:border-violet-500 text-titanium-200 hover:text-violet-300 text-xs font-medium rounded-none transition-colors"
        >
          <ExternalLink className="h-3 w-3" /> Details & DPIA
        </Link>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-20 max-w-2xl mx-auto">
      <div className="w-16 h-16 mx-auto rounded-none bg-obsidian-900 border border-titanium-900 flex items-center justify-center mb-6">
        <FileText className="h-7 w-7 text-titanium-500" />
      </div>
      <h2 className="font-display text-2xl font-bold text-titanium-50 mb-3">
        Verzeichnis leer
      </h2>
      <p className="text-titanium-300 leading-relaxed mb-8">
        Dokumentieren Sie alle Datenverarbeitungen nach Art. 5 DSGVO.
        Verknüpfen Sie mit DPIAs und Risikoanalysen.
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-6 py-3 bg-violet-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-violet-400 transition-colors"
      >
        <Plus className="h-4 w-4" /> Verarbeitung hinzufügen
      </button>
    </div>
  );
}

function CreateProcessingModal({
  tenantId,
  onClose,
  onCreated,
}: {
  tenantId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/functions/v1/governance-resources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await import('../../lib/auth')).getAuthToken()}`,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          action: 'create_data_processing',
          data: { name, purpose },
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
        <h2 className="font-display font-bold text-titanium-50">Verarbeitung erfassen</h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Name (z.B. Website-Analytics)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full bg-obsidian-950 border border-titanium-900 text-titanium-200 text-sm rounded-none px-3 py-2 outline-none placeholder:text-titanium-600"
          />
          <textarea
            placeholder="Zweck der Datenverarbeitung"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            required
            className="w-full bg-obsidian-950 border border-titanium-900 text-titanium-200 text-sm rounded-none px-3 py-2 outline-none placeholder:text-titanium-600 min-h-20"
          />

          <p className="text-[11px] text-titanium-500">
            Nach Erstellung können Sie Daten-Kategorien, Empfänger, Speicherfristen und DPIA-Links hinzufügen.
          </p>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-violet-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-violet-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
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
