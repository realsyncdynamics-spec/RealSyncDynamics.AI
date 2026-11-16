import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Code2, LockKeyhole, ShieldCheck, Sparkles, Mic2, PanelsTopLeft, Blocks, Clapperboard } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { CompanyVoiceWidget } from '../components/landing/v6/CompanyVoiceWidget';
import '../styles/landing-v6.css';
import { getImplementation, STATUS_LABEL } from '../product/implementation-status';

/**
 * Unified platform landing (light) — 16.11.2026.
 * Die öffentliche Oberfläche stellt sechs getrennte, verknüpfte Produkte dar.
 * Der Status kommt aus der Registry, keine Live-Claims für Pilotmodule.
 * Keine zweite Builder- oder Media-Runtime: alle Ziele zeigen auf bestehende
 * Routen bzw. auf den gesicherten Creative-Studio-Entwurf dieses PRs.
 * Der Umsetzungsstatus kommt aus der produktweiten Registry.
 */
const products = [
  {
    title: 'AI Voice Agent',
    kicker: 'Kunden erreichen',
    description: 'Eigenen Sprachassistenten für Anfragen und Telefonie vorbereiten. Die produktive Telefonanbindung ist noch nicht freigegeben.',
    statusId: 'voice-telephony',
    links: [{ label: 'Voice Agent entdecken', href: '/phonebot/start' }],
    icon: Mic2,
    tone: 'bg-cyan-50 text-cyan-800',
  },
  {
    title: 'AI App Builder',
    kicker: 'Apps entwickeln',
    description: 'Web-Apps und interne Anwendungen im bestehenden RealSync SiteOS-Workspace entwerfen und weiterentwickeln.',
    statusId: 'web-builder',
    links: [{ label: 'App Builder öffnen', href: '/build' }],
    icon: Blocks,
    tone: 'bg-indigo-50 text-indigo-700',
  },
  {
    title: 'AI Landingpage Designer',
    kicker: 'Websites gestalten',
    description: 'Landingpages, Produktpräsentationen und Websites im bestehenden Designer erstellen. 3D-Beispiele können bereits erkundet werden.',
    statusId: 'web-builder',
    links: [
      { label: 'Landingpage gestalten', href: '/build' },
      { label: '3D-Beispiel ansehen', href: '/demo/3d-landingpage' },
      { label: 'Individuelles Webdesign', href: '/frontend-builder' },
    ],
    icon: PanelsTopLeft,
    tone: 'bg-pink-50 text-pink-700',
  },
  {
    title: 'Claude Code Optimizer',
    kicker: 'Code prüfen',
    description: 'Website-Audit mit Befundübersicht. Automatische GitHub-Repository-Analyse, Codeänderungen und Pull Requests sind noch in Vorbereitung.',
    statusId: 'cloud-code-optimizer',
    links: [{ label: 'Optimizer ansehen', href: '/claude-code-optimizer' }],
    icon: Code2,
    tone: 'bg-violet-50 text-violet-700',
  },
  {
    title: 'Governance Dashboard',
    kicker: 'Kontrollieren',
    description: 'KI-Systeme, Risiken, Policies, Freigaben und Nachweise im zentralen, mandantenbezogenen Workspace verwalten.',
    statusId: 'app-shell',
    links: [{ label: 'Governance Dashboard öffnen', href: '/app/dashboard' }],
    icon: ShieldCheck,
    tone: 'bg-blue-50 text-blue-700',
  },
  {
    title: 'AI Creative Studio',
    kicker: 'Bilder und Videos',
    description: 'Werbemotive für Uhren und Parfüm sowie Clips für Neueröffnungen und Kampagnen vorbereiten. xAI-Generierung ist vorerst nur ein gesicherter Pilot.',
    statusId: 'creative-studio',
    links: [
      { label: 'Bilder erstellen', href: '/app/media-studio?type=image' },
      { label: 'Videos erstellen', href: '/app/media-studio?type=video' },
    ],
    icon: Clapperboard,
    tone: 'bg-amber-50 text-amber-700',
  },
] as const;

