import { FlaskConical } from 'lucide-react';
import { BETA_CHECKOUT_NOTICE, BETA_LABEL } from '../../config/pricing';

interface BetaNoticeProps {
  className?: string;
  /** `compact`: eine Zeile kleiner Text, z. B. direkt unter einem CTA. */
  compact?: boolean;
}

/**
 * Beta-Hinweis vor jedem Kauf-CTA (/pricing, /pricing/:slug, Checkout).
 * Text aus `config/pricing.ts` (BETA_CHECKOUT_NOTICE) — dort ändern, nicht hier.
 *
 * Farben über die Amber-Skala: auf Papier-Seiten (`.rs-paper`) kippt sie auf
 * dunkles Bernstein, auf dunklen Flächen bleibt sie hell — lesbar in beiden.
 */
export function BetaNotice({ className = '', compact = false }: BetaNoticeProps) {
  return (
    <div
      role="note"
      data-testid="beta-notice"
      className={`flex items-start gap-2.5 border border-amber-400/40 bg-amber-400/10 text-amber-300 ${
        compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'
      } leading-relaxed ${className}`}
    >
      <FlaskConical className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} mt-0.5 shrink-0`} strokeWidth={1.75} aria-hidden="true" />
      <p className="m-0">
        <strong className="font-semibold">{BETA_LABEL}:</strong> {BETA_CHECKOUT_NOTICE}
      </p>
    </div>
  );
}
