import { Menu, X, ChevronRight, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from './Logo';

const NAV_ITEMS = [
  { label: 'Produkt', to: '/tools' },
  { label: 'Compliance-Center', to: '/legal/methodology' },
  { label: 'Preise', to: '/pricing' },
  { label: 'Enterprise', to: '/contact-sales?intent=enterprise' },
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

          <div className="hidden md:flex items-center space-x-8">
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
              to="/audit?source=nav-ki-fragen"
              data-ai-pill
              className="group inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold tracking-tight rounded-full text-titanium-50 bg-obsidian-900/60 border border-transparent [background-clip:padding-box] relative transition-colors hover:bg-obsidian-800/80"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(11,11,15,0.85), rgba(11,11,15,0.85)), linear-gradient(120deg, #a855f7 0%, #22d3ee 50%, #a855f7 100%)',
                backgroundOrigin: 'border-box',
                border: '1px solid transparent',
              }}
            >
              <Sparkles className="h-3.5 w-3.5 text-violet-300" />
              KI fragen
            </Link>
            <Link
              to="/audit"
              className="group inline-flex items-center gap-1.5 bg-white text-obsidian-950 hover:bg-titanium-200 px-4 py-2 text-sm font-semibold tracking-tight rounded-none transition-colors"
            >
              Audit starten
              <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-titanium-300 hover:text-titanium-100"
            aria-label="Menü öffnen"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden bg-obsidian-950 border-b border-titanium-900">
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
              to="/audit?source=nav-ki-fragen-mobile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-3 py-3 mt-2 text-base font-semibold text-titanium-50 rounded-full"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(11,11,15,0.9), rgba(11,11,15,0.9)), linear-gradient(120deg, #a855f7 0%, #22d3ee 50%, #a855f7 100%)',
                backgroundOrigin: 'border-box',
                border: '1px solid transparent',
              }}
            >
              <Sparkles className="h-4 w-4 text-violet-300" /> KI fragen
            </Link>
            <Link
              to="/audit"
              onClick={() => setIsOpen(false)}
              className="flex justify-between items-center px-3 py-3 mt-2 text-base font-semibold bg-white text-obsidian-950 rounded-none"
            >
              Audit starten <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
