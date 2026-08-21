import { useState } from 'react';
import { SCENE_PRESETS, stillFromPrompt, type SiteLook } from './site-look';
import { cn } from './uid';

export function PhotoSources({
  company,
  domainPhotos,
  currentHero,
  onApply,
}: {
  company: string;
  domainPhotos: string[];
  currentHero?: string;
  onApply: (patch: Partial<SiteLook>) => void;
}) {
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);

  function fromPrompt(prompt: string) {
    const text = prompt.trim();
    if (text.length < 4) {
      setErr('Skyline, Natur, Büro — oder ein Satz.');
      return;
    }
    setDraft(text);
    setErr(null);
    const mapped = stillFromPrompt(text);
    onApply({
      prompt: text,
      hero: mapped.still,
      photos: [mapped.still, ...domainPhotos].slice(0, 12),
      variantId: mapped.variantId,
      accent: mapped.accent,
      headline: company,
      kicker: text.slice(0, 48),
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[.03] p-4">
      <p className="text-[10px] uppercase tracking-[.18em] text-white/40">Fotografie bei der Generierung</p>
      <p className="text-sm text-white/55">
        Prompt, Szene, eigene Datei oder 1:1 die Domain-Fotos. Immer fotorealistisch.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          fromPrompt(draft);
        }}
        className="space-y-2"
      >
        <label htmlFor="photo-prompt" className="block text-[11px] uppercase tracking-[.14em] text-white/40">
          Wunsch
        </label>
        <textarea
          id="photo-prompt"
          className="min-h-16 w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white outline-none focus:border-cyan-400/50"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Skyline, Natur, Büro, nasser Hof…"
        />
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-[rgb(3,7,18)] hover:bg-cyan-300"
        >
          Fotorealistisch erzeugen
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {SCENE_PRESETS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => fromPrompt(s.prompt)}
            className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-white/80 hover:border-cyan-400/40 hover:text-cyan-200"
          >
            {s.label}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="own" className="block text-[11px] uppercase tracking-[.14em] text-white/40">
          Eigenes Foto
        </label>
        <input
          id="own"
          type="file"
          accept="image/*"
          multiple
          className="mt-1 block w-full text-xs text-white/55"
          onChange={(e) => {
            [...(e.target.files ?? [])].slice(0, 6).forEach((file) => {
              const reader = new FileReader();
              reader.onload = () => {
                const src = String(reader.result ?? '');
                if (!src) return;
                onApply({ hero: src, photos: [src, ...domainPhotos].slice(0, 12) });
              };
              reader.readAsDataURL(file);
            });
          }}
        />
      </div>

      {domainPhotos.length ? (
        <div>
          <p className="text-xs text-white/40">Von der Domain · 1:1</p>
          <div className="mt-2 grid grid-cols-4 gap-1">
            {domainPhotos.slice(0, 8).map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => onApply({ hero: src, photos: domainPhotos })}
                className={cn(
                  'overflow-hidden rounded border',
                  currentHero === src ? 'border-cyan-400' : 'border-transparent',
                )}
              >
                <img src={src} alt="" className="h-12 w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-white/35">Keine Domain-Fotos — Prompt, Button oder Upload.</p>
      )}
      {err ? <p className="text-xs text-amber-300">{err}</p> : null}
    </div>
  );
}
