// Übernahme: anonymer Entwurf → Projekt im Workspace.
//
// Der Punkt, an dem aus „angesehen" „besessen" wird. Bis hierher lag der
// Entwurf im Browser des Besuchers und gehörte niemandem. Ab hier hat er
// einen Mandanten, eine Version, einen Hash und einen Eintrag im Prüfpfad.
//
// ## Was übertragen wird
//
// Prompt und Anweisungsfolge — nicht der Blueprint. Der Server baut ihn mit
// demselben Kern erneut. Das ist kein Umweg: Käme die Struktur aus dem
// Browser, käme mit ihr das Compliance-Profil aus einer Quelle, die der
// Nutzer bearbeiten kann. Die ausführliche Begründung steht am Endpunkt.
//
// ## Warum die Anmeldung hier und nicht früher steht
//
// Bauen und Ansehen brauchen kein Konto (siehe `BuildStudioPage`). Erst
// Speichern, Weiterbearbeiten und Veröffentlichen brauchen einen Besitzer.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Check, Loader2 } from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { useSupabaseAuth } from '../supabase/SupabaseAuthContext';
import { buildSite, errorMessage } from './siteOsApi';
import { clearBuildSession, loadBuildSession, refinementList, type BuildSession } from './buildSession';

type Phase = 'idle' | 'claiming' | 'done' | 'empty' | 'failed';

export function SiteOsClaimView() {
  const navigate = useNavigate();
  const { activeTenantId } = useTenant();
  const { isAuthenticated, isLoading } = useSupabaseAuth();

  const [session, setSession] = useState<BuildSession | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [slug, setSlug] = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      // Zurück an genau diese Stelle — der Entwurf liegt weiterhin lokal.
      navigate(`/welcome?next=${encodeURIComponent('/app/siteos/claim')}`, { replace: true });
      return;
    }
    const stored = loadBuildSession();
    if (!stored) setPhase('empty');
    setSession(stored);
  }, [isAuthenticated, isLoading, navigate]);

  const claim = useCallback(async () => {
    if (!session || !activeTenantId) return;
    setPhase('claiming');
    setError('');
    try {
      const result = await buildSite({
        tenant_id: activeTenantId,
        prompt: session.prompt,
        locale: 'de',
        enrichment: session.brand ? { name: session.brand } : undefined,
        refinements: refinementList(session),
      });
      if (result.kind !== 'ok') throw new Error(errorMessage(result));

      setSlug(result.data.slug);
      // Erst nach bestätigter Persistenz löschen. Andernfalls wäre der
      // Entwurf bei einem Fehler auf beiden Seiten weg.
      clearBuildSession();
      setPhase('done');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Der Entwurf konnte nicht übernommen werden.');
      setPhase('failed');
    }
  }, [activeTenantId, session]);

  if (isLoading || !isAuthenticated) {
    return <Shell><div className="flex items-center gap-3 text-titanium-400"><Loader2 size={18} className="animate-spin" /> Anmeldung wird geprüft …</div></Shell>;
  }

  if (phase === 'empty' || !session) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">Kein Entwurf gefunden</h1>
        <p className="mt-3 text-sm leading-6 text-titanium-400">
          In diesem Browser liegt kein Website-Entwurf. Entwürfe werden vor der Anmeldung
          bewusst nur lokal gehalten — sie überstehen keinen Gerätewechsel und kein
          privates Fenster.
        </p>
        <button
          type="button"
          onClick={() => navigate('/build')}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-petrol-600 px-5 py-3 text-sm font-semibold text-white hover:bg-petrol-700"
        >
          Website erstellen <ArrowRight size={15} />
        </button>
      </Shell>
    );
  }

  if (phase === 'done') {
    return (
      <Shell>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-petrol-700 px-3 py-1 text-xs text-petrol-400">
          <Check size={13} /> Übernommen
        </div>
        <h1 className="text-2xl font-bold">Die Website gehört jetzt Ihrem Workspace</h1>
        <p className="mt-3 text-sm leading-6 text-titanium-400">
          Der Entwurf <span className="font-mono text-titanium-200">{slug}</span> ist als Version 1
          gespeichert, kanonisch gehasht und im Prüfpfad vermerkt. Domain und Veröffentlichung
          folgen im Projekt.
        </p>
        <button
          type="button"
          onClick={() => navigate('/app/siteos')}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-petrol-600 px-5 py-3 text-sm font-semibold text-white hover:bg-petrol-700"
        >
          Zum Projekt <ArrowRight size={15} />
        </button>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-2xl font-bold">Website übernehmen</h1>
      <p className="mt-3 text-sm leading-6 text-titanium-400">
        Ihr Entwurf wird Ihrem Workspace zugeordnet, versioniert und geprüft. Dabei werden Ihre
        Beschreibung und Ihre {session.steps.length} Änderung{session.steps.length === 1 ? '' : 'en'}
        {' '}erneut ausgeführt — das Ergebnis entspricht dem, was Sie in der Vorschau gesehen haben.
      </p>

      <div className="mt-6 rounded-xl border border-titanium-800 p-4">
        <div className="text-[10px] font-bold uppercase tracking-[.16em] text-titanium-500">Beschreibung</div>
        <p className="mt-2 text-sm leading-6 text-titanium-300">{session.prompt}</p>
        {session.steps.length > 0 && (
          <>
            <div className="mt-4 text-[10px] font-bold uppercase tracking-[.16em] text-titanium-500">Änderungen</div>
            <ul className="mt-2 space-y-1 text-xs text-titanium-400">
              {session.steps.map((step) => <li key={step.at}>· {step.instruction}</li>)}
            </ul>
          </>
        )}
      </div>

      {!activeTenantId && (
        <div className="mt-4 flex gap-2 rounded-lg border border-amber-700 bg-amber-900/20 p-3 text-xs text-amber-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Es ist noch kein Workspace aktiv. Ohne Workspace gibt es keinen Mandanten, dem die
          Website gehören könnte.
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-700 bg-red-900/20 p-3 text-xs text-red-300">{error}</div>
      )}

      <button
        type="button"
        onClick={() => void claim()}
        disabled={phase === 'claiming' || !activeTenantId}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-petrol-600 px-5 py-3 text-sm font-semibold text-white hover:bg-petrol-700 disabled:opacity-40"
      >
        {phase === 'claiming' ? <><Loader2 size={15} className="animate-spin" /> Wird übernommen …</> : <>Jetzt übernehmen <ArrowRight size={15} /></>}
      </button>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-obsidian-950 px-6 py-16 text-titanium-50">
      <div className="mx-auto max-w-2xl">{children}</div>
    </main>
  );
}

export default SiteOsClaimView;
