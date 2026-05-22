import { Link } from 'react-router-dom';
import { MapPin, Lock, FileText, Clock } from 'lucide-react';

// TrustCertificationsSection — Vertrauens-Layer transparent statt versteckt.
// Adressiert: „Trust-Layer & Vergleich" aus dem Analyse-Punkt 7.
//
// WICHTIGE Regel: NUR transparent kommunizieren, was zertifiziert IST,
// und für was läuft, klar als „in Vorbereitung" labeln. Keine Über-Claims.
// Falsche Zertifikats-Behauptungen wären eine direkte HRP-Verletzung.

interface Pillar {
  icon:        React.ReactNode;
  status:      'live' | 'in_progress';
  label:       string;
  title:       string;
  detail:      string;
}

const PILLARS: readonly Pillar[] = [
  {
    icon:    <MapPin className="h-5 w-5" />,
    status:  'live',
    label:   'infra · eu-frankfurt',
    title:   'EU-Hosting per Default',
    detail:  'Postgres + Auth + Edge Functions in Supabase Frankfurt (eu-central-1). KI-lokal-Toggle: alle Inference-Calls über Hostinger-VPS mit Ollama — keine Drittland-Übermittlung.',
  },
  {
    icon:    <Lock className="h-5 w-5" />,
    status:  'live',
    label:   'design · per finding',
    title:   'Evidence kryptographisch versiegelt',
    detail:  'Jedes Finding mit SHA-256 gehasht, Ed25519 signiert, optional über RFC-3161 Timestamp verankert. Audit-Bundles vor Auditor + DSB unbestreitbar.',
  },
  {
    icon:    <FileText className="h-5 w-5" />,
    status:  'live',
    label:   'design · multi-tenant',
    title:   'DSGVO-konform + AI-Act-vorbereitet',
    detail:  'Volle Sub-Processor-Liste mit AVV-Links, Multi-Tenant-RLS, EU-region-pinned Provider-Endpoints (Anthropic EU, OpenAI EU, Google Vertex eu-central) mit DPAs nach Art. 46 DSGVO.',
  },
  {
    icon:    <Clock className="h-5 w-5" />,
    status:  'in_progress',
    label:   'in Vorbereitung · 2026 Q4',
    title:   'SOC 2 Type 1 + ISO 27001',
    detail:  'SOC 2 Type 1 läuft Richtung 2026 Q4, ISO 27001 parallel. Aktuelle Security-Posture, offene Lücken und Roadmap unverklausuliert auf /security.',
  },
];

export function TrustCertificationsSection() {
  return (
    <section
      aria-label="Vertrauen + Zertifizierungen"
      className="bg-obsidian-900 border-b border-titanium-900 py-20 sm:py-24 px-4 sm:px-6"
    >
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mb-12">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
            05 · Vertrauen + Hosting
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
            Wo Daten liegen, was zertifiziert ist.
          </h2>
          <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
            Vier Pfeiler — transparent inklusive der Lücken. Was wir noch nicht haben,
            steht hier, nicht nur im Kleingedruckten.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-titanium-900">
          {PILLARS.map((p, i) => (
            <article
              key={i}
              className="bg-obsidian-950 p-6 sm:p-7 flex flex-col"
            >
              <header className="flex items-center gap-2.5 mb-4">
                <span className={`inline-flex w-9 h-9 items-center justify-center bg-obsidian-900 border border-titanium-800 ${p.status === 'live' ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {p.icon}
                </span>
                <div className="flex flex-col">
                  <span className={`font-mono text-[10px] uppercase tracking-[0.18em] ${p.status === 'live' ? 'text-emerald-400' : 'text-amber-400'} flex items-center gap-1.5`}>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${p.status === 'live' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    {p.label}
                  </span>
                </div>
              </header>

              <h3 className="font-display font-semibold text-base text-titanium-50 mb-3 leading-snug">
                {p.title}
              </h3>

              <p className="text-titanium-400 text-sm leading-relaxed flex-1">
                {p.detail}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-[11px] text-titanium-500">
          <Link to="/legal/sub-processors" className="hover:text-titanium-200 transition-colors">
            → Sub-Processor-Liste
          </Link>
          <Link to="/security" className="hover:text-titanium-200 transition-colors">
            → Security-Roadmap (offen)
          </Link>
          <Link to="/legal/privacy" className="hover:text-titanium-200 transition-colors">
            → Datenschutzerklärung
          </Link>
        </div>
      </div>
    </section>
  );
}
