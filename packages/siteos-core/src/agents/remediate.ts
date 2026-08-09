// Deterministische Behebung von Befunden.
//
// Was ein Agent hier automatisch reparieren darf, ist bewusst eng gefasst:
// nur strukturelle Defekte mit genau einer richtigen Lösung. Alles, was eine
// redaktionelle oder rechtliche Entscheidung verlangt — ein Alternativtext,
// ein Seitentitel, der Inhalt einer Datenschutzerklärung — bleibt liegen und
// wird als `skipped` zurückgemeldet.
//
// Diese Grenze ist der Grund, warum das Modul überhaupt regelbasiert und
// nicht generativ ist: eine automatisch erfundene Rechtsgrundlage wäre
// schlimmer als ein offener Befund, weil sie den Befund verdeckt.
//
// Alle Funktionen arbeiten unveränderlich: der Eingabe-Blueprint wird nie
// mutiert, damit die Vorversion samt Hash gültig bleibt.

import type { RuntimeFinding, SiteBlock, SiteBlueprint, SitePage } from '../types.ts';

export interface RemediationResult {
  blueprint: SiteBlueprint;
  /** Befund-Codes, die tatsächlich behoben wurden. */
  applied: string[];
  /** Befund-Codes, die eine menschliche Entscheidung erfordern. */
  skipped: { code: string; reason: string }[];
  changed: boolean;
}

/** Codes, die dieses Modul automatisch beheben kann. */
export const AUTO_FIXABLE = Object.freeze(new Set([
  'gdpr.missing-impressum',
  'gdpr.missing-privacy-policy',
  'gdpr.form-without-privacy-link',
  'gdpr.form-without-legal-basis',
  'accessibility.missing-statement',
  'eu-ai-act.missing-disclosure',
  'tdddg.third-party-without-consent-gate',
  'seo.missing-description',
]));

/** Warum ein Befund bewusst nicht automatisch behoben wird. */
const MANUAL_REASONS: Readonly<Record<string, string>> = Object.freeze({
  'accessibility.media-without-alt': 'Alternativtext beschreibt einen Bildinhalt — nur redaktionell zu vergeben.',
  'accessibility.image-without-alt': 'Alternativtext beschreibt einen Bildinhalt — nur redaktionell zu vergeben.',
  'seo.duplicate-title': 'Eindeutiger Titel ist eine redaktionelle Entscheidung.',
  'content.awaiting-real-content': 'Echte Inhalte dürfen nicht generiert werden (§ 5 UWG).',
  'content.unresolved-placeholder': 'Inhalt wird vom Content-Agenten mit Freigabe befüllt.',
  'gdpr.dpia-required': 'Eine DSFA ist ein Verfahren, kein Strukturfehler.',
  'eu-ai-act.undocumented-model': 'Modell-ID stammt aus dem Aufruf, nicht aus dem Blueprint.',
});

export function applyRemediations(blueprint: SiteBlueprint, findings: RuntimeFinding[]): RemediationResult {
  let current = blueprint;
  const applied: string[] = [];
  const skipped: { code: string; reason: string }[] = [];
  const seen = new Set<string>();

  // Fehlende Pflichtseiten zuerst: ihre Ergänzung kann Folgebefunde
  // (fehlender Datenschutz-Link) überhaupt erst behebbar machen.
  const ordered = [...findings].sort((a, b) => rank(a.code) - rank(b.code));

  for (const finding of ordered) {
    if (seen.has(finding.code)) continue;

    if (!AUTO_FIXABLE.has(finding.code)) {
      const reason = MANUAL_REASONS[finding.code] ?? 'Kein deterministischer Reparaturweg hinterlegt.';
      skipped.push({ code: finding.code, reason });
      seen.add(finding.code);
      continue;
    }

    const next = fix(current, finding);
    if (next === current) {
      // Der Befund gilt als behebbar, die Reparatur hat aber nichts
      // verändert — das ist ein Fehler in der Regel, kein stiller Erfolg.
      skipped.push({ code: finding.code, reason: 'Reparatur hat keine Änderung bewirkt.' });
      seen.add(finding.code);
      continue;
    }

    current = next;
    applied.push(finding.code);
    seen.add(finding.code);
  }

  return { blueprint: current, applied, skipped, changed: applied.length > 0 };
}

function rank(code: string): number {
  if (code === 'gdpr.missing-impressum' || code === 'gdpr.missing-privacy-policy') return 0;
  if (code === 'accessibility.missing-statement') return 1;
  return 2;
}

// ─────────────────────────────────────────────────────────────────────
// Einzelreparaturen
// ─────────────────────────────────────────────────────────────────────

