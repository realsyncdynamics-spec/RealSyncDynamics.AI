import { Link } from 'react-router-dom';
import { PUBLIC_FOOTER_LINKS } from '../../config/public-nav';
import { CTA } from '../../content/runtimeVocab';
import { GA_LINE_SOFT, GA_MONO, GA_MUTED, GA_SILVER, GA_TEXT, GA_TITAN } from './governance-ai-theme';

/**
 * Enterprise-Footer: Unternehmen, Betrieb, Standards, Kontakt — darunter die
 * Rechtsleiste.
 *
 * Die Rechtslinks kommen aus `PUBLIC_FOOTER_LINKS`; Impressum und
 * Datenschutz sind nach § 5 DDG von jeder Seite erreichbar zu halten, und
 * eine handgepflegte Zweitliste hier wäre genau die Stelle, an der beim
 * nächsten Umbau eine Pflichtangabe verschwindet.
 *
 * Die Kontaktspalte nutzt `CTA.enterprise` — die einzige kontaktbasierte
 * Handlungsaufforderung des Produkts (`runtimeVocab.ts`).
 */
const COLUMNS: readonly { title: string; body: React.ReactNode }[] = [
  {
    title: 'UNTERNEHMEN',
    body: (
      <>
        <strong className="font-medium" style={{ color: GA_SILVER }}>
          RealSyncDynamics GmbH
        </strong>
        <br />
        Berlin, Deutschland
        <br />
        Handelsregister: HRB · Amtsgericht Berlin-Charlottenburg
      </>
    ),
  },
  {
    title: 'BETRIEB',
    body: (
      <>
        Alle Daten werden in Europa verarbeitet und gespeichert.
        <br />
        Volle Konformität mit der Datenschutz-Grundverordnung.
      </>
    ),
  },
  {
    title: 'STANDARDS',
    body: (
      <>
        DSGVO · EU AI Act · ISO 27001 · NIS2
        <br />
        C2PA-Standard · Deutsche Ingenieurskunst
      </>
    ),
  },
];

export function GovernanceFooter() {
  return (
    <footer
      className="relative z-[1] border-t bg-[rgba(12,13,15,.82)] px-[4vw] pb-6 pt-5 backdrop-blur-[4px]"
      style={{ borderColor: GA_LINE_SOFT }}
    >
      <div
        className="mx-auto mb-4 grid w-full max-w-[1500px] gap-5 border-b pb-4 text-[12px] leading-[1.7] sm:grid-cols-2 lg:grid-cols-4"
        style={{ borderColor: GA_LINE_SOFT, color: GA_MUTED }}
      >
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <b
              className="mb-1.5 block text-[11px] font-medium tracking-[.16em]"
              style={{ fontFamily: GA_MONO, color: GA_TITAN }}
            >
              {column.title}
            </b>
            {column.body}
          </div>
        ))}
        <div>
          <b
            className="mb-1.5 block text-[11px] font-medium tracking-[.16em]"
            style={{ fontFamily: GA_MONO, color: GA_TITAN }}
          >
            KONTAKT
          </b>
          Enterprise per Anfrage — SSO, On-Prem, Custom-DPA, Behördenvertrag.
          <br />
          <Link
            to="/contact-sales?intent=enterprise"
            className="underline-offset-4 transition hover:underline"
            style={{ color: '#e6c98a' }}
          >
            {CTA.enterprise}
          </Link>
        </div>
      </div>

      <div
        className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[11px]"
        style={{ color: 'rgba(238,242,247,.6)' }}
      >
        <span>© 2026 RealSync Dynamics.AI</span>
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Rechtliches">
          {PUBLIC_FOOTER_LINKS.map((link, index) => (
            <span key={link.to} className="flex items-center gap-3">
              {index > 0 && (
                <i className="not-italic" style={{ color: 'rgba(169,180,192,.5)' }} aria-hidden="true">
                  |
                </i>
              )}
              <Link
                to={link.to}
                className="transition-colors"
                style={{ color: 'rgba(238,242,247,.6)' }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.color = GA_TEXT;
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.color = 'rgba(238,242,247,.6)';
                }}
              >
                {link.label}
              </Link>
            </span>
          ))}
        </nav>
      </div>
    </footer>
  );
}
