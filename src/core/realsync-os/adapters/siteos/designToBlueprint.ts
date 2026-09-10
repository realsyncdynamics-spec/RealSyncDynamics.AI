import type { DesignDocument, DesignNode, DesignProject, DesignToken } from '../../design/types';

export type SiteOsBlueprintTheme = {
  colors: Record<string, string>;
  typography: Record<string, string>;
  radius: string;
  spacing: Record<string, string>;
};

export type SiteOsBlueprintSection = {
  id: string;
  type: string;
  name: string;
  nodes: SiteOsBlueprintNode[];
};

export type SiteOsBlueprintNode = {
  id: string;
  type: string;
  text?: string;
  href?: string;
  alt?: string;
  role?: string;
  children: SiteOsBlueprintNode[];
};

export type SiteOsBlueprintDocument = {
  kind: 'siteos.blueprint';
  version: 1;
  source: 'designos-kernel';
  name: string;
  slug: string;
  locale: string;
  theme: SiteOsBlueprintTheme;
  pages: Array<{
    id: string;
    path: string;
    name: string;
    sections: SiteOsBlueprintSection[];
  }>;
  provenance: {
    designProjectId: string;
    designVersion: number;
    policyVersion: string;
  };
};

function tokenMap(tokens: DesignToken[], category: DesignToken['category']): Record<string, string> {
  return Object.fromEntries(tokens.filter((token) => token.category === category).map((token) => [token.name, token.value]));
}

function toBlueprintNode(doc: DesignDocument, node: DesignNode): SiteOsBlueprintNode {
  return {
    id: node.id,
    type: node.type,
    text: node.props.text,
    href: node.props.href,
    alt: node.props.alt,
    role: node.props.role,
    children: node.children.map((id) => doc.nodes[id]).filter(Boolean).map((child) => toBlueprintNode(doc, child)),
  };
}

const SECTION_TYPES = new Set(['header', 'hero', 'features', 'social_proof', 'pricing', 'footer', 'section']);

function pageSections(doc: DesignDocument): SiteOsBlueprintSection[] {
  const root = doc.nodes[doc.rootId];
  if (!root) return [];
  return root.children
    .map((id) => doc.nodes[id])
    .filter((node): node is DesignNode => Boolean(node) && SECTION_TYPES.has(node.type))
    .map((node) => ({
      id: node.id,
      type: node.type,
      name: node.name,
      nodes: [toBlueprintNode(doc, node)],
    }));
}

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'landing';
}

/**
 * Pure mapping. Does not persist, render, scan or publish.
 * SiteOS remains the canonical web artifact once a renderer is bound.
 */
export function designToBlueprint(project: DesignProject): SiteOsBlueprintDocument {
  const page = project.documents[0];
  return {
    kind: 'siteos.blueprint',
    version: 1,
    source: 'designos-kernel',
    name: page?.name ?? 'Untitled',
    slug: slugFromName(page?.name ?? 'landing'),
    locale: project.brand.locale,
    theme: {
      colors: tokenMap(project.tokens, 'color'),
      typography: tokenMap(project.tokens, 'typography'),
      radius: project.tokens.find((token) => token.category === 'radius')?.value ?? '8px',
      spacing: tokenMap(project.tokens, 'spacing'),
    },
    pages: page
      ? [{ id: page.id, path: '/', name: page.name, sections: pageSections(page) }]
      : [],
    provenance: {
      designProjectId: project.id,
      designVersion: project.version,
      policyVersion: 'design-1.0.0',
    },
  };
}
