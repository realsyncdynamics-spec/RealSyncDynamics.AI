/**
 * FlowStepRoute — dynamische Route `/flow/*`.
 *
 * Liest den Slug aus der URL (auch verschachtelt, z. B. `checkout/starter`),
 * schlägt den zugehörigen Flow-Step nach und rendert die FlowStepPage. Ist der
 * Slug unbekannt, wird eine erklärte „nicht gefunden“-Seite mit Weg zurück in
 * den Flow angezeigt (keine Sackgasse).
 */
import { Link, useParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { FlowStepPage } from './FlowStepPage';
import { getFlowStepBySlug } from './flowRoutes';

export function FlowStepRoute() {
  const params = useParams();
  // `*` fängt den kompletten Rest hinter `/flow/` (inkl. Slash) ein.
  const slug = (params['*'] ?? '').replace(/^\/+|\/+$/g, '');
  const step = getFlowStepBySlug(slug);

  if (!step) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100">
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 pt-32 pb-16 text-center sm:px-6">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-security-blue">
            Flow-Schritt nicht gefunden
          </div>
          <h1 className="text-3xl font-display font-semibold tracking-tight text-titanium-50">
            Dieser Schritt existiert nicht
          </h1>
          <p className="mx-auto mt-4 max-w-md text-titanium-300">
            Der aufgerufene Flow-Schritt „{slug || '—'}“ ist nicht definiert. Starte
            den geführten Ablauf erneut oder gehe zur Startseite.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/flow/start-scan"
              className="inline-flex items-center justify-center gap-2 bg-security-blue px-6 py-3 font-mono text-sm font-bold uppercase tracking-widest text-obsidian transition-colors hover:bg-blue-600"
            >
              Ablauf starten
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 border-2 border-titanium-700 px-6 py-3 font-mono text-sm font-bold uppercase tracking-widest text-titanium-200 transition-colors hover:border-titanium-400"
            >
              Zur Startseite
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return <FlowStepPage step={step} />;
}
