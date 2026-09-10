import { MessageCircle, Phone, ArrowRight, Globe2, Code2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PLATFORM_CAPABILITIES } from '../../config/platform-capabilities';

/**
 * Ein Werkzeug wird nur dann zur Konfiguration angeboten, wenn das Modul
 * dahinter in Produktion laeuft. Sonst zeigt die Karte, dass sie in
 * Vorbereitung ist, und fuehrt auf die Warteliste statt in einen Konfigurator,
 * dessen Backend 404 liefert (CLAUDE.md §14: keine Schaltflaeche vortaeuschen,
 * die nichts tut).
 *
 * Die Entscheidung faellt nicht hier, sondern in `platform-capabilities.ts`.
 * Wird das Bot-Backend deployt und der Status dort auf 'live' gesetzt, schalten
 * diese Karten von selbst zurueck auf den Konfigurator.
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
    text: 'KI-Telefonassistenz über den bestehenden Bot-Builder — mit Voice-Kanal, Human Handoff, Terminannahme, Policy Enforcement und auditierbaren Gesprächen.',
    bullets: ['Voice-Kanal', 'Human Handoff', 'Auditierbare Gespräche'],
    href: '/app/bots?channel=voice',
    cta: 'Telefonbot konfigurieren',
    capabilityId: 'bots',
  },
  {
    eyebrow: 'AI · WEBSITE',
    title: 'DSGVO Web App Builder',
    icon: Globe2,
    text: 'Domain einlesen, Inhalte übernehmen, fotorealistisch neu bauen — nicht klonen. DSGVO-Befund und Governance bleiben die Control Plane.',
    bullets: ['Fotorealistisches Design', 'Domain-Fotos 1:1', 'SiteOS-Transformation'],
    href: '/handwerk-website',
    cta: 'Website neu bauen',
    capabilityId: 'gdpr-audit',
  },
  {
    eyebrow: 'ENGINEERING · GOVERNANCE',
    title: 'Claude Code Optimizer',
    icon: Code2,
    text: 'Repository auf DSGVO- und EU-AI-Act-Risiken prüfen, konkrete Fixes erzeugen und Prüfungen als Evidence in den Entwicklungsworkflow integrieren.',
    bullets: ['Repository Audit', 'Fix-Code', 'Evidence & PR'],
    href: '/claude-code-optimizer',
    cta: 'Optimizer öffnen',
    capabilityId: 'ai-gateway',
  },
] as const;

export function LandingChannelTools() {
  return (
    <section id="tools" className="relative border-y border-white/10 bg-white/[.02] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mb-14 max-w-3xl">
          <p className="font-mono text-[10px] tracking-[.25em] text-[#e8c98a]">GOVERNANCE TOOLS</p>
          <h2 className="mt-4 text-[2rem] tracking-tight sm:text-5xl" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500 }}>
            Ihre KI-Kanäle. <span className="text-[#e8c98a]">Eine Governance-Ebene.</span>
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/55">
            Website, Code, WhatsApp und Telefon laufen nicht als isolierte Tools. Sie werden über dieselbe Governance-Runtime, Risikobewertung und Nachweis-Schicht kontrollierbar.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {TOOLS.map(({ eyebrow, title, icon: Icon, text, bullets, href, cta, capabilityId }) => {
            const live = isLive(capabilityId);
            return (
            <article key={title} className="surface-panel overflow-hidden rounded-2xl border border-[#e8c98a]/15 bg-black/35">
              <div className="border-b border-white/10 bg-gradient-to-r from-[#e8c98a]/[0.08] to-transparent p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#e8c98a]/25 bg-[#e8c98a]/10">
                      <Icon className="h-5 w-5 text-[#f3d9a0]" />
                    </span>
                    <div>
                      <p className="font-mono text-[9px] tracking-[.2em] text-[#e8c98a]">{eyebrow}</p>
                      <h3 className="text-xl font-semibold">{title}</h3>
                    </div>
                  </div>
                  <span className={live
                    ? 'rounded-full border border-white/10 px-3 py-1 font-mono text-[9px] tracking-[.12em] text-white/40'
                    : 'rounded-full border border-dashed border-white/20 px-3 py-1 font-mono text-[9px] tracking-[.12em] text-white/40'}>
                    {live ? 'PRODUCT' : 'IN VORBEREITUNG'}
                  </span>
                </div>
                <p className="mt-5 text-sm leading-relaxed text-white/55">{text}</p>
              </div>
              <div className="p-6 sm:p-8">
                <div className="mb-5 flex flex-wrap gap-2">
                  {bullets.map((bullet) => <span key={bullet} className="rounded-full border border-white/10 bg-white/[.025] px-3 py-1.5 text-[10px] text-white/45">✓ {bullet}</span>)}
                </div>
                <Link
                  to={live ? href : '/warteliste'}
                  className={live
                    ? 'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#e8c98a]/35 bg-[#e8c98a]/[0.08] px-5 py-3.5 text-sm font-semibold text-[#f3d9a0] transition hover:bg-[#e8c98a]/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8c98a]/50'
                    : 'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-5 py-3.5 text-sm font-semibold text-white/70 transition hover:border-white/40 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30'}
                >
                  {live ? cta : 'Auf die Warteliste'} <ArrowRight className="h-4 w-4" />
                </Link>
                {!live && (
                  <p className="mt-3 text-[11px] leading-relaxed text-white/35">
                    Der Bot lässt sich bereits anlegen — beantworten kann er noch nichts. Die Laufzeit-Functions sind nicht in Produktion.
                  </p>
                )}
              </div>
            </article>
            );
          })}
        </div>

        <p className="mt-8 text-center font-mono text-[9px] tracking-[.18em] text-white/25">ONE GOVERNANCE PLANE · WEB · CODE · POLICY · EVIDENCE</p>
      </div>
    </section>
  );
}
