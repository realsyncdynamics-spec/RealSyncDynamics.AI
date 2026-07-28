// Statische Analyse des Blueprints (vor dem Deployment).
//
// Diese Analysatoren arbeiten auf der Struktur, nicht auf der ausgelieferten
// Seite. Sie fangen genau die Klasse von Fehlern, die man nach dem Go-live
// teuer bezahlt: fehlendes Impressum, Formular ohne Rechtsgrundlage,
// generierter Inhalt ohne Transparenzhinweis. Der Compliance-Agent lässt
// einen Blueprint mit `critical`-Befunden nicht deployen.
//
// Alle Befund-Codes sind stabil und dürfen nie umbenannt werden — sie sind
// Fremdschlüssel in `governance_controls` und in Kundenberichten.

import type { RuntimeFinding, SiteBlock, SiteBlueprint } from '../types.ts';

export function analyzeBlueprint(blueprint: SiteBlueprint): RuntimeFinding[] {
  return [
    ...checkLegalPages(blueprint),
    ...checkForms(blueprint),
    ...checkAiTransparency(blueprint),
    ...checkThirdParties(blueprint),
    ...checkAccessibility(blueprint),
    ...checkSeo(blueprint),
    ...checkContentReadiness(blueprint),
    ...checkDpia(blueprint),
  ];
}

// ── DSGVO / DDG: Pflichtseiten ──────────────────────────────────────────

function checkLegalPages(bp: SiteBlueprint): RuntimeFinding[] {
  const paths = new Set(bp.pages.map((p) => p.path));
  const findings: RuntimeFinding[] = [];

  if (!paths.has('/impressum')) {
    findings.push({
      code: 'gdpr.missing-impressum',
      dimension: 'gdpr',
      severity: 'critical',
      title: 'Kein Impressum vorhanden',
      reference: '§ 5 DDG',
      remediation: 'Seite /impressum mit den Pflichtangaben des Anbieters ergänzen.',
      locator: null,
    });
  }

  if (!paths.has('/datenschutz')) {
    findings.push({
      code: 'gdpr.missing-privacy-policy',
      dimension: 'gdpr',
      severity: 'critical',
      title: 'Keine Datenschutzerklärung vorhanden',
      reference: 'Art. 13 DSGVO',
      remediation: 'Seite /datenschutz mit Informationen zur Verarbeitung ergänzen.',
      locator: null,
    });
  }

  return findings;
}

// ── DSGVO: Formulare ────────────────────────────────────────────────────

const DATA_ENTRY_KINDS = new Set(['contact-form', 'booking']);

function checkForms(bp: SiteBlueprint): RuntimeFinding[] {
  const findings: RuntimeFinding[] = [];

  for (const { page, block } of eachBlock(bp)) {
    if (!DATA_ENTRY_KINDS.has(block.kind)) continue;
    const content = block.content as { legalBasis?: unknown; privacyHref?: unknown };

    if (typeof content.legalBasis !== 'string' || content.legalBasis.trim() === '') {
      findings.push({
        code: 'gdpr.form-without-legal-basis',
        dimension: 'gdpr',
        severity: 'high',
        title: 'Formular ohne dokumentierte Rechtsgrundlage',
        reference: 'Art. 6 DSGVO',
        remediation: 'Rechtsgrundlage am Block hinterlegen und im Verarbeitungsverzeichnis führen.',
        locator: `${page.path}#${block.id}`,
      });
    }

    if (typeof content.privacyHref !== 'string' || content.privacyHref.trim() === '') {
      findings.push({
        code: 'gdpr.form-without-privacy-link',
        dimension: 'gdpr',
        severity: 'medium',
        title: 'Formular ohne Verweis auf die Datenschutzerklärung',
        reference: 'Art. 13 Abs. 1 DSGVO',
        remediation: 'Hinweis mit Link auf /datenschutz direkt am Formular ergänzen.',
        locator: `${page.path}#${block.id}`,
      });
    }
  }

  return findings;
}

