import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { PRICING_TIERS } from '../../config/pricing';

// RuntimeActivationSection — "Activate your runtime."
// Pricing-as-activation. Reads PRICING_TIERS from src/config/pricing.ts so
// the homepage and /pricing page never disagree. A small URL launcher sits
// above the plan grid so visitors who arrive at the end of the page can
// still kick off a Run Scan without scrolling back to the hero.

export function RuntimeActivationSection() {
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
      aria-label="Runtime activation"
      className="relative bg-obsidian-950 py-20 sm:py-28 px-4 sm:px-6 overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 30%, rgba(34,211,238,0.08) 0%, transparent 55%), radial-gradient(ellipse at 50% 80%, rgba(168,85,247,0.05) 0%, transparent 60%)',
        }}
      />

      <div className="relative max-w-7xl mx-auto">
        <div className="max-w-3xl mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
            Runtime aktivieren
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
            Runtime aktivieren — vom kostenlosen Audit bis Enterprise.
          </h2>
          <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
            Das kostenlose Audit ist der Einstieg ohne Karte. Starter aktiviert kontinuierliches Monitoring.
            Growth ergänzt die AI-Act-Governance-Schicht. Agency liefert Multi-Domain-Whitelabel.
            Enterprise ist eine dedizierte Runtime-Umgebung.
          </p>
        </div>

        {/* URL launcher (mirrors hero) */}
        <form onSubmit={onSubmit} className="max-w-2xl mb-12" role="search">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 flex items-center bg-obsidian-900 border border-titanium-800 focus-within:border-cyan-400/60 transition-colors">
              <span className="pl-3 font-mono text-[12px] text-titanium-500 select-none">https://</span>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="ihre-domain.de"
                aria-label="Website-URL für kostenlosen Audit"
                autoComplete="off"
                spellCheck={false}
                className="flex-1 bg-transparent px-2 py-3 text-sm outline-none text-titanium-50 placeholder:text-titanium-600 font-mono"
              />
            </div>
            <button
              type="submit"
              className="group inline-flex items-center justify-center gap-2 px-5 py-3 bg-cyan-400 text-obsidian-950 font-semibold text-sm tracking-tight hover:bg-cyan-300 transition-colors whitespace-nowrap"
            >
              Kostenlosen Audit starten
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </form>

        {/* Plan grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-px bg-titanium-900">
          {PRICING_TIERS.map((tier) => (
            <article
              key={tier.id}
              className={[
                'bg-obsidian-950 p-5 flex flex-col gap-3',
                tier.highlight ? 'ring-1 ring-cyan-500/40 relative' : '',
              ].join(' ')}
            >
              {tier.highlight && (
                <span className="absolute -top-2 right-3 px-1.5 py-0.5 bg-cyan-400 text-obsidian-950 font-mono text-[9px] uppercase tracking-wider">
                  empfohlen
                </span>
              )}

              <header>
                <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-1">{tier.id}</div>
                <h3 className="font-display font-semibold text-lg text-titanium-50">{tier.name}</h3>
              </header>

              <div>
                <div className="font-display font-semibold text-3xl tabular-nums text-titanium-50">
                  {tier.priceString === 'individuell' ? 'Individuell' : `€ ${tier.priceString}`}
                </div>
                <div className="font-mono text-[10px] text-titanium-500 mt-1">{tier.priceSuffix}</div>
              </div>

              <ul className="space-y-1.5 pt-3 border-t border-titanium-900/60 flex-1">
                {tier.bullets.slice(0, 4).map((b) => (
                  <li key={b} className="flex items-start gap-2 text-[11px] text-titanium-300">
                    <Check className="h-3 w-3 mt-0.5 shrink-0 text-emerald-400" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <Link
                to={tier.cta.href}
                className={[
                  'inline-flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold tracking-tight transition-colors',
                  tier.highlight
                    ? 'bg-cyan-400 text-obsidian-950 hover:bg-cyan-300'
                    : 'bg-obsidian-900 text-titanium-100 hover:bg-obsidian-800 border border-titanium-800',
                ].join(' ')}
              >
                {tier.cta.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-6 text-center font-mono text-[10px] text-titanium-500">
          <Link to="/pricing" className="hover:text-titanium-200 underline underline-offset-4">
            vollständiger Plan-Vergleich →
          </Link>
        </div>
      </div>
    </section>
  );
}
