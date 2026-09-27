import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { isGovernanceAiEnabled } from '../../../config/featureFlags';
import { useLang } from '../../../i18n/useLang';

/**
 * Route-Element für `/app/assistant`.
 *
 * Solange `isGovernanceAiEnabled()` false ist, rendern wir nur einen
 * neutralen Hinweis. `GovernanceAiWorkspace` wird dann weder gemountet noch
 * geladen (eigener Lazy-Chunk), es gehen also keine `ai-gateway`-Aufrufe
 * raus. Siehe `src/config/featureFlags.ts`.
 */
const GovernanceAiWorkspace = lazy(() =>
  import('./GovernanceAiWorkspace').then((m) => ({ default: m.GovernanceAiWorkspace })),
);

const COPY = {
  de: {
    title: 'Governance AI ist vorübergehend nicht verfügbar.',
    body: 'Wir sichern den Zugang gerade zusätzlich ab.',
    back: 'Zum Dashboard',
  },
  en: {
    title: 'Governance AI is temporarily unavailable.',
    body: 'We are currently adding extra protection to access.',
    back: 'Back to the dashboard',
  },
} as const;

export function GovernanceAiUnavailable() {
  const { lang } = useLang();
  const copy = COPY[lang] ?? COPY.de;
  return (
    <main
      className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center px-4"
      data-testid="governance-ai-unavailable"
    >
      <section role="status" className="max-w-md w-full border border-titanium-800 bg-obsidian-900 p-6">
        <ShieldCheck className="h-6 w-6 text-security-400" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold text-titanium-50">{copy.title}</h1>
        <p className="mt-2 text-sm text-titanium-400">{copy.body}</p>
        <Link
          to="/app/dashboard"
          className="mt-5 inline-flex items-center border border-titanium-700 px-4 py-2 text-sm text-titanium-100 hover:bg-obsidian-800"
        >
          {copy.back}
        </Link>
      </section>
    </main>
  );
}

export function GovernanceAiRoute() {
  if (!isGovernanceAiEnabled()) return <GovernanceAiUnavailable />;
  return (
    <Suspense fallback={null}>
      <GovernanceAiWorkspace />
    </Suspense>
  );
}
