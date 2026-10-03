// Brücke: Richtung → SiteBlueprint.
//
// Der Blueprint bleibt die einzige Wahrheit für Governance: Hash,
// Prüfpfad, Publish Gate, Claim, Puck-Editor — alles liest ihn. Der
// Rebuild erzeugt deshalb keinen zweiten Wahrheitsträger, sondern
// übersetzt seine Richtung in einen Blueprint, den der bestehende Kern
// versteht.
//
// Was dabei bewusst **nicht** übernommen wird: Platzhalter. Eine
// Vorschau darf „Referenz ergänzen" zeigen; ein Blueprint, der
// veröffentlicht werden könnte, darf es nicht enthalten. Platzhalter-
// Komponenten werden ausgelassen und fallen dann im Publish-Check als
// Blocker auf — sichtbar, nicht still.

import { INDUSTRY_PRESETS } from '../blueprint/industries.ts';
import { mergeBrief, parseBrief } from '../blueprint/brief.ts';
import { recompileCompliance } from '../blueprint/pages.ts';
import { buildBlock, synthesizeBlueprint } from '../blueprint/synthesize.ts';
import type { BlockKind, SiteBlock, SiteBlueprint } from '../types.ts';
import { visibleComponents } from './components.ts';
import { designSystemToTheme } from './design-system.ts';
import type { RebuildComponent, RebuildDirection, SiteImport } from './types.ts';

export interface BridgeOptions {
  createdAt?: string;
}

export function directionToBlueprint(direction: RebuildDirection, imp: SiteImport, options: BridgeOptions = {}): SiteBlueprint {
  const brand = imp.brand.name ?? direction.seo.title.split('|').pop()?.trim() ?? 'Website';
  const industry = imp.positioning.industry ?? 'sonstiges';
  const label = INDUSTRY_PRESETS[industry].label;
  const benefits = direction.components.find((c) => c.kind === 'benefits');

  const base = parseBrief(`${brand} ${label}${imp.positioning.locality ? ` in ${imp.positioning.locality}` : ''}`, 'de');
  const brief = mergeBrief(base, {
    name: brand,
    summary: direction.seo.description,
    services: benefits && !benefits.placeholder ? benefits.items.map((i) => i.title) : [],
    highlights: direction.proof.filter((p) => !p.placeholder).map((p) => p.text),
    locality: imp.positioning.locality,
  });

  const synthesized = synthesizeBlueprint(brief, {
    source: 'import',
    model: null,
    promptSha256: null,
    createdAt: options.createdAt,
    theme: designSystemToTheme(direction.designSystem),
  });

  const home = synthesized.pages.find((p) => p.path === '/');
  if (!home) return synthesized;

  const navigation = home.blocks.find((b) => b.kind === 'navigation');
  const footer = home.blocks.find((b) => b.kind === 'footer');
  const body: SiteBlock[] = [];
  let index = navigation ? 1 : 0;

  for (const component of visibleComponents(direction)) {
    if (component.placeholder) continue;
    const block = toBlock(component, index, brief, direction);
    if (!block) continue;
    body.push(block);
    index += 1;
  }

  const blocks: SiteBlock[] = [
    ...(navigation ? [navigation] : []),
    ...body,
    ...(footer ? [{ ...footer, id: `home-footer-${index}` }] : []),
  ];

  const pages = synthesized.pages.map((p) =>
    p.path === '/'
      ? { ...p, title: direction.seo.title, description: direction.seo.description, blocks }
      : p,
  );

  return recompileCompliance({
    ...synthesized,
    pages,
    seo: { ...synthesized.seo, defaultTitle: direction.seo.title, defaultDescription: direction.seo.description, keywords: direction.seo.keywords },
  });
}

type Brief = ReturnType<typeof parseBrief>;

function toBlock(c: RebuildComponent, index: number, brief: Brief, direction: RebuildDirection): SiteBlock | null {
  const make = (kind: BlockKind, content: Record<string, unknown>): SiteBlock => {
    const block = buildBlock(kind, index, '/', brief, false);
    return { ...block, content: { ...block.content, ...content } };
  };
  const items = c.items.map((i) => ({ label: i.title, description: i.text || null }));

  switch (c.kind) {
    case 'hero':
      return make('hero', {
        headline: c.text.headline ?? brief.name,
        subline: c.text.subline ?? brief.summary,
        primaryCta: { label: (c.cta ?? direction.primaryCta).label, href: (c.cta ?? direction.primaryCta).href },
      });
    case 'trust-bar':
    case 'process':
    case 'compliance-block':
    case 'pricing':
      return c.items.length > 0 ? make('features', { heading: c.text.heading ?? '', items }) : null;
    case 'problem-solution':
      return make('about', { heading: c.text.heading ?? 'Worum es geht', body: [c.text.problem, c.text.solution].filter(Boolean).join(' ') });
    case 'benefits':
      return make('services', { heading: c.text.heading ?? 'Leistungen', items });
    case 'faq':
      return make('faq', { heading: c.text.heading ?? 'Häufige Fragen', items: c.items.map((i) => ({ question: i.title, answer: i.text || null })) });
    case 'contact':
      return make('cta', { headline: (c.cta ?? direction.primaryCta).label, href: (c.cta ?? direction.primaryCta).href });
    case 'lead-form':
      return make('contact-form', { heading: c.text.heading ?? 'Anfrage', consentText: c.text.consentNote ?? direction.leadFlow.consentNote });
    case 'case-study':
      return c.text.quote ? make('testimonials', { heading: c.text.heading ?? 'Stimmen', items: [{ quote: c.text.quote }] }) : null;
    case 'automation-block':
      // Vorschläge für die Zeit nach der Veröffentlichung — kein Seiteninhalt.
      return null;
  }
}
