import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useTenant } from '../../../core/access/TenantProvider';
import { canPreview, MAX_SCRIPT_LENGTH, validatePhoto, type TwinFormat } from './photoVideoContract';
import { sha256Hex } from '../../../lib/provenance';

/** Private design preview. No photo is uploaded, no video is generated. */
export default function PhotoVideoPreview() {
  const { activeTenantId, loading, error: tenantError } = useTenant();
  const [file, setFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  const [script, setScript] = useState('Willkommen bei RealSync Dynamics & AI. Wir gestalten Ihren digitalen Auftritt.');
  const [format, setFormat] = useState<TwinFormat>('9:16');
  const [consent, setConsent] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [photoDigest, setPhotoDigest] = useState<string | null>(null);
  const [digestError, setDigestError] = useState(false);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  // Existing Provenance SHA-256 implementation is reused. This is only a local
  // exact-byte fingerprint, NOT a signed proof, identity check or copyright title.
  useEffect(() => {
    let cancelled = false;
    setPhotoDigest(null);
    setDigestError(false);
    if (file) {
      file.arrayBuffer()
        .then((buffer) => sha256Hex(new Uint8Array(buffer)))
        .then((digest) => { if (!cancelled) setPhotoDigest(digest); })
        .catch(() => { if (!cancelled) setDigestError(true); });
    }
    return () => { cancelled = true; };
  }, [file]);

  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.currentTarget.files?.[0] ?? null;
    const issue = validatePhoto(selected);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setPhotoUrl(null);
    setFile(null);
    setFeedback(issue || '');
    if (!issue && selected) {
      urlRef.current = URL.createObjectURL(selected);
      setPhotoUrl(urlRef.current);
      setFile(selected);
    }
  };

  const allowed = canPreview(file, script, consent, activeTenantId ?? null);
  const startSpeech = () => {
    if (!allowed) return;
    if (!('speechSynthesis' in window)) {
      setFeedback('Dieser Browser unterstützt keine lokale Sprachvorschau.');
      return;
    }
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(script.trim());
    speech.lang = 'de-DE';
    speech.onend = () => setSpeaking(false);
    speech.onerror = () => {
      setSpeaking(false);
      setFeedback('Die Sprachausgabe ist fehlgeschlagen.');
    };
    setFeedback('');
    setSpeaking(true);
    window.speechSynthesis.speak(speech);
  };

  const stopSpeech = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  if (loading) return <p role="status" className="p-8">Arbeitsbereich wird geladen …</p>;
  if (tenantError) return <p role="alert" className="p-8">Arbeitsbereich konnte nicht geladen werden.</p>;
  if (!activeTenantId) return (
    <section className="p-8"><h1 className="text-2xl font-bold">Digital Twin Studio</h1><p>Bitte zuerst einen Arbeitsbereich auswählen.</p></section>
  );

  const aspect = format === '9:16' ? '9 / 16' : format === '16:9' ? '16 / 9' : '1 / 1';

  return (
    <main className="min-h-screen bg-white p-5 text-slate-950 md:p-10" aria-label="RealSync Digital Twin Studio">
      <p className="text-xs font-semibold uppercase tracking-widest text-blue-800">RealSync Dynamics & AI · Creative Studio</p>
      <h1 className="mt-2 text-3xl font-bold">Foto zu Video – Digital Twin</h1>
      <p className="mt-3 max-w-3xl text-sm text-slate-700">
        Geschützte Designvorschau: Porträt, Skript und Sprachprobe. Video-Rendering und Lippenanimation sind noch nicht integriert.
      </p>
      <p className="mt-4 inline-block border border-amber-600 px-3 py-1 text-xs font-bold text-amber-800">
        VORSCHAU · KEINE VIDEOGENERIERUNG
      </p>

      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <section className="space-y-5">
          <div className="border border-slate-300 p-5">
            <label htmlFor="twin-photo" className="block font-semibold">1. Porträtfoto hochladen</label>
            <p className="mt-1 text-sm text-slate-600">Nur JPG, PNG oder WEBP · maximal 10 MB · bleibt in deinem Browser.</p>
            <input id="twin-photo" className="mt-4 block w-full text-sm" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto}/>
            {file && <p className="mt-3 break-all text-xs text-slate-600">{file.name}</p>}
          </div>

          <div className="border border-slate-300 p-5">
            <label htmlFor="twin-script" className="font-semibold">2. Was soll dein Twin sagen?</label>
            <textarea id="twin-script" rows={5} maxLength={MAX_SCRIPT_LENGTH} value={script} onChange={e => setScript(e.target.value)}
              className="mt-3 w-full border border-slate-400 p-3 text-sm text-slate-950" />
            <p className="mt-1 text-right text-xs text-slate-600">{script.length} / {MAX_SCRIPT_LENGTH}</p>
          </div>

          <fieldset className="border border-slate-300 p-5">
            <legend className="px-2 font-semibold">3. Format wählen</legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {(['9:16', '16:9', '1:1'] as const).map(value => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="twin-format" checked={format === value} onChange={() => setFormat(value)}/>
                  {value}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex gap-3 border border-slate-300 p-5 text-sm">
            <input type="checkbox" className="mt-1" checked={consent} onChange={e => setConsent(e.target.checked)}/>
            <span>Ich bin die abgebildete Person oder habe ihre ausdrückliche Zustimmung zur KI-Avatar-Erstellung. Eine spätere Stimmkopie benötigt eine gesonderte Zustimmung.</span>
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={!allowed || speaking} onClick={startSpeech}
              className="bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
              Sprachvorschau abspielen
            </button>
            <button type="button" disabled={!speaking} onClick={stopSpeech}
              className="border border-slate-500 px-5 py-3 text-sm disabled:opacity-40">
              Stopp
            </button>
          </div>
          {feedback && <p role="alert" className="border-l-2 border-amber-600 pl-3 text-sm text-amber-900">{feedback}</p>}
        </section>

        <aside className="border border-slate-300 bg-slate-50 p-5">
          <h2 className="text-lg font-semibold">Dein digitaler Twin · Entwurf</h2>
          <div className="mt-4 flex min-h-72 justify-center bg-slate-900 p-4">
            <div style={{ aspectRatio: aspect }} className="relative flex max-h-[550px] w-full max-w-xs items-center justify-center overflow-hidden bg-slate-800 text-sm text-slate-300">
              {photoUrl ? <img src={photoUrl} alt="Lokal ausgewähltes Porträt" className="h-full w-full object-cover"/> : <p className="p-4 text-center">Hier erscheint dein Foto.</p>}
              <span className="absolute bottom-2 left-2 bg-black/80 px-2 py-1 text-xs font-semibold text-white">KI-AVATAR · VORSCHAU</span>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-700">
            Die optionale Sprachprobe nutzt die Browser-Stimme, nicht deine Stimme. Das Gesicht wird nicht animiert;
            es findet keine Aufnahme, Generierung oder Übertragung an einen KI-Anbieter statt.
          </p>
          <section className="mt-6 border border-slate-300 bg-white p-4" aria-labelledby="butterfly-heading">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-800">RealSync Butterfly · Identity Protection</p>
            <h3 id="butterfly-heading" className="mt-2 text-lg font-semibold">Herkunft & Identität</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div><dt className="font-semibold">Foto-Fingerabdruck (SHA-256)</dt>
                <dd className="mt-1 break-all font-mono text-xs text-slate-700">
                  {digestError ? 'Berechnung fehlgeschlagen' : photoDigest ?? 'Noch kein Fingerabdruck'}
                </dd>
              </div>
              <div><dt className="font-semibold">Identitätsstatus</dt><dd>Nicht überprüft</dd></div>
              <div><dt className="font-semibold">Kryptografische Signatur</dt><dd>Nicht ausgestellt</dd></div>
              <div><dt className="font-semibold">Avatar-QR-Code</dt><dd>Noch nicht verfügbar – erst nach serverseitiger Verifizierung</dd></div>
              <div><dt className="font-semibold">Unsichtbares Wasserzeichen</dt><dd>Noch nicht integriert</dd></div>
            </dl>
            <p className="mt-3 text-xs text-slate-600">
              Ein Hash zeigt nur die Integrität genau dieser Datei. Er ist kein Identitätsnachweis und kein Eigentumsnachweis.
              Ein QR-Code darf erst nach gültiger, vertrauenswürdiger Signatur zur Verifizierungsseite führen.
            </p>
          </section>
          <button type="button" disabled className="mt-6 w-full cursor-not-allowed bg-slate-300 px-5 py-3 font-semibold text-slate-600">
            Video generieren · Backend nicht freigegeben
          </button>
        </aside>
      </div>
    </main>
  );
}
