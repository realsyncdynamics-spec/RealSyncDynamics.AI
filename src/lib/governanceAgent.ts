// Governance Agent Client
// Provides access to Claude-powered compliance recommendations
// Handles token budgeting, caching, and fallback to rule-based system

import { getSupabase } from './supabase';

export interface GovernanceAgentRequest {
  tenantId: string;
  prompt: string;
  systemPrompt?: string;
  context?: Record<string, any>;
  maxTokens?: number;
  temperature?: number;
}

export interface GovernanceAgentResponse {
  content: string;
  tokensUsed: number;
  cached: boolean;
  generatedAt: string;
}

interface CachedResponse {
  content: string;
  tokensUsed: number;
  createdAt: string;
  expiresAt: string;
}

const CACHE_TTL_MINUTES = 60;
const DEFAULT_MAX_TOKENS = 1024;
const TOKEN_BUDGET_PER_TENANT_PER_HOUR = 10000;
const RATE_LIMIT_PER_HOUR = 3;

// In-memory cache (should be Redis in production)
const responseCache = new Map<string, CachedResponse>();

function getCacheKey(tenantId: string, prompt: string): string {
  // Simple hash of prompt for cache key
  const hash = prompt.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  return `gov-agent:${tenantId}:${Math.abs(hash)}`;
}

async function checkTokenBudget(
  supabase: ReturnType<typeof getSupabase>,
  tenantId: string,
  requestedTokens: number
): Promise<{ allowed: boolean; remainingBudget: number }> {
  try {
    // Fetch current hour's token usage
    const hourAgo = new Date();
    hourAgo.setHours(hourAgo.getHours() - 1);

    const { data: usage } = await supabase
      .from('agent_token_usage')
      .select('tokens_used')
      .eq('tenant_id', tenantId)
      .gte('created_at', hourAgo.toISOString());

    const totalUsed = usage?.reduce((sum, row) => sum + row.tokens_used, 0) || 0;
    const remaining = TOKEN_BUDGET_PER_TENANT_PER_HOUR - totalUsed;

    return {
      allowed: remaining >= requestedTokens,
      remainingBudget: Math.max(0, remaining - requestedTokens),
    };
  } catch (error) {
    console.error('Error checking token budget:', error);
    // On error, allow request (fail open)
    return { allowed: true, remainingBudget: TOKEN_BUDGET_PER_TENANT_PER_HOUR };
  }
}

async function checkRateLimit(
  supabase: ReturnType<typeof getSupabase>,
  tenantId: string
): Promise<boolean> {
  try {
    const hourAgo = new Date();
    hourAgo.setHours(hourAgo.getHours() - 1);

    const { data: calls } = await supabase
      .from('agent_token_usage')
      .select('id')
      .eq('tenant_id', tenantId)
      .gte('created_at', hourAgo.toISOString());

    return (calls?.length || 0) < RATE_LIMIT_PER_HOUR;
  } catch (error) {
    console.error('Error checking rate limit:', error);
    return true; // Fail open
  }
}

