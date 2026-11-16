import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Code2, ExternalLink, Film, Image as ImageIcon, LoaderCircle, ShieldCheck, Sparkles, PanelsTopLeft } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { useTenant } from '../core/access/TenantProvider';

type Mode = 'image' | 'video';
type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
type VideoDuration = 5 | 8 | 10;
type Job = { request_id: string; proof: string };
type GenerationResult = { image_url?: string; video_url?: string };

const PRESETS = [
  { name: 'Luxusuhr', prompt: 'Fotorealistische Luxusuhren-Werbung, Edelstahlgehäuse mit feinen Reflexionen, schwarzer Marmor, präzise Produktbeleuchtung, hochwertiger Editorial-Look.' },
  { name: 'Parfüm', prompt: 'Elegantes Parfümflakon auf hellem Stein, reflektiertes Sonnenlicht, subtile Wassertropfen, Premium Beauty Campaign, fotorealistisch.' },
  { name: 'Neueröffnung', prompt: 'Cinematischer Werbeclip für eine stilvolle Neueröffnung: einladender Eingang, sanfte Kamerafahrt, festliche Lichtstimmung und moderne Markenästhetik.' },
  { name: 'Musikvideo', prompt: 'Musikvideo-Szene in einer futuristischen Stadt bei Nacht, dynamische Kameraführung, farbige Lichtreflexe, ausdrucksstarke Atmosphäre.' },
] as const;

