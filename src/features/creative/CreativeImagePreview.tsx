import { useState, type FormEvent } from 'react';
import { getSupabase } from '../../lib/supabase';

/**
 * Preview-only Creative Studio form. This does not generate images or charge.
 * Do not advertise this as a live product before production gates are met.
 */
export function CreativeImagePreview({ tenantId }: { tenantId: string }) {
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState('1:1');
  const [resolution, setResolution] = useState('1k');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function checkAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await getSupabase().functions.invoke(
        'creative-image-preflight',
        { body: { tenant_id: tenantId, image: {
          prompt, aspect_ratio: ratio, resolution,
        } } },
      );
      if (error) {
        setMessage('Bildgenerierung ist noch nicht freigeschaltet.');
      } else if (data?.ready === true) {
        // Never turn this into generation without a separately reviewed endpoint.
        setMessage('Vorprüfung erfolgreich. Die Generierung ist noch deaktiviert.');
      } else {
        setMessage('Vorprüfung abgeschlossen: Bildgenerierung ist noch nicht verfügbar.');
      }
    } catch {
      setMessage('Vorprüfung momentan nicht erreichbar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-slate-700 bg-slate-950 p-6 text-slate-100" aria-labelledby="creative-preview-title">
      <p className="text-xs uppercase tracking-widest text-sky-400">RealSync Creative Studio · Vorschau</p>
      <h2 id="creative-preview-title" className="mt-2 text-2xl font-semibold">KI-Bildstudio</h2>
      <p className="mt-2 text-sm text-slate-300">
        Bereite deinen Bildauftrag vor. Aktuell wird ausschließlich die Zugangsprüfung getestet.
        Es wird kein Bild erstellt und nichts berechnet.
      </p>
      <form onSubmit={checkAccess} className="mt-5 flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm">
          Bildbeschreibung
          <textarea required minLength={3} maxLength={4000} value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-28 border border-slate-600 bg-slate-900 p-3"
            placeholder="Beschreibe dein Produktbild ..." />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Format
          <select value={ratio} onChange={(e) => setRatio(e.target.value)}
            className="border border-slate-600 bg-slate-900 p-3">
            <option value="1:1">Quadrat · 1:1</option>
            <option value="16:9">Querformat · 16:9</option>
            <option value="9:16">Hochformat · 9:16</option>
            <option value="4:3">Querformat · 4:3</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Auflösung
          <select value={resolution} onChange={(e) => setResolution(e.target.value)}
            className="border border-slate-600 bg-slate-900 p-3">
            <option value="1k">1K</option>
            <option value="2k">2K</option>
          </select>
        </label>
        <button type="submit" disabled={busy || prompt.trim().length < 3}
          className="border border-sky-500 bg-sky-950 px-5 py-3 text-sm font-semibold disabled:opacity-50">
          {busy ? 'Prüfung läuft …' : 'Zugang prüfen (keine Generierung)'}
        </button>
      </form>
      {message && <p role="status" className="mt-4 text-sm">{message}</p>}
    </section>
  );
}
