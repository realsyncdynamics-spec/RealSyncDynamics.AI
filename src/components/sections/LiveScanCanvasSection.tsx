import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { Globe, Lock, Cookie, Cpu, AlertTriangle } from 'lucide-react';

// LiveScanCanvasSection — "The runtime detects issues live."
// Browser-pane mock that gets annotated in real-time as the scan progresses.
// No screenshot images. Pure DOM mock with annotation pills floating in.

type AnnotationSeverity = 'critical' | 'warn' | 'ai' | 'ok';

interface Annotation {
  id: string;
  /** Reveal timestamp in ms after section enters viewport. */
  at: number;
  severity: AnnotationSeverity;
  label: string;
  /** approximate anchor inside the browser-body pane (0..1). */
  x: number;
  y: number;
  icon: React.ReactNode;
}

const ANNOTATIONS: readonly Annotation[] = [
  { id: 'a1', at:  500, severity: 'critical', label: 'tracker · pre-consent · gtm.js', x: 0.18, y: 0.12, icon: <AlertTriangle className="h-3 w-3" /> },
  { id: 'a2', at: 1300, severity: 'warn',     label: 'cookie · _ga · third-party',     x: 0.66, y: 0.30, icon: <Cookie       className="h-3 w-3" /> },
  { id: 'a3', at: 2100, severity: 'ai',       label: 'AI widget · classify: limited',  x: 0.22, y: 0.62, icon: <Cpu          className="h-3 w-3" /> },
  { id: 'a4', at: 2900, severity: 'warn',     label: 'header · X-Frame-Options absent', x: 0.70, y: 0.78, icon: <Lock         className="h-3 w-3" /> },
  { id: 'a5', at: 3700, severity: 'ok',       label: 'TLS 1.3 · HSTS-on',               x: 0.42, y: 0.46, icon: <Lock         className="h-3 w-3" /> },
];

const SEV_CLASSES: Record<AnnotationSeverity, string> = {
  critical: 'border-red-500/50    bg-red-950/70    text-red-200',
  warn:     'border-amber-500/50  bg-amber-950/70  text-amber-200',
  ai:       'border-violet-500/50 bg-violet-950/70 text-violet-200',
  ok:       'border-emerald-500/50 bg-emerald-950/70 text-emerald-200',
};

