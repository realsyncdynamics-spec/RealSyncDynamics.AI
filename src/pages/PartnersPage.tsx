import { Link } from 'react-router-dom';
import {
  ShieldCheck, ArrowRight, ArrowLeft, Briefcase, CheckCircle2, Clock,
  MapPin, AlertTriangle, Building2, Users, FileText,
} from 'lucide-react';

// /partners — Honest partner-program landing for DSB-Kanzleien and
// compliance consultants. Built INSTEAD of promising provisioned
// affiliate tiers (Bronze/Silber/Gold/Platin) that don't exist in code.
// What this page promises matches exactly what the backend supports today.
//
// Future work that would let us extend this page:
//   - Affiliate-tracking table + Edge Function (no code today)
//   - 50-tenant quota enforcement (Scale-Tier ships in #349)
//   - Stripe price IDs for Scale + recurring partner-rev-share
//   - 30-day trial backend (not implemented)
//
// Until those exist, this page commits ONLY to manual partner onboarding,
// existing tier prices, and Q4 2026 roadmap for the rest.

export function PartnersPage() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link
          to="/"
          className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3"
          aria-label="Zur Startseite"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
            <Briefcase className="h-4 w-4 text-titanium-50" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">
            Partner-Programm · DSB-Kanzleien
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-16">
        {/* Hero */}
        <section className="max-w-4xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-700 bg-emerald-950/40 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
            <ShieldCheck className="h-3 w-3" /> Pilot-Partner gesucht · DACH
          </div>
          <h1 className="text-4xl sm:text-6xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-5">
            DSB-Kanzleien betreiben<br />
            Compliance-Runtime —<br />
            <span className="text-emerald-300">unsere Infrastruktur.</span>
          </h1>
          <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            Wenn Sie Datenschutzbeauftragten-Mandate führen und vor August 2026
            AI-Act-konforme Risk-Assessments für Ihre Mandanten ausliefern müssen:
            unsere Runtime liefert Discovery, Klassifikation, Controls, Evidence-Chain.
            <strong className="text-titanium-50"> Sie behalten den Mandanten — wir sind Zulieferer, kein Konkurrent.</strong>
          </p>
        </section>

        {/* Was geht heute */}
        <section className="max-w-6xl mx-auto mb-16">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-emerald-400 mb-3">
            ◆ live · sofort buchbar
          </div>
          <h2 className="text-3xl font-display font-semibold text-titanium-50 mb-2">
            Was Sie heute bekommen.
          </h2>
          <p className="text-titanium-400 mb-8 max-w-2xl">
            Drei Modelle, alle live + EU-gehostet. Monatlich kündbar, kein Setup-Fee, AVV nach Art. 28 DSGVO inklusive.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-titanium-900">
            <TierCard
              name="Agency"
              price="€699 / Monat"
              capacity="bis 10 Mandanten"
              accent="text-cyan-300"
              bullets={[
                'White-Label-Reports im eigenen Branding',
                'Multi-Tenant-Dashboard',
                'API + Webhooks für CI/CD',
                'Bulk-Audit für Domain-Portfolios',
                'Priority-Support',
              ]}
              cta={{ label: 'Direkt buchen', href: '/audit?plan=agency&source=partners' }}
            />
            <TierCard
              name="Scale"
              price="€1.999 / Monat"
              capacity="bis 50 Mandanten"
              accent="text-emerald-300"
              highlight
              bullets={[
                'Alles aus Agency',
                'Eigene Sub-Domain (dsb.ihrekanzlei.de)',
                'White-Label PDF + Live-Dashboard',
                'Voller API-Zugriff',
                'SLA 4 h · Priority-Support',
              ]}
              cta={{ label: 'Enterprise anfragen', href: '/contact-sales?tier=scale&source=partners' }}
              footnote="manuelles Onboarding · Pilot-Phase · Stripe-Self-Serve folgt"
            />
            <TierCard
              name="Enterprise"
              price="individuell"
              capacity="unbegrenzte Mandanten"
              accent="text-violet-300"
              bullets={[
                'Alle Scale-Funktionen',
                'Dedizierter Runtime-Kanal · SLA-Vertrag',
                'EU AI Act Governance-Modul',
                'DSB-Integration (intern oder extern)',
                'Evidence Vault · Custom DPA',
              ]}
              cta={{ label: 'Enterprise anfragen', href: '/contact-sales?tier=enterprise&source=partners' }}
              footnote="ab € 1.500 / Monat · Festpreis nach Mandanten-Volumen"
            />
          </div>
        </section>

        {/* Was läuft technisch heute */}
        <section className="max-w-6xl mx-auto mb-16 bg-obsidian-900 border border-titanium-900 p-6 sm:p-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
            ◇ technische Grundlage · alle Tiers
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-titanium-50 mb-6">
            Was unter der Haube live ist.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-titanium-900">
            <Feature
              icon={<MapPin className="h-5 w-5 text-emerald-300" />}
              title="EU-Hosting Frankfurt"
              body="Postgres + Auth + Edge Functions in Supabase eu-central-1. Optional Hostinger-VPS mit Ollama für strict-EU-lokal."
            />
            <Feature
              icon={<ShieldCheck className="h-5 w-5 text-emerald-300" />}
              title="Multi-Tenant per Default"
              body="Postgres Row-Level-Security erzwingt Mandanten-Isolation auf Storage-Ebene. Kein Cross-Tenant-Leakage möglich."
            />
            <Feature
              icon={<FileText className="h-5 w-5 text-emerald-300" />}
              title="AI Act Annex-III-Klassifikation"
              body="Edge Function klassifiziert KI-Endpunkte gegen AI Act Annex III. Live + auditiert (siehe /ai-act-klassifikator)."
            />
            <Feature
              icon={<CheckCircle2 className="h-5 w-5 text-emerald-300" />}
              title="Evidence-Chain · SHA-256"
              body="Jedes Finding wird gehasht + signiert. Audit-Bundles auf Knopfdruck exportierbar (siehe Evidence Vault im Enterprise-Tier)."
            />
          </div>
        </section>

        {/* Was ist auf der Roadmap */}
        <section className="max-w-6xl mx-auto mb-16">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-amber-400 mb-3">
            ◐ roadmap · Q4 2026
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-titanium-50 mb-2">
            Was wir ehrlich noch NICHT haben.
          </h2>
          <p className="text-titanium-400 mb-8 max-w-2xl">
            Wir sind in Pilot-Phase. Folgendes ist konzeptionell, aber noch nicht produktiv. Wenn Sie Partner werden, gestalten Sie mit, was zuerst gebaut wird.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-titanium-900">
            <Roadmap
              title="Provisions-Tracking"
              body="Bronze / Silber / Gold-Stufen mit prozentualer Beteiligung an vermittelten Subscriptions. Aktuell: individuelle Vereinbarung."
              eta="Q4 2026"
            />
            <Roadmap
              title="Self-Serve Scale-Checkout"
              body="Stripe-Checkout direkt aus /pricing für Scale-Tier. Aktuell: manuelles Onboarding über Sales (besser für die ersten 10 Kunden — wir verifizieren persönlich)."
              eta="Q3 2026"
            />
            <Roadmap
              title="50-Mandanten Hard-Quota"
              body="Backend-Enforcement der Tenant-Limits pro Tier. Aktuell: vertrauensbasiert + Soft-Monitoring."
              eta="Q4 2026"
            />
            <Roadmap
              title="Partner-Portal"
              body="Eigene Login-Seite, Übersicht über Mandanten-Stati, Provisions-Abrechnung. Aktuell: Daten via API-Zugriff + Excel-Export."
              eta="Q1 2027"
            />
          </div>
        </section>

        {/* Wirtschaftlichkeit */}
        <section className="max-w-4xl mx-auto mb-16 bg-obsidian-900 border border-emerald-700/40 p-6 sm:p-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-emerald-400 mb-3">
            ◆ rechnerisches Modell
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-titanium-50 mb-6">
            Was eine DSB-Kanzlei sich erspart.
          </h2>
          <div className="space-y-4 text-sm text-titanium-300 leading-relaxed">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-titanium-900">
              <Metric label="Audit-Vorbereitung pro Mandant" before="5–20 h manuell" after="5 min Prüfung" />
              <Metric label="DSB-Anfrage beantworten" before="3–8 h manuell" after="60 s Export" />
              <Metric label="AI-Act-Risk-Assessment" before="10–30 h" after="30 min Prüfung" />
            </div>
            <p className="text-titanium-400 pt-4 border-t border-titanium-900">
              <strong className="text-titanium-100">Konservative Schätzung:</strong> 13–21 Stunden pro Mandant pro Monat gewonnen. Bei 10 Mandanten = 130–210 h/Monat = etwa 3–5 Wochen abrechenbare Zeit pro Monat zurück.
            </p>
            <p className="text-[11px] text-titanium-500 leading-relaxed">
              <AlertTriangle className="h-3 w-3 inline-block mr-1 text-amber-400" />
              Diese Schätzung basiert auf Pilot-Feedback einzelner DSB-Mandate, nicht auf einer Erhebung. Konkrete Ersparnis hängt von Workflow-Reife, Mandanten-Komplexität und Audit-Tiefe ab. Wir versprechen kein „garantiert 20 h gespart" — wir versprechen einen messbaren Hebel pro Mandant.
            </p>
          </div>
        </section>

        {/* Was wir NICHT versprechen */}
        <section className="max-w-4xl mx-auto mb-16 p-6 sm:p-10 border border-titanium-800 rounded-none bg-obsidian-950">
          <h2 className="text-xl sm:text-2xl font-display font-semibold text-titanium-50 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            Was wir nicht versprechen.
          </h2>
          <ul className="space-y-3 text-sm text-titanium-400 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-titanium-600 mt-1">▸</span>
              <span><strong className="text-titanium-200">„100 % rechtssicher"</strong> — das kann niemand seriös. Unsere Outputs sind technisch + methodisch fundiert, aber kein Ersatz für individuelle Rechtsberatung.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-titanium-600 mt-1">▸</span>
              <span><strong className="text-titanium-200">„Vollautomatisch keine menschliche Prüfung"</strong> — unsere Agenten klassifizieren + empfehlen. Die finale Freigabe macht der DSB. Genau so will es der AI Act (Human Oversight, Art. 14).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-titanium-600 mt-1">▸</span>
              <span><strong className="text-titanium-200">SOC 2 / ISO 27001 Zertifizierung</strong> — beide in Vorbereitung Q4 2026. Bis dahin: transparente Security-Roadmap unter <Link to="/security" className="text-cyan-300 hover:underline">/security</Link>.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-titanium-600 mt-1">▸</span>
              <span><strong className="text-titanium-200">Fixe Provisions-Sätze in der Pilot-Phase</strong> — wir verhandeln pro Partner individuell, bis das Tracking-System lebt. Fair für beide Seiten.</span>
            </li>
          </ul>
        </section>

        {/* CTA */}
        <section className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-titanium-50 mb-4">
            Pilot-Partner werden.
          </h2>
          <p className="text-titanium-400 mb-8">
            Wir verstehen Ihre Mandanten-Struktur, Sie entscheiden ob's passt. Keine Kreditkarte.
          </p>
          <Link
            to="/contact-sales?source=partners&tier=pilot"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-obsidian-950 font-semibold text-sm tracking-tight transition-colors"
          >
            <Clock className="h-4 w-4" />
            Enterprise anfragen
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-6 text-[11px] font-mono uppercase tracking-wider text-titanium-500">
            Made in Germany · EU-Hosted · DACH-fokussiert · Monatlich kündbar
          </p>
        </section>
      </main>
    </div>
  );
}

