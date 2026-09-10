export type SimEvent = {
  id: string;
  time: string;
  source: "KI" | "Industrie" | "Software";
  title: string;
  detail: string;
  policy: string;
  risk: number;
  decision: "allow" | "hold" | "escalate";
  action: string;
  actor: string;
  hash: string;
};

export const simEvents: SimEvent[] = [
  {
    id: "EVT-18A92C",
    time: "09:41:02",
    source: "KI",
    title: "KI-Agent hat externen API-Aufruf ausgelöst",
    detail: "Agent-Sitzung agt-7f2 hat einen Outbound-Tool-Call an einen Drittanbieter-Zahlungsendpunkt angefordert.",
    policy: "POL-AGENT-014",
    risk: 72,
    decision: "hold",
    action: "Menschliche Freigabe vor Egress verlangen",
    actor: "runtime.decision",
    hash: "7f3a91c0e2b4",
  },
  {
    id: "EVT-18A93D",
    time: "09:41:11",
    source: "Industrie",
    title: "Industriesensor: Abweichung erkannt",
    detail: "Ofenlinie 3, Sensor T-204: Temperaturabweichung 2,4σ gegenüber rollierender Baseline.",
    policy: "POL-QUAL-008",
    risk: 54,
    decision: "escalate",
    action: "Operator-Incident öffnen, Linie unter Beobachtung halten",
    actor: "edge.linie-3",
    hash: "c91e04aa17d8",
  },
  {
    id: "EVT-18A94E",
    time: "09:41:18",
    source: "Software",
    title: "Software-Deployment eingeleitet",
    detail: "Produktions-Promotion für Dienst billing-api@2.14.0 aus Staging angefordert.",
    policy: "POL-REL-021",
    risk: 33,
    decision: "allow",
    action: "Promotion zulassen, Nachweis an das Release hängen",
    actor: "ci.github",
    hash: "a10bb8e55c02",
  },
  {
    id: "EVT-18A95F",
    time: "09:41:24",
    source: "Software",
    title: "Policy-Auswertung ausgelöst",
    detail: "Änderung der Modell-Routing-Konfiguration traf den Scope eines Hochrisiko-KI-Systems.",
    policy: "POL-AIACT-003",
    risk: 61,
    decision: "hold",
    action: "Config-Apply sperren bis zur Konformitätsprüfung",
    actor: "runtime.policy",
    hash: "e2d77190ab3c",
  },
  {
    id: "EVT-18A960",
    time: "09:41:31",
    source: "KI",
    title: "Risiko-Score neu berechnet",
    detail: "Drei korrelierte Signale haben das Agent-Egress-Cluster-Risiko im Mandanten angehoben.",
    policy: "POL-RISK-041",
    risk: 68,
    decision: "escalate",
    action: "Cluster-Watch anheben, Security-On-Call benachrichtigen",
    actor: "runtime.risk",
    hash: "19cc40fe8d77",
  },
];

export const lifecycle = [
  "Ereignis erkannt",
  "Policy-Treffer",
  "Risikobewertung",
  "Entscheidung",
  "Aktion",
  "Nachweis erzeugt",
];

export const evidenceChain = [
  { time: "09:41:02", label: "Ereignis erkannt", id: "EVT-18A92C" },
  { time: "09:41:03", label: "Policy ausgewertet", id: "POL-AGENT-014" },
  { time: "09:41:03", label: "Risiko berechnet", id: "RSK-0.72" },
  { time: "09:41:04", label: "Entscheidung autorisiert", id: "DEC-HOLD" },
  { time: "09:41:04", label: "Aktion ausgeführt", id: "ACT-APPROVAL-GATE" },
  { time: "09:41:05", label: "Nachweis versiegelt", id: "EVD-7f3a91c0e2b4" },
];

export const dashboardKpis = [
  { label: "Systemstatus", value: "Betriebsbereit", tone: "success" as const },
  { label: "Aktive Ereignisse", value: "27", tone: "neutral" as const },
  { label: "Hohes Risiko", value: "2", tone: "warning" as const },
  { label: "Policy-Verstöße", value: "4", tone: "critical" as const },
  { label: "Nachweisereignisse", value: "18.421", tone: "neutral" as const },
  { label: "Angebundene Systeme", value: "43", tone: "neutral" as const },
];

export const copilotThread = [
  {
    role: "user" as const,
    text: "Warum hat das System dieses Ereignis markiert?",
  },
  {
    role: "copilot" as const,
    text: "Drei korrelierte Signale haben POL-AGENT-014 ausgelöst. Der Hauptbeitrag war ein Outbound-Tool-Call der Agent-Sitzung agt-7f2 an einen ungeprüften Zahlungsendpunkt. Nebenbeiträge: Cluster-Risiko 68 und eine Modell-Routing-Änderung noch im Hold. Entscheidung: HOLD — menschliche Freigabe vor Egress.",
    refs: ["EVT-18A92C", "POL-AGENT-014", "EVD-7f3a91c0e2b4"],
  },
];

export const copilotPrompts = [
  "Warum hat das System dieses Ereignis markiert?",
  "Welche Policy-Version hat den Hold autorisiert?",
  "Welche Risikosignale haben beigetragen?",
  "Welcher Nachweis wurde versiegelt?",
];

export const decisionLabel: Record<SimEvent["decision"], string> = {
  allow: "zulassen",
  hold: "halten",
  escalate: "eskalieren",
};
