/**
 * Single hand-off contract for /audit -> SiteOS -> optional Voice -> Governance.
 *
 * Only navigation context crosses the public boundary; no audit findings,
 * customer secrets, login credentials or unverifiable backend assumptions.
 * Server-side URL validation, tenant authorization and publish gates remain
 * mandatory. The website source is never modified by these helpers.
 */
export function normalizeWebsiteSource(input: string): string | null {
  const raw = input.trim();
  if (!raw || /\s/.test(raw) || raw.startsWith('//')) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return null;

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase();
    // Public website flow only. The SiteOS service must still enforce
    // DNS/redirect-level SSRF protection when fetching the domain.
    if (
      !hostname.includes('.') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.localhost') ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) ||
      hostname.includes(':') ||
      url.port
    ) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function websiteHandoffHref(domain: string, auditId?: string | null): string {
  const sourceUrl = normalizeWebsiteSource(domain);
  if (!sourceUrl) return '/handwerk-website';
  const params = new URLSearchParams({ source_url: sourceUrl, source: 'post_scan' });
  if (auditId) params.set('audit_id', auditId);
  return `/handwerk-website?${params.toString()}`;
}

export function voiceHandoffHref(domain: string, auditId?: string | null): string {
  const params = new URLSearchParams({ source: 'website_transformation' });
  const sourceUrl = normalizeWebsiteSource(domain);
  if (sourceUrl) params.set('domain', new URL(sourceUrl).hostname);
  if (auditId) params.set('audit_id', auditId);
  return `/phonebot/start?${params.toString()}`;
}

export function governanceHandoffHref(auditId?: string | null): string {
  const next = auditId
    ? `/app/activation?audit_id=${encodeURIComponent(auditId)}`
    : '/app/activation';
  return `/welcome?next=${encodeURIComponent(next)}&source=website_transformation`;
}
