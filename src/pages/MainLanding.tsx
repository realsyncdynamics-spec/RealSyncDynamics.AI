import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Code2,
  Database,
  Eye,
  FileCheck2,
  Globe2,
  Layers3,
  Lock,
  Scan,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { LandingChannelTools } from '../components/landing/LandingChannelTools';
import { ONE_TIME_PRICING_TIERS } from '../config/pricing';

const BG = 'rgb(3, 7, 18)';
const SANS = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

const TRANSFORMATION_STEPS = [
  ['01', 'Website eingeben', 'Eine öffentliche URL genügt. Kein Login vor dem ersten Ergebnis.'],
  ['02', 'AI analysiert', 'Playwright erfasst technische Evidence; Gemini bewertet relevante Signale.'],
  ['03', 'Neue Website entsteht', 'SiteOS rendert aus der validierten PageSpec vier echte Designrichtungen.'],
  ['04', 'Sie entscheiden', 'Varianten vergleichen, Transformation starten und anschließend kontrolliert veröffentlichen.'],
];

const INFRASTRUCTURE = [
  ['Playwright', 'Evidence Capture', 'DOM, Ressourcen, Requests und technische Signale werden reproduzierbar erfasst.', Scan],
  ['Gemini', 'AI Reasoning', 'Findings und Brand-Signale werden in einen strukturierten PageSpec überführt.', WandSparkles],
  ['SiteOS', 'Deterministic Rendering', 'Der PageSpec wird deterministisch aus validierten Komponenten gerendert — kein freies HTML.', Layers3],
  ['Governance Gate', 'Publish Control', 'Evidence, Build, Tenant, Payment und Backend-Preservation werden vor Publish geprüft.', ShieldCheck],
];

const PRESERVED = ['Backend', 'API', 'Authentifizierung', 'Datenbank', 'Business Logic'];