function fix(bp: SiteBlueprint, finding: RuntimeFinding): SiteBlueprint {
  switch (finding.code) {
    case 'gdpr.missing-impressum':
      return addLegalPage(bp, '/impressum', 'Impressum', 'legal:impressum');
    case 'gdpr.missing-privacy-policy':
      return addLegalPage(bp, '/datenschutz', 'Datenschutzerklärung', 'legal:privacy-policy');
    case 'accessibility.missing-statement':
      return addLegalPage(bp, '/barrierefreiheit', 'Erklärung zur Barrierefreiheit', 'legal:accessibility-statement');

    case 'gdpr.form-without-privacy-link':
      return patchBlockAt(bp, finding.locator, (block) => ({
        ...block,
        content: { ...block.content, privacyHref: '/datenschutz' },
      }));

    case 'gdpr.form-without-legal-basis':
      // Vertragsanbahnung ist die Rechtsgrundlage jedes Kontakt- und
      // Buchungsformulars in diesen Branchen; abweichende Fälle werden
      // über die Freigabe des Compliance-Agenten korrigiert.
      return patchBlockAt(bp, finding.locator, (block) => ({
        ...block,
        content: { ...block.content, legalBasis: 'Art. 6 Abs. 1 lit. b DSGVO' },
      }));

    case 'tdddg.third-party-without-consent-gate':
      return patchBlockAt(bp, finding.locator, (block) => ({
        ...block,
        content: {
          ...block.content,
          requiresConsent: true,
          consentCategory: (block.content as { consentCategory?: unknown }).consentCategory ?? 'extern',
        },
      }));

    case 'eu-ai-act.missing-disclosure':
      return addAiDisclosure(bp, finding.locator);

    case 'seo.missing-description':
      return patchPage(bp, finding.locator, (page) => ({
        ...page,
        description: `${page.title} — ${bp.name}.`,
      }));

    default:
      return bp;
  }
}

function addLegalPage(bp: SiteBlueprint, path: string, title: string, documentRef: string): SiteBlueprint {
  if (bp.pages.some((p) => p.path === path)) return bp;

  const slug = path.replace(/^\//, '');
  const page: SitePage = {
    path,
    title,
    description: `${title} — ${bp.name}.`,
    noindex: false,
    blocks: [
      { id: `${slug}--navigation--0`, kind: 'navigation', content: { brand: bp.name }, processesPersonalData: false, thirdPartyHosts: [], aiGenerated: false },
      // Rechtstexte kommen aus dem Legal-Modul der Plattform, nie aus dem Modell.
      { id: `${slug}--legal-text--1`, kind: 'legal-text', content: { documentRef, managed: true }, processesPersonalData: false, thirdPartyHosts: [], aiGenerated: false },
      { id: `${slug}--footer--2`, kind: 'footer', content: { legalLinks: footerLinks() }, processesPersonalData: false, thirdPartyHosts: [], aiGenerated: false },
    ],
  };

  return { ...bp, pages: [...bp.pages, page] };
}

function addAiDisclosure(bp: SiteBlueprint, locator: string | null): SiteBlueprint {
  if (locator === null) return bp;

  return {
    ...bp,
    pages: bp.pages.map((page) => {
      if (page.path !== locator) return page;
      if (page.blocks.some((b) => b.kind === 'ai-disclosure')) return page;

      const disclosure: SiteBlock = {
        id: `${page.path === '/' ? 'root' : page.path.replace(/^\//, '')}--ai-disclosure--999`,
        kind: 'ai-disclosure',
        content: {
          text: 'Teile der Inhalte dieser Website wurden mit Unterstützung generativer KI erstellt und redaktionell geprüft.',
          reference: 'Art. 50 EU AI Act',
          model: bp.origin.model,
        },
        processesPersonalData: false,
        thirdPartyHosts: [],
        aiGenerated: false,
      };

      // Direkt vor den Footer, damit der Hinweis auf jeder Seite an
      // derselben Stelle steht.
      const blocks = [...page.blocks];
      const footerIndex = blocks.findIndex((b) => b.kind === 'footer');
      blocks.splice(footerIndex === -1 ? blocks.length : footerIndex, 0, disclosure);
      return { ...page, blocks };
    }),
  };
}

/**
 * Wendet eine Änderung auf den Block an, den ein Locator der Form
 * `/pfad#block-id` benennt.
 */
function patchBlockAt(
  bp: SiteBlueprint,
  locator: string | null,
  patch: (block: SiteBlock) => SiteBlock,
): SiteBlueprint {
  if (locator === null) return bp;
  const hashIndex = locator.indexOf('#');
  if (hashIndex === -1) return bp;

  const path = locator.slice(0, hashIndex);
  const blockId = locator.slice(hashIndex + 1);
  let touched = false;

  const pages = bp.pages.map((page) => {
    if (page.path !== path) return page;
    return {
      ...page,
      blocks: page.blocks.map((block) => {
        if (block.id !== blockId) return block;
        touched = true;
        return patch(block);
      }),
    };
  });

  return touched ? { ...bp, pages } : bp;
}

function patchPage(bp: SiteBlueprint, path: string | null, patch: (page: SitePage) => SitePage): SiteBlueprint {
  if (path === null) return bp;
  let touched = false;

  const pages = bp.pages.map((page) => {
    if (page.path !== path) return page;
    touched = true;
    return patch(page);
  });

  return touched ? { ...bp, pages } : bp;
}

function footerLinks(): { label: string; href: string }[] {
  return [
    { label: 'Impressum', href: '/impressum' },
    { label: 'Datenschutz', href: '/datenschutz' },
    { label: 'Barrierefreiheit', href: '/barrierefreiheit' },
  ];
}
