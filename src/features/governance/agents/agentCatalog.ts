/**
 * Agent-/Bot-Katalog — die eine Register-Quelle für die UI.
 *
 * Genutzt von `AgentRegistryView` (/app/ai-systems/agents), der öffentlichen
 * Vorschau `/governance-browser` und später dem Command Center (WP4).
 *
 * Reifegrad-Regel: Kein Eintrag setzt `maturity` selbst.
 * - Mesh-Agenten übernehmen Reifegrad und `runnable` aus `AGENT_MESH`.
 * - Übrige Einträge übernehmen den Reifegrad aus `implementation-status.ts`
 *   und sind im Register nicht ausführbar.
 * - Ohne belegte Quelle: `coming-soon`, nicht ausführbar.
 */
import { AGENT_MESH, type MeshAgentId } from '../../../core/realsync-os/agentMesh';
import { getImplementation, type ImplementationStatus } from '../../../product/implementation-status';
import type { GovernedAgentEntry } from './types';

/** Verbote, die für Browser- und Builder-Agenten nie aufgehoben werden. */
export const HARD_FORBIDDEN_WEB_ACTIONS = [
  'publish_without_approval',
  'submit_forms',
  'trigger_purchase',
  'transfer_customer_data',
] as const;

type StatusSource =
  | { mesh: MeshAgentId }
  | { implementation: string }
  | null;

type CatalogSeed = Omit<GovernedAgentEntry, 'maturity' | 'runnable' | 'statusSource'> & {
  source: StatusSource;
};

function resolveStatus(source: StatusSource): Pick<GovernedAgentEntry, 'maturity' | 'runnable' | 'statusSource'> {
  if (source && 'mesh' in source) {
    const mesh = AGENT_MESH.find((a) => a.id === source.mesh);
    if (mesh) return { maturity: mesh.maturity, runnable: mesh.runnable, statusSource: `agentMesh:${mesh.id}` };
  }
  if (source && 'implementation' in source) {
    const item = getImplementation(source.implementation);
    if (item) {
      return { maturity: item.status, runnable: false, statusSource: `implementation-status:${item.id}` };
    }
  }
  return { maturity: 'coming-soon', runnable: false, statusSource: 'none' };
}

