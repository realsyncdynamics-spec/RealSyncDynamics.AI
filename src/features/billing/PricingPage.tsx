import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, Sparkles, Award, Building2, Cookie, ShieldCheck,
} from 'lucide-react';
import { Logo } from '../../components/Logo';

/**
 * /pricing — public Pricing-Page mit 3 Paketen.
 *
 * Bewusst KEIN useTenant()/AuthGate-Aufruf, damit die Route public ohne
 * Login zugänglich ist. Die Route ist zwar innerhalb des TenantProvider-
 * Trees (siehe App.tsx), das ist aber kein hartes Gate solange wir die
 * Tenant-Hooks nicht aufrufen.
 *
 * Style: gleiche Schwarz/Gold/Silber-Bühne wie HeroOnly + Niche-Landings.
 *
 * Drei Pakete (Stand 2026-05):
 *   1. Bronze   —  29 € / Monat                · Einstieg / Single-Domain
 *   2. Silver   —  99 € / Monat (EMPFOHLEN)    · Standard-KMU
 *   3. Gold     — 299 € / Monat                · Multi-Domain + AI-Act + API
 *
 * Alle drei mit 14 Tage Pilot-Trial. Keine Stripe-Anbindung in dieser PR —
 * CTAs gehen auf /audit (Free-Scan) bzw. /contact-sales?intent=… (Buchung
 * manuell durch Sales-Team bis Stripe-Setup steht).
 */

interface Tier {
  id: 'bronze' | 'silver' | 'gold';
  name: string;
  price: string;
  priceSuffix: string;
  tagline: string;
  bullets: string[];
  badges?: string[];
  ctaLabel: string;
  ctaHref: string;
  highlight: boolean;
}

const TIERS: Tier[] = [
  {
    id: 'bronze',
    name: 'Bronze',
    price: '29 €',
    priceSuffix: '/ Monat',
    tagline: 'Einstieg für Solo-Selbstständige & Single-Domain',
    bullets: [
      'Vollständiger DSGVO-Scan der Domain',
      'Risk-Score + Top-Findings mit Paragraphenbezug',
      'Wöchentlicher Re-Audit + Alert',
      '14 Tage kostenlos testen',
    ],
    ctaLabel: 'Jetzt 14 Tage testen',
    ctaHref: '/contact-sales?intent=bronze&source=pricing',
    highlight: false,
  },
  {
    id: 'silver',
    name: 'Silver',
    price: '99 €',
    priceSuffix: '/ Monat',
    tagline: 'Compliance-Standard für eine Domain',
    bullets: [
      'Vollständiger Audit-Report (alle Findings mit Paragraphenbezug)',
      'Datenschutzerklärung automatisch generiert',
      'AVV als PDF',
      'Cookie-Banner-Konfiguration geliefert',
      'Wöchentlicher Re-Audit + Alert bei neuen Verstößen',
      '1 Domain',
    ],
    badges: ['Geprüft durch Partnerkanzlei'],
    ctaLabel: 'Jetzt 14 Tage testen',
    ctaHref: '/contact-sales?intent=silver&source=pricing',
    highlight: true,
  },
  {
    id: 'gold',
    name: 'Gold',
    price: '299 €',
    priceSuffix: '/ Monat',
    tagline: 'Mittelstand mit AI-Act-Pflichten',
    bullets: [
      'Alles aus Silver',
      'Verzeichnis der Verarbeitungstätigkeiten (VVT)',
      'TOM-Dokumentation',
      'KI-Risikoabschätzung (EU AI Act)',
      'Sub-Processor-Liste (automatisch gepflegt)',
      'Bis zu 5 Domains',
      'API-Zugriff + CI-Integration',
      'Signierte PDF-Exports',
      'Externer DSB buchbar (Add-on)',
    ],
    ctaLabel: 'Jetzt 14 Tage testen',
    ctaHref: '/contact-sales?intent=gold&source=pricing',
    highlight: false,
  },
];