function TierCard({
  name, price, capacity, bullets, cta, accent, highlight, footnote,
}: {
  name: string;
  price: string;
  capacity: string;
  bullets: string[];
  cta: { label: string; href: string };
  accent: string;
  highlight?: boolean;
  footnote?: string;
}) {
  return (
    <article className={`bg-obsidian-950 p-6 sm:p-7 flex flex-col ${highlight ? 'ring-1 ring-emerald-500/50 relative' : ''}`}>
      {highlight && (
        <span className="absolute -top-2 right-3 px-1.5 py-0.5 bg-emerald-400 text-obsidian-950 font-mono text-[9px] uppercase tracking-wider">
          DSB-Kanzlei Sweet-Spot
        </span>
      )}
      <header className="mb-4">
        <div className={`font-mono text-[10px] uppercase tracking-wider mb-2 ${accent}`}>{name}</div>
        <div className="font-display font-bold text-2xl text-titanium-50">{price}</div>
        <div className="font-mono text-[11px] text-titanium-500 mt-1">{capacity}</div>
      </header>
      <ul className="space-y-2 mb-6 flex-1">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm text-titanium-300 leading-relaxed">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-400" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <Link
        to={cta.href}
        className={`inline-flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold tracking-tight transition-colors ${
          highlight
            ? 'bg-emerald-500 text-obsidian-950 hover:bg-emerald-400'
            : 'bg-obsidian-900 text-titanium-100 hover:bg-obsidian-800 border border-titanium-800'
        }`}
      >
        {cta.label}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
      {footnote && (
        <div className="mt-3 font-mono text-[10px] text-titanium-500 leading-relaxed">{footnote}</div>
      )}
    </article>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="bg-obsidian-950 p-5 flex gap-3">
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div>
        <div className="font-display font-semibold text-titanium-50 text-sm mb-1">{title}</div>
        <p className="text-titanium-400 text-xs leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function Roadmap({ title, body, eta }: { title: string; body: string; eta: string }) {
  return (
    <div className="bg-obsidian-950 p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="font-display font-semibold text-titanium-50 text-sm">{title}</div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-amber-400 border border-amber-700/40 px-1.5 py-0.5">{eta}</span>
      </div>
      <p className="text-titanium-400 text-xs leading-relaxed">{body}</p>
    </div>
  );
}

function Metric({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="bg-obsidian-950 p-4">
      <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-2">{label}</div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-titanium-500 line-through decoration-titanium-700">{before}</span>
        <ArrowRight className="h-3 w-3 text-emerald-400 shrink-0" />
        <span className="text-emerald-300 font-semibold">{after}</span>
      </div>
    </div>
  );
}

// Keep imports referenced when component-shape changes refactor away.
void Users;
void Building2;
