import { designToBlueprint } from '../adapters/siteos/designToBlueprint';
import type { StepResult } from '../types';
import type { StepExecutorContext } from '../executor';
import { evaluateGeneratedAsset } from './designPolicy';
import {
  applyBrand,
  applyDesignSystem,
  applyResponsive,
  classifyDesignIntent,
  createLandingWireframe,
  emptyDesignProject,
  generateHero,
  generateSections,
  inferBrand,
} from './designState';
import type { AccessibilityFinding, DesignProject, StructuralSeoFinding } from './types';

function projectOf(ctx: StepExecutorContext): DesignProject | undefined {
  return ctx.session.artifacts.designProject;
}

function nowIso(): string {
  return new Date().toISOString();
}

function missingExtractor(mode: string, action: string): StepResult {
  return {
    status: 'not_implemented',
    tool: 'designos.kernel',
    reason: `NOT IMPLEMENTED: ${action} for input mode "${mode}" needs a bound extractor (vision / crawler / parser). No pixel clone and no fake import.`,
  };
}

function structuralA11y(project: DesignProject): AccessibilityFinding[] {
  const findings: AccessibilityFinding[] = [];
  const doc = project.documents[0];
  if (!doc) {
    findings.push({ code: 'no-document', severity: 'error', message: 'No design document to inspect.' });
    return findings;
  }
  const nodes = Object.values(doc.nodes);
  if (!nodes.some((node) => node.type === 'heading' && node.props.text)) {
    findings.push({ code: 'missing-heading', severity: 'error', message: 'Page has no heading text.' });
  }
  for (const node of nodes.filter((item) => item.type === 'cta')) {
    if (!node.props.text) findings.push({ nodeId: node.id, code: 'cta-unlabeled', severity: 'error', message: 'CTA has no accessible name.' });
  }
  for (const node of nodes.filter((item) => item.type === 'image')) {
    if (!node.props.alt) findings.push({ nodeId: node.id, code: 'image-alt', severity: 'warning', message: 'Image is missing alt text.' });
  }
  if (!nodes.some((node) => node.props.role === 'navigation')) {
    findings.push({ code: 'no-nav', severity: 'warning', message: 'No navigation landmark.' });
  }
  return findings;
}

function structuralSeo(project: DesignProject): StructuralSeoFinding[] {
  const doc = project.documents[0];
  const nodes = doc ? Object.values(doc.nodes) : [];
  const heading = nodes.find((node) => node.type === 'heading')?.props.text;
  const cta = nodes.find((node) => node.type === 'cta')?.props.text;
  return [
    { code: 'h1', present: Boolean(heading), message: heading ? `Heading: ${heading}` : 'No H1-equivalent heading.' },
    { code: 'cta', present: Boolean(cta), message: cta ? `Primary CTA: ${cta}` : 'No primary CTA.' },
    { code: 'locale', present: Boolean(project.brand.locale), message: `Locale ${project.brand.locale || 'missing'}` },
  ];
}

/**
 * Kernel-local DesignOS executor.
 * Mutates semantic design state. Never fakes SiteOS render, scan or deploy.
 */
