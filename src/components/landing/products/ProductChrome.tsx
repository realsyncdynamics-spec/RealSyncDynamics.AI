import { Link } from 'react-router-dom';
import { PRODUCT_PAGES, type ProductPage } from './productLandingShared';
import { COMPANY_LINE, LEGAL_LINKS, TAX_NOTE } from '../v3/landingV3Data';

/**
 * Gemeinsamer Rahmen der vier Produkt-Landingpages: Navigation oben, Footer mit
 * allen Pflichtseiten unten. Die aktuelle Seite ist als `aria-current` markiert.
 */

export function ProductNav({ current }: { current: ProductPage['key'] }) {
  return (
    <nav className="pl-nav" aria-label="Hauptnavigation">
      <Link to="/" className="pl-brand">RealSync Dynamics &amp; AI</Link>
      <div className="pl-nav-products">
        {PRODUCT_PAGES.map((p) =>
          p.key === current ? (
            <a key={p.key} href="#top" aria-current="page">{p.name}</a>
          ) : (
            <Link key={p.key} to={p.href}>{p.name}</Link>
          ),
        )}
      </div>
      <a href="#preise">Preise</a>
      <Link to="/welcome">Anmelden</Link>
    </nav>
  );
}

export function ProductFooter() {
  return (
    <footer className="pl-footer">
      <div className="pl-footer-row">
        <Link to="/" className="pl-brand">RealSync Dynamics &amp; AI</Link>
        <nav aria-label="Rechtliches" className="pl-legal">
          {LEGAL_LINKS.map((l) => <Link key={l.to} to={l.to}>{l.label}</Link>)}
          <a href="#top">Nach oben ↑</a>
        </nav>
      </div>
      <p className="pl-fine">{COMPANY_LINE} · {TAX_NOTE}</p>
    </footer>
  );
}
