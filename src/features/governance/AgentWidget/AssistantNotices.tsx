import { Link } from 'react-router-dom';

/**
 * Gemeinsame Hinweise der Assistenten-Flächen (AgentWidget tenant/anon,
 * App-Shell-Seitenleiste): US-Routing-Bestätigung und „Erneut versuchen".
 *
 * Beide gab es vorher nur im Widget — die Seitenleiste der App-Shell zeigte
 * weder das eine noch das andere: Ein 412 (US-Routing nicht bestätigt) ließ
 * die Nachricht still verschwinden.
 */

export function UsRoutingBanner({ onAck }: { onAck: () => void }) {
  return (
    <div className="border-b border-amber-400/30 bg-amber-400/10 p-3 text-[12px] text-amber-200" data-testid="us-routing-banner">
      <p className="font-semibold">Hinweis zur LLM-Routing-Geografie</p>
      <p className="mt-1 text-amber-100/80">
        Anthropic-direkt routet aktuell durch die USA. Bestätige einmalig, um fortzufahren.
      </p>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onAck}
          className="rounded-lg bg-amber-400 px-3 py-1 text-[12px] font-medium text-black transition-colors hover:bg-amber-300"
        >
          Verstanden, fortfahren
        </button>
      </div>
    </div>
  );
}

/** Knopf unter der ehrlichen Fehlermeldung — sendet die letzte Nachricht erneut. */
export function AssistantRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex justify-start pl-8">
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg border border-rose-400/40 px-3 py-1 text-[12px] font-medium text-rose-200 transition-colors hover:bg-rose-500/10"
        data-testid="assistant-retry"
      >
        Erneut versuchen
      </button>
    </div>
  );
}

/**
 * Ausweichwege, wenn der Assistent nicht antwortet: Ein Ausfall des Chats
 * soll nicht wie ein Ausfall des Produkts wirken. Nur in der App-Shell
 * (eingeloggter Mandant) verwendet — die Ziele sind /app-Routen.
 */
export function AssistantFallbackLinks() {
  const links = [
    { label: 'Website-Scan starten', to: '/app/websites' },
    { label: 'Risiken prüfen', to: '/app/risks' },
    { label: 'Support kontaktieren', to: '/kontakt?topic=support' },
  ];
  return (
    <div className="pl-8 text-[12px] text-titanium-400" data-testid="assistant-fallback">
      <p>Alles andere funktioniert weiter. Direkt weiter mit:</p>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="text-[#00B8D4] hover:underline">
            {l.label} →
          </Link>
        ))}
      </div>
    </div>
  );
}
