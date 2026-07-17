// website-operations-agent — AI-powered website creation orchestrator
// Generates professional websites from industry + company info using Claude AI
//
// POST /functions/v1/website-operations-agent
// Body: { tenant_id, industry, company_name, description?, services?, images?, style_preferences?, existing_html? }
//
// Workflow:
//   1. Validate input + match template
//   2. AI: Generate website structure (hero, sections, content)
//   3. AI: Generate HTML/CSS/SEO
//   4. Compliance: DSGVO + EU AI Act checks
//   5. Create website_projects entry
//   6. Return generated website + preview URL

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { withErrorHandling, generateRequestId, logOperation } from '../_shared/middleware.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

interface WebsiteGenerationRequest {
  tenant_id: string;
  industry: string;
  company_name: string;
  description?: string;
  services?: string[];
  images?: string[];
  contact_email?: string;
  contact_phone?: string;
  style_preferences?: {
    colors?: { primary?: string; secondary?: string };
    layout?: 'modern' | 'traditional' | 'minimal' | 'bold';
  };
  existing_html?: string;
}

interface GeneratedWebsite {
  project_id: string;
  html: string;
  css: string;
  sections: string[];
  seo_metadata: Record<string, unknown>;
  compliance_status: string;
  preview_url: string;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonError(405, 'BAD_REQUEST', 'POST only');
  }

  try {
    const body: WebsiteGenerationRequest = await req.json();

    // Validation
    if (!body.tenant_id || !body.industry || !body.company_name) {
      return jsonError(400, 'INVALID_INPUT', 'tenant_id, industry, company_name required');
    }

    // 1. Verify tenant exists
    const { data: tenant, error: tenantErr } = await admin
      .from('tenants')
      .select('id')
      .eq('id', body.tenant_id)
      .single();

    if (tenantErr || !tenant) {
      return jsonError(404, 'TENANT_NOT_FOUND', 'tenant does not exist');
    }

    // 2. Create website project entry
    const { data: project, error: projectErr } = await admin
      .from('website_projects')
      .insert({
        tenant_id: body.tenant_id,
        name: body.company_name,
        industry: body.industry,
        description: body.description || null,
        status: 'draft',
        company_info: {
          name: body.company_name,
          description: body.description || '',
          contact_email: body.contact_email,
          contact_phone: body.contact_phone,
          images: body.images || [],
        },
        services: body.services?.map((s) => ({ name: s, description: '', icon: 'star' })) || [],
        configuration: {
          theme: body.style_preferences?.layout || 'modern',
          colors: body.style_preferences?.colors || {},
        },
      })
      .select('*')
      .single();

    if (projectErr || !project) {
      return jsonError(500, 'DB_INSERT', 'failed to create project');
    }

    // 3. Generate website using AI
    const website = await generateWebsiteWithAI(body, project.id);

    if (!website.success) {
      // Log error but don't fail entirely
      await admin.from('deployment_logs').insert({
        project_id: project.id,
        tenant_id: body.tenant_id,
        event_type: 'build',
        status: 'warning',
        title: 'AI Generation Warning',
        message: website.error,
        triggered_by: 'automation',
      });
    }

    // 4. Run compliance checks
    const complianceResult = await runComplianceChecks(
      website.html || '',
      project.id,
      body.tenant_id,
      website.aiDisclosures || []
    );

    // 5. Store generated content
    await admin
      .from('website_projects')
      .update({
        status: 'preview',
        configuration: {
          ...project.configuration,
          generated_html: website.html,
          generated_css: website.css,
          sections: website.sections,
          seo_metadata: website.seo,
          ai_disclosures: website.aiDisclosures,
        },
        compliance_score: complianceResult.score,
        compliance_findings: complianceResult.findings,
      })
      .eq('id', project.id);

    // 6. Log deployment event
    await admin.from('deployment_logs').insert({
      project_id: project.id,
      tenant_id: body.tenant_id,
      event_type: 'build',
      status: 'success',
      title: 'Website Generated',
      message: `Generated website for ${body.company_name}`,
      details: {
        sections: website.sections,
        compliance_score: complianceResult.score,
      },
      triggered_by: 'automation',
    });

    const response: GeneratedWebsite = {
      project_id: project.id,
      html: website.html || '',
      css: website.css || '',
      sections: website.sections,
      seo_metadata: website.seo,
      compliance_status: complianceResult.score >= 75 ? 'compliant' : 'review_needed',
      preview_url: `https://${project.id}.preview.realsyncdynamics.pages.dev`,
    };

    return jsonResponse(200, response);
  } catch (err) {
    console.error('Error in website-operations-agent:', err);
    return jsonError(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Unknown error');
  }
});

// ============================================================================
// AI Website Generation using Claude
// ============================================================================

interface AIGenerationResult {
  success: boolean;
  html?: string;
  css?: string;
  sections: string[];
  seo: Record<string, unknown>;
  aiDisclosures: string[];
  error?: string;
}

