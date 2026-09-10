import { useEffect, useState } from "react";
import { Eyebrow } from "@/components/layout/section";
import { controlLoop } from "@/data/runtime";
import { cn } from "@/lib/utils";

export function ControlLoop() {
  const [active, setActive] = useState(0);
  const n = controlLoop.length;

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % n), 1600);
    return () => window.clearInterval(id);
  }, [n]);

  const step = controlLoop[active];
  const size = 420;
  const cx = size / 2;
  const cy = size / 2;
  const r = 148;

  return (
    <section id="loop" className="border-y border-border bg-panel px-5 py-20 md:px-8 md:py-28 lg:px-12">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div>
          <Eyebrow>Der Control Loop</Eyebrow>
          <h2 className="text-3xl font-medium tracking-[-0.03em] text-fg md:text-4xl">
            Vom Ereignis zum Nachweis
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
            RealSync Runtime ist eine Runtime, kein Meldesystem. Ereignisse treten in eine gesteuerte
            Schleife ein — beobachten, verstehen, bewerten, entscheiden, freigeben, handeln, prüfen,
            nachweisen, lernen — und kehren zur Beobachtung zurück.
          </p>
          <div className="mt-8 rounded-lg bg-elevated p-5 shadow-[0_0_0_1px_rgba(238,234,226,0.08)]">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
              {String(active + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
            </p>
            <h3 className="mt-2 text-xl font-medium text-fg">{step.label}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{step.copy}</p>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[420px]">
          <svg viewBox={`0 0 ${size} ${size}`} className="w-full" role="img" aria-label="Control Loop">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(238,234,226,0.08)" strokeWidth="1" />
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="#3EC8E0"
              strokeWidth="1.4"
              strokeDasharray="70 850"
              strokeLinecap="round"
              className="loop-arc origin-center"
              style={{ transformOrigin: "center" }}
            />
            {controlLoop.map((s, i) => {
              const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
              const x = cx + Math.cos(angle) * r;
              const y = cy + Math.sin(angle) * r;
              const on = i === active;
              return (
                <g key={s.id} className="cursor-pointer" onClick={() => setActive(i)}>
                  <circle
                    cx={x}
                    cy={y}
                    r={on ? 7 : 4.5}
                    fill={on ? "#3EC8E0" : "#08090b"}
                    stroke={on ? "#3EC8E0" : "rgba(238,234,226,0.35)"}
                    strokeWidth="1.2"
                  />
                  <text
                    x={cx + Math.cos(angle) * (r + 28)}
                    y={cy + Math.sin(angle) * (r + 28)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={on ? "#EEEAE2" : "#9B9DA6"}
                    fontSize="9"
                    fontFamily="IBM Plex Mono, monospace"
                    letterSpacing="0.12em"
                  >
                    {s.label.toUpperCase()}
                  </text>
                </g>
              );
            })}
            <text
              x={cx}
              y={cy - 6}
              textAnchor="middle"
              fill="#EEEAE2"
              fontSize="11"
              fontFamily="IBM Plex Sans, sans-serif"
              letterSpacing="0.18em"
            >
              RUNTIME
            </text>
            <text
              x={cx}
              y={cy + 12}
              textAnchor="middle"
              fill="#6E727C"
              fontSize="9"
              fontFamily="IBM Plex Mono, monospace"
              letterSpacing="0.16em"
            >
              STEUERSCHLEIFE
            </text>
          </svg>
        </div>
      </div>

      <ol className="mx-auto mt-12 flex max-w-6xl flex-wrap justify-center gap-2">
        {controlLoop.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "rounded-sm px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-150",
                i === active
                  ? "bg-accent text-accent-fg"
                  : "text-muted shadow-[0_0_0_1px_rgba(238,234,226,0.12)] hover:text-fg",
              )}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
