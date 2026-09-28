// Fachlicher Fokus je Assistent-Agent (Agent-Auswahl im GovernanceChatSidebar).
//
// Der Client schickt nur eine ID; der Text kommt ausschließlich von hier.
// Unbekannte IDs werden ignoriert (kein Freitext in den System-Prompt).
// Die ID-Liste muss zu GOVERNANCE_AGENTS in
// src/components/governance-os/governanceAgents.ts passen — Test:
// test/features/governance/agent-focus.test.ts.

export const AGENT_FOCUS: Readonly<Record<string, { label: string; focus: string }>> = {
  dsgvo: {
    label: 'DSGVO Agent',
    focus: 'Datenschutz nach DSGVO: Rechtsgrundlagen (Art. 6/9), Betroffenenrechte, Informationspflichten, Auftragsverarbeitung und Rechenschaftspflicht.',
  },
  'ai-act': {
    label: 'AI Act Agent',
    focus: 'EU AI Act: Risikoklassifizierung der KI-Systeme (verboten, hoch, begrenzt, minimal), Pflichten je Rolle (Anbieter/Betreiber), Transparenz nach Art. 50 und Fristen.',
  },
  evidence: {
    label: 'Evidence Agent',
    focus: 'Nachweise: welche Evidenz vorhanden ist, welche fehlt, Hash-/Integritätsstatus und welche Controls damit belegt sind.',
  },
  risk: {
    label: 'Risk Agent',
    focus: 'Risikobewertung: Risk-Scores, Hochrisiko-Systeme, offene Findings und priorisierte Maßnahmen nach Eintrittswahrscheinlichkeit und Schaden.',
  },
  cookie: {
    label: 'Cookie Agent',
    focus: 'Cookies und Einwilligung nach TDDDG § 25 und DSGVO: Cookie-Banner, technisch notwendige vs. einwilligungspflichtige Cookies, Speicherdauer.',
  },
  tracking: {
    label: 'Tracking Agent',
    focus: 'Tracking und Analytics: Pixel, Tag-Manager, Server-Side-Tracking, Einwilligungspflicht und Datenflüsse an Dritte.',
  },
  website: {
    label: 'Website Agent',
    focus: 'Website-Compliance: Impressum, Datenschutzerklärung, eingebundene Drittanbieter, Formulare und Scan-Ergebnisse der Domains.',
  },
  avv: {
    label: 'AVV Agent',
    focus: 'Auftragsverarbeitungsverträge nach Art. 28 DSGVO: Vendoren, fehlende oder veraltete AVVs, Subunternehmer und Mindestinhalte.',
  },
  tom: {
    label: 'TOM Agent',
    focus: 'Technische und organisatorische Maßnahmen nach Art. 32 DSGVO: Zugriffskontrolle, Verschlüsselung, Backups, Protokollierung und deren Nachweis.',
  },
  vvz: {
    label: 'VVZ Agent',
    focus: 'Verzeichnis von Verarbeitungstätigkeiten nach Art. 30 DSGVO: Vollständigkeit, Zwecke, Kategorien, Empfänger und Löschfristen.',
  },
  incident: {
    label: 'Incident Agent',
    focus: 'Sicherheits- und Datenschutzvorfälle: Meldepflichten (72 h nach Art. 33 DSGVO, NIS2-Fristen), Bewertung, Dokumentation und offene Incidents.',
  },
  audit: {
    label: 'Audit Agent',
    focus: 'Audit-Vorbereitung: Prüfpfad, Control-Abdeckung je Rahmenwerk, Lücken und was ein Prüfer als Nächstes anfordern würde.',
  },
  'security-header': {
    label: 'Security Header Agent',
    focus: 'HTTP-Security-Header: CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy — Befund, Risiko und konkrete Header-Werte.',
  },
  'third-country': {
    label: 'Third Country Transfer Agent',
    focus: 'Drittlandtransfers nach Kapitel V DSGVO: US-/Nicht-EU-Anbieter, Angemessenheitsbeschlüsse, SCCs, TIA und EU-Alternativen.',
  },
  consent: {
    label: 'Consent Agent',
    focus: 'Einwilligungsmanagement: Consent-Nachweise, Widerruf, Granularität, Dark Patterns und Abgleich mit tatsächlich geladenen Diensten.',
  },
};

export const AGENT_FOCUS_IDS: readonly string[] = Object.keys(AGENT_FOCUS);

/**
 * Zusätzlicher System-Block für den gewählten Agenten — `null` bei fehlender
 * oder unbekannter ID (dann gilt der Standard-Prompt unverändert).
 */
export function agentFocusPrompt(agent: unknown): string | null {
  if (typeof agent !== 'string' || !Object.hasOwn(AGENT_FOCUS, agent)) return null;
  const { label, focus } = AGENT_FOCUS[agent];
  return `AKTIVER AGENT: ${label}
Der Nutzer hat im Assistenten den ${label} gewählt. Beantworte die Anfrage mit diesem fachlichen Schwerpunkt: ${focus}
Bleibe bei allen übrigen Regeln (Tools, keine Rechtsberatung, Mandantengrenzen). Gehört eine Frage klar in ein anderes Fachgebiet, beantworte sie trotzdem und weise kurz darauf hin.`;
}
