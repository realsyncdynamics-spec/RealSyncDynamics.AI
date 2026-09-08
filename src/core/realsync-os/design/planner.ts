import type { PlanStep, RiskLevel } from '../types';
import type { DesignIntent, DesignPlanOptions } from './types';

const step = (
  id: string,
  title: string,
  agent: string,
  action: string,
  risk: RiskLevel,
  requiresApproval: boolean,
  dependsOn: string[] = [],
): PlanStep => ({ id, title, agent, action, risk, requiresApproval, dependsOn });

/**
 * Design plan is a RealSync OS execution plan, not a parallel planner.
 * Every step remains policy-aware and runs through the Command Center loop.
 */
export function createDesignPlanSteps(intent: DesignIntent, options: DesignPlanOptions): PlanStep[] {
  const steps: PlanStep[] = [
    step('discover', 'Design-Intent und Eingangsmodus einordnen', 'orchestrator', 'discover_design', 'low', false),
    step('brand', 'Brand Intelligence extrahieren oder definieren', 'brand', 'extract_brand', 'medium', false, ['discover']),
    step('system', 'Design Tokens und System binden', 'designer', 'define_design_system', 'medium', false, ['brand']),
    step('wireframe', 'Semantisches Wireframe aufbauen', 'ux', 'create_wireframe', 'medium', false, ['system']),
    step('hero', 'Hero erzeugen (Heading, Copy, CTA)', 'copy', 'generate_hero', 'medium', false, ['wireframe']),
    step('sections', 'Sections erzeugen (Features, Social Proof, Footer)', 'designer', 'generate_sections', 'medium', false, ['hero']),
    step('responsive', 'Responsive Varianten am selben Baum', 'responsive', 'apply_responsive', 'medium', false, ['sections']),
    step('a11y', 'Strukturelle Accessibility prüfen', 'accessibility', 'verify_accessibility', 'medium', false, ['responsive']),
  ];

  if (options.includeSeo) {
    steps.push(step('seo', 'Strukturelle SEO-Signale prüfen (keine Fake-Scores)', 'seo', 'verify_seo_structure', 'low', false, ['a11y']));
  }

  const after = steps[steps.length - 1].id;
  steps.push(
    step('governance', 'Provenance, Policy und Restricted-Data prüfen', 'governance', 'evaluate_design_governance', 'high', true, [after]),
  );
  steps.push(
    step('blueprint', 'Design State auf SiteOS-Blueprint abbilden', 'designer', 'map_siteos_blueprint', 'medium', false, ['governance']),
  );

  if (options.includePublish) {
    steps.push(
      step('publish', 'Publish Gate — Production bleibt approval-pflichtig', 'deployment', 'publish', 'critical', true, ['blueprint']),
    );
  }

  return steps;
}