// ── EU AI Act: Transparenz ──────────────────────────────────────────────

function checkAiTransparency(bp: SiteBlueprint): RuntimeFinding[] {
  const findings: RuntimeFinding[] = [];

  for (const page of bp.pages) {
    const hasGenerated = page.blocks.some((b) => b.aiGenerated);
    const hasDisclosure = page.blocks.some((b) => b.kind === 'ai-disclosure');
    if (hasGenerated && !hasDisclosure) {
      findings.push({
        code: 'eu-ai-act.missing-disclosure',
        dimension: 'eu-ai-act',
        severity: 'high',
        title: 'Generierte Inhalte ohne Transparenzhinweis',
        reference: 'Art. 50 EU AI Act',
        remediation: 'Block „ai-disclosure" auf der Seite ergänzen.',
        locator: page.path,
      });
    }
  }

  // Ist der Blueprint generativ erzeugt, muss das Modell dokumentiert sein —
  // ohne Modellangabe ist der Nachweis der Herkunft unvollständig.
  if (bp.origin.source === 'ai-builder' && !bp.origin.model) {
    findings.push({
      code: 'eu-ai-act.undocumented-model',
      dimension: 'eu-ai-act',
      severity: 'medium',
      title: 'Generierende KI nicht dokumentiert',
      reference: 'Art. 50 EU AI Act',
      remediation: 'Modell-ID in origin.model hinterlegen (Herkunftsnachweis).',
      locator: null,
    });
  }

  return findings;
}

// ── TDDDG: Drittanbieter ────────────────────────────────────────────────

function checkThirdParties(bp: SiteBlueprint): RuntimeFinding[] {
  const findings: RuntimeFinding[] = [];

  for (const { page, block } of eachBlock(bp)) {
    if (block.thirdPartyHosts.length === 0) continue;
    const requiresConsent = (block.content as { requiresConsent?: unknown }).requiresConsent === true;
    if (requiresConsent) continue;

    findings.push({
      code: 'tdddg.third-party-without-consent-gate',
      dimension: 'tdddg',
      severity: 'high',
      title: 'Drittanbieter-Einbindung ohne Einwilligungsschranke',
      reference: '§ 25 Abs. 1 TDDDG',
      remediation: `Block erst nach Einwilligung laden (Hosts: ${block.thirdPartyHosts.join(', ')}).`,
      locator: `${page.path}#${block.id}`,
    });
  }

  return findings;
}

// ── Barrierefreiheit ────────────────────────────────────────────────────

function checkAccessibility(bp: SiteBlueprint): RuntimeFinding[] {
  const findings: RuntimeFinding[] = [];

  if (!bp.pages.some((p) => p.path === '/barrierefreiheit')) {
    findings.push({
      code: 'accessibility.missing-statement',
      dimension: 'accessibility',
      severity: 'medium',
      title: 'Keine Erklärung zur Barrierefreiheit',
      reference: 'BFSG § 14',
      remediation: 'Seite /barrierefreiheit mit Stand und Kontaktweg ergänzen.',
      locator: null,
    });
  }

  for (const { page, block } of eachBlock(bp)) {
    const media = (block.content as { media?: { alt?: unknown } }).media;
    if (!media) continue;
    if (typeof media.alt !== 'string' || media.alt.trim() === '') {
      findings.push({
        code: 'accessibility.media-without-alt',
        dimension: 'accessibility',
        severity: 'medium',
        title: 'Medienelement ohne Alternativtext',
        reference: 'WCAG 2.2 — 1.1.1',
        remediation: 'Aussagekräftigen Alternativtext am Medienelement hinterlegen.',
        locator: `${page.path}#${block.id}`,
      });
    }
  }

  return findings;
}

// ── SEO ─────────────────────────────────────────────────────────────────

