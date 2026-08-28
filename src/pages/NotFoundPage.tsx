import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Home } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { StartOnboarding } from './StartOnboarding';
import { OperateChannelsView } from '../features/operate/OperateChannelsView';

/**
 * Temporärer Alias, bis Claude Code die kanonischen Routen in App.tsx setzt.
 * /start und /app/channels dürfen nicht als 404 enden.
 */
export function NotFoundPage() {
  const { pathname } = useLocation();
  if (pathname === '/start') return <StartOnboarding />;
  if (pathname === '/app/channels') return <OperateChannelsView />;

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex flex-col items-center justify-center px-4">
      <SEOHead title="Seite nicht gefunden | RealSyncDynamics.AI" description="Diese Seite existiert nicht." noIndex />
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-titanium-600 mb-4">404</p>
      <h1 className="font-display font-bold text-3xl sm:text-4xl text-titanium-50 mb-3 text-center">
        Seite nicht gefunden
      </h1>
      <p className="text-titanium-400 text-sm mb-8 text-center max-w-sm">
        Diese URL existiert nicht. Möglicherweise wurde sie verschoben oder der Link ist veraltet.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-400 text-obsidian-950 font-semibold text-sm hover:bg-cyan-300 transition-colors"
        >
          <Home className="h-4 w-4" />
          Zur Startseite
        </Link>
        <Link
          to="/pricing"
          className="inline-flex items-center gap-2 px-5 py-2.5 border border-titanium-800 text-titanium-200 text-sm hover:border-titanium-600 transition-colors"
        >
          Preise ansehen <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to="/start"
          className="inline-flex items-center gap-2 px-5 py-2.5 border border-titanium-800 text-titanium-200 text-sm hover:border-titanium-600 transition-colors"
        >
          Betrieb einrichten <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
