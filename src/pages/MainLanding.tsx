import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { ArrowRight, Check, Lock, Scan, ShieldCheck, Snowflake } from 'lucide-react';

const BG = 'rgb(3, 7, 18)';
const FONT_STACK = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

/**
 * Governance-first public landing page.
 *
 * The public entry point positions RealSyncDynamics.AI as an AI Governance
 * Runtime: continuous control, policy enforcement and auditable evidence.
 * The existing URL scan remains the primary conversion path.
 */
export function MainLanding() {
  const navigate = useNavigate();
  const [domain, setDomain] = useState('');

  const startScan = (event: React.FormEvent) => {
    event.preventDefault();
    const value = domain.trim();
    navigate(value
      ? `/unified-entry/scan?domain=${encodeURIComponent(value)}`
      : '/unified-entry/scan');
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
            <a href="#how" className="text-sm text-white/65 hover:text-white transition-colors">Governance</a>
            <a href="#controls" className="text-sm text-white/65 hover:text-white transition-colors">Kontrollen</a>
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
              <Scan className="w-3.5 h-3.5" /> AI Governance Runtime
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.04] tracking-tight">
              KI nicht nur prüfen.{' '}
              <span className="text-cyan-400">KI kontrollieren.</span>
            </h1>

            <p className="max-w-3xl mx-auto mt-6 text-base sm:text-lg md:text-xl text-white/68 leading-relaxed">
              RealSyncDynamics.AI ist die operative Governance-Schicht für KI-Systeme,
              Datenverarbeitung und digitale Prozesse – mit kontinuierlichen DSGVO-,
              EU-AI-Act- und Policy-Kontrollen.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/45">
              <span>✓ Continuous Governance</span>
              <span>✓ Policy Enforcement</span>
              <span>✓ Audit Evidence</span>
              <span>✓ EU AI Act</span>
            </div>

            <form onSubmit={startScan} className="max-w-3xl mx-auto mt-10">
              <div className="flex flex-col sm:flex-row gap-3 p-2 rounded-2xl border border-white/15 bg-black/35 backdrop-blur-xl shadow-2xl">
                <input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="Governance-Einstieg: z. B. realsyncdynamicsai.de" aria-label="Website-URL für Governance-Scan" className="flex-1 min-w-0 px-5 py-4 bg-transparent text-white placeholder:text-white/35 outline-none text-base" />
                <button type="submit" className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[rgb(3,7,18)] font-bold transition-colors">
                  Governance starten <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>

            <p className="mt-4 text-xs text-white/40">URL zuerst · Kein Account vor dem Einstieg · Ergebnis in Minuten</p>
          </div>
        </section>

        <section id="how" className="py-20 md:py-28 border-y border-white/10 bg-white/[0.02]">
          <div className="max-w-6xl mx-auto px-6 lg:px-10">
            <div className="max-w-3xl mb-12">
              <p className="font-mono text-[10px] tracking-[0.25em] text-cyan-400 mb-3">GOVERNANCE RUNTIME</p>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Von der KI-Nutzung zur kontrollierten KI-Organisation.</h2>
              <p className="mt-4 text-white/60 leading-relaxed">KI-Governance endet nicht bei einer Prüfung. RealSyncDynamics.AI verbindet Erkennung, Risikobewertung, Policies, Enforcement und Evidence zu einem durchgängigen operativen Kontrollprozess.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                ['01', 'DISCOVER', 'KI-Systeme, Anwendungen, Datenflüsse und relevante Verarbeitungsvorgänge erfassen.'],
                ['02', 'ASSESS', 'Risiken bewerten und Systeme gegen definierte Governance-, DSGVO- und EU-AI-Act-Kriterien prüfen.'],
                ['03', 'GOVERN', 'Verbindliche Policies, Verantwortlichkeiten und Kontrollanforderungen zentral definieren.'],
                ['04', 'ENFORCE', 'Governance-Regeln operativ durchsetzen und Abweichungen kontrolliert behandeln.'],
                ['05', 'EVIDENCE', 'Prüfungen, Entscheidungen, Änderungen und Kontrollen nachvollziehbar dokumentieren.'],
                ['06', 'AUDIT', 'Eine konsistente Governance-Historie für interne Kontrollen, Management und Audits bereitstellen.'],
              ].map(([no, title, text]) => (
                <div key={no} className="p-7 rounded-2xl border border-white/10 bg-white/[0.02]">
                  <span className="font-mono text-3xl font-bold text-cyan-400/25">{no}</span>
                  <h3 className="mt-4 text-lg font-semibold tracking-wide">{title}</h3>
                  <p className="mt-2 text-sm text-white/58 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="controls" className="py-20 md:py-24 border-t border-white/10">
          <div className="max-w-6xl mx-auto px-6 lg:px-10">
            <div className="max-w-2xl mb-12">
              <p className="font-mono text-[10px] tracking-[0.25em] text-cyan-400 mb-3">OPERATIONAL CONTROL</p>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Governance, die tatsächlich läuft.</h2>
              <p className="mt-4 text-white/60 leading-relaxed">Compliance wird vom Dokument zum ausführbaren Kontrollmechanismus.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                [ShieldCheck, 'DSGVO', 'Datenschutz wird zum operativen Kontrollbestandteil: Verarbeitung, Risiko, Policy und Evidence im laufenden Governance-Prozess.'],
                [Lock, 'EU AI Act', 'KI-Systeme werden strukturiert bewertet und gegen relevante Governance- und Compliance-Anforderungen kontrolliert.'],
                [Check, 'POLICY ENGINE', 'Governance-Regeln werden nicht nur dokumentiert, sondern als ausführbare Kontrolllogik in den Runtime-Prozess integriert.'],
                [ShieldCheck, 'CONTINUOUS MONITORING', 'Veränderungen, neue Risiken und Governance-Abweichungen werden kontinuierlich erkennbar.'],
                [Lock, 'ENFORCEMENT', 'Von der Erkennung bis zur definierten Reaktion: Regeln werden operativ durchgesetzt.'],
                [Check, 'AUDIT EVIDENCE', 'Jede relevante Governance-Aktion erzeugt nachvollziehbare Nachweise für Management und Audit.'],
              ].map(([Icon, title, text]) => {
                const Component = Icon as typeof ShieldCheck;
                return <div key={title as string} className="p-6 rounded-2xl border border-white/10 bg-[rgb(3,7,18)]"><Component className="w-5 h-5 text-cyan-400 mb-4" /><h3 className="font-semibold">{title as string}</h3><p className="mt-2 text-sm text-white/55 leading-relaxed">{text as string}</p></div>;
              })}
            </div>
          </div>
        </section>

        <section className="py-20 border-y border-white/10 bg-white/[0.02]">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <p className="font-mono text-[10px] tracking-[0.25em] text-cyan-400 mb-4">ONE GOVERNANCE PLANE</p>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Ihr KI-Betrieb. Eine Governance-Ebene.</h2>
            <p className="mt-5 text-white/60 text-lg leading-relaxed">DISCOVER → ASSESS → GOVERN → ENFORCE → EVIDENCE → AUDIT</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-white/55">
              <span className="px-4 py-2 rounded-full border border-white/10">Governance statt Checkliste</span>
              <span className="px-4 py-2 rounded-full border border-white/10">Compliance statt Selbstauskunft</span>
              <span className="px-4 py-2 rounded-full border border-white/10">Evidence statt Behauptung</span>
              <span className="px-4 py-2 rounded-full border border-white/10">Enforcement statt Empfehlung</span>
            </div>
            <Link to="/unified-entry/scan" className="mt-9 inline-flex items-center gap-2 px-7 py-3.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-[rgb(3,7,18)] font-bold transition-colors">
              Governance Runtime starten <ArrowRight className="w-4 h-4" />
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
