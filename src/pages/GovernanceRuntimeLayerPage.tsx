import { Link } from 'react-router-dom';
import { ArrowRight, Shield, TrendingUp, Lock, Zap, Eye, AlertCircle } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { GovernanceAiHeader } from '../components/landing/GovernanceAiHeader';
import { GovernanceFooter } from '../components/landing/GovernanceFooter';
import {
  GA_GOLD,
  GA_H2,
  GA_HAIRLINE_GRID,
  GA_LINE_SOFT,
  GA_MUTED,
  GA_PANEL,
  GA_PILL_GHOST,
  GA_PILL_PRIMARY,
  GA_SANS,
} from '../components/landing/governance-ai-theme';

const GA_ACCENT_STYLE = { color: GA_GOLD } as const;
const EYEBROW = 'text-[11px] font-semibold tracking-[0.22em]';
const H2 = 'mt-3 tracking-[-0.03em]';

const PILLARS = [
  { icon: TrendingUp, label: 'Risikobewertung', desc: 'Klassifizierung und Risikostufe je KI-System — Handlungsbedarf wird sichtbar' },
  { icon: Lock, label: 'Unveränderlicher Prüfpfad', desc: 'Jede Entscheidung, Freigabe und Änderung SHA-256-verkettet dokumentiert' },
  { icon: Shield, label: 'EU AI Act Enforcement', desc: 'Klassifizierung, Risikostufen und Compliance-Gates vor der Ausführung' },
  { icon: Eye, label: 'DSGVO-Datenschutz', desc: 'Consent-Tracking, Zweckbindung und Datenflüsse je Provider' },
  { icon: Zap, label: 'Policy-as-Code', desc: 'Governance-Regeln werden durchgesetzt, nicht nur empfohlen' },
  { icon: AlertCircle, label: 'Herkunftsnachweis', desc: 'Nachvollziehbar, welche Daten, Modelle und Freigaben zu einem Ergebnis geführt haben' },
] as const;

const MARKETS = [
  { industry: 'Finance', challenge: 'Kreditvergabe, Fraud-Detection und Handelsalgorithmen unter Aufsicht' },
  { industry: 'Healthcare', challenge: 'Diagnostik-KI und Behandlungsempfehlungen mit besonderen Datenkategorien' },
  { industry: 'Insurance', challenge: 'Underwriting und Schadenbearbeitung unter Fairness-Anforderungen' },
  { industry: 'Public Sector', challenge: 'Öffentliche Services müssen transparent, prüfbar und fair sein' },
  { industry: 'HR & Talent', challenge: 'Recruiting- und Performance-Algorithmen unter DSGVO und AGG' },
  { industry: 'Industry 4.0', challenge: 'Autonome Systeme und Predictive Maintenance unter Sicherheitsvorschriften' },
] as const;

const DIFFERENTIATORS = [
  { label: 'Architektur', value: 'Runtime Governance Layer, kein nachträglich angeflanschtes Compliance-Tool' },
  { label: 'Regulatorische Ausrichtung', value: 'EU AI Act und DSGVO nativ; EU-souveräne Infrastruktur' },
  { label: 'Durchsetzung', value: 'Policies werden vor der Ausführung entschieden; Regeln sind Code, keine Dokumente' },
  { label: 'Evidence', value: 'Unveränderlicher Prüfpfad, exportierbar für Aufsicht und Audit' },
  { label: 'Skalierung', value: 'Governance über alle KI-Systeme des Unternehmens, nicht je Modell' },
  { label: 'Speed to Safety', value: 'Laufende Governance statt Review nach dem Deployment' },
] as const;

const ROADMAP = [
  {
    phase: 'Phase 1 (Live)',
    items: [
      'EU AI Act Risikoklassifizierung und Dokumentation',
      'Prüfpfad für alle Governance-Aktionen',
      'Policy-as-Code für Compliance-Regeln',
      'DSGVO-Consent und Datenfluss-Tracking',
    ],
  },
  {
    phase: 'Phase 2 (Committed)',
    items: [
      'Laufendes Risk Scoring über das KI-Portfolio',
      'Vorausschauende Compliance-Alerts',
      'Automatisch zusammengestellte Evidence für Audits',
      'Governance-Graph über Modelle hinweg',
    ],
  },
  {
    phase: 'Phase 3 (Vision)',
    items: [
      'Echtzeit-Monitoring für Fairness und Bias',
      'Autonome Governance-Durchsetzung',
      'Prüfpfade für Aufsicht, Board und Kunden',
      'Zertifizierter Herkunftsnachweis für KI-Systeme',
    ],
  },
] as const;

