import { Link } from 'react-router-dom';
import { Heart, Scale, Briefcase, Building2, ShieldAlert, ShoppingCart, Server, GraduationCap, Users } from 'lucide-react';

/**
 * IdealCustomers — ehrliche Alternative zu Customer-Logo-Bar.
 *
 * Pre-Launch-Phase: noch keine Pilot-Kunden mit Logo-Rechten.
 * Statt Fake-Logos zeigen wir die 9 Industry-Profile, die wir bedienen,
 * mit klaren Doorway-Links. Das positioniert uns als Plattform, nicht
 * als Tool, und respektiert die Trust-by-Transparency-Prinzip.
 *
 * Sobald 3+ Pilot-Kunden onboarded sind: Component umstellen auf
 * echte Logo-Bar (PilotCohort).
 */

const PROFILES = [
  { Icon: Heart, label: 'HealthTech', sub: 'AI Act High-Risk', to: '/healthtech' },
  { Icon: Scale, label: 'Legal-Tech', sub: '§ 203 StGB', to: '/legal-tech' },
  { Icon: Briefcase, label: 'FinTech', sub: 'BAIT · MaRisk', to: '/fintech' },
  { Icon: Building2, label: 'Public Sector', sub: 'OZG · BFSG', to: '/oeffentliche-verwaltung' },
  { Icon: ShieldAlert, label: 'Versicherer', sub: 'VAIT · Solvency II', to: '/versicherungen' },
  { Icon: ShoppingCart, label: 'eCommerce', sub: 'GTM Consent v2', to: '/ecommerce' },
  { Icon: Server, label: 'B2B-SaaS', sub: 'Auftragsverarbeitung Art. 28', to: '/saas-anbieter' },
  { Icon: GraduationCap, label: 'Bildung', sub: 'Annex III(3)', to: '/bildung' },
  { Icon: Users, label: 'HR-Software', sub: 'Annex III(4)', to: '/hr-software' },
];

export function IdealCustomers() {
  return (
    <section className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 border-y border-titanium-900/60">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-titanium-500">
            Eingesetzt in regulierten Industrien
          </div>
          <h2 className="mt-3 font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50">
            9 Industry-Profile mit eigenen Compliance-Pfaden.
          </h2>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-9 gap-px bg-titanium-900">
          {PROFILES.map((p) => (
            <Link
              key={p.label}
              to={p.to}
              className="group bg-obsidian-950 hover:bg-obsidian-900 transition-colors p-4 sm:p-5 text-center"
            >
              <p.Icon className="h-5 w-5 mx-auto text-titanium-400 group-hover:text-indigo-400 transition-colors" strokeWidth={1.5} />
              <div className="mt-3 font-display font-bold text-titanium-100 text-xs sm:text-sm">
                {p.label}
              </div>
              <div className="mt-1 text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.12em] text-titanium-500 truncate">
                {p.sub}
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-titanium-500">
          Pilot-Cohort 2026 onboarding · Pilot-Kunde werden über{' '}
          <Link to="/contact-sales?source=ideal-customers" className="text-titanium-300 hover:text-titanium-100 underline-offset-4 hover:underline">
            AI-Agent-Onboarding
          </Link>
        </p>
      </div>
    </section>
  );
}
