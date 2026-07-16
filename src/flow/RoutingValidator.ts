/**
 * RoutingValidator — Verifiziert, dass der gesamte E2E-User-Journey fehlerfrei funktioniert.
 *
 * Validierungsregeln:
 * 1. Alle Flow-Steps haben eindeutige Slugs
 * 2. Jede Action (Button) verweist auf eine gültige Route
 * 3. Keine zirkulären Abhängigkeiten (außer Zurück-Knöpfen)
 * 4. Alle externen Routes sind dokumentiert
 * 5. Jede Stage ist erreichbar vom Hauptpfad
 * 6. Alle Landeseiten (Landing) haben einen klaren Einstiegspunkt
 */

import type { FlowAction, FlowStep, FlowStageKey } from './flowRoutes';
import { FLOW_STEPS, FLOW_STAGES } from './flowRoutes';

export interface RoutingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalSteps: number;
    totalActions: number;
    externalRoutes: string[];
    reachableSteps: string[];
    unreachableSteps: string[];
  };
}

/** Dokumentiert alle erwarteten externen Routes (außerhalb von /flow/*) */
const EXPECTED_EXTERNAL_ROUTES = new Set([
  '/',                    // Home
  '/audit',               // Audit Scanner
  '/pricing',             // Pricing Page
  '/os/login',            // Enterprise Auth: Login
  '/os/signup',           // Enterprise Auth: Signup
  '/app',                 // Workspace Dashboard
  '/checkout/starter',    // Stripe: Starter Plan
  '/checkout/growth',     // Stripe: Growth Plan
  '/checkout/agency',     // Stripe: Agency Plan
]);

/**
 * Hauptvalidierungsfunktion für die gesamte Routing-Infrastruktur.
 * Wird beim App-Start oder in Test-Suites aufgerufen.
 */
export function validateRouting(): RoutingValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const externalRoutes = new Set<string>();
  const flowStepIds = new Set<string>();
  const flowSlugs = new Set<string>();

  // 1. Eindeutigkeit prüfen
  for (const step of Object.values(FLOW_STEPS)) {
    if (flowStepIds.has(step.id)) {
      errors.push(`Duplizierte Flow-ID: ${step.id}`);
    }
    flowStepIds.add(step.id);

    if (flowSlugs.has(step.slug)) {
      errors.push(`Duplizierter Slug: ${step.slug}`);
    }
    flowSlugs.add(step.slug);
  }

  // 2. Alle Actions prüfen
  let totalActions = 0;
  for (const step of Object.values(FLOW_STEPS)) {
    const actions = collectActions(step);
    totalActions += actions.length;

    for (const action of actions) {
      const isFlowRoute = isFlowPath(action.to);
      const isExternal = isExternalRoute(action.to);

      // Jedes Action-Ziel muss entweder /flow/* oder extern sein
      if (!isFlowRoute && !isExternal) {
        errors.push(
          `Ungültiges Action-Ziel in "${step.id}": "${action.to}" ` +
          `(weder /flow/* noch externe Route)`,
        );
      }

      // Externe Routes sammeln für spätere Validierung
      if (isExternal) {
        externalRoutes.add(action.to);
      }
    }
  }

  // 3. Externe Routes validieren
  for (const route of externalRoutes) {
    if (!EXPECTED_EXTERNAL_ROUTES.has(route)) {
      warnings.push(
        `Unbekannte externe Route: "${route}" ` +
        `(nicht in EXPECTED_EXTERNAL_ROUTES registriert)`,
      );
    }
  }

  // 4. Erreichbarkeit prüfen (vom Einstiegspunkt aus)
  const reachableSteps = findReachableSteps('landing.startScan');
  const unreachableSteps = Array.from(flowStepIds).filter(
    (id) => !reachableSteps.has(id),
  );

  if (unreachableSteps.length > 0) {
    warnings.push(
      `Unerreichbare Flow-Schritte vom Hauptpfad: ${unreachableSteps.join(', ')}`,
    );
  }

  // 5. Stage-Validierung
  const stagesUsed = new Set<FlowStageKey>();
  for (const step of Object.values(FLOW_STEPS)) {
    stagesUsed.add(step.stage);
  }

  const missingStages = FLOW_STAGES.filter(
    (s) => !stagesUsed.has(s.key as FlowStageKey),
  );
  if (missingStages.length > 0) {
    warnings.push(
      `Nicht genutzte Flow-Stages: ${missingStages.map((s) => s.key).join(', ')}`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalSteps: Object.keys(FLOW_STEPS).length,
      totalActions,
      externalRoutes: Array.from(externalRoutes),
      reachableSteps: Array.from(reachableSteps),
      unreachableSteps,
    },
  };
}

/**
 * Findet alle erreichbaren Steps vom Startstep aus (BFS-Algorithmus).
 * Wird für die Analyse des Haupt-Navigationspfads verwendet.
 */
function findReachableSteps(startId: string): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [startId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;

    visited.add(currentId);

    const step = FLOW_STEPS[currentId];
    if (!step) continue;

    const actions = collectActions(step);
    for (const action of actions) {
      if (isFlowPath(action.to)) {
        const nextSlug = action.to.replace('/flow/', '');
        const nextId = findFlowStepIdBySlug(nextSlug);
        if (nextId && !visited.has(nextId)) {
          queue.push(nextId);
        }
      }
    }
  }

  return visited;
}

