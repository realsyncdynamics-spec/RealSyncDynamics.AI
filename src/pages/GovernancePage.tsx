import { Navbar } from '../components/Navbar';
import { usePageMeta } from '../lib/usePageMeta';
import { GovernanceGraphSection } from '../components/governance/GovernanceGraphSection';
import { ScrollText, Lock, Cookie, Cpu, ShieldCheck, FileSearch, Server, Database } from 'lucide-react';

// GovernancePage — Kontrollen + Policies Übersicht (Demo).
// Public-facing Surface, KEINE Auth-Gated Tenant-Daten. Auth-Dashboard
// liegt unter /governance/admin.

interface Control {
  id: string;
  name: string;
  description: string;
  status: 'enforced' | 'monitor-only' | 'draft' | 'failing';
  scope: string;
  owner: string;
  icon: React.ReactNode;
}

const CONTROLS: readonly Control[] = [
  { id: 'c1', name: 'pre-consent-tracker-block',  description: 'Blockiert Drittanbieter-Tracker, bevor das Consent-Banner Einwilligung gemeldet hat.', status: 'enforced',     scope: '12 Sites',          owner: 'drift-agent',    icon: <Cookie className="h-4 w-4 text-amber-300" /> },
  { id: 'c2', name: 'pii-redaction',              description: 'Entfernt E-Mails, Telefonnummern und freitextliche personenbezogene Daten aus ausgehenden Modell-Prompts.', status: 'enforced',     scope: '5 KI-Systeme',      owner: 'ai-risk-agent',  icon: <Lock className="h-4 w-4 text-cyan-300" /> },
  { id: 'c3', name: 'output-disclaimer',          description: 'Setzt einen AI-Act-Art-50-Hinweis in Chatbot-Ausgaben und KI-generierte E-Mails ein.', status: 'enforced',     scope: '3 KI-Systeme',      owner: 'policy-agent',   icon: <FileSearch className="h-4 w-4 text-violet-300" /> },
  { id: 'c4', name: 'human-in-the-loop',          description: 'Leitet Hochrisiko-Klassifikator-Entscheidungen in eine Human-Review-Warteschlange mit SLA.', status: 'monitor-only', scope: 'risk-classifier',   owner: 'policy-agent',   icon: <ShieldCheck className="h-4 w-4 text-emerald-300" /> },
  { id: 'c5', name: 'data-retention-90d',         description: 'Löscht Roh-Scan-Daten nach 90 Tagen automatisch; SHA-256-Hashes bleiben dauerhaft.', status: 'enforced',     scope: 'global',            owner: 'evidence-agent', icon: <Database className="h-4 w-4 text-cyan-300" /> },
  { id: 'c6', name: 'cross-border-egress-block',  description: 'Lehnt Modell-Aufrufe ab, die Daten außerhalb der konfigurierten EU-Regionen leiten würden.', status: 'enforced',     scope: 'alle KI-Systeme',   owner: 'ai-risk-agent',  icon: <Server className="h-4 w-4 text-amber-300" /> },
  { id: 'c7', name: 'consent-receipt-anchor',     description: 'Hashed jede Einwilligung und verankert die Quittung in der Evidence-Chain.', status: 'enforced',     scope: 'global',            owner: 'evidence-agent', icon: <ShieldCheck className="h-4 w-4 text-emerald-300" /> },
  { id: 'c8', name: 'incident-72h-escalation',    description: 'Eskaliert Hochrisiko-Drift automatisch an den DSB-Posteingang innerhalb des DSGVO-72h-Fensters (Art. 33).', status: 'enforced', scope: 'global', owner: 'drift-agent', icon: <Cpu className="h-4 w-4 text-violet-300" /> },
];

const STATUS_TONE: Record<Control['status'], { dot: string; text: string; label: string }> = {
  enforced:       { dot: 'bg-emerald-400', text: 'text-emerald-300', label: 'aktiv' },
  'monitor-only': { dot: 'bg-amber-400',   text: 'text-amber-300',   label: 'beobachtend' },
  draft:          { dot: 'bg-titanium-500', text: 'text-titanium-400', label: 'Entwurf' },
  failing:        { dot: 'bg-red-400',     text: 'text-red-300',     label: 'fehlerhaft' },
};

export function GovernancePage() {
  usePageMeta({
    title: 'Governance — Kontrollen + Policies | RealSync',
    description:
      'Governance-Kontrollen und -Policies in der Runtime. Demo-Surface — ' +
      'jede Kontrolle ist KI-Systemen, Agenten und Evidence zugeordnet.',
    url: 'https://RealSyncDynamicsAI.de/governance',
  });

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <Navbar />
      <main className="pt-14">
        {/* Demo-Strip. */}
        <div className="border-b border-titanium-900 bg-obsidian-900/80">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-1.5 sm:px-6">
            <span className="select-none font-mono text-[9px] uppercase tracking-[0.2em] text-titanium-500">
              Demo-Runtime · simulierte Werte · keine Kundendaten
            </span>
          </div>
        </div>

        <header className="border-b border-titanium-900 px-4 sm:px-6 py-16">
          <div className="max-w-7xl mx-auto">
            <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
              Governance · Kontrollen + Policies
            </div>
            <h1 className="text-4xl sm:text-5xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
              Policies sind operativ, kein Papier.
            </h1>
            <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
              Jede Governance-Kontrolle ist ein Prozess, der einem Agenten gehört. Status,
              Scope und Verantwortliche sind sichtbar — die Runtime führt sie bei jeder
              relevanten Anfrage aus.
            </p>
          </div>
        </header>

        <GovernanceGraphSection headless />

        <section className="px-4 sm:px-6 py-20 bg-obsidian-900 border-t border-titanium-900">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-3xl mb-8">
              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-2">
                Katalog · {CONTROLS.length} Kontrollen
              </div>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold tracking-tight text-titanium-50">
                Aktiver Kontroll-Katalog.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-titanium-900">
              {CONTROLS.map((c) => {
                const t = STATUS_TONE[c.status];
                return (
                  <article key={c.id} className="bg-obsidian-950 p-5 flex flex-col gap-3 min-h-[180px]">
                    <header className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="inline-flex w-8 h-8 items-center justify-center bg-obsidian-900 border border-titanium-800 shrink-0">
                          {c.icon}
                        </span>
                        <div className="min-w-0">
                          <div className="font-mono text-sm text-titanium-50 truncate">{c.name}</div>
                          <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mt-0.5">Kontrolle</div>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider ${t.text} shrink-0`}>
                        <span className="relative inline-flex h-1.5 w-1.5">
                          {c.status === 'enforced' && (
                            <span className={`absolute inset-0 rounded-full ${t.dot} opacity-75 motion-safe:animate-ping`} />
                          )}
                          <span className={`relative inline-block h-1.5 w-1.5 rounded-full ${t.dot}`} />
                        </span>
                        {t.label}
                      </span>
                    </header>
                    <p className="text-sm text-titanium-300 leading-relaxed flex-1">{c.description}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t border-titanium-900/60 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                      <span>Scope: <span className="text-titanium-200 normal-case">{c.scope}</span></span>
                      <span>Owner: <span className="text-titanium-200 normal-case">{c.owner}</span></span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
