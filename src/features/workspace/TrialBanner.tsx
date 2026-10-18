// TrialBanner — zeigt die verbleibende Testlaufzeit (Stripe `trialing`)
// im Workspace an, mit Link zur Zahlungsmethoden-Verwaltung.
import { Link } from 'react-router-dom';
import { Clock3 } from 'lucide-react';
import type { TrialStatus } from '../../core/billing/trial';
import { useAccountStatus } from '../billing/useAccountStatus';

/**
 * Testphasenstatus des aktiven Mandanten. `null` = keine laufende Testphase
 * oder nicht ladbar (rein informativ, kein Fehlerzustand).
 * Auch von der Kunden-Startansicht des Dashboards genutzt.
 */
export function useTrialStatus(): TrialStatus | null {
  return useAccountStatus().trial;
}

export function TrialBanner() {
  const { trial, kind } = useAccountStatus();

  if (!trial) return null;

  const days = Math.max(trial.daysRemaining, 0);
  const expired = trial.daysRemaining <= 0;

  return (
    <div
      className={`flex flex-wrap items-center gap-3 px-4 py-3 border text-sm ${
        trial.endingSoon
          ? 'border-amber-700 bg-amber-950/40 text-amber-200'
          : 'border-titanium-800 bg-obsidian-900 text-titanium-200'
      }`}
    >
      <Clock3 className={`h-4 w-4 shrink-0 ${trial.endingSoon ? 'text-amber-300' : 'text-cyan-300'}`} />
      <span>
        {expired
          ? 'Ihre Testphase ist beendet. Sie nutzen jetzt den dauerhaft kostenlosen Zugang — Scan und Audit Center bleiben verfügbar.'
          : days === 1
            ? 'Ihre kostenlose Testphase endet morgen.'
            : `Ihre kostenlose Testphase endet in ${days} Tagen.`}
      </span>
      {/* Beta: keine Zahlungsdaten nötig. Stripe-Testphase: Zahlungsmittel liegt schon vor. */}
      {expired || kind !== 'beta' ? (
        <Link
          to={expired ? '/pricing?source=trial-expired' : kind === 'stripe' ? '/app/billing' : '/billing/usage'}
          className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 hover:text-cyan-200 transition-colors"
        >
          {expired ? 'Pakete ansehen →' : kind === 'stripe' ? 'Abo verwalten →' : 'Zahlungsmethode hinterlegen →'}
        </Link>
      ) : null}
    </div>
  );
}
