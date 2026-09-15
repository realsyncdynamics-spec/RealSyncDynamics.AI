import type {
  BrandIntelligence,
  DesignChange,
  DesignDocument,
  DesignInputMode,
  DesignIntent,
  DesignNode,
  DesignProject,
  DesignToken,
} from './types';

const URL_RE = /https?:\/\/[^\s]+/i;

export function detectDesignInputMode(text: string): DesignInputMode {
  const t = text.toLowerCase();
  if (URL_RE.test(text) || t.includes('www.')) return 'url';
  if (
    t.includes('screenshot') ||
    t.includes('mockup') ||
    t.includes('.png') ||
    t.includes('.jpg') ||
    t.includes('upload')
  ) {
    return 'screenshot';
  }
  if (
    t.includes('<html') ||
    t.includes('```') ||
    t.includes('.tsx') ||
    t.includes('css {') ||
    /\bcode\b/.test(t) && (t.includes('nachbauen') || t.includes('from code'))
  ) {
    return 'code';
  }
  return 'prompt';
}

export function classifyDesignIntent(text: string): DesignIntent {
  const t = text.toLowerCase();
  const mode = detectDesignInputMode(text);
  const url = text.match(URL_RE)?.[0];
  let vertical: string | undefined;
  if (t.includes('steuerberater') || t.includes('tax')) vertical = 'tax-advisor';
  else if (t.includes('saas') || t.includes('startup')) vertical = 'saas';
  else if (t.includes('handwerk')) vertical = 'craft';
  else if (t.includes('kanzlei') || t.includes('anwalt')) vertical = 'legal';

  const locale = /\b(german|deutsch|deutschen|dsgvo)\b/i.test(text) || vertical === 'tax-advisor' ? 'de' : 'en';

  return {
    text,
    mode,
    vertical,
    locale,
    wantsPublish: t.includes('publish') || t.includes('deploy') || t.includes('veröff'),
    sourceUrl: url,
  };
}

export function inferBrand(intent: DesignIntent): BrandIntelligence {
  if (intent.vertical === 'tax-advisor') {
    return {
      vertical: intent.vertical,
      locale: 'de',
      voice: 'formal, precise, trustworthy',
      colors: { ink: '#0F1F2E', paper: '#F6F1E8', accent: '#B08D57', muted: '#5C6B73' },
      typography: { heading: 'Source Serif 4', body: 'IBM Plex Sans' },
      radius: '6px',
      rules: [
        'No playful illustration',
        'High contrast body text',
        'CTA must state a concrete next step',
        'German formal address (Sie)',
      ],
      complete: true,
    };
  }

  if (intent.vertical === 'saas') {
    return {
      vertical: intent.vertical,
      locale: intent.locale,
      voice: 'direct, european, product-led',
      colors: { ink: '#0B0F14', paper: '#F4F7F8', accent: '#0F766E', muted: '#5C6570' },
      typography: { heading: 'IBM Plex Sans', body: 'IBM Plex Sans' },
      radius: '12px',
      rules: ['One primary CTA', 'Dark ink on paper', 'No gradient-blob decoration'],
      complete: true,
    };
  }

  return {
    vertical: intent.vertical,
    locale: intent.locale,
    voice: 'clear, professional',
    colors: { ink: '#121417', paper: '#F7F7F5', accent: '#1D4E4A', muted: '#6B7280' },
    typography: { heading: 'IBM Plex Sans', body: 'IBM Plex Sans' },
    radius: '8px',
    rules: ['Semantic sections only', 'Brand tokens drive color, never ad-hoc hex in copy'],
    complete: Boolean(intent.vertical),
  };
}

export function tokensFromBrand(brand: BrandIntelligence): DesignToken[] {
  return [
    { id: 'color.ink', category: 'color', name: 'ink', value: brand.colors.ink, source: 'inferred' },
    { id: 'color.paper', category: 'color', name: 'paper', value: brand.colors.paper, source: 'inferred' },
    { id: 'color.accent', category: 'color', name: 'accent', value: brand.colors.accent, source: 'inferred' },
    { id: 'color.muted', category: 'color', name: 'muted', value: brand.colors.muted, source: 'inferred' },
    { id: 'type.heading', category: 'typography', name: 'heading', value: brand.typography.heading, source: 'inferred' },
    { id: 'type.body', category: 'typography', name: 'body', value: brand.typography.body, source: 'inferred' },
    { id: 'radius.base', category: 'radius', name: 'base', value: brand.radius, source: 'brand-rule' },
    { id: 'space.section', category: 'spacing', name: 'section', value: '72px', source: 'brand-rule' },
  ];
}

