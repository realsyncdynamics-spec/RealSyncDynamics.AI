import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck, Sparkles, PanelsTopLeft } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import '../styles/landing-v6.css';
import { getImplementation, STATUS_LABEL } from '../product/implementation-status';

/**
 * Governance-first Landing. Nur überprüfbare Kernfunktionen bewerben.
 * SiteOS bleibt Preview; Voice/Agent OS/Creative Studio werden hier nicht verkauft.
 * Backend-Deployment oder Registry-LIVE-Status allein ist kein E2E-Nachweis.
 */
const products = [
  {
    title: 'Governance Runtime',
    kicker: 'Vorhandenes Kernprodukt',
    description: 'Website-Risiken prüfen, KI-Systeme inventarisieren und Nachweise im Governance Workspace dokumentieren. Dauerüberwachung und einzelne Automationen sind noch nicht durchgängig freigegeben.',
    statusId: 'app-shell',
    proofLabel: 'Backend bereitgestellt · E2E offen',
    links: [
      { label: 'Kostenlosen Website-Check öffnen', href: '/audit?source=governance-first' },
      { label: 'Governance Dashboard öffnen', href: '/welcome?next=/app/dashboard' },
    ],
    icon: ShieldCheck,
    tone: 'bg-blue-50 text-blue-700',
  },
  {
    title: 'SiteOS Preview',
    kicker: 'Vorschau · Early Access',
    description: 'Ein Website-Entwurf mit Blueprint und responsiver Vorschau. Ein produktiver Kunden-Deploy, eigene Domain und automatisierte Veröffentlichung sind derzeit nicht nachgewiesen.',
    statusId: 'web-builder',
    proofLabel: 'Preview · kein Kunden-Deploy',
    links: [
      { label: 'Preview anfragen', href: '/kontakt?intent=siteos-preview&source=governance-first' },
      { label: 'Entwurfsoberfläche ansehen', href: '/build' },
    ],
    icon: PanelsTopLeft,
    tone: 'bg-indigo-50 text-indigo-700',
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
                <Sparkles className="h-4 w-4" aria-hidden="true" /> Governance-first · Nachweise statt Versprechen
              </span>
              <h1 className="mt-8 max-w-[960px] text-5xl font-semibold leading-[1.07] tracking-[-0.045em] text-slate-950 sm:text-6xl lg:text-[80px]">
                Website- und KI-Risiken prüfen.<br />
                <span className="text-blue-700">Nachweise dokumentieren.</span>
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                RealSync Dynamics & AI unterstützt die technische Prüfung von Websites und KI-Systemen sowie die Nachweisführung. Eine rechtliche Konformitätsgarantie ist damit nicht verbunden.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link to="/audit?source=governance-first-hero" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-700 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-700/15 hover:bg-blue-800">
                  Kostenlosen Scan starten <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link to="/kontakt?intent=siteos-preview&source=governance-first-hero" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 hover:border-blue-500">
                  SiteOS Preview anfragen
                </Link>
              </div>
              <p className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Governance-Backend bereitgestellt · Kundenabläufe werden geprüft</span>
                <span className="inline-flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-slate-500" /> Telefonie und Creative Studio derzeit nicht freigegeben</span>
              </p>
            </div>
          </section>

          <section id="plattform" className="border-y border-slate-200 bg-white/80 py-20">
            <div className="mx-auto max-w-7xl px-5 sm:px-8">
              <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Öffentliche Produktübersicht</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Nur vorhandene Funktionen hervorheben.</h2>
                </div>
                <p className="max-w-lg text-sm leading-6 text-slate-500">
                  Governance ist der Hauptzugang. SiteOS wird ausschließlich als Vorschau dargestellt;
                  ein Kunden-Deploy wird nicht zugesichert.
                </p>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                {products.map((product) => (
                  <article key={product.title} className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl hover:shadow-slate-200/60 sm:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${product.tone}`}>
                        <product.icon className="h-7 w-7" aria-hidden="true" />
                      </div>
                      <span className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">{getImplementation(product.statusId) ? product.proofLabel : STATUS_LABEL['coming-soon']}</span>
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
                  Die Module für Voice/Telefonie, WhatsApp, Agent OS, Code-Automation sowie Bild- und Videoerstellung
                  sind derzeit kein öffentlich freigegebenes Self-Service-Angebot. Sie erscheinen erst nach dokumentiertem End-to-End-Test, Berechtigungsprüfung und Betriebsfreigabe als buchbare Produkte.
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
      </div>
    </>
  );
}
