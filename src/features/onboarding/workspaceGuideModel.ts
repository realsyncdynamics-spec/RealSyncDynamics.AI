/**
 * RealSync Workspace Guide — same underlying app routes, no parallel onboarding.
 * Completion is self-reported. A checked step is NOT a verified backend release.
 */
export type WorkspaceFocus =
  | 'none' | 'governance' | 'voice' | 'builder' | 'creative' | 'landing' | 'optimizer';
export type WorkspaceStepId = 'profile' | 'team' | 'focus' | 'first-result' | 'review';

export interface WorkspaceGuideStep {
  id: WorkspaceStepId;
  title: string;
  detail: string;
  href: string | null;
  cta: string;
}

export interface WorkspaceFocusOption {
  id: Exclude<WorkspaceFocus, 'none'>;
  title: string;
  detail: string;
  href: string;
  status: 'implementiert' | 'zu prüfen';
}

export const FOCUS_OPTIONS: WorkspaceFocusOption[] = [
  { id: 'governance', title: 'Governance & Audit', detail: 'KI-Systeme, Risiken und Nachweise einrichten.', href: '/app/activation', status: 'implementiert' },
  { id: 'voice', title: 'Voice-Agent', detail: 'Bestehendes Voice-Backend und Angebotsweg prüfen.', href: '/app/voice', status: 'zu prüfen' },
  { id: 'builder', title: 'App-Builder', detail: 'Builder-Funktionen im Modulbereich prüfen.', href: '/app/modules', status: 'zu prüfen' },
  { id: 'creative', title: 'Bild & Video', detail: 'Verfügbare KI-Werkzeuge prüfen, keine automatische Freigabe.', href: '/tools', status: 'zu prüfen' },
  { id: 'landing', title: 'Landingpage-Designer', detail: 'Vorlagen und bestehende Werkzeuge prüfen.', href: '/app/modules', status: 'zu prüfen' },
  { id: 'optimizer', title: 'Cloud-Code-Optimizer', detail: 'Bestehenden Optimizer-Einstieg öffnen.', href: '/claude-code-optimizer', status: 'zu prüfen' },
];

export function workspaceGuideSteps(
  focus: WorkspaceFocus,
  canInvite: boolean,
): WorkspaceGuideStep[] {
  const selected = FOCUS_OPTIONS.find((x) => x.id === focus);
  const steps: WorkspaceGuideStep[] = [
    { id: 'profile', title: 'Arbeitsbereich einrichten', detail: 'Unternehmensdaten, Branche und Einstellungen prüfen.', href: '/app/company', cta: 'Firmenprofil öffnen' },
  ];
  if (canInvite) steps.push({
    id: 'team', title: 'Team einladen', detail: 'Mitglieder nur bei Bedarf einladen; Rollen über die bestehende Verwaltung vergeben.', href: '/tenant/invites', cta: 'Einladungen verwalten',
  });
  steps.push(
    { id: 'focus', title: 'Produkt auswählen', detail: 'Wähle aus, mit welchem RealSync-Modul du beginnen möchtest.', href: null, cta: 'Produkt wählen' },
    { id: 'first-result', title: 'Ersten Anwendungsfall starten', detail: selected
      ? 'Öffne den vorhandenen Einstieg für ' + selected.title + '. Funktionsbereitschaft gesondert prüfen.'
      : 'Wähle zuerst ein Produkt aus.', href: selected?.href ?? null, cta: selected ? 'Modul öffnen' : 'Produkt wählen' },
    { id: 'review', title: 'Einrichtung überprüfen', detail: 'Rechte, Datenschutz und echte Ergebnisse kontrollieren. Ein Haken ist keine technische Abnahme.', href: '/app/dashboard', cta: 'Dashboard prüfen' },
  );
  return steps;
}

export function workspaceGuideProgress(
  steps: WorkspaceGuideStep[], completed: string[],
): { done: number; total: number; percent: number } {
  const valid = new Set(steps.map((step) => step.id));
  const done = new Set(completed.filter((step) => valid.has(step as WorkspaceStepId))).size;
  return { done, total: steps.length, percent: steps.length ? Math.round(100 * done / steps.length) : 0 };
}
