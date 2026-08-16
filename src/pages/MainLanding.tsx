/**
 * Root landing: die historische 2026-05-15 Runtime-Landing (Obsidian/Cyan)
 * mit der geschärften Enterprise-Headline („AI Governance. Continuous by
 * design.", 9ec088e). Entscheidung vom 2026-08-16: diese Seite ist die live
 * Startseite; die Earth-at-Night-Variante liegt in der Git-History (5e000d6).
 *
 * Der Footer gehört nicht zur historischen Vorlage, ist aber Pflicht:
 * Impressum/Datenschutz müssen von jeder Seite erreichbar sein (§ 5 DDG).
 */
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { Landing1505 } from '../legacy-landing-1505/Landing';

export function MainLanding() {
  return (
    <>
      <SEOHead
        title="RealSyncDynamics.AI — KI-Governance für DSGVO, EU AI Act & Code"
        description="AI Governance. Continuous by design. RealSyncDynamics.AI erkennt, was Ihre KI-Systeme, Websites und Datenflüsse tun — und macht daraus kontinuierliche Governance mit auditfähiger Evidence."
        canonical="/"
        ogTitle="AI Governance. Continuous by design."
        ogDescription="Discover what your AI systems, website and data flows are doing — then continuously detect drift, govern risk and produce audit-ready evidence from one operational runtime."
      />
      <Landing1505 />
      <footer className="border-t border-titanium-900 bg-obsidian-950 py-8">
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-between gap-4 px-4 font-mono text-[11px] text-titanium-500 sm:flex-row sm:px-6 lg:px-8">
          <span>© 2026 RealSync Dynamics.AI</span>
          <div className="flex gap-5">
            <Link to="/impressum" className="hover:text-titanium-200 transition-colors">Impressum</Link>
            <Link to="/datenschutz" className="hover:text-titanium-200 transition-colors">Datenschutz</Link>
            <Link to="/agb" className="hover:text-titanium-200 transition-colors">AGB</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
