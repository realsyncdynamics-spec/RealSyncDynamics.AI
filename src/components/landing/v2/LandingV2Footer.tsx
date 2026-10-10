import { Link } from 'react-router-dom';
import { COMPANY } from '../../../config/company';
import { LV2_BRAND, LV2_FAQ } from './landing-v2-content';

/* ── 08 FAQ ──────────────────────────────────────────────────────────── */
export function LandingFaq() {
  return (
    <section id="faq" className="lv2__section" aria-labelledby="lv2-faq-title">
      <div className="lv2__wrap">
        <p className="lv2__kicker">Häufige Fragen</p>
        <h2 id="lv2-faq-title" className="lv2__h2">
          Governance-Fragen, klar beantwortet.
        </h2>
        <div className="lv2-faq">
          {LV2_FAQ.map((f, i) => (
            <details key={f.q} open={i === 0}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 09 CTA ──────────────────────────────────────────────────────────── */
export function FinalCta() {
  return (
    <section className="lv2__section lv2-final" aria-labelledby="lv2-final-title">
      <div className="lv2__wrap">
        <h2 id="lv2-final-title" className="lv2__h2">
          Compliance, die sich beweisen lässt.
        </h2>
        <p className="lv2__lead">
          Starten Sie mit einem kostenlosen Audit Ihrer KI-Systeme – Governance Score, Top-Risiken
          und Planempfehlung in 90 Sekunden.
        </p>
        <div className="lv2-cta-row">
          <Link to="/audit?source=landing-v2-final" className="lv2-btn lv2-btn--gold">
            Free Audit starten
          </Link>
          <Link to="/contact-sales?tier=enterprise&source=landing-v2-final" className="lv2-btn lv2-btn--glass">
            Enterprise anfragen
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── 10 Footer ───────────────────────────────────────────────────────── */
const COLUMNS = [
  {
    title: 'Produkt',
    links: [
      { label: 'Plattform', to: '/runtime' },
      { label: 'Evidence Vault', to: '/evidence' },
      { label: 'Preise', to: '/pricing' },
      { label: 'Roadmap', to: '/roadmap' },
      { label: 'Changelog', to: '/changelog' },
    ],
  },
  {
    title: 'Governance',
    links: [
      { label: 'Governance Runtime', to: '/governance-runtime' },
      { label: 'Agent Governance', to: '/agent-governance' },
      { label: 'Trust Center', to: '/trust' },
      { label: 'AVV (Art. 28 DSGVO)', to: '/legal/avv' },
      { label: 'Sub-Prozessoren', to: '/legal/sub-processors' },
      { label: 'Security', to: '/security' },
    ],
  },
  {
    title: 'Rechtliches',
    links: [
      { label: 'Impressum', to: '/impressum' },
      { label: 'Datenschutz', to: '/datenschutz' },
      { label: 'AGB', to: '/agb' },
      { label: 'Widerruf', to: '/legal/widerruf' },
      { label: 'Kontakt', to: '/kontakt' },
    ],
  },
] as const;

export function LandingV2Footer() {
  const hq = COMPANY.headquartersAddress;
  return (
    <footer className="lv2-footer">
      <div className="lv2__wrap">
        <div className="lv2-footer__grid">
          <div className="lv2-footer__brand">
            <span className="lv2-logo">{LV2_BRAND}</span>
            <p>AI Compliance Operations OS for Europe. Entwickelt und betrieben in Thüringen, Deutschland.</p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-labelledby={`lv2-footer-${col.title}`}>
              <h2 id={`lv2-footer-${col.title}`}>{col.title}</h2>
              <ul>
                {col.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="lv2-footer__legal">
          <span>
            © {new Date().getFullYear()} RealSync Dynamics AI Dominik Steiner · {COMPANY.legalForm} ·{' '}
            {hq.postalCode} {hq.city}
          </span>
          <span>Kleinunternehmer i. S. v. § 19 UStG · DE</span>
        </div>
      </div>
    </footer>
  );
}
