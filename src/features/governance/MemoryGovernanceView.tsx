import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, Loader2, Brain, Lock, ShieldAlert,
  Clock, Trash2, RefreshCw,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';

/**
 * RFC-003 Memory Governance — Sichtbarkeit für den Decay-Zustand.
 *
 * Backend: `governance-memory` Edge Function (action='query'), Tenant-Isolation
 * über RLS. Der stündliche `memory-decay-worker` verschiebt die Zustände;
 * diese Ansicht macht sie nachvollziehbar — inklusive Holds, die einen Purge
 * blockieren (DSGVO Art. 5 / EU AI Act Art. 12 Nachweispflicht).
 */

type MemoryClassification = 'fact' | 'inference' | 'correlation' | 'risk_signal';
type MemoryState = 'active' | 'cooling' | 'archived' | 'expired' | 'purged';

interface MemoryItem {
  id: string;
  classification: MemoryClassification;
  state: MemoryState;
  key: string;
  confidence: number;
  relevance: number;
  created_at: string;
  automated_purge_date: string | null;
  regulatory_hold: boolean;
  incident_hold: boolean;
  subject_ref: string | null;
  effective_freshness: number;
}

const STATE_LABEL: Record<MemoryState, string> = {
  active: 'Aktiv',
  cooling: 'Kühlt ab',
  archived: 'Archiviert',
  expired: 'Abgelaufen',
  purged: 'Getilgt',
};

const STATE_STYLE: Record<MemoryState, string> = {
  active: 'bg-green-950 text-green-300 border-green-900',
  cooling: 'bg-amber-950 text-amber-300 border-amber-900',
  archived: 'bg-blue-950 text-blue-300 border-blue-900',
  expired: 'bg-orange-950 text-orange-300 border-orange-900',
  purged: 'bg-titanium-900 text-titanium-400 border-titanium-800',
};

const CLASSIFICATION_LABEL: Record<MemoryClassification, string> = {
  fact: 'Fakt',
  inference: 'Ableitung',
  correlation: 'Korrelation',
  risk_signal: 'Risikosignal',
};