function checkSeo(bp: SiteBlueprint): RuntimeFinding[] {
  const findings: RuntimeFinding[] = [];
  const seenTitles = new Map<string, string>();

  for (const page of bp.pages) {
    if (page.description.trim() === '') {
      findings.push({
        code: 'seo.missing-description',
        dimension: 'seo',
        severity: 'medium',
        title: 'Seite ohne Meta-Beschreibung',
        reference: 'SEO-Basis',
        remediation: 'Beschreibung mit 120–160 Zeichen ergänzen.',
        locator: page.path,
      });
    }

    const previous = seenTitles.get(page.title);
    if (previous !== undefined && !page.noindex) {
      findings.push({
        code: 'seo.duplicate-title',
        dimension: 'seo',
        severity: 'low',
        title: 'Doppelter Seitentitel',
        reference: 'SEO-Basis',
        remediation: `Titel eindeutig machen (Kollision mit ${previous}).`,
        locator: page.path,
      });
    } else {
      seenTitles.set(page.title, page.path);
    }
  }

  if (bp.seo.structuredDataType.trim() === '') {
    findings.push({
      code: 'seo.missing-structured-data',
      dimension: 'seo',
      severity: 'low',
      title: 'Kein schema.org-Typ hinterlegt',
      reference: 'schema.org',
      remediation: 'Passenden Typ für JSON-LD setzen.',
      locator: null,
    });
  }

  return findings;
}

// ── Redaktionelle Reife ─────────────────────────────────────────────────

function checkContentReadiness(bp: SiteBlueprint): RuntimeFinding[] {
  const findings: RuntimeFinding[] = [];

  for (const { page, block } of eachBlock(bp)) {
    const content = block.content as {
      items?: unknown;
      requiresRealContent?: unknown;
      members?: unknown;
    };

    // Blöcke, die ausdrücklich echte Inhalte verlangen (Bewertungen, Team),
    // dürfen nicht leer live gehen — sonst steht dort eine Platzhalterhülle.
    if (content.requiresRealContent === true && Array.isArray(content.items) && content.items.length === 0) {
      findings.push({
        code: 'content.awaiting-real-content',
        dimension: 'content',
        severity: 'low',
        title: 'Block wartet auf echte Inhalte',
        reference: '§ 5 UWG (Irreführungsverbot)',
        remediation: 'Echte Inhalte einpflegen oder Block vor dem Deployment entfernen.',
        locator: `${page.path}#${block.id}`,
      });
    }

    if (Array.isArray(content.items)) {
      const unresolved = content.items.filter(
        (item) => typeof item === 'object' && item !== null && Object.values(item).some((v) => v === null),
      ).length;
      if (unresolved > 0) {
        findings.push({
          code: 'content.unresolved-placeholder',
          dimension: 'content',
          severity: 'info',
          title: `${unresolved} unausgefüllte Platzhalter im Block`,
          reference: 'Redaktionelle Freigabe',
          remediation: 'Content-Agent laufen lassen oder Inhalte manuell ergänzen.',
          locator: `${page.path}#${block.id}`,
        });
      }
    }
  }

  return findings;
}

// ── DSFA ────────────────────────────────────────────────────────────────

function checkDpia(bp: SiteBlueprint): RuntimeFinding[] {
  if (!bp.compliance.dpiaRequired) return [];
  return [{
    code: 'gdpr.dpia-required',
    dimension: 'gdpr',
    severity: 'high',
    title: 'Datenschutz-Folgenabschätzung erforderlich',
    reference: 'Art. 35 DSGVO',
    remediation: 'DSFA im Governance-Modul anlegen und vor dem Go-live abschließen.',
    locator: null,
  }];
}

// ── Iteration ───────────────────────────────────────────────────────────

function* eachBlock(bp: SiteBlueprint): Generator<{ page: SiteBlueprint['pages'][number]; block: SiteBlock }> {
  for (const page of bp.pages) {
    for (const block of page.blocks) yield { page, block };
  }
}
