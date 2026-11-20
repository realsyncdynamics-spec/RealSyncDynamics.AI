/**
 * Governance-Browser Werkzeugverzeichnis, additive Oberfläche des bestehenden
 * REA-Workspace. Kein zweiter AI-Gateway-, Berechtigungs- oder Billing-Pfad.
 *
 * "implementiert" heißt: ein vorhandener Code-Einstieg ist nachgewiesen,
 * NICHT: eine produktive E2E-Abnahme. "zu_pruefen": Route vorhanden, Funktion
 * oder Betriebsfreigabe offen. "geplant": nicht ausführbar, keine Fake-Aktion.
 */
export type WorkspaceToolState = 'implementiert' | 'zu_pruefen' | 'geplant';
export type WorkspaceToolAction = 'chat' | 'build' | 'route' | 'none';
export type WorkspaceToolGroup = 'direktzugriff' | 'ki-werkzeuge' | 'realsync-module';
export type WorkspaceToolId =
  | 'chat' | 'documents' | 'slides' | 'tables' | 'image' | 'video'
  | 'translation' | 'agents' | 'app-builder' | 'voice'
  | 'governance' | 'evidence' | 'audit';

export interface WorkspaceToolDefinition {
  id: WorkspaceToolId;
  label: string;
  description: string;
  group: WorkspaceToolGroup;
  state: WorkspaceToolState;
  action: WorkspaceToolAction;
  href?: string;
}

export const WORKSPACE_TOOLS: readonly WorkspaceToolDefinition[] = [
  {
    id: 'chat', label: 'KI-Chat',
    description: 'Vorhandenen Governance-Chat und REA-Prüfpfad nutzen.',
    group: 'ki-werkzeuge', state: 'implementiert', action: 'chat',
  },
  {
    id: 'documents', label: 'KI-Dokumente',
    description: 'Vorhandene Governance-Dokumente öffnen; kein allgemeiner KI-Editor.',
    group: 'ki-werkzeuge', state: 'zu_pruefen', action: 'route', href: '/app/documents',
  },
  {
    id: 'slides', label: 'KI-Folien',
    description: 'Universeller Folieneditor ist noch nicht implementiert.',
    group: 'ki-werkzeuge', state: 'geplant', action: 'none',
  },
  {
    id: 'tables', label: 'KI-Tabellen',
    description: 'Tabelleneditor noch nicht vorhanden; CSV-Exporte sind separat.',
    group: 'ki-werkzeuge', state: 'geplant', action: 'none',
  },
  {
    id: 'image', label: 'KI-Bild',
    description: 'Media-Studio-Entwürfe nicht gemergt; keine Generierung freigegeben.',
    group: 'ki-werkzeuge', state: 'geplant', action: 'none',
  },
  {
    id: 'video', label: 'KI-Video',
    description: 'Video-Provider und Job-/Budget-Gates benötigen eigene Abnahme.',
    group: 'ki-werkzeuge', state: 'geplant', action: 'none',
  },
  {
    id: 'translation', label: 'Übersetzungs-Hub',
    description: 'Noch kein eigener, tenant-gebundener Übersetzungsworkflow.',
    group: 'ki-werkzeuge', state: 'geplant', action: 'none',
  },
  {
    id: 'agents', label: 'Alle Agenten',
    description: 'Vorhandenes Agenten-Center öffnen; Runtime gesondert prüfen.',
    group: 'ki-werkzeuge', state: 'zu_pruefen', action: 'route', href: '/app/agents',
  },
  {
    id: 'app-builder', label: 'App-Builder',
    description: 'Vorhandenen Build-Modus nutzen; Freigaben bleiben beim Builder.',
    group: 'realsync-module', state: 'zu_pruefen', action: 'build',
  },
  {
    id: 'voice', label: 'Voice-Bot',
    description: 'Persönlicher Telefon- und Sprachassistent. Vorhandenes Voice-Modul; Live-Audio nicht abgenommen.',
    group: 'direktzugriff', state: 'zu_pruefen', action: 'route', href: '/app/voice',
  },
  {
    id: 'governance', label: 'Governance OS',
    description: 'Zentrale Governance-Control-Plane mit Risiko-, Audit- und Evidence-Einstiegen.',
    group: 'direktzugriff', state: 'implementiert', action: 'route', href: '/app/dashboard',
  },
  {
    id: 'evidence', label: 'Evidence',
    description: 'Bestehenden Evidenzbereich öffnen.',
    group: 'realsync-module', state: 'implementiert', action: 'route', href: '/app/evidence',
  },
  {
    id: 'audit', label: 'Audits & Scans',
    description: 'Vorhandene Scans und Prüfungen öffnen.',
    group: 'realsync-module', state: 'implementiert', action: 'route', href: '/app/scans',
  },
];

export function isWorkspaceToolRunnable(tool: WorkspaceToolDefinition): boolean {
  if (tool.state === 'geplant') return false;
  if (tool.action === 'chat' || tool.action === 'build') return true;
  return tool.action === 'route' && typeof tool.href === 'string' && tool.href.startsWith('/');
}

export function workspaceToolsFor(group: WorkspaceToolGroup): WorkspaceToolDefinition[] {
  return WORKSPACE_TOOLS.filter((tool) => tool.group === group);
}
