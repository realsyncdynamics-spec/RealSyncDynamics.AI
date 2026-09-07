import type { ExecutionPlan, Intent, PlanStep, RiskLevel } from './types';

const step = (
  id: string,
  title: string,
  agent: string,
  action: string,
  risk: RiskLevel,
  requiresApproval: boolean,
  dependsOn: string[] = [],
): PlanStep => ({ id, title, agent, action, risk, requiresApproval, dependsOn });

export function createExecutionPlan(intent: Intent): ExecutionPlan {
  const text = intent.text.toLowerCase();
  const website = text.includes('website') || text.includes('landingpage') || text.includes('landing page');
  const deploy = text.includes('deploy') || text.includes('veröff') || text.includes('publish');
  const governance = text.includes('dsgvo') || text.includes('gdpr') || text.includes('ai act') || text.includes('compliance');
  const seo = text.includes('seo') || text.includes('google') || text.includes('sichtbarkeit');

  const steps: PlanStep[] = [];

  if (website) {
    steps.push(step('analyse', 'Bestehendes Projekt und Anforderungen analysieren', 'architect', 'analyze_project', 'low', false));
    steps.push(step('design', 'Designsystem und responsive Struktur erstellen', 'designer', 'create_design_system', 'medium', false, ['analyse']));
    steps.push(step('build', 'Frontend-Komponenten erzeugen oder ändern', 'developer', 'write_frontend', 'medium', false, ['design']));
    steps.push(step('qa', 'Frontend testen und Accessibility prüfen', 'qa', 'verify_frontend', 'medium', false, ['build']));
  }

  if (seo) {
    steps.push(step('seo', 'Technisches SEO und AI-Visibility prüfen', 'seo', 'optimize_visibility', 'low', false, website ? ['qa'] : []));
  }

  if (governance) {
    steps.push(step('governance', 'Governance, Datenschutz und AI-Act-Risiken bewerten', 'governance', 'evaluate_governance', 'high', true, steps.length ? [steps[steps.length - 1].id] : []));
  }

  if (deploy) {
    steps.push(step('deploy', 'Production Deployment vorbereiten', 'deployment', 'publish', 'critical', true, steps.length ? [steps[steps.length - 1].id] : []));
  }

  if (steps.length === 0) {
    steps.push(step('discover', 'Intent in Projektkontext einordnen', 'orchestrator', 'discover', 'low', false));
    steps.push(step('plan', 'Ausführbaren Arbeitsplan erstellen', 'orchestrator', 'refine_plan', 'low', false, ['discover']));
  }

  const risk = steps.some((item) => item.risk === 'critical') ? 'critical'
    : steps.some((item) => item.risk === 'high') ? 'high'
      : steps.some((item) => item.risk === 'medium') ? 'medium' : 'low';

  return {
    id: crypto.randomUUID(),
    intentId: intent.id,
    steps,
    risk,
    requiresApproval: steps.some((item) => item.requiresApproval),
    generatedAt: new Date().toISOString(),
  };
}
