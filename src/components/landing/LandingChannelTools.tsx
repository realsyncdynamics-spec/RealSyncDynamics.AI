import { MessageCircle, ShieldCheck, ArrowRight, Globe2, Code2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getImplementation,
  isImplementationLive,
  STATUS_LABEL,
} from '../../product/implementation-status';
import {
  LANDING_ACCENT,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_SERIF,
  LANDING_TEXT,
} from './landing-theme';

/**
 * Channel tools — Dominik Dark/Gold chrome; status from product registry.
 *
 * Die Daten sind exportiert, weil die Design-Vorschau
 * (`GovernanceToolsSection`) dieselben Kanäle in anderer Optik zeigt. Zwei
 * Kopien derselben Liste liefen auseinander, sobald ein Kanal dazukommt.
 */
export const CHANNEL_TOOLS = [
  {
    eyebrow: 'AUTOMATION · CHANNELS',
    title: 'KI-Bots',
    icon: MessageCircle,
    text: 'Chat-, WhatsApp- und Telefonbot-Einstiege mit Governance-Anbindung. Provider-Laufzeiten sind teilweise Preview.',
    bullets: ['Chat & WhatsApp', 'Telefonbot', 'Governance-Anbindung'],
    href: '/chatbot/start',
    cta: 'KI-Bots öffnen',
    registryId: 'channel-bots',
  },
  {
    eyebrow: 'AI · WEBSITE',
    title: 'App Builder',
    icon: Globe2,
    text: 'Website- und App-Studio mit Governance-Hooks. Publishing und Deployment bleiben im Preview-Status.',
    bullets: ['App Studio', 'Policy Hooks', 'Preview'],
    href: '/build',
    cta: 'Builder öffnen',
    registryId: 'web-builder',
  },
  {
    eyebrow: 'PLATFORM · GOVERNANCE',
    title: 'Governance OS',
    icon: ShieldCheck,
    text: 'Zentraler, zugriffsgeschützter Workspace für Risiken, Kontrollen und Nachweise.',
    bullets: ['Risiken', 'Kontrollen', 'Evidence'],
    href: '/app/dashboard',
    cta: 'Governance OS öffnen',
    registryId: 'app-shell',
  },
  {
    eyebrow: 'ENGINEERING · GOVERNANCE',
    title: 'Claude Code Optimizer',
    icon: Code2,
    text: 'Geführter Code- und Website-Scan. Ein echtes Shell-Terminal für Claude Code ist noch nicht bereitgestellt.',
    bullets: ['Code analysieren', 'Risiken erkennen', 'Terminal geplant'],
    href: '/claude-code-optimizer',
    cta: 'Optimizer öffnen',
    registryId: 'ai-gateway',
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
            Live-Module führen in den Konfigurator. Preview-Module sind als solche gekennzeichnet.
          </p>
        </div>

        <div className="grid gap-[14px] sm:grid-cols-2">
          {CHANNEL_TOOLS.map(({ eyebrow, title, icon: Icon, text, bullets, href, cta, registryId }) => {
            const live = isImplementationLive(registryId);
            const item = getImplementation(registryId);
            const status = item?.status ?? 'coming-soon';
            return (
              <article
                key={title}
                className="flex min-h-[280px] flex-col border border-white/12 p-[22px]"
                style={{
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
                      borderColor: live ? `${LANDING_ACCENT}40` : 'rgba(255,255,255,0.25)',
                      borderStyle: live ? 'solid' : 'dashed',
                      color: live ? LANDING_ACCENT : 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                </div>
                <p className="mt-5 flex-1 text-[13px] leading-relaxed" style={{ color: LANDING_MUTED }}>
                  {text}
                </p>
                <div className="mt-5 mb-5 flex flex-wrap gap-2">
                  {bullets.map((bullet) => (
                    <span
                      key={bullet}
                      className="border border-white/10 bg-white/[0.025] px-3 py-1.5 text-[10px] text-white/45"
                    >
                      {bullet}
                    </span>
                  ))}
                </div>
                <Link
                  to={href}
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
