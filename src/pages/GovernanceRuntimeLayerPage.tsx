import { Link } from 'react-router-dom';
import { ArrowRight, Shield, TrendingUp, Lock, Zap, Eye, AlertCircle } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { PublicDarkHeader } from '../components/landing/PublicDarkHeader';
import { LandingModeSwitch } from '../components/landing/LandingModeSwitch';
import { MODE_BG, MODE_MUTED, MODE_TEXT, modeVeil, useLandingMode } from '../components/landing/landing-mode';
import {
  LANDING_ACCENT,
  LANDING_ACCENT_SOFT,
  LANDING_BG,
  LANDING_BUTTON,
  LANDING_BUTTON_TEXT,
  LANDING_MONO,
  LANDING_SANS,
} from '../components/landing/landing-theme';

export function GovernanceRuntimeLayerPage() {
  const { mode, setMode } = useLandingMode();

  return (
    <div
      className="landing-context relative min-h-screen antialiased"
      data-landing-mode={mode}
      style={{
        backgroundColor: MODE_BG,
        color: MODE_TEXT,
        fontFamily: LANDING_SANS,
      }}
    >
      <SEOHead
        title="Governance Runtime Layer für Enterprise-KI | RealSync Dynamics"
        description="Das Kontroll- und Betriebssystem für Enterprise-AI. Kontinuierliche Governance, nicht Deployment-Geschwindigkeit."
        canonical="/governance-runtime-layer"
      />

      <PublicDarkHeader overlay modeSwitch={<LandingModeSwitch mode={mode} onChange={setMode} />} />

      <main className="relative z-10">
        {/* Hero */}
        <section className="border-b border-white/[0.06] py-[120px]">
          <div className="mx-auto max-w-[1280px] px-[4vw]">
            <p
              className="text-[10px] tracking-[0.22em]"
              style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
            >
              GOVERNANCE RUNTIME LAYER
            </p>
            <h1
              className="mt-4 text-[clamp(2.5rem,2rem+3vw,4rem)] tracking-tight"
              style={{ fontWeight: 700, lineHeight: 1.1 }}
            >
              Das Kontroll- und Betriebssystem für Enterprise-KI
            </h1>
            <p className="mt-6 max-w-2xl text-[16px] leading-relaxed" style={{ color: MODE_MUTED }}>
              Andere helfen, KI schneller einzusetzen. RealSync hilft, KI sicher zu betreiben.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                to="/audit"
                className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-[14px] font-semibold transition hover:brightness-110"
                style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
              >
                Governance starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center gap-2 rounded-full border px-8 py-4 text-[14px] font-medium"
                style={{ borderColor: `${LANDING_ACCENT}66`, color: LANDING_ACCENT }}
              >
                Preise ansehen
              </Link>
            </div>
          </div>
        </section>

        {/* Thesis: Traditional vs RealSync */}
        <section className="border-b border-white/[0.06] py-[72px]" style={{ backgroundColor: modeVeil(36) }}>
          <div className="mx-auto max-w-[1280px] px-[4vw]">
            <p
              className="text-[10px] tracking-[0.22em]"
              style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
            >
              DER UNTERSCHIED
            </p>
            <h2
              className="mt-3 text-[clamp(1.75rem,1.1rem+2vw,2.5rem)] tracking-[-0.03em]"
              style={{ fontWeight: 600 }}
            >
              Governance als Infrastruktur, nicht als Checkliste
            </h2>

            <div className="mt-10 grid gap-px overflow-hidden border border-white/10 bg-white/10 md:grid-cols-2">
              {/* Traditional */}
              <div className="p-7" style={{ backgroundColor: LANDING_BG }}>
                <h3 className="text-sm font-semibold" style={{ color: MODE_MUTED }}>
                  Traditionelle Compliance
                </h3>
                <ul className="mt-4 space-y-2 text-[13px] leading-relaxed" style={{ color: MODE_MUTED }}>
                  <li>✗ Compliance-Checkliste bei Deployment</li>
                  <li>✗ Audit-Trail nach Sicherheitsfällen</li>
                  <li>✗ Reaktive Risiko-Erkennung</li>
                  <li>✗ Policy als Dokument</li>
                  <li>✗ Manuelle Evidence-Sammlung</li>
                </ul>
              </div>

              {/* RealSync */}
              <div className="p-7" style={{ backgroundColor: LANDING_BG }}>
                <h3 className="text-sm font-semibold" style={{ color: LANDING_ACCENT }}>
                  RealSync Governance Runtime
                </h3>
                <ul className="mt-4 space-y-2 text-[13px] leading-relaxed" style={{ color: MODE_MUTED }}>
                  <li>✓ Kontinuierliche Governance-Infrastruktur</li>
                  <li>✓ Immutable Evidence in Echtzeit</li>
                  <li>✓ Proaktive Risiko-Überwachung</li>
                  <li>✓ Policy als durchgesetzer Code</li>
                  <li>✓ Automatisierte Provenance &amp; Lineage</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Six Pillars */}
        <section className="border-b border-white/[0.06] py-[72px]">
          <div className="mx-auto max-w-[1280px] px-[4vw]">
            <p
              className="text-[10px] tracking-[0.22em]"
              style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
            >
              SECHS SÄULEN
            </p>
            <h2
              className="mt-3 text-[clamp(1.75rem,1.1rem+2vw,2.5rem)] tracking-[-0.03em]"
              style={{ fontWeight: 600 }}
            >
              Governance Runtime Architektur
            </h2>

            <div className="mt-10 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: TrendingUp, label: 'Continuous Risk Monitoring', desc: 'Echtzeit-Erkennung von Drift, Bias, Modell-Degradation' },
                { icon: Lock, label: 'Immutable Audit Trail', desc: 'Jede Entscheidung, Intervention, Änderung dokumentiert' },
                { icon: Shield, label: 'EU AI Act Enforcement', desc: 'Automatische Klassifizierung und Compliance-Gates' },
                { icon: Eye, label: 'DSGVO Datenschutz', desc: 'Consent-Tracking, Purpose-Limitation, Daten-Lineage' },
                { icon: Zap, label: 'Policy-as-Code', desc: 'Governance-Regeln durchgesetzt, nicht nur empfohlen' },
                { icon: AlertCircle, label: 'Provenance & Lineage', desc: 'Vollständige Sichtbarkeit über AI-System-Inputs' },
              ].map((pillar, idx) => {
                const IconComponent = pillar.icon;
                return (
                  <div key={idx} className="p-7" style={{ backgroundColor: LANDING_BG }}>
                    <div className="flex items-start gap-3">
                      <IconComponent className="h-5 w-5 shrink-0" style={{ color: LANDING_ACCENT }} />
                      <div>
                        <h3 className="text-sm font-semibold">{pillar.label}</h3>
                        <p className="mt-2 text-[12px] leading-relaxed" style={{ color: MODE_MUTED }}>
                          {pillar.desc}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Target Markets */}
        <section className="border-b border-white/[0.06] py-[72px]" style={{ backgroundColor: modeVeil(36) }}>
          <div className="mx-auto max-w-[1280px] px-[4vw]">
            <p
              className="text-[10px] tracking-[0.22em]"
              style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
            >
              BRANCHEN
            </p>
            <h2
              className="mt-3 text-[clamp(1.75rem,1.1rem+2vw,2.5rem)] tracking-[-0.03em]"
              style={{ fontWeight: 600 }}
            >
              Für Unternehmen, bei denen Governance nicht optional ist
            </h2>

            <div className="mt-10 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { industry: 'Finance', challenge: 'Kreditvergabe, Fraud-Detection, Handelsalgorithmen reguliert' },
                { industry: 'Healthcare', challenge: 'Diagnostik-KI, Behandlungsempfehlungen GDPR + spezialisiert' },
                { industry: 'Insurance', challenge: 'Underwriting, Claims-Processing unter Fairness-Anforderungen' },
                { industry: 'Public Sector', challenge: 'Öffentliche Services müssen transparent, auditable, fair sein' },
                { industry: 'HR & Talent', challenge: 'Recruitment, Performance-Algorithmen unter GDPR + Anti-Diskriminierung' },
                { industry: 'Industry 4.0', challenge: 'Autonome Systeme, Predictive Maintenance unter Sicherheitsvorschriften' },
              ].map((market, idx) => (
                <div key={idx} className="p-7" style={{ backgroundColor: LANDING_BG }}>
                  <h3 className="text-sm font-semibold">{market.industry}</h3>
                  <p className="mt-3 text-[12px] leading-relaxed" style={{ color: MODE_MUTED }}>
                    {market.challenge}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Key Differentiators */}
        <section className="border-b border-white/[0.06] py-[72px]">
          <div className="mx-auto max-w-[1280px] px-[4vw]">
            <p
              className="text-[10px] tracking-[0.22em]"
              style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
            >
              WARUM REALSYNC
            </p>
            <h2
              className="mt-3 text-[clamp(1.75rem,1.1rem+2vw,2.5rem)] tracking-[-0.03em]"
              style={{ fontWeight: 600 }}
            >
              Governance-Infrastruktur als Wettbewerbsvorteil
            </h2>

            <div className="mt-10 space-y-4">
              {[
                { label: 'Architektur', value: 'Runtime Governance Layer, nicht Bolt-on Compliance' },
                { label: 'Regulatorische Ausrichtung', value: 'EU AI Act + GDPR nativ; EU-souveräne Infrastruktur' },
                { label: 'Durchsetzung', value: 'Policy-Execution in Echtzeit; Regeln sind Code, nicht Dokumente' },
                { label: 'Evidence', value: 'Immutable Audit Trail; exportierbar im Regulator-Format' },
                { label: 'Skalierung', value: 'Enterprise-weite KI-Governance, nicht einzeln-Modell' },
                { label: 'Speed to Safety', value: 'Kontinuierliche Überwachung vs Post-Deployment Review' },
              ].map((diff, idx) => (
                <div key={idx} className="flex gap-6 border-l border-white/10 pl-6">
                  <div className="shrink-0">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: LANDING_ACCENT }}
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{diff.label}</h3>
                    <p className="mt-1 text-[13px]" style={{ color: MODE_MUTED }}>
                      {diff.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Roadmap */}
        <section className="border-b border-white/[0.06] py-[72px]" style={{ backgroundColor: modeVeil(36) }}>
          <div className="mx-auto max-w-[1280px] px-[4vw]">
            <p
              className="text-[10px] tracking-[0.22em]"
              style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
            >
              ROADMAP
            </p>
            <h2
              className="mt-3 text-[clamp(1.75rem,1.1rem+2vw,2.5rem)] tracking-[-0.03em]"
              style={{ fontWeight: 600 }}
            >
              Phase 1 – 3: Governance-Infrastruktur-Aufbau
            </h2>

            <div className="mt-10 space-y-6">
              {[
                {
                  phase: 'Phase 1 (Live)',
                  items: [
                    'EU AI Act Risk Classification & Documentation',
                    'Audit Trail für alle Governance-Aktionen',
                    'Policy-as-Code für Compliance-Regeln',
                    'GDPR Consent & Daten-Lineage Tracking',
                  ],
                },
                {
                  phase: 'Phase 2 (Committed)',
                  items: [
                    'Continuous Risk Scoring über KI-System-Portfolio',
                    'Predictive Compliance Alerts',
                    'Automatisierte Evidence-Assembler für Audits',
                    'Cross-Model Governance Graph',
                  ],
                },
                {
                  phase: 'Phase 3 (Vision)',
                  items: [
                    'Echtzeit Fairness & Bias Monitoring',
                    'Autonome Governance-Durchsetzung',
                    'Multi-Stakeholder Audit Trails',
                    'KI-System Provenance Certification',
                  ],
                },
              ].map((roadmap, idx) => (
                <div key={idx} className="border-l-2 border-white/10 pl-6">
                  <h3 className="text-sm font-semibold" style={{ color: LANDING_ACCENT }}>
                    {roadmap.phase}
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {roadmap.items.map((item, itemIdx) => (
                      <li key={itemIdx} className="text-[13px]" style={{ color: MODE_MUTED }}>
                        • {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-white/[0.06] py-[80px]" style={{ backgroundColor: modeVeil(72) }}>
          <div className="mx-auto max-w-3xl px-[4vw] text-center">
            <h2
              className="text-[clamp(2rem,1.2rem+2.5vw,3rem)] tracking-tight"
              style={{ fontWeight: 600 }}
            >
              Governance-Infrastruktur starten
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed" style={{ color: MODE_MUTED }}>
              Enterprise-KI verlangt kontinuierliche Governance, nicht Deployment-Geschwindigkeit. RealSync ist das Runtime Layer dafür.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/audit"
                className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[13px] font-semibold transition hover:brightness-110"
                style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
              >
                Jetzt starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center gap-2 rounded-full border px-7 py-3.5 text-[13px] font-medium"
                style={{ borderColor: `${LANDING_ACCENT}66`, color: LANDING_ACCENT }}
              >
                Preise & Details
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer
        className="relative z-10 flex flex-col items-center justify-between gap-4 border-t border-white/[0.07] px-[4vw] py-[28px] text-[9px] sm:flex-row"
        style={{ fontFamily: LANDING_MONO, color: MODE_MUTED }}
      >
        <span>© 2026 RealSync Dynamics.AI</span>
        <div className="flex gap-5">
          <Link to="/impressum" className="hover:text-[#f2eee6]">
            Impressum
          </Link>
          <Link to="/datenschutz" className="hover:text-[#f2eee6]">
            Datenschutz
          </Link>
          <Link to="/agb" className="hover:text-[#f2eee6]">
            AGB
          </Link>
        </div>
      </footer>
    </div>
  );
}