function _MemoryGovernanceView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const MemoryGovernanceView = withPerformanceMonitoring(
  _MemoryGovernanceView,
  'MemoryGovernanceView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [items, setItems] = useState<MemoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<MemoryState | 'all'>('all');
  const [classFilter, setClassFilter] = useState<MemoryClassification | 'all'>('all');
  const [reloading, setReloading] = useState(false);

  const reload = async () => {
    if (!activeTenantId) return;
    setError(null);
    setReloading(true);

    try {
      const token = await (await import('../../lib/auth')).getAuthToken();
      const response = await fetch('/functions/v1/governance-memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'query',
          ...(stateFilter !== 'all' ? { state: stateFilter } : {}),
          ...(classFilter !== 'all' ? { classification: classFilter } : {}),
          limit: 200,
        }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.error?.message ?? 'Memory konnte nicht geladen werden');
      }
      const data = await response.json();
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
      setItems([]);
    } finally {
      setReloading(false);
    }
  };

  useEffect(() => { void reload(); }, [activeTenantId, stateFilter, classFilter]);

  // Zählung immer über den ungefilterten Blick auf die geladene Menge — bei
  // aktivem Filter zeigt die Leiste den Ausschnitt, nicht den Gesamtbestand.
  const counts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const i of items ?? []) acc[i.state] = (acc[i.state] ?? 0) + 1;
    return acc;
  }, [items]);

  const heldCount = useMemo(
    () => (items ?? []).filter((i) => i.regulatory_hold || i.incident_hold).length,
    [items],
  );

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-sm">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Memory Governance</div>
              <div className="text-[11px] text-titanium-400 font-medium">RFC-003 · Temporaler Verfall &amp; Aufbewahrung</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void reload()}
            disabled={reloading || !activeTenantId}
            className="p-1.5 rounded-none border border-titanium-900 text-titanium-400 hover:text-titanium-200 hover:bg-obsidian-800 disabled:opacity-40"
            title="Neu laden"
          >
            <RefreshCw className={`h-4 w-4 ${reloading ? 'animate-spin' : ''}`} />
          </button>
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
        ) : items === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Laden…
          </div>
        ) : (
          <div className="space-y-6">
            {/* Zustandsverteilung */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {(Object.keys(STATE_LABEL) as MemoryState[]).map((s) => (
                <div key={s} className="bg-obsidian-900 border border-titanium-900 rounded-none p-3">
                  <div className="text-[11px] text-titanium-400 font-medium">{STATE_LABEL[s]}</div>
                  <div className="text-xl font-mono font-bold text-titanium-50">{counts[s] ?? 0}</div>
                </div>
              ))}
            </div>

            {heldCount > 0 && (
              <div className="flex items-start gap-2.5 text-sm text-amber-200 bg-amber-950/40 border border-amber-900 rounded-none p-3">
                <Lock className="h-5 w-5 shrink-0 mt-0.5" />
                <span>
                  <strong className="font-semibold">{heldCount}</strong>{' '}
                  {heldCount === 1 ? 'Eintrag ist' : 'Einträge sind'} durch einen Hold gesperrt —
                  Verfall und Tilgung sind dort ausgesetzt, bis der Hold aufgehoben wird.
                </span>
              </div>
            )}

            {/* Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value as MemoryState | 'all')}
                className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800"
              >
                <option value="all">Alle Zustände (außer getilgt)</option>
                {(Object.keys(STATE_LABEL) as MemoryState[]).map((s) => (
                  <option key={s} value={s}>{STATE_LABEL[s]}</option>
                ))}
              </select>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value as MemoryClassification | 'all')}
                className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800"
              >
                <option value="all">Alle Klassifikationen</option>
                {(Object.keys(CLASSIFICATION_LABEL) as MemoryClassification[]).map((c) => (
                  <option key={c} value={c}>{CLASSIFICATION_LABEL[c]}</option>
                ))}
              </select>
              <span className="text-[11px] text-titanium-500 font-mono">{items.length} Einträge</span>
            </div>

            {items.length === 0 ? (
              <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-8 text-center">
                <Brain className="h-8 w-8 text-titanium-700 mx-auto mb-3" />
                <div className="text-sm text-titanium-300 font-medium mb-1">Kein Memory vorhanden</div>
                <div className="text-[12px] text-titanium-500">
                  Sobald Agenten Wissen ablegen, erscheint es hier mit Verfallszustand und Aufbewahrungsfrist.
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => <MemoryRow key={item.id} item={item} />)}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function MemoryRow({ item }: { item: MemoryItem }) {
  const freshnessPct = Math.round(item.effective_freshness * 100);
  const held = item.regulatory_hold || item.incident_hold;

  return (
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="font-mono text-[12px] text-titanium-100 truncate">{item.key}</div>
          <div className="text-[11px] text-titanium-500">
            {CLASSIFICATION_LABEL[item.classification]}
            {item.subject_ref && <> · Betroffenenbezug</>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {held && (
            <span className="inline-flex items-center gap-1 bg-amber-950 text-amber-300 border border-amber-900 text-[10px] font-semibold px-1.5 py-0.5 rounded-none">
              <Lock className="h-3 w-3" />
              {item.regulatory_hold ? 'Regulatorisch' : 'Vorfall'}
            </span>
          )}
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-none border ${STATE_STYLE[item.state]}`}>
            {STATE_LABEL[item.state]}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
        <Metric label="Frische" value={`${freshnessPct}%`} pct={freshnessPct} />
        <Metric label="Konfidenz" value={item.confidence.toFixed(2)} pct={item.confidence * 100} />
        <Metric label="Relevanz" value={item.relevance.toFixed(2)} pct={item.relevance * 100} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[10px] text-titanium-500 font-mono">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          angelegt {new Date(item.created_at).toLocaleDateString('de-DE')}
        </span>
        {item.automated_purge_date && (
          <span className="inline-flex items-center gap-1">
            <Trash2 className="h-3 w-3" />
            Tilgung {new Date(item.automated_purge_date).toLocaleDateString('de-DE')}
          </span>
        )}
        {item.state === 'expired' && !held && (
          <span className="inline-flex items-center gap-1 text-orange-400">
            <ShieldAlert className="h-3 w-3" />
            zur Tilgung vorgesehen
          </span>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-titanium-400">{label}</span>
        <span className="font-mono text-titanium-200">{value}</span>
      </div>
      <div className="bg-obsidian-950 border border-titanium-900 h-1.5 rounded-none overflow-hidden">
        <div
          className="h-full bg-blue-500"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}
