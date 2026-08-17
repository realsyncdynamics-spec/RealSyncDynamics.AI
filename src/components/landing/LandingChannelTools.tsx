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
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mb-12 max-w-3xl">
          <p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">LIVE GOVERNANCE TOOLS</p>
          <h2 className="mt-3 text-4xl tracking-tight sm:text-5xl" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500 }}>
            Ihre KI-Kanäle. <span className="text-cyan-400">Eine Governance-Ebene.</span>
          </h2>
          <p className="mt-5 max-w-2xl leading-relaxed text-white/55">
            Website, Code, WhatsApp und Telefon laufen nicht als isolierte Tools. Sie werden über dieselbe Governance-Runtime, Risikobewertung und Nachweis-Schicht kontrollierbar.
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
