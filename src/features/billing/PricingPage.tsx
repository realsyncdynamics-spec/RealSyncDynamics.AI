import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, Check, Sparkles, Award, Building2, Cookie, ShieldCheck, Zap, Globe, Briefcase,
} from 'lucide-react';
import { Logo } from '../../components/Logo';
import {
  PUBLIC_PRICING_TIERS, ENTERPRISE_TIER, PRICING_TRUST_NOTE, TIER_ACCENT,
  type PricingTier, type TierId,
} from '../../config/pricing';
import { PricingRoiExampleSection } from '../../components/sections/PricingRoiExampleSection';
import { GOVERNANCE_MODULES, canAccessModule } from '../../components/governance-os/governanceModules';
import { ModuleStatusBadge } from '../../components/governance-os/ModuleStatusBadge';

/**
 * /pricing — public Pricing-Page mit 5 Paketen (Free → 1.999 €).
 *
 * Tier-Daten kommen ausschließlich aus src/config/pricing.ts
 * (Single Source of Truth, geteilt mit PricingTeaserSection + index.html JSON-LD).
 *
 * 5-Karten-Grid (PUBLIC_PRICING_TIERS, Stand 2026-06):
 *   Free Audit  0 €          Lead-Funnel, einmalig, kein Account
 *   Starter    79 €/Monat    Einzeldomain
 *   Growth    249 €/Monat    Monitoring + Auto-Fix (HIGHLIGHT)
 *   Agency    699 €/Monat    White-Label, 10 Kunden-Sites, API
 *   Scale   1.999 €/Monat    DSB-Kanzleien, bis 50 Mandanten
 *
 * "Enterprise" (individuell, kein fester Preis) ist KEINE 6. Karte — sonst
 * entsteht ein 6-in-5-Spalten-Grid. Stattdessen eigener Anfrage-Banner
 * unterhalb des Grids (ENTERPRISE_TIER). Jede Karte hat eine Akzentfarbe
 * (TIER_ACCENT) zur visuellen Trennung der Pakete.
 */

const TIER_ICONS: Record<TierId, typeof Cookie> = {
  free: Cookie,
  starter: ShieldCheck,
  growth: Zap,
  agency: Globe,
  scale: Briefcase,
  enterprise: Building2,
};

