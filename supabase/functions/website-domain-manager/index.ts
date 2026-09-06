// website-domain-manager — Domain lifecycle management
// Connect, validate, disconnect domains with Cloudflare integration
//
// POST /functions/v1/website-domain-manager
// Body: { project_id, tenant_id, action, domain? }
//
// Actions:
//   1. connect-domain — Initiate domain connection
//   2. validate-domain — Check DNS propagation
//   3. disconnect-domain — Remove domain mapping
//   4. check-ssl — Verify SSL certificate
//
// Sicherheitsrelevanz (DSGVO Art. 32, EU AI Act Art. 12 Prüfpfad):
// Diese Function schreibt mit Service-Role und umgeht damit RLS. Die
// Mandantengrenze muss sie deshalb selbst ziehen. `tenant_id` aus dem Body
// ist eine Behauptung des Aufrufers, kein Nachweis — sie wird über
// `requireAuthAndTenant` gegen `memberships` geprüft, bevor irgendein
// privilegierter Zugriff stattfindet.
//
// Zweite Regel, die hier vorher fehlte: `domain` kommt ebenfalls aus dem Body.
// Jede Abfrage auf `website_domains` wird deshalb zusätzlich über
// `project_id` eingegrenzt — das Projekt ist zu diesem Zeitpunkt bereits als
// dem geprüften Mandanten zugehörig nachgewiesen. Ohne diese Eingrenzung
// erreicht ein Aufrufer mit vollständig eigenen, gültigen Zugangsdaten fremde
// Zeilen, ohne eine einzige fremde ID zu kennen.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { requireAuthAndTenant } from '../_shared/auth.ts';

interface DomainManagementRequest {
  project_id: string;
  tenant_id: string;
  action: 'connect-domain' | 'validate-domain' | 'disconnect-domain' | 'check-ssl';
  domain?: string;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonError(405, 'BAD_REQUEST', 'POST only');
  }

  try {
    const body: DomainManagementRequest = await req.json();

    // Identität und Mitgliedschaft zuerst — erst danach gibt es einen
    // Service-Role-Client. Ein unauthentifizierter Aufruf soll nicht am
    // Umweg über eine Eingabevalidierung erkennen, welche Felder es gibt.
    const auth = await requireAuthAndTenant(req, body.tenant_id);
    if (auth instanceof Response) return auth;
    const { admin, tenantId } = auth;

    if (!body.project_id || !body.action) {
      return jsonError(400, 'INVALID_INPUT', 'project_id, tenant_id, action required');
    }

    // Verify project exists — und zwar im geprüften Mandanten, nicht in dem
    // aus dem Body.
    const { data: project } = await admin
      .from('website_projects')
      .select('id')
      .eq('id', body.project_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!project) {
      return jsonError(404, 'PROJECT_NOT_FOUND', 'project does not exist');
    }

    let result;
    switch (body.action) {
      case 'connect-domain':
        result = await connectDomain(admin, body.project_id, tenantId, body.domain || '');
        break;
      case 'validate-domain':
        result = await validateDomain(admin, body.project_id, body.domain || '');
        break;
      case 'disconnect-domain':
        result = await disconnectDomain(admin, body.project_id, body.domain || '');
        break;
      case 'check-ssl':
        result = await checkSSL(admin, body.project_id, body.domain || '');
        break;
      default:
        return jsonError(400, 'INVALID_ACTION', 'unknown action');
    }

    if (!result.success) {
      return jsonError(500, result.code || 'DOMAIN_OPERATION_FAILED', result.error);
    }

    return jsonResponse(200, { success: true, data: result.data });
  } catch (err) {
    console.error('Error in website-domain-manager:', err);
    return jsonError(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Unknown error');
  }
});

// ============================================================================
// Domain Management Actions
// ============================================================================

async function connectDomain(
  admin: SupabaseClient,
  projectId: string,
  tenantId: string,
  domain: string
): Promise<{ success: boolean; data?: unknown; error?: string; code?: string }> {
  if (!domain || !domain.includes('.')) {
    return { success: false, error: 'Invalid domain format', code: 'INVALID_DOMAIN' };
  }

  const isSubdomain = domain.endsWith('realsyncdynamicsai.de');
  const domainType = isSubdomain ? 'subdomain' : 'custom';

  // GLOBAL: bewusst ohne Mandanten-Eingrenzung. `website_domains.domain` ist
  // systemweit UNIQUE — eine Domain kann nur einmal verbunden sein. Die
  // Prüfung muss deshalb über alle Mandanten laufen, sonst schlägt statt
  // dieser Meldung der Constraint zu. Nach aussen gibt sie nur „belegt"
  // preis, keine fremden Felder.
  const { data: existing } = await admin
    .from('website_domains')
    .select('id')
    .eq('domain', domain)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      error: 'Domain already in use',
      code: 'DOMAIN_ALREADY_EXISTS',
    };
  }

  // Create domain entry
  const { data: domainEntry, error } = await admin
    .from('website_domains')
    .insert({
      project_id: projectId,
      tenant_id: tenantId,
      domain,
      domain_type: domainType,
      cloudflare_status: 'pending',
      is_active: true,
    })
    .select('*')
    .single();

  if (error || !domainEntry) {
    return { success: false, error: error?.message || 'Failed to create domain entry', code: 'DB_ERROR' };
  }

  const response = {
    domain,
    domain_type: domainType,
    status: 'pending_validation',
  };

  if (isSubdomain) {
    return {
      success: true,
      data: {
        ...response,
        instructions: `Your subdomain ${domain} will be activated shortly.`,
      },
    };
  }

  // For custom domains, provide DNS instructions
  return {
    success: true,
    data: {
      ...response,
      dns_records: {
        CNAME: {
          name: domain,
          value: 'realsyncdynamics.pages.dev',
          ttl: 3600,
        },
        TXT: {
          name: `_acme-challenge.${domain}`,
          value: 'cloudflare-acme-challenge-token',
        },
      },
      instructions: `Update your DNS provider with the CNAME record: ${domain} -> realsyncdynamics.pages.dev`,
      validation_code: domainEntry.dns_validation_token,
    },
  };
}

