import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Sparkles, FileSearch, Layers, Tag,
  Cookie, Brain, FileCheck2, Activity,
} from 'lucide-react';
import { Logo } from './Logo';
import { Modal } from './ui/Modal';
import { HowItWorks3Steps } from './HowItWorks3Steps';
import { ProTeamsPanel } from './panels/ProTeamsPanel';
import { ComplianceCenterPanel } from './panels/ComplianceCenterPanel';
import { EnterprisePanel } from './panels/EnterprisePanel';
import { AIActPanel } from './panels/AIActPanel';
import { GovernanceRuntimePanel } from './panels/GovernanceRuntimePanel';
import { PricingTeaserSection } from './sections/PricingTeaserSection';
import { PilotPartnersPlaceholder } from './sections/PilotPartnersPlaceholder';
import { RoadmapSection } from './sections/RoadmapSection';

/**
 * HeroOnly — Hero-Bühne + zwei Long-Form-Sections.
 *
 * Bis #104 war das eine reine Single-Viewport-Erfahrung. Mit dem Pivot
 * auf Firmen-Targeting werden zwei Sektionen unter dem Hero ergänzt
 * (Zielgruppen + FAQ), während Modals als Tiefenkanäle erhalten bleiben.
 * Hero füllt weiterhin den ersten Viewport (`flex-1 justify-center`),
 * Sektionen darunter sind Scroll-Content.
 *
 * Layout:
 *   - Top-Bar: Mini-Nav (links) + Audit-CTA (rechts)
 *   - Hero (viewport-zentriert): Logo · Headline · Subline · CTAs ·
 *     Mid-Buttons · Trust-Leiste
 *   - Sektion „Zielgruppen": 3-Card-Grid für SaaS / Agenturen / lokale Betriebe
 *   - Sektion „So funktioniert": 3-Step-Erklärer + CTA
 *   - Sektion „Leistungen" (Was Sie bekommen): 4-Card-Grid mit Icons
 *   - Sektion „Gründe" (Warum Firmen uns nutzen): 3 Pain-Point-Cards + Beta-Hinweis
 *   - Sektion „Preise": Tier-Teaser (Free Audit / Starter / Growth / Enterprise) + Link zu /pricing
 *   - Sektion „FAQ": 3 details-summary Q&A-Pairs + Schluss-CTA
 *   - Footer: Legal- + Free-Tool-Links
 *
 * Farb-System: Schwarz/Gold/Silber (additiv-getypt, beeinflusst nur
 * diese Component und Children).
 */
type ModalKey =
  | null
  | 'check'         // HowItWorks3Steps + WebsiteRebuildOffer
  | 'pricing'       // PricingShortPanel (4-Kachel)
  | 'example'       // ExampleReportPanel (GA4-Demo)
  | 'pro'           // ProTeamsPanel (Watchmaker-3-Pillars + AuditEngine-Tri-Layer)
  | 'compliance'    // ComplianceCenterPanel (Methodik / Grenzen / Sub-Processors / AVV)
  | 'enterprise'    // EnterprisePanel (Multi-Tenant / SLA / Procurement)
  | 'aiact'         // AIActPanel (Klassifikator + Workflow-Inventory + Doku-Pflichten)
  | 'runtime';      // GovernanceRuntimePanel (Event-driven Compliance Runtime)