function node(
  id: string,
  type: DesignNode['type'],
  name: string,
  parentId: string | null,
  children: string[],
  props: DesignNode['props'],
  agent: string,
): DesignNode {
  return {
    id,
    type,
    name,
    parentId,
    children,
    props,
    tokenRefs: ['color.ink', 'color.paper'],
    source: 'agent',
    provenance: { generated: true, agent, policyVersion: 'design-1.0.0' },
  };
}

export function emptyDesignProject(params: {
  intentId: string;
  tenantId: string;
  mode: DesignInputMode;
  now: string;
  id: string;
}): DesignProject {
  return {
    id: params.id,
    intentId: params.intentId,
    tenantId: params.tenantId,
    inputMode: params.mode,
    version: 0,
    brand: {
      locale: 'en',
      voice: '',
      colors: { ink: '', paper: '', accent: '', muted: '' },
      typography: { heading: '', body: '' },
      radius: '',
      rules: [],
      complete: false,
    },
    tokens: [],
    documents: [],
    assets: [],
    changes: [],
    createdAt: params.now,
    updatedAt: params.now,
  };
}

function commit(project: DesignProject, change: Omit<DesignChange, 'id' | 'at'>, now: string, id: string): DesignProject {
  return {
    ...project,
    version: project.version + 1,
    updatedAt: now,
    changes: [...project.changes, { ...change, id, at: now }],
  };
}

export function applyBrand(project: DesignProject, brand: BrandIntelligence, now: string, changeId: string): DesignProject {
  return commit(
    { ...project, brand, tokens: tokensFromBrand(brand) },
    { agent: 'brand', action: 'extract_brand', summary: `Brand defined (${brand.vertical ?? 'generic'})`, nodeIds: [] },
    now,
    changeId,
  );
}

export function applyDesignSystem(project: DesignProject, now: string, changeId: string): DesignProject {
  return commit(project, {
    agent: 'designer',
    action: 'define_design_system',
    summary: `${project.tokens.length} tokens bound to project`,
    nodeIds: project.tokens.map((token) => token.id),
  }, now, changeId);
}

export function createLandingWireframe(project: DesignProject, intent: DesignIntent, now: string, changeId: string): DesignProject {
  const de = intent.locale === 'de';
  const title = intent.vertical === 'tax-advisor'
    ? (de ? 'Steuerberatung, die Klarheit schafft' : 'Tax advice with clarity')
    : (de ? 'Eine moderne Landingpage' : 'A modern landing page');

  const nodes: Record<string, DesignNode> = {
    page: node('page', 'page', 'Landing page', null, ['header', 'hero', 'features', 'social_proof', 'footer'], {}, 'ux'),
    header: node('header', 'header', 'Header', 'page', ['nav'], {}, 'ux'),
    nav: node('nav', 'nav', 'Primary navigation', 'header', [], { text: de ? 'Leistungen · Kanzlei · Kontakt' : 'Product · Company · Contact', role: 'navigation' }, 'ux'),
    hero: node('hero', 'hero', 'Hero', 'page', ['hero-heading', 'hero-copy', 'hero-cta', 'hero-image'], {}, 'designer'),
    'hero-heading': node('hero-heading', 'heading', 'Hero heading', 'hero', [], { text: title, role: 'heading' }, 'copy'),
    'hero-copy': node('hero-copy', 'paragraph', 'Hero copy', 'hero', [], { text: de ? 'Strukturierte Beratung statt Formularchaos.' : 'Structured product narrative, not template filler.' }, 'copy'),
    'hero-cta': node('hero-cta', 'cta', 'Primary CTA', 'hero', [], { text: de ? 'Erstgespräch vereinbaren' : 'Book a walkthrough', href: '#contact', role: 'button' }, 'copy'),
    'hero-image': node('hero-image', 'image', 'Hero visual', 'hero', [], { alt: de ? 'Kanzlei-Arbeitsplatz, sachlich' : 'Product workspace, restrained' }, 'designer'),
    features: node('features', 'features', 'Features', 'page', [], {}, 'ux'),
    social_proof: node('social_proof', 'social_proof', 'Social proof', 'page', [], {}, 'ux'),
    footer: node('footer', 'footer', 'Footer', 'page', [], { text: de ? 'Impressum · Datenschutz' : 'Imprint · Privacy', role: 'contentinfo' }, 'ux'),
  };

  const document: DesignDocument = {
    id: 'doc-landing',
    name: 'Landing',
    kind: 'page',
    rootId: 'page',
    nodes,
    variants: [],
    comments: [],
  };

  return commit(
    { ...project, documents: [document] },
    { agent: 'ux', action: 'create_wireframe', summary: 'Semantic landing tree: Header → Hero → Features → Social proof → Footer', nodeIds: Object.keys(nodes) },
    now,
    changeId,
  );
}

