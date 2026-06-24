import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

export function FunnelFooter() {
  return (
    <footer className="border-t border-titanium-800 bg-obsidian-950 mt-12">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
            <ShieldCheck className="h-3.5 w-3.5 text-security-400" />
            <span>EU-entwickelt, DSGVO-konform</span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-mono uppercase tracking-wider">
            <Link to="/impressum" className="text-titanium-400 hover:text-titanium-100 transition-colors">
              Impressum
            </Link>
            <Link to="/datenschutz" className="text-titanium-400 hover:text-titanium-100 transition-colors">
              Datenschutz
            </Link>
            <Link to="/agb" className="text-titanium-400 hover:text-titanium-100 transition-colors">
              AGB
            </Link>
            <Link to="/sicherheit" className="text-titanium-400 hover:text-titanium-100 transition-colors">
              Sicherheit
            </Link>
          </div>
        </div>

        <div className="mt-6 border-t border-titanium-800 pt-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-600">
            © {new Date().getFullYear()} RealSync Dynamics.AI — Alle Rechte vorbehalten.
          </p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-600">
            Made & hosted in the European Union
          </p>
        </div>
      </div>
    </footer>
  );
}
