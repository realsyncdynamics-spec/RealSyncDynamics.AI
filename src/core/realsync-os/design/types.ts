export type DesignInputMode = 'prompt' | 'url' | 'screenshot' | 'code';

export type DesignNodeType =
  | 'page'
  | 'header'
  | 'nav'
  | 'hero'
  | 'heading'
  | 'paragraph'
  | 'cta'
  | 'image'
  | 'section'
  | 'features'
  | 'feature'
  | 'social_proof'
  | 'pricing'
  | 'form'
  | 'footer';

export type DesignBreakpoint = 'desktop' | 'tablet' | 'mobile';

export type DesignTokenCategory =
  | 'color'
  | 'typography'
  | 'spacing'
  | 'radius'
  | 'shadow'
  | 'motion';

export type DesignToken = {
  id: string;
  category: DesignTokenCategory;
  name: string;
  value: string;
  source: 'intent' | 'inferred' | 'brand-rule';
};

export type BrandIntelligence = {
  vertical?: string;
  locale: string;
  voice: string;
  colors: { ink: string; paper: string; accent: string; muted: string };
  typography: { heading: string; body: string };
  radius: string;
  rules: string[];
  complete: boolean;
};

export type DesignNode = {
  id: string;
  type: DesignNodeType;
  name: string;
  parentId: string | null;
  children: string[];
  props: {
    text?: string;
    href?: string;
    alt?: string;
    role?: string;
    src?: string;
  };
  tokenRefs: string[];
  source: 'intent' | 'agent' | 'import';
  provenance: {
    generated: boolean;
    agent: string;
    policyVersion: string;
  };
};

export type DesignVariant = {
  id: string;
  breakpoint: DesignBreakpoint;
  nodeId: string;
  notes: string[];
};

export type DesignComment = {
  id: string;
  nodeId: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type DesignChange = {
  id: string;
  at: string;
  agent: string;
  action: string;
  summary: string;
  nodeIds: string[];
};

export type DesignDocument = {
  id: string;
  name: string;
  kind: 'page' | 'partial';
  rootId: string;
  nodes: Record<string, DesignNode>;
  variants: DesignVariant[];
  comments: DesignComment[];
};

export type DesignProject = {
  id: string;
  intentId: string;
  tenantId: string;
  inputMode: DesignInputMode;
  version: number;
  brand: BrandIntelligence;
  tokens: DesignToken[];
  documents: DesignDocument[];
  assets: DesignAsset[];
  changes: DesignChange[];
  createdAt: string;
  updatedAt: string;
};

export type DesignAsset = {
  id: string;
  kind: 'logo' | 'image' | 'icon';
  name: string;
  provenanceRequired: boolean;
  bound: boolean;
  note: string;
};

export type DesignIntent = {
  text: string;
  mode: DesignInputMode;
  vertical?: string;
  locale: string;
  wantsPublish: boolean;
  sourceUrl?: string;
};

export type DesignPlanOptions = {
  includePublish: boolean;
  includeSeo: boolean;
};

export type AccessibilityFinding = {
  nodeId?: string;
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
};

export type StructuralSeoFinding = {
  code: string;
  present: boolean;
  message: string;
};
