import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { PUBLIC_FOOTER_LINKS } from '../../config/public-nav';
import { CTA } from '../../content/runtimeVocab';
import { cx } from './cx';

/**
 * Gemeinsamer Fuß der öffentlichen Seitenrahmen im Look des v4-Landing-Footers
 * (`V4Footer`): vier Mono-Spalten (Unternehmen, Betrieb, Standards, Kontakt),
 * darunter Copyright + Rechtsleiste.
 *
 * Inhalte 1:1 aus `GovernanceFooter` (Spaltentexte) und `PUBLIC_FOOTER_LINKS`
 * (Rechtslinks inkl. Impressum, § 5 DDG). Keine eigenen Rechts- oder
 * Firmentexte hier pflegen.
 *
 * `linkColumns` erlaubt Rahmen wie LandingShell, ihre bisherigen Link-Spalten
 * mit identischen Zielen weiterzuführen.
 */
export interface PublicFooterLink {
  label: string;
  to: string;
}

export interface PublicFooterColumn {
  title: string;
  links: readonly PublicFooterLink[];
}

const FOCUS =
  'rounded-[var(--brand-radius-sm)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-champ)]';

function FooterLink({ link, className }: { link: PublicFooterLink; className: string }) {
  if (link.to.startsWith('/')) {
    return (
      <Link to={link.to} className={cx(className, FOCUS)}>
        {link.label}
      </Link>
    );
  }
  return (
    <a href={link.to} className={cx(className, FOCUS)}>
      {link.label}
    </a>
  );
}

const HEAD =
  'mb-1.5 block font-[family-name:var(--brand-mono)] text-[11px] font-medium tracking-[.16em] text-[var(--brand-titan)]';

export function PublicFooter({ linkColumns }: { linkColumns?: readonly PublicFooterColumn[] }) {
  return (
    <footer
      data-testid="public-footer"
      className="relative z-[1] border-t border-[var(--brand-line-dark)] bg-[var(--brand-bg-0)] px-4 pb-6 pt-6 font-[family-name:var(--brand-sans)] sm:px-6 lg:px-8"
    >
      {linkColumns && linkColumns.length > 0 && (
        <div className="mx-auto mb-6 grid w-full max-w-7xl grid-cols-2 gap-6 border-b border-[var(--brand-line-dark)] pb-6 sm:grid-cols-4">
          {linkColumns.map((col) => (
            <div key={col.title}>
              <h3 className={cx(HEAD, 'mb-3 uppercase text-[var(--brand-champ)]')}>{col.title}</h3>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <FooterLink
                      link={l}
                      className="text-[13px] text-[var(--brand-titan)] transition-colors hover:text-[var(--brand-champ-hi)]"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="mx-auto mb-4 grid w-full max-w-7xl gap-5 border-b border-[var(--brand-line-dark)] pb-4 text-[12px] leading-[1.7] text-[var(--brand-muted)] sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <b className={HEAD}>UNTERNEHMEN</b>
          <strong className="font-medium text-[var(--brand-champ-hi)]">RealSync Dynamics</strong>
          <br />
          Einzelunternehmen · Dominik Steiner
          <br />
          Neuhaus am Rennweg
        </div>
        <div>
          <b className={HEAD}>BETRIEB</b>
          Datenhaltung in der EU (Supabase, eu-central-1 · Frankfurt).
          <br />
          Unterstützt Ihre DSGVO- und EU-AI-Act-Kontrollen — die rechtliche Bewertung bleibt bei Ihnen.
        </div>
        <div>
          <b className={HEAD}>STANDARDS</b>
          Rahmenwerke: DSGVO · EU AI Act · ISO 27001 · NIS2
          <br />
          C2PA Content Credentials
        </div>
        <div>
          <b className={HEAD}>KONTAKT</b>
          Enterprise per Anfrage — SSO, On-Prem, Custom-DPA, Behördenvertrag.
          <br />
          <Link
            to="/contact-sales?intent=enterprise"
            className={cx('text-[var(--brand-champ)] underline-offset-4 hover:underline', FOCUS)}
          >
            {CTA.enterprise}
          </Link>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[11px] text-[var(--brand-muted)]">
        <span>© 2026 RealSync Dynamics.AI</span>
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Rechtliches">
          {PUBLIC_FOOTER_LINKS.map((link, index) => (
            <Fragment key={link.to}>
              {index > 0 && (
                <i className="not-italic text-[var(--brand-titan)]" aria-hidden="true">
                  |
                </i>
              )}
              <FooterLink link={link} className="transition-colors hover:text-[var(--brand-champ-hi)]" />
            </Fragment>
          ))}
        </nav>
      </div>
    </footer>
  );
}
