/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SEITE 10 — /optimizer/complete  (Abschluss)
 * Typ: FEEDBACK. Kein Zurück-Button. Zeigt aktuellen Score, das
 * geschätzte Potenzial nach Behebung und den priorisierten Plan.
 *
 * Ehrlich: „Nachher" ist ein ausgewiesenes **Potenzial** (Schätzung),
 * kein gemessener Wert — die automatisierte Anwendung der Fixes ist
 * Backend-seitig noch nicht verfügbar (TODO(Phase 3)).
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Info } from 'lucide-react';

import { OptimizerLayout } from './OptimizerLayout';
import { ScoreGauge } from './components/ScoreGauge';
import { getScanResult } from '../../lib/optimizer/state';
import { prioritizedPlan, projectedScore } from '../../lib/optimizer/plan';

export function OptimizerComplete() {
  const navigate = useNavigate();
  const [result] = useState(() => getScanResult());

  const plan = useMemo(() => (result ? prioritizedPlan(result.issues) : []), [result]);
  const projected = result ? projectedScore(result.score, result.issues) : 0;

  if (!result) {
    return (
      <OptimizerLayout
        step={6}
        pageType="feedback"
        metaTitle="Kein Ergebnis — Cloud Code Optimizer"
        metaDescription="Es liegt kein Scan-Ergebnis vor."
      >
        <div className="text-center py-12">
          <Info className="h-8 w-8 text-titanium-500 mx-auto mb-4" aria-hidden />
          <h1 className="text-2xl font-display font-bold text-titanium-50 mb-2">Kein Ergebnis vorhanden</h1>
          <button
            type="button"
            onClick={() => navigate('/optimizer/scan')}
            className="mt-4 inline-flex items-center gap-2 bg-security-500 hover:bg-security-400 text-white font-bold px-5 py-2.5 rounded-none transition-colors"
          >
            Website scannen <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </OptimizerLayout>
    );
  }

  const delta = projected - result.score;

  return (
    <OptimizerLayout
      step={6}
      pageType="feedback"
      metaTitle={`Optimierung abgeschlossen — ${result.domain}`}
      metaDescription="Dein Optimierungsplan steht bereit."
    >
      <div className="flex items-center gap-2 text-petrol font-mono text-sm uppercase tracking-wider mb-3">
        <CheckCircle2 className="h-5 w-5" aria-hidden /> Optimierung abgeschlossen
      </div>
      <h1 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 tracking-tight mb-1">
        Dein Optimierungsplan steht
      </h1>
      <p className="font-mono text-sm text-security-300 mb-8 break-all">{result.domain}</p>

      {/* Vorher / Potenzial */}
      <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 bg-obsidian-900 border border-titanium-900 rounded-none p-6 mb-4">
        <div className="text-center">
          <div className="font-mono text-[10px] uppercase tracking-widest text-titanium-500 mb-2">Vorher</div>
          <ScoreGauge score={result.score} size={120} />
        </div>
        <ArrowRight className="h-6 w-6 text-titanium-600 shrink-0" aria-hidden />
        <div className="text-center">
          <div className="font-mono text-[10px] uppercase tracking-widest text-petrol mb-2">Potenzial</div>
          <ScoreGauge score={projected} size={120} />
        </div>
      </div>
      <p className="flex items-start gap-2 text-xs text-titanium-500 mb-8">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
        „Potenzial" ist eine Schätzung des erreichbaren Scores nach Behebung aller {plan.length} Befunde
        {delta > 0 ? <> (+{delta} Punkte)</> : null} — kein gemessener Wert. Die automatisierte Anwendung
        der Fixes wird in Kürze ausgerollt.
      </p>

      {/* Plan-Zusammenfassung */}
      <h2 className="font-display font-bold text-titanium-100 mb-3">Priorisierter Plan</h2>
      <ol className="space-y-2 mb-8">
        {plan.slice(0, 10).map((item, i) => (
          <li key={item.id} className="flex items-start gap-3 border border-titanium-900 bg-obsidian-900 rounded-none p-3">
            <span className="font-mono text-xs text-titanium-500 w-5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
            <span className="text-sm text-titanium-200">{item.title}</span>
          </li>
        ))}
        {plan.length > 10 && (
          <li className="text-xs text-titanium-500 pl-8">und {plan.length - 10} weitere im Dashboard.</li>
        )}
      </ol>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => navigate('/optimizer/dashboard')}
          className="inline-flex items-center justify-center gap-2 bg-security-500 hover:bg-security-400 text-white font-bold px-6 py-3 rounded-none transition-colors"
        >
          Zum Dashboard <ArrowRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => navigate('/app')}
          className="inline-flex items-center justify-center gap-2 border border-titanium-700 hover:border-titanium-500 text-titanium-100 font-bold px-6 py-3 rounded-none transition-colors"
        >
          Monitoring im App-Dashboard
        </button>
      </div>
    </OptimizerLayout>
  );
}