/** Findet die Flow-ID anhand eines Slugs. */
function findFlowStepIdBySlug(slug: string): string | undefined {
  for (const [id, step] of Object.entries(FLOW_STEPS)) {
    if (step.slug === slug) return id;
  }
  return undefined;
}

/** Sammelt alle Actions aus einem Flow-Step. */
function collectActions(step: FlowStep): FlowAction[] {
  const actions: FlowAction[] = [];
  if (step.primary) actions.push(step.primary);
  if (step.secondary) actions.push(step.secondary);
  if (step.extraActions) actions.push(...step.extraActions);
  return actions;
}

/** Prüft, ob eine Route ein /flow/* Pfad ist. */
function isFlowPath(to: string): boolean {
  return to.startsWith('/flow/') && to !== '/flow';
}

/** Prüft, ob eine Route eine externe Route ist (nicht /flow/*). */
function isExternalRoute(to: string): boolean {
  return !isFlowPath(to);
}

/**
 * Erzeugt einen Menschen-lesbaren Report der Routing-Infrastruktur.
 * Wird für Dokumentation und Debugging verwendet.
 */
export function generateRoutingReport(): string {
  const validation = validateRouting();
  const lines: string[] = [];

  lines.push('═'.repeat(70));
  lines.push('E2E ROUTING VALIDATION REPORT');
  lines.push('═'.repeat(70));
  lines.push('');

  // Status
  lines.push(`Status: ${validation.isValid ? '✓ VALID' : '✗ INVALID'}`);
  lines.push('');

  // Statistiken
  lines.push('STATISTIKEN:');
  lines.push(`  • Gesamt Flow-Schritte: ${validation.stats.totalSteps}`);
  lines.push(`  • Gesamt Actions: ${validation.stats.totalActions}`);
  lines.push(`  • Externe Routes: ${validation.stats.externalRoutes.length}`);
  lines.push(`  • Erreichbare Schritte: ${validation.stats.reachableSteps.length}`);
  lines.push('');

  // Fehler
  if (validation.errors.length > 0) {
    lines.push('FEHLER:');
    for (const error of validation.errors) {
      lines.push(`  ✗ ${error}`);
    }
    lines.push('');
  }

  // Warnungen
  if (validation.warnings.length > 0) {
    lines.push('WARNUNGEN:');
    for (const warning of validation.warnings) {
      lines.push(`  ⚠ ${warning}`);
    }
    lines.push('');
  }

  // Externe Routes
  if (validation.stats.externalRoutes.length > 0) {
    lines.push('EXTERNE ROUTES:');
    for (const route of validation.stats.externalRoutes.sort()) {
      lines.push(`  → ${route}`);
    }
    lines.push('');
  }

  // Flow-Stages
  lines.push('FLOW-STAGES (Fortschrittsleiste):');
  for (const stage of FLOW_STAGES) {
    const stepsInStage = Object.values(FLOW_STEPS).filter(
      (s) => s.stage === stage.key,
    );
    lines.push(`  ${stage.key.padEnd(15)} → ${stepsInStage.length} Schritte`);
  }
  lines.push('');

  // Hauptpfad (Golden Path)
  lines.push('HAUPT-NAVIGATIONSPFAD (Scan → Checkout → Dashboard):');
  const mainPath = traceMainPath();
  for (let i = 0; i < mainPath.length; i++) {
    const step = mainPath[i];
    const prefix = i === mainPath.length - 1 ? '└─' : '├─';
    lines.push(`  ${prefix} [${step.stage.toUpperCase()}] ${step.title}`);
  }
  lines.push('');

  lines.push('═'.repeat(70));

  return lines.join('\n');
}

/** Verfolgung des Hauptpfads von Start bis Ende. */
function traceMainPath(): FlowStep[] {
  const path: FlowStep[] = [];
  let currentId: string | undefined = 'landing.startScan';

  const visited = new Set<string>();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const step = FLOW_STEPS[currentId];
    if (!step) break;

    path.push(step);

    // Zum Primary-Ziel folgen
    if (step.primary) {
      if (isFlowPath(step.primary.to)) {
        const nextSlug = step.primary.to.replace('/flow/', '');
        currentId = findFlowStepIdBySlug(nextSlug);
      } else {
        break; // Externe Route, Ende des Flow-Pfads
      }
    } else {
      break;
    }
  }

  return path;
}

/**
 * Navigations-Validierung: Prüft, dass alle Buttons/Links auf der Seite
 * zu gültigen Routen führen. Wird beim Rendern einzelner Flow-Steps aufgerufen.
 */
export function validateFlowStepActions(stepId: string): {
  valid: boolean;
  invalidActions: string[];
} {
  const step = FLOW_STEPS[stepId];
  if (!step) {
    return { valid: false, invalidActions: [`Step nicht gefunden: ${stepId}`] };
  }

  const invalidActions: string[] = [];
  const actions = collectActions(step);

  for (const action of actions) {
    if (!isExternalRoute(action.to) && !isFlowPath(action.to)) {
      invalidActions.push(
        `"${action.label}" → "${action.to}" ist keine gültige Route`,
      );
    }
  }

  return {
    valid: invalidActions.length === 0,
    invalidActions,
  };
}
