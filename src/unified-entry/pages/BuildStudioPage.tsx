// Build Studio — Prompt → vollständige Website → Live-Vorschau, ohne Konto.
//
// Diese Seite dreht die bisherige Reihenfolge des Trichters um. Vorher:
// Scan → Entscheidung → Konto → Builder. Der Account stand damit vor dem
// Ergebnis, und was der Besucher bis dahin sah, war ein Musterlayout.
//
// Jetzt: Idee → Bau → vollständige Vorschau → Konto → Übernahme. Das Konto
// wird gebraucht, sobald jemand das Ergebnis besitzen, weiterbearbeiten oder
// veröffentlichen will — nicht, um es zu sehen.
//
// ## Was hier echt ist
//
// Die Vorschau ist kein Mockup. Sie zeigt das Dokument, das später
// ausgeliefert wird: `packages/siteos-core` erzeugt Blueprint und HTML, im
// Browser, ohne Netzzugriff und ohne Modellaufruf. Was im Rahmen steht, ist
// dieselbe Datei, die `renderSite` auch im Deploy-Artefakt erzeugt.
//
// ## Was hier bewusst nicht passiert
//
// Kein Domain-Anschluss, keine Veröffentlichung, kein Deployment. Beides
// gehört hinter Übernahme und Publish Gate (siehe
// `docs/architecture/target-architecture.md`). Die Oberfläche verspricht es
// deshalb auch nicht.
//
// ## Sandbox
//
// Der Rahmen läuft mit leerem `sandbox`-Attribut: kein Skript, kein
// gemeinsamer Ursprung, kein Formularversand, keine Navigation. Das erzeugte
// Dokument enthält ohnehin kein Skript — aber die Vorschau darf sich nicht
// darauf verlassen, dass das so bleibt.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, Check, Loader2, Monitor, Smartphone, Sparkles, Tablet, Wand2, ShieldCheck, AlertTriangle,
} from 'lucide-react';
import {
  renderSite,
  type RuntimeFinding,
  type ScoreBreakdown,
  type SiteBlueprint,
} from '../../../packages/siteos-core/src/index';
import {
  appendInstruction,
  clearBuildSession,
  loadBuildSession,
  newBuildSession,
  runBuildSession,
  saveBuildSession,
  type BuildSession,
  type BuildStep,
} from '../../features/siteos/buildSession';

type Device = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTH: Record<Device, string> = { desktop: '100%', tablet: '834px', mobile: '390px' };

/** Beispiele, die den Kern tatsächlich erkennt (Branche, Ort, Leistungen). */
const EXAMPLES: readonly string[] = [
  'Hochwertige Website für ein Architekturbüro in Leipzig. Dunkel, minimalistisch, viel Weißraum. Projekte, Team, Kontaktformular und Terminbuchung.',
  'Website für eine Zahnarztpraxis in Hamburg mit Prophylaxe, Implantologie und Online-Terminbuchung.',
  'Kanzlei für Arbeitsrecht in Köln — seriös, klare Leistungen, Kontaktformular.',
  'Handwerksbetrieb für Elektroinstallation in Kassel mit Referenzen und Anfahrtskarte.',
];

/** Schnellanweisungen. Jede davon versteht `refineBlueprint` tatsächlich. */
const QUICK_ACTIONS: readonly string[] = [
  'Mach das Farbschema dunkel.',
  'Die Ecken bitte runder.',
  'Nimm grün als Akzentfarbe.',
  'Mach den Hero größer.',
  'Füge ein Kontaktformular hinzu.',
  'Füge eine Referenzseite hinzu.',
];

