import { useMemo, useState } from 'react';
import { FileText, ShieldAlert, Filter } from 'lucide-react';
import type {
  RuntimeVvtEntry,
  VvtAiActRelevance,
  VvtProcessingType,
  VvtRiskLevel,
} from './types';
import { RuntimeVvtEntryCard } from './RuntimeVvtEntryCard';
import { RuntimeVvtExportButton } from './RuntimeVvtExportButton';
import { DEMO_VVT_ENTRIES } from './demoRuntimeVvtData';

interface Props {
  /** Echte Einträge — wenn leer/undefined, werden Demo-Daten gezeigt. */
  entries?: RuntimeVvtEntry[];
}

type ReviewFilter      = 'all' | 'review_required';
type AiFilter          = 'all' | VvtAiActRelevance;
type RiskFilter        = 'all' | VvtRiskLevel;
type ProcessingFilter  = 'all' | VvtProcessingType;

const PROCESSING_OPTIONS: Array<{ value: ProcessingFilter; label: string }> = [
  { value: 'all',                label: 'Alle Verarbeitungen' },
  { value: 'website_tracking',   label: 'Website-Tracking' },
  { value: 'contact_form',       label: 'Kontaktformular' },
  { value: 'newsletter_form',    label: 'Newsletter-Formular' },
  { value: 'ai_endpoint',        label: 'AI-Endpunkt' },
  { value: 'third_party_script', label: 'Drittanbieter-Skript' },
  { value: 'analytics',          label: 'Analytics' },
  { value: 'payment',            label: 'Zahlung' },
  { value: 'embedded_media',     label: 'Eingebettete Medien' },
  { value: 'unknown',            label: 'Unbekannt' },
];

const AI_OPTIONS: Array<{ value: AiFilter; label: string }> = [
  { value: 'all',                       label: 'Alle KI-Relevanzen' },
  { value: 'none',                      label: 'Keine' },
  { value: 'possible',                  label: 'Möglich' },
  { value: 'likely',                    label: 'Wahrscheinlich' },
  { value: 'high_risk_review_required', label: 'Hochrisiko — Review' },
];

const RISK_OPTIONS: Array<{ value: RiskFilter; label: string }> = [
  { value: 'all',      label: 'Alle Risiken' },
  { value: 'low',      label: 'Niedrig' },
  { value: 'medium',   label: 'Mittel' },
  { value: 'high',     label: 'Hoch' },
  { value: 'critical', label: 'Kritisch' },
];

function HumanReviewBanner() {
  return (
    <div className="flex items-start gap-3 border border-amber-400/40 bg-amber-400/5 px-4 py-3 text-amber-100">
      <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400" />
      <div className="text-sm leading-relaxed">
        <p className="font-semibold text-amber-50">
          Technisch generierter VVT-Entwurf — Human Review erforderlich
        </p>
        <p className="mt-1 text-amber-200/90">
          Diese Einträge werden aus Runtime-Ereignissen abgeleitet. Sie ersetzen
          <strong> keine rechtliche Prüfung</strong>, keine DSB-Freigabe und keine
          finale Art.-30-Dokumentation. Felder mit „-Hinweis" sind Vorschläge zur
          weiteren Bewertung, keine Bestätigung der Rechtsgrundlage.
        </p>
      </div>
    </div>
  );
}

export function RuntimeVvtView({ entries }: Props) {
  const sourceEntries = entries && entries.length > 0 ? entries : DEMO_VVT_ENTRIES;
  const isDemo = !(entries && entries.length > 0);

  const [reviewFilter,     setReviewFilter]     = useState<ReviewFilter>('all');
  const [aiFilter,         setAiFilter]         = useState<AiFilter>('all');
  const [riskFilter,       setRiskFilter]       = useState<RiskFilter>('all');
  const [processingFilter, setProcessingFilter] = useState<ProcessingFilter>('all');

  const filtered = useMemo(() => {
    return sourceEntries.filter((entry) => {
      if (reviewFilter === 'review_required' && entry.review_status !== 'review_required') return false;
      if (aiFilter         !== 'all' && entry.ai_act_relevance !== aiFilter)               return false;
      if (riskFilter       !== 'all' && entry.risk_level        !== riskFilter)             return false;
      if (processingFilter !== 'all' && entry.processing_type   !== processingFilter)       return false;
      return true;
    });
  }, [sourceEntries, reviewFilter, aiFilter, riskFilter, processingFilter]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex items-center gap-3">
        <div className="border border-titanium-800 bg-obsidian-950 p-2">
          <FileText className="h-5 w-5 text-security-400" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-titanium-50">
            Runtime-VVT
          </h1>
          <p className="text-sm text-titanium-400">
            Aus Runtime-Ereignissen abgeleitet · Web &amp; AI · keine rechtliche Bewertung
          </p>
        </div>
      </header>

      <div className="mb-6">
        <HumanReviewBanner />
      </div>

      {isDemo ? (
        <div className="mb-4 border border-security-500/40 bg-security-500/5 px-4 py-2 font-mono text-[11px] uppercase tracking-wide text-security-200">
          Demo-Daten · keine Live-Verarbeitung
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-end gap-3 border border-titanium-800 bg-obsidian-950 p-3">
        <div className="flex items-center gap-2 text-titanium-300">
          <Filter className="h-4 w-4" />
          <span className="font-mono text-[11px] uppercase tracking-wide">Filter</span>
        </div>

        <label className="flex items-center gap-2 text-xs text-titanium-300">
          <input
            type="checkbox"
            checked={reviewFilter === 'review_required'}
            onChange={(event) =>
              setReviewFilter(event.target.checked ? 'review_required' : 'all')
            }
          />
          Nur „Review erforderlich"
        </label>

        <label className="flex flex-col text-[11px] uppercase tracking-wide text-titanium-500">
          KI-Relevanz
          <select
            value={aiFilter}
            onChange={(event) => setAiFilter(event.target.value as AiFilter)}
            className="mt-1 border border-titanium-700 bg-obsidian-950 px-2 py-1 font-mono text-xs normal-case tracking-normal text-titanium-100"
          >
            {AI_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-[11px] uppercase tracking-wide text-titanium-500">
          Risiko
          <select
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value as RiskFilter)}
            className="mt-1 border border-titanium-700 bg-obsidian-950 px-2 py-1 font-mono text-xs normal-case tracking-normal text-titanium-100"
          >
            {RISK_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-[11px] uppercase tracking-wide text-titanium-500">
          Verarbeitungsart
          <select
            value={processingFilter}
            onChange={(event) => setProcessingFilter(event.target.value as ProcessingFilter)}
            className="mt-1 border border-titanium-700 bg-obsidian-950 px-2 py-1 font-mono text-xs normal-case tracking-normal text-titanium-100"
          >
            {PROCESSING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <div className="ml-auto">
          <RuntimeVvtExportButton entries={filtered} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-titanium-800 bg-obsidian-950 px-6 py-12 text-center">
          <p className="text-sm text-titanium-300">
            Keine VVT-Einträge mit diesen Filtern. Sobald Runtime-Ereignisse
            (Tracker vor Einwilligung, Formularerkennung, AI-Endpunkte …)
            eintreffen, erscheinen sie hier als Entwurf zur Prüfung.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((entry) => (
            <li key={entry.id}>
              <RuntimeVvtEntryCard entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
