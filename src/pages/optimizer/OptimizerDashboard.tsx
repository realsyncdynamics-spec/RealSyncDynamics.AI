/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SEITE 7 — /optimizer/dashboard  (Post-Login: vollständiger Bericht)
 * Typ: FEEDBACK. Auth-gated: ohne Session → /optimizer/auth.
 *
 * Zeigt alle Befunde mit Details (un-gated) plus tier-abhängige nächste
 * Schritte. Der reale Plan kommt aus `useOptimizerEntitlement`
 * (memberships → subscriptions, kanonische planAccess-Logik) — keine
 * Platzhalter mehr.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert, AlertTriangle, Info, ArrowRight, Loader2, Sparkles, ArrowUpRight, RotateCw,
} from 'lucide-react';

import { OptimizerLayout } from './OptimizerLayout';
import { ScoreGauge } from './components/ScoreGauge';
import { useSupabaseAuth } from '../../features/supabase/SupabaseAuthContext';
import { getScanResult, clearOptimizerState } from '../../lib/optimizer/state';
import { bucketForSeverity, type OptimizerIssue, type SeverityBucket } from '../../lib/optimizer/types';
import { useOptimizerEntitlement, type OptimizerCapabilities } from '../../lib/optimizer/entitlement';
import { tierById } from '../../config/pricing';

const BUCKET_ORDER: SeverityBucket[] = ['kritisch', 'wichtig', 'info'];
const BUCKET_META: Record<SeverityBucket, { label: string; icon: typeof ShieldAlert; dot: string; border: string }> = {
  kritisch: { label: 'Kritisch', icon: ShieldAlert, dot: 'text-red-400', border: 'border-red-900' },
  wichtig: { label: 'Wichtig', icon: AlertTriangle, dot: 'text-brass-400', border: 'border-brass-700' },
  info: { label: 'Info', icon: Info, dot: 'text-titanium-400', border: 'border-titanium-800' },
};

/** Was der Optimizer je nach freigeschalteten Fähigkeiten als nächstes tun kann. */
function nextActionForCaps(caps: OptimizerCapabilities): string {
  if (caps.autoOptimize && caps.monitoring) return 'Auto-Optimierung starten und Monitoring aktivieren.';
  if (caps.autoOptimize) return 'Auto-Optimierung für priorisierte Befunde starten.';
  if (caps.fullReport) return 'Vollständigen Bericht durcharbeiten und Befunde beheben.';
  return 'Bericht lesen und Befunde manuell beheben.';
}

