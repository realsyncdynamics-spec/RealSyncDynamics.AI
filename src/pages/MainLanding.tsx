import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { ArrowRight, Check, Lock, Scan, ShieldCheck, Snowflake } from 'lucide-react';

const BG = 'rgb(3, 7, 18)';
const FONT_STACK = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

/**
 * Conversion-first public landing page.
 *
 * The public entry point intentionally has one primary job:
 * get the visitor to submit a website URL. Product dashboards, demo tours
 * and multi-path CTAs stay inside the application and are not promoted here.
 */
export function MainLanding() {
  const navigate = useNavigate();
  const [domain, setDomain] = useState('');

  const startScan = (event: React.FormEvent) => {
    event.preventDefault();
    const value = domain.trim();
    if (!value) {
      navigate('/unified-entry/scan');
      return;
    }
    navigate(`/unified-entry/scan?domain=${encodeURIComponent(value)}`);
  };

  return (
    <div className="landing-context min-h-screen bg-[rgb(3,7,18)] text-white antialiased" style={{ backgroundColor: BG, fontFamily: FONT_STACK }}>
      <SEOHead />

      <header className="absolute inset-x-0 top-0 z-30">
        <div className="max-w-7xl mx-auto h-20 px-6 lg:px-10 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <Snowflake className="w-6 h-6 text-cyan-400" strokeWidth={1.5} />
            <span className="text-base sm:text-lg font-semibold tracking-tight">
              RealSync <span className="font-normal text-white/80">Dynamics.AI</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-7">
            <a href="#how" className="text-sm text-white/65 hover:text-white transition-colors">So funktioniert's</a>
            <a href="#pricing" className="text-sm text-white/65 hover:text-white transition-colors">Preise</a>
            <a href="#security" className="text-sm text-white/65 hover:text-white transition-colors">Sicherheit</a>
            <Link to="/welcome" className="text-sm text-white/65 hover:text-white transition-colors">Login</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative min-h-[760px] flex items-center overflow-hidden">
          <div className="absolute inset-0">
            <picture>
              <source srcSet="/europe-globe.webp" type="image/webp" />
              <img src="/europe-globe.jpg" alt="Europa bei Nacht" width={1376} height={768} fetchPriority="high" className="w-full h-full object-cover object-right opacity-70" />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-r from-[rgb(3,7,18)] via-[rgb(3,7,18)]/92 to-[rgb(3,7,18)]/35" />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgb(3,7,18)] via-transparent to-[rgb(3,7,18)]/55" />
          </div>

          <div className="relative z-10 w-full max-w-5xl mx-auto px-6 lg:px-10 pt-28 pb-20 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-7 rounded-full border border-cyan-500/30 bg-cyan-500/5 font-mono text-[10px] tracking-[0.2em] text-cyan-300 uppercase">
              <Scan className="w-3.5 h-3.5" /> Website Intelligence
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.04] tracking-tight">
              Welche Website sollen wir{' '}
              <span className="text-cyan-400">neu bauen?</span>
            </h1>

            <p className="max-w-2xl mx-auto mt-6 text-base sm:text-lg md:text-xl text-white/68 leading-relaxed">
              Wir scannen zuerst Ihre bestehende Website. Danach sehen Sie konkret,
              was wir daraus machen können — moderner, SEO-stärker und mit DSGVO- und EU-AI-Act-Anforderungen im Workflow.
            </p>

            <form onSubmit={startScan} className="max-w-3xl mx-auto mt-10">
              <div className="flex flex-col sm:flex-row gap-3 p-2 rounded-2xl border border-white/15 bg-black/35 backdrop-blur-xl shadow-2xl">
                <input
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  placeholder="z. B. realsyncdynamicsai.de"
                  aria-label="Website-URL"
                  className="flex-1 min-w-0 px-5 py-4 bg-transparent text-white placeholder:text-white/35 outline-none text-base"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[rgb(3,7,18)] font-bold transition-colors"
                >
                  Website prüfen <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/45">
              <span>✓ URL zuerst</span>
              <span>✓ Kein Account vor dem Scan</span>
              <span>✓ Ergebnis in Minuten</span>
            </div>
          </div>
        </section>

        <section id="how" className="py-20 md:py-28 border-y border-white/10 bg-white/[0.02]">
          <div className="max-w-6xl mx-auto px-6 lg:px-10">
            <div className="max-w-2xl mb-12">
              <p className="font-mono text-[10px] tracking-[0.25em] text-cyan-400 mb-3">DER FLOW</p>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Erst zeigen. Dann verkaufen.</h2>
              <p className="mt-4 text-white/60 leading-relaxed">Der Besucher muss nicht zuerst ein Paket verstehen. Er muss nur seine Website zeigen.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {[
                ['01', 'Website scannen', 'URL eingeben und Live-Daten zur bestehenden Website erfassen.'],
                ['02', 'Redesign sichtbar machen', 'Score, Findings und konkrete Modernisierungsmöglichkeiten zeigen.'],
                ['03', 'Angebot per E-Mail', 'Nach dem Ergebnis Kontaktdaten erfassen und das passende Angebot senden.'],
              ].map(([no, title, text]) => (
                <div key={no} className="p-7 rounded-2xl border border-white/10 bg-white/[0.02]">
                  <span className="font-mono text-4xl font-bold text-cyan-400/25">{no}</span>
                  <h3 className="mt-4 text-xl font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-white/58 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="py-20 md:py-24">
          <div className="max-w-5xl mx-auto px-6 lg:px-10">
            <div className="max-w-2xl mb-10">
              <p className="font-mono text-[10px] tracking-[0.25em] text-cyan-400 mb-3">PREISE</p>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Weniger Auswahl. Klarere Entscheidung.</h2>
              <p className="mt-4 text-white/60">Die detaillierte Paketwahl kommt erst nach dem Domaincheck. Auf der Startseite zählt der nächste sinnvolle Schritt.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div className="p-7 rounded-2xl border border-cyan-400/40 bg-cyan-500/[0.06]">
                <p className="font-mono text-[10px] tracking-widest text-cyan-300">GROWTH</p>
                <div className="mt-3 flex items-baseline gap-2"><span className="text-4xl font-bold">249 €</span><span className="text-white/45">/Monat</span></div>
                <p className="mt-3 text-white/70">14 Tage kostenlos — ausschließlich für Growth.</p>
              </div>
              <div className="p-7 rounded-2xl border border-white/10 bg-white/[0.02]">
                <p className="font-mono text-[10px] tracking-widest text-cyan-300">STARTER-ANGEBOT</p>
                <div className="mt-3 text-3xl font-bold">3 Monate gratis</div>
                <p className="mt-3 text-white/70">Nach dem Domaincheck erhalten passende Leads das Starter-Angebot per E-Mail.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="security" className="py-20 md:py-24 border-t border-white/10 bg-white/[0.02]">
          <div className="max-w-5xl mx-auto px-6 lg:px-10">
            <div className="grid md:grid-cols-3 gap-5">
              {[
                [ShieldCheck, 'DSGVO', 'Datenschutz als Teil des Prüf- und Umbauprozesses.'],
                [Lock, 'EU AI Act', 'KI-Anforderungen werden im Ergebnis und später im Governance-Workspace berücksichtigt.'],
                [Check, 'Evidence', 'Der Weg vom Scan zum Ergebnis bleibt nachvollziehbar.'],
              ].map(([Icon, title, text]) => {
                const Component = Icon as typeof ShieldCheck;
                return <div key={title as string} className="p-6 rounded-2xl border border-white/10 bg-[rgb(3,7,18)]"><Component className="w-5 h-5 text-cyan-400 mb-4" /><h3 className="font-semibold">{title as string}</h3><p className="mt-2 text-sm text-white/55 leading-relaxed">{text as string}</p></div>;
              })}
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-extrabold">Zeig uns deine Website.</h2>
            <p className="mt-4 text-white/60">Wir zeigen dir zuerst das Ergebnis. Die Paketwahl kommt danach.</p>
            <Link to="/unified-entry/scan" className="mt-7 inline-flex items-center gap-2 px-7 py-3.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-[rgb(3,7,18)] font-bold transition-colors">
              Domain prüfen <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <span>© 2026 RealSync Dynamics.AI</span>
          <div className="flex gap-5"><Link to="/impressum">Impressum</Link><Link to="/datenschutz">Datenschutz</Link><Link to="/agb">AGB</Link></div>
        </div>
      </footer>
    </div>
  );
}
