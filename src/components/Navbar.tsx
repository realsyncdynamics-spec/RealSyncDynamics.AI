import { Menu, X, ArrowRight, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from './Logo';
import { CTA } from '../content/runtimeVocab';

// Kategorie-Navigation (max. 7 Punkte). Reihenfolge folgt der
// Enterprise-/Government-Lese-Logik: Was (Plattform) -> Warum
// (Compliance/Loesungen) -> Wie (Evidence) -> Warum vertrauenswuerdig
// (Security) -> Vertiefung (Ressourcen) -> Preise zuletzt.
// Alle Ziele verweisen auf bereits existierende Routen.
// Die "KI fragen"-Pill und der cyan "Run Scan"-CTA bleiben als
// Sekundaer-/Primaer-Aktion erhalten (Funnel + Analytics unangetastet).
const NAV_ITEMS = [
  { label: 'Plattform',  to: '/runtime' },
  { label: 'Lösungen',   to: '/branchen' },
  { label: 'Compliance', to: '/ai-act' },
  { label: 'Evidence',   to: '/evidence' },
  { label: 'Security',   to: '/trust' },
  { label: 'Ressourcen', to: '/ressourcen' },
  { label: 'Preise',     to: '/pricing' },
] as const;

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-obsidian-950/80 backdrop-blur-xl border-b border-titanium-900/60'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          <Link to="/" className="flex items-center hover:opacity-90 transition-opacity">
            <Logo size={26} />
          </Link>

          <div className="hidden lg:flex items-center space-x-6">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.to.split('?')[0];
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`text-sm font-medium tracking-tight transition-colors ${
                    active ? 'text-titanium-50' : 'text-titanium-400 hover:text-titanium-50'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              to="/audit?source=ki-fragen"
              data-ki-fragen-pill
              className="group relative inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold tracking-tight rounded-full text-violet-100 hover:text-white bg-gradient-to-br from-violet-500/10 via-fuchsia-500/10 to-violet-500/10 hover:from-violet-500/25 hover:via-fuchsia-500/25 hover:to-violet-500/25 backdrop-blur-sm hover:scale-[1.03] hover:shadow-[0_0_24px_-4px_rgba(168,85,247,0.45)] transition-all duration-200 motion-reduce:transition-none motion-reduce:hover:scale-100"
              style={{
                backgroundImage:
                  'linear-gradient(var(--ki-pill-bg, rgba(15,15,17,0.55)), var(--ki-pill-bg, rgba(15,15,17,0.55))), linear-gradient(135deg, #8b5cf6, #d946ef, #8b5cf6)',
                backgroundClip: 'padding-box, border-box',
                backgroundOrigin: 'border-box',
                border: '1px solid transparent',
              }}
            >
              <Sparkles className="h-3.5 w-3.5 text-violet-300 group-hover:text-fuchsia-200" />
              KI fragen
            </Link>
            <Link
              to="/audit?source=nav-activate"
              className="group inline-flex items-center gap-1.5 bg-cyan-400 text-obsidian-950 hover:bg-cyan-300 px-4 py-2 text-sm font-semibold tracking-tight rounded-none transition-colors"
            >
              {CTA.runScan}
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden text-titanium-300 hover:text-titanium-100"
            aria-label="Menü öffnen"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="lg:hidden bg-obsidian-950 border-b border-titanium-900">
          <div className="px-4 pt-2 pb-4 space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setIsOpen(false)}
                className="block px-3 py-3 text-base font-medium text-titanium-200 hover:bg-obsidian-900 rounded-none"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/audit?source=ki-fragen-mobile"
              onClick={() => setIsOpen(false)}
              data-ki-fragen-pill
              className="flex items-center gap-2 justify-center px-3 py-3 mt-2 text-base font-semibold rounded-full text-violet-100"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(15,15,17,0.55), rgba(15,15,17,0.55)), linear-gradient(135deg, #8b5cf6, #d946ef, #8b5cf6)',
                backgroundClip: 'padding-box, border-box',
                backgroundOrigin: 'border-box',
                border: '1px solid transparent',
              }}
            >
              <Sparkles className="h-4 w-4 text-violet-300" /> KI fragen
            </Link>
            <Link
              to="/audit?source=nav-activate-mobile"
              onClick={() => setIsOpen(false)}
              className="flex justify-between items-center px-3 py-3 mt-2 text-base font-semibold bg-cyan-400 text-obsidian-950 rounded-none"
            >
              {CTA.runScan} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