export function HeroOnly() {
  const [openModal, setOpenModal] = useState<ModalKey>(null);

  return (
    <div className="bg-hero-only min-h-screen flex flex-col text-titanium-50">
      {/* ─── 1) Top Bar ─────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <nav className="flex items-center gap-1 sm:gap-3 text-xs sm:text-sm">
          <NavButton onClick={() => setOpenModal('check')}>Produkt</NavButton>
          <NavButton onClick={() => setOpenModal('runtime')} className="hidden sm:inline-flex">
            Runtime
          </NavButton>
          <NavButton onClick={() => setOpenModal('aiact')} className="hidden sm:inline-flex">
            AI-Act
          </NavButton>
          <NavButton onClick={() => setOpenModal('compliance')} className="hidden md:inline-flex">
            Compliance-Center
          </NavButton>
          <Link
            to="/pricing"
            className="px-2 sm:px-3 py-1.5 text-silver-300 hover:text-titanium-50 font-semibold transition-colors"
          >
            Preise
          </Link>
          <NavButton onClick={() => setOpenModal('enterprise')} className="hidden md:inline-flex">
            Enterprise
          </NavButton>
        </nav>

        <Link
          to="/audit?source=hero-top"
          className="surface-gold inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-none"
        >
          Audit starten <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* ─── 2-6) Hero — kein justify-center mehr (substance peek for scroll) */}
      <main className="px-4 sm:px-6 lg:px-8 py-10 sm:py-14 flex flex-col items-center">
        <div className="max-w-3xl w-full text-center">

          {/* Logo + Brand-Claim */}
          <div className="mb-10 flex flex-col items-center gap-3">
            <div className="logo-pulse">
              <Logo size={56} iconOnly />
            </div>
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-silver-400">
              RealSyncDynamics.AI · EU-Hosted Compliance Engine
            </div>
          </div>

          {/* Headline + Subline */}
          <h1 className="font-display font-bold text-4xl sm:text-6xl text-titanium-50 tracking-tight leading-[1.02] mb-5">
            Automatisierte DSGVO- und AI-Compliance für Websites, Shops und Unternehmen.
          </h1>
          <p className="text-base sm:text-lg text-silver-300 leading-relaxed max-w-2xl mx-auto mb-3">
            RealSyncDynamics.AI prüft Websites, Shops und digitale Prozesse auf Tracker,
            Consent-Risiken, Security-Header, Rechtsdokumente und AI-Governance-Pflichten —
            vom lokalen Betrieb bis zum Mittelstand.
          </p>
          <p className="text-sm text-silver-400 leading-relaxed max-w-2xl mx-auto mb-7 sm:mb-8">
            Continuous Monitoring statt jährlichem Audit. Klare To-dos statt juristischer Fachsprache.
            EU-gehostet, monatlich kündbar, keine Rechtsberatung — sondern technische Compliance-Härtung.
          </p>

          {/* Hostinger-Pattern: 2 big tappable rows (mobile-primary entry) */}
          <div className="mb-9 max-w-2xl mx-auto text-left">
            <Link
              to="/audit?source=hero-scan"
              className="group flex items-center justify-between gap-4 py-5 sm:py-6 border-t border-b border-silver-700/40 hover:border-amber-500/60 transition-colors"
            >
              <span className="text-xl sm:text-2xl font-display font-bold text-titanium-50 tracking-tight">
                Website jetzt scannen
              </span>
              <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6 text-silver-400 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0" />
            </Link>
            <Link
              to="/pricing?source=hero-plans"
              className="group flex items-center justify-between gap-4 py-5 sm:py-6 border-b border-silver-700/40 hover:border-amber-500/60 transition-colors"
            >
              <span className="text-xl sm:text-2xl font-display font-bold text-titanium-50 tracking-tight">
                Pläne &amp; Preise ansehen
              </span>
              <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6 text-silver-400 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0" />
            </Link>
          </div>

          {/* Primary + Secondary CTA */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-7">
            <Link
              to="/audit?source=hero-primary"
              className="surface-gold inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-bold rounded-none"
            >
              Jetzt kostenlosen Compliance-Check starten <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => setOpenModal('example')}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-silver-500 hover:border-gold-400 text-silver-100 hover:text-titanium-50 text-base font-semibold rounded-none transition-colors"
            >
              Beispiel-Report ansehen
            </button>
          </div>

          {/* Tertiary: Live Demo */}
          <div className="mb-9 -mt-3">
            <Link
              to="/governance-runtime"
              className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.18em] text-silver-400 hover:text-amber-300 transition-colors"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live Governance-Runtime öffnen <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Drei Mid-Buttons */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-10 max-w-xl mx-auto">
            <MidButton icon={<FileSearch className="h-3.5 w-3.5" />} label="Website-Check"      onClick={() => setOpenModal('check')} />
            <MidButton icon={<Layers     className="h-3.5 w-3.5" />} label="Für Profis & Teams" onClick={() => setOpenModal('pro')} />
            <MidButton icon={<Tag        className="h-3.5 w-3.5" />} label="Preise"             onClick={() => setOpenModal('pricing')} />
          </div>

          {/* Trust-Leiste */}
          <div className="text-[11px] sm:text-xs font-mono uppercase tracking-[0.18em] text-silver-500">
            EU-Datenresidenz · AVV inklusive · Continuous Monitoring · Made in Germany
          </div>

          {/* Stat-Bar — konkrete Zahlen, kein Marketing-Fluff */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-px bg-silver-700/30 max-w-2xl mx-auto">
            {[
              { num: '18', label: 'Tracker-Klassen' },
              { num: '5', label: 'AI-Vendoren überwacht' },
              { num: '62', label: 'SEO-Routes audited' },
              { num: '< 30s', label: 'Scan-Zeit' },
            ].map((s) => (
              <div key={s.label} className="bg-obsidian-950/80 px-2 py-3 text-center">
                <div className="font-display font-bold text-titanium-50 text-base sm:text-xl tabular-nums">
                  {s.num}
                </div>
                <div className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-silver-400 mt-0.5 leading-tight">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Pflicht-Disclaimer zum kostenlosen Audit */}
          <p className="mt-5 text-[11px] sm:text-xs text-silver-500 max-w-xl mx-auto leading-relaxed">
            Der kostenlose Audit ersetzt keine individuelle Rechtsberatung und keine vollständige technische Prüfung.
          </p>
        </div>
      </main>

      {/* ─── Sektion: Für wen RealSyncDynamics.AI gebaut ist ──────── */}
      <section
        id="zielgruppen"
        className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
              Zielgruppen
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight max-w-2xl mx-auto">
              Für wen RealSyncDynamics.AI gebaut ist
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {[
              {
                title: 'Kleine Unternehmen & lokale Betriebe',
                subtitle: 'Praxen · Restaurants · Handwerk · Dienstleister · Vereine · Shops',
                bullets: [
                  'Website-Risiken ohne Fachwissen erkennen',
                  'Klare To-dos statt juristischer Fachsprache',
                  'Günstiger Einstieg mit Free Audit oder Starter',
                  'Laufende Überwachung ohne eigene IT-Abteilung',
                ],
                href: '/audit?source=zielgruppe-smb',
              },
              {
                title: 'Mittelständische Unternehmen',
                subtitle: 'Mehrere Websites · Standorte · Tools · Dienstleister',
                bullets: [
                  'Zentrale Übersicht über Domains und Risiken',
                  'Monitoring statt einmaliger Prüfung',
                  'Audit-Trail für GF, IT und Datenschutzbeauftragte',
                  'Klare Priorisierung nach Risiko',
                ],
                href: '/contact-sales?intent=mittelstand',
              },
              {
                title: 'Multi-Domain-Teams',
                subtitle: 'Continuous Runtime über mehrere Kundenseiten',
                bullets: [
                  'White-Label-Reports',
                  'Multi-Tenant-Dashboard',
                  'Pre-Go-Live-Checks',
                  'Continuous Monitoring + Evidence-Chain',
                ],
                href: '/fuer-agenturen',
              },
              {
                title: 'SaaS- und AI-Unternehmen',
                subtitle: 'Tracking · APIs · KI-Funktionen · Modell-Calls',
                bullets: [
                  'AI-Usecase-Inventar',
                  'AI-Act-Klassifizierung (Annex III)',
                  'Drift-Detection für Production-Modelle',
                  'Evidence Records mit Hash-Chain',
                ],
                href: '/fuer-saas',
              },
              {
                title: 'Datenschutz-Profis & regulierte Branchen',
                subtitle: 'DSBs · Kanzleien · FinTech · HealthTech · EdTech',
                bullets: [
                  'Evidence Vault mit signierten Nachweisen',
                  'Exportfähige Audit-Reports',
                  'Governance Graph für Datenflüsse + Pflichten',
                  'Kontinuierliche Re-Evaluation',
                ],
                href: '/legal-tech',
              },
            ].map((item) => (
              <Link
                key={item.title}
                to={item.href}
                className="group p-5 sm:p-6 bg-obsidian-900/60 border border-silver-700/30 hover:border-gold-400/60 rounded-none transition-colors block flex flex-col"
              >
                <h3 className="font-display font-bold text-titanium-50 text-base sm:text-lg mb-1 leading-snug">
                  {item.title}
                </h3>
                <p className="text-[11px] font-mono uppercase tracking-wider text-silver-400 mb-3">
                  {item.subtitle}
                </p>
                <ul className="space-y-1.5 mb-3 flex-1">
                  {item.bullets.map((b) => (
                    <li key={b} className="text-sm text-silver-300 leading-relaxed flex items-start gap-2">
                      <span aria-hidden="true" className="text-gold-400 shrink-0 mt-1">▸</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-gold-400 group-hover:text-gold-300">
                  Mehr erfahren <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Sektion: So funktioniert (3 Steps) ─────────────────── */}
      <section
        id="so-funktioniert"
        className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
              So funktioniert
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight">
              Setup, Analyse, Output — in drei Schritten.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {[
              {
                title: 'Setup in 5 Minuten',
                body: 'Domain eintragen, Browser-Extension installieren oder Ingest-Key in deine API einbauen. Kein Agent auf deinem Server, kein Pull aus deinen Datenbanken — RealSync arbeitet mit dem, was im Browser oder Event-Stream sichtbar ist.',
              },
              {
                title: 'Tiefenanalyse über drei Ebenen',
                body: 'Website-Layer (Tracker, Cookies, Consent-Timing), API-Layer (Vendor-Endpunkte, AI-Modell-Calls) und KI-Layer (Usecase-Klassifizierung nach AI Act). Findings werden als Beziehungen im Governance Graph gespeichert, nicht als isolierte Issues.',
              },
              {
                title: 'Output zum Verarbeiten',
                body: 'Du bekommst To-dos für dein Team, Code-Snippets für deine Codebase und Evidence-Pakete für deinen Auditor. Continuous statt einmalig — bei jeder Änderung läuft der Loop neu.',
              },
            ].map((step, idx) => (
              <div
                key={step.title}
                className="relative p-5 sm:p-6 bg-obsidian-900/60 border border-silver-700/30 hover:border-gold-400/60 rounded-none transition-colors"
              >
                <div className="absolute -top-3 left-5 inline-flex items-center justify-center w-8 h-8 bg-gold-400 text-obsidian-950 font-display font-bold text-sm tabular-nums">
                  {idx + 1}
                </div>
                <h3 className="font-display font-bold text-titanium-50 text-base sm:text-lg mb-2 mt-2 leading-snug">
                  {step.title}
                </h3>
                <p className="text-sm text-silver-300 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              to="/audit?source=hero-steps"
              className="surface-gold inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-none"
            >
              Website jetzt scannen <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Sektion: Was Sie bekommen (4 Bullets) ───────────────── */}
      <section
        id="leistungen"
        className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
              Leistungen
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight">
              Mehr als ein Cookie-Scanner
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {[
              {
                Icon: Cookie,
                title: 'Vollständiger Website-Audit',
                body: 'Tracking, Cookies, Einbettungen, Formulare, Scripts und Tools — technisch analysiert und rechtlich eingeordnet.',
              },
              {
                Icon: Brain,
                title: 'KI-Workflow-Check',
                body: 'Wir dokumentieren Ihre KI-Usecases und helfen, sie in die Kategorien des EU AI Act einzuordnen.',
              },
              {
                Icon: FileCheck2,
                title: 'Audit-fähige Reports',
                body: 'Exportierbare Reports für interne Richtlinien, Datenschutzdokumentation und externe Prüfungen.',
              },
              {
                Icon: Activity,
                title: 'Kontinuierliches Monitoring',
                body: 'Auf Wunsch überwachen wir dauerhaft Änderungen an Ihrer Website und warnen, wenn neue Risiken auftauchen.',
              },
            ].map((feat) => (
              <div
                key={feat.title}
                className="p-5 sm:p-6 bg-obsidian-900/60 border border-silver-700/30 hover:border-gold-400/60 rounded-none transition-colors"
              >
                <feat.Icon className="h-5 w-5 text-gold-400 mb-3" />
                <h3 className="font-display font-bold text-titanium-50 text-base sm:text-lg mb-2 leading-snug">
                  {feat.title}
                </h3>
                <p className="text-sm text-silver-300 leading-relaxed">{feat.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Sektion: Warum Firmen uns nutzen ────────────────────── */}
      <section
        id="warum-uns"
        className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
              Gründe
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight">
              Typische Gründe, warum Firmen RealSyncDynamics.AI einsetzen
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {[
              'Sie wollen Bußgelder und Abmahnungen vermeiden, ohne ein eigenes Datenschutz-Team aufzubauen.',
              'Sie nutzen KI im Marketing oder Service und wissen nicht, ob das mit DSGVO und AI Act sauber abgedeckt ist.',
              'Sie brauchen eine verständliche Übersicht, die Geschäftsführung, IT und Marketing gleichzeitig verstehen.',
            ].map((reason) => (
              <div
                key={reason}
                className="p-5 sm:p-6 bg-obsidian-900/60 border-l-2 border-l-gold-400 border-y border-r border-silver-700/30 rounded-none"
              >
                <p className="text-sm sm:text-[15px] text-silver-200 leading-relaxed">{reason}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <p className="text-[11px] font-mono uppercase tracking-[0.25em] text-silver-500">
              Aktuell im Beta-Programm · Erste Referenzkunden 2026 Q3
            </p>
          </div>
        </div>
      </section>

      {/* ─── Sektion: Vom Scan zum Monitoring ─────────────────────── */}
      <section
        id="vom-scan-zum-monitoring"
        className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20"
      >
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
            Vom Einstieg zur Dauer-Überwachung
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight mb-5">
            Vom einmaligen Scan zum laufenden Compliance-Monitoring
          </h2>
          <p className="text-base sm:text-lg text-silver-300 leading-relaxed max-w-2xl mx-auto">
            Der kostenlose Audit zeigt erste Risiken. RealSyncDynamics.AI geht weiter: laufende Überwachung
            von Tracking-Änderungen, Consent-Risiken, Drittanbieter-Skripten und AI-Act-relevanten Workflows
            – mit nachvollziehbarem Audit-Trail.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/audit?source=monitoring-section"
              className="surface-gold inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-none"
            >
              Kostenlosen Audit starten <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact-sales?source=monitoring-anfrage"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-silver-500 hover:border-gold-400 text-silver-100 hover:text-titanium-50 text-sm font-semibold rounded-none transition-colors"
            >
              Monitoring anfragen
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Sektion: White-Label für Kanzleien ──────────────────── */}
      <section
        id="white-label"
        className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20"
      >
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-6">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
              Für Kanzleien & DSB
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight mb-5">
              White-Label Audits für Kanzleien und Datenschutzberater
            </h2>
            <p className="text-base sm:text-lg text-silver-300 leading-relaxed max-w-2xl mx-auto">
              RealSyncDynamics.AI unterstützt Datenschutz-Kanzleien, externe Datenschutzbeauftragte und
              Agenturen dabei, Mandanten-Websites technisch vorzuscannen, Risiken zu priorisieren und
              verständliche Executive-Briefs vorzubereiten — ohne eigene Scanner-Infrastruktur.
            </p>
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-8 max-w-xl mx-auto">
            {[
              'Technische Risikoanalyse',
              'Executive Briefs',
              'Audit-Historie',
              'Kontinuierliches Monitoring',
              'Mandantenfähige Reports',
            ].map((b) => (
              <li
                key={b}
                className="flex items-center gap-2 text-sm text-silver-200 bg-obsidian-900/60 border border-silver-700/30 px-3 py-2 rounded-none"
              >
                <span className="text-gold-400 text-xs">▸</span>
                {b}
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/contact-sales?source=white-label-pilot"
              className="surface-gold inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-none"
            >
              White-Label Pilot anfragen <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/audit?source=mandanten-website"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-silver-500 hover:border-gold-400 text-silver-100 hover:text-titanium-50 text-sm font-semibold rounded-none transition-colors"
            >
              Mandanten-Website prüfen
            </Link>
          </div>
        </div>
      </section>

      <PilotPartnersPlaceholder />

      <RoadmapSection />

      <PricingTeaserSection sourceTag="hero" />

      {/* ─── Sektion: FAQ ─────────────────────────────────────────── */}
      <section
        id="faq"
        className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20"
      >
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8 sm:mb-10">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
              FAQ
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight">
              Häufige Fragen
            </h2>
          </div>

          <div className="space-y-3">
            {[
              {
                q: 'Müssen wir dafür unsere ganze IT umbauen?',
                a: 'Nein. Sie bekommen zunächst einen Report mit Prioritäten. Was Sie umsetzen, entscheiden Sie selbst — wir liefern technische Einschätzung, keine Pflicht zur Umsetzung.',
              },
              {
                q: 'Greifen Sie auf personenbezogene Daten zu?',
                a: 'Wir analysieren Ihre Website und Konfigurationen, nicht Ihre internen Datenbanken oder CRM-Systeme. Datenflüsse + Verarbeitungs-Details stehen in unserem AVV.',
              },
              {
                q: 'Wie schnell haben wir Ergebnisse?',
                a: 'Den ersten Überblick bekommen Sie meist innerhalb von Minuten — Cookie-Scan + Tracker-Erkennung in unter 30 Sekunden, vollständige Audit-Reports je nach Umfang innerhalb von 24 Stunden.',
              },
            ].map((item) => (
              <details
                key={item.q}
                className="group p-5 bg-obsidian-900/60 border border-silver-700/30 hover:border-gold-400/60 rounded-none transition-colors"
              >
                <summary className="flex items-center justify-between gap-3 cursor-pointer list-none">
                  <span className="font-display font-bold text-titanium-50 text-base leading-snug">
                    {item.q}
                  </span>
                  <span className="text-gold-400 text-xl leading-none transition-transform group-open:rotate-45 select-none">
                    +
                  </span>
                </summary>
                <p className="text-sm text-silver-300 leading-relaxed mt-3">{item.a}</p>
              </details>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              to="/audit?source=hero-faq"
              className="surface-gold inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-none"
            >
              Jetzt kostenlosen Compliance-Check starten <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer-mini — nur Legal-Links, KEIN scrollender Content darunter */}
      <footer className="border-t border-silver-700/40 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-wider text-silver-500">
          <div className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-gold-400" />
            <span>© 2026 RealSync Dynamics · Made in Germany</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/cookie-scanner"        className="hover:text-titanium-50 text-gold-400">Cookie-Scanner · Free</Link>
            <Link to="/ai-act-workflows"      className="hover:text-titanium-50 text-gold-400">AI-Act Inventar · Beta</Link>
            <Link to="/dokumente-bundle"      className="hover:text-titanium-50 text-gold-400">Doku-Bundle · Free</Link>
            <Link to="/legal/privacy"         className="hover:text-titanium-50">Datenschutz</Link>
            <Link to="/impressum"             className="hover:text-titanium-50">Impressum</Link>
            <Link to="/legal/sub-processors"  className="hover:text-titanium-50">Sub-Processors</Link>
            <Link to="/legal/methodology"     className="hover:text-titanium-50">Methodik</Link>
            <Link to="/security"              className="hover:text-titanium-50">Security</Link>
            <Link to="/status"                className="hover:text-titanium-50">Status</Link>
          </div>
        </div>
      </footer>

      {/* ─── Modals ─────────────────────────────────────────────── */}
      <Modal
        open={openModal === 'check'}
        onClose={() => setOpenModal(null)}
        title="So läuft Ihr Website-Check ab"
        eyebrow="Produkt"
        size="xl"
      >
        <HowItWorks3Steps />
      </Modal>

      <Modal
        open={openModal === 'pricing'}
        onClose={() => setOpenModal(null)}
        title="Preise"
        eyebrow="Pläne"
        size="xl"
      >
        <PricingShortPanel />
      </Modal>

      <Modal
        open={openModal === 'example'}
        onClose={() => setOpenModal(null)}
        title="Beispiel-Report"
        eyebrow="GA4 ohne Consent"
        size="lg"
      >
        <ExampleReportPanel />
      </Modal>

      <Modal
        open={openModal === 'pro'}
        onClose={() => setOpenModal(null)}
        title="Für Profis & Teams"
        eyebrow="Decision-Layer · API · Multi-Tenant"
        size="xl"
      >
        <ProTeamsPanel />
      </Modal>

      <Modal
        open={openModal === 'compliance'}
        onClose={() => setOpenModal(null)}
        title="Compliance-Center"
        eyebrow="Methodik · Grenzen · Sub-Processors · AVV"
        size="xl"
      >
        <ComplianceCenterPanel />
      </Modal>

      <Modal
        open={openModal === 'enterprise'}
        onClose={() => setOpenModal(null)}
        title="Enterprise"
        eyebrow="Procurement-tauglich · ISO-anbindbar"
        size="xl"
      >
        <EnterprisePanel />
      </Modal>

      <Modal
        open={openModal === 'aiact'}
        onClose={() => setOpenModal(null)}
        title="EU AI Act für Ihre Firma"
        eyebrow="Klassifikator · Workflow-Inventar · Doku-Pflichten"
        size="xl"
      >
        <AIActPanel />
      </Modal>

      <Modal
        open={openModal === 'runtime'}
        onClose={() => setOpenModal(null)}
        title="Governance Runtime"
        eyebrow="Event-driven Compliance · API · Browser-Extension"
        size="xl"
      >
        <GovernanceRuntimePanel />
      </Modal>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────── */

function NavButton({
  children, onClick, className = '',
}: { children: React.ReactNode; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-silver-300 hover:text-titanium-50 transition-colors rounded-none ${className}`}
    >
      {children}
    </button>
  );
}

function MidButton({
  icon, label, onClick,
}: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 border border-silver-500/60 hover:border-gold-400 text-silver-200 hover:text-titanium-50 text-xs sm:text-sm font-medium rounded-none transition-colors"
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

/**
 * Light-weight Pricing-Panel for the modal — kompakte 4-Kachel-Übersicht
 * mit direkten Links zur vollen /pricing-Seite. Voll-Tier-Matrix bleibt
 * dort, das Modal ist nur die Sneak-Preview.
 */
function PricingShortPanel() {
  // Tier-Daten gespiegelt aus src/config/pricing.ts (SSOT) — bewusst hardcoded
  // gehalten weil das Modal nur eine 4-Kachel-Sneak-Preview ist, nicht der
  // Full-Tier-Stack. Wenn pricing.ts ändert, hier mit anpassen.
  const tiles = [
    { name: 'Free Audit',  price: 'Kostenlos',     sub: 'Einmaliger DSGVO-Check',       to: '/audit?source=hero-pricing',     cta: 'Run Scan' },
    { name: 'Starter',     price: '€ 79 / Mt.',    sub: 'Eine Domain · Monitoring',     to: '/checkout/starter?source=hero',  cta: 'Activate Monitoring' },
    { name: 'Growth',      price: '€ 249 / Mt.',   sub: 'Bis zu 3 Domains · Drift',     to: '/checkout/growth?source=hero',   cta: 'Activate Governance' },
    { name: 'Enterprise',  price: 'Custom',        sub: 'AI Act · SLA · DSB',           to: '/contact-sales?intent=enterprise', cta: 'Open Runtime' },
  ];
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-silver-700">
        {tiles.map((t) => (
          <div key={t.name} className="p-5 bg-obsidian-950 flex flex-col">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold-400 mb-1">{t.name}</div>
            <div className="font-display font-bold text-titanium-50 text-2xl tracking-tight mb-1">{t.price}</div>
            <div className="text-xs text-silver-400 mb-4">{t.sub}</div>
            <Link
              to={t.to}
              className="mt-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-silver-500 hover:border-gold-400 text-silver-100 hover:text-titanium-50 text-xs font-semibold rounded-none transition-colors"
            >
              {t.cta} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ))}
      </div>
      <div className="mt-6 text-center text-[11px] text-silver-500">
        Volle Pricing-Matrix mit Features:{' '}
        <Link to="/pricing" className="text-gold-400 hover:text-gold-300 underline-offset-4 hover:underline">
          /pricing
        </Link>
      </div>
    </>
  );
}

/**
 * Example-Report Panel — zeigt einen typischen Befund (GA4 ohne Consent)
 * als Pre-Scan-Demo. Kompakt: Titel-Zeile, „Was bedeutet das?"-Box,
 * Technical-Fix-Snippet, Methodik-Link.
 */
function ExampleReportPanel() {
  return (
    <div className="space-y-5">
      <div className="bg-obsidian-900 border border-silver-700 border-l-2 border-l-gold-400 p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-silver-500 mb-1">Severity · CRITICAL</div>
            <h3 className="font-display font-bold text-titanium-50 text-xl tracking-tight">
              GA4 ohne Consent geladen
            </h3>
          </div>
          <span className="font-mono text-2xl tabular-nums text-gold-400">42<span className="text-base text-silver-500">/100</span></span>
        </div>
        <div className="text-xs font-mono text-silver-400">
          Paragraph-Bezug: § 25 TTDSG · Art. 6 Abs. 1 DSGVO
        </div>
      </div>

      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold-400 mb-2">Was bedeutet das für Sie?</div>
        <ul className="space-y-2 text-sm text-silver-200">
          <li className="flex items-start gap-2">
            <span className="text-gold-400 mt-1">→</span>
            <span>Mögliches Bußgeld-Risiko wegen unerlaubtem Tracking ohne aktive Einwilligung.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gold-400 mt-1">→</span>
            <span>Vertrauensverlust bei datenschutzbewussten Besuchern.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gold-400 mt-1">→</span>
            <span>Empfehlung: GA4-Script erst NACH expliziter Zustimmung über Consent-Banner laden.</span>
          </li>
        </ul>
      </div>

      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold-400 mb-2">Technischer Fix in Kurzform</div>
        <pre className="bg-obsidian-900 border border-silver-700 p-4 text-xs font-mono text-silver-200 overflow-x-auto">
{`<!-- vorher: GA4 lädt sofort -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXX"></script>

<!-- nachher: nur nach Consent -->
<script>
  window.addEventListener('rsd:consent-granted', () => {
    const s = document.createElement('script');
    s.src = 'https://www.googletagmanager.com/gtag/js?id=G-XXX';
    s.async = true;
    document.head.appendChild(s);
  });
</script>`}
        </pre>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-silver-700">
        <Link
          to="/legal/methodology"
          className="text-[11px] font-mono uppercase tracking-[0.18em] text-silver-400 hover:text-titanium-50"
        >
          → Methodik & Grenzen ansehen
        </Link>
        <Link
          to="/audit?source=example-report"
          className="surface-gold inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-none"
        >
          Eigene Domain prüfen <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
