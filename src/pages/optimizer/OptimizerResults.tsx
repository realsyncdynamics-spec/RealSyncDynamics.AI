/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SEITE 4 — /optimizer/results  (Ergebnis-Übersicht, gated)
 * Typ: FEEDBACK + ACTION. Zeigt Score + Severity-Zählungen, aber KEINE
 * Detail-Findings. Primärer CTA → Bericht freischalten, sekundär → Pakete.
 *
 * CTAs führen in den Phase-2-Flow: Bericht freischalten → /optimizer/auth,
 * Pakete vergleichen → /optimizer/pricing.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert, AlertTriangle, Info, ArrowRight, Lock, ListChecks, CheckCircle2, RotateCw,
} from 'lucide-react';

import { OptimizerLayout } from './OptimizerLayout';
import { ScoreGauge } from './components/ScoreGauge';
import { getScanResult, clearOptimizerState } from '../../lib/optimizer/state';
import { summarizeSeverities, type SeverityBucket } from '../../lib/optimizer/types';

const BUCKET_META: Record<SeverityBucket, { label: string; icon: typeof ShieldAlert; className: string; dot: string }> = {
  kritisch: { label: 'Kritisch', icon: ShieldAlert, className: 'border-red-900 bg-red-950/30', dot: 'text-red-400' },
  wichtig: { label: 'Wichtig', icon: AlertTriangle, className: 'border-brass-600 bg-obsidian-900', dot: 'text-brass-400' },
  info: { label: 'Info', icon: Info, className: 'border-titanium-800 bg-obsidian-900', dot: 'text-titanium-400' },
};

const UNLOCK_BULLETS = [
  'Jeder Befund im Detail — mit betroffener Stelle und Code-Snippet.',
  'Konkrete Fix-Anleitung pro Problem, nach Priorität sortiert.',
  'Herunterladbarer Bericht + optionales Monitoring deiner Domain.',
];

export function OptimizerResults() {
  const navigate = useNavigate();
  const [result] = useState(() => getScanResult());

  const summary = useMemo(() => (result ? summarizeSeverities(result.issues) : []), [result]);
  const totalIssues = result?.issues.length ?? 0;

  // Kein Ergebnis im Storage → zurück zur Eingabe.
  if (!result) {
    return (
      <OptimizerLayout
        step={3}
        pageType="feedback"
        backTo="/optimizer/scan"
        metaTitle="Kein Ergebnis — Cloud Code Optimizer"
        metaDescription="Es liegt kein Scan-Ergebnis vor."
      >
        <div className="text-center py-12">
          <Info className="h-8 w-8 text-titanium-500 mx-auto mb-4" aria-hidden />
          <h1 className="text-2xl font-display font-bold text-titanium-50 mb-2">Kein Ergebnis vorhanden</h1>
          <p className="text-titanium-400 mb-6">Starte zuerst einen Scan deiner Website.</p>
          <button
            type="button"
            onClick={() => navigate('/optimizer/scan')}
            className="inline-flex items-center gap-2 bg-security-500 hover:bg-security-400 text-white font-bold px-5 py-2.5 rounded-none transition-colors"
          >
            Zur URL-Eingabe <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </OptimizerLayout>
    );
  }

  return (
    <OptimizerLayout
      step={3}
      pageType="feedback"
      backTo="/optimizer/scan"
      metaTitle={`Analyse für ${result.domain} — Cloud Code Optimizer`}
      metaDescription="Deine Website-Analyse: Score und Befund-Übersicht."
    >
      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 tracking-tight">
          Deine Website-Analyse
        </h1>
      </div>
      <p className="font-mono text-sm text-security-300 mb-8 break-all">{result.domain}</p>

      {/* Score + Zusammenfassung */}
      <div className="flex flex-col sm:flex-row items-center gap-8 bg-obsidian-900 border border-titanium-900 rounded-none p-6 sm:p-8 mb-8">
        <ScoreGauge score={result.score} />
        <div className="flex-1 text-center sm:text-left">
          <div className="font-mono text-[11px] uppercase tracking-wider text-titanium-400 mb-1">Optimierungs-Score</div>
          <p className="text-titanium-200 leading-relaxed mb-3">
            Wir haben <span className="font-bold text-titanium-50">{totalIssues}</span>{' '}
            {totalIssues === 1 ? 'potenziellen Befund' : 'potenzielle Befunde'} auf{' '}
            <span className="font-mono">{result.domain}</span> gefunden.
          </p>
          {!result.fetched && (
            <p className="flex items-center gap-1.5 text-xs text-brass-300">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              Die Seite war nur eingeschränkt erreichbar — das Ergebnis kann unvollständig sein.
            </p>
          )}
        </div>
      </div>

      {/* Severity-Buckets (gated: nur Zählungen) */}
      <div className="grid sm:grid-cols-3 gap-3 mb-10">
        {summary.map(({ bucket, count }) => {
          const meta = BUCKET_META[bucket];
          const Icon = meta.icon;
          return (
            <div key={bucket} className={`border rounded-none p-4 ${meta.className}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-titanium-300">
                  <Icon className={`h-4 w-4 ${meta.dot}`} aria-hidden /> {meta.label}
                </span>
              </div>
              <div className="font-mono text-3xl font-bold text-titanium-50 tabular-nums">{count}</div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-titanium-500">
                <Lock className="h-3 w-3" aria-hidden /> Details gesperrt
              </div>
            </div>
          );
        })}
      </div>

      {/* Freischalt-Block */}
      <div className="border border-security-800 bg-security-900/20 rounded-none p-6 mb-8">
        <h2 className="inline-flex items-center gap-2 font-display font-bold text-titanium-50 mb-4">
          <ListChecks className="h-5 w-5 text-security-400" aria-hidden />
          Vollständigen Bericht &amp; Optimierungsvorschläge freischalten
        </h2>
        <ul className="space-y-2 mb-6">
          {UNLOCK_BULLETS.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-titanium-200">
              <CheckCircle2 className="h-4 w-4 text-petrol shrink-0 mt-0.5" aria-hidden /> {b}
            </li>
          ))}
        </ul>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => navigate('/optimizer/auth')}
            className="inline-flex items-center justify-center gap-2 bg-security-500 hover:bg-security-400 text-white font-bold px-6 py-3 rounded-none transition-colors"
          >
            Jetzt anmelden &amp; Bericht erhalten <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/optimizer/pricing')}
            className="inline-flex items-center justify-center gap-2 border border-titanium-700 hover:border-titanium-500 text-titanium-100 font-bold px-6 py-3 rounded-none transition-colors"
          >
            Pakete vergleichen
          </button>
        </div>
      </div>

      {/* Neuer Scan */}
      <button
        type="button"
        onClick={() => { clearOptimizerState(); navigate('/optimizer/scan'); }}
        className="inline-flex items-center gap-1.5 text-sm text-titanium-400 hover:text-titanium-100 transition-colors"
      >
        <RotateCw className="h-4 w-4" /> Andere Website scannen
      </button>
    </OptimizerLayout>
  );
}
