import { GA_GREEN, GA_LINE_SOFT, GA_MONO, GA_SILVER, GA_TITAN } from './governance-ai-theme';

/**
 * Betriebsleiste über dem Header — das erste Enterprise-Signal der Seite.
 *
 * ## Was hier stehen darf
 *
 * Nur nachprüfbare Aussagen über den Betrieb: Region, Hosting-Ort und die
 * Rahmenwerke, gegen die geprüft wird. Bewusst **keine** Zahlen — weder
 * Live-Metrik (Scans, Tenants, Findings), die ein anonymer Besucher gar nicht
 * hätte, noch eine Uptime-Quote: Ein SLA ist eine Vertragszusage gegenüber
 * Enterprise-Kunden, keine Eigenschaft der öffentlichen Seite.
 * `hero-content.ts` hält das seit #1352 ausdrücklich fest.
 *
 * „RUNTIME OPERATIONAL" beschreibt den Dienstzustand, nicht den Zustand eines
 * Kundenmandanten.
 */
const STANDARDS = 'DSGVO · EU AI ACT · ISO 27001';

export function GovernanceStatusBar() {
  return (
    <div
      className="relative z-20 flex h-[36px] items-center border-b bg-[rgba(14,15,18,.9)] px-[4vw]"
      style={{ borderColor: GA_LINE_SOFT }}
      aria-label="Betriebsstatus"
    >
      <div
        className="mx-auto flex w-full max-w-[1500px] items-center gap-5 overflow-hidden whitespace-nowrap text-[11px] tracking-[.12em]"
        style={{ fontFamily: GA_MONO, color: GA_TITAN }}
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: GA_GREEN, boxShadow: `0 0 10px ${GA_GREEN}cc` }}
          aria-hidden="true"
        />
        <span>
          <b className="font-medium" style={{ color: GA_SILVER }}>
            RUNTIME OPERATIONAL
          </b>{' '}
          · EU-CENTRAL
        </span>
        <span className="hidden md:inline">HOSTING IN EUROPA</span>

        <span className="ml-auto hidden items-center gap-5 sm:flex">
          <span>{STANDARDS}</span>
        </span>
      </div>
    </div>
  );
}
