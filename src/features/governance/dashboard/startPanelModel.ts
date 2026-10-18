/**
 * Kunden-Startansicht für /app/dashboard — reines Entscheidungsmodell.
 *
 * Beantwortet in fester Reihenfolge: Wo stehe ich? Was ist aktiv? Was fehlt?
 * Was ist der EINE nächste Schritt? Was bringt mir das Ergebnis?
 *
 * Nur echte Workspace-Fakten. `null` heißt „noch unbekannt“ — dann wird kein
 * Schritt als offen oder erledigt behauptet und keine Hauptaktion erfunden.
 */
import type { ActivationBootstrapStatus } from './workspaceBootstrapSteps';
import type { BillingAccountKind } from '../../../core/billing/billingAccount';

export interface StartPanelInput {
  websiteCount: number | null;
  scanCount: number | null;
  /** Erfasste KI-Systeme (cockpit `scoreBasis.aiSystems`). */
  aiSystemCount: number | null;
  activationStatus: ActivationBootstrapStatus | null;
}

export type SetupStepId = 'account' | 'website' | 'scan' | 'ai-system' | 'activation';
export type SetupStepState = 'done' | 'open' | 'unknown';

export interface SetupStep {
  id: SetupStepId;
  label: string;
  /** Kurzer Satz, was der Schritt bringt — sichtbar, solange er offen ist. */
  benefit: string;
  state: SetupStepState;
  href: string;
  cta: string;
}

export interface PrimaryAction {
  stepId: SetupStepId | 'review';
  headline: string;
  detail: string;
  cta: string;
  href: string;
}

export interface StartPanelModel {
  steps: SetupStep[];
  doneCount: number;
  totalCount: number;
  /** Alle Schritte bekannt und erledigt. */
  complete: boolean;
  /** Mindestens ein Schritt noch unbekannt (lädt / Quelle nicht ladbar). */
  pending: boolean;
  maturity: string;
  primary: PrimaryAction | null;
  secondary: { label: string; href: string } | null;
}

const known = (n: number | null): n is number => n !== null;

function stateOf(value: boolean | null): SetupStepState {
  return value === null ? 'unknown' : value ? 'done' : 'open';
}

export function computeStartPanel(input: StartPanelInput): StartPanelModel {
  const hasWebsite = known(input.websiteCount) ? input.websiteCount > 0 : null;
  const hasScan = known(input.scanCount) ? input.scanCount > 0 : null;
  const hasAiSystem = known(input.aiSystemCount) ? input.aiSystemCount > 0 : null;
  const activated =
    input.activationStatus === null ? null : input.activationStatus === 'activated';

  const steps: SetupStep[] = [
    {
      id: 'account',
      label: 'Konto eingerichtet',
      benefit: 'Ihr Workspace ist angelegt.',
      state: 'done',
      href: '/app/settings',
      cta: 'Konto ansehen',
    },
    {
      id: 'website',
      label: 'Website hinterlegen',
      benefit: 'Ohne Domain kann nichts geprüft werden.',
      state: stateOf(hasWebsite),
      href: '/app/websites',
      cta: 'Website hinterlegen',
    },
    {
      id: 'scan',
      label: 'Ersten Website-Scan durchführen',
      benefit: 'Zeigt Tracking, Cookies und Datenschutz-Lücken Ihrer Website.',
      state: stateOf(hasScan),
      href: '/app/websites',
      cta: 'Scan starten',
    },
    {
      id: 'ai-system',
      label: 'Erstes KI-System erfassen',
      benefit: 'Grundlage für Risikoklasse nach EU AI Act und Governance-Score.',
      state: stateOf(hasAiSystem),
      href: '/app/onboarding',
      cta: 'KI-System erfassen',
    },
    {
      id: 'activation',
      label: 'Governance-Rahmen festlegen',
      benefit: 'Organisation und Geltungsbereich – damit Regeln greifen.',
      state: stateOf(activated),
      href: '/app/activation',
      cta: 'Rahmen festlegen',
    },
  ];

  const doneCount = steps.filter((s) => s.state === 'done').length;
  const pending = steps.some((s) => s.state === 'unknown');
  const complete = !pending && doneCount === steps.length;

  const primary = primaryAction(hasWebsite, hasScan, hasAiSystem, activated, complete);
  // Zweitaktion nur, solange der Website-Pfad vorne steht und noch kein
  // KI-System erfasst ist — wer keine Website hat, kann so trotzdem starten.
  const secondary =
    (primary?.stepId === 'website' || primary?.stepId === 'scan') && hasAiSystem === false
      ? { label: 'KI-System erfassen', href: '/app/onboarding' }
      : null;

  return {
    steps,
    doneCount,
    totalCount: steps.length,
    complete,
    pending,
    maturity: complete ? 'Eingerichtet' : 'Einrichtung läuft',
    primary,
    secondary,
  };
}

