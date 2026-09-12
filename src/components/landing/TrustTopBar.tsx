import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { LANDING_GREEN, LANDING_MONO } from './landing-theme';

/**
 * Trust-Leiste über dem Header auf `/`: Enterprise-Signale auf den ersten
 * Blick (grüne Häkchen statt reiner Text-Tags).
 *
 * Nur Aussagen, die an anderer Stelle bereits stehen: ISO 27001 als
 * Kontrollrahmen (EnterpriseLanding), nicht als Zertifikat; das
 * 99,9 %-SLA gilt ausschliesslich für Enterprise (compliance-notices).
 * Der Status-Link zeigt auf die Statusseite statt einen Live-Wert zu
 * behaupten.
 */
const TRUST_ITEMS = [
  'DSGVO',
  'EU AI ACT',
  'ISO-27001-KONTROLLEN',
  '99,9 % UPTIME-SLA · ENTERPRISE',
  'EU-HOSTING · FRANKFURT',
] as const;

export function TrustTopBar() {
  return (
    <div
      className="relative z-30 border-b border-white/[0.06] bg-[rgba(5,7,11,0.92)]"
      style={{ fontFamily: LANDING_MONO }}
      aria-label="Vertrauens- und Compliance-Signale"
    >
      <div className="mx-auto flex h-[34px] max-w-[1500px] items-center gap-5 px-[4vw]">
        <ul className="flex min-w-0 flex-1 items-center gap-5 overflow-x-auto whitespace-nowrap text-[9px] tracking-[.18em] text-white/55 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TRUST_ITEMS.map((item) => (
            <li key={item} className="flex shrink-0 items-center gap-1.5">
              <span
                className="flex h-3.5 w-3.5 items-center justify-center rounded-full"
                style={{ backgroundColor: `${LANDING_GREEN}22`, color: LANDING_GREEN }}
                aria-hidden="true"
              >
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              {item}
            </li>
          ))}
        </ul>
        <Link
          to="/status"
          className="hidden shrink-0 items-center gap-1.5 text-[9px] tracking-[.18em] text-white/55 transition hover:text-white focus-visible:underline focus-visible:underline-offset-4 focus-visible:outline-none sm:inline-flex"
        >
          <span
            className="landing-status-dot h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: LANDING_GREEN }}
            aria-hidden="true"
          />
          SYSTEMSTATUS
        </Link>
      </div>
    </div>
  );
}
