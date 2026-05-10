import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Sparkles, FileSearch, Layers, Tag,
  Cookie, Brain, FileCheck2, Activity,
} from 'lucide-react';
import { Logo } from './Logo';
import { Modal } from './ui/Modal';
import { HowItWorks3Steps } from './HowItWorks3Steps';
import { WebsiteRebuildOffer } from './WebsiteRebuildOffer';
import { ProTeamsPanel } from './panels/ProTeamsPanel';
import { ComplianceCenterPanel } from './panels/ComplianceCenterPanel';
import { EnterprisePanel } from './panels/EnterprisePanel';
import { AIActPanel } from './panels/AIActPanel';
import { PricingTeaserSection } from './sections/PricingTeaserSection';
import { LiveFindingsSection } from './sections/LiveFindingsSection';
import { ReportPreviewSection } from './sections/ReportPreviewSection';

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
 *   - Sektion „Preise": 3-Tier-Teaser (Bronze/Silver/Gold) + Link zu /pricing
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
  | 'aiact';        // AIActPanel (Klassifikator + Workflow-Inventory + Doku-Pflichten)

export function HeroOnly() {
  const [openModal, setOpenModal] = useState<ModalKey>(null);

  return (
    <div className="bg-hero-only min-h-screen flex flex-col text-titanium-50">
      {/* ─── 1) Top Bar ─────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <nav className="flex items-center gap-1 sm:gap-3 text-xs sm:text-sm">
          <Link
            to="/features"
            className="px-2 sm:px-3 py-1.5 text-silver-300 hover:text-titanium-50 font-semibold transition-colors"
          >
            Funktionen
          </Link>
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

      {/* ─── 2-6) Center Stage ──────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
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
          <h1 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-[1.05] mb-5">
            Ihre Website & KI-Prozesse DSGVO-sicher – in 30 Sekunden geprüft.
          </h1>
          <p className="text-base sm:text-lg text-silver-300 leading-relaxed max-w-2xl mx-auto mb-9">
            RealSyncDynamics.AI scannt Ihre Website, Tracking-Tools und KI-Workflows und zeigt Ihnen konkret,
            wo Sie gegen DSGVO, TTDSG und EU AI Act verstoßen — inklusive To-do-Liste für Ihr Team.
          </p>

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

          {/* Drei Mid-Buttons */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-10 max-w-xl mx-auto">
            <MidButton icon={<FileSearch className="h-3.5 w-3.5" />} label="Website-Check"      onClick={() => setOpenModal('check')} />
            <MidButton icon={<Layers     className="h-3.5 w-3.5" />} label="Für Profis & Teams" onClick={() => setOpenModal('pro')} />
            <MidButton icon={<Tag        className="h-3.5 w-3.5" />} label="Preise"             onClick={() => setOpenModal('pricing')} />
          </div>

          {/* Trust-Leiste */}
          <div className="text-[11px] sm:text-xs font-mono uppercase tracking-[0.18em] text-silver-500">
            EU-Datenresidenz · AVV inklusive · Vollständiges Audit-Log · Made in Germany
          </div>
        </div>
      </main>

      {/* ─── Live-Findings: Produktrealität sichtbar machen ─────── */}
      <LiveFindingsSection />

      {/* ─── Report-Preview: strukturierter Audit-Output ────────── */}
      <ReportPreviewSection />

      {/* ─── Sektion: Für welche Firmen ist das? ─────────────────── */}
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
              Ideal für Unternehmen mit eigener Website und KI-Einsatz
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {[
              {
                title: 'Online-Unternehmen & SaaS',
                body: 'Sie erfassen Leads, nutzen Analytics, Chatbots oder Recommendation-Engines — wir prüfen, ob Ihre Datenflüsse wirklich DSGVO-konform sind.',
                href: '/fuer-saas',
                cta: 'Niche-Landing für SaaS',
              },
              {
                title: 'Dienstleister & Agenturen',
                body: 'Sie betreuen viele Kundenseiten und KI-Kampagnen — wir liefern Ihnen den technischen Compliance-Überblick für alle Projekte.',
                href: '/fuer-agenturen',
                cta: 'Niche-Landing für Agenturen',
              },
              {
                title: 'Praxen, Kanzleien, lokale Betriebe',
                body: 'Sie verarbeiten sensible Daten über Formulare und Terminbuchungen — wir decken versteckte Risiken in Formularen, Scripts und Plugins auf.',
                href: '/fuer-praxen',
                cta: 'Niche-Landing für Praxen',
              },
            ].map((item) => (
              <Link
                key={item.title}
                to={item.href}
                className="group p-5 sm:p-6 bg-obsidian-900/60 border border-silver-700/30 hover:border-gold-400/60 rounded-none transition-colors block"
              >
                <h3 className="font-display font-bold text-titanium-50 text-base sm:text-lg mb-2 leading-snug">
                  {item.title}
                </h3>
                <p className="text-sm text-silver-300 leading-relaxed">{item.body}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-gold-400 group-hover:text-gold-300">
                  {item.cta} <ArrowRight className="h-3 w-3" />
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
              In drei Schritten zu einem klaren Compliance-Bild
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {[
              {
                title: 'Domain und KI-Usecases eingeben',
                body: 'Sie geben Ihre Website-URL und — wenn vorhanden — Ihre genutzten KI-Tools an (z. B. Chatbots, Automatisierung, Analysen).',
              },
              {
                title: 'Automatischer Scan & Risk-Score',
                body: 'Wir analysieren Tracking, Cookies, Formulare, Third-Party-Dienste und KI-Workflows und stufen die Risiken nach Priorität ein.',
              },
              {
                title: 'Konkrete Maßnahmen für Ihr Team',
                body: 'Sie erhalten eine sortierte To-do-Liste mit klaren Fix-Empfehlungen für Marketing, IT und Datenschutz — inklusive Reports für Management und Prüfer.',
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
        <WebsiteRebuildOffer />
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
  const tiles = [
    { name: 'Starter',     price: 'Kostenlos',     sub: 'Einzel-URLs',                  to: '/audit',                        cta: 'Starten' },
    { name: 'Team',        price: '€ 149 / Mt.',   sub: 'Wiederkehrende Audits',        to: '/pricing?tier=team',            cta: 'Pilot starten' },
    { name: 'Managed',     price: 'ab € 99 / Mt.', sub: 'Audit + Rebuild + Betrieb',    to: '/dsgvo-website',                cta: 'Komplett-Service' },
    { name: 'Enterprise',  price: 'Anfrage',       sub: 'API · Multi-Tenant · SLA',     to: '/contact-sales?intent=enterprise', cta: 'Sales kontaktieren' },
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