/**
 * Genau eine Hauptaktion. Reihenfolge: Website → Scan → KI-System → Rahmen →
 * Risiken prüfen. Ein unbekannter Vorgänger blockiert die Empfehlung, damit
 * wir nie „Scan starten“ sagen, während die Website-Liste noch lädt.
 */
function primaryAction(
  hasWebsite: boolean | null,
  hasScan: boolean | null,
  hasAiSystem: boolean | null,
  activated: boolean | null,
  complete: boolean,
): PrimaryAction | null {
  if (hasWebsite === null) return null;
  if (!hasWebsite) {
    return {
      stepId: 'website',
      headline: 'Starten Sie mit Ihrem ersten Website-Scan',
      detail:
        'Hinterlegen Sie Ihre Domain. Der Scan zeigt in wenigen Minuten, wo Ihre Website bei DSGVO und Tracking nachbessern sollte.',
      cta: 'Website hinterlegen & scannen',
      href: '/app/websites',
    };
  }
  if (hasScan === null) return null;
  if (!hasScan) {
    return {
      stepId: 'scan',
      headline: 'Starten Sie jetzt Ihren ersten Scan',
      detail:
        'Ihre Domain ist hinterlegt. Der Scan prüft HTML und Header Ihrer Website und liefert die ersten Befunde.',
      cta: 'Scan jetzt starten',
      href: '/app/websites',
    };
  }
  if (hasAiSystem === null) return null;
  if (!hasAiSystem) {
    return {
      stepId: 'ai-system',
      headline: 'Erfassen Sie Ihr erstes KI-System',
      detail:
        'Danach ordnen wir es einer Risikoklasse nach EU AI Act zu und berechnen Ihren Governance-Score.',
      cta: 'KI-System erfassen',
      href: '/app/onboarding',
    };
  }
  if (activated === null) return null;
  if (!activated) {
    return {
      stepId: 'activation',
      headline: 'Legen Sie Ihren Governance-Rahmen fest',
      detail: 'Organisation und Geltungsbereich bestimmen, welche Regeln und Nachweise für Sie gelten.',
      cta: 'Rahmen festlegen',
      href: '/app/activation',
    };
  }
  return complete
    ? {
        stepId: 'review',
        headline: 'Ihr Workspace ist eingerichtet',
        detail: 'Prüfen Sie offene Risiken und Maßnahmen – Nachweise entstehen dabei automatisch.',
        cta: 'Risiken & Maßnahmen prüfen',
        href: '/app/risks',
      }
    : null;
}

export interface AccountNotice {
  text: string;
  /** Optionaler Link — nur, wenn der Kunde wirklich etwas tun muss oder kann. */
  link: { label: string; href: string } | null;
  /** Nur kurz vor Ende der Testphase hervorheben, sonst neutral. */
  tone: 'neutral' | 'attention';
}

/**
 * Eine Zeile für Testphase und Zahlung statt zwei konkurrierender Banner.
 *
 * Maßgeblich ist das Vertragsverhältnis dieses Mandanten (`kind`, aus
 * `subscriptions` über billingAccount.ts), nicht der Build-Schalter der Beta:
 * - `beta`: „keine Zahlungsdaten nötig“ — auch nachdem die Beta keine
 *   Neukunden mehr aufnimmt; der gewährte Zugang läuft unverändert weiter.
 * - `stripe`: Zahlungsmittel liegt schon bei Stripe; nach der Testphase
 *   wird abgerechnet → „Abo verwalten“.
 * - kartenlose Testphase oder unbekannt: Zahlungsdaten vor Ende hinterlegen.
 */
export function computeAccountNotice(
  trial: { daysRemaining: number; endingSoon: boolean } | null,
  beta: { endsLabel: string },
  kind: BillingAccountKind | null,
): AccountNotice | null {
  if (trial && trial.daysRemaining <= 0) {
    return {
      text: 'Testphase beendet – Sie nutzen den kostenlosen Zugang. Scan und Audit Center bleiben verfügbar.',
      link: { label: 'Pakete ansehen', href: '/pricing?source=trial-expired' },
      tone: 'attention',
    };
  }
  const days = trial
    ? trial.daysRemaining === 1 ? 'endet morgen' : `noch ${trial.daysRemaining} Tage`
    : null;
  if (kind === 'beta') {
    return {
      text: days
        ? `Kostenlose Testphase · ${days} · keine Zahlungsdaten nötig`
        : `Kostenlose Testphase bis ${beta.endsLabel} · keine Zahlungsdaten nötig`,
      link: null,
      tone: 'neutral',
    };
  }
  if (!trial) return null;
  const tone = trial.endingSoon ? 'attention' : 'neutral';
  if (kind === 'stripe') {
    return {
      text: `Testphase · ${days} · danach monatliche Abrechnung`,
      link: { label: 'Abo verwalten', href: '/app/billing' },
      tone,
    };
  }
  return {
    text: `Testphase · ${days}`,
    link: { label: 'Zahlungsdaten vor Ende der Testphase hinterlegen', href: '/billing/usage' },
    tone,
  };
}
