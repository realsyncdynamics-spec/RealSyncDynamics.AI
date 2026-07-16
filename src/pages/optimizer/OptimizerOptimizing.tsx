/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SEITE 9 — /optimizer/optimizing  (Auto-Optimierung läuft)
 * Typ: FEEDBACK (Info-Only). Gated auf die reale `autoOptimize`-Fähigkeit
 * (Fix-Snippets, growth+). Stellt aus den realen Scan-Befunden einen
 * priorisierten Optimierungsplan zusammen und leitet auto weiter → SEITE 10.
 *
 * Ehrliche Abgrenzung: Es werden KEINE Änderungen an der Zielseite
 * vorgenommen — der Optimizer hat nur Lese-Zugriff (gdpr-audit). Die
 * automatisierte Anwendung der Fixes ist Backend-seitig noch nicht
 * verfügbar (TODO(Phase 3)); dieser Schritt erzeugt den Plan.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { OptimizerLayout } from './OptimizerLayout';
import { getScanResult } from '../../lib/optimizer/state';
import { useOptimizerEntitlement } from '../../lib/optimizer/entitlement';
import { prioritizedPlan } from '../../lib/optimizer/plan';

export function OptimizerOptimizing() {
  const navigate = useNavigate();
  const { loading: entLoading, capabilities } = useOptimizerEntitlement();
  const [result] = useState(() => getScanResult());
  const [step, setStep] = useState(0);
  const timers = useRef<number[]>([]);

  const plan = result ? prioritizedPlan(result.issues) : [];

  // Gates: kein Ergebnis → Scan; keine Auto-Optimierung → Pricing.
  useEffect(() => {
    if (!result) { navigate('/optimizer/scan', { replace: true }); return; }
    if (!entLoading && !capabilities.autoOptimize) {
      navigate('/optimizer/pricing', { replace: true });
    }
  }, [result, entLoading, capabilities.autoOptimize, navigate]);

  // Plan Schritt für Schritt „durchlaufen", dann weiter zur Abschluss-Seite.
  useEffect(() => {
    if (entLoading || !capabilities.autoOptimize || plan.length === 0) return;
    const total = plan.length;
    for (let i = 1; i <= total; i++) {
      timers.current.push(window.setTimeout(() => setStep(i), i * 700));
    }
    timers.current.push(window.setTimeout(() => navigate('/optimizer/complete', { replace: true }), (total + 1) * 700));
    return () => { timers.current.forEach(clearTimeout); timers.current = []; };
  }, [entLoading, capabilities.autoOptimize, plan.length, navigate]);

  return (
    <OptimizerLayout
      step={6}
      pageType="feedback"
      metaTitle="Optimierung läuft — Cloud Code Optimizer"
      metaDescription="Dein Optimierungsplan wird zusammengestellt."
    >
      <div className="flex flex-col items-center text-center py-6">
        <div className="relative w-32 h-32 mb-8" aria-hidden>
          <div className="absolute inset-0 border border-petrol/40 rounded-none" />
          <div className="absolute inset-0 border border-petrol/60 rounded-none animate-glow-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-petrol animate-spin" />
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 tracking-tight mb-2">
          Optimierung läuft …
        </h1>
        <p className="text-sm text-titanium-400 mb-8">
          Wir priorisieren deine Befunde und erstellen den Optimierungsplan.
        </p>

        {/* Live-Log der geplanten Fixes (aus realen Befunden) */}
        <div className="w-full max-w-lg text-left font-mono text-xs border border-titanium-900 bg-obsidian-950 rounded-none p-4 space-y-1" aria-live="polite">
          {plan.slice(0, step).map((item, i) => (
            <div key={item.id} className="flex items-start gap-2 text-titanium-300">
              <span className="text-petrol shrink-0">✓</span>
              <span className="text-titanium-500">{String(i + 1).padStart(2, '0')}</span>
              <span className="truncate">Fix-Plan: {item.title}</span>
            </div>
          ))}
          {step < plan.length && (
            <div className="flex items-center gap-2 text-titanium-500">
              <Loader2 className="h-3 w-3 animate-spin shrink-0" aria-hidden />
              Analysiere Befund {step + 1} / {plan.length} …
            </div>
          )}
        </div>
      </div>
    </OptimizerLayout>
  );
}
