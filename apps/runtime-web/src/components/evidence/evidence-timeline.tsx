import { useState } from "react";
import { Eyebrow } from "@/components/layout/section";
import { evidenceChain } from "@/data/simulation";
import { cn } from "@/lib/utils";

export function EvidenceTimeline() {
  const [open, setOpen] = useState(evidenceChain.length - 1);
  const item = evidenceChain[open];

  return (
    <section id="evidence" className="px-5 py-20 md:px-8 md:py-28 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <Eyebrow>Evidence Engine</Eyebrow>
        <h2 className="text-3xl font-medium tracking-[-0.03em] text-fg md:text-4xl">
          Jede Entscheidung hinterlässt Nachweis.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          Unveränderlich wirkende Ereignisleiste. Beispieldatensatz zum Agent-Egress-Hold EVT-18A92C.
        </p>
        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <ol className="relative space-y-0 border-l border-border pl-6">
            {evidenceChain.map((e, i) => (
              <li key={e.id} className="relative pb-8 last:pb-0">
                <button
                  type="button"
                  onClick={() => setOpen(i)}
                  onMouseEnter={() => setOpen(i)}
                  className="block w-full text-left"
                >
                  <span
                    className={cn(
                      "absolute -left-[29px] top-1.5 size-2.5 rounded-full",
                      i === open ? "bg-accent" : "bg-subtle",
                    )}
                  />
                  <p className="font-mono text-[11px] tabular-nums text-subtle">{e.time}</p>
                  <p className={cn("mt-1 text-sm", i === open ? "text-fg" : "text-muted")}>
                    {e.label}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-subtle">{e.id}</p>
                </button>
              </li>
            ))}
          </ol>
          <aside className="h-fit rounded-xl bg-surface p-6 shadow-[0_0_0_1px_rgba(238,234,226,0.08)]">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Datensatz</p>
            <dl className="mt-4 space-y-3 text-sm">
              <Row k="Ereignis-ID" v="EVT-18A92C" />
              <Row k="Policy-ID" v="POL-AGENT-014" />
              <Row k="Entscheidung" v="HOLD" />
              <Row k="Risiko" v="72" />
              <Row k="Akteur" v="runtime.decision" />
              <Row k="Zeitstempel" v="09:41:05.182Z" />
              <Row k="Nachweis-Hash" v="7f3a91c0e2b4…d91" />
              <Row k="Fokus" v={item.label} />
            </dl>
          </aside>
        </div>
      </div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3 last:border-0">
      <dt className="text-muted">{k}</dt>
      <dd className="font-mono text-xs text-fg">{v}</dd>
    </div>
  );
}
