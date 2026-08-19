import { AlertTriangle } from 'lucide-react';
import { isEdgeFunctionInProduction } from '../../config/production-edge-functions';

/**
 * Hinweis auf einer Seite, deren Ablauf ein Backend braucht, das nicht
 * in Produktion läuft.
 *
 * ## Unterschied zu `CapabilityAvailabilityNotice`
 *
 * Jener Hinweis hängt an einem **beworbenen Modul** aus
 * `platform-capabilities.ts` — er beantwortet „darf die Startseite das
 * verkaufen?". Dieser hier hängt an **konkreten Edge Functions** und
 * beantwortet „kann dieser Knopf tun, was er verspricht?". Beides braucht
 * es: Ein Ablauf kann aus Functions bestehen, die zu keinem beworbenen
 * Modul gehören — der SiteOS-Builder ist genau so ein Fall.
 *
 * ## Verhalten
 *
 * Rendert **nichts**, sobald jede genannte Function in Produktion läuft. Der
 * Hinweis verschwindet damit durch das Deployment, nicht durch einen weiteren
 * Commit — niemand muss daran denken, ihn zu entfernen. Und solange er
 * stehen bleibt, meldet `test/backend/edge-function-contract.test.ts`
 * denselben Zustand auf der Codeseite.
 */
export function EdgeFunctionAvailabilityNotice({
  functions,
  title,
  detail,
  className,
}: {
  /** Alle Functions, ohne die der Ablauf nicht arbeitet. */
  functions: readonly string[];
  /** Was nicht geht — in der Sprache des Kunden, nicht in Slugs. */
  title: string;
  /** Was stattdessen gilt. Ein Satz. */
  detail: string;
  className?: string;
}) {
  const missing = functions.filter((fn) => !isEdgeFunctionInProduction(fn));
  if (missing.length === 0) return null;

  return (
    <div
      role="note"
      className={`flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/[.07] p-4 text-left ${className ?? ''}`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
      <div className="text-sm leading-relaxed">
        <p className="font-semibold text-amber-200">{title}</p>
        <p className="mt-1 text-white/60">{detail}</p>
      </div>
    </div>
  );
}

/**
 * Läuft der gesamte Ablauf? Für Aufrufer, die den Zustand nicht anzeigen,
 * sondern eine Entscheidung daran hängen.
 */
export function allEdgeFunctionsAvailable(functions: readonly string[]): boolean {
  return functions.every(isEdgeFunctionInProduction);
}
