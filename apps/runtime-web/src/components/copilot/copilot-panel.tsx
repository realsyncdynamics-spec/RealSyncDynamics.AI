import { useState } from "react";
import { Eyebrow } from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import { copilotPrompts, copilotThread } from "@/data/simulation";
import { cn } from "@/lib/utils";

const answers: Record<string, { text: string; refs: string[] }> = {
  "Warum hat das System dieses Ereignis markiert?": {
    text: "Drei korrelierte Signale haben POL-AGENT-014 ausgelöst. Der Hauptbeitrag war ein Outbound-Tool-Call der Agent-Sitzung agt-7f2 an einen ungeprüften Zahlungsendpunkt. Nebenbeiträge: Cluster-Risiko 68 und eine Modell-Routing-Änderung noch im Hold. Entscheidung: HOLD — menschliche Freigabe vor Egress.",
    refs: ["EVT-18A92C", "POL-AGENT-014", "EVD-7f3a91c0e2b4"],
  },
  "Welche Policy-Version hat den Hold autorisiert?": {
    text: "POL-AGENT-014 v3.2, kompiliert am 14.08.2026. Scope: Agent-Egress an nicht gelistete Zahlungsdienstleister. Human-Gate ist verpflichtend; die Decision Engine darf nicht automatisch zulassen.",
    refs: ["POL-AGENT-014", "DEC-HOLD"],
  },
  "Welche Risikosignale haben beigetragen?": {
    text: "KI-Dimension 68, Sicherheit 61, Betrieb 38. Beiträge: ungeprüfter Endpunkt, Agent-Tool-Klasse, paralleler Modell-Routing-Hold. Datenschutz und Zuverlässigkeit waren nicht maßgeblich.",
    refs: ["RSK-0.72", "EVT-18A960"],
  },
  "Welcher Nachweis wurde versiegelt?": {
    text: "EVD-7f3a91c0e2b4 bindet Ereignis, Policy v3.2, Risiko-Snapshot 72, Akteur runtime.decision, Aktion APPROVAL-GATE, Zeitstempel 09:41:05.182Z. Der Hash ist inhaltsadressiert über diese Felder.",
    refs: ["EVD-7f3a91c0e2b4", "EVT-18A92C"],
  },
};

export function CopilotPanel() {
  const [q, setQ] = useState(copilotPrompts[0]);
  const a = answers[q];

  return (
    <section id="copilot" className="px-5 py-20 md:px-8 md:py-28 lg:px-12">
      <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-2">
        <div>
          <Eyebrow>Operator-Copilot</Eyebrow>
          <h2 className="text-3xl font-medium tracking-[-0.03em] text-fg md:text-4xl">
            RealSync Copilot
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Ein nachweisgestützter Betriebsassistent — kein generischer Chatbot. Antworten zitieren
            Ereignis-, Policy- und Nachweis-IDs aus der Runtime.
          </p>
          <img
            src="/images/console.jpg"
            alt="Betriebskonsole"
            width={1792}
            height={1008}
            loading="lazy"
            className="mt-8 aspect-16/9 w-full rounded-xl object-cover shadow-[0_0_0_1px_rgba(238,234,226,0.08)]"
          />
        </div>
        <div className="rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgba(238,234,226,0.08)] md:p-6">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">
              Copilot · Beispielmandant
            </p>
            <Badge tone="accent">Nachweisgebunden</Badge>
          </div>
          <div className="mt-5 space-y-4">
            <div className="ml-8 rounded-lg rounded-tr-sm bg-elevated px-4 py-3 text-sm text-fg">
              {copilotThread[0].text}
            </div>
            <div className="mr-4 rounded-lg rounded-tl-sm bg-panel px-4 py-3 text-sm leading-relaxed text-fg/90 shadow-[0_0_0_1px_rgba(238,234,226,0.08)]">
              {a.text}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {a.refs.map((r) => (
                  <span
                    key={r}
                    className="font-mono text-[10px] text-accent shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-accent)_30%,transparent)] rounded-sm px-1.5 py-0.5"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {copilotPrompts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setQ(p)}
                className={cn(
                  "rounded-sm px-2.5 py-1.5 text-left text-xs transition-colors duration-150",
                  q === p
                    ? "bg-fg text-bg"
                    : "text-muted shadow-[0_0_0_1px_rgba(238,234,226,0.12)] hover:text-fg",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
