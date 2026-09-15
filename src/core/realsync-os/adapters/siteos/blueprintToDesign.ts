import type { DesignDocument, DesignNode, DesignProject } from '../../design/types';
import type { SiteOsBlueprintDocument, SiteOsBlueprintNode } from './designToBlueprint';

function fromBlueprintNode(node: SiteOsBlueprintNode, parentId: string | null, acc: Record<string, DesignNode>): DesignNode {
  const mapped: DesignNode = {
    id: node.id,
    type: (node.type as DesignNode['type']) || 'section',
    name: node.type,
    parentId,
    children: node.children.map((child) => child.id),
    props: { text: node.text, href: node.href, alt: node.alt, role: node.role },
    tokenRefs: [],
    source: 'import',
    provenance: { generated: false, agent: 'siteos-import', policyVersion: 'design-1.0.0' },
  };
  acc[mapped.id] = mapped;
  for (const child of node.children) fromBlueprintNode(child, mapped.id, acc);
  return mapped;
}

/**
 * Inverse mapping for round-trip. Does not fetch a SiteOS store.
 */
export function blueprintToDesign(blueprint: SiteOsBlueprintDocument, tenantId: string, now: string): DesignProject {
  const documents: DesignDocument[] = blueprint.pages.map((page) => {
    const nodes: Record<string, DesignNode> = {};
    const rootChildren = page.sections.map((section) => {
      const root = section.nodes[0];
      if (!root) return section.id;
      fromBlueprintNode(root, 'page', nodes);
      return root.id;
    });
    nodes.page = {
      id: 'page',
      type: 'page',
      name: page.name,
      parentId: null,
      children: rootChildren,
      props: {},
      tokenRefs: [],
      source: 'import',
      provenance: { generated: false, agent: 'siteos-import', policyVersion: 'design-1.0.0' },
    };
    return {
      id: page.id,
      name: page.name,
      kind: 'page' as const,
      rootId: 'page',
      nodes,
      variants: [],
      comments: [],
    };
  });

  return {
    id: blueprint.provenance.designProjectId,
    intentId: 'imported',
    tenantId,
    inputMode: 'code',
    version: blueprint.provenance.designVersion,
    brand: {
      locale: blueprint.locale,
      voice: '',
      colors: {
        ink: blueprint.theme.colors.ink ?? '',
        paper: blueprint.theme.colors.paper ?? '',
        accent: blueprint.theme.colors.accent ?? '',
        muted: blueprint.theme.colors.muted ?? '',
      },
      typography: {
        heading: blueprint.theme.typography.heading ?? '',
        body: blueprint.theme.typography.body ?? '',
      },
      radius: blueprint.theme.radius,
      rules: [],
      complete: false,
    },
    tokens: [
      ...Object.entries(blueprint.theme.colors).map(([name, value]) => ({
        id: `color.${name}`,
        category: 'color' as const,
        name,
        value,
        source: 'brand-rule' as const,
      })),
    ],
    documents,
    assets: [],
    changes: [],
    createdAt: now,
    updatedAt: now,
  };
}