export function MainLanding() {
  const navigate = useNavigate();
  const [domain, setDomain] = useState('');

  const transformationPlan = useMemo(
    () => ONE_TIME_PRICING_TIERS.find((tier) => tier.plan.id === 'governance_launch' || tier.planKey === 'governance_launch'),
    [],
  );

  const startScan = (event: FormEvent) => {
    event.preventDefault();
    const value = domain.trim();
    navigate(value ? `/unified-entry/scan?domain=${encodeURIComponent(value)}` : '/unified-entry/scan');
  };

  return (
    <div className="landing-context min-h-screen bg-[rgb(3,7,18)] text-white antialiased" style={{ backgroundColor: BG, fontFamily: SANS }}>
      <SEOHead
        title="RealSyncDynamics.AI — AI Website Transformation & Governance"
        description="Website eingeben, technische und Compliance-Signale erkennen und daraus eine moderne neue Landingpage erzeugen. RealSyncDynamics.AI modernisiert die Präsentationsschicht und lässt Backend, API, Authentifizierung und Datenbank unverändert."
        canonical="/"
        ogTitle="Ihre Website. Neu gedacht. Sofort sichtbar."
        ogDescription="AI Website Transformation mit Evidence, Gemini, SiteOS und Governance Gate."
      />

      <header className="absolute inset-x-0 top-0 z-30 border-b border-white/5 bg-black/10 backdrop-blur-sm">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
          <Link to="/" className="flex items-center gap-2.5" aria-label="RealSyncDynamics.AI Startseite">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10">
              <Sparkles className="h-5 w-5 text-cyan-300" />
            </div>
            <span className="text-base font-semibold tracking-tight sm:text-lg">RealSync<span className="font-normal text-white/70">Dynamics.AI</span></span>
          </Link>
          <nav className="hidden items-center gap-7 md:flex" aria-label="Hauptnavigation">
            <a href="#transformation" className="text-sm text-white/60 transition hover:text-white">Transformation</a>
            <a href="#how-it-works" className="text-sm text-white/60 transition hover:text-white">So funktioniert&apos;s</a>
            <a href="#infrastructure" className="text-sm text-white/60 transition hover:text-white">Engine</a>
            <Link to="/pricing" className="text-sm text-white/60 transition hover:text-white">Preise</Link>
            <Link to="/welcome" className="text-sm text-white/60 transition hover:text-white">Login</Link>
            <a href="#scan" className="rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-[rgb(3,7,18)] transition hover:bg-cyan-300">Website analysieren <ArrowRight className="ml-1 inline h-4 w-4" /></a>
          </nav>
        </div>
      </header>

      <main>
        <section id="scan" className="relative min-h-[860px] overflow-hidden">
          <div className="absolute inset-0">
            <picture>
              <source srcSet="/europe-globe.webp" type="image/webp" />
              <img src="/europe-globe.jpg" alt="Digitale Verbindungen über Europa" width={1376} height={768} fetchPriority="high" className="h-full w-full object-cover object-right opacity-55" />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/95 to-black/45" />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgb(3,7,18)] via-transparent to-black/50" />
          </div>

          <div className="relative z-10 mx-auto grid min-h-[860px] max-w-7xl items-center gap-12 px-6 pb-16 pt-28 lg:grid-cols-[.9fr_1.1fr] lg:px-10">
            <div className="max-w-3xl">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.2em] text-cyan-300">
                <Globe2 className="h-3.5 w-3.5" /> AI Website Transformation
              </div>
              <h1 className="text-5xl leading-[.96] tracking-[-.04em] sm:text-6xl lg:text-8xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>
                Ihre Website.<br />
                <span className="text-cyan-400">Neu gedacht.</span><br />
                Sofort sichtbar.
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-relaxed text-white/65 sm:text-lg">
                Geben Sie Ihre Website ein. RealSyncDynamics.AI erkennt technische, SEO-, Datenschutz-, Performance- und Accessibility-Signale und erzeugt daraus eine moderne neue Landingpage.
              </p>

              <form onSubmit={startScan} className="mt-8 max-w-2xl">
                <div className="flex flex-col gap-2 rounded-2xl border border-white/15 bg-black/45 p-2 shadow-2xl backdrop-blur-xl sm:flex-row">
                  <input
                    value={domain}
                    onChange={(event) => setDomain(event.target.value)}
                    placeholder="https://ihre-website.de"
                    aria-label="Website-URL für die Transformation"
                    className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/30"
                  />
                  <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-6 py-3.5 text-sm font-bold text-[rgb(3,7,18)] transition hover:bg-cyan-300">
                    Website analysieren <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-white/35">Kostenloser Erstscan · kein Login erforderlich · URL genügt</p>
              </form>

              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/45">
                <span>✓ DSGVO-Signale</span>
                <span>✓ SEO &amp; Performance</span>
                <span>✓ Accessibility</span>
                <span>✓ AI Governance</span>
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="ml-auto max-w-xl rounded-[2rem] border border-white/15 bg-black/40 p-4 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-white/10 px-2 pb-3">
                  <span className="font-mono text-[10px] tracking-[.22em] text-cyan-300">AI WEBSITE STUDIO</span>
                  <span className="flex items-center gap-2 text-[10px] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> LIVE PREVIEW</span>
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white">
                  <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="h-2 w-2 rounded-full bg-red-300" /><span className="h-2 w-2 rounded-full bg-amber-300" /><span className="h-2 w-2 rounded-full bg-emerald-300" />
                    <div className="ml-2 flex-1 rounded-md bg-white px-3 py-1 font-mono text-[9px] text-slate-400">ihre-website.de → neue Landingpage</div>
                  </div>
                  <div className="grid min-h-[390px] grid-cols-[.36fr_.64fr] bg-slate-50">
                    <div className="border-r border-slate-200 bg-white p-5">
                      <div className="text-[9px] font-bold uppercase tracking-[.2em] text-cyan-600">BEFORE</div>
                      <div className="mt-4 space-y-2 opacity-50"><div className="h-3 w-4/5 rounded bg-slate-300" /><div className="h-2 w-full rounded bg-slate-200" /><div className="h-2 w-5/6 rounded bg-slate-200" /><div className="mt-8 h-28 rounded-xl bg-slate-100" /><div className="h-2 w-full rounded bg-slate-200" /></div>
                    </div>
                    <div className="p-5">
                      <div className="flex items-center justify-between"><div className="text-[9px] font-bold uppercase tracking-[.2em] text-cyan-600">AFTER</div><span className="rounded-full bg-cyan-50 px-2 py-1 text-[8px] font-bold text-cyan-700">AI GENERATED</span></div>
                      <div className="mt-5 rounded-2xl bg-slate-950 p-5 text-white shadow-xl"><div className="h-2 w-20 rounded bg-cyan-400" /><div className="mt-5 text-2xl font-semibold leading-tight">Klarer.<br /><span className="text-cyan-300">Moderner.</span><br />Konvertierender.</div><div className="mt-4 h-2 w-full rounded bg-white/10" /><div className="mt-2 h-2 w-4/5 rounded bg-white/10" /><div className="mt-6 inline-flex rounded-full bg-cyan-400 px-3 py-2 text-[8px] font-bold text-slate-950">Mehr erfahren →</div></div>
                      <div className="mt-3 flex gap-2"><span className="rounded-full bg-white px-3 py-1 text-[8px] font-semibold text-slate-600 shadow-sm">Executive</span><span className="rounded-full bg-white px-3 py-1 text-[8px] font-semibold text-slate-600 shadow-sm">Modern</span><span className="rounded-full bg-white px-3 py-1 text-[8px] font-semibold text-slate-600 shadow-sm">Authority</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="transformation" className="border-y border-white/10 bg-white py-20 text-slate-950 md:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[.25em] text-cyan-600">DAS PRODUKT</p>
                <h2 className="mt-3 text-4xl tracking-tight sm:text-5xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>Aus Ihrer bestehenden Website wird eine <span className="text-cyan-600">neue Präsentationsschicht.</span></h2>
                <p className="mt-5 max-w-xl leading-relaxed text-slate-600">Nicht noch ein AI-HTML-Generator. Evidence wird analysiert, eine PageSpec erzeugt und anschließend deterministisch gerendert.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {TRANSFORMATION_STEPS.map(([number, title, text]) => (
                  <div key={number} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                    <span className="font-mono text-xs font-bold text-cyan-600">{number}</span>
                    <h3 className="mt-3 text-base font-semibold">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <LandingChannelTools />

        <section id="how-it-works" className="bg-[rgb(3,7,18)] py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="mb-12 max-w-3xl">
              <p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">SCAN → GENERATE → COMPARE</p>
              <h2 className="mt-3 text-4xl tracking-tight sm:text-5xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>Der Scan findet die Probleme. <span className="text-cyan-400">Die AI baut die Alternative.</span></h2>
              <p className="mt-5 leading-relaxed text-white/55">Der eigentliche Mehrwert entsteht zwischen Befund und neuer Website: vier PageSpec-Varianten, ein deterministischer Renderer und eine echte Live-Preview.</p>
            </div>
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[.03] shadow-2xl">
              <div className="grid lg:grid-cols-2">
                <div className="border-b border-white/10 p-7 lg:border-b-0 lg:border-r lg:p-10">
                  <div className="flex items-center justify-between"><span className="font-mono text-[10px] tracking-[.2em] text-white/35">AUDIT EVIDENCE</span><span className="text-xs text-cyan-300">TECHNISCHE INDIKATOREN</span></div>
                  <div className="mt-7 space-y-3">
                    {['Datenschutz / Consent', 'SEO / Metadata', 'Performance / Resources', 'Accessibility', 'Third-Party / Tracking'].map((item) => (
                      <div key={item} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3"><span className="text-sm text-white/70">{item}</span><span className="font-mono text-[10px] text-cyan-300">EVIDENCE</span></div>
                    ))}
                  </div>
                </div>
                <div className="p-7 lg:p-10">
                  <div className="flex items-center justify-between"><span className="font-mono text-[10px] tracking-[.2em] text-cyan-300">GENERATED PAGE SPEC</span><span className="text-xs text-emerald-300">VALIDATED</span></div>
                  <div className="mt-7 grid gap-3 sm:grid-cols-2">
                    {['Executive', 'Modern', 'Authority', 'Minimal'].map((variant, index) => (
                      <div key={variant} className={`rounded-2xl border p-5 ${index === 1 ? 'border-cyan-400/50 bg-cyan-400/10' : 'border-white/10 bg-white/[.03]'}`}>
                        <div className="flex items-center justify-between"><span className="text-sm font-semibold">{variant}</span>{index === 1 && <span className="rounded-full bg-cyan-400 px-2 py-1 text-[8px] font-bold text-slate-950">FOCUS</span>}</div>
                        <div className="mt-5 h-16 rounded-xl bg-gradient-to-br from-white/10 to-white/[.02]" />
                        <p className="mt-3 text-[10px] text-white/40">SiteOS rendered preview</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white py-20 text-slate-950 md:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="grid gap-12 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[.25em] text-cyan-600">BACKEND PRESERVATION</p>
                <h2 className="mt-3 text-4xl tracking-tight sm:text-5xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>Wir bauen die <span className="text-cyan-600">Landingpage</span> neu. Nicht Ihr System.</h2>
                <p className="mt-5 max-w-2xl leading-relaxed text-slate-600">Die harte Systemgrenze lautet <strong className="text-slate-950">preserve_all</strong>. Die Transformation betrifft die Präsentationsschicht. Backend, APIs und Business Logic bleiben unangetastet.</p>
                <div className="mt-7 flex flex-wrap gap-2">{PRESERVED.map((item) => <span key={item} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700"><Check className="h-3.5 w-3.5 text-emerald-600" />{item}</span>)}</div>
              </div>
              <div className="rounded-3xl bg-slate-950 p-7 text-white shadow-2xl lg:p-9">
                <div className="flex items-center gap-3"><Database className="h-5 w-5 text-cyan-300" /><span className="font-mono text-[10px] tracking-[.2em] text-cyan-300">SYSTEM BOUNDARY</span></div>
                <div className="mt-7 space-y-3 font-mono text-xs">
                  <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4"><span className="text-cyan-300">FRONTEND</span><div className="mt-1 text-white/75">AI-generated → SiteOS → governed publish</div></div>
                  <div className="py-1 text-center text-white/25">──────── preserve_all ────────</div>
                  <div className="rounded-xl border border-white/10 bg-white/[.03] p-4"><span className="text-emerald-300">BACKEND</span><div className="mt-1 text-white/55">API · Auth · DB · Business Logic · unchanged</div></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="infrastructure" className="bg-[rgb(3,7,18)] py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="mb-12 max-w-3xl">
              <p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">DIE ENGINE</p>
              <h2 className="mt-3 text-4xl tracking-tight sm:text-5xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>Warum das mehr ist als ein <span className="text-cyan-400">AI Website Generator.</span></h2>
              <p className="mt-5 leading-relaxed text-white/55">Reasoning, Evidence und Rendering sind getrennt. Dadurch bleibt der Prozess reproduzierbar, überprüfbar und vor dem Publish governance-fähig.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {INFRASTRUCTURE.map(([name, role, text, Icon]) => {
                const InfrastructureIcon = Icon as typeof Scan;
                return <div key={name as string} className="rounded-2xl border border-white/10 bg-white/[.025] p-7"><InfrastructureIcon className="h-5 w-5 text-cyan-400" /><div className="mt-5 flex items-end justify-between gap-4"><div><h3 className="text-lg font-semibold">{name as string}</h3><p className="mt-1 font-mono text-[9px] uppercase tracking-[.2em] text-cyan-300/70">{role as string}</p></div><span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-1 font-mono text-[9px] text-emerald-300">GOVERNED</span></div><p className="mt-4 text-sm leading-relaxed text-white/50">{text as string}</p></div>;
              })}
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 bg-black py-20 md:py-28">
          <div className="mx-auto max-w-5xl px-6 text-center">
            <p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">WEBSITE TRANSFORMATION</p>
            <h2 className="mt-4 text-4xl tracking-tight sm:text-6xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>Sehen Sie zuerst, was aus Ihrer Website werden kann.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/55">Starten Sie mit der URL. Erst der Scan, dann die neue Website, dann Ihre Entscheidung.</p>
            <form onSubmit={startScan} className="mx-auto mt-8 flex max-w-2xl flex-col gap-2 rounded-2xl border border-white/15 bg-white/[.04] p-2 sm:flex-row">
              <input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="https://ihre-website.de" aria-label="Website-URL" className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/25" />
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-6 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300">Website analysieren <ArrowRight className="h-4 w-4" /></button>
            </form>

            {transformationPlan && (
              <div className="mx-auto mt-12 max-w-md rounded-3xl border border-cyan-400/25 bg-cyan-400/[.05] p-7 text-left shadow-2xl">
                <div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[9px] tracking-[.2em] text-cyan-300">TRANSFORMATION</p><h3 className="mt-2 text-xl font-semibold">Neue Landingpage</h3></div><span className="rounded-full bg-cyan-400 px-3 py-1 text-xs font-bold text-slate-950">{transformationPlan.priceString} €</span></div>
                <p className="mt-4 text-sm leading-relaxed text-white/55">Einmalig für die Website-Transformation. Der genaue Umfang folgt aus dem Scan und der gewählten Variante.</p>
                <Link to={transformationPlan.cta.href} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-50">Transformation starten <ArrowRight className="h-4 w-4" /></Link>
                <p className="mt-3 text-center text-[10px] text-white/30">Governance-Abos können anschließend separat oder als Bundle gewählt werden.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[rgb(3,7,18)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <div><div className="font-semibold text-white/70">RealSyncDynamics.AI</div><div className="mt-1">AI Website Transformation &amp; Governance</div></div>
          <div className="flex flex-wrap gap-5"><Link to="/pricing" className="hover:text-white">Preise</Link><Link to="/welcome" className="hover:text-white">Login</Link><Link to="/privacy" className="hover:text-white">Datenschutz</Link><Link to="/imprint" className="hover:text-white">Impressum</Link></div>
          <div>© {new Date().getFullYear()} RealSyncDynamics.AI</div>
        </div>
      </footer>
    </div>
  );
}
