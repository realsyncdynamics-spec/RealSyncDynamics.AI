import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useEntitlements } from '../../core/billing/useEntitlements';

/**
 * Hinweis auf eine fehlgeschlagene Zahlung während der Grace Period.
 *
 * Entscheidung des Eigentümers vom 2026-08-24: Bei `past_due` bleibt sieben
 * Tage lang **alles** aktiv — Dashboard, Governance-Funktionen, Monitoring und
 * geplante Prüfungen. Erst danach pausieren die bezahlten Berechtigungen.
 *
 * Genau deshalb braucht es diesen Hinweis: Ohne ihn merkt der Kunde nichts,
 * weil sich nichts ändert — und würde am achten Tag ohne Vorwarnung vor einem
 * eingeschränkten Konto stehen. Der Hinweis ist der einzige Unterschied, den
 * die Frist sichtbar macht.
 *
 * Er schaltet nichts frei und nichts ab. Was der Mandant darf, entscheidet
 * `tenant_entitlements()` auf dem Server; diese Fläche zeigt nur an.
 */
export function PaymentGraceBanner() {
  const { paymentState } = useEntitlements();

  if (paymentState.status !== 'past_due') return null;

  const tage = paymentState.graceDaysRemaining;
  // Fehlt der Zeitstempel, ist keine Frist bestimmbar. Der Auflöser sperrt
  // dann bewusst nicht — der Hinweis nennt entsprechend keine Restlaufzeit,
  // statt eine zu erfinden.
  const frist =
    tage === null
      ? 'Ihre Funktionen bleiben vorerst vollständig aktiv.'
      : tage > 0
        ? `Ihre Funktionen bleiben noch ${tage} ${tage === 1 ? 'Tag' : 'Tage'} vollständig aktiv.`
        : 'Die kostenpflichtigen Funktionen sind derzeit pausiert.';

  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      <span className="flex-1">
        <strong className="font-semibold">Zahlung fehlgeschlagen.</strong>{' '}
        {frist} Ihre Daten, Prüfpfade und Nachweise bleiben in jedem Fall erhalten.
      </span>
      <Link
        to="/app/billing"
        className="shrink-0 font-mono text-xs uppercase tracking-wider underline underline-offset-4 hover:text-amber-100"
      >
        Zahlung prüfen
      </Link>
    </div>
  );
}
