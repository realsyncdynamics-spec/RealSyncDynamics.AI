import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BETA, betaSignupHref } from '../../../config/beta';
import {
  BETA_OFFER, COMPANY_LINE, LEGAL_LINKS, PRODUCTS, SOURCE, TAX_NOTE, productStatus,
} from './landingV3Data';
import '../../../styles/landing-v3.css';

/**
 * Gemeinsame Hülle der Startseite v3 und ihrer Produkt-Einstiege
 * (`/chatbot/start`, `/phonebot/start`, `/scan/start`).
 *
 * Eine Navigation, ein Footer, eine Gestaltung: Die Einstiege übernehmen
 * Tokens und Klassen aus `landing-v3.css`, statt eigene Kopfzeilen und
 * Farbwelten mitzubringen. Auf der Startseite zeigen die Sprungmarken auf
 * Abschnitte derselben Seite (`#katalog`), auf Unterseiten auf `/#katalog`.
 */

export function StatusPill({ label }: { label: string }) {
  return <span className="lv3-pill">{label}</span>;
}

type NavItem = { label: string; anchor?: string; to?: string };

const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Build', anchor: 'katalog' },
  { label: 'Automate', anchor: 'katalog' },
  { label: 'Govern', anchor: 'govern' },
  { label: 'Voice Agent', to: '/phonebot/start' },
  { label: 'Preise', anchor: 'preise' },
  { label: 'Fragen', anchor: 'fragen' },
  { label: 'Kontakt', to: '/contact-sales' },
  { label: 'Anmelden', to: '/welcome' },
];

export function V3Nav({ onLanding = false, current }: { onLanding?: boolean; current?: string }) {
  const anchorHref = (id: string) => (onLanding ? `#${id}` : `/#${id}`);
  return (
    <nav className="lv3-nav" aria-label="Hauptnavigation">
      <Link to="/" className="lv3-brand">RealSync Dynamics &amp; AI</Link>
      {NAV_ITEMS.map((item) =>
        item.to ? (
          <Link
            key={item.label}
            to={item.to}
            aria-current={current === item.to ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ) : (
          <a key={item.label} href={anchorHref(item.anchor!)}>{item.label}</a>
        ),
      )}
      <a className="lv3-btn lv3-btn--solid" href={anchorHref('start')}>Check starten</a>
    </nav>
  );
}

export function V3BetaRibbon({ source }: { source: string }) {
  if (!BETA_OFFER) return null;
  return (
    <p className="lv3-ribbon">
      <span>{BETA.headline} – bis {BETA.endsLabel}, keine Kreditkarte.</span>{' '}
      <Link to={betaSignupHref(BETA.testPlan, `${source}-ribbon`)}>Jetzt kostenlos testen</Link>
    </p>
  );
}

export function V3Footer() {
  return (
    <footer className="lv3-footer">
      <div className="lv3-footer-row">
        <span className="lv3-brand">RealSync Dynamics &amp; AI</span>
        <nav aria-label="Rechtliches" className="lv3-legal">
          {LEGAL_LINKS.map((l) => <Link key={l.to} to={l.to}>{l.label}</Link>)}
          <a href="#top">Nach oben ↑</a>
        </nav>
      </div>
      <p className="lv3-fine">{COMPANY_LINE} · {TAX_NOTE}</p>
    </footer>
  );
}

// ── Unterseiten ─────────────────────────────────────────────────────────────

export interface Crumb { label: string; to?: string }

export function V3Breadcrumb({ items }: { items: readonly Crumb[] }) {
  return (
    <nav aria-label="Brotkrumen" className="lv3-crumbs">
      <ol>
        {items.map((c, i) => (
          <li key={c.label}>
            {c.to && i < items.length - 1 ? (
              <Link to={c.to}>{c.label}</Link>
            ) : (
              <span aria-current="page">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export interface SectionLink { id: string; label: string }

/** „Auf dieser Seite“ — klebt beim Scrollen oben und führt zu den Abschnitten. */
export function V3SectionNav({ items }: { items: readonly SectionLink[] }) {
  return (
    <nav aria-label="Auf dieser Seite" className="lv3-subnav">
      <span className="lv3-eyebrow">Auf dieser Seite</span>
      <ul>
        {items.map((s) => (
          <li key={s.id}><a href={`#${s.id}`}>{s.label}</a></li>
        ))}
      </ul>
    </nav>
  );
}

/** Wechsel zwischen den Modulen der Startseite; das aktuelle Modul ist markiert. */
export function V3ModuleSwitch({ currentKey, id = 'module' }: { currentKey?: string; id?: string }) {
  return (
    <section id={id} className="lv3-section" aria-labelledby={`${id}-h`}>
      <span className="lv3-eyebrow">Module</span>
      <h2 id={`${id}-h`} className="lv3-h2">Alle Module im Überblick.</h2>
      <div className="lv3-cards lv3-cards--compact">
        {PRODUCTS.map((p, i) => {
          const st = productStatus(p);
          const isCurrent = p.key === currentKey;
          return (
            <Link
              key={p.key}
              to={p.href}
              className="lv3-card"
              data-current={isCurrent || undefined}
              aria-current={isCurrent ? 'page' : undefined}
            >
              <span className="lv3-meta">
                {String(i + 1).padStart(2, '0')} · {p.section}
                {st ? <StatusPill label={st.label} /> : null}
                {isCurrent ? <StatusPill label="Sie sind hier" /> : null}
              </span>
              <strong className="lv3-card-name">{p.name}</strong>
              <span>{p.short}</span>
              <span className="lv3-card-cta">
                {isCurrent ? 'Aktuelle Seite' : 'Produkt ansehen'} <span aria-hidden="true">→</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Seitenrahmen für Produkt-Einstiege: Beta-Hinweis, Hauptnavigation,
 * Brotkrumen, optional „Auf dieser Seite“, Inhalt, Footer.
 */
export function V3PageShell({
  current,
  crumbs,
  sections,
  source = SOURCE,
  children,
}: {
  current: string;
  crumbs: readonly Crumb[];
  sections?: readonly SectionLink[];
  source?: string;
  children: ReactNode;
}) {
  return (
    <div className="lv3" id="top">
      <a href="#inhalt" className="lv3-skip">Zum Inhalt springen</a>
      <V3BetaRibbon source={source} />
      <header className="lv3-page-head">
        <V3Nav current={current} />
        <V3Breadcrumb items={crumbs} />
      </header>
      {sections && sections.length > 0 ? <V3SectionNav items={sections} /> : null}
      <main id="inhalt">{children}</main>
      <V3Footer />
    </div>
  );
}
