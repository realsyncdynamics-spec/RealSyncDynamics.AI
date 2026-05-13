import { Link } from 'react-router-dom';
import { ShieldCheck, Brain, Wrench, ArrowRight } from 'lucide-react';

/**
 * ProductDifferentiationSection — beantwortet die Frage:
 * "Welches der drei Produkte brauche ich?"
 *
 * Drei Karten, klar voneinander abgegrenzt:
 *   1. DSGVO-Website-Audit  (Free + Starter)  -> Compliance-Pflicht
 *   2. AI Governance OS     (Growth + Enterprise) -> AI-Nutzung kontrollieren
 *   3. Website-Rebuild      (Custom-Quote)    -> wir bauen Ihre Site neu auf
 *
 * Eingebettet auf der Homepage direkt nach dem Hero — antwortet bewusst
 * auf den Test-Kunde-Critique "kein klarer Unterschied DSGVO-Audit /
 * AI-Governance / Website-Rebuild".
 */

const PRODUCTS = [
  {
    icon: ShieldCheck,
    eyebrow: 'Compliance-Pflicht',
    title: 'DSGVO-Website-Audit',
    audience: 'Marketing-Verantwortliche · DSBs · WebOps',
    description:
      'Echter Headless-Browser-Scan mit Pre-Consent-Tracker-Detection, Risk-Score, Auto-Fix-Empfehlungen. Free Audit als Einstieg, Continuous Monitoring im Abo.',
    bullets: [
      'Free Audit (0 €, kein Account)',
      'Starter ab 79 €/Monat',
      'Tagesgenaue Drift-Detection',
      'PDF-Reports mit Paragraphenbezug',
    ],
    cta: { label: 'Jetzt scannen lassen', href: '/audit?source=hp-product-audit' },
    secondary: { label: 'Cookie-Scanner ansehen', href: '/cookie-scanner' },
    tone: 'border-l-emerald-400/70',
  },
  {
    icon: Brain,
    eyebrow: 'AI-Nutzung kontrollieren',
    title: 'AI Governance OS',
    audience: 'CTOs · CISOs · Compliance-Officer',
    description:
      'Inventarisieren, klassifizieren, überwachen, nachweisen. Browser-Extension + Telemetry + Policy-Engine + Evidence-Vault. EU AI Act + BAIT + MaRisk audit-ready.',
    bullets: [
      'Growth ab 249 €/Monat',
      'Enterprise ab Anfrage',
      'Browser-Extension für 5 Vendoren',
      'Hash-Chain + HMAC-Signaturen',
    ],
    cta: { label: 'AI Governance OS ansehen', href: '/ai-governance?source=hp-product-aig' },
    secondary: { label: 'EU AI Act FAQ', href: '/ai-act-faq' },
    tone: 'border-l-gold-400',
  },
  {
    icon: Wrench,
    eyebrow: 'Operative Lösung',
    title: 'DSGVO-Website-Rebuild',
    audience: 'Geschäftsführung · IT-Leitung · Marketing',
    description:
      'Wir bauen Ihre Website DSGVO-konform neu auf — Festpreis, EU-Hosting, Cookie-Banner-Konfig + Datenschutzerklärung + Impressum. Statt monatlichen Stundensatz.',
    bullets: [
      'Festpreis statt Stundensatz',
      'Komplette Tracker-Lokalisierung',
      'Cookie-Consent (opt-in) integriert',
      'Continuous Monitoring inklusive',
    ],
    cta: { label: 'Rebuild anfragen', href: '/dsgvo-website?source=hp-product-rebuild' },
    secondary: { label: 'Methodik-Doku', href: '/legal/methodology' },
    tone: 'border-l-titanium-200',
  },
];

export function ProductDifferentiationSection() {
  return (
    <section
      id="welches-produkt"
      className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-12 sm:py-16 bg-obsidian-950/50"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8 sm:mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
            Drei Produkte · klar getrennt
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight max-w-3xl mx-auto">
            Welches Produkt brauchen Sie?
          </h2>
          <p className="mt-3 max-w-2xl mx-auto text-sm sm:text-base text-silver-300 leading-relaxed">
            Wir liefern drei abgegrenzte Produkte. Nicht alle sind für alle. Hier die kurze Zuordnung —
            Detail-Sub-Pages verlinkt pro Karte.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          {PRODUCTS.map((p) => {
            const Icon = p.icon;
            return (
              <article
                key={p.title}
                className={`flex flex-col bg-obsidian-900/80 border border-silver-700/30 border-l-2 ${p.tone} p-5 sm:p-6`}
              >
                <Icon className="h-6 w-6 text-titanium-100 mb-3" />
                <div className="text-[11px] font-mono uppercase tracking-wider text-silver-500 mb-1">
                  {p.eyebrow}
                </div>
                <h3 className="font-display font-bold text-titanium-50 text-lg sm:text-xl mb-1 leading-tight">
                  {p.title}
                </h3>
                <div className="text-[11px] font-mono text-silver-500 mb-3">{p.audience}</div>
                <p className="text-sm text-silver-300 leading-relaxed mb-4">{p.description}</p>

                <ul className="space-y-1.5 text-sm text-silver-200 mb-5 flex-1">
                  {p.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <span className="text-gold-400 shrink-0 leading-relaxed">+</span>
                      <span className="leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to={p.cta.href}
                  className="surface-mono inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-none mb-2"
                >
                  {p.cta.label} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to={p.secondary.href}
                  className="text-center text-xs font-mono text-silver-400 hover:text-titanium-200"
                >
                  {p.secondary.label}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