export function PricingPage() {
  // Deep-Link von Startseite/Audit: ?plan=<id> hebt das gewählte Paket hervor
  // und scrollt es in den Blick — so bleibt der Weg zur Paket-Auswahl eindeutig.
  const [params] = useSearchParams();
  const selectedPlan = params.get('plan');
  useEffect(() => {
    if (!selectedPlan) return;
    const el = document.getElementById(`plan-${selectedPlan}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedPlan]);

  return (
    <div className="bg-hero-only min-h-screen flex flex-col text-titanium-50">
      {/* Top bar */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-xs sm:text-sm text-silver-300 hover:text-titanium-50">
          <Sparkles className="h-3.5 w-3.5 text-titanium-100" />
          <span className="font-display font-bold tracking-tight text-titanium-50">RealSyncDynamics.AI</span>
        </Link>
        <Link
          to="/audit?source=pricing-top"
          className="surface-mono inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-none"
        >
          Audit starten <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Hero */}
      <section className="px-4 sm:px-6 lg:px-8 pt-10 pb-12 sm:pt-16 sm:pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <div className="mb-7 flex flex-col items-center gap-3">
            <div className="logo-pulse">
              <Logo size={48} iconOnly />
            </div>
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100">
              Preise · Public
            </div>
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-[1.05] mb-4">
            Welche Governance-Abdeckung passt zu Ihnen?
          </h1>
          <p className="text-base sm:text-lg text-silver-300 leading-relaxed max-w-2xl mx-auto">
            Vom kostenlosen Erst-Scan bis zur kompletten Governance-Runtime — alle Pläne sind EU-gehostet,
            alle Pläne enthalten den AVV. Sie wählen nicht nach Anzahl der Webseiten, sondern nach Ihrer
            Governance-Komplexität: Branche, Datenkategorien, KI-Nutzung, Drittanbieter und Dokumentationspflichten.
          </p>

          {/* GCS-Teaser — Paketempfehlung nach Governance-Komplexität */}
          <Link
            to="/governance-score"
            className="mt-7 inline-flex items-center gap-2 surface-mono px-5 py-3 text-sm font-bold rounded-none"
          >
            Governance Complexity Score ermitteln <ArrowRight className="h-4 w-4" />
          </Link>

          {/* 14-Tage-Trial klar sichtbar — Starter/Growth/Agency starten mit
              ?pilot=true in den 14-Tage-Testmodus (siehe CheckoutPage). */}
          <p className="mt-5 inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-300">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            14 Tage kostenlos testen · keine Kosten bis Tag 15 · monatlich kündbar
          </p>
        </div>
      </section>

      {/* Tier-Cards — 4-spaltig auf Desktop */}
      <section className="px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5 items-stretch">
            {PUBLIC_PRICING_TIERS.map((tier) => (
              <TierCard key={tier.id} tier={tier} selected={tier.id === selectedPlan} />
            ))}
          </div>

          {/* Enterprise — kein Grid-Card, sondern eigener Anfrage-Banner */}
          <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-obsidian-900/60 border border-titanium-200/30 rounded-none">
            <div>
              <div className="font-display font-bold text-titanium-50 text-base mb-1">
                {ENTERPRISE_TIER.name} — {ENTERPRISE_TIER.priceString}
              </div>
              <p className="text-sm text-silver-300">{ENTERPRISE_TIER.tagline}</p>
            </div>
            <Link
              to={ENTERPRISE_TIER.cta.href}
              className="surface-mono inline-flex shrink-0 items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-none whitespace-nowrap"
            >
              {ENTERPRISE_TIER.cta.label} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 text-center space-y-2">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-silver-500">
              {PRICING_TRUST_NOTE}
            </p>
            <p className="text-[10px] font-mono text-titanium-600">
              Erstcheck (Free Audit) kostenlos · kein Account nötig · Starter/Growth/Agency: 14 Tage kostenlos testen — keine Kosten bis Tag 15, monatlich kündbar · Scale/Enterprise: nach Anfrage
            </p>
            <p className="text-[10px] font-mono text-titanium-600">
              Alle Preise in EUR. Keine Umsatzsteuer ausgewiesen — Kleinunternehmer gemäß § 19 UStG.
            </p>
          </div>

          {/* Disclaimer */}
          <div className="mt-10 max-w-3xl mx-auto p-5 bg-obsidian-900/60 border border-silver-700/30 border-l-2 border-l-titanium-200 rounded-none">
            <div className="flex items-start gap-3">
              <Award className="h-4 w-4 text-titanium-100 mt-0.5 shrink-0" />
              <p className="text-sm text-silver-300 leading-relaxed">
                Unsere Outputs sind methodisch und technisch fundiert — aber kein Ersatz für individuelle Rechtsberatung.
                <strong className="text-titanium-200"> Wir versprechen kein "100 % rechtssicher"</strong>, weil das niemand seriös kann.
                Generierte Dokumente empfehlen wir anwaltlich prüfen zu lassen.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Beispielhafte Kostenrechnung — Procurement-Anker, klar als Beispiel
          gekennzeichnet, keine Einsparzusagen. */}
      <PricingRoiExampleSection />

      {/* Differenzierer */}
      <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20 bg-obsidian-900/20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
              Kritische Differenzierer
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight">
              Was uns von anderen Tools unterscheidet
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-titanium-900">
            {[
              {
                title: 'Consent-Timing-Analyse',
                body: 'Wir messen exakt, welche Requests VOR dem ersten Nutzer-Klick feuern — mit echtem Playwright-Headless-Browser. Pre-Consent-Tracking ist die häufigste DSGVO-Schwachstelle und unser primärer Runtime-Detection-Anker.',
              },
              {
                title: 'Auto-Remediation (nicht nur Audit)',
                body: 'Nicht nur "hier ist das Problem". Sondern: hier ist der Fix-Code, den Sie einfügen können. Script-Blocking, Consent-Injection, Font-Self-Hosting — alles automatisiert.',
              },
              {
                title: 'Continuous Runtime-Monitoring',
                body: 'Governance ist kein einmaliger Zustand. Websites und KI-Endpunkte verändern sich. Wir messen täglich, erkennen Drift gegen den letzten Baseline-Stand und alarmieren — damit zwischen den Audits keine stillen Regressionen verschwinden.',
              },
              {
                title: 'Nachweisbarkeit (Audit-Trails)',
                body: 'PDFs, Logs, Zeitstempel, Evidence Vault. Wenn der Datenschutzbeauftragte oder die Aufsichtsbehörde fragt: Sie können beweisen, was wann geprüft wurde.',
              },
            ].map((d) => (
              <div key={d.title} className="bg-obsidian-950 p-6 sm:p-7">
                <h3 className="font-display font-bold text-titanium-50 text-base mb-2">{d.title}</h3>
                <p className="text-sm text-titanium-400 leading-relaxed">{d.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Governance OS Browser — Module-Matrix */}
      <GovernanceModuleMatrix />

      {/* FAQ */}
      <section id="pricing-faq" className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8 sm:mb-10">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">FAQ</div>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight">
              Häufige Fragen zu den Preisen
            </h2>
          </div>
          <div className="space-y-3">
            {[
              {
                q: 'Brauche ich einen Account um zu starten?',
                a: 'Für Free Audit nicht — Sie geben nur die Domain ein und bekommen sofort den Risk-Score. Für alle kostenpflichtigen Tiers legen wir nach Buchung gemeinsam einen Account für Ihr Team an.',
              },
              {
                q: 'Was ist Consent-Timing-Analyse?',
                a: 'Unsere Playwright-Engine lädt Ihre Website im echten Headless-Browser und protokolliert jeden Netzwerk-Request mit präzisem Timestamp — vor und nach dem ersten Klick. So sehen wir, ob Google Analytics, Meta Pixel oder andere Tracker geladen werden, bevor der Nutzer eingewilligt hat. Pre-Consent-Tracking ist die häufigste Schwachstelle im DSGVO-Setup und der Anker, an dem unsere Runtime-Drift-Detection täglich aufsetzt.',
              },
              {
                q: 'Was ist "Auto-Remediation" genau?',
                a: 'Für erkannte Probleme liefern wir konkrete technische Fixes: Script-Tags mit type="text/plain" und data-consent-Attribut, Consent-Banner-Code-Snippets, Google-Fonts-Self-Hosting-Script, YouTube-NoCookie-Umstellung. Kein LLM-generiertes "schreib eine Datenschutzerklärung", sondern strukturierte Regel-Engine → Template-System.',
              },
              {
                q: 'Was passiert nach dem Kauf des Agency-Pakets?',
                a: 'Nach der Zahlung erhalten Sie innerhalb von 15 Minuten eine E-Mail mit Ihrem Account-Zugang. Im Dashboard finden Sie sofort: Ihren API-Key, das White-Label-Konfigurations-Panel (Logo, Farben, eigene Domain), und die Möglichkeit, die ersten 10 Kundenseiten hinzuzufügen. Unser Onboarding-Team meldet sich innerhalb von 24 Stunden für ein optionales Setup-Gespräch.',
              },
              {
                q: 'Was bedeutet "Priority Support" beim Agency-Paket?',
                a: 'Priority Support bedeutet: dedizierter Ansprechpartner per E-Mail mit garantierter Antwort innerhalb von 8 Stunden (Werktage). Für kritische Compliance-Fragen (aktiver Aufsichtsbehörden-Kontakt) eskalieren wir auf 4-Stunden-Response. Kontakt: support@realsyncdynamicsai.de mit Betreff [AGENCY].',
              },
              {
                q: 'Wie viele Kundenseiten kann ich im Agency-Paket verwalten?',
                a: '10 Kundenseiten (Domains) sind im Grundpreis enthalten. Weitere Domains können einzeln hinzugebucht werden. Jede Domain bekommt ihr eigenes Monitoring-Dashboard, White-Label-Report und API-Endpunkt. Die Multi-Tenant-Struktur ist vollständig isoliert — jeder Kunde sieht nur seine eigenen Daten.',
              },
              {
                q: 'Gibt es einen AVV (Auftragsverarbeitungsvertrag)?',
                a: 'Ja. Als Auftragsverarbeiter stellen wir Ihnen und Ihren Kunden einen EU-konformen AVV bereit. Er ist ab Buchung automatisch aktiv und kann unter /legal/avv eingesehen und heruntergeladen werden. Für Agency-Kunden mit eigenen Endkunden stellen wir zusätzlich eine anpassbare AVV-Vorlage bereit.',
              },
              {
                q: 'Wie kündige ich?',
                a: 'Monatlich, formlos per E-Mail an support@realsyncdynamicsai.de. Keine Mindestlaufzeit. Daten und Reports bleiben Ihnen 90 Tage exportierbar erhalten.',
              },
              {
                q: 'Was ist der Enterprise Evidence Vault?',
                a: 'Ein unveränderliches Archiv aller Scans, Findings, Fix-Bestätigungen und Dokumente — mit kryptografischen Zeitstempeln. Wenn Sie einer Aufsichtsbehörde nachweisen müssen, dass Sie zu einem bestimmten Datum compliant waren, liefert der Vault den Beweis.',
              },
            ].map((item) => (
              <details
                key={item.q}
                className="group p-5 bg-obsidian-900/60 border border-silver-700/30 hover:border-titanium-200/60 rounded-none transition-colors"
              >
                <summary className="flex items-center justify-between gap-3 cursor-pointer list-none">
                  <span className="font-display font-bold text-titanium-50 text-base leading-snug">{item.q}</span>
                  <span className="text-titanium-100 text-xl leading-none transition-transform group-open:rotate-45 select-none">+</span>
                </summary>
                <p className="text-sm text-silver-300 leading-relaxed mt-3">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-silver-700/40 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-wider text-silver-500">
          <div className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-titanium-100" />
            <span>© 2026 RealSync Dynamics · Made in Germany</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/cookie-scanner" className="hover:text-titanium-50 text-titanium-100">Cookie-Scanner · Free</Link>
            <Link to="/ai-act-workflows" className="hover:text-titanium-50 text-titanium-100">AI-Act Inventar · Beta</Link>
            <Link to="/legal/privacy" className="hover:text-titanium-50">Datenschutz</Link>
            <Link to="/impressum" className="hover:text-titanium-50">Impressum</Link>
            <Link to="/legal/terms" className="hover:text-titanium-50">AGB</Link>
            <Link to="/legal/widerruf" className="hover:text-titanium-50">Widerruf</Link>
            <Link to="/legal/avv" className="hover:text-titanium-50">AVV</Link>
            <Link to="/legal/sub-processors" className="hover:text-titanium-50">Sub-Processors</Link>
            <Link to="/legal/methodology" className="hover:text-titanium-50">Methodik</Link>
            <Link to="/security" className="hover:text-titanium-50">Security</Link>
            <Link to="/status" className="hover:text-titanium-50">Status</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TierCard({ tier, selected = false }: { tier: PricingTier; selected?: boolean }) {
  const TierIcon = TIER_ICONS[tier.id];
  const priceDisplay =
    tier.priceEur > 0 ? `${tier.priceEur} €` : (tier.id === 'free' ? '0 €' : 'Anfrage');

  const accent = TIER_ACCENT[tier.id];

  return (
    <div
      id={`plan-${tier.id}`}
      className={`relative flex flex-col p-6 sm:p-7 bg-obsidian-900/60 border-x border-b rounded-none border-t-4 transition-colors ${accent.border} ${
        tier.highlight
          ? 'border-titanium-200/80 shadow-[0_0_0_1px_rgba(229,231,235,0.25)]'
          : 'border-silver-700/30 hover:border-titanium-200/60'
      }${selected ? ' ring-2 ring-cyan-400/70' : ''}`}
    >
      {tier.highlight && (
        <div className="absolute -top-3 left-5 px-2 py-0.5 bg-titanium-50 text-obsidian-950 font-mono uppercase tracking-wider text-[10px] font-bold">
          Empfohlen
        </div>
      )}

      <div className="flex items-center gap-2 mb-2 mt-1">
        <TierIcon className={`h-4 w-4 ${accent.text}`} />
        <div className="font-display font-bold text-titanium-50 text-lg tracking-tight">{tier.name}</div>
      </div>

      <div className="flex items-baseline gap-1.5 mb-1.5">
        <div className="text-3xl font-display font-bold text-titanium-100 tabular-nums">{priceDisplay}</div>
        <div className="text-xs font-mono uppercase tracking-wider text-silver-400">{tier.priceSuffix}</div>
      </div>

      <div className="text-[11px] font-mono uppercase tracking-wider text-silver-400 mb-4">{tier.tagline}</div>

      {tier.badges && tier.badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {tier.badges.map((b) => (
            <span
              key={b}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-titanium-200/10 border border-titanium-200/40 text-titanium-100 rounded-none"
            >
              <Award className="h-2.5 w-2.5" /> {b}
            </span>
          ))}
        </div>
      )}

      <ul className="space-y-2 text-sm text-silver-200 mb-6 flex-1">
        {tier.bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 leading-relaxed">
            <Check className="h-3.5 w-3.5 text-titanium-100 shrink-0 mt-1" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {tier.cta.href.startsWith('http') ? (
        <a
          href={tier.cta.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-none transition-colors ${
            tier.highlight
              ? 'surface-mono'
              : 'border border-silver-500 hover:border-titanium-200 text-silver-100 hover:text-titanium-50'
          }`}
        >
          {tier.cta.label} <ArrowRight className="h-4 w-4" />
        </a>
      ) : (
        <Link
          to={tier.cta.href}
          className={`inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-none transition-colors ${
            tier.highlight
              ? 'surface-mono'
              : 'border border-silver-500 hover:border-titanium-200 text-silver-100 hover:text-titanium-50'
          }`}
        >
          {tier.cta.label} <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

// ─── Governance OS Browser — Module-Matrix ───────────────────────────────────
// Zeigt welche Module in welchem Plan verfügbar sind.
// Alle 5 buchbaren Pakete + Enterprise — Namen identisch zu PUBLIC_PRICING_TIERS,
// damit Pricing-Karten und Modul-Matrix nicht auseinanderlaufen ("Professional"
// existiert in den Karten nicht — hieß dort schon immer "Growth").

const MATRIX_TIERS: { id: TierId; label: string }[] = [
  { id: 'free',       label: 'Free' },
  { id: 'starter',    label: 'Starter' },
  { id: 'growth',     label: 'Growth' },
  { id: 'agency',     label: 'Agency' },
  { id: 'scale',      label: 'Scale' },
  { id: 'enterprise', label: 'Enterprise' },
];

function GovernanceModuleMatrix() {
  return (
    <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20 bg-obsidian-900/20">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-500 mb-2">
            Governance OS Browser
          </p>
          <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-3">
            Welche Module sind in welchem Plan?
          </h2>
          <p className="text-sm text-titanium-400 max-w-2xl">
            Alle Module im Überblick — von der kostenlosen Übersicht bis zur
            vollständigen Governance-Runtime.
          </p>
        </div>

        {/* Matrix-Tabelle */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-titanium-900">
                <th className="text-left py-3 pr-4 font-mono text-[10px] uppercase tracking-widest text-titanium-600 w-40">
                  Modul
                </th>
                {MATRIX_TIERS.map((t) => (
                  <th key={t.id} className="text-center py-3 px-3 font-mono text-[10px] uppercase tracking-widest text-titanium-400 whitespace-nowrap">
                    {t.label}
                  </th>
                ))}
                <th className="text-left py-3 pl-4 font-mono text-[10px] uppercase tracking-widest text-titanium-600">
                  Beschreibung
                </th>
              </tr>
            </thead>
            <tbody>
              {GOVERNANCE_MODULES.map((mod, i) => (
                <tr
                  key={mod.id}
                  className={`border-b border-titanium-900 ${i % 2 === 0 ? 'bg-obsidian-950' : 'bg-obsidian-900'}`}
                >
                  <td className="py-2.5 pr-4 font-medium text-titanium-100 whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      {mod.label}
                      {mod.status !== 'live' && <ModuleStatusBadge status={mod.status} />}
                    </span>
                  </td>
                  {MATRIX_TIERS.map((t) => {
                    const ok = canAccessModule(mod, t.id);
                    return (
                      <td key={t.id} className="text-center py-2.5 px-3">
                        {ok
                          ? <span className="text-emerald-400 text-base leading-none">✓</span>
                          : <span className="text-titanium-800 text-base leading-none">—</span>
                        }
                      </td>
                    );
                  })}
                  <td className="py-2.5 pl-4 text-xs text-titanium-500 leading-relaxed">
                    {mod.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/app"
            className="inline-flex items-center gap-2 bg-cyan-400 text-obsidian-950 px-4 py-2 text-sm font-semibold hover:bg-cyan-300 transition-colors"
          >
            Governance OS öffnen <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/audit?source=pricing-matrix"
            className="inline-flex items-center gap-2 border border-titanium-700 text-titanium-200 px-4 py-2 text-sm font-semibold hover:border-titanium-500 transition-colors"
          >
            Kostenlosen Audit starten
          </Link>
        </div>
      </div>
    </section>
  );
}
