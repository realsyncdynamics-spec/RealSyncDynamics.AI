import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { ProductTiles } from '../components/landing/company/ProductTiles';
import { CompanyContactForm } from '../components/landing/company/CompanyContactForm';

/**
 * /unternehmen — Unternehmens-Landing v5 (GERÜST, noindex).
 *
 * Stand 02.11.2026: Der Design-Handoff `design_handoff_realsync_landing_v5/`
 * (README, Referenz-HTML, vorlagen.json, Classical-Tokens, Texturen) liegt noch
 * nicht im Repo. Deshalb hier nur die designunabhängigen Bausteine:
 * Produkt-Tafeln + barrierefreies Modal, Kontaktformular (sales-lead).
 * Offen bis Handoff: StatusBar, CompanyBand, HeroScene (three.js), Vorlagen-Karten,
 * Gold-Akzent (Owner-Freigabe nötig, AGENTS.md: Security-Blue).
 * `/` bleibt LandingV6.
 */
export function CompanyLanding() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      {/* Meta + noindex aus SEO_CONFIG['/unternehmen'] (src/config/seo.ts). */}
      <SEOHead />
      <header className="border-b border-obsidian-600">
        <nav aria-label="Hauptnavigation" className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="font-display text-sm font-bold tracking-wide text-titanium-50">
            RealSync Dynamics AI
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <a href="#produkte" className="text-titanium-300 hover:text-titanium-50">Produkte</a>
            <a href="#kontakt" className="text-titanium-300 hover:text-titanium-50">Kontakt</a>
            <Link to="/login" className="text-titanium-300 hover:text-titanium-50">Anmelden</Link>
          </div>
        </nav>
      </header>

      <main>
        <section aria-labelledby="hero-title" className="mx-auto max-w-6xl px-4 py-20">
          <p className="font-mono text-xs uppercase tracking-widest text-titanium-400">Unternehmen</p>
          <h1 id="hero-title" className="mt-3 max-w-3xl font-display text-4xl font-bold text-titanium-50 md:text-5xl">
            KI-Mitarbeiter mit eingebauter Governance
          </h1>
          <p className="mt-4 max-w-2xl text-titanium-300">
            Für kleine und mittlere Unternehmen mit Kundenkontakt, zuerst im Handwerk.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/audit"
              className="rounded-none border border-security-400 bg-security-400/10 px-5 py-2 text-sm font-semibold text-titanium-50 hover:bg-security-400/20"
            >
              Kostenlos prüfen
            </Link>
            <a
              href="#produkte"
              className="rounded-none border border-obsidian-600 px-5 py-2 text-sm font-semibold text-titanium-200 hover:border-titanium-300"
            >
              Funktionen entdecken
            </a>
          </div>
        </section>

        <ProductTiles />

        <section id="kontakt" aria-labelledby="kontakt-title" className="mx-auto max-w-3xl px-4 py-16">
          <p className="font-mono text-xs uppercase tracking-widest text-titanium-400">Kontakt</p>
          <h2 id="kontakt-title" className="mt-2 font-display text-3xl font-bold text-titanium-50">
            Schreiben Sie uns
          </h2>
          <div className="mt-6">
            <CompanyContactForm />
          </div>
        </section>
      </main>

      <footer className="border-t border-obsidian-600">
        <nav aria-label="Rechtliches" className="mx-auto flex max-w-6xl flex-wrap gap-4 px-4 py-6 font-mono text-xs text-titanium-400">
          <Link to="/impressum" className="hover:text-titanium-100">Impressum</Link>
          <Link to="/datenschutz" className="hover:text-titanium-100">Datenschutz</Link>
          <Link to="/agb" className="hover:text-titanium-100">AGB</Link>
          <Link to="/widerruf" className="hover:text-titanium-100">Widerruf</Link>
          <Link to="/kontakt" className="hover:text-titanium-100">Kontakt</Link>
        </nav>
      </footer>
    </div>
  );
}
