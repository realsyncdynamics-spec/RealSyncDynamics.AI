import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { Search, Activity, Shield, Cpu } from 'lucide-react';
import { LAYERS, type LayerId } from '../../content/runtimeVocab';

// FourLayersSection — the single mental model the visitor must absorb.
// Detect → Monitor → Govern → Automate. All other features are sub-layers.
// 8px-grid cards, identical shape across all four. No CTA per card —
// CTAs live in the ActivationSection below this.

const ICON_BY_ID: Record<LayerId, React.ReactNode> = {
  detect:   <Search className="h-4 w-4" />,
  monitor:  <Activity className="h-4 w-4" />,
  govern:   <Shield className="h-4 w-4" />,
  automate: <Cpu className="h-4 w-4" />,
};

const ACCENT_BY_ID: Record<LayerId, string> = {
  detect:   'border-cyan-500/40   text-cyan-200',
  monitor:  'border-amber-500/40  text-amber-200',
  govern:   'border-emerald-500/40 text-emerald-200',
  automate: 'border-violet-500/40 text-violet-200',
};

export function FourLayersSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const reduce = useReducedMotion();

  return (
    <section
      ref={ref}
      aria-label="Four layers of the runtime"
      className="bg-obsidian-950 border-b border-titanium-900 py-20 sm:py-28 px-4 sm:px-6"
    >
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mb-12">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
            03 · System layers
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
            One runtime, four layers.
          </h2>
          <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
            Alles in der Plattform fällt in genau eine dieser Schichten. Keine separaten Tools,
            kein Add-on-Stack neben dem Monitoring. Eine Runtime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-titanium-900">
          {LAYERS.map((layer, i) => (
            <motion.article
              key={layer.id}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : (reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 })}
              transition={{ duration: 0.45, delay: 0.05 + i * 0.07 }}
              className="bg-obsidian-950 p-6 flex flex-col gap-4 min-h-[280px]"
            >
              <header className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-2 px-2 py-1 border ${ACCENT_BY_ID[layer.id]} bg-obsidian-900 text-[10px] font-mono uppercase tracking-wider`}>
                  {ICON_BY_ID[layer.id]}
                  {layer.short} · {layer.title}
                </span>
              </header>

              <div className="flex-1">
                <h3 className="text-xl font-display font-semibold text-titanium-50 mb-1">
                  {layer.title}
                </h3>
                <p className="text-[11px] font-mono uppercase tracking-wider text-titanium-500 mb-3">
                  {layer.role}
                </p>
                <p className="text-sm text-titanium-300 leading-relaxed">
                  {layer.blurb}
                </p>
              </div>

              <ul className="space-y-1 pt-2 border-t border-titanium-900/60">
                {layer.bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2 text-[11px] font-mono text-titanium-400">
                    <span className="inline-block w-1 h-1 bg-titanium-600" />
                    {b}
                  </li>
                ))}
              </ul>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
