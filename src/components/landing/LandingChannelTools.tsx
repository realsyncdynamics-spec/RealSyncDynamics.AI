import { MessageCircle, Phone, ArrowRight, Globe2, Code2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getImplementation,
  isImplementationLive,
  STATUS_LABEL,
} from '../../product/implementation-status';
import {
  LANDING_ACCENT,
  LANDING_H2,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_SERIF,
  LANDING_TEXT,
} from './landing-theme';

/**
 * Channel tools — status from product registry (not a parallel marketing list).
 */
const TOOLS = [
  {
    eyebrow: 'AUTOMATION · WHATSAPP',
    title: 'WhatsApp Bot',
    icon: MessageCircle,
    text: 'WhatsApp-Kundenkommunikation über den Bot-Builder — Persona, Flows, Governance-Anbindung.',
    bullets: ['WhatsApp-Kanal', 'Termin- & Anfrageflows', 'Governance-Anbindung'],
    href: '/chatbot/start',
    cta: 'WhatsApp Bot starten',
    registryId: 'channel-bots',
  },
  {
    eyebrow: 'VOICE · GOVERNANCE',
    title: 'Telefonbot',
    icon: Phone,
    text: 'KI-Telefonassistent über den Bot-Builder — Voice-Kanal, Handoff, auditierbare Gespräche.',
    bullets: ['Voice-Kanal', 'Human Handoff', 'Auditierbare Gespräche'],
    href: '/phonebot/start',
    cta: 'Telefonbot starten',
    registryId: 'channel-bots',
  },
  {
    eyebrow: 'AI · WEBSITE',
    title: 'DSGVO Web App Builder',
    icon: Globe2,
    text: 'SiteOS-/Website-Flows mit Governance-Hooks — Preview, nicht als vollständige Produktions-Runtime verkauft.',
    bullets: ['SiteOS Flows', 'Policy Hooks', 'Preview'],
    href: '/build',
    cta: 'Builder öffnen',
    registryId: 'web-builder',
  },
  {
    eyebrow: 'ENGINEERING · GOVERNANCE',
    title: 'Code Optimizer',
    icon: Code2,
    text: 'Code analysieren und Risiken erkennen — über AI Gateway, Route live.',
    bullets: ['Code analysieren', 'Risiken erkennen', 'AI Gateway'],
    href: '/claude-code-optimizer',
    cta: 'Optimizer öffnen',
    registryId: 'ai-gateway',
  },
] as const;

export function LandingChannelTools() {
  return (
    <section id="tools" className="relative border-t border-[#d0c3a4]/10 py-[64px] lg:py-[72px]">
      <div className="mx-auto max-w-[1500px] px-[4vw]">
        <div className="mb-8 max-w-3xl">
          <p
            className="inline-block rounded-full border px-[11px] py-[7px] text-[9px] font-medium tracking-[.23em]"
            style={{
              fontFamily: LANDING_MONO,
              color: LANDING_ACCENT,
              borderColor: `${LANDING_ACCENT}47`,
            }}
          >
            GOVERNANCE TOOLS
          </p>
          <h2
            className="mt-[18px] leading-[1.05] tracking-[-.03em]"
            style={{
              fontFamily: LANDING_SERIF,
              fontWeight: 500,
              fontSize: LANDING_H2,
              color: LANDING_TEXT,
            }}
          >
            Ihre KI-Kanäle.{' '}
            <em className="not-italic" style={{ color: LANDING_ACCENT }}>
              Eine Governance-Ebene.
            </em>
          </h2>
          <p className="mt-[14px] max-w-[640px] text-[13px] leading-[1.65]" style={{ color: LANDING_MUTED }}>
            Live-Module führen in den Konfigurator. Preview-Module sind als solche gekennzeichnet.
          </p>
        </div>

        <div className="grid gap-[12px] sm:grid-cols-2">
          {TOOLS.map(({ eyebrow, title, icon: Icon, text, bullets, href, cta, registryId }) => {
            const live = isImplementationLive(registryId);
            const item = getImplementation(registryId);
            const status = item?.status ?? 'coming-soon';
            return (
              <article
                key={title}
                className="flex min-h-[240px] flex-col p-[20px]"
                style={{
                  border: `1px solid ${LANDING_ACCENT}33`,
                  background: 'linear-gradient(135deg, rgba(20,21,25,0.7), rgba(7,9,13,0.72))',
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center border"
                      style={{
                        borderColor: `${LANDING_ACCENT}40`,
                        backgroundColor: `${LANDING_ACCENT}1a`,
                      }}
                    >
                      <Icon className="h-5 w-5" style={{ color: LANDING_ACCENT }} />
                    </span>
                    <div>
                      <p
                        className="text-[9px] tracking-[.2em]"
                        style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
                      >
                        {eyebrow}
                      </p>
                      <h3
                        className="text-lg tracking-tight"
                        style={{ fontFamily: LANDING_SERIF, fontWeight: 500, color: LANDING_TEXT }}
                      >
                        {title}
                      </h3>
                    </div>
                  </div>
                  <span
                    className="border px-2.5 py-1 text-[8px] tracking-[.12em]"
                    style={{
                      fontFamily: LANDING_MONO,
                      borderColor: live ? 'rgba(208,195,164,0.35)' : 'rgba(208,195,164,0.45)',
                      borderStyle: live ? 'solid' : 'dashed',
                      color: 'rgba(208,195,164,0.85)',
                    }}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                </div>
                <p className="mt-4 flex-1 text-[13px] leading-relaxed" style={{ color: LANDING_MUTED }}>
                  {text}
                </p>
                <div className="mt-4 mb-4 flex flex-wrap gap-2">
                  {bullets.map((bullet) => (
                    <span
                      key={bullet}
                      className="px-2.5 py-1 text-[10px]"
                      style={{
                        border: `1px solid ${LANDING_ACCENT}40`,
                        backgroundColor: 'rgba(0,0,0,0.35)',
                        color: 'rgba(242,238,230,0.7)',
                      }}
                    >
                      {bullet}
                    </span>
                  ))}
                </div>
                <Link
                  to={live ? href : status === 'preview' ? href : '/warteliste'}
                  className="inline-flex w-full items-center justify-center gap-2 border px-5 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0c3a4]/50"
                  style={
                    live
                      ? {
                          borderColor: `${LANDING_ACCENT}59`,
                          backgroundColor: `${LANDING_ACCENT}14`,
                          color: LANDING_ACCENT,
                        }
                      : {
                          borderColor: 'rgba(208,195,164,0.28)',
                          borderStyle: 'dashed',
                          color: 'rgba(232,221,200,0.75)',
                        }
                  }
                >
                  {live ? cta : status === 'preview' ? `${cta} (Preview)` : 'Auf die Warteliste'}{' '}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
