/**
 * Public landing SECTION for Governance Activation.
 * Does NOT replace the live `/` hero (“AI Governance, Running in Real Time”).
 * Copy: docs/product/governance-activation.md §12
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  LANDING_ACCENT,
  LANDING_BG,
  LANDING_BUTTON,
  LANDING_BUTTON_TEXT,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_SERIF,
  LANDING_TEXT,
} from './landing-theme';

const ACTIVATION_STEPS = [
  {
    index: '01',
    title: 'CONNECT',
    body: 'Import existing data, documents and systems into RealSyncDynamics.AI.',
  },
  {
    index: '02',
    title: 'ACTIVATE',
    body: 'Auto-blueprint structure, map evidence, and open only decisions that need human expertise.',
  },
  {
    index: '03',
    title: 'GOVERN',
    body: 'Operate with owners, tasks, evidence and audit readiness — continuously.',
  },
] as const;

export function GovernanceActivationSection() {
  return (
    <section
      id="governance-activation"
      className="border-b border-white/[0.06] py-[92px]"
      aria-label="Governance Activation"
    >
      <div className="mx-auto max-w-[1500px] px-[4vw]">
        <div className="mb-14 max-w-3xl">
          <p
            className="inline-block rounded-full border px-[11px] py-[7px] text-[9px] font-medium tracking-[.23em]"
            style={{
              fontFamily: LANDING_MONO,
              color: LANDING_ACCENT,
              borderColor: `${LANDING_ACCENT}47`,
            }}
          >
            REALSYNC DYNAMICS.AI · GOVERNANCE ACTIVATION
          </p>
          <h2
            className="mt-[22px] text-[clamp(36px,4.8vw,58px)] leading-none tracking-[-.035em]"
            style={{ fontFamily: LANDING_SERIF, fontWeight: 500, color: LANDING_TEXT }}
          >
            Your governance.{' '}
            <em className="not-italic" style={{ color: LANDING_ACCENT }}>
              Activated automatically.
            </em>
          </h2>
          <p className="mt-[17px] max-w-[760px] text-[13px] leading-[1.7]" style={{ color: LANDING_MUTED }}>
            Import existing data, documents and systems. RealSyncDynamics.AI builds your governance
            structure automatically and routes only decisions requiring human expertise.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/app/activation"
              className="inline-flex items-center gap-2 rounded-full px-[18px] py-[12px] text-[11px] font-semibold transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]"
              style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
            >
              Start Activation <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <a
              href="#governance-activation-how"
              className="inline-flex items-center gap-2 rounded-full border px-[18px] py-[12px] text-[11px] font-semibold transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]"
              style={{
                borderColor: 'rgba(0,229,255,0.35)',
                color: LANDING_TEXT,
              }}
            >
              See how it works
            </a>
          </div>
        </div>

        <div
          id="governance-activation-how"
          className="grid gap-px overflow-hidden border border-white/10 bg-white/10 md:grid-cols-3"
        >
          {ACTIVATION_STEPS.map((step) => (
            <div key={step.index} className="p-7" style={{ backgroundColor: LANDING_BG }}>
              <div
                className="text-[10px] tracking-[.22em]"
                style={{ fontFamily: LANDING_MONO, color: `${LANDING_ACCENT}cc` }}
              >
                {step.index} · {step.title}
              </div>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: LANDING_MUTED }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
