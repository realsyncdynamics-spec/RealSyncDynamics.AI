import { Bot, MessageCircle, Phone, ArrowRight, Globe2, Code2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const TOOLS = [
  {
    eyebrow: 'AUTOMATION · WHATSAPP',
    title: 'WhatsApp Bot',
    icon: MessageCircle,
    text: 'WhatsApp-Kundenkommunikation über den echten Bot-Builder — mit Persona, Wissensbasis, Termin- und Anfrageprozessen sowie Governance und Evidence.',
    bullets: ['WhatsApp-Kanal', 'Termin- & Anfrageflows', 'Governance & Evidence'],
    href: '/app/bots?channel=whatsapp',
    cta: 'WhatsApp Bot konfigurieren',
  },
  {
    eyebrow: 'VOICE · GOVERNANCE',
    title: 'Telefonbot',
    icon: Phone,
    text: 'KI-Telefonassistenz über den bestehenden Bot-Builder — mit Voice-Kanal, Human Handoff, Terminannahme, Policy Enforcement und auditierbaren Gesprächen.',
    bullets: ['Voice-Kanal', 'Human Handoff', 'Auditierbare Gespräche'],
    href: '/app/bots?channel=voice',
    cta: 'Telefonbot konfigurieren',
  },
  {
    eyebrow: 'AI · WEBSITE',
    title: 'DSGVO Web App Builder',
    icon: Globe2,
    text: 'Website zuerst prüfen, DSGVO- und Governance-Befund erfassen und anschließend in den bestehenden Web-App-Transformation-Flow übergeben.',
    bullets: ['DSGVO-Audit', 'SEO & Accessibility', 'Web-App-Transformation'],
    href: '/unified-entry/scan',
    cta: 'DSGVO Builder starten',
  },
  {
    eyebrow: 'ENGINEERING · GOVERNANCE',
    title: 'Claude Code Optimizer',
    icon: Code2,
    text: 'Repository auf DSGVO- und EU-AI-Act-Risiken prüfen, konkrete Fixes erzeugen und Prüfungen als Evidence in den Entwicklungsworkflow integrieren.',
    bullets: ['Repository Audit', 'Fix-Code', 'Evidence & PR'],
    href: '/claude-code-optimizer',
    cta: 'Optimizer öffnen',
  },
] as const;

export function LandingChannelTools() {
  return (
    <section id="tools" className="relative border-y border-white/10 bg-white/[.02] py-20 md:py-28">
      <style>{`
        /* Hero globe: keep the existing 3D transforms intact and animate only visual properties.
           The previous orbit keyframes animated transform itself, which replaced rotateX/rotateY
           and made the rings appear effectively static/flat. */
        @keyframes rs-globe-intensity {
          0%, 100% { filter: brightness(1) saturate(1.15) drop-shadow(0 0 28px rgba(34,211,238,.18)); }
          50% { filter: brightness(1.32) saturate(1.55) drop-shadow(0 0 58px rgba(34,211,238,.52)); }
        }
        @keyframes rs-orbit-intensity {
          0%, 100% { opacity: .28; filter: drop-shadow(0 0 3px rgba(34,211,238,.12)); }
          50% { opacity: 1; filter: drop-shadow(0 0 12px rgba(34,211,238,.75)); }
        }
        @keyframes rs-orbit-sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes rs-globe-highlight {
          0%, 100% { opacity: .25; transform: translateX(-38%) rotate(-18deg); }
          50% { opacity: .9; transform: translateX(18%) rotate(-18deg); }
        }
        .landing-context .rs-globe-wrap {
          animation: rs-globe-intensity 5.5s ease-in-out infinite !important;
        }
        .landing-context .rs-globe-wrap::after {
          content: '';
          position: absolute;
          inset: 5%;
          border-radius: 9999px;
          padding: 2px;
          background: conic-gradient(from 0deg, transparent 0deg, rgba(34,211,238,.08) 40deg, rgba(103,232,249,.95) 95deg, transparent 145deg, transparent 250deg, rgba(56,189,248,.7) 300deg, transparent 345deg);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          animation: rs-orbit-sweep 9s linear infinite;
          filter: drop-shadow(0 0 12px rgba(34,211,238,.35));
          z-index: 12;
        }
        .landing-context .rs-orbit-a,
        .landing-context .rs-orbit-b,
        .landing-context .rs-orbit-c {
          animation: rs-orbit-intensity 2.8s ease-in-out infinite !important;
          transform-style: preserve-3d;
          will-change: opacity, filter;
        }
        .landing-context .rs-orbit-b { animation-delay: -.9s !important; }
        .landing-context .rs-orbit-c { animation-delay: -1.7s !important; }
        .landing-context .rs-globe-wrap > div:nth-child(2)::after {
          content: '';
          position: absolute;
          inset: -10%;
          border-radius: 9999px;
          background: linear-gradient(100deg, transparent 20%, rgba(103,232,249,.5) 46%, rgba(255,255,255,.9) 50%, rgba(103,232,249,.28) 54%, transparent 80%);
          mix-blend-mode: screen;
          filter: blur(10px);
          animation: rs-globe-highlight 6s ease-in-out infinite;
          pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-context .rs-globe-wrap,
          .landing-context .rs-globe-wrap::after,
          .landing-context .rs-orbit-a,
          .landing-context .rs-orbit-b,
          .landing-context .rs-orbit-c,
          .landing-context .rs-globe-wrap > div:nth-child(2)::after {
            animation: none !important;
          }
        }
      `}</style>
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mb-12 max-w-3xl">
          <p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">LIVE GOVERNANCE TOOLS</p>
          <h2 className="mt-3 text-4xl tracking-tight sm:text-5xl" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500 }}>
            Ihre KI-Kanäle. <span className="text-cyan-400">Eine Governance-Ebene.</span>
          </h2>
          <p className="mt-5 max-w-2xl leading-relaxed text-white/55">
            Website, Code, WhatsApp und Telefon laufen nicht als isolierte Tools. Sie werden über dieselbe Governance-Runtime, Policy Engine und Evidence-Schicht kontrollierbar.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {TOOLS.map(({ eyebrow, title, icon: Icon, text, bullets, href, cta }) => (
            <article key={title} className="overflow-hidden rounded-[1.75rem] border border-cyan-400/20 bg-black/30 shadow-2xl">
              <div className="border-b border-white/10 bg-gradient-to-r from-cyan-400/[.08] to-transparent p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-cyan-400/20 bg-cyan-400/10">
                      <Icon className="h-5 w-5 text-cyan-300" />
                    </span>
                    <div>
                      <p className="font-mono text-[9px] tracking-[.2em] text-cyan-400">{eyebrow}</p>
                      <h3 className="text-xl font-semibold">{title}</h3>
                    </div>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-[9px] text-white/40">PRODUCT</span>
                </div>
                <p className="mt-5 text-sm leading-relaxed text-white/55">{text}</p>
              </div>
              <div className="p-6 sm:p-8">
                <div className="mb-5 flex flex-wrap gap-2">
                  {bullets.map((bullet) => <span key={bullet} className="rounded-full border border-white/10 bg-white/[.025] px-3 py-1.5 text-[10px] text-white/45">✓ {bullet}</span>)}
                </div>
                <Link to={href} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/[.06] px-5 py-3.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/[.12]">
                  {cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-6 text-center font-mono text-[9px] tracking-[.18em] text-white/25">ONE GOVERNANCE PLANE · WHATSAPP · VOICE · WEB · CODE · EVIDENCE</p>
      </div>
    </section>
  );
}
