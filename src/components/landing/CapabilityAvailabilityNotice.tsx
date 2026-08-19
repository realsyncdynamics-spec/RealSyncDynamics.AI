import { AlertTriangle } from 'lucide-react';
import { PLATFORM_CAPABILITIES } from '../../config/platform-capabilities';

/**
 * Sichtbarer Hinweis, wenn eine beworbene Fähigkeit in Produktion noch nicht
 * arbeitet.
 *
 * ## Warum es das gibt
 *
 * Am 2026-08-17 gegen `RealSyncDynamicsLive` gemessen: Die vier Edge Functions
 * hinter dem Bot-Modul — `bot-chat`, `bot-voice-webhook`, `appointment-book`,
 * `order-intake` — sind **nicht deployt**. Die Tabellen (`bots`,
 * `bot_conversations`, `bot_messages`, `bot_appointments`, `bot_orders`)
 * existieren dagegen mit RLS.
 *
 * Daraus folgt genau ein Zustand, und er ist unangenehm präzise: Ein Kunde
 * kann einen Bot **anlegen und speichern** — beantworten wird der Bot nichts,
 * weil die Laufzeit fehlt. Wer über `/pricing/whatsapp` auf
 * `/checkout/growth?channel=whatsapp` klickt, kauft ein Modul, das im Tarif
 * enthalten ist (`shared/pricing.ts`: Growth führt `whatsapp`), aber nicht
 * ausliefert.
 *
 * Das ist der Punkt, an dem aus einer Doku-Unschärfe ein Zahlungsvorgang wird.
 * Deshalb steht der Hinweis dort, wo der Kaufentscheid fällt — nicht im
 * Kleingedruckten.
 *
 * ## Verhalten
 *
 * Rendert **nichts**, sobald die Fähigkeit in `platform-capabilities.ts` auf
 * `'live'` steht. Der Hinweis verschwindet also durch das Deployment, nicht
 * durch einen weiteren Commit — und niemand muss daran denken, ihn zu
 * entfernen.
 */
export function CapabilityAvailabilityNotice({
  capabilityId,
  className,
}: {
  capabilityId: string;
  /** Zusätzliche Layout-Klassen der einbettenden Seite. */
  className?: string;
}) {
  const capability = PLATFORM_CAPABILITIES.find((c) => c.id === capabilityId);
  if (!capability || capability.status === 'live') return null;

  return (
    <div
      role="note"
      className={`flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/[.07] p-4 ${className ?? ''}`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
      <div className="text-sm leading-relaxed">
        <p className="font-semibold text-amber-200">{capability.name} ist noch nicht einsatzbereit</p>
        <p className="mt-1 text-white/60">
          {capability.note} Wir weisen das hier aus, statt es mitzuverkaufen.
        </p>
      </div>
    </div>
  );
}
