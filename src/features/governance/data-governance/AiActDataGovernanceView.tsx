/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AI-Act Daten-Governance (Art. 10) — /app/datasets
 * Listet Trainings-/Validierungs-/Testdatensätze pro KI-System mit
 * Art-10-Vollständigkeits-Anzeige. Ohne Tenant: Demo-Daten.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Database, Plus, X, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from '../withPerformanceMonitoring';
import {
  listDatasets,
  createDataset,
  assessArt10Completeness,
  DATASET_ROLE_LABEL,
  ART10_FACET_LABEL,
  type Dataset,
  type DatasetRole,
  type CreateDatasetInput,
} from '../aiActDataGovernanceApi';

// ── Demo-Daten (ohne Tenant) ──────────────────────────────────────────────────

const DEMO_DATASETS: Dataset[] = [
  {
    id: 'demo-1',
    tenant_id: 'demo',
    ai_system_ref: 'CV-Screening HR-Tool',
    name: 'Bewerbungs-Trainingskorpus 2024',
    dataset_role: 'training',
    source_description: 'Historische Bewerbungen, anonymisiert aus dem ATS exportiert',
    origin_jurisdictions: ['DE', 'AT'],
    contains_personal_data: true,
    special_categories: false,
    legal_basis: null,
    data_steward: 'Team People',
    preprocessing_notes: 'PII-Maskierung, Lebenslauf-Felder strukturiert',
    bias_assessment: null,
    representativeness_note: 'Überrepräsentation technischer Rollen bekannt',
    known_gaps: 'Wenige Senior-Profile',
    collected_from: '2024-01-01',
    collected_to: '2024-12-31',
    evidence_id: null,
    metadata: {},
    created_by: null,
    created_at: '2026-06-10T09:00:00Z',
    updated_at: '2026-06-10T09:00:00Z',
  },
  {
    id: 'demo-2',
    tenant_id: 'demo',
    ai_system_ref: 'Produktempfehlung Shop',
    name: 'Klickstrom-Validierungsset',
    dataset_role: 'validation',
    source_description: 'Aggregierte Session-Events, EU-Region',
    origin_jurisdictions: ['DE'],
    contains_personal_data: false,
    special_categories: false,
    legal_basis: null,
    data_steward: 'Team Commerce',
    preprocessing_notes: 'Sessionisiert, Bots gefiltert',
    bias_assessment: 'Saisonale Verzerrung dokumentiert',
    representativeness_note: 'Repräsentativ für Bestandskunden',
    known_gaps: null,
    collected_from: '2025-09-01',
    collected_to: '2025-11-30',
    evidence_id: null,
    metadata: {},
    created_by: null,
    created_at: '2026-06-12T09:00:00Z',
    updated_at: '2026-06-12T09:00:00Z',
  },
];

// ── Haupt-View ────────────────────────────────────────────────────────────────

