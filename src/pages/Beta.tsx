import { Link } from 'react-router-dom';
import { BetaApplicationForm } from '../components/enterprise-ai-os/BetaApplicationForm';
import { BETA_PROGRAM_LIMIT } from '../lib/enterprise-ai-os/beta-program';

const HIGHLIGHTS = [
  { kpi: BETA_PROGRAM_LIMIT, label: 'Founding Beta Partner' },
  { kpi: 12, label: 'Monate Enterprise' },
  { kpi: '∞', label: 'Website-Scans' },
];

const BENEFITS = [
  'Unbegrenzte Website- und AI-Act-Scans über 12 Monate',
  'Persönlicher Governance-Review durch unser Team',
  'Direkter Draht zum Entwicklerteam — Slack/Discord/E-Mail',
  'Mitgestaltung der nächsten Plattform-Generation',
  'Frühzugang zu DSGVO-/AI-Act-Chat und Provenienz-Pipeline',
  'Priority-Support · max. 4 Stunden Reaktion an Werktagen',
];

const COMMITMENTS = [
  'Aktives Feedback im strukturierten Triage-Wizard',
  'Bug-Reports mit Screenshots und Reproduktions-Schritten',
  'Kurze 30-Min-Calls bei kritischen Meilensteinen',
  'Ehrliche UX-Rückmeldungen, auch wenn sie unbequem sind',
];

export function Beta() {
  return (
    <main className="min-h-screen bg-[#0A0A0B] px-6 py-20 font-mono text-[#E2E2E2]">
      <div className="mx-auto max-w-4xl">
        <div className="inline-flex border border-[#d4af37]/40 bg-[#d4af37]/5 px-3 py-1 text-[11px] uppercase tracking-wider text-[#d4af37]">
          Founding Beta · limitiert auf {BETA_PROGRAM_LIMIT} Plätze
        </div>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          {BETA_PROGRAM_LIMIT} Founding Beta Partner gesucht.
        </h1>

        <p className="mt-5 max-w-2xl text-zinc-400">
          12 Monate Enterprise-Zugang zu RealSyncDynamics.AI im Austausch gegen aktives
          Produktfeedback. Keine kostenlose Testflut — fünf ausgewählte Unternehmen, die
          die nächste Generation von Governance-Infrastruktur mitgestalten.
        </p>

        <div className="mt-10 grid grid-cols-3 border border-white/10 bg-white/[0.02]">
          {HIGHLIGHTS.map((h, i) => (
            <div
              key={h.label}
              className={`p-5 ${i < HIGHLIGHTS.length - 1 ? 'border-r border-white/10' : ''}`}
            >
              <div className="text-3xl font-semibold text-[#d4af37]">{h.kpi}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-zinc-500">
                {h.label}
              </div>
            </div>
          ))}
        </div>

        <section className="mt-12 grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="text-sm uppercase tracking-wider text-[#d4af37]">
              Was Beta-Partner bekommen
            </h2>
            <ul className="mt-4 space-y-2 text-sm text-zinc-300">
              {BENEFITS.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="text-[#0052FF]">·</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm uppercase tracking-wider text-[#d4af37]">
              Was wir im Gegenzug erwarten
            </h2>
            <ul className="mt-4 space-y-2 text-sm text-zinc-300">
              {COMMITMENTS.map((c) => (
                <li key={c} className="flex gap-2">
                  <span className="text-[#0052FF]">·</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Bewerbung
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Wir prüfen jede Bewerbung persönlich. Antwort innerhalb von 48 Stunden.
          </p>
          <BetaApplicationForm />
        </section>

        <section className="mt-16 border-t border-white/10 pt-8 text-xs text-zinc-500">
          <p>
            Hinweis: Sie suchen eher das breitere{' '}
            <Link
              to="/enterprise-ai-os/founding-access"
              className="text-[#d4af37] underline-offset-2 hover:underline"
            >
              Founding Access Program
            </Link>{' '}
            (14 Tage, bis zu 100 Unternehmen)? Dieses Beta-Programm ist die exklusive
            Spitze davor.
          </p>
        </section>
      </div>
    </main>
  );
}
