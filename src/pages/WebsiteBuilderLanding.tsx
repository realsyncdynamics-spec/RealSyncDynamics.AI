import { useState } from 'react';
import { ArrowRight, Bot, Check, Globe2, Phone, ShieldCheck, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const FEATURES = [
  { id: 'modern-site', label: 'Neue moderne Website', icon: Globe2 },
  { id: 'chatbot', label: 'AI Chatbot', icon: Bot },
  { id: 'phonebot', label: 'AI Telefonbot', icon: Phone },
  { id: 'booking', label: 'Online-Terminbuchung', icon: Check },
  { id: 'seo', label: 'SEO & Local SEO', icon: Check },
  { id: 'accessibility', label: 'Barrierefreiheit', icon: Check },
  { id: 'dsgvo', label: 'DSGVO-Governance', icon: ShieldCheck },
  { id: 'ai-act', label: 'EU-AI-Act-Governance', icon: ShieldCheck },
] as const;

/**
 * Customer-facing SiteOS transformation entry.
 * The source URL is analysed as input material; the product creates a new
 * SiteBlueprint/deployment rather than copying the source DOM into the browser.
 */
export function WebsiteBuilderLanding() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [features, setFeatures] = useState<string[]>(FEATURES.map((feature) => feature.id));
  const [error, setError] = useState('');

  const toggle = (id: string) => {
    setFeatures((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const start = () => {
    const clean = url.trim();
    if (!/^https?:\/\/[^\s]+$/i.test(clean)) {
      setError('Bitte eine vollständige URL inklusive https:// eingeben.');
      return;
    }
    if (features.length === 0) {
      setError('Bitte mindestens eine Funktion auswählen.');
      return;
    }
    setError('');
    const params = new URLSearchParams({ source_url: clean, features: features.join(',') });
    navigate(`/contact-sales?source=website-builder&${params.toString()}`);
  };

  return (
    <main className="min-h-screen bg-[rgb(3,7,18)] text-white antialiased">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-16">
        <Link to="/" className="text-sm text-white/55 hover:text-white">← RealSyncDynamics.AI</Link>

        <section className="mt-12 grid gap-12 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.18em] text-cyan-300">
              <Sparkles size={13} /> SiteOS Website Transformation
            </div>
            <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.04] tracking-tight sm:text-6xl">
              Deine bestehende Website wird zu einer <span className="text-cyan-400">neuen AI-Website.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
              URL eingeben, Funktionen auswählen und RealSyncDynamicsAI erstellt daraus eine neue,
              moderne Website — mit AI Chatbot, Telefonbot, Buchung und eingebauter Governance.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ['01', 'DISCOVER', 'Bestehende Inhalte, Struktur und Branding erfassen.'],
                ['02', 'BUILD', 'Neue SiteBlueprint-Version mit deinen Wunschfunktionen erzeugen.'],
                ['03', 'DEPLOY', 'Preview, Freigabe und anschließend eigene Kunden-Domain.'],
              ].map(([no, title, text]) => (
                <article key={no} className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
                  <div className="font-mono text-[10px] text-cyan-400">{no} / {title}</div>
                  <p className="mt-2 text-xs leading-5 text-white/50">{text}</p>
                </article>
              ))}
            </div>
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/[.035] p-5 shadow-2xl backdrop-blur sm:p-7">
            <label htmlFor="website-url" className="font-mono text-[10px] uppercase tracking-[.18em] text-cyan-300">Deine aktuelle Website</label>
            <input
              id="website-url"
              type="url"
              value={url}
              onChange={(event) => { setUrl(event.target.value); setError(''); }}
              placeholder="https://www.deine-website.de"
              className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-400/60"
            />

            <div className="mt-7">
              <p className="font-mono text-[10px] uppercase tracking-[.18em] text-white/45">Was soll die neue Website können?</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {FEATURES.map(({ id, label, icon: Icon }) => {
                  const active = features.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggle(id)}
                      aria-pressed={active}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition ${active ? 'border-cyan-400/45 bg-cyan-400/10 text-white' : 'border-white/10 bg-white/[.02] text-white/55'}`}
                    >
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${active ? 'bg-cyan-400 text-[rgb(3,7,18)]' : 'bg-white/5'}`}>
                        <Icon size={14} />
                      </span>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <p role="alert" className="mt-4 text-xs text-rose-300">{error}</p>}

            <button
              type="button"
              onClick={start}
              className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-4 text-sm font-bold text-[rgb(3,7,18)] transition hover:bg-cyan-300"
            >
              <Sparkles size={17} /> Neue Website erstellen <ArrowRight size={17} />
            </button>
            <p className="mt-3 text-center text-[11px] text-white/35">Analyse → Konzept → Generierung → Governance → Preview → Freigabe → Deployment</p>
          </section>
        </section>

        <section className="mt-14 rounded-2xl border border-cyan-400/15 bg-cyan-400/[.035] p-6 sm:p-8">
          <p className="font-mono text-[10px] uppercase tracking-[.18em] text-cyan-300">Output</p>
          <h2 className="mt-2 text-2xl font-bold">Eine eigene Kunden-Website — nicht eine Seite innerhalb von RealSyncDynamicsAI.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">
            Die bestehende Website dient als Quelle für Inhalte und Geschäftsinformationen. Das Ergebnis ist ein neues SiteOS-Projekt mit eigener Preview-/Tenant-URL. Nach Freigabe kann die eigene Kundendomain verbunden werden.
          </p>
        </section>
      </div>
    </main>
  );
}
