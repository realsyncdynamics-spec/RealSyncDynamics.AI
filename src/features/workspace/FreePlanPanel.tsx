// FreePlanPanel — der kostenlose Zugang als eigener Kontozustand im Workspace.
//
// Seit E-F6 (`.claude/os-funnel/PLAN.md`) registriert sich ein Kunde ohne
// Testphase und landet dauerhaft kostenlos hier: einfacher Domain-Scan,
// Governance Score, Audit Center — ohne Zeitdruck. Growth-Testphase und
// Starter sind Upgrade-Angebote, kein Zwangseinstieg. Eine abgelaufene
// Testphase fällt sichtbar auf diesen Zustand zurück statt auf gesperrte
// Module ohne Erklärung.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, Search, Sparkles } from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { getEntitlementsForTenant } from '../../core/usage/usage-service';
import { getFreeAccessReason, type FreeAccessReason } from '../../core/billing/trial';
import { checkoutHrefForPlan, formatPriceEur, planById } from '@/shared/pricing';
import { startGrowthTrial } from '../billing/startGrowthTrial';

const FREE_SCOPE = [
  'Domain-Scan mit Governance Score 0–100',
  'Top-Risiken mit Paragraphenbezug',
  'Audit Center und kompakter PDF-Bericht',
];

export function FreePlanPanel() {
  const { activeTenantId } = useTenant();
  const [reason, setReason] = useState<FreeAccessReason | null>(null);
  const [trialState, setTrialState] = useState<'idle' | 'starting' | 'started' | 'error'>('idle');
  const [trialError, setTrialError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!activeTenantId) { setReason(null); return; }
    (async () => {
      try {
        const decision = await getEntitlementsForTenant(activeTenantId);
        if (!cancelled) setReason(getFreeAccessReason(decision));
      } catch {
        // Der Hinweis ist informativ — bei Fehler einfach nicht anzeigen.
        if (!cancelled) setReason(null);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTenantId]);

  if (!reason) return null;

  const handleStartTrial = async () => {
    setTrialState('starting');
    setTrialError(null);
    try {
      await startGrowthTrial(activeTenantId);
      setTrialState('started');
      // Entitlements werden serverseitig aufgelöst — ein Neuladen holt den
      // neuen Zustand in alle Panels, ohne jedes einzeln zu verdrahten.
      window.location.reload();
    } catch (err) {
      setTrialState('error');
      setTrialError(err instanceof Error ? err.message : 'Testphase konnte nicht gestartet werden.');
    }
  };

  const starter = planById('starter');
  const growth = planById('growth');
  const starterHref = checkoutHrefForPlan(starter, { source: 'workspace-free' });

  return (
    <section
      className="border border-titanium-800 bg-obsidian-900"
      data-testid="free-plan-panel"
    >
      <div className="px-4 py-3 border-b border-titanium-900 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-cyan-300 shrink-0" />
        <p className="font-mono text-[9px] uppercase tracking-widest text-titanium-500">
          {reason === 'trial_expired' ? 'Kostenloser Zugang · Testphase beendet' : 'Kostenloser Zugang'}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 px-4 py-5">
        <div>
          <h3 className="font-display font-bold text-lg text-titanium-50 tracking-tight">
            {reason === 'trial_expired'
              ? 'Ihre Testphase ist beendet — Ihr Zugang bleibt.'
              : 'Dauerhaft kostenlos. Kein Zeitdruck.'}
          </h3>
          <p className="text-sm text-titanium-400 mt-1 max-w-xl">
            Machen Sie sich in Ruhe mit der Plattform vertraut. Der einfache Scan bleibt ohne
            Abo verfügbar — ein Upgrade lohnt sich erst, wenn Sie Monitoring, Evidence-Export
            oder Governance-Bots brauchen.
          </p>
          <ul className="mt-3 space-y-1">
            {FREE_SCOPE.map((item) => (
              <li key={item} className="text-xs text-titanium-300 flex items-center gap-2">
                <span className="text-cyan-300">✓</span>{item}
              </li>
            ))}
          </ul>
          <Link
            to="/audit?source=workspace-free"
            className="mt-4 inline-flex items-center gap-2 border border-cyan-700 bg-cyan-950/40 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-900/40 transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            Domain scannen
          </Link>
        </div>

        <div className="flex flex-col gap-2 md:min-w-[240px] md:border-l md:border-titanium-900 md:pl-6">
          <p className="font-mono text-[9px] uppercase tracking-widest text-titanium-600">Wenn Sie mehr brauchen</p>
          {reason === 'free_plan' && (
            <button
              type="button"
              onClick={handleStartTrial}
              disabled={trialState === 'starting' || trialState === 'started'}
              data-testid="free-plan-start-growth-trial"
              className="inline-flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-xs font-semibold px-3 py-2 transition-colors"
            >
              {trialState === 'starting' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Growth {growth.trialDays} Tage kostenlos testen
            </button>
          )}
          <Link
            to={starterHref}
            className="inline-flex items-center justify-center gap-2 border border-titanium-700 hover:border-titanium-500 text-titanium-100 text-xs font-semibold px-3 py-2 transition-colors"
          >
            Starter ab {formatPriceEur(starter.price.monthlyEur)} / Monat
          </Link>
          <Link
            to="/pricing?source=workspace-free"
            className="inline-flex items-center justify-center gap-1 text-[11px] text-titanium-400 hover:text-titanium-200 transition-colors"
          >
            Alle Pakete vergleichen <ArrowRight className="h-3 w-3" />
          </Link>
          {reason === 'free_plan' && (
            <p className="text-[10px] text-titanium-600">Testphase ohne Karte. Endet automatisch, kein Abo entsteht.</p>
          )}
          {trialError && (
            <p className="text-[11px] text-red-300" role="alert">{trialError}</p>
          )}
        </div>
      </div>
    </section>
  );
}
