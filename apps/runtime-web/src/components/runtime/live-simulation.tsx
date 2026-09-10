import { useEffect, useState } from "react";
import { Eyebrow } from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import { lifecycle, simEvents, decisionLabel, type SimEvent } from "@/data/simulation";
import { cn } from "@/lib/utils";

function toneFor(d: SimEvent["decision"]) {
  if (d === "allow") return "success" as const;
  if (d === "hold") return "warning" as const;
  return "critical" as const;
}

export function LiveSimulation() {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState(0);
  const event = simEvents[index];

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setPhase(lifecycle.length - 1);
      return;
    }
    setPhase(0);
    const tick = window.setInterval(() => {
      setPhase((p) => {
        if (p >= lifecycle.length - 1) {
          window.setTimeout(() => setIndex((i) => (i + 1) % simEvents.length), 700);
          return p;
        }
        return p + 1;
      });
    }, 700);
    return () => window.clearInterval(tick);
  }, [index]);

  return (
    <section id="simulation" className="px-5 py-20 md:px-8 md:py-28 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <Eyebrow>Live-Simulation</Eyebrow>
            <h2 className="text-3xl font-medium tracking-[-0.03em] text-fg md:text-4xl">
              Die Runtime in Echtzeit denken sehen
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              Beispieldaten eines Mandanten. Vollständiger Ereignislebenszyklus von der Erkennung bis
              zum versiegelten Nachweis.
            </p>
          </div>
          <Badge tone="accent">
            <span className="live-dot size-1.5 rounded-full bg-accent" />
            Demo-Feed
          </Badge>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-xl bg-surface p-2 shadow-[0_0_0_1px_rgba(238,234,226,0.08)]">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">Ereignisstrom</p>
              <p className="font-mono text-[10px] text-muted">Beispiel · keine Produktivdaten</p>
            </div>
            <ul className="space-y-1 p-2">
              {simEvents.map((e, i) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    className={cn(
                      "w-full rounded-md px-3 py-3 text-left transition-[background-color] duration-150",
                      i === index ? "bg-elevated" : "hover:bg-elevated/60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[10px] text-subtle">{e.time}</span>
                      <Badge tone={e.source === "Industrie" ? "warning" : e.source === "KI" ? "accent" : "neutral"}>
                        {e.source}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-sm text-fg">{e.title}</p>
                    <p className="mt-1 font-mono text-[10px] text-muted">{e.id}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <LifecycleCard event={event} phase={phase} />
        </div>
      </div>
    </section>
  );
}

function LifecycleCard({ event, phase }: { event: SimEvent; phase: number }) {
  return (
    <div className="rounded-xl bg-surface p-6 shadow-[0_0_0_1px_rgba(238,234,226,0.08)] md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">Lebenszyklus</p>
        <Badge tone={toneFor(event.decision)}>{decisionLabel[event.decision]}</Badge>
      </div>
      <h3 className="mt-4 text-lg font-medium text-fg">{event.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{event.detail}</p>

      <ol className="mt-6 space-y-2">
        {lifecycle.map((label, i) => (
          <li
            key={label}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150",
              i <= phase ? "text-fg" : "text-subtle",
              i === phase && "bg-elevated",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                i < phase && "bg-success",
                i === phase && "bg-accent live-dot",
                i > phase && "bg-subtle/40",
              )}
            />
            <span className="flex-1">{label}</span>
            {i <= phase ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">ok</span>
            ) : null}
          </li>
        ))}
      </ol>

      <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <Item k="Ereignis-ID" v={event.id} />
        <Item k="Policy-ID" v={event.policy} />
        <Item k="Risiko" v={String(event.risk)} />
        <Item k="Akteur" v={event.actor} />
        <Item k="Aktion" v={event.action} />
        <Item k="Nachweis-Hash" v={event.hash} />
      </dl>
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md bg-elevated px-3 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">{k}</dt>
      <dd className="mt-1 truncate font-mono text-xs text-fg">{v}</dd>
    </div>
  );
}
