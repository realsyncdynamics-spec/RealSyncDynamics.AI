import { FlaskConical } from 'lucide-react';
import { BETA_APP_NOTICE } from '../../config/pricing';

/**
 * Schmaler, dauerhafter Beta-Hinweis in der App-Shell (/app/*). Bewusst ohne
 * Schließen-Button: solange die Freischaltung je Paket nicht verifiziert ist,
 * soll jeder eingeloggte Nutzer das sehen. Text aus `config/pricing.ts`.
 */
export function BetaShellBanner() {
  return (
    <div
      role="note"
      data-testid="app-beta-banner"
      className="flex shrink-0 items-start gap-2 border-b border-amber-500/20 bg-amber-500/5 px-4 py-1 text-[11px] leading-snug text-amber-200/90"
    >
      <FlaskConical className="mt-px h-3 w-3 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span className="shrink-0 font-mono uppercase tracking-wider">Beta</span>
      <span className="min-w-0">{BETA_APP_NOTICE}</span>
    </div>
  );
}