export function generateHero(project: DesignProject, intent: DesignIntent, now: string, changeId: string): DesignProject {
  const doc = project.documents[0];
  if (!doc) return project;
  const heading = doc.nodes['hero-heading'];
  const copy = doc.nodes['hero-copy'];
  if (!heading || !copy) return project;

  const de = intent.locale === 'de';
  const nextHeading = intent.vertical === 'tax-advisor'
    ? (de ? 'Steuerberatung für Unternehmer, die keine Überraschungen wollen' : 'Tax advice for operators who hate surprises')
    : heading.props.text;
  const nextCopy = intent.vertical === 'tax-advisor'
    ? (de ? 'Jahresabschluss, Lohn und digitale Belege — in einer ruhigen, nachvollziehbaren Struktur.' : 'Books, payroll and filings in one calm structure.')
    : copy.props.text;

  const nodes = {
    ...doc.nodes,
    'hero-heading': { ...heading, props: { ...heading.props, text: nextHeading } },
    'hero-copy': { ...copy, props: { ...copy.props, text: nextCopy } },
  };

  return commit(
    { ...project, documents: [{ ...doc, nodes }] },
    { agent: 'copy', action: 'generate_hero', summary: 'Hero heading, copy and CTA populated from intent', nodeIds: ['hero', 'hero-heading', 'hero-copy', 'hero-cta'] },
    now,
    changeId,
  );
}

export function generateSections(project: DesignProject, intent: DesignIntent, now: string, changeId: string): DesignProject {
  const doc = project.documents[0];
  if (!doc) return project;
  const de = intent.locale === 'de';

  const featureItems: DesignNode[] = [
    node('feature-1', 'feature', 'Feature 1', 'features', [], { text: de ? 'Digitale Mandantenaufnahme' : 'Guided onboarding' }, 'designer'),
    node('feature-2', 'feature', 'Feature 2', 'features', [], { text: de ? 'Fristen und Belege an einem Ort' : 'Deadlines and artifacts in one place' }, 'designer'),
    node('feature-3', 'feature', 'Feature 3', 'features', [], { text: de ? 'Klare Honorare, keine Intransparenz' : 'Clear pricing, no theatre' }, 'designer'),
  ];

  const quote = node(
    'proof-quote',
    'paragraph',
    'Proof',
    'social_proof',
    [],
    { text: de ? 'Platzhalterzitat — echte Stimmen erst nach Freigabe.' : 'Placeholder quote — real voices only after approval.' },
    'copy',
  );

  const nodes = {
    ...doc.nodes,
    features: { ...doc.nodes.features, children: featureItems.map((item) => item.id) },
    social_proof: { ...doc.nodes.social_proof, children: ['proof-quote'] },
    ...Object.fromEntries(featureItems.map((item) => [item.id, item])),
    'proof-quote': quote,
  };

  return commit(
    { ...project, documents: [{ ...doc, nodes }] },
    { agent: 'designer', action: 'generate_sections', summary: 'Features and social proof attached to the page tree', nodeIds: ['features', 'social_proof', ...featureItems.map((item) => item.id)] },
    now,
    changeId,
  );
}

export function applyResponsive(project: DesignProject, now: string, changeId: string): DesignProject {
  const doc = project.documents[0];
  if (!doc) return project;
  const variants = [
    { id: 'var-desktop', breakpoint: 'desktop' as const, nodeId: 'page', notes: ['Full nav', 'Hero split'] },
    { id: 'var-tablet', breakpoint: 'tablet' as const, nodeId: 'page', notes: ['Collapsed secondary nav'] },
    { id: 'var-mobile', breakpoint: 'mobile' as const, nodeId: 'page', notes: ['Stacked hero', 'Sticky CTA'] },
  ];
  return commit(
    { ...project, documents: [{ ...doc, variants }] },
    { agent: 'responsive', action: 'apply_responsive', summary: 'Desktop / tablet / mobile variants on the same semantic tree', nodeIds: ['page'] },
    now,
    changeId,
  );
}

export function walkTree(doc: DesignDocument, nodeId = doc.rootId, depth = 0): Array<{ node: DesignNode; depth: number }> {
  const current = doc.nodes[nodeId];
  if (!current) return [];
  return [{ node: current, depth }, ...current.children.flatMap((child) => walkTree(doc, child, depth + 1))];
}
