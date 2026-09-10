export type RuntimeLayer = {
  id: string;
  label: string;
  summary: string;
  detail: string;
  signals: string[];
};

export const runtimeLayers: RuntimeLayer[] = [
  {
    id: "systems",
    label: "Systeme",
    summary: "KI, Agenten, Software und industrielle Assets als erstklassige Quellen.",
    detail:
      "Heterogene Umgebungen — Model Serving, Agent-Runtimes, CI/CD, APIs, SPS, SCADA, MES und Sensoren — erscheinen als gesteuerte Systeme. RealSync Runtime ersetzt sie nicht. Sie beobachtet sie.",
    signals: ["KI-Workloads", "Agent-Sitzungen", "Deployments", "Maschinentelemetrie"],
  },
  {
    id: "connectors",
    label: "Konnektoren",
    summary: "Systeme anbinden, die Sie bereits betreiben — ohne Rip-and-Replace.",
    detail:
      "Konnektoren normalisieren eingehende Ereignisse und ausgehende Aktionen. Verfügbare Adapter, angekündigte Industrieprotokolle und Custom Connectors teilen einen Vertrag: typisierte Events, Identität, Nachweis-Handle.",
    signals: ["API", "SDK", "Webhooks", "Edge-Ingest"],
  },
  {
    id: "events",
    label: "Ereignisschicht",
    summary: "Eine Ereignisfläche über digitale und physische Operationen.",
    detail:
      "Jedes Signal ist ein Ereignis mit Quelle, Akteur, Payload, Zeitstempel und Herkunft. Korrelation geschieht hier — ein Agent-API-Aufruf, eine Sensorabweichung und ein Deployment können ein Incident werden.",
    signals: ["Ingest", "Normieren", "Korrelieren", "Dedupe"],
  },
  {
    id: "policy",
    label: "Policy Engine",
    summary: "Regeln werden ausführbare Controls, keine Dokumente im Regal.",
    detail:
      "Interne Policy, Pflichten aus der KI-Verordnung, DSGVO-Grenzen und Branchenregeln kompilieren zu maschinenlesbaren Controls. Auswertung ist deterministisch, versioniert und zurechenbar.",
    signals: ["Treffer", "Version", "Scope", "Ausnahme"],
  },
  {
    id: "risk",
    label: "Risk Engine",
    summary: "Risiko ist ein lebender Systemzustand, kein Quartalsbericht.",
    detail:
      "Dimensionen Betrieb, Sicherheit, Datenschutz, KI, Compliance und Zuverlässigkeit aktualisieren sich mit jedem Ereignis. Scores erklären sich über beitragende Signale.",
    signals: ["Score", "Trend", "Beiträger", "Schwellen"],
  },
  {
    id: "decision",
    label: "Decision Engine",
    summary: "Gesteuerte Entscheidungen — mit menschlicher Freigabe, wenn Policy das verlangt.",
    detail:
      "Zulassen, ablehnen, drosseln, eskalieren oder Freigabe anfordern. Entscheidungen binden Policy-Version, Risiko-Snapshot und Akteur, damit sie rekonstruierbar bleiben.",
    signals: ["Zulassen", "Ablehnen", "Eskalieren", "Freigeben"],
  },
  {
    id: "control",
    label: "Control / Aktion",
    summary: "Nur ausführen, was autorisiert ist. Nichts sonst.",
    detail:
      "Aktionen verlassen dieselbe Control Plane, die sie bewertet hat. Automation ist begrenzt. Die Runtime beansprucht keine sicherheitszertifizierte Anlagensteuerung.",
    signals: ["Aktuieren", "Melden", "Quarantäne", "Halten"],
  },
  {
    id: "evidence",
    label: "Nachweis",
    summary: "Jede Entscheidung hinterlässt einen versiegelten, hash-verketteten Datensatz.",
    detail:
      "Ereignis, Policy, Risiko, Entscheidung, Akteur und Aktion werden zu einem Nachweisobjekt mit Content-Hash. Der Audit-Graph ist das Produkt — kein Log-Export hinterher.",
    signals: ["Versiegeln", "Hash", "Herkunft", "Export"],
  },
  {
    id: "learning",
    label: "Lernen",
    summary: "Ergebnisse speisen den nächsten Beobachtungszyklus, ohne stille Policy-Drift.",
    detail:
      "Die Runtime lernt, welche Controls gegriffen haben, welche Ausnahmen gewährt wurden und welche Ergebnisse folgten. Policy-Änderung bleibt ein gesteuerter Akt, nie ein implizites Modell-Update.",
    signals: ["Ergebnis", "Drift-Wächter", "Nachjustieren", "Retrain-Antrag"],
  },
];

export const controlLoop = [
  { id: "observe", label: "Beobachten", copy: "Ereignisse aus jedem angebundenen System aufnehmen." },
  { id: "understand", label: "Verstehen", copy: "Operativen Kontext aus korrelierten Signalen aufbauen." },
  { id: "assess", label: "Bewerten", copy: "Policy-Treffer und lebendes Risiko auswerten." },
  { id: "decide", label: "Entscheiden", copy: "Ein autorisiertes Ergebnis wählen." },
  { id: "authorize", label: "Freigabe", copy: "Akteur, Scope und menschliche Gates bestätigen." },
  { id: "act", label: "Handeln", copy: "Die begrenzte Aktion ausführen." },
  { id: "verify", label: "Prüfen", copy: "Bestätigen, dass sich die Welt wie vorgesehen bewegt hat." },
  { id: "evidence", label: "Nachweis", copy: "Kette versiegeln. Datensatz hashen." },
  { id: "learn", label: "Lernen", copy: "Ergebnisse zurück in die Beobachtung speisen." },
];

export const engines = [
  {
    id: "event",
    name: "Event Engine",
    copy: "Hochdurchsatz-Ingest und Korrelation über KI-, Software- und Industriequellen.",
  },
  {
    id: "policy",
    name: "Policy Engine",
    copy: "Versionierte, gescopte, maschinenlesbare Controls aus internen und regulatorischen Regeln.",
  },
  {
    id: "risk",
    name: "Risk Engine",
    copy: "Kontinuierliches, mehrdimensionales Scoring mit erklärbaren Signalen.",
  },
  {
    id: "decision",
    name: "Decision Engine",
    copy: "Deterministische, gesteuerte Entscheidung — optional mit menschlicher Autorisierung.",
  },
  {
    id: "control",
    name: "Control Engine",
    copy: "Begrenzte Aktuierung und Workflow-Ausführung — niemals ungebundene Automation.",
  },
  {
    id: "evidence",
    name: "Evidence Engine",
    copy: "Hash-verketteter Audit-Graph: Ereignis → Policy → Risiko → Entscheidung → Aktion.",
  },
  {
    id: "automation",
    name: "Automation Engine",
    copy: "Kontrollierte Automationen, die Policy, Risiko und Nachweis bei jedem Lauf erben.",
  },
];