function Eyebrow({ children }: { children: string }) {
  return (
    <p className={EYEBROW} style={GA_ACCENT_STYLE}>
      {children}
    </p>
  );
}

export function GovernanceRuntimeLayerPage() {
  return (
    <div
      className="rs-paper ga-context rs-handoff landing-context relative min-h-screen antialiased"
      style={{ backgroundColor: 'var(--ga-void)', color: 'var(--ga-text)', fontFamily: GA_SANS }}
    >
      <SEOHead
        title="Governance Runtime Layer für Enterprise-KI | RealSync Dynamics"
        description="Das Kontroll- und Betriebssystem für Enterprise-KI. Laufende Governance statt Deployment-Geschwindigkeit."
        canonical="/governance-runtime-layer"
      />

      <GovernanceAiHeader />

      <main className="relative z-10">
        <section className="border-b py-[120px]" style={{ borderColor: GA_LINE_SOFT }}>
          <div className="mx-auto max-w-[1280px] px-[4vw]">
            <Eyebrow>GOVERNANCE RUNTIME LAYER</Eyebrow>
            <h1
              className="mt-4 text-[clamp(2.5rem,2rem+3vw,4rem)] tracking-tight"
              style={{ fontWeight: 700, lineHeight: 1.1 }}
            >
              Das Governance Runtime Layer für Enterprise-KI
            </h1>
            <p className="mt-6 max-w-2xl text-[16px] leading-relaxed" style={{ color: GA_MUTED }}>
              Andere helfen, KI schneller einzusetzen. RealSync hilft, KI sicher zu betreiben.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link to="/audit" className={`${GA_PILL_PRIMARY} ga-pill-sheen`} style={PRIMARY_PILL_STYLE}>
                Governance starten <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to="/pricing" className={GA_PILL_GHOST} style={{ fontFamily: GA_SANS }}>
                Preise ansehen
              </Link>
            </div>
          </div>
        </section>

        <section className="border-b py-[72px]" style={{ borderColor: GA_LINE_SOFT }}>
          <div className="mx-auto max-w-[1280px] px-[4vw]">
            <Eyebrow>DER UNTERSCHIED</Eyebrow>
            <h2 className={H2} style={{ fontSize: GA_H2, fontWeight: 600 }}>
              Governance als Infrastruktur, nicht als Checkliste
            </h2>

            <div className={`mt-10 grid overflow-hidden md:grid-cols-2 ${GA_HAIRLINE_GRID}`} style={{ borderColor: GA_LINE_SOFT }}>
              <div className="p-7" style={{ backgroundColor: GA_PANEL }}>
                <h3 className="text-sm font-semibold" style={{ color: GA_MUTED }}>
                  Klassische Compliance
                </h3>
                <ul className="mt-4 space-y-2 text-[13px] leading-relaxed" style={{ color: GA_MUTED }}>
                  <li>✗ Compliance-Checkliste beim Deployment</li>
                  <li>✗ Prüfpfad erst nach dem Vorfall</li>
                  <li>✗ Reaktive Risiko-Erkennung</li>
                  <li>✗ Policy als Dokument</li>
                  <li>✗ Manuelle Evidence-Sammlung</li>
                </ul>
              </div>
              <div className="p-7" style={{ backgroundColor: GA_PANEL }}>
                <h3 className="text-sm font-semibold" style={GA_ACCENT_STYLE}>
                  RealSync Governance Runtime
                </h3>
                <ul className="mt-4 space-y-2 text-[13px] leading-relaxed" style={{ color: GA_MUTED }}>
                  <li>✓ Governance als laufende Infrastruktur</li>
                  <li>✓ Unveränderliche Evidence bei jeder Entscheidung</li>
                  <li>✓ Risikobewertung vor der Ausführung</li>
                  <li>✓ Policy als durchgesetzter Code</li>
                  <li>✓ Herkunftsnachweis je Ergebnis</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b py-[72px]" style={{ borderColor: GA_LINE_SOFT }}>
          <div className="mx-auto max-w-[1280px] px-[4vw]">
            <Eyebrow>SECHS SÄULEN</Eyebrow>
            <h2 className={H2} style={{ fontSize: GA_H2, fontWeight: 600 }}>
              Governance-Runtime-Architektur
            </h2>
            <div className={`mt-10 grid overflow-hidden sm:grid-cols-2 lg:grid-cols-3 ${GA_HAIRLINE_GRID}`} style={{ borderColor: GA_LINE_SOFT }}>
              {PILLARS.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="p-7" style={{ backgroundColor: GA_PANEL }}>
                  <div className="flex items-start gap-3">
                    <Icon className="h-5 w-5 shrink-0" style={GA_ACCENT_STYLE} aria-hidden="true" />
                    <div>
                      <h3 className="text-sm font-semibold">{label}</h3>
                      <p className="mt-2 text-[12px] leading-relaxed" style={{ color: GA_MUTED }}>
                        {desc}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b py-[72px]" style={{ borderColor: GA_LINE_SOFT }}>
          <div className="mx-auto max-w-[1280px] px-[4vw]">
            <Eyebrow>BRANCHEN</Eyebrow>
            <h2 className={H2} style={{ fontSize: GA_H2, fontWeight: 600 }}>
              Für Unternehmen, bei denen Governance nicht optional ist
            </h2>
            <div className={`mt-10 grid overflow-hidden sm:grid-cols-2 lg:grid-cols-3 ${GA_HAIRLINE_GRID}`} style={{ borderColor: GA_LINE_SOFT }}>
              {MARKETS.map(({ industry, challenge }) => (
                <div key={industry} className="p-7" style={{ backgroundColor: GA_PANEL }}>
                  <h3 className="text-sm font-semibold">{industry}</h3>
                  <p className="mt-3 text-[12px] leading-relaxed" style={{ color: GA_MUTED }}>
                    {challenge}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b py-[72px]" style={{ borderColor: GA_LINE_SOFT }}>
          <div className="mx-auto max-w-[1280px] px-[4vw]">
            <Eyebrow>WARUM REALSYNC</Eyebrow>
            <h2 className={H2} style={{ fontSize: GA_H2, fontWeight: 600 }}>
              Governance-Infrastruktur als Wettbewerbsvorteil
            </h2>
            <div className="mt-10 space-y-4">
              {DIFFERENTIATORS.map(({ label, value }) => (
                <div key={label} className="border-l pl-6" style={{ borderColor: GA_LINE_SOFT }}>
                  <h3 className="text-sm font-semibold">{label}</h3>
                  <p className="mt-1 text-[13px]" style={{ color: GA_MUTED }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b py-[72px]" style={{ borderColor: GA_LINE_SOFT }}>
          <div className="mx-auto max-w-[1280px] px-[4vw]">
            <Eyebrow>ROADMAP</Eyebrow>
            <h2 className={H2} style={{ fontSize: GA_H2, fontWeight: 600 }}>
              Phase 1 – 3: Aufbau der Governance-Infrastruktur
            </h2>
            <div className="mt-10 space-y-6">
              {ROADMAP.map(({ phase, items }) => (
                <div key={phase} className="border-l-2 pl-6" style={{ borderColor: GA_LINE_SOFT }}>
                  <h3 className="text-sm font-semibold" style={GA_ACCENT_STYLE}>
                    {phase}
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {items.map((item) => (
                      <li key={item} className="text-[13px]" style={{ color: GA_MUTED }}>
                        • {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-[80px]">
          <div className="mx-auto max-w-3xl px-[4vw] text-center">
            <h2 className="tracking-tight" style={{ fontSize: GA_H2, fontWeight: 600 }}>
              Governance-Infrastruktur starten
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed" style={{ color: GA_MUTED }}>
              Enterprise-KI verlangt laufende Governance, nicht nur Deployment-Geschwindigkeit. RealSync ist die
              Runtime-Schicht dafür.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/audit" className={`${GA_PILL_PRIMARY} ga-pill-sheen`} style={PRIMARY_PILL_STYLE}>
                Jetzt starten <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to="/pricing" className={GA_PILL_GHOST} style={{ fontFamily: GA_SANS }}>
                Preise &amp; Details
              </Link>
            </div>
          </div>
        </section>
      </main>

      <GovernanceFooter />
    </div>
  );
}

const PRIMARY_PILL_STYLE = {
  fontFamily: GA_SANS,
  backgroundImage: 'var(--ga-pill-face)',
  color: 'var(--ga-pill-ink)',
  boxShadow: 'var(--ga-pill-shadow)',
} as const;
