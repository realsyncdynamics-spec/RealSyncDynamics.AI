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
//
// ## Freigabebewertung direkt nach der Übernahme
//
// Sobald die Site einem Mandanten gehört, wird sie gegen den Publish Gate
// bewertet (Zielarchitektur §7). Das passiert hier und nicht erst beim
// Veröffentlichen: Wer erst am Publish-Knopf erfährt, dass eine
// Datenschutz-Folgenabschätzung fehlt, hat die Arbeit schon getan.
//
// Angezeigt wird ausschließlich, was der Server geliefert hat — `publishable`
// und die Begründung. Regel G2 verbietet, das Ergebnis aus Einzelfeldern
// nachzurechnen: Zwei Ableitungswege driften, und im Zweifel gewinnt der
// falsche. Hier steht deshalb kein `&&` über den Contract-Feldern.
//
// Die Bewertung meldet `greenfield` — bei einer aus einer Beschreibung
// gebauten Site gibt es beweisbar keine Vorgängerseite, an der etwas
// verlorengehen könnte. Für eine Transformation wäre das falsch; dort
// gehört der tatsächlich durchgeführte Vergleich in die Anfrage.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Check, Loader2, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { useSupabaseAuth } from '../supabase/SupabaseAuthContext';
import { buildSite, errorMessage, evaluatePublish } from './siteOsApi';
import type { PublishGateEvaluation } from '../../../packages/siteos-core/src/index';
import { clearBuildSession, loadBuildSession, refinementList, type BuildSession } from './buildSession';

type Phase = 'idle' | 'claiming' | 'evaluating' | 'done' | 'empty' | 'failed';

export function SiteOsClaimView() {
  const navigate = useNavigate();
  const { activeTenantId } = useTenant();
  const { isAuthenticated, isLoading } = useSupabaseAuth();

  const [session, setSession] = useState<BuildSession | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [slug, setSlug] = useState('');
  const [evaluation, setEvaluation] = useState<PublishGateEvaluation | null>(null);
  // Getrennt vom allgemeinen Fehler: Eine fehlende Bewertung macht die
  // Übernahme nicht rückgängig. Sie ist ein eigener Befund, kein Abbruch.
  const [gateNote, setGateNote] = useState('');

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

      // Bewertung anschließen. Sie darf die Übernahme nicht gefährden —
      // die Site gehört dem Mandanten ab dem erfolgreichen Build, nicht
      // ab einer bestandenen Prüfung.
      const blueprintId = result.data.blueprint_id;
      if (blueprintId) {
        setPhase('evaluating');
        const gate = await evaluatePublish({
          tenant_id: activeTenantId,
          blueprint_id: blueprintId,
          backend: { kind: 'greenfield' },
        });
        if (gate.kind === 'ok') {
          setEvaluation(gate.data.evaluation);
        } else if (gate.kind === 'not_deployed') {
          setGateNote('Die Freigabeprüfung ist noch nicht ausgerollt. Ihre Website ist gespeichert; die Bewertung wird nachgeholt, sobald der Endpunkt läuft.');
        } else {
          setGateNote(`Die Freigabeprüfung konnte nicht durchgeführt werden: ${errorMessage(gate)}`);
        }
      } else {
        setGateNote('Diese Beschreibung ergab denselben Stand wie zuvor — es wurde keine neue Version angelegt und daher nichts neu bewertet.');
      }

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
          gespeichert, kanonisch gehasht und im Prüfpfad vermerkt.
        </p>

        {evaluation && <GateResult evaluation={evaluation} />}

        {gateNote && (
          <div className="mt-6 flex gap-2 rounded-xl border border-titanium-800 p-4 text-xs leading-6 text-titanium-400">
            <AlertTriangle size={14} className="mt-1 shrink-0 text-amber-400" />
            {gateNote}
          </div>
        )}
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
        disabled={phase === 'claiming' || phase === 'evaluating' || !activeTenantId}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-petrol-600 px-5 py-3 text-sm font-semibold text-white hover:bg-petrol-700 disabled:opacity-40"
      >
        {phase === 'claiming' ? <><Loader2 size={15} className="animate-spin" /> Wird übernommen …</>
          : phase === 'evaluating' ? <><Loader2 size={15} className="animate-spin" /> Freigabe wird geprüft …</>
          : <>Jetzt übernehmen <ArrowRight size={15} /></>}
      </button>
    </Shell>
  );
}

/**
 * Ergebnis des Publish Gates.
 *
 * Regel G2: Hier wird **gerendert**, nicht abgeleitet. `publishable` kommt
 * vom Server; die Felder darunter erklären es, sie bestimmen es nicht. Ein
 * `evaluation.status === 'passed' && …` an dieser Stelle wäre der zweite
 * Ableitungsweg, den der Contract ausschließt.
 */
function GateResult({ evaluation }: { evaluation: PublishGateEvaluation }) {
  const tone = evaluation.publishable
    ? { border: 'border-emerald-800', text: 'text-emerald-400', Icon: ShieldCheck, label: 'Freigegeben' }
    : evaluation.status === 'pending'
      ? { border: 'border-amber-800', text: 'text-amber-400', Icon: Clock, label: 'Freigabe erforderlich' }
      : { border: 'border-red-800', text: 'text-red-400', Icon: ShieldAlert, label: 'Gesperrt' };

  return (
    <div className={`mt-6 rounded-xl border ${tone.border} p-4`}>
      <div className={`flex items-center gap-2 text-sm font-bold ${tone.text}`}>
        <tone.Icon size={16} /> {tone.label}
      </div>

      <p className="mt-2 text-xs leading-6 text-titanium-400">
        {evaluation.publishable
          ? 'Diese Fassung darf veröffentlicht werden, sobald der Veröffentlichungspfad bereitsteht.'
          : evaluation.status === 'pending'
            ? 'Eine verantwortliche Person muss entscheiden, bevor veröffentlicht werden darf.'
            : 'Diese Fassung darf nicht veröffentlicht werden.'}
      </p>

      {evaluation.blockers.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-xs leading-6 text-titanium-300">
          {evaluation.blockers.map((blocker) => (
            <li key={blocker} className="flex gap-2">
              <span className={tone.text}>·</span> {blocker}
            </li>
          ))}
        </ul>
      )}

      {evaluation.warnings.length > 0 && (
        <ul className="mt-3 space-y-1 text-[11px] leading-5 text-titanium-500">
          {evaluation.warnings.map((warning) => <li key={warning}>Hinweis: {warning}</li>)}
        </ul>
      )}

      {/* Der Anker aus G5 — ohne ihn liesse sich später nicht belegen,
          welche Bewertung eine Veröffentlichung getragen hat. */}
      <div className="mt-4 border-t border-titanium-800 pt-3 font-mono text-[10px] text-titanium-600">
        Bewertung {evaluation.evaluation_id.slice(0, 8)} · Artefakt {evaluation.artifact_sha256.slice(0, 12)}…
      </div>
    </div>
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