const SEEDS: readonly CatalogSeed[] = [
  {
    id: 'compliance-agent',
    kind: 'agent',
    agentType: 'compliance',
    name: 'Compliance Agent',
    owner: 'governance.owner',
    purpose: 'Prüft Websites und KI-Einsätze gegen DSGVO und EU AI Act und bereitet Befunde mit Nachweisen auf.',
    dataAccess: ['Website-/Trackingdaten', 'KI-Inventar', 'Policy-Packs'],
    allowedActions: ['scan_ausfuehren', 'befund_erstellen', 'massnahme_vorschlagen', 'evidence_schreiben'],
    forbiddenActions: ['rechtsfreigabe_erteilen', 'an_behoerde_melden', 'policy_publizieren', 'kundendaten_uebertragen'],
    reviewMode: 'on_risk',
    reviewPoints: ['Einstufung high_risk oder prohibited', 'Maßnahme mit Außenwirkung'],
    riskLevel: 'medium',
    evidenceRequirement: 'on_decision',
    source: { mesh: 'compliance' },
  },
  {
    id: 'evidence-agent',
    kind: 'agent',
    agentType: 'evidence',
    name: 'Evidence Agent',
    owner: 'governance.owner',
    purpose: 'Bündelt Nachweise zu Prüfpaketen und hält den Prüfpfad vollständig.',
    dataAccess: ['Evidence Vault', 'Audit-Log'],
    allowedActions: ['evidence_lesen', 'evidence_buendeln', 'luecke_melden'],
    forbiddenActions: ['evidence_aendern', 'evidence_loeschen', 'export_an_dritte_ohne_freigabe'],
    reviewMode: 'on_risk',
    reviewPoints: ['Export an externe Dritte'],
    riskLevel: 'low',
    evidenceRequirement: 'every_action',
    source: { mesh: 'evidence' },
  },
  {
    id: 'security-agent',
    kind: 'agent',
    agentType: 'security',
    name: 'Security Agent',
    owner: 'security.owner',
    purpose: 'Sammelt Security-Findings und prüft Freigabe-Gates vor Änderungen.',
    dataAccess: ['Security-Findings', 'Konfigurations-Metadaten'],
    allowedActions: ['finding_erfassen', 'gate_pruefen', 'massnahme_vorschlagen'],
    forbiddenActions: ['gate_uebersteuern', 'secrets_lesen', 'deploy_ausloesen'],
    reviewMode: 'always',
    reviewPoints: ['Jede vorgeschlagene Änderung'],
    riskLevel: 'high',
    evidenceRequirement: 'every_action',
    source: { mesh: 'security' },
  },
  {
    id: 'onboarding-agent',
    kind: 'agent',
    agentType: 'onboarding',
    name: 'Onboarding Agent',
    owner: 'governance.owner',
    purpose: 'Führt neue Mandanten durch die Governance Activation und schlägt nächste Schritte vor.',
    dataAccess: ['Organisationsprofil', 'Activation-Angaben'],
    allowedActions: ['schritt_vorschlagen', 'angaben_zusammenfassen'],
    forbiddenActions: ['tarif_aendern', 'rolle_vergeben', 'kundendaten_uebertragen'],
    reviewMode: 'on_risk',
    reviewPoints: ['Änderung an Rollen oder Tarif'],
    riskLevel: 'low',
    evidenceRequirement: 'on_decision',
    source: { mesh: 'onboarding' },
  },
  {
    id: 'website-chatbot',
    kind: 'bot',
    agentType: 'website_chat',
    name: 'Website Chatbot',
    owner: 'channel.owner',
    purpose: 'Beantwortet Fragen auf der eigenen Website mit Transparenzhinweis und Antwort-Logging.',
    dataAccess: ['Freigegebene Wissensbasis', 'Gesprächsverlauf'],
    allowedActions: ['frage_beantworten', 'an_mensch_uebergeben', 'termin_vorschlagen'],
    forbiddenActions: ['rechtsberatung_erteilen', 'kundendaten_uebertragen', 'zahlung_ausloesen'],
    reviewMode: 'on_risk',
    reviewPoints: ['Anfrage mit Gesundheits- oder Zahlungsdaten', 'Beschwerde'],
    riskLevel: 'medium',
    evidenceRequirement: 'every_action',
    source: { implementation: 'channel-bots' },
  },
  {
    id: 'voice-bot',
    kind: 'bot',
    agentType: 'voice',
    name: 'Voice Bot',
    owner: 'channel.owner',
    purpose: 'Nimmt Anrufe entgegen, beantwortet Standardfragen und übergibt an Menschen.',
    dataAccess: ['Freigegebene Wissensbasis', 'Anruf-Transkript'],
    allowedActions: ['frage_beantworten', 'an_mensch_uebergeben', 'rueckruf_anlegen'],
    forbiddenActions: ['aufzeichnung_ohne_hinweis', 'kundendaten_uebertragen', 'zahlung_ausloesen'],
    reviewMode: 'on_risk',
    reviewPoints: ['Anrufer widerspricht Aufzeichnung', 'Beschwerde'],
    riskLevel: 'medium',
    evidenceRequirement: 'every_action',
    source: { implementation: 'channel-bots' },
  },
  {
    id: 'whatsapp-bot',
    kind: 'bot',
    agentType: 'whatsapp',
    name: 'WhatsApp Bot',
    owner: 'channel.owner',
    purpose: 'Beantwortet WhatsApp-Business-Anfragen mit demselben Governance-Protokoll wie die Website.',
    dataAccess: ['Freigegebene Wissensbasis', 'Nachrichtenverlauf'],
    allowedActions: ['frage_beantworten', 'an_mensch_uebergeben'],
    forbiddenActions: ['werbung_ohne_einwilligung', 'kundendaten_uebertragen', 'zahlung_ausloesen'],
    reviewMode: 'on_risk',
    reviewPoints: ['Anfrage mit sensiblen Daten', 'Beschwerde'],
    riskLevel: 'medium',
    evidenceRequirement: 'every_action',
    source: { implementation: 'channel-bots' },
  },
  {
    id: 'browser-agent',
    kind: 'agent',
    agentType: 'browser',
    name: 'Browser Agent',
    owner: 'governance.owner',
    purpose: 'Analysiert Webseiten im Browser auf DSGVO- und AI-Act-Signale.',
    dataAccess: ['Aktuelle Seite (nur lesend)'],
    allowedActions: ['seite_analysieren', 'befund_erstellen'],
    forbiddenActions: [...HARD_FORBIDDEN_WEB_ACTIONS],
    reviewMode: 'always',
    reviewPoints: ['Jede Aktion außerhalb reinen Lesens'],
    riskLevel: 'high',
    evidenceRequirement: 'every_action',
    source: { implementation: 'agent-os-chrome-side-panel' },
  },
  {
    id: 'builder-agent',
    kind: 'agent',
    agentType: 'builder',
    name: 'Builder Agent',
    owner: 'site.owner',
    purpose: 'Entwirft Seiten und Inhalte im Studio; veröffentlicht nie ohne Publish Gate.',
    dataAccess: ['Seiteninhalte des Mandanten', 'Design-Vorgaben'],
    allowedActions: ['entwurf_erstellen', 'entwurf_aendern', 'vorschau_erzeugen'],
    forbiddenActions: [...HARD_FORBIDDEN_WEB_ACTIONS],
    reviewMode: 'always',
    reviewPoints: ['Vor jeder Veröffentlichung (Publish Gate)'],
    riskLevel: 'high',
    evidenceRequirement: 'every_action',
    source: { implementation: 'web-builder' },
  },
  {
    id: 'workflow-agent',
    kind: 'agent',
    agentType: 'workflow',
    name: 'Workflow Agent',
    owner: 'governance.owner',
    purpose: 'Verknüpft Skills zu mehrstufigen Governance-Abläufen mit Freigaben und Eskalation.',
    dataAccess: ['Workflow-Definitionen', 'Freigabe-Status'],
    allowedActions: ['schritt_ausfuehren', 'freigabe_anfordern', 'eskalieren'],
    forbiddenActions: ['freigabe_ueberspringen', 'policy_aendern', 'kundendaten_uebertragen'],
    reviewMode: 'on_risk',
    reviewPoints: ['Schritt mit Außenwirkung', 'Eskalation'],
    riskLevel: 'medium',
    evidenceRequirement: 'every_action',
    source: null,
  },
];

export const AGENT_CATALOG: readonly GovernedAgentEntry[] = SEEDS.map(({ source, ...seed }) => ({
  ...seed,
  ...resolveStatus(source),
}));

export function countByMaturity(
  entries: readonly GovernedAgentEntry[],
): Record<ImplementationStatus, number> {
  const counts: Record<ImplementationStatus, number> = { live: 0, preview: 0, 'coming-soon': 0 };
  for (const e of entries) counts[e.maturity] += 1;
  return counts;
}
