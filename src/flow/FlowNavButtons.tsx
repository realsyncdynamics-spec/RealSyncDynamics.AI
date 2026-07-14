/**
 * FlowNavButtons — wiederverwendbare Vor-/Zurück-Navigation für jede Flow-Seite.
 *
 * Regeln (siehe Aufgabenstellung):
 *  - Jede Flow-Seite zeigt sichtbar „Zurück“ und „Weiter“.
 *  - „Zurück“ führt zur vorherigen Flow-Seite bzw. zur Ausgangsseite.
 *  - „Weiter“ führt zum nächsten logisch definierten Schritt.
 *  - Keine Sackgassen: Fehlt eine Zieldefinition, wird auf einen sinnvollen
 *    Standard (Dashboard/Startseite) zurückgefallen.
 */
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import type { FlowAction } from './flowRoutes';

interface FlowNavButtonsProps {
  /** Primäraktion (Weiter). */
  primary?: FlowAction;
  /** Sekundäraktion (Zurück). */
  secondary?: FlowAction;
  /** Weitere optionale Aktionen. */
  extraActions?: FlowAction[];
  /** Fallback-Ziel, falls keine Primäraktion definiert ist (keine Sackgasse). */
  fallbackPrimary?: FlowAction;
}

const primaryClasses =
  'inline-flex items-center justify-center gap-2 px-6 py-3 bg-security-blue text-obsidian ' +
  'font-mono font-bold uppercase tracking-widest text-sm transition-colors ' +
  'hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-security-blue focus:ring-offset-2 focus:ring-offset-obsidian-950';

const secondaryClasses =
  'inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-titanium-700 text-titanium-200 ' +
  'font-mono font-bold uppercase tracking-widest text-sm transition-colors ' +
  'hover:border-titanium-400 hover:bg-titanium-900/40 focus:outline-none focus:ring-2 focus:ring-titanium-500 focus:ring-offset-2 focus:ring-offset-obsidian-950';

const extraClasses =
  'inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-titanium-400 ' +
  'hover:text-security-blue transition-colors';

export function FlowNavButtons({
  primary,
  secondary,
  extraActions,
  fallbackPrimary,
}: FlowNavButtonsProps) {
  const effectivePrimary = primary ?? fallbackPrimary;

  return (
    <div className="mt-10 flex flex-col gap-6">
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        {secondary && (
          <Link to={secondary.to} className={secondaryClasses} data-flow-back>
            <ArrowLeft className="h-4 w-4" />
            {secondary.label}
          </Link>
        )}
        {effectivePrimary && (
          <Link to={effectivePrimary.to} className={primaryClasses} data-flow-next>
            {effectivePrimary.label}
            {effectivePrimary.external ? (
              <ExternalLink className="h-4 w-4" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
          </Link>
        )}
      </div>

      {extraActions && extraActions.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-titanium-900 pt-5">
          <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-600">
            Weitere Aktionen
          </span>
          {extraActions.map((action) => (
            <Link key={action.to + action.label} to={action.to} className={extraClasses} data-flow-extra>
              {action.label}
              {action.external ? (
                <ExternalLink className="h-3 w-3" />
              ) : (
                <ArrowRight className="h-3 w-3" />
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
