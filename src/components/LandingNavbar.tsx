import { Menu, X, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from './Logo';
import { CTA } from '../content/runtimeVocab';

// Anker-Navigation innerhalb der kanonischen Single-Page-Landing ("/").
// Kein „30-Seiten-Springen" mehr — die Nav scrollt zu den Abschnitten der
// Startseite; nur „Login" verlässt die Seite Richtung Auth-Onboarding.
const NAV_ITEMS = [
  { label: 'Funktionen',       to: '/#funktionen' },
  { label: 'Automation Skills', to: '/#automation' },
  { label: 'Preise',           to: '/#preise' },
  { label: 'FAQ',              to: '/#faq' },
  { label: 'Login',            to: '/login' },
] as const;

export function LandingNavbar() {
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
          ? 'bg-white/90 backdrop-blur-xl border-b border-slate-200'
          : 'bg-white border-b border-slate-100'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          <Link to="/" className="inline-flex items-center gap-2.5 hover:opacity-80 transition-opacity select-none">
            <Logo size={26} iconOnly />
            <span className="font-display font-bold text-base tracking-tight">
              <span className="text-slate-900">RealSync</span>
              <span className="font-medium text-slate-400 ml-0.5">Dynamics.AI</span>
            </span>
          </Link>

          <div className="hidden lg:flex items-center space-x-6">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.to.split('?')[0];
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`text-sm font-medium tracking-tight transition-colors ${
                    active ? 'text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              to="/audit?source=nav-activate"
              className="group inline-flex items-center gap-1.5 rounded-chip bg-petrol-700 text-white hover:bg-petrol-600 px-4 py-2 text-sm font-semibold tracking-tight transition-colors"
            >
              {CTA.startFree}
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden text-slate-500 hover:text-slate-900"
            aria-label="Menü öffnen"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="lg:hidden bg-white border-b border-slate-100">
          <div className="px-4 pt-2 pb-4 space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setIsOpen(false)}
                className="block px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-50"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/audit?source=nav-activate-mobile"
              onClick={() => setIsOpen(false)}
              className="flex justify-between items-center px-3 py-3 mt-2 text-base font-semibold rounded-chip bg-petrol-700 text-white"
            >
              {CTA.startFree} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
