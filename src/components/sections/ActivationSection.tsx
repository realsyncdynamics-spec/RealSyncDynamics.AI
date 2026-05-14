import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Cpu, Activity } from 'lucide-react';

// ActivationSection — single conversion moment at the end of the landing.
// One primary CTA ("Start Runtime"), one input, no alternatives.
// All other "talk to us" / "request" patterns are intentionally absent.

export function ActivationSection() {
  const [url, setUrl] = useState('');
  const navigate = useNavigate();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      navigate('/audit?source=activation');
      return;
    }
    const normalized = trimmed.match(/^https?:\/\//i) ? trimmed : `https://${trimmed}`;
    const q = new URLSearchParams({ url: normalized, source: 'activation' });
    navigate(`/audit?${q.toString()}`);
  }

  return (
    <section
      aria-label="Activate the runtime"
      className="relative bg-obsidian-950 border-b border-titanium-900 py-24 sm:py-32 px-4 sm:px-6 overflow-hidden"
    >
      {/* radial glow */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 40%, rgba(34,211,238,0.08) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(168,85,247,0.05) 0%, transparent 60%)',
        }}
      />

      <div className="relative max-w-3xl mx-auto text-center">
        <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
          05 · Activate
        </div>
        <h2 className="text-3xl sm:text-5xl font-display font-semibold tracking-tight text-titanium-50 mb-4">
          Activate the runtime.
        </h2>
        <p className="text-titanium-300 text-base sm:text-lg leading-relaxed mb-10 max-w-xl mx-auto">
          URL eingeben. Die Runtime scannt, klassifiziert, monitort und schreibt Evidence — ab Sekunde eins.
          Kein Onboarding-Call, kein Setup-Service.
        </p>

        <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2 max-w-xl mx-auto" role="search">
          <div className="flex-1 flex items-center bg-obsidian-900 border border-titanium-800 focus-within:border-titanium-600 transition-colors">
            <span className="pl-3 text-[12px] font-mono text-titanium-500">https://</span>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="your-company.com"
              autoComplete="off"
              spellCheck={false}
              className="flex-1 bg-transparent px-2 py-3 text-sm outline-none text-titanium-50 placeholder:text-titanium-600"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-cyan-400 text-obsidian-950 font-semibold text-sm tracking-tight hover:bg-cyan-300 transition-colors"
          >
            Start Runtime
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-mono text-titanium-500">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-emerald-400" /> Zero setup
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-cyan-300" /> First signal in 30s
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Cpu className="h-3 w-3 text-violet-300" /> EU-Frankfurt edge
          </span>
        </div>
      </div>
    </section>
  );
}
