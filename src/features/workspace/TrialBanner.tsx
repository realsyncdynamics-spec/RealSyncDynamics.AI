// TrialBanner — zeigt die verbleibende Testlaufzeit (Stripe `trialing`)
// im Workspace an, mit Link zur Zahlungsmethoden-Verwaltung.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock3 } from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { getEntitlementsForTenant } from '../../core/usage/usage-service';
import { getTrialStatus, type TrialStatus } from '../../core/billing/trial';

export function TrialBanner() {
  const { activeTenantId } = useTenant();
  const [trial, setTrial] = useState<TrialStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!activeTenantId) { setTrial(null); return; }
    (async () => {
      try {
        const decision = await getEntitlementsForTenant(activeTenantId);
        if (!cancelled) setTrial(getTrialStatus(decision));
      } catch {
        // Trial-Hinweis ist informativ — bei Fehler einfach nicht anzeigen.
        if (!cancelled) setTrial(null);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTenantId]);

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
          ? 'Ihre kostenlose Testphase ist abgelaufen.'
          : days === 1
            ? 'Ihre kostenlose Testphase endet morgen.'
            : `Ihre kostenlose Testphase endet in ${days} Tagen.`}
      </span>
      <Link
        to="/billing/usage"
        className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 hover:text-cyan-200 transition-colors"
      >
        Zahlungsmethode hinterlegen →
      </Link>
    </div>
  );
}