function Inner() {
  const { activeTenantId } = useTenant();
  const [datasets, setDatasets] = useState<Dataset[]>(DEMO_DATASETS);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTenantId) {
      setDatasets(DEMO_DATASETS);
      return;
    }
    let cancelled = false;
    listDatasets(activeTenantId)
      .then((rows) => { if (!cancelled && rows.length > 0) setDatasets(rows); })
      .catch(() => {/* Demo-Fallback bleibt */});
    return () => { cancelled = true; };
  }, [activeTenantId]);

  const metrics = useMemo(() => {
    const total = datasets.length;
    const withPii = datasets.filter((d) => d.contains_personal_data).length;
    const complete = datasets.filter((d) => assessArt10Completeness(d).complete).length;
    return { total, withPii, complete };
  }, [datasets]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleCreate(input: CreateDatasetInput) {
    if (!activeTenantId) {
      // Demo-Modus: optimistisch lokal anhängen.
      setDatasets((prev) => [{
        ...DEMO_DATASETS[0],
        ...input,
        id: `local-${Date.now()}`,
        origin_jurisdictions: input.origin_jurisdictions ?? [],
        contains_personal_data: input.contains_personal_data ?? false,
        special_categories: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Dataset, ...prev]);
      setShowModal(false);
      showToast('Datensatz gespeichert (Demo)');
      return;
    }
    try {
      const row = await createDataset({ ...input, tenant_id: activeTenantId });
      setDatasets((prev) => [row, ...prev]);
      setShowModal(false);
      showToast('Datensatz gespeichert');
    } catch {
      showToast('Speichern fehlgeschlagen');
    }
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="flex h-14 items-center justify-between border-b border-titanium-900 bg-obsidian-900 px-4">
        <div className="flex items-center gap-3">
          <Link to="/app" className="p-1.5 text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-teal-600 to-teal-800">
              <Database className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <h1 className="font-display text-sm font-semibold tracking-tight text-titanium-50">
                Daten-Governance
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                EU AI Act · Art. 10 · Trainings-, Validierungs- &amp; Testdaten
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 border border-teal-700 bg-teal-900/30 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-teal-300 hover:bg-teal-900/60 hover:text-teal-100"
        >
          <Plus className="h-3.5 w-3.5" />
          Datensatz hinzufügen
        </button>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
        {/* Metriken */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard label="Datensätze dokumentiert" value={metrics.total.toString()} />
          <MetricCard label="Mit Personenbezug" value={metrics.withPii.toString()} tone="amber" />
          <MetricCard label="Art-10-vollständig" value={`${metrics.complete}/${metrics.total}`} tone="teal" />
        </div>

        {/* Datensatz-Karten */}
        <div className="space-y-3">
          {datasets.map((d) => (
            <DatasetCard key={d.id} dataset={d} />
          ))}
          {datasets.length === 0 && (
            <div className="border border-titanium-800 bg-obsidian-900 p-10 text-center">
              <p className="text-sm text-titanium-400">Noch keine Datensätze dokumentiert.</p>
            </div>
          )}
        </div>

        {/* Art-10-Info */}
        <section className="border border-titanium-900 bg-obsidian-900 p-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
            EU AI Act · Art. 10 · Pflicht-Facetten
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.values(ART10_FACET_LABEL).map((label) => (
              <span key={label} className="border border-titanium-800 bg-obsidian-950 px-2 py-0.5 font-mono text-[10px] text-titanium-400">
                {label}
              </span>
            ))}
          </div>
        </section>
      </main>

      {showModal && (
        <AddDatasetModal onClose={() => setShowModal(false)} onSave={handleCreate} />
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 border border-teal-700 bg-obsidian-900 px-4 py-2.5 font-mono text-[11px] text-teal-300 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function _AiActDataGovernanceView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const AiActDataGovernanceView = withPerformanceMonitoring(
  _AiActDataGovernanceView,
  'AiActDataGovernanceView',
  { threshold: 500, maxRenders: 10 }
);

// ── Datensatz-Karte ───────────────────────────────────────────────────────────

function DatasetCard({ dataset }: { dataset: Dataset }) {
  const art10 = assessArt10Completeness(dataset);
  const barCls = art10.score === 100 ? 'bg-teal-500' : art10.score >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="flex border border-titanium-900 bg-obsidian-900 hover:border-titanium-700 transition-colors">
      <div className={`w-[3px] shrink-0 ${barCls}`} />
      <div className="flex-1 min-w-0 p-4">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-display text-sm font-semibold text-titanium-50">{dataset.name}</span>
          <span className="border border-titanium-800 bg-obsidian-950 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-titanium-400">
            {DATASET_ROLE_LABEL[dataset.dataset_role]}
          </span>
          {dataset.contains_personal_data && (
            <span className="border border-amber-800 bg-amber-950/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-400">
              Personenbezug
            </span>
          )}
        </div>

        {dataset.ai_system_ref && (
          <p className="font-mono text-[11px] text-titanium-500 mb-1">
            KI-System: <span className="text-titanium-300">{dataset.ai_system_ref}</span>
          </p>
        )}
        {dataset.source_description && (
          <p className="text-xs text-titanium-400 line-clamp-2 mb-3">{dataset.source_description}</p>
        )}

        <div className="flex flex-wrap gap-4 mb-3">
          {dataset.data_steward && (
            <span className="font-mono text-[10px] text-titanium-500">
              Data Steward: <span className="text-titanium-300">{dataset.data_steward}</span>
            </span>
          )}
          {dataset.origin_jurisdictions.length > 0 && (
            <span className="font-mono text-[10px] text-titanium-500">
              Herkunft: <span className="text-titanium-300">{dataset.origin_jurisdictions.join(', ')}</span>
            </span>
          )}
        </div>

        {/* Art-10-Vollständigkeit */}
        <div className="mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-titanium-500">
            {art10.complete
              ? <ShieldCheck className="h-3 w-3 text-teal-400" />
              : <AlertTriangle className="h-3 w-3 text-amber-400" />}
            Art-10-Vollständigkeit: <span className="text-titanium-300">{art10.score}%</span>
          </span>
          {art10.complete && <span className="font-mono text-[10px] text-teal-400">vollständig</span>}
        </div>
        <div className="h-1.5 w-full bg-titanium-800">
          <div className={`h-1.5 ${barCls}`} style={{ width: `${art10.score}%` }} />
        </div>

        {art10.missing.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {art10.missing.map((f) => (
              <span key={f} className="border border-red-900 bg-red-950/20 px-1.5 py-0.5 font-mono text-[9px] text-red-400">
                fehlt: {ART10_FACET_LABEL[f]}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Hilfs-Komponenten ─────────────────────────────────────────────────────────

function MetricCard({ label, value, tone }: { label: string; value: string; tone?: 'amber' | 'teal' }) {
  const valCls = tone === 'amber' ? 'text-amber-400' : tone === 'teal' ? 'text-teal-400' : 'text-titanium-50';
  return (
    <div className="border border-titanium-800 bg-obsidian-900 p-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold tracking-tight ${valCls}`}>{value}</p>
    </div>
  );
}

// ── Add-Modal ─────────────────────────────────────────────────────────────────

function AddDatasetModal({
  onClose, onSave,
}: {
  onClose: () => void;
  onSave: (input: CreateDatasetInput) => void;
}) {
  const [name, setName] = useState('');
  const [aiSystemRef, setAiSystemRef] = useState('');
  const [role, setRole] = useState<DatasetRole>('training');
  const [source, setSource] = useState('');
  const [jurisdictions, setJurisdictions] = useState('');
  const [steward, setSteward] = useState('');
  const [containsPii, setContainsPii] = useState(false);
  const [legalBasis, setLegalBasis] = useState('');
  const [preprocessing, setPreprocessing] = useState('');
  const [bias, setBias] = useState('');
  const [representativeness, setRepresentativeness] = useState('');

  function handleSave() {
    if (!name.trim()) return;
    onSave({
      tenant_id: '', // wird vom Aufrufer gesetzt
      name: name.trim(),
      ai_system_ref: aiSystemRef.trim() || undefined,
      dataset_role: role,
      source_description: source.trim() || undefined,
      origin_jurisdictions: jurisdictions.split(',').map((s) => s.trim()).filter(Boolean),
      data_steward: steward.trim() || undefined,
      contains_personal_data: containsPii,
      legal_basis: legalBasis.trim() || undefined,
      preprocessing_notes: preprocessing.trim() || undefined,
      bias_assessment: bias.trim() || undefined,
      representativeness_note: representativeness.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto border border-titanium-800 bg-obsidian-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-titanium-900 px-4 py-3">
          <h2 className="font-display text-sm font-bold text-titanium-50">Datensatz dokumentieren (Art. 10)</h2>
          <button type="button" onClick={onClose} className="text-titanium-400 hover:text-titanium-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <Field label="Name *">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Bewerbungs-Trainingskorpus 2024" className={INPUT_CLS} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="KI-System">
              <input value={aiSystemRef} onChange={(e) => setAiSystemRef(e.target.value)} placeholder="System-Name" className={INPUT_CLS} />
            </Field>
            <Field label="Rolle">
              <select value={role} onChange={(e) => setRole(e.target.value as DatasetRole)} className={INPUT_CLS}>
                {(Object.keys(DATASET_ROLE_LABEL) as DatasetRole[]).map((r) => (
                  <option key={r} value={r}>{DATASET_ROLE_LABEL[r]}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Herkunft & Erhebung">
            <textarea value={source} onChange={(e) => setSource(e.target.value)} rows={2} placeholder="Quelle, Erhebungsprozess, Server-Region …" className={INPUT_CLS} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Geografische Herkunft">
              <input value={jurisdictions} onChange={(e) => setJurisdictions(e.target.value)} placeholder="DE, AT, …" className={INPUT_CLS} />
            </Field>
            <Field label="Data Steward">
              <input value={steward} onChange={(e) => setSteward(e.target.value)} placeholder="Verantwortliches Team" className={INPUT_CLS} />
            </Field>
          </div>

          <label className="flex items-center gap-2 font-mono text-[11px] text-titanium-300">
            <input type="checkbox" checked={containsPii} onChange={(e) => setContainsPii(e.target.checked)} />
            Enthält personenbezogene Daten (DSGVO)
          </label>

          {containsPii && (
            <Field label="Rechtsgrundlage (DSGVO)">
              <input value={legalBasis} onChange={(e) => setLegalBasis(e.target.value)} placeholder="z.B. Art. 6 Abs. 1 lit. f DSGVO" className={INPUT_CLS} />
            </Field>
          )}

          <Field label="Vorverarbeitung/Annotation">
            <textarea value={preprocessing} onChange={(e) => setPreprocessing(e.target.value)} rows={2} placeholder="Cleaning, Labelling, Normalisierung …" className={INPUT_CLS} />
          </Field>
          <Field label="Bias-Prüfung">
            <textarea value={bias} onChange={(e) => setBias(e.target.value)} rows={2} placeholder="Untersuchte Verzerrungen und Ergebnis …" className={INPUT_CLS} />
          </Field>
          <Field label="Repräsentativität">
            <textarea value={representativeness} onChange={(e) => setRepresentativeness(e.target.value)} rows={2} placeholder="Eignung/Repräsentativität für den Einsatzzweck …" className={INPUT_CLS} />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-titanium-900 px-4 py-3">
          <button type="button" onClick={onClose} className="px-3 py-1.5 font-mono text-xs text-titanium-400 hover:text-titanium-100">
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim()}
            className="border border-teal-700 bg-teal-900/40 px-4 py-1.5 font-mono text-xs text-teal-200 hover:bg-teal-800/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

const INPUT_CLS = 'w-full resize-y border border-titanium-800 bg-obsidian-950 px-3 py-2 text-sm text-titanium-100 outline-none focus:border-teal-600';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-titanium-400">{label}</span>
      {children}
    </label>
  );
}
