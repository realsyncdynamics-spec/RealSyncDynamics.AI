/**
 * Landing OS spine — continuous compliance product architecture.
 *
 * SCAN → DISCOVER → RISK → GOVERN → AUTOMATE → EVIDENCE → MONITOR → AUDIT → SCALE
 * Scan is acquisition only. Not a tool catalog.
 *
 * Spec: docs/product/scan-funnel.md
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  PLATFORM_LIVE_ITEMS,
  STATUS_LABEL,
  type ImplementationItem,
} from '../../product/implementation-status';
import { CONTINUOUS_COMPLIANCE_NARRATIVE } from '../governance-frontend/hero-content';
import { OsEntryLink } from './OsEntryLink';
import {
  LANDING_ACCENT,
  LANDING_BG,
  LANDING_BUTTON,
  LANDING_BUTTON_TEXT,
  LANDING_H2,
  LANDING_LINE,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_SERIF,
  LANDING_TEXT,
} from './landing-theme';

const SPINE_STEPS: readonly {
  id: string;
  step: string;
  title: string;
  body: string;
}[] = [
  {
    id: 'scan',
    step: '01',
    title: 'SCAN',
    body: 'Acquisition only — URL first, Top-3-Risiken und Evidence-Preview. Der Scan ist der Einstieg, nicht das Produkt.',
  },
  {
    id: 'discover',
    step: '02',
    title: 'DISCOVER',
    body: 'KI-Systeme, Agenten, Datenflüsse und Schattennutzung erfassen — Inventar ohne Excel.',
  },
  {
    id: 'risk',
    step: '03',
    title: 'RISK',
    body: 'Risiken gegen DSGVO- und EU-AI-Act-Kriterien bewerten und priorisieren.',
  },
  {
    id: 'govern',
    step: '04',
    title: 'GOVERN',
    body: 'Policies und Kontrollen durchsetzen — nicht nur dokumentieren.',
  },
  {
    id: 'automate',
    step: '05',
    title: 'AUTOMATE',
    body: 'Prüfungen, Aufgaben, Workflows und Remediation laufen lassen.',
  },
  {
    id: 'evidence',
    step: '06',
    title: 'EVIDENCE',
    body: 'Beweisketten laufend erzeugen — scan → risk → policy → control → sealed → hash.',
  },
  {
    id: 'monitor',
    step: '07',
    title: 'MONITOR',
    body: 'Drift und neue Risiken dauerhaft kontrollieren — Grund zu bleiben.',
  },
  {
    id: 'audit',
    step: '08',
    title: 'AUDIT',
    body: 'Prüfpfad für DSB, Auditor und Board — exportierbar, nachvollziehbar.',
  },
  {
    id: 'scale',
    step: '09',
    title: 'SCALE',
    body: 'Agency Multi-Tenant und Enterprise Activation — Partner/Scale auf Anfrage.',
  },
];

const EVIDENCE_TIMELINE: readonly { phase: string; detail: string }[] = [
  { phase: 'Scan', detail: 'Beobachtung und Befunde' },
  { phase: 'Risk', detail: 'Bewertung & Priorität' },
  { phase: 'Policy', detail: 'Regelbindung' },
  { phase: 'Control', detail: 'Durchsetzung / Gate' },
  { phase: 'Evidence sealed', detail: 'Nachweis gebunden' },
  { phase: 'Hash', detail: 'Integrität (SHA)' },
];

const AGENT_LOOP: readonly { step: string; label: string }[] = [
  { step: '01', label: 'Action Request' },
  { step: '02', label: 'Policy' },
  { step: '03', label: 'Risk' },
  { step: '04', label: 'Permission' },
  { step: '05', label: 'Execute / Block / Escalate' },
  { step: '06', label: 'Evidence' },
];

const AUDIENCES: readonly { title: string; text: string }[] = [
  { title: 'Compliance', text: 'Nachweise und Prüfpfade, wenn Aufsicht oder Board fragt.' },
  { title: 'AI Governance', text: 'Inventar, Risikoklassen und Policies über alle KI-Systeme.' },
  { title: 'Legal Ops', text: 'EU AI Act- und DSGVO-Pflichten ohne Schatten-IT-Excel.' },
  { title: 'IT Security', text: 'Kontrollen und Alerts, wenn sich Nutzung oder Integrationen ändern.' },
  { title: 'Agentur- & SaaS-Betreiber', text: 'Multi-Tenant Reports und Governance für Kunden-Domains.' },
];

const PROOF_FOCUS_IDS = [
  'command-center',
  'evidence-surfaces',
  'free-audit',
  'governance-activation',
  'ai-act-classify',
] as const;

function proofItems(): ImplementationItem[] {
  const byId = new Map(PLATFORM_LIVE_ITEMS.map((i) => [i.id, i]));
  return PROOF_FOCUS_IDS.map((id) => byId.get(id)).filter(
    (i): i is ImplementationItem => Boolean(i),
  );
}

function SectionEyebrow({ children }: { children: string }) {
  return (
    <p
      className="inline-block rounded-full border px-[11px] py-[7px] text-[9px] font-medium tracking-[.23em]"
      style={{
        fontFamily: LANDING_MONO,
        color: LANDING_ACCENT,
        borderColor: `${LANDING_ACCENT}47`,
      }}
    >
      {children}
    </p>
  );
}

export function LandingOsSpine() {
  const proofs = proofItems();

  return (
    <>
      <section
        id="spine"
        className="border-b border-[#e4cfa2]/10 py-[64px] lg:py-[72px]"
        aria-label="Product architecture"
      >
        <div id="tools" className="sr-only" aria-hidden="true" />
        <div className="mx-auto max-w-[1500px] px-[4vw]">
          <div className="mb-10 max-w-3xl">
            <SectionEyebrow>CONTINUOUS COMPLIANCE</SectionEyebrow>
            <h2
              className="mt-[18px] leading-[1.05] tracking-[-.03em]"
              style={{ fontFamily: LANDING_SERIF, fontWeight: 500, fontSize: LANDING_H2 }}
            >
              {CONTINUOUS_COMPLIANCE_NARRATIVE}
            </h2>
            <p className="mt-[14px] max-w-[640px] text-[13px] leading-[1.65]" style={{ color: LANDING_MUTED }}>
              Nicht „wähle einen Check / hier sind viele Tools.“ Eine Governance-Schicht:
              Scan ist Acquisition — danach Activation, Workspace, Policies, Remediation,
              Evidence und Monitoring.
            </p>
          </div>

          <ol className="grid gap-px overflow-hidden border border-[#e4cfa2]/15 bg-[#e4cfa2]/08 sm:grid-cols-2 lg:grid-cols-3">
            {SPINE_STEPS.map((step) => (
              <li
                key={step.id}
                id={step.id}
                data-reveal
                data-reveal-group="spine"
                className="p-5"
                style={{ backgroundColor: LANDING_BG }}
              >
                <span
                  className="text-[10px] tracking-[.18em]"
                  style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
                >
                  {step.step} · {step.title}
                </span>
                <p className="mt-2 text-[13px] leading-relaxed" style={{ color: LANDING_MUTED }}>
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="proof"
        className="border-b border-[#e4cfa2]/10 py-[64px] lg:py-[72px]"
        style={{ backgroundColor: 'rgba(228,207,162,0.03)' }}
        aria-label="Evidence timeline and proof"
      >
        <div className="mx-auto max-w-[1500px] px-[4vw]">
          <div className="mb-10 max-w-3xl">
            <SectionEyebrow>PROOF · EVIDENCE TIMELINE</SectionEyebrow>
            <h2
              className="mt-[18px] leading-[1.05] tracking-[-.03em]"
              style={{ fontFamily: LANDING_SERIF, fontWeight: 500, fontSize: LANDING_H2 }}
            >
              Der Differenzierer ist die{' '}
              <em className="not-italic" style={{ color: LANDING_ACCENT }}>
                Beweiskette.
              </em>
            </h2>
            <p className="mt-[14px] max-w-[640px] text-[13px] leading-[1.65]" style={{ color: LANDING_MUTED }}>
              Nicht nur „Score 87 %“. Timeline: Scan → Risk → Policy → Control → Evidence sealed →
              Hash. Keine Fake-Zeitstempel, keine erfundenen KPIs.
            </p>
          </div>

          <div
            className="mb-8 overflow-hidden border p-5 sm:p-6"
            style={{ borderColor: LANDING_LINE, backgroundColor: 'rgba(7,9,13,0.72)' }}
            data-reveal
            data-reveal-group="proof"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p
                className="text-[9px] tracking-[.2em]"
                style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
              >
                EVIDENCE TIMELINE · BEISPIELANSICHT
              </p>
              <span
                className="border px-2 py-0.5 text-[8px] tracking-[.12em]"
                style={{
                  fontFamily: LANDING_MONO,
                  borderColor: `${LANDING_ACCENT}40`,
                  color: LANDING_ACCENT,
                }}
              >
                PREVIEW · KEINE LIVE-KPIs
              </span>
            </div>
            <ol className="flex flex-col gap-0 sm:flex-row sm:flex-wrap sm:items-stretch">
              {EVIDENCE_TIMELINE.map((node, i) => (
                <li
                  key={node.phase}
                  className="flex flex-1 items-stretch border-b sm:border-b-0 sm:border-r last:border-0"
                  style={{ borderColor: 'rgba(228,207,162,0.15)' }}
                >
                  <div className="px-3 py-3">
                    <p
                      className="text-[9px] tracking-[.14em]"
                      style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </p>
                    <p className="mt-1 text-[12px] font-semibold" style={{ color: LANDING_TEXT }}>
                      {node.phase}
                    </p>
                    <p className="mt-1 text-[11px]" style={{ color: LANDING_MUTED }}>
                      {node.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[11px]" style={{ color: LANDING_MUTED }}>
              Struktur der Kette — echte Events kommen aus Audit/Evidence im Workspace; hier
              bewusst ohne Timestamps.
            </p>
          </div>

          <div
            id="agent-governance"
            className="mb-10 border p-5 sm:p-6"
            style={{ borderColor: LANDING_LINE }}
            data-reveal
            data-reveal-group="proof"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p
                  className="text-[9px] tracking-[.2em]"
                  style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
                >
                  AGENT GOVERNANCE · WEDGE
                </p>
                <h3 className="mt-2 text-lg font-semibold" style={{ color: LANDING_TEXT }}>
                  Gegen Website-DSGVO-Scanner: Agenten steuern, nicht nur Sites scannen.
                </h3>
                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed" style={{ color: LANDING_MUTED }}>
                  Action Request → Policy → Risk → Permission → Execute/Block/Escalate → Evidence.
                  Kernel-Slice in Arbeit (#1331) — ehrlich Preview, bis Production-vollständig.
                </p>
              </div>
              <span
                className="border px-2 py-0.5 text-[8px] tracking-[.12em]"
                style={{
                  fontFamily: LANDING_MONO,
                  borderColor: `${LANDING_ACCENT}40`,
                  color: LANDING_ACCENT,
                }}
              >
                PREVIEW
              </span>
            </div>
            <ol className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {AGENT_LOOP.map((s) => (
                <li
                  key={s.step}
                  className="border px-3 py-3"
                  style={{ borderColor: 'rgba(228,207,162,0.18)' }}
                >
                  <span
                    className="text-[9px] tracking-[.14em]"
                    style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
                  >
                    {s.step}
                  </span>
                  <p className="mt-1 text-[11px] leading-snug" style={{ color: LANDING_TEXT }}>
                    {s.label}
                  </p>
                </li>
              ))}
            </ol>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                to="/agent-governance"
                className="inline-flex items-center gap-2 text-[12px] font-medium"
                style={{ color: LANDING_ACCENT }}
              >
                Agent-Governance-Hub <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <OsEntryLink
                to="/app/dashboard"
                className="inline-flex items-center gap-2 text-[12px] font-medium"
                style={{ color: '#e8dfd2' }}
              >
                Agent OS Slice im Dashboard
              </OsEntryLink>
            </div>
          </div>

          <div
            id="platform"
            className="grid gap-px overflow-hidden border border-[#e4cfa2]/15 bg-[#e4cfa2]/08 md:grid-cols-2 lg:grid-cols-3"
          >
            {proofs.map((cap) => {
              const body = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold" style={{ color: LANDING_TEXT }}>
                      {cap.name}
                    </h3>
                    <span
                      className="shrink-0 border px-2 py-0.5 text-[8px] tracking-[.12em]"
                      style={{
                        fontFamily: LANDING_MONO,
                        borderColor: `${LANDING_ACCENT}40`,
                        color: LANDING_ACCENT,
                      }}
                    >
                      {STATUS_LABEL.live}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: LANDING_MUTED }}>
                    {cap.description}
                  </p>
                  {cap.route && (
                    <span
                      className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium"
                      style={{ color: LANDING_ACCENT }}
                    >
                      Öffnen <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  )}
                </>
              );
              return cap.route ? (
                <Link
                  key={cap.id}
                  to={
                    cap.route.startsWith('/app')
                      ? `/welcome?next=${encodeURIComponent(cap.route)}`
                      : cap.route
                  }
                  data-reveal
                  data-reveal-group="platform"
                  className="block p-6 transition hover:bg-[#e4cfa2]/5"
                  style={{ backgroundColor: LANDING_BG }}
                >
                  {body}
                </Link>
              ) : (
                <div
                  key={cap.id}
                  data-reveal
                  data-reveal-group="platform"
                  className="p-6"
                  style={{ backgroundColor: LANDING_BG }}
                >
                  {body}
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <OsEntryLink
              to="/app/evidence"
              className="inline-flex items-center gap-2 rounded-full px-[18px] py-[12px] text-[11px] font-semibold transition hover:brightness-110"
              style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
            >
              Evidence-Preview öffnen <ArrowRight className="h-3.5 w-3.5" />
            </OsEntryLink>
            <OsEntryLink
              to="/app/activation"
              className="inline-flex items-center gap-2 rounded-full border px-[18px] py-[12px] text-[11px] font-semibold transition hover:bg-[#e4cfa2]/10"
              style={{ borderColor: `${LANDING_ACCENT}80`, color: '#e8dfd2' }}
            >
              Governance Activation
            </OsEntryLink>
          </div>
        </div>
      </section>

      <section id="fuer-wen" className="border-b border-[#e4cfa2]/10 py-[64px] lg:py-[72px]">
        <div className="mx-auto max-w-[1500px] px-[4vw]">
          <div className="mb-10 max-w-3xl">
            <SectionEyebrow>FÜR WEN</SectionEyebrow>
            <h2
              className="mt-[18px] leading-[1.05] tracking-[-.03em]"
              style={{ fontFamily: LANDING_SERIF, fontWeight: 500, fontSize: LANDING_H2 }}
            >
              Teams, die KI{' '}
              <em className="not-italic" style={{ color: LANDING_ACCENT }}>
                steuern müssen.
              </em>
            </h2>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AUDIENCES.map((a) => (
              <li
                key={a.title}
                data-reveal
                data-reveal-group="audience"
                className="border p-5"
                style={{ borderColor: LANDING_LINE }}
              >
                <h3 className="text-sm font-semibold" style={{ color: LANDING_TEXT }}>
                  {a.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed" style={{ color: LANDING_MUTED }}>
                  {a.text}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
