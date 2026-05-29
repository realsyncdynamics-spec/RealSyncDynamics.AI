import { useEffect, useState } from 'react';
import { Activity, ShieldCheck, Cpu, Bot, ScrollText } from 'lucide-react';

// AiOperatingSystemSection — Framing-Block für die Runtime-Übersicht.
// Vier Status-Indikatoren als Demo-Surface; alle Werte sind simuliert.
// Der „uptime"-Counter rechts oben ist eine UI-Animation des aktuellen
// Browser-Sessions, KEIN Indikator für laufende Kunden-Telemetrie.

interface Indicator {
  icon: React.ReactNode;
  label: string;
  status: string;
  tone: 'cyan' | 'amber' | 'violet' | 'emerald';
  pulseMs: number;
}

const INDICATORS: readonly Indicator[] = [
  {
    icon: <Activity className="h-4 w-4 text-cyan-300" />,
    label: 'Kontinuierliche Beobachtung',
    status: 'erkennen · überwachen',
    tone: 'cyan',
    pulseMs: 2200,
  },
  {
    icon: <Bot className="h-4 w-4 text-violet-300" />,
    label: 'Agenten aktiv',
    status: '4 / 4 (Demo)',
    tone: 'violet',
    pulseMs: 2800,
  },
  {
    icon: <ShieldCheck className="h-4 w-4 text-emerald-300" />,
    label: 'Evidence verankert',
    status: 'Kette · SHA-256',
    tone: 'emerald',
    pulseMs: 3200,
  },
  {
    icon: <ScrollText className="h-4 w-4 text-amber-300" />,
    label: 'Policies dokumentiert',
    status: '12 / 12',
    tone: 'amber',
    pulseMs: 3700,
  },
];

const TONE_BG: Record<Indicator['tone'], string> = {
  cyan:    'border-cyan-500/30    bg-cyan-950/20',
  amber:   'border-amber-500/30   bg-amber-950/20',
  violet:  'border-violet-500/30  bg-violet-950/20',
  emerald: 'border-emerald-500/30 bg-emerald-950/20',
};

const TONE_DOT: Record<Indicator['tone'], string> = {
  cyan:    'bg-cyan-400',
  amber:   'bg-amber-400',
  violet:  'bg-violet-400',
  emerald: 'bg-emerald-400',
};

export function AiOperatingSystemSection() {
  const [tick, setTick] = useState(0);

  // 1Hz tick drives the cycling phase animation in the top-right uptime pill.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 999), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      aria-label="AI Governance Operating System"
      className="relative bg-obsidian-950 border-b border-titanium-900 py-20 sm:py-28 px-4 sm:px-6 overflow-hidden"
    >
      {/* Faint observability grid */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(34,211,238,1) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,1) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />
      {/* Radial accent */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(34,211,238,0.07) 0%, transparent 60%), radial-gradient(ellipse at 50% 90%, rgba(168,85,247,0.05) 0%, transparent 60%)',
        }}
      />

      <div className="relative max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6 font-mono text-[11px] uppercase tracking-[0.18em] text-titanium-500">
          <span>Governance · Runtime · Demo</span>
          <span className="inline-flex items-center gap-1.5 text-titanium-400">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-amber-400 opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
            </span>
            Session · {String(Math.floor(tick / 60)).padStart(2, '0')}m {String(tick % 60).padStart(2, '0')}s
          </span>
        </div>

        <h2 className="text-3xl sm:text-5xl font-display font-semibold tracking-[-0.02em] text-titanium-50 leading-[1.1] mb-4">
          Governance ist eine{' '}
          <span className="text-cyan-300">Runtime</span>, keine Checkliste.
        </h2>
        <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl mb-10">
          KI- und Datenschutz-Systeme werden kontinuierlich beobachtet, Agenten
          übernehmen die wiederkehrende Governance-Arbeit, Evidence entsteht als
          Nebenprodukt des Betriebs, und jede Kontrolle verhält sich wie Infrastruktur —
          self-service, beobachtbar, wiederabspielbar.
        </p>

        {/* 4-up status grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-titanium-900">
          {INDICATORS.map((ind) => (
            <div
              key={ind.label}
              className={`bg-obsidian-950 p-5 flex flex-col gap-3 border-l-2 ${TONE_BG[ind.tone]}`}
            >
              <div className="flex items-center gap-2">
                {ind.icon}
                <span className="font-mono text-[11px] uppercase tracking-wider text-titanium-400">
                  {ind.label}
                </span>
              </div>
              <div className="font-mono text-sm text-titanium-50 flex items-center gap-2">
                <span className="relative inline-flex h-1.5 w-1.5">
                  <span
                    className={`absolute inset-0 rounded-full ${TONE_DOT[ind.tone]} opacity-75 motion-safe:animate-ping`}
                    style={{ animationDuration: `${ind.pulseMs}ms` }}
                  />
                  <span
                    className={`relative inline-block h-1.5 w-1.5 rounded-full ${TONE_DOT[ind.tone]}`}
                  />
                </span>
                {ind.status}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-2 sm:grid-cols-5 gap-px bg-titanium-900 font-mono text-[10px] text-titanium-500">
          {[
            ['Self-service', 'kein Setup-Call'],
            ['Kontinuierlich', 'kein Zeitplan'],
            ['Reproduzierbar', 'gehashte Evidence'],
            ['Beobachtbar',  'Runtime-Feed (Demo)'],
            ['Operativ',     'Agenten · keine Berater'],
          ].map(([k, v]) => (
            <div key={k} className="bg-obsidian-950 p-3">
              <div className="text-titanium-100 mb-0.5">{k}</div>
              <div className="uppercase tracking-wider">{v}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-cyan-300">
          <Cpu className="h-3 w-3" />
          Self-Service-Governance-Runtime
        </div>
      </div>
    </section>
  );
}