export function executeDesignStep(ctx: StepExecutorContext): StepResult {
  const { step, session } = ctx;
  const intent = classifyDesignIntent(session.intent.text);
  const stamp = nowIso();
  const changeId = `chg-${step.id}-${session.artifacts.designProject?.version ?? 0}`;

  if (step.action === 'discover_design') {
    const project = emptyDesignProject({
      intentId: session.intent.id,
      tenantId: session.intent.tenantId,
      mode: intent.mode,
      now: stamp,
      id: `design-${session.intent.id}`,
    });
    return {
      status: 'succeeded',
      tool: 'designos.kernel',
      observation: {
        kind: 'design_discover',
        mode: intent.mode,
        vertical: intent.vertical ?? null,
        locale: intent.locale,
        sourceUrl: intent.sourceUrl ?? null,
        existingDocument: false,
      },
      artifacts: { designProject: project, designInputMode: intent.mode },
    };
  }

  const current = projectOf(ctx);
  if (!current) {
    return { status: 'failed', tool: 'designos.kernel', reason: 'Design project missing. discover_design must run first.' };
  }

  if (step.action === 'extract_brand') {
    if (intent.mode !== 'prompt') return missingExtractor(intent.mode, step.action);
    const brand = inferBrand(intent);
    const next = applyBrand(current, brand, stamp, changeId);
    return {
      status: 'succeeded',
      tool: 'designos.kernel',
      observation: {
        kind: 'brand',
        vertical: brand.vertical ?? null,
        complete: brand.complete,
        tokenCount: next.tokens.length,
        inferredFrom: 'intent-text',
      },
      artifacts: { designProject: next },
    };
  }

  if (step.action === 'define_design_system') {
    if (!current.brand.complete && current.tokens.length === 0) {
      return { status: 'failed', tool: 'designos.kernel', reason: 'No brand tokens to bind.' };
    }
    const next = applyDesignSystem(current, stamp, changeId);
    return {
      status: 'succeeded',
      tool: 'designos.kernel',
      observation: { kind: 'design_system', tokens: next.tokens.map((token) => token.id) },
      artifacts: { designProject: next },
    };
  }

  if (step.action === 'create_wireframe') {
    const next = createLandingWireframe(current, intent, stamp, changeId);
    const root = next.documents[0];
    return {
      status: 'succeeded',
      tool: 'designos.kernel',
      observation: {
        kind: 'wireframe',
        root: root?.rootId,
        nodeCount: root ? Object.keys(root.nodes).length : 0,
        sections: root?.nodes.page?.children ?? [],
      },
      artifacts: { designProject: next },
    };
  }

  if (step.action === 'generate_hero') {
    const next = generateHero(current, intent, stamp, changeId);
    const heading = next.documents[0]?.nodes['hero-heading']?.props.text;
    return {
      status: 'succeeded',
      tool: 'designos.kernel',
      observation: { kind: 'hero', heading: heading ?? null },
      artifacts: { designProject: next },
    };
  }

  if (step.action === 'generate_sections') {
    const next = generateSections(current, intent, stamp, changeId);
    return {
      status: 'succeeded',
      tool: 'designos.kernel',
      observation: {
        kind: 'sections',
        features: next.documents[0]?.nodes.features?.children.length ?? 0,
      },
      artifacts: { designProject: next },
    };
  }

  if (step.action === 'apply_responsive') {
    const next = applyResponsive(current, stamp, changeId);
    return {
      status: 'succeeded',
      tool: 'designos.kernel',
      observation: {
        kind: 'responsive',
        breakpoints: next.documents[0]?.variants.map((item) => item.breakpoint) ?? [],
      },
      artifacts: { designProject: next },
    };
  }

  if (step.action === 'verify_accessibility') {
    const findings = structuralA11y(current);
    const errors = findings.filter((item) => item.severity === 'error');
    return {
      status: errors.length ? 'failed' : 'succeeded',
      tool: 'designos.kernel',
      reason: errors.length ? errors.map((item) => item.message).join('; ') : undefined,
      observation: { kind: 'a11y_structural', findings, errorCount: errors.length, wcagScore: null },
      artifacts: { designProject: current },
    };
  }

  if (step.action === 'verify_seo_structure') {
    const findings = structuralSeo(current);
    return {
      status: 'succeeded',
      tool: 'designos.kernel',
      observation: { kind: 'seo_structural', findings, rankingScore: null },
      artifacts: { designProject: current },
    };
  }

  if (step.action === 'evaluate_design_governance') {
    const decision = evaluateGeneratedAsset(current);
    return {
      status: decision.allowed ? 'succeeded' : 'blocked',
      tool: 'designos.kernel',
      reason: decision.reason,
      observation: {
        kind: 'design_governance',
        allowed: decision.allowed,
        provenanceRequired: true,
        policyVersion: 'design-1.0.0',
        changes: current.changes.length,
      },
      artifacts: { designProject: current },
    };
  }

  if (step.action === 'map_siteos_blueprint') {
    const blueprint = designToBlueprint(current);
    return {
      status: 'succeeded',
      tool: 'designos.adapter.siteos',
      observation: {
        kind: 'blueprint_mapped',
        slug: blueprint.slug,
        pages: blueprint.pages.length,
        sections: blueprint.pages[0]?.sections.map((section) => section.type) ?? [],
        renderer: 'not_bound',
        persisted: false,
      },
      artifacts: {
        designProject: current,
        siteosBlueprint: blueprint,
        slug: blueprint.slug,
      },
    };
  }

  return {
    status: 'not_implemented',
    tool: 'designos.kernel',
    reason: `NOT IMPLEMENTED: unknown design action ${step.action}`,
  };
}
