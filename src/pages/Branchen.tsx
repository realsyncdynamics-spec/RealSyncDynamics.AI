import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, ShieldCheck } from 'lucide-react';
import { IdealCustomers } from '../components/IdealCustomers';

/**
 * /branchen — Industry-Profile-Übersicht.
 *
 * Vorher als 9-Tile-Grid auf der Startseite (IdealCustomers-Section). Wirkte
 * dort wie Feature-Dumping. Hier ist die Branchen-Tiefe der eigene Inhalt:
 * 9 Doorways, klare Compliance-Refs, Verlinkung zur Methodik. Wer regulierte
 * Industrie hat, findet die Seite über Footer + ClosingCta-Teaser.
 */
export function Branchen() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-obsidian-950" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Branchen</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-cyan-700/50 bg-cyan-950/20 text-cyan-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <ShieldCheck className="h-3 w-3" /> 9 Industry-Profile · Compliance-Pfade
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Branchen-spezifische Compliance-Doorways.
            </h1>
            <p className="text-lg text-titanium-300 leading-relaxed">
              Jede regulierte Branche hat eigene Bezugspunkte — von Annex III(3) (HealthTech) bis VAIT (Versicherer).
              Die Audit-Engine kennt sie. Wähle deine Branche, sieh die zutreffenden Norm-Refs.
            </p>
          </div>

          {/* Re-uses the existing 9-tile component as the page's main content */}
          <IdealCustomers />

          <div className="bg-obsidian-900 border border-titanium-900 border-l-2 border-l-cyan-700/60 rounded-none p-6 sm:p-8">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-3">
              Deine Branche fehlt?
            </h2>
            <p className="text-sm text-titanium-300 mb-5 leading-relaxed">
              Die 9 sichtbaren Profile sind die mit existierender Doorway-Page. Audit-Engine + Methodik
              sind branchen-agnostisch — auf Anfrage bauen wir custom Mappings für regulierte Sektoren
              (Banken, Energy, Logistik, eGovernment).
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link
                to="/contact-sales?source=branchen-custom"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none"
              >
                Custom-Mapping anfragen <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/legal/methodology"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none"
              >
                Methodik einsehen
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted</div>
          <div className="flex flex-wrap gap-3">
            <Link to="/legal/methodology" className="hover:text-titanium-300">Methodik</Link>
            <Link to="/security" className="hover:text-titanium-300">Security</Link>
            <Link to="/legal/sub-processors" className="hover:text-titanium-300">Sub-Processors</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