export function LiveScanCanvasSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const reduce = useReducedMotion();
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setRevealed(new Set(ANNOTATIONS.map((a) => a.id)));
      setProgress(100);
      return;
    }
    const timers: number[] = [];
    ANNOTATIONS.forEach((a) => {
      timers.push(
        window.setTimeout(() => {
          setRevealed((prev) => new Set(prev).add(a.id));
        }, a.at),
      );
    });
    const startT = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(100, ((t - startT) / 4200) * 100);
      setProgress(p);
      if (p < 100) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      timers.forEach((id) => clearTimeout(id));
      cancelAnimationFrame(raf);
    };
  }, [inView, reduce]);

  return (
    <section
      ref={ref}
      aria-label="Live scan canvas"
      className="bg-obsidian-900 border-b border-titanium-900 py-20 sm:py-28 px-4 sm:px-6"
    >
      <div className="max-w-7xl mx-auto">
        <SectionHead
          eyebrow="02 · detect"
          title="The runtime detects issues live."
          sub="Browser layer, network layer, AI layer — annotated while the scan happens. Every signal sealed into the evidence chain on the same request."
        />

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-px bg-titanium-900">
          {/* Browser pane mock */}
          <div className="bg-obsidian-950 relative overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-titanium-900 bg-obsidian-900 font-mono text-[10px] text-titanium-500">
              <span className="inline-flex gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
              </span>
              <span className="flex items-center gap-1.5 flex-1 px-2 py-0.5 bg-obsidian-950 border border-titanium-900">
                <Globe className="h-3 w-3 text-titanium-500" />
                https://your-company.com
              </span>
              <span className="uppercase tracking-wider">view · annotated</span>
            </div>

            <div className="relative h-[420px] sm:h-[460px] p-6">
              {/* Skeleton content lines */}
              <Skeleton width="60%" h="h-6" />
              <Skeleton width="85%" />
              <Skeleton width="72%" />
              <Skeleton width="64%" />
              <div className="my-5 px-4 py-3 border border-titanium-900 bg-obsidian-900">
                <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-2">checkout form</div>
                <Skeleton width="80%" />
                <Skeleton width="55%" />
              </div>
              <Skeleton width="78%" />
              <Skeleton width="48%" />

              {/* Annotations */}
              {ANNOTATIONS.map((a) => {
                const visible = revealed.has(a.id);
                return (
                  <motion.div
                    key={a.id}
                    role="status"
                    initial={reduce ? false : { opacity: 0, y: 6, scale: 0.96 }}
                    animate={visible ? { opacity: 1, y: 0, scale: 1 } : (reduce ? { opacity: 1 } : { opacity: 0, y: 6, scale: 0.96 })}
                    transition={{ duration: 0.35 }}
                    className={`absolute inline-flex items-center gap-1.5 px-2 py-1 border font-mono text-[10px] uppercase tracking-wider ${SEV_CLASSES[a.severity]} shadow-lg shadow-black/40 whitespace-nowrap`}
                    style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%` }}
                  >
                    {a.icon}
                    {a.label}
                  </motion.div>
                );
              })}
            </div>

            {/* Scan progress bar */}
            <div className="px-4 py-2 border-t border-titanium-900 bg-obsidian-900 font-mono text-[10px] uppercase tracking-wider text-titanium-500 flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-cyan-400 opacity-75 animate-ping" />
                  <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" />
                </span>
                scanning
              </span>
              <div className="flex-1 h-px bg-titanium-900 overflow-hidden">
                <div
                  className="h-px bg-cyan-400 transition-[width] duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-titanium-400 tabular-nums">{Math.round(progress)}%</span>
            </div>
          </div>

          {/* Findings counter pane */}
          <div className="bg-obsidian-950 flex flex-col">
            <div className="px-4 py-2.5 border-b border-titanium-900 bg-obsidian-900 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
              findings · demo
            </div>
            <div className="flex-1 p-6 grid grid-cols-2 gap-px bg-titanium-900">
              <FindingTile label="critical" value={[...revealed].filter((id) => ANNOTATIONS.find((a) => a.id === id)?.severity === 'critical').length} color="text-red-300" />
              <FindingTile label="warn"     value={[...revealed].filter((id) => ANNOTATIONS.find((a) => a.id === id)?.severity === 'warn').length}     color="text-amber-300" />
              <FindingTile label="ai"       value={[...revealed].filter((id) => ANNOTATIONS.find((a) => a.id === id)?.severity === 'ai').length}       color="text-violet-300" />
              <FindingTile label="ok"       value={[...revealed].filter((id) => ANNOTATIONS.find((a) => a.id === id)?.severity === 'ok').length}       color="text-emerald-300" />
            </div>
            <div className="px-4 py-3 border-t border-titanium-900 font-mono text-[10px] text-titanium-500 leading-relaxed">
              every annotation → evidence-chain entry · sealed sha256 · replay-ready
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Skeleton({ width = '100%', h = 'h-3.5' }: { width?: string; h?: string }) {
  return (
    <div className="mb-3 bg-titanium-900/70" style={{ width }}>
      <div className={`${h} w-full`} />
    </div>
  );
}

function FindingTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-obsidian-950 p-4">
      <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-2">{label}</div>
      <div className={`font-display font-semibold text-3xl tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div className="max-w-3xl">
      <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
        {eyebrow}
      </div>
      <h2 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
        {title}
      </h2>
      <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
        {sub}
      </p>
    </div>
  );
}
