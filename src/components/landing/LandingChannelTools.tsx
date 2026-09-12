import { MessageCircle, Phone, ArrowRight, Globe2, Code2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PLATFORM_CAPABILITIES } from '../../config/platform-capabilities';
import {
  LANDING_ACCENT,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_SERIF,
  LANDING_TEXT,
} from './landing-theme';

/**
 * Ein Werkzeug wird nur dann zur Konfiguration angeboten, wenn das Modul
 * dahinter in Produktion laeuft. Sonst zeigt die Karte, dass sie in
 * Vorbereitung ist, und fuehrt auf die Warteliste statt in einen Konfigurator,
 * dessen Backend 404 liefert (CLAUDE.md §14).
 */
function isLive(capabilityId: string): boolean {
  return PLATFORM_CAPABILITIES.find((c) => c.id === capabilityId)?.status === 'live';
}

const TOOLS = [
  {
    eyebrow: 'AUTOMATION · WHATSAPP',
    title: 'WhatsApp Bot',
    icon: MessageCircle,
    text: 'WhatsApp-Kundenkommunikation über den echten Bot-Builder — mit Persona, Wissensbasis, Termin- und Anfrageprozessen sowie Governance und Evidence.',
    bullets: ['WhatsApp-Kanal', 'Termin- & Anfrageflows', 'Governance & Evidence'],
    href: '/app/bots?channel=whatsapp',
    cta: 'WhatsApp Bot konfigurieren',
    capabilityId: 'bots',
  },
  {
    eyebrow: 'VOICE · GOVERNANCE',
    title: 'Telefonbot',
    icon: Phone,
    text: 'KI-Telefonassistent über den bestehenden Bot-Builder — Voice-Kanal, Human Handoff, Terminannahme, Policy Enforcement, auditierbare Gespräche.',
    bullets: ['Voice-Kanal', 'Human Handoff', 'Auditierbare Gespräche'],
    href: '/app/bots?channel=voice',
    cta: 'Telefonbot konfigurieren',
    capabilityId: 'bots',
  },
  {
    eyebrow: 'AI · WEBSITE',
    title: 'DSGVO Web App Builder',
    icon: Globe2,
    text: 'AI-gestützte Websites/Apps mit Governance, Policy Checks, Evidence, kontrollierter Veröffentlichung.',
    bullets: ['Policy Checks', 'Evidence', 'Kontrollierte Veröffentlichung'],
    href: '/handwerk-website',
    cta: 'Website neu bauen',
    capabilityId: 'gdpr-audit',
  },
  {
    eyebrow: 'ENGINEERING · GOVERNANCE',
    title: 'Code Optimizer',
    icon: Code2,
    text: 'Code analysieren, Risiken erkennen, Governance-Gates vor Deployment.',
    bullets: ['Code analysieren', 'Risiken erkennen', 'Governance-Gates'],
    href: '/claude-code-optimizer',
    cta: 'Optimizer öffnen',
    capabilityId: 'ai-gateway',
  },
] as const;

export function LandingChannelTools() {
  return (
    <section id="tools" className="relative border-t border-white/[0.05] py-[92px]">
      <div className="mx-auto max-w-[1500px] px-[4vw]">
        <div className="mb-12 max-w-3xl">
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
            className="mt-[22px] text-[clamp(40px,5vw,65px)] leading-none tracking-[-.035em]"
            style={{ fontFamily: LANDING_SERIF, fontWeight: 500, color: LANDING_TEXT }}
          >
            Ihre KI-Kanäle.{' '}
            <em className="not-italic" style={{ color: LANDING_ACCENT }}>
              Eine Governance-Ebene.
            </em>
          </h2>
          <p className="mt-[17px] max-w-[760px] text-[13px] leading-[1.7]" style={{ color: LANDING_MUTED }}>
            Website, Code, WhatsApp und Telefon laufen nicht als isolierte Tools. Sie werden über
            dieselbe Governance-Runtime, Risikobewertung und Nachweis-Schicht kontrollierbar.
          </p>
        </div>

        <div className="grid gap-[14px] sm:grid-cols-2">
          {TOOLS.map(({ eyebrow, title, icon: Icon, text, bullets, href, cta, capabilityId }) => {
            const live = isLive(capabilityId);
            return (
              <article
                key={title}
                className="flex min-h-[280px] flex-col p-[22px]"
                style={{
                  border: `1px solid ${LANDING_ACCENT}33`,
                  background: 'linear-gradient(135deg, rgba(20,21,25,0.7), rgba(7,9,13,0.72))',
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center border"
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
                        className="text-xl tracking-tight"
                        style={{ fontFamily: LANDING_SERIF, fontWeight: 500, color: LANDING_TEXT }}
                      >
                        {title}
                      </h3>
                    </div>
                  </div>
                  <span
                    className="border px-3 py-1 text-[9px] tracking-[.12em]"
                    style={{
                      fontFamily: LANDING_MONO,
                      borderColor: live ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.25)',
                      borderStyle: live ? 'solid' : 'dashed',
                      color: 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {live ? 'PRODUCT' : 'IN VORBEREITUNG'}
                  </span>
                </div>
                <p className="mt-5 flex-1 text-[13px] leading-relaxed" style={{ color: LANDING_MUTED }}>
                  {text}
                </p>
                <div className="mt-5 mb-5 flex flex-wrap gap-2">
                  {bullets.map((bullet) => (
                    <span
                      key={bullet}
                      className="px-3 py-1.5 text-[10px]"
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
                  to={live ? href : '/warteliste'}
                  className="inline-flex w-full items-center justify-center gap-2 border px-5 py-3.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4cfa2]/50"
                  style={
                    live
                      ? {
                          borderColor: `${LANDING_ACCENT}59`,
                          backgroundColor: `${LANDING_ACCENT}14`,
                          color: LANDING_ACCENT,
                        }
                      : {
                          borderColor: 'rgba(255,255,255,0.2)',
                          color: 'rgba(255,255,255,0.7)',
                        }
                  }
                >
                  {live ? cta : 'Auf die Warteliste'} <ArrowRight className="h-4 w-4" />
                </Link>
                {!live && (
                  <p className="mt-3 text-[11px] leading-relaxed text-white/35">
                    Der Bot lässt sich bereits anlegen — beantworten kann er noch nichts. Die
                    Laufzeit-Functions sind nicht in Produktion.
                  </p>
                )}
              </article>
            );
          })}
        </div>

        <p
          className="mt-8 text-center text-[9px] tracking-[.18em] text-white/25"
          style={{ fontFamily: LANDING_MONO }}
        >
          ONE GOVERNANCE PLANE · WEB · CODE · POLICY · EVIDENCE
        </p>
      </div>
    </section>
  );
}
