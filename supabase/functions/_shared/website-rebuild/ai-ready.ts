// Step 7 — ai_ready: Macht die Website AI-Crawler-freundlich.
//
// Drei Ergänzungen:
//   1. /llms.txt — Markdown-Index nach https://llmstxt.org/ Spec
//   2. JSON-LD <script> im <head> — Organization + WebSite + ggf. Article
//   3. /api/ai-info.json — strukturierter Endpoint für AI-Agents
//
// Nicht drin: robots.txt-Adjustments, sitemap.xml — das macht
// package_deploy beim finalen Schreiben des Bundles.

interface AiReadyContext {
  domain: string;
  title: string;
  description: string;
  company: string | null;
  contactEmail: string;
  privacyUrl: string;
  imprintUrl: string;
}

export function buildLlmsTxt(ctx: AiReadyContext): string {
  return `# ${ctx.title || ctx.domain}

> ${ctx.description || 'DSGVO-konforme Website von ' + (ctx.company ?? ctx.domain) + '.'}

## Compliance
- DSGVO-konform (RealSync DSGVO-Audit ${new Date().getFullYear()})
- Cookie-Consent: opt-in, Default-Deny
- Hosting: EU/EWR

## Pages
- [Datenschutzerklärung](${ctx.privacyUrl})
- [Impressum](${ctx.imprintUrl})

## API
- [AI-Info-Endpoint](https://${ctx.domain}/api/ai-info.json) — strukturierte Metadaten für AI-Agents

## Contact
- Email: ${ctx.contactEmail}
`;
}

export function buildAiInfoJson(ctx: AiReadyContext): string {
  return JSON.stringify({
    schema: 'https://schemas.realsyncdynamics.ai/ai-info/v1',
    domain: ctx.domain,
    title: ctx.title,
    description: ctx.description,
    organization: {
      name: ctx.company ?? ctx.domain,
      contact_email: ctx.contactEmail,
    },
    compliance: {
      gdpr: true,
      consent_mode: 'opt-in',
      data_residency: 'EU/EWR',
      audited_by: 'RealSyncDynamics.AI',
      audit_methodology_version: '2026.05.0',
    },
    legal_pages: {
      privacy: ctx.privacyUrl,
      imprint: ctx.imprintUrl,
    },
    crawl_policy: {
      allow_ai_crawlers: true,
      training_opt_out: false,
      cite_required: true,
    },
  }, null, 2);
}

export function buildJsonLd(ctx: AiReadyContext): string {
  const orgName = ctx.company ?? ctx.domain;
  const blocks = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: orgName,
      url: `https://${ctx.domain}`,
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        email: ctx.contactEmail,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: ctx.title || orgName,
      url: `https://${ctx.domain}`,
      description: ctx.description,
      inLanguage: 'de',
    },
  ];
  return blocks
    .map((b) => `<script type="application/ld+json">\n${JSON.stringify(b, null, 2)}\n</script>`)
    .join('\n');
}

export function injectJsonLd(html: string, jsonLd: string): string {
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${jsonLd}\n</head>`);
  }
  return jsonLd + '\n' + html;
}