export function CreativeStudio() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get('type') === 'video' ? 'video' : 'image');
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState<AspectRatio>('16:9');
  const [duration, setDuration] = useState<VideoDuration>(5);
  const [busy, setBusy] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const { activeTenantId } = useTenant();

  useEffect(() => {
    setMode(params.get('type') === 'video' ? 'video' : 'image');
  }, [params]);

  const invoke = async (body: Record<string, unknown>) => {
    const { data, error: invocationError } = await getSupabase().functions.invoke('creative-studio', { body });
    if (invocationError) throw new Error(invocationError.message || 'Generierungsdienst nicht erreichbar.');
    if (!data || data.ok !== true) throw new Error(data?.error?.message || 'Keine gültige Antwort vom Generierungsdienst.');
    return data as Record<string, unknown>;
  };

  const generate = async () => {
    if (!activeTenantId) return setError('Bitte zuerst einen Workspace bzw. Mandanten auswählen.');
    if (prompt.trim().length < 10) return setError('Bitte eine Beschreibung mit mindestens 10 Zeichen eingeben.');
    setBusy(true);
    setError('');
    setNotice('');
    setResult(null);
    setJob(null);
    try {
      const response = await invoke({
        action: mode, tenant_id: activeTenantId, prompt: prompt.trim(),
        aspect_ratio: ratio, ...(mode === 'video' ? { duration } : {}),
      });
      if (mode === 'image') {
        setResult({ image_url: String(response.image_url) });
        setNotice('Bild erzeugt. Der Provider-Link kann ablaufen: Ergebnis zeitnah sichern.');
      } else {
        setJob({ request_id: String(response.request_id), proof: String(response.proof) });
        setNotice('Videoauftrag gestartet. Der Status wird automatisch abgefragt.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generierung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!job || !activeTenantId) return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      if (cancelled || polling) return;
      setPolling(true);
      try {
        const response = await invoke({
          action: 'status', tenant_id: activeTenantId, request_id: job.request_id, proof: job.proof,
        });
        if (cancelled) return;
        if (response.status === 'done' && typeof response.video_url === 'string') {
          setResult({ video_url: response.video_url });
          setJob(null);
          setNotice('Video fertig. Der Download-Link des Providers ist zeitlich begrenzt.');
        } else if (response.status === 'failed' || response.status === 'expired') {
          setJob(null);
          setError('Der Videoauftrag wurde beendet: ' + String(response.status));
        }
      } catch (e) {
        if (!cancelled) {
          setJob(null);
          setError(e instanceof Error ? e.message : 'Videostatus konnte nicht gelesen werden.');
        }
      } finally {
        if (!cancelled) setPolling(false);
      }
    }, 8000);
    return () => { cancelled = true; window.clearInterval(timer); };
    // The active tenant and job identity determine the polling lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.request_id, job?.proof, activeTenantId]);

  return (
    <div className="min-h-full bg-[#f6f8fc] p-4 text-slate-900 sm:p-7" data-testid="creative-studio">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-700">
              <Sparkles className="h-4 w-4" /> RealSync Dynamics & AI
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">KI Creative Studio</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
              Bilder und kurze Werbevideos über ein gemeinsames Studio vorbereiten.
              xAI-Generierung ist ein zugangsbeschränkter Pilot, nicht allgemein freigeschaltet.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/app/dashboard" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-blue-300">
              <ShieldCheck className="mr-1 inline h-4 w-4" /> Governance
            </Link>
            <Link to="/claude-code-optimizer" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-blue-300">
              <Code2 className="mr-1 inline h-4 w-4" /> Code Optimizer
            </Link>
            <Link to="/build" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-blue-300">
              <PanelsTopLeft className="mr-1 inline h-4 w-4" /> Landingpage Designer
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,1fr)]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8" aria-label="Generierung konfigurieren">
            <div role="tablist" aria-label="Medientyp" className="mb-7 flex gap-2 rounded-2xl bg-slate-100 p-1.5">
              {([
                { id: 'image', label: 'Bilder erstellen', icon: ImageIcon },
                { id: 'video', label: 'Videos erstellen', icon: Film },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button key={id} role="tab" aria-selected={mode === id} type="button"
                  onClick={() => { setMode(id); setError(''); setNotice(''); setResult(null); }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition ${mode === id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
            <label htmlFor="creative-prompt" className="block text-sm font-semibold text-slate-900">Was möchtest du erstellen?</label>
            <textarea
              id="creative-prompt" rows={6} maxLength={2000} value={prompt} onChange={(e) => setPrompt(e.target.value)}
              placeholder={mode === 'image' ? 'Beispiel: Eine Premium-Uhr für eine elegante Werbekampagne …' : 'Beispiel: Ein cinematischer Clip zur Neueröffnung …'}
              className="mt-3 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Schnellvorlagen</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <button key={preset.name} type="button" onClick={() => setPrompt(preset.prompt)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:border-blue-400 hover:text-blue-700">
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="creative-ratio" className="block text-sm font-semibold">Seitenverhältnis</label>
                <select id="creative-ratio" value={ratio} onChange={(e) => setRatio(e.target.value as AspectRatio)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <option value="16:9">16:9 · Querformat</option>
                  <option value="9:16">9:16 · Reel / Story</option>
                  <option value="1:1">1:1 · Quadrat</option>
                  <option value="4:3">4:3 · Klassisch</option>
                  <option value="3:4">3:4 · Hochformat</option>
                </select>
              </div>
              {mode === 'video' && (
                <div>
                  <label htmlFor="creative-duration" className="block text-sm font-semibold">Videolänge</label>
                  <select id="creative-duration" value={duration} onChange={(e) => setDuration(Number(e.target.value) as VideoDuration)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                    <option value={5}>5 Sekunden</option>
                    <option value={8}>8 Sekunden</option>
                    <option value={10}>10 Sekunden</option>
                  </select>
                </div>
              )}
            </div>
            <button type="button" disabled={busy || Boolean(job) || !activeTenantId || prompt.trim().length < 10}
              onClick={() => void generate()}
              className="mt-8 flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {busy ? 'Anfrage wird gesendet …' : mode === 'image' ? 'Bild generieren' : 'Video generieren'}
              {!busy && <ArrowRight className="h-4 w-4" />}
            </button>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Die Generierung ist kostenpflichtig beim API-Anbieter und erst nach administrativer Pilotfreigabe nutzbar.
              Es erfolgt hier keine automatische Zahlung oder Buchung.
            </p>
            {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
            {notice && <p role="status" className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">{notice}</p>}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8" aria-label="Ausgabe">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Vorschau / Ergebnis</p>
            <h2 className="mt-2 text-2xl font-semibold">Dein Ergebnis</h2>
            <div className="mt-5 flex min-h-[330px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
              {result?.image_url ? (
                <img src={result.image_url} alt="Von KI generiertes Bild" className="max-h-[440px] w-full rounded-xl object-contain" />
              ) : result?.video_url ? (
                <video src={result.video_url} controls className="max-h-[440px] w-full rounded-xl" aria-label="Von KI generiertes Video" />
              ) : job ? (
                <><LoaderCircle className="h-12 w-12 animate-spin text-blue-700" /><p className="mt-5 text-sm font-semibold">Video wird erstellt</p><p className="mt-1 text-xs text-slate-500">Bitte diese Seite geöffnet lassen.</p></>
              ) : (
                <><ImageIcon className="h-12 w-12 text-slate-300" aria-hidden="true" /><p className="mt-5 text-sm font-semibold text-slate-700">Noch kein Ergebnis</p><p className="mt-2 max-w-xs text-sm text-slate-500">Prompt auswählen, Format festlegen und Pilotgenerierung starten.</p></>
              )}
            </div>
            {(result?.image_url || result?.video_url) && (
              <a href={result.image_url || result.video_url} target="_blank" rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900">
                Ergebnis im neuen Tab öffnen <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <p className="mt-5 text-xs leading-5 text-slate-500">
              Pilotumfang: Text zu Bild und Text zu Video. Dauerhafte Medienbibliothek, Bild-zu-Video,
              Nutzungsabrechnung und automatischer Evidence-Eintrag sind noch nicht aktiviert.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
