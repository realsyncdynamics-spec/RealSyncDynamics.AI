import { useEffect, useState, Fragment, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Activity, Cpu, ShieldCheck, Zap } from 'lucide-react';

// HeroSection — the "this system is already running" moment. Infrastructure
// feel (Datadog / Vercel / Stripe), not a legal-website hero. Single fold,
// single primary CTA, one input. No modals, no panels, no marketing block.

const LIVE_PILL_LABELS = [
  { label: 'EU-Frankfurt',           color: 'text-emerald-300' },
  { label: 'detect',                 color: 'text-cyan-300'    },
  { label: 'monitor',                color: 'text-amber-300'   },
  { label: 'govern',                 color: 'text-emerald-300' },
  { label: 'automate',               color: 'text-violet-300'  },
];

export function HeroSection() {
  const [url, setUrl] = useState('');
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);

  // 1Hz pulse so the status line feels "live".
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 60), 1000);
    return () => clearInterval(id);
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      navigate('/audit?source=hero');
      return;
    }
    const normalized = trimmed.match(/^https?:\/\//i) ? trimmed : `https://${trimmed}`;
    const q = new URLSearchParams({ url: normalized, source: 'hero' });
    navigate(`/audit?${q.toString()}`);
  }

  return (
    <section
      aria-label="Runtime hero"
      className="relative bg-obsidian-950 border-b border-titanium-900 pt-28 pb-20 sm:pt-36 sm:pb-28 px-4 sm:px-6 overflow-hidden"
    >
      {/* Subtle observability grid */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(34,211,238,1) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,1) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />
      {/* Radial glow behind the input */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 60%, rgba(34,211,238,0.10) 0%, transparent 55%), radial-gradient(ellipse at 50% 40%, rgba(168,85,247,0.06) 0%, transparent 60%)',
        }}
      />

      <div className="relative max-w-5xl mx-auto">
        {/* Live status pill — eyebrow */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-titanium-800 bg-obsidian-900/70 font-mono text-[10px] uppercase tracking-[0.18em] text-titanium-400">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-block h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            runtime status: live · t+{String(tick).padStart(2, '0')}s
          </div>
        </div>

        <h1 className="text-center text-5xl sm:text-7xl font-display font-semibold tracking-[-0.02em] text-titanium-50 leading-[1.05] mb-5">
          Diese Runtime{' '}
          <span className="text-cyan-300">läuft schon.</span>
        </h1>

        <p className="text-center text-titanium-300 text-base sm:text-xl leading-relaxed max-w-2xl mx-auto mb-10">
          AI Governance Runtime für DSGVO und EU AI Act. Kontinuierliches Detect,
          Monitor, Govern, Automate — eine Operations-Ebene, kein Setup.
        </p>

        {/* URL launch input */}
        <form onSubmit={onSubmit} className="max-w-2xl mx-auto" role="search">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 flex items-center bg-obsidian-900 border border-titanium-800 focus-within:border-cyan-400/60 transition-colors">
              <span className="pl-3 font-mono text-[12px] text-titanium-500 select-none">https://</span>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="your-company.com"
                autoComplete="off"
                spellCheck={false}
                className="flex-1 bg-transparent px-2 py-3.5 text-sm sm:text-base outline-none text-titanium-50 placeholder:text-titanium-600 font-mono"
              />
            </div>
            <button
              type="submit"
              className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-cyan-400 text-obsidian-950 font-semibold text-sm sm:text-base tracking-tight hover:bg-cyan-300 transition-colors"
            >
              Run Scan
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </form>

        {/* Hint row */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-mono text-titanium-500">
          <span className="inline-flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-cyan-300" /> erstes Signal in 30 s
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-emerald-400" /> kein Setup nötig
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Cpu className="h-3 w-3 text-violet-300" /> EU-Edge · Audit-grade
          </span>
        </div>

        {/* Live metric strip */}
        <div className="mt-14 sm:mt-20 grid grid-cols-2 sm:grid-cols-4 border-t border-titanium-900 divide-x divide-titanium-900/60">
          <Metric icon={<Activity className="h-3.5 w-3.5 text-cyan-300" />} label="scans / 24h"    value="1,248" delta="▲ live" deltaColor="text-emerald-400" />
          <Metric icon={<Activity className="h-3.5 w-3.5 text-amber-300" />} label="drift events" value="93"    delta="open: 12" deltaColor="text-amber-300" />
          <Metric icon={<Cpu className="h-3.5 w-3.5 text-violet-300" />}     label="AI systems"   value="17"    delta="classified" deltaColor="text-violet-300" />
          <Metric icon={<ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />} label="evidence"  value="4,128" delta="synced" deltaColor="text-emerald-400" />
        </div>

        {/* Layer pills — separators kept in the DOM text so the labels stay
            readable even when CSS is stripped (prerender snapshots, SERP, RSS). */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
          {LIVE_PILL_LABELS.map((p, i) => (
            <Fragment key={p.label}>
              {i > 0 && <span aria-hidden="true" className="text-titanium-700 font-mono text-[10px] select-none"> · </span>}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 border border-titanium-900 bg-obsidian-900 font-mono text-[10px] uppercase tracking-wider ${p.color}`}
              >
                <span className="inline-block w-1 h-1 rounded-full bg-current" />
                {p.label}
              </span>
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
  delta,
  deltaColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: string;
  deltaColor: string;
}) {
  return (
    <div className="px-4 sm:px-6 py-5">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-2">
        {icon}
        {label}
      </div>
      <div className="font-display font-semibold text-2xl sm:text-3xl text-titanium-50 tabular-nums">
        {value}
      </div>
      <div className={`mt-0.5 font-mono text-[10px] ${deltaColor}`}>{delta}</div>
    </div>
  );
}