async function generateWebsiteWithAI(
  req: WebsiteGenerationRequest,
  projectId: string
): Promise<AIGenerationResult> {
  const industryTemplates: Record<string, string> = {
    'tattoo-studio': 'professional portfolio with gallery, artist profiles, and booking CTA',
    'handwerker': 'service showcase with project gallery and contact form',
    'dienstleister': 'service-focused with process explanation and testimonials',
    'einzelunternehmer': 'personal brand site with about section and services list',
  };

  const template = industryTemplates[req.industry] || 'professional business website';

  const prompt = `You are a professional web designer creating a website for a ${req.industry} business.

Company Details:
- Name: ${req.company_name}
- Description: ${req.description || 'Not provided'}
- Services: ${req.services?.join(', ') || 'Not specified'}
- Contact: ${req.contact_email || 'Not provided'}

Template Style: ${template}

Generate a complete, modern, mobile-responsive website. Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:

{
  "html": "<html>...</html>",
  "css": "<style>...</style>",
  "sections": ["hero", "services", "about", ...],
  "seo": {
    "title": "...",
    "description": "...",
    "keywords": ["keyword1", "keyword2"]
  },
  "ai_disclosure": "This website was generated with AI assistance by RealSyncDynamics.AI"
}

Requirements:
1. HTML must be complete, valid, and self-contained
2. Include proper DSGVO placeholders (Privacy Policy, Impressum)
3. Add cookie consent banner code
4. Use semantic HTML5
5. Responsive design (mobile-first)
6. Accessibility (WCAG 2.1 AA)
7. CSS must be embedded in <style> tag
8. No external dependencies except fonts
9. Include JSON-LD schema for SEO
10. Include OG meta tags

Return ONLY the JSON object, nothing else.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        success: false,
        sections: [],
        seo: {},
        aiDisclosures: [],
        error: `Claude API error: ${response.status} - ${errorBody}`,
      };
    }

    const data = await response.json() as Record<string, unknown>;
    const content = (data.content as Array<Record<string, unknown>>)?.[0]?.text as string;

    if (!content) {
      return {
        success: false,
        sections: [],
        seo: {},
        aiDisclosures: [],
        error: 'No content from Claude',
      };
    }

    // Parse JSON response
    const generated = JSON.parse(content) as {
      html: string;
      css: string;
      sections: string[];
      seo: Record<string, unknown>;
      ai_disclosure: string;
    };

    return {
      success: true,
      html: generated.html,
      css: generated.css,
      sections: generated.sections || ['hero', 'services', 'contact'],
      seo: generated.seo || {},
      aiDisclosures: [generated.ai_disclosure],
    };
  } catch (err) {
    console.error('AI generation error:', err);
    return {
      success: false,
      sections: ['hero', 'services', 'contact'],
      seo: {},
      aiDisclosures: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Compliance Checking (DSGVO + EU AI Act)
// ============================================================================

interface ComplianceResult {
  score: number;
  findings: Array<{
    category: string;
    severity: 'critical' | 'warning' | 'info';
    title: string;
    description: string;
  }>;
}

async function runComplianceChecks(
  html: string,
  projectId: string,
  tenantId: string,
  aiDisclosures: string[]
): Promise<ComplianceResult> {
  const findings: ComplianceResult['findings'] = [];
  let score = 100;

  // 1. Check for cookie consent
  if (!html.includes('cookie') && !html.includes('consent')) {
    findings.push({
      category: 'cookies',
      severity: 'critical',
      title: 'Cookie Consent Missing',
      description: 'Website must have cookie consent banner for DSGVO compliance',
    });
    score -= 20;
  }

  // 2. Check for privacy policy
  if (!html.includes('datenschutz') && !html.includes('privacy')) {
    findings.push({
      category: 'legal_pages',
      severity: 'critical',
      title: 'Privacy Policy Missing',
      description: 'Datenschutzerklärung (Privacy Policy) is required by DSGVO',
    });
    score -= 15;
  }

  // 3. Check for Impressum (legal requirement for German businesses)
  if (!html.includes('impressum') && !html.includes('legal')) {
    findings.push({
      category: 'legal_pages',
      severity: 'critical',
      title: 'Impressum Missing',
      description: 'German businesses must have Impressum (legal notice)',
    });
    score -= 15;
  }

  // 4. AI Disclosure
  if (!aiDisclosures.length) {
    findings.push({
      category: 'ai_disclosure',
      severity: 'warning',
      title: 'No AI Disclosure',
      description: 'EU AI Act requires disclosure that website was generated with AI',
    });
    score -= 10;
  }

  // 5. Tracking/Analytics
  if (html.includes('google-analytics') || html.includes('ga.js')) {
    findings.push({
      category: 'tracking',
      severity: 'warning',
      title: 'Analytics Tracking',
      description: 'External analytics require explicit consent under DSGVO',
    });
    score -= 5;
  }

  // 6. External resources
  const externalCount = (html.match(/https?:\/\/(?!realsyncdynamics)/gi) || []).length;
  if (externalCount > 5) {
    findings.push({
      category: 'external_resources',
      severity: 'info',
      title: `${externalCount} External Resources`,
      description: 'Many external resources may impact performance and privacy',
    });
    score -= 5;
  }

  // Store compliance report
  await admin.from('website_compliance_reports').insert({
    project_id: projectId,
    tenant_id: tenantId,
    report_type: 'full',
    overall_score: Math.max(0, score),
    dsgvo_score: Math.max(0, score - (findings.filter((f) => f.category !== 'ai_disclosure').length * 5)),
    eu_ai_act_score: aiDisclosures.length ? 85 : 50,
    findings: findings,
    status: score >= 75 ? 'compliant' : 'review_needed',
  });

  return {
    score: Math.max(0, score),
    findings,
  };
}