export function OptimizerDashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useSupabaseAuth();
  const [result] = useState(() => getScanResult());

  // Realer Plan + abgeleitete Fähigkeiten.
  const { loading: entLoading, planKey, capabilities } = useOptimizerEntitlement();

  // Auth-Gate: nach Ladeende ohne Session → Anmeldung.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate('/optimizer/auth', { replace: true });
  }, [isLoading, isAuthenticated, navigate]);

  const grouped = useMemo(() => {
    const map: Record<SeverityBucket, OptimizerIssue[]> = { kritisch: [], wichtig: [], info: [] };
    for (const issue of result?.issues ?? []) map[bucketForSeverity(issue.severity)].push(issue);
    return map;
  }, [result]);

  if (isLoading || entLoading) {
    return (
      <OptimizerLayout step={6} pageType="feedback" metaTitle="Bericht wird geladen …" metaDescription="Dein Optimierungsbericht.">
        <div className="flex items-center justify-center gap-2 text-titanium-400 py-16">
          <Loader2 className="h-5 w-5 animate-spin" /> Lade …
        </div>
      </OptimizerLayout>
    );
  }

  if (!result) {
    return (
      <OptimizerLayout
        step={6}
        pageType="feedback"
        metaTitle="Kein Bericht — Cloud Code Optimizer"
        metaDescription="Es liegt kein Scan-Ergebnis vor."
      >
        <div className="text-center py-12">
          <Info className="h-8 w-8 text-titanium-500 mx-auto mb-4" aria-hidden />
          <h1 className="text-2xl font-display font-bold text-titanium-50 mb-2">Kein Bericht vorhanden</h1>
          <p className="text-titanium-400 mb-6">Starte zuerst einen Scan deiner Website.</p>
          <button
            type="button"
            onClick={() => navigate('/optimizer/scan')}
            className="inline-flex items-center gap-2 bg-security-500 hover:bg-security-400 text-white font-bold px-5 py-2.5 rounded-none transition-colors"
          >
            Website scannen <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </OptimizerLayout>
    );
  }

  const tierName = planKey ? (tierById(planKey)?.name ?? planKey) : 'Free';
  const paid = capabilities.fullReport;

  return (
    <OptimizerLayout
      step={6}
      pageType="feedback"
      metaTitle={`Optimierungsbericht — ${result.domain}`}
      metaDescription="Dein vollständiger Optimierungsbericht mit allen Befunden."
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-8">
        <ScoreGauge score={result.score} size={128} />
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 tracking-tight">
            Dein vollständiger Optimierungsbericht
          </h1>
          <p className="font-mono text-sm text-security-300 mt-1 break-all">{result.domain}</p>
          <p className="text-sm text-titanium-400 mt-1">
            Paket: <span className="text-titanium-100 font-semibold">{tierName}</span> · {nextActionForCaps(capabilities)}
          </p>
        </div>
      </div>

      {/* Befunde je Bucket, mit Details (un-gated) */}
      {BUCKET_ORDER.map((bucket) => {
        const issues = grouped[bucket];
        if (issues.length === 0) return null;
        const meta = BUCKET_META[bucket];
        const Icon = meta.icon;
        return (
          <section key={bucket} className="mb-8">
            <h2 className="inline-flex items-center gap-2 font-display font-bold text-titanium-100 mb-3">
              <Icon className={`h-4 w-4 ${meta.dot}`} aria-hidden /> {meta.label}
              <span className="font-mono text-xs text-titanium-500">({issues.length})</span>
            </h2>
            <ul className="space-y-2">
              {issues.map((issue) => (
                <li key={issue.id} className={`border ${meta.border} bg-obsidian-900 rounded-none p-4`}>
                  <div className="font-semibold text-titanium-50 text-sm mb-1">{issue.title}</div>
                  {issue.detail && <p className="text-sm text-titanium-400 leading-relaxed">{issue.detail}</p>}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {/* Upsell — solange die Auto-Optimierung nicht freigeschaltet ist. */}
      {!capabilities.autoOptimize && (
        <div className="border border-security-800 bg-security-900/20 rounded-none p-6 mb-8">
          <h2 className="inline-flex items-center gap-2 font-display font-bold text-titanium-50 mb-2">
            <Sparkles className="h-5 w-5 text-security-400" aria-hidden /> Fixes automatisieren
          </h2>
          <p className="text-sm text-titanium-300 mb-5">
            {paid
              ? 'Dein Paket zeigt den vollständigen Bericht. Für automatisierte Fix-Snippets und tägliches Monitoring wechselst du auf Silber (Growth).'
              : 'Aktuell liest du den Bericht und behebst Befunde selbst. Ab Bronze bekommst du den vollständigen Bericht, ab Silber automatisierte Fix-Snippets.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/optimizer/pricing')}
            className="inline-flex items-center gap-2 bg-security-500 hover:bg-security-400 text-white font-bold px-6 py-3 rounded-none transition-colors"
          >
            {paid ? 'Upgrade auf Silber' : 'Pakete ansehen'} <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Auto-Optimierung — freigeschaltet ab Fix-Snippets-Fähigkeit (growth+) */}
      {capabilities.autoOptimize && (
        <div className="border border-petrol/50 bg-petrol/10 rounded-none p-6 mb-8">
          <h2 className="font-display font-bold text-titanium-50 mb-2">Auto-Optimierung</h2>
          <p className="text-sm text-titanium-300 mb-5">
            Dein Paket schaltet Fix-Snippets frei. Wir stellen dir einen priorisierten
            Optimierungsplan aus den Befunden zusammen.
          </p>
          <button
            type="button"
            onClick={() => navigate('/optimizer/optimizing')}
            className="inline-flex items-center gap-2 bg-petrol hover:bg-petrol/80 text-white font-bold px-6 py-3 rounded-none transition-colors"
          >
            Auto-Optimierung starten <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

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