export default function BuildStudioPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [session, setSession] = useState<BuildSession | null>(null);
  const [blueprint, setBlueprint] = useState<SiteBlueprint | null>(null);
  const [findings, setFindings] = useState<RuntimeFinding[]>([]);
  const [scores, setScores] = useState<ScoreBreakdown | null>(null);
  const [hash, setHash] = useState('');

  const [draft, setDraft] = useState(params.get('prompt') ?? '');
  const [brand, setBrand] = useState('');
  const [instruction, setInstruction] = useState('');
  const [device, setDevice] = useState<Device>('desktop');
  const [path, setPath] = useState('/');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [log, setLog] = useState<BuildStep[]>([]);
  const [error, setError] = useState('');

  const startedRef = useRef(false);

  const run = useCallback(async (next: BuildSession) => {
    setBusy(true);
    setError('');
    setStage(0);
    try {
      const outcome = await runBuildSession(next);
      setSession(outcome.session);
      setBlueprint(outcome.blueprint);
      setFindings(outcome.findings);
      setScores(outcome.scores);
      setHash(outcome.blueprintSha256);
      setPath((current) => (outcome.blueprint.pages.some((p) => p.path === current) ? current : '/'));
      saveBuildSession(outcome.session);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Die Website konnte nicht erzeugt werden.');
    } finally {
      setBusy(false);
    }
  }, []);

  // Vorhandene Sitzung oder ?prompt= aufnehmen — einmal, nicht bei jedem Render.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const fromUrl = params.get('prompt')?.trim();
    if (fromUrl) {
      void run(newBuildSession(fromUrl));
      return;
    }
    const stored = loadBuildSession();
    if (stored) void run(stored);
  }, [params, run]);

  // Fortschrittszeilen laufen nur, solange gebaut wird. Sie behaupten keinen
  // Arbeitsschritt, den es nicht gibt — die Zusammenfassung darunter nennt
  // hinterher die tatsächlichen Zahlen.
  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length)), 260);
    return () => window.clearInterval(timer);
  }, [busy]);

  const html = useMemo(() => {
    if (!blueprint) return '';
    const pages = renderSite(blueprint, { presentation: 'showcase' });
    return pages.find((page) => page.path === path)?.html ?? pages[0]?.html ?? '';
  }, [blueprint, path]);

  const submitPrompt = (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (text.length < 10) {
      setError('Bitte beschreiben Sie in einem Satz, was entstehen soll.');
      return;
    }
    setLog([]);
    void run(newBuildSession(text, brand));
  };

  const applyInstruction = (text: string) => {
    if (!session || !blueprint) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const { session: next, step } = appendInstruction(session, trimmed, blueprint);
    setLog((entries) => [step, ...entries].slice(0, 12));
    setInstruction('');
    if (step.changes.length === 0) {
      // Nichts geändert — das wird gesagt, nicht durch einen neuen Ladebalken
      // überdeckt.
      saveBuildSession(next);
      setSession(next);
      return;
    }
    void run(next);
  };

  const restart = () => {
    clearBuildSession();
    setSession(null);
    setBlueprint(null);
    setFindings([]);
    setScores(null);
    setLog([]);
    setDraft('');
  };

  // ── Einstieg: Prompt ────────────────────────────────────────────────
  if (!blueprint && !busy) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-obsidian-950 via-slate-900 to-obsidian-950 px-6 py-16 text-titanium-50">
        <div className="mx-auto max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-titanium-800 px-3 py-1 text-xs text-titanium-400">
            <Sparkles size={13} className="text-petrol-500" /> Kein Konto nötig
          </div>
          <h1 className="text-4xl font-bold">Was möchten Sie erstellen?</h1>
          <p className="mt-4 text-lg text-titanium-300">
            Beschreiben Sie Ihre Website in eigenen Worten. RealSync baut daraus ein
            vollständiges Frontend mit Seitenstruktur, Inhalten, Rechtstexten und
            Prüfergebnis — und zeigt es Ihnen sofort.
          </p>

          <form onSubmit={submitPrompt} className="mt-8 space-y-4">
            <div>
              <label htmlFor="build-brand" className="block text-sm font-medium text-titanium-200">
                Wie heißt Ihr Unternehmen? <span className="text-titanium-500">(optional)</span>
              </label>
              <input
                id="build-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="z. B. Studio Vogt Architekten"
                className="mt-2 w-full rounded-lg border border-titanium-700 bg-obsidian-800 px-4 py-3 text-titanium-50 placeholder-titanium-500 transition-colors focus:border-petrol-600 focus:outline-none focus:ring-1 focus:ring-petrol-600"
              />
              <p className="mt-1 text-xs text-titanium-500">
                Ohne Angabe steht zunächst ein Platzhalter im Kopf der Website — Sie können ihn
                jederzeit ändern.
              </p>
            </div>

            <label htmlFor="build-prompt" className="block text-sm font-medium text-titanium-200">
              Ihre Beschreibung
            </label>
            <textarea
              id="build-prompt"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              autoFocus
              placeholder="z. B. Hochwertige Website für ein Architekturbüro in Leipzig. Dunkel, minimalistisch, viel Weißraum. Drei Projekte, Teamseite, Kontaktformular und Terminbuchung."
              className="w-full resize-none rounded-lg border border-titanium-700 bg-obsidian-800 px-4 py-4 text-titanium-50 placeholder-titanium-500 transition-colors focus:border-petrol-600 focus:outline-none focus:ring-1 focus:ring-petrol-600"
            />

            {error && (
              <div className="rounded-lg border border-red-700 bg-red-900/20 px-4 py-3 text-sm text-red-300">{error}</div>
            )}

            <button
              type="submit"
              className="w-full rounded-lg bg-petrol-600 px-6 py-4 font-semibold text-white transition-colors hover:bg-petrol-700"
            >
              Website erstellen
            </button>
          </form>

          <div className="mt-8">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[.16em] text-titanium-500">Beispiele</div>
            <div className="space-y-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setDraft(example)}
                  className="w-full rounded-lg border border-titanium-800 px-4 py-3 text-left text-sm text-titanium-300 transition-colors hover:border-petrol-700 hover:text-titanium-100"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-10 border-t border-titanium-800 pt-6 text-sm text-titanium-400">
            Sie haben bereits eine Website?{' '}
            <button
              type="button"
              onClick={() => navigate('/unified-entry/scan')}
              className="text-petrol-400 underline underline-offset-4 hover:text-petrol-300"
            >
              Bestehende Website analysieren
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Aufbau ──────────────────────────────────────────────────────────
  if (busy && !blueprint) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-to-br from-obsidian-950 via-slate-900 to-obsidian-950 px-6 text-titanium-50">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-petrol-500" />
            <span className="font-semibold">Ihre Website wird gebaut</span>
          </div>
          <ul className="space-y-3">
            {STAGES.map((label, index) => (
              <li key={label} className={`flex items-center gap-3 text-sm ${index < stage ? 'text-titanium-200' : 'text-titanium-600'}`}>
                <span className={`grid h-5 w-5 place-items-center rounded-full border ${index < stage ? 'border-petrol-600 bg-petrol-600/20 text-petrol-400' : 'border-titanium-700'}`}>
                  {index < stage ? <Check size={12} /> : null}
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (!blueprint || !session) return null;

  const critical = findings.filter((f) => f.severity === 'critical' || f.severity === 'high');

  // ── Studio ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-50">
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-titanium-800 bg-obsidian-950/90 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-petrol-600/15 text-petrol-400"><Sparkles size={15} /></span>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{blueprint.name}</div>
            <div className="text-[10px] text-titanium-500">
              {blueprint.pages.length} Seiten · Entwurf {hash.slice(0, 12)}…
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-obsidian-800 p-1">
            {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([key, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setDevice(key)}
                aria-label={key}
                aria-pressed={device === key}
                className={`rounded-md p-1.5 ${device === key ? 'bg-titanium-800 text-titanium-50' : 'text-titanium-500'}`}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigate('/app/siteos/claim')}
            className="inline-flex items-center gap-2 rounded-lg bg-petrol-600 px-4 py-2 text-xs font-bold text-white hover:bg-petrol-700"
          >
            Website übernehmen <ArrowRight size={14} />
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[220px_minmax(0,1fr)_320px]">
        {/* Seiten der Site — echte Pfade aus dem Blueprint, keine Beispielliste. */}
        <aside className="border-b border-titanium-800 p-4 lg:border-b-0 lg:border-r">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[.16em] text-titanium-500">Seiten</div>
          <div className="flex flex-wrap gap-2 lg:block">
            {blueprint.pages.map((page) => (
              <button
                key={page.path}
                type="button"
                onClick={() => setPath(page.path)}
                className={`w-full rounded-lg px-3 py-2 text-left text-xs lg:mb-1 ${path === page.path ? 'bg-titanium-800 text-titanium-50' : 'text-titanium-400 hover:bg-obsidian-800'}`}
              >
                <span className="block truncate">{page.title}</span>
                <span className="block truncate font-mono text-[10px] text-titanium-600">{page.path}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={restart}
            className="mt-6 w-full rounded-lg border border-titanium-800 px-3 py-2 text-xs text-titanium-400 hover:text-titanium-200"
          >
            Neu beginnen
          </button>
        </aside>

        <section className="min-w-0 p-3 sm:p-5">
          <div className="flex min-h-[70vh] justify-center overflow-auto rounded-xl border border-titanium-800 bg-obsidian-900 p-3 sm:p-5">
            <div style={{ width: DEVICE_WIDTH[device] }} className="overflow-hidden rounded-lg bg-white shadow-2xl transition-all">
              <iframe
                title={`Vorschau ${blueprint.name} — ${path}`}
                srcDoc={html}
                className="h-[78vh] w-full border-0"
                sandbox=""
              />
            </div>
          </div>
          {busy && (
            <div className="mt-3 flex items-center gap-2 text-xs text-titanium-400">
              <Loader2 size={13} className="animate-spin" /> Änderung wird angewendet …
            </div>
          )}
        </section>

        <aside className="border-t border-titanium-800 p-4 lg:border-l lg:border-t-0 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-bold"><Wand2 size={16} className="text-petrol-400" /> Weiter ändern</div>
          <p className="mt-1 text-xs leading-5 text-titanium-400">
            Sagen Sie, was anders sein soll. Die bestehende Website wird geändert — sie wird
            nicht neu erfunden.
          </p>

          <form
            onSubmit={(event) => { event.preventDefault(); applyInstruction(instruction); }}
            className="mt-3"
          >
            <label htmlFor="refine" className="sr-only">Änderungswunsch</label>
            <textarea
              id="refine"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={3}
              placeholder="z. B. Mach den Hero größer."
              className="w-full resize-none rounded-lg border border-titanium-700 bg-obsidian-800 p-3 text-xs text-titanium-50 placeholder-titanium-600 focus:border-petrol-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!instruction.trim() || busy}
              className="mt-2 w-full rounded-lg bg-titanium-800 px-3 py-2.5 text-xs font-bold text-titanium-50 disabled:opacity-40"
            >
              Änderung anwenden
            </button>
          </form>

          <div className="mt-5 text-[10px] font-bold uppercase tracking-[.16em] text-titanium-500">Schnell ändern</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action}
                type="button"
                disabled={busy}
                onClick={() => applyInstruction(action)}
                className="rounded-full border border-titanium-800 px-3 py-1.5 text-[11px] text-titanium-400 hover:border-petrol-700 hover:text-titanium-100 disabled:opacity-40"
              >
                {action}
              </button>
            ))}
          </div>

          {log.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-titanium-500">Verlauf</div>
              <ul className="space-y-2">
                {log.map((step) => (
                  <li key={`${step.at}-${step.instruction}`} className="rounded-lg border border-titanium-800 p-3 text-[11px] leading-5">
                    <div className="text-titanium-300">„{step.instruction}"</div>
                    {step.changes.map((change) => (
                      <div key={change.code} className="mt-1 text-titanium-500">
                        · {change.summary}
                        {change.complianceNote && (
                          <span className="mt-1 block text-petrol-400">{change.complianceNote}</span>
                        )}
                      </div>
                    ))}
                    {step.refusals.map((refusal) => (
                      <div key={refusal} className="mt-1 flex gap-1.5 text-amber-400">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {refusal}
                      </div>
                    ))}
                    {!step.understood && (
                      <div className="mt-1 text-amber-400">
                        Diese Anweisung wurde nicht verstanden — es wurde nichts geändert.
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Governance-Stand des aktuellen Entwurfs. Zahlen, keine Siegel. */}
          {scores && (
            <div className="mt-6 rounded-xl border border-titanium-800 p-4">
              <div className="flex items-center gap-2 text-xs font-bold"><ShieldCheck size={14} className="text-petrol-400" /> Prüfstand des Entwurfs</div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                {([['Health', scores.health], ['Compliance', scores.compliance], ['SEO', scores.dimensions.seo], ['Barrierefreiheit', scores.dimensions.accessibility]] as const).map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-obsidian-800 px-3 py-2">
                    <dt className="text-titanium-500">{label}</dt>
                    <dd className="font-mono text-sm text-titanium-100">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[11px] leading-5 text-titanium-400">
                {findings.length === 0
                  ? 'Keine offenen Befunde in den acht Analysedimensionen.'
                  : `${findings.length} Befund${findings.length === 1 ? '' : 'e'}${critical.length > 0 ? `, davon ${critical.length} mit hoher Dringlichkeit` : ''}.`}
              </p>
              <p className="mt-2 text-[11px] leading-5 text-titanium-500">
                Rechtsgrundlagen: {blueprint.compliance.legalBases.join(' · ') || '—'}
                {blueprint.compliance.dpiaRequired && ' · DSFA indiziert (Art. 35 DSGVO)'}
              </p>
            </div>
          )}

          <div className="mt-5 rounded-xl border border-titanium-800 bg-obsidian-900 p-4 text-[11px] leading-5 text-titanium-400">
            Der Entwurf liegt nur in diesem Browser. Mit „Website übernehmen" wird er Ihrem
            Workspace zugeordnet, versioniert und in den Prüfpfad aufgenommen. Domain und
            Veröffentlichung folgen danach.
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-700 bg-red-900/20 p-3 text-[11px] text-red-300">{error}</div>
          )}
        </aside>
      </div>
    </div>
  );
}

/**
 * Die Zeilen des Aufbaus. Sie benennen die Schritte, die
 * `buildSiteFromPrompt` tatsächlich geht — Brief, Synthese, Rechtstexte,
 * Analyse, Bewertung, Rendering.
 */
const STAGES: readonly string[] = [
  'Anforderungen aus Ihrer Beschreibung abgeleitet',
  'Seitenstruktur und Navigation erstellt',
  'Inhalte und Komponenten aufgebaut',
  'Pflichtseiten und KI-Hinweis ergänzt',
  'Acht Analysedimensionen geprüft',
  'Frontend gerendert',
];