export function UnifiedPlatformLanding() {
  return (
    <>
      <SEOHead />
      <div className="min-h-screen bg-[#f7f9fc] text-[#14233b]" data-testid="unified-platform-landing">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] overflow-hidden" aria-hidden="true">
          <div className="absolute -top-60 -right-32 h-[600px] w-[600px] rounded-full bg-indigo-100/70 blur-3xl" />
          <div className="absolute left-[-140px] top-24 h-[450px] w-[450px] rounded-full bg-cyan-100/60 blur-3xl" />
        </div>
        <header className="relative z-10 border-b border-slate-200/80 bg-white/75 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
            <Link to="/" className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl" aria-label="RealSync Dynamics AI Startseite">
              RealSync <span className="text-blue-700">Dynamics & AI</span>
            </Link>
            <nav aria-label="Hauptnavigation" className="flex items-center gap-3 text-sm sm:gap-6">
              <a href="#plattform" className="hidden font-medium text-slate-600 hover:text-blue-700 sm:inline">Plattform</a>
              <Link to="/pricing" className="hidden font-medium text-slate-600 hover:text-blue-700 sm:inline">Preise</Link>
              <Link to="/welcome?next=/app/dashboard" className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-800 hover:border-blue-500 sm:px-5">
                Anmelden
              </Link>
            </nav>
          </div>
        </header>

        <main className="relative z-10">
          <section className="mx-auto max-w-7xl px-5 pb-20 pt-20 sm:px-8 sm:pt-28 lg:pb-24">
            <div className="max-w-4xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/90 px-4 py-2 text-xs font-bold uppercase tracking-[0.13em] text-blue-700 shadow-sm">
                <Sparkles className="h-4 w-4" aria-hidden="true" /> Eine Plattform. Sechs Produktbereiche.
              </span>
              <h1 className="mt-8 max-w-[960px] text-5xl font-semibold leading-[1.07] tracking-[-0.045em] text-slate-950 sm:text-6xl lg:text-[80px]">
                KI gestalten.<br />
                Kunden erreichen.<br />
                <span className="text-blue-700">Arbeit vereinfachen.</span>
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                RealSync Dynamics & AI verbindet Voice Agent, App Builder, Landingpage Designer,
                Code Optimizer, Governance und Creative Studio in einem Workspace.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link to="/app/dashboard" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-700 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-700/15 hover:bg-blue-800">
                  Workspace öffnen <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a href="#plattform" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 hover:border-blue-500">
                  Funktionen entdecken
                </a>
              </div>
              <p className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Bestehende Governance-Tools bleiben erhalten</span>
                <span className="inline-flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-slate-500" /> Medien-APIs nur serverseitig</span>
              </p>
            </div>
          </section>

          <section id="plattform" className="border-y border-slate-200 bg-white/80 py-20">
            <div className="mx-auto max-w-7xl px-5 sm:px-8">
              <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Ihre Werkzeuge</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Alles unter einem Dach.</h2>
                </div>
                <p className="max-w-lg text-sm leading-6 text-slate-500">
                  Vorhandene Builder und Governance-Werkzeuge bleiben erhalten. Die Bild- und Videoerstellung
                  wird nur nach technischer Freigabe mit einem Provider aktiviert.
                </p>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                {products.map((product) => (
                  <article key={product.title} className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl hover:shadow-slate-200/60 sm:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${product.tone}`}>
                        <product.icon className="h-7 w-7" aria-hidden="true" />
                      </div>
                      <span className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">{STATUS_LABEL[getImplementation(product.statusId)?.status ?? 'coming-soon']}</span>
                    </div>
                    <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">{product.kicker}</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{product.title}</h3>
                    <p className="mt-3 min-h-12 text-base leading-7 text-slate-600">{product.description}</p>
                    <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
                      {product.links.map((link) => (
                        <Link key={link.href} to={link.href} className="inline-flex items-center gap-2 font-semibold text-blue-700 hover:text-blue-900">
                          {link.label} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                        </Link>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
            <div className="rounded-3xl bg-[#152c50] p-8 text-white sm:p-12 lg:flex lg:items-center lg:justify-between lg:gap-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-200">RealSync Workspace</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Ein Zugang. Klare Arbeitsbereiche.</h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
                  Bestehende Mandanten, Nachweise und Governance-Funktionen bleiben erhalten.
                  Neue Medienfunktionen werden schrittweise angebunden — ohne unsichere API-Schlüssel im Frontend.
                </p>
              </div>
              <Link to="/welcome?next=/app/dashboard" className="mt-7 inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 font-semibold text-blue-900 hover:bg-blue-50 lg:mt-0">
                Zur Anmeldung <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </section>
        </main>
        <footer className="border-t border-slate-200 bg-white px-5 py-8 text-sm text-slate-500 sm:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
            <span>© 2026 RealSync Dynamics & AI</span>
            <div className="flex flex-wrap gap-6">
              <Link to="/legal/impressum" className="hover:text-blue-700">Impressum</Link>
              <Link to="/legal/datenschutz" className="hover:text-blue-700">Datenschutz</Link>
              <Link to="/pricing" className="hover:text-blue-700">Preise</Link>
            </div>
          </div>
        </footer>
        {/* Der bestehende öffentliche Voice-Bot muss bei der neuen Landing
            erhalten bleiben. Der unsichtbare 0-Höhen-Wrapper liefert die
            unveränderten v6-Farb-Tokens; Launcher/Dialog bleiben fixed.
            Keine neue Voice-API und kein zusätzliches Voice-Backend. */}
        <div className="lv6" data-rs-theme="light" data-rs-accent="cyan" style={{ minHeight: 0 }}>
          <CompanyVoiceWidget />
        </div>
      </div>
    </>
  );
}