async function validateDomain(
  admin: SupabaseClient,
  projectId: string,
  domain: string
): Promise<{ success: boolean; data?: unknown; error?: string; code?: string }> {
  // Die Zeile muss zum eigenen Projekt gehören, bevor irgendetwas geschieht.
  // Sonst löst eine fremde Domain im Body einen ausgehenden DNS-Aufruf und
  // anschliessend einen Schreibzugriff auf die fremde Zeile aus.
  const { data: existing } = await admin
    .from('website_domains')
    .select('id')
    .eq('domain', domain)
    .eq('project_id', projectId)
    .maybeSingle();

  if (!existing) {
    return { success: false, error: 'Domain not found', code: 'DOMAIN_NOT_FOUND' };
  }

  // Check DNS propagation
  const dnsValid = await checkDNSPropagation(domain);

  const status = dnsValid ? 'active' : 'validating';

  // Update domain status
  await admin
    .from('website_domains')
    .update({
      cloudflare_status: status,
      dns_validated_at: dnsValid ? new Date().toISOString() : null,
      last_checked_at: new Date().toISOString(),
    })
    .eq('domain', domain)
    .eq('project_id', projectId);

  if (dnsValid) {
    // Trigger SSL certificate issuance
    await admin
      .from('website_domains')
      .update({
        ssl_status: 'pending_validation',
        last_checked_at: new Date().toISOString(),
      })
      .eq('domain', domain)
      .eq('project_id', projectId);

    // In production, this would trigger Cloudflare SSL provisioning
    // For now, we simulate success
    return {
      success: true,
      data: {
        domain,
        status: 'active',
        dns_valid: true,
        ssl_status: 'pending',
        message: 'Domain validated. SSL certificate will be issued within 5 minutes.',
      },
    };
  }

  return {
    success: true,
    data: {
      domain,
      status: 'validating',
      dns_valid: false,
      message: 'DNS not yet propagated. Please check your DNS settings and try again in a few minutes.',
    },
  };
}

async function disconnectDomain(
  admin: SupabaseClient,
  projectId: string,
  domain: string
): Promise<{ success: boolean; data?: unknown; error?: string; code?: string }> {
  const { error } = await admin
    .from('website_domains')
    .delete()
    .eq('project_id', projectId)
    .eq('domain', domain);

  if (error) {
    return { success: false, error: error.message, code: 'DB_ERROR' };
  }

  return {
    success: true,
    data: {
      domain,
      status: 'disconnected',
      message: `Domain ${domain} has been disconnected.`,
    },
  };
}

async function checkSSL(
  admin: SupabaseClient,
  projectId: string,
  domain: string
): Promise<{ success: boolean; data?: unknown; error?: string; code?: string }> {
  // In production, this would check Cloudflare certificate status
  // For now, simulate based on domain validation status

  const { data: domainData } = await admin
    .from('website_domains')
    .select('cloudflare_status, dns_validated_at')
    .eq('domain', domain)
    .eq('project_id', projectId)
    .maybeSingle();

  if (!domainData) {
    return {
      success: false,
      error: 'Domain not found',
      code: 'DOMAIN_NOT_FOUND',
    };
  }

  let sslStatus = 'pending';
  if (domainData.cloudflare_status === 'active' && domainData.dns_validated_at) {
    sslStatus = 'active';
  }

  return {
    success: true,
    data: {
      domain,
      ssl_status: sslStatus,
      certificate: {
        issuer: 'Cloudflare',
        issued_date: new Date(Date.now() - 86400000).toISOString(),
        expires_date: new Date(Date.now() + 86400000 * 89).toISOString(),
        auto_renew: true,
      },
    },
  };
}

// ============================================================================
// DNS Helpers
// ============================================================================

async function checkDNSPropagation(domain: string): Promise<boolean> {
  // In production, this would check DNS propagation via Cloudflare or third-party service
  // For now, simulate successful propagation after a delay
  try {
    // Simulate DNS check (would use dig/nslookup in production)
    const response = await fetch(`https://dns.google/resolve?name=${domain}`, {
      signal: AbortSignal.timeout(3000),
    });

    if (response.ok) {
      const data = (await response.json()) as Record<string, unknown>;
      return (data.Status as number) === 0; // 0 = success
    }
  } catch {
    // Timeout or error — domain may still be propagating
  }

  return false;
}
