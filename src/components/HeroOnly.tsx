import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, FileSearch, Layers, Tag } from 'lucide-react';
import { Logo } from './Logo';
import { Modal } from './ui/Modal';
import { HowItWorks3Steps } from './HowItWorks3Steps';
import { WebsiteRebuildOffer } from './WebsiteRebuildOffer';
import { ProTeamsPanel } from './panels/ProTeamsPanel';
import { ComplianceCenterPanel } from './panels/ComplianceCenterPanel';
import { EnterprisePanel } from './panels/EnterprisePanel';
import { AIActPanel } from './panels/AIActPanel';

/**
 * HeroOnly — Single-viewport Landing-Experience.
 *
 * Strategischer Pivot weg von der Long-Form-Landing hin zu einer „Grok-like"
 * Hero-Bühne, die in einen Viewport passt; alle weiteren Inhalte werden
 * über Modals geladen, kein Scrollen für die Erst-Experience.
 *
 * Layout (vertikal):
 *   1. Top-Bar mit Mini-Nav (links) + Audit-CTA (rechts)
 *   2. Zentrierter Logo-Block mit Gold-Glow-Animation
 *   3. Headline + Subline
 *   4. Primary + Secondary CTA-Pair
 *   5. Drei Mid-Buttons (öffnen Modals)
 *   6. Trust-Leiste am unteren Rand
 *
 * Farb-System: Schwarz/Gold/Silber (additiv-getypt, beeinflusst nur diese
 * Component und Children — Welcome/Audit/Admin behalten ihr bestehendes
 * obsidian/titanium-Theme).
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
          <NavButton onClick={() => setOpenModal('check')}>Produkt</NavButton>
          <NavButton onClick={() => setOpenModal('aiact')} className="hidden sm:inline-flex">
            AI-Act
          </NavButton>
          <NavButton onClick={() => setOpenModal('compliance')} className="hidden md:inline-flex">
            Compliance-Center
          </NavButton>
          <NavButton onClick={() => setOpenModal('pricing')}>Preise</NavButton>
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
            Ist Ihre Website wirklich DSGVO-konform?
          </h1>
          <p className="text-base sm:text-lg text-silver-300 leading-relaxed max-w-2xl mx-auto mb-9">
            In 30 Sekunden zeigt RealSyncDynamics, wo Ihre Website gegen DSGVO, TTDSG und Sicherheits-Standards
            verstößt — mit klaren Fix-Empfehlungen, die Ihr Webmaster direkt umsetzen kann.
          </p>

          {/* Primary + Secondary CTA */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-7">
            <Link
              to="/audit?source=hero-primary"
              className="surface-gold inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-bold rounded-none"
            >
              Kostenlosen Website-Check starten <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => setOpenModal('example')}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-silver-500 hover:border-gold-400 text-silver-100 hover:text-titanium-50 text-base font-semibold rounded-none transition-colors"
            >
              Beispiel-Report
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
            EU-Hosting · AVV inklusive · Audit-Log · Methodik offen einsehbar
          </div>
        </div>
      </main>

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
