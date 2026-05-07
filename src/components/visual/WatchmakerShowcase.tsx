import { ScrollReveal } from '../motion/ScrollReveal';
import { AiCoreInteractive } from './AiCoreInteractive';

/**
 * Watchmaker-AI Showcase — introduces the new design language on Landing.
 *
 * Composition:
 *   - Left: 3-pillar narrative (Mechanical Input / AI Orchestration / Digital Output)
 *     mirroring the reference design's tri-zone metaphor
 *   - Right: AiCoreVisual SVG with rotating brass + gunmetal rings + AI chip
 *   - Background: puzzle-grid utility for dimensional depth
 *   - Brass-shimmer divider above + below
 *   - All copy enters via ScrollReveal with stagger
 */
export function WatchmakerShowcase() {
  const pillars = [
    {
      eyebrow: 'Mechanical Input',
      title: 'Deterministische Audit-Engine',
      body: 'Reproduzierbare Scans nach festem Regelwerk — DSGVO Art. 6/13, § 25 TTDSG, EU AI Act, BSI-Header. Jeder Befund mit Paragraph-Bezug, kein LLM-Halluzinieren.',
    },
    {
      eyebrow: 'AI Orchestration',
      title: 'Decision-Layer',
      body: 'Provider-routing (EU-local + Cloud), Residency-Switch, Audit-Trail. Modell-Entscheidungen nachvollziehbar, Daten bleiben in der gewählten Region.',
    },
    {
      eyebrow: 'Digital Output',
      title: 'Signed Reports + APIs',
      body: 'PDF-Reports mit C2PA-Provenance, REST-API mit per-Tenant-Keys, Stripe-metered-Usage. Bereit für Procurement-Audit und ISO-Anbindung.',
    },
  ];

  return (
    <section className="relative bg-puzzle-grid border-t border-b border-titanium-900 overflow-hidden">
      {/* Brass-shimmer divider top */}
      <div
        aria-hidden="true"
        className="surface-brass h-px w-full opacity-50"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* LEFT — narrative */}
          <div>
            <ScrollReveal>
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-brass-500 mb-3">
                Watchmaker · AI · Output
              </div>
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
                Drei Zahnräder. Ein Decision-Layer.
              </h2>
              <p className="text-base text-titanium-400 leading-relaxed mb-10 max-w-xl">
                Mechanik liefert Eingaben. AI orchestriert. Digital signiert das Ergebnis. Die Plattform trennt diese drei Schichten sauber — jede prüfbar, jede austauschbar.
              </p>
            </ScrollReveal>

            <div className="space-y-5">
              {pillars.map((p, i) => (
                <ScrollReveal key={p.eyebrow} delay={0.1 + i * 0.08}>
                  <div className="border-l-2 border-brass-700 pl-4 py-1">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-brass-400 mb-1">
                      {p.eyebrow}
                    </div>
                    <h3 className="font-display font-bold text-titanium-50 text-base mb-1 tracking-tight">
                      {p.title}
                    </h3>
                    <p className="text-sm text-titanium-400 leading-relaxed">
                      {p.body}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>

          {/* RIGHT — AI core visual */}
          <ScrollReveal delay={0.2} className="flex justify-center lg:justify-end">
            <div className="relative">
              {/* Soft cyan halo behind the chip — purely decorative */}
              <div
                aria-hidden="true"
                className="absolute inset-0 blur-3xl opacity-60 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle at center, rgba(20,196,179,0.20) 0%, transparent 60%)',
                }}
              />
              <AiCoreInteractive size={360} className="relative z-10" />

              {/* Bottom plate — gravur wordmark */}
              <div className="relative z-10 mt-6 mx-auto max-w-[320px]">
                <div className="surface-brass px-5 py-3 text-center">
                  <span
                    className="font-display font-bold tracking-tight text-obsidian-950 text-lg sm:text-xl"
                    style={{ textShadow: '0 1px 0 rgba(255,255,255,0.25)' }}
                  >
                    RealSyncDynamics
                  </span>
                </div>
                <div className="mt-2 text-center text-[10px] font-mono uppercase tracking-[0.2em] text-brass-500">
                  Digital Caliber · EU-Hosted
                </div>
              </div>
            </div>
          </ScrollReveal>

        </div>
      </div>

      {/* Brass-shimmer divider bottom */}
      <div
        aria-hidden="true"
        className="surface-brass h-px w-full opacity-50"
      />
    </section>
  );
}