async function recordTokenUsage(
  supabase: ReturnType<typeof getSupabase>,
  tenantId: string,
  tokensUsed: number,
  promptType: string
): Promise<void> {
  try {
    await supabase.from('agent_token_usage').insert({
      tenant_id: tenantId,
      tokens_used: tokensUsed,
      prompt_type: promptType,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error recording token usage:', error);
  }
}

export async function callGovernanceAgent(
  request: GovernanceAgentRequest
): Promise<GovernanceAgentResponse> {
  const supabase = getSupabase();
  const cacheKey = getCacheKey(request.tenantId, request.prompt);

  // Check cache first
  const cached = responseCache.get(cacheKey);
  if (cached && new Date(cached.expiresAt) > new Date()) {
    return {
      content: cached.content,
      tokensUsed: cached.tokensUsed,
      cached: true,
      generatedAt: cached.createdAt,
    };
  }

  // Check rate limit
  const rateLimitOk = await checkRateLimit(supabase, request.tenantId);
  if (!rateLimitOk) {
    throw new Error(
      `Rate limit exceeded for tenant ${request.tenantId}. Max ${RATE_LIMIT_PER_HOUR} calls per hour.`
    );
  }

  // Check token budget
  const maxTokens = request.maxTokens || DEFAULT_MAX_TOKENS;
  const budgetCheck = await checkTokenBudget(supabase, request.tenantId, maxTokens);

  if (!budgetCheck.allowed) {
    throw new Error(
      `Token budget exceeded for tenant ${request.tenantId}. Remaining: ${budgetCheck.remainingBudget} tokens.`
    );
  }

  try {
    // Call governance-agent edge function
    const response = await supabase.functions.invoke('governance-agent', {
      body: {
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        context: request.context,
        maxTokens,
        temperature: request.temperature || 0.7,
      },
    });

    if (response.error) {
      throw new Error(`Governance agent error: ${response.error.message}`);
    }

    const { content, tokensUsed } = response.data;

    // Record token usage
    await recordTokenUsage(supabase, request.tenantId, tokensUsed, 'governance_recommendation');

    // Cache response
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + CACHE_TTL_MINUTES);

    responseCache.set(cacheKey, {
      content,
      tokensUsed,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    return {
      content,
      tokensUsed,
      cached: false,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error calling governance agent:', error);
    throw error;
  }
}

export async function generateComplianceRecommendation(
  tenantId: string,
  tenantState: Record<string, any>,
  recommendationType: string
): Promise<string> {
  const prompt = buildPrompt(recommendationType, tenantState);
  const systemPrompt = `You are a compliance advisor. Provide specific, actionable recommendations for compliance improvements.
Format your response as a concise JSON object with fields: title (string), description (string), action (string), impact (string), effort (string: low/medium/high), confidence (number: 0-100).
Be direct and avoid lengthy explanations.`;

  const response = await callGovernanceAgent({
    tenantId,
    prompt,
    systemPrompt,
    context: tenantState,
    maxTokens: 512,
    temperature: 0.3, // Lower temperature for consistency
  });

  return response.content;
}

function buildPrompt(
  recommendationType: string,
  tenantState: Record<string, any>
): string {
  switch (recommendationType) {
    case 'policy_gap':
      return `Analyze the following compliance state and recommend specific policies that should be documented:\n\nTenantState:\n${JSON.stringify(
        tenantState,
        null,
        2
      )}\n\nFocus on GDPR, NIS2, and DSA compliance gaps. Prioritize by regulatory impact.`;

    case 'risk_mitigation':
      return `Identify the highest-impact risks to address first:\n\nTenantState:\n${JSON.stringify(
        tenantState,
        null,
        2
      )}\n\nProvide specific remediation steps with effort/time estimates.`;

    case 'incident_response':
      return `Based on the incident data, suggest response priorities and escalation actions:\n\nTenantState:\n${JSON.stringify(
        tenantState,
        null,
        2
      )}\n\nInclude notification timeline and stakeholder escalation.`;

    case 'vendor_assessment':
      return `Evaluate vendor risk posture and recommend assessment priorities:\n\nTenantState:\n${JSON.stringify(
        tenantState,
        null,
        2
      )}\n\nIdentify vendors requiring immediate review and specific assessment criteria.`;

    case 'dpia_planning':
      return `Plan DPIA assessments based on data processing activities:\n\nTenantState:\n${JSON.stringify(
        tenantState,
        null,
        2
      )}\n\nRecommend priority DPIAs and completion timeline.`;

    case 'audit_preparation':
      return `Suggest audit preparation priorities based on compliance state:\n\nTenantState:\n${JSON.stringify(
        tenantState,
        null,
        2
      )}\n\nIdentify documentation gaps and evidence collection priorities.`;

    default:
      return `Provide compliance recommendations for the following state:\n\nTenantState:\n${JSON.stringify(
        tenantState,
        null,
        2
      )}`;
  }
}

export async function clearCache(): Promise<void> {
  responseCache.clear();
}

export async function getCacheStats(): Promise<{
  size: number;
  items: string[];
}> {
  const now = new Date();
  const expired: string[] = [];

  // Remove expired entries
  for (const [key, value] of responseCache.entries()) {
    if (new Date(value.expiresAt) <= now) {
      responseCache.delete(key);
      expired.push(key);
    }
  }

  return {
    size: responseCache.size,
    items: Array.from(responseCache.keys()),
  };
}