export function PricingPage() {
  return (
    <div className="bg-hero-only min-h-screen flex flex-col text-titanium-50">
      {/* Top bar — gleicher Stil wie HeroOnly */}
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
            Bronze · Silver · Gold — Fair. Transparent. Kündbar.
          </h1>
          <p className="text-base sm:text-lg text-silver-300 leading-relaxed max-w-2xl mx-auto">
            Vom Einsteiger-Plan bis zum Multi-Domain-Compliance-Setup mit AI-Act-Layer und
            API-Zugriff. Alle drei Pakete mit 14 Tage Pilot kostenlos. Sie wählen das Paket,
            das zu Ihrem Risiko und Ihrer Org-Größe passt — wir liefern.
          </p>
        </div>
      </section>

      {/* Tier-Cards */}
      <section className="px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 items-stretch">
            {TIERS.map((tier) => (
              <TierCard key={tier.id} tier={tier} />
            ))}
          </div>

          <div className="mt-8 text-center">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-silver-500">
              Bronze 29€ · Silver 99€ · Gold 299€ · 14 Tage Pilot · Keine Setup-Fees · Monatlich kündbar
            </p>
          </div>

          {/* Disclaimer */}
          <div className="mt-10 max-w-3xl mx-auto p-5 bg-obsidian-900/60 border border-silver-700/30 border-l-2 border-l-titanium-200 rounded-none">
            <div className="flex items-start gap-3">
              <Award className="h-4 w-4 text-titanium-100 mt-0.5 shrink-0" />
              <p className="text-sm text-silver-300 leading-relaxed">
                Dokumente werden automatisch generiert und durch unsere Partnerkanzlei geprüft.
                <strong className="text-titanium-200"> Kein Rechtsberatungsersatz.</strong>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="pricing-faq"
        className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20"
      >
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8 sm:mb-10">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
              FAQ
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight">
              Häufige Fragen zu den Preisen
            </h2>
          </div>

          <div className="space-y-3">
            {[
              {
                q: 'Brauche ich einen Account um zu starten?',
                a: 'Alle drei Pakete starten mit 14 Tage Pilot kostenlos. Wir legen nach Buchung gemeinsam einen Account für Ihr Team an. Wenn der Pilot nicht passt, können Sie ohne Begründung in den 14 Tagen kündigen.',
              },
              {
                q: 'Wie kündige ich, wenn es nicht passt?',
                a: 'Monatlich, formlos per E-Mail. Keine Mindestlaufzeit, kein Trick mit „Nur in den ersten 14 Tagen". Daten und Reports bleiben Ihnen für 90 Tage exportierbar erhalten.',
              },
              {
                q: 'Was ist „Geprüft durch Partnerkanzlei"?',
                a: 'Ihre automatisch generierten Dokumente (DSE, AVV, VVT) durchlaufen einen Review unserer DSGVO-spezialisierten Partnerkanzlei. Das ersetzt keine individuelle Rechtsberatung — bringt aber Ihre Doku auf einen Standard, der dem juristischen Mainstream entspricht.',
              },
              {
                q: 'Muss ich für Gold schon API/CI nutzen?',
                a: 'Nein. API + CI-Integration sind im Paket enthalten, aber optional. Sie können Gold auch nur wegen VVT/TOM/AI-Act buchen und API später aktivieren — kein Up- oder Downgrade nötig.',
              },
              {
                q: 'Was ist der externe DSB-Add-on?',
                a: 'Auf Wunsch vermitteln wir einen externen Datenschutzbeauftragten unserer Partnerkanzlei. Stundenkontingent oder Pauschale, separate Vereinbarung.',
              },
            ].map((item) => (
              <details
                key={item.q}
                className="group p-5 bg-obsidian-900/60 border border-silver-700/30 hover:border-titanium-200/60 rounded-none transition-colors"
              >
                <summary className="flex items-center justify-between gap-3 cursor-pointer list-none">
                  <span className="font-display font-bold text-titanium-50 text-base leading-snug">
                    {item.q}
                  </span>
                  <span className="text-titanium-100 text-xl leading-none transition-transform group-open:rotate-45 select-none">
                    +
                  </span>
                </summary>
                <p className="text-sm text-silver-300 leading-relaxed mt-3">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer — gleiche Struktur wie HeroOnly */}
      <footer className="border-t border-silver-700/40 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-wider text-silver-500">
          <div className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-titanium-100" />
            <span>© 2026 RealSync Dynamics · Made in Germany</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/cookie-scanner"        className="hover:text-titanium-50 text-titanium-100">Cookie-Scanner · Free</Link>
            <Link to="/ai-act-workflows"      className="hover:text-titanium-50 text-titanium-100">AI-Act Inventar · Beta</Link>
            <Link to="/legal/privacy"         className="hover:text-titanium-50">Datenschutz</Link>
            <Link to="/impressum"             className="hover:text-titanium-50">Impressum</Link>
            <Link to="/legal/sub-processors"  className="hover:text-titanium-50">Sub-Processors</Link>
            <Link to="/legal/methodology"     className="hover:text-titanium-50">Methodik</Link>
            <Link to="/security"              className="hover:text-titanium-50">Security</Link>
            <Link to="/status"                className="hover:text-titanium-50">Status</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TierCard({ tier }: { tier: Tier }) {
  const TierIcon = tier.id === 'bronze' ? Cookie : tier.id === 'silver' ? ShieldCheck : Building2;

  return (
    <div
      className={`relative flex flex-col p-6 sm:p-7 bg-obsidian-900/60 border rounded-none transition-colors ${
        tier.highlight
          ? 'border-titanium-200/80 shadow-[0_0_0_1px_rgba(229,231,235,0.25)]'
          : 'border-silver-700/30 hover:border-titanium-200/60'
      }`}
    >
      {tier.highlight && (
        <div className="absolute -top-3 left-5 px-2 py-0.5 bg-titanium-50 text-obsidian-950 font-mono uppercase tracking-wider text-[10px] font-bold">
          Empfohlen
        </div>
      )}

      <div className="flex items-center gap-2 mb-2 mt-1">
        <TierIcon className="h-4 w-4 text-titanium-100" />
        <div className="font-display font-bold text-titanium-50 text-lg tracking-tight">
          {tier.name}
        </div>
      </div>

      <div className="flex items-baseline gap-1.5 mb-1.5">
        <div className="text-3xl font-display font-bold text-titanium-100 tabular-nums">
          {tier.price}
        </div>
        <div className="text-xs font-mono uppercase tracking-wider text-silver-400">
          {tier.priceSuffix}
        </div>
      </div>

      <div className="text-[11px] font-mono uppercase tracking-wider text-silver-400 mb-4">
        {tier.tagline}
      </div>

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

      <Link
        to={tier.ctaHref}
        className={`inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-none transition-colors ${
          tier.highlight
            ? 'surface-mono'
            : 'border border-silver-500 hover:border-titanium-200 text-silver-100 hover:text-titanium-50'
        }`}
      >
        {tier.ctaLabel} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
