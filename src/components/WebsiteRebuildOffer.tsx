import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, MessageSquare, Database, ShieldCheck } from 'lucide-react';

/**
 * WebsiteRebuildOffer — prominent „Komplett-Service" Sektion auf der Landing.
 *
 * Direkter Anschluss an <HowItWorks3Steps>: nachdem der Besucher den 3-Step-
 * Prozess gesehen hat (selbst scannen → Befunde lesen → selbst beheben),
 * ist hier die Alternative: „lasst es uns einfach komplett neu bauen".
 *
 * Inhaltlich:
 *   - Headline addressiert das Pain-Point: „selbst patchen" vs. „neu aufsetzen"
 *   - Drei Pillars (Migration / Modern + AI / Betrieb)
 *   - Optionaler AI-Chatbot prominent platziert (Sparkles-Badge)
 *   - Single Primary-CTA → /dsgvo-website (dort sind die 3 Pakete)
 *
 * Visuell: brass-shimmer-Border + obsidian-900-Backdrop, klar abgesetzt vom
 * Rest der Landing.
 */
export function WebsiteRebuildOffer() {
  return (
    <section
      aria-label="Komplett-Service: neue DSGVO-Website auf Basis Ihrer aktuellen"
      className="relative px-4 sm:px-6 lg:px-8 py-20 sm:py-24 border-t border-b border-titanium-900 bg-puzzle-grid overflow-hidden"
    >
      {/* Brass-shimmer Top + Bottom Divider */}
      <div aria-hidden="true" className="surface-brass h-px absolute top-0 left-0 right-0 opacity-50" />
      <div aria-hidden="true" className="surface-brass h-px absolute bottom-0 left-0 right-0 opacity-50" />

      <div className="max-w-5xl mx-auto relative">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-brass-700/60 bg-brass-950/30 text-brass-300 text-xs font-bold uppercase tracking-wider rounded-none mb-4">
            <Sparkles className="h-3 w-3" /> Komplett-Service · EU-Hosted · Optional mit AI-Chatbot
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-titanium-50 tracking-tight leading-tight max-w-3xl mx-auto">
            Lieber komplett neue Website, als selbst patchen?
          </h2>
          <p className="mt-4 text-base sm:text-lg text-titanium-400 leading-relaxed max-w-2xl mx-auto">
            Wir bauen Ihre vorhandene Homepage als DSGVO-konforme EU-Website neu auf — modern,
            schnell, mit allen Compliance-Layern out-of-the-box. Auf Wunsch mit integriertem
            AI-Chatbot, der Ihre Inhalte kennt.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-titanium-900 mb-10">
          <Pillar
            icon={<Database className="h-5 w-5 text-ai-cyan-400" />}
            title="Inhalte übernehmen"
            body="Wir migrieren Ihre Texte, Bilder und Strukturseiten 1:1. Sie verlieren nichts an Substanz, gewinnen technische Sauberkeit."
          />
          <Pillar
            icon={<Sparkles className="h-5 w-5 text-brass-400" />}
            title="Modern + AI-ready"
            body="Schnelles Layout, lokale Fonts, integriertes Consent-Management, Security-Header out-of-the-box. Optional ein AI-Chatbot, der Ihre Inhalte beantwortet."
            badge="AI-Chatbot optional"
          />
          <Pillar
            icon={<ShieldCheck className="h-5 w-5 text-security-400" />}
            title="Wir betreiben es"
            body="EU-Hosting, TLS, Updates, halbjährliche Re-Audits. AVV inklusive. Sie zahlen monatlich, wir halten alles aktuell."
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            to="/dsgvo-website"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-brass-500 hover:bg-brass-400 text-obsidian-950 text-base font-bold rounded-none transition-colors"
          >
            3-Paket-Angebot ansehen <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/audit?source=rebuild-offer"
            className="inline-flex items-center gap-2 px-6 py-3.5 border border-titanium-700 hover:border-brass-500 text-titanium-200 text-base font-semibold rounded-none transition-colors"
          >
            Erst Quick-Scan starten
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-titanium-500 max-w-xl mx-auto">
          Managed-Betrieb nach Angebot, einmaliger Rebuild ab 1.500 €. Kündbar zum Monatsende, voller
          Source-Code-Export bei Ende. Keine Knebelverträge.
        </p>
      </div>
    </section>
  );
}

function Pillar({
  icon, title, body, badge,
}: { icon: React.ReactNode; title: string; body: string; badge?: string }) {
  return (
    <div className="flex flex-col bg-obsidian-950 p-6 sm:p-7 relative">
      {badge && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border border-brass-700/60 bg-brass-950/40 text-brass-300">
          <MessageSquare className="h-2.5 w-2.5" />
          {badge}
        </span>
      )}
      <div className="mb-3">{icon}</div>
      <h3 className="font-display font-bold text-titanium-50 text-lg tracking-tight mb-2">
        {title}
      </h3>
      <p className="text-sm text-titanium-400 leading-relaxed flex-1">
        {body}
      </p>
    </div>
  );
}
