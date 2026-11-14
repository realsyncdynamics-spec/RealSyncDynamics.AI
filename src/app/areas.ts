/**
 * Die acht Bereiche der App-Navigation.
 * Alles, was keiner dieser Flächen zugeordnet ist, bleibt über den Pfad
 * erreichbar und steht hinter einer Feature-Flagge statt in der Sidebar.
 */
export const APP_AREAS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    home: '/app/dashboard',
    description: 'Überblick über den Arbeitsbereich.',
  },
  {
    id: 'ai-studio',
    label: 'AI Studio',
    home: '/app/ai-systems',
    description: 'KI-Systeme, Assistent und lokale Modelle.',
  },
  {
    id: 'agent-studio',
    label: 'Agent Studio',
    home: '/app/agents',
    description: 'Agenten, Bots und Voice.',
  },
  {
    id: 'website-builder',
    label: 'Website Builder',
    home: '/app/siteos',
    description: 'SiteOS und Website-Betrieb.',
  },
  {
    id: 'automationen',
    label: 'Automationen',
    home: '/app/automations',
    description: 'Abläufe, Zeitpläne und Sammelläufe.',
  },
  {
    id: 'governance',
    label: 'Governance',
    home: '/app/compliance',
    description: 'Nachweise, Policies, Risiken und Prüfpfade.',
  },
  {
    id: 'abrechnung',
    label: 'Abrechnung',
    home: '/app/billing',
    description: 'Plan und Kosten des Mandanten.',
  },
  {
    id: 'einstellungen',
    label: 'Einstellungen',
    home: '/app/settings',
    description: 'Arbeitsbereich, Team und Konto.',
  },
] as const;

export type AppAreaId = (typeof APP_AREAS)[number]['id'];

export function areaById(id: AppAreaId) {
  const area = APP_AREAS.find((item) => item.id === id);
  if (!area) throw new Error(`Unbekannter Bereich: ${id}`);
  return area;
}
