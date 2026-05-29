import { ShieldCheck, Database, GitBranch, Replace, ScrollText } from 'lucide-react';

// GovernanceTrustSection — Trust ohne erfundene Kundenclaims. Adressiert die
// Zielgruppe direkt (DSBs, CTOs, AI-Governance-Leads, Procurement) und
// benennt die fünf konkreten Eigenschaften, die diese Teams nachfragen.
//
// Bewusst KEINE „Trusted by Fortune 500", keine Fake-Logos, keine
// erfundenen Case Studies. Die Pfeiler sind technisch verifizierbar und
// stehen so auch in Sub-Processor-Liste, Security-Roadmap und Methodik.

interface TrustPoint {
  icon:   React.ReactNode;
  label:  string;
  detail: string;
}

const POINTS: readonly TrustPoint[] = [
  {
    icon:   <ShieldCheck className="h-4 w-4" />,
    label:  'EU-first Infrastruktur',
    detail: 'Postgres, Auth und Edge Functions in Supabase Frankfurt. KI-Lokal-Toggle für Inference ohne Drittland-Transfer.',
  },
  {
    icon:   <Database className="h-4 w-4" />,
    label:  'Tenant-isolierte Evidence',
    detail: 'Pro Mandant getrennt, RLS-geschützt — keine geteilten Audit-Buckets, keine cross-tenant Sichtbarkeit.',
  },
  {
    icon:   <GitBranch className="h-4 w-4" />,
    label:  'RuntimeEvent-basierte Audit-Trails',
    detail: 'Jeder Befund, jede Fix-Bestätigung und jede Konfigurationsänderung wird als Event gehasht und versiegelt.',
  },
  {
    icon:   <Replace className="h-4 w-4" />,
    label:  'Replaybare Governance-Ereignisse',
    detail: 'Ereignishistorie deterministisch nachvollziehbar — Auditor und DSB sehen denselben Zustand zum selben Zeitpunkt.',
  },
  {
    icon:   <ScrollText className="h-4 w-4" />,
    label:  'Entwickelt für DSGVO- und EU-AI-Act-Workflows',
    detail: 'Annex-III-Klassifikation, Sub-Processor-Liste mit AVV-Links, methodisch dokumentierte Prüfregeln.',
  },
];

export function GovernanceTrustSection() {
  return (
    <section
      aria-label="Vertrauen — Zielgruppe + Eigenschaften"
      className="bg-obsidian-950 border-b border-titanium-900 py-16 sm:py-20 px-4 sm:px-6"
    >
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
            Wer mit der Runtime arbeitet
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
            Entwickelt für Teams, die Governance nachweisen müssen.
          </h2>
          <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
            Für Datenschutzbeauftragte, CTOs, Agenturen und AI-Governance-Teams,
            die nicht nur dokumentieren, sondern technische Nachweise benötigen.
          </p>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-px bg-titanium-900 border border-titanium-900">
          {POINTS.map((p) => (
            <li
              key={p.label}
              className="bg-obsidian-950 p-5 flex flex-col gap-2.5"
            >
              <span className="inline-flex w-8 h-8 items-center justify-center bg-obsidian-900 border border-titanium-800 text-cyan-300">
                {p.icon}
              </span>
              <span className="font-display font-semibold text-sm text-titanium-50 leading-snug">
                {p.label}
              </span>
              <span className="text-titanium-400 text-[13px] leading-relaxed">
                {p.detail}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-titanium-500">
          Keine erfundenen Kundenlogos · keine Fortune-500-Claims · transparente Zertifizierungs-Roadmap auf /security
        </p>
      </div>
    </section>
  );
}
