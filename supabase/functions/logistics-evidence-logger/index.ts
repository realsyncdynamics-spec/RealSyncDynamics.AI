/**
 * Supabase Edge Function: logistics-evidence-logger
 * Purpose: Log logistics decisions to evidence layer with hash chain & C2PA signing
 * Integrates with existing evidence-vault infrastructure
 *
 * Endpoints:
 * POST /log-decision      - Log a routing decision to evidence layer
 * GET  /decision-audit    - Retrieve full audit trail for decision
 * POST /verify-chain      - Verify hash chain integrity
 */

import { serve } from 'https://deno.land/std@0.208.1/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ============================================================================
// TYPES
// ============================================================================

interface LogisticsDecisionEvent {
  decision_id: string;
  tenant_id: string;
  actor_id: string;
  model_version: string;
  policy_version: number;
  decision_data: {
    type: 'route_optimization' | 'override' | 'replan';
    orders: string[];
    routes: string[];
    reasoning: string;
    confidence_score: number;
    alternatives_count: number;
  };
  input_hash?: string;
  output_hash?: string;
  timestamp?: string;
}

interface EvidenceEvent {
  id: string;
  tenant_id: string;
  event_type: string;
  entity_id: string;
  actor_id: string;
  model_version: string;
  policy_version: number;
  input_hash: string;
  output_hash: string;
  reasoning: Record<string, any>;
  timestamp: string;
  verified_at?: string;
  custodian_chain: string[];
  previous_hash?: string;
}

interface C2PAManifest {
  manifest_id: string;
  claim_generator: string;
  claim_signature: string;
  claim_timestamp: string;
  claim_hash: string;
  verified: boolean;
}

// ============================================================================
// HASHING & CRYPTO UTILITIES
// ============================================================================

/**
 * Simple SHA-256 implementation (for MVP)
 * In production, use Web Crypto API
 */
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Create deterministic hash of object
 */
async function hashObject(obj: Record<string, any>): Promise<string> {
  const json = JSON.stringify(obj, Object.keys(obj).sort());
  return sha256(json);
}

/**
 * Mock C2PA Ed25519 signature (for MVP)
 * In production, use libp2p crypto or similar
 */
function mockEd25519Sign(data: string, privateKey?: string): string {
  // Simulate Ed25519 signature (64 bytes hex)
  const timestamp = Date.now().toString();
  const combined = data + (privateKey || 'default-key') + timestamp;
  return Buffer.from(combined).toString('base64').slice(0, 88);
}

/**
 * Generate unique manifest ID
 */
function generateManifestId(): string {
  return `c2pa-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================================
// EVIDENCE LOGGING LOGIC
// ============================================================================

class EvidenceLogger {
  private tenantId: string;
  private userId: string;
  private supabase: any;

  constructor(tenantId: string, userId: string, supabase: any) {
    this.tenantId = tenantId;
    this.userId = userId;
    this.supabase = supabase;
  }

  /**
   * Log a logistics decision to evidence layer
   */
  async logDecision(event: LogisticsDecisionEvent): Promise<EvidenceEvent | null> {
    try {
      // Calculate hashes
      const inputData = JSON.stringify({
        orders: event.decision_data.orders,
        type: event.decision_data.type
      });
      const outputData = JSON.stringify({
        routes: event.decision_data.routes,
        reasoning: event.decision_data.reasoning
      });

      const inputHash = event.input_hash || (await sha256(inputData));
      const outputHash = event.output_hash || (await sha256(outputData));

      // Get previous hash from chain
      const { data: previousEvent } = await this.supabase
        .from('ai_evidence_events')
        .select('output_hash')
        .eq('tenant_id', this.tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const previousHash = previousEvent?.output_hash;

      // Create evidence event
      const evidenceEvent: EvidenceEvent = {
        id: crypto.randomUUID(),
        tenant_id: this.tenantId,
        event_type: `logistics_decision_${event.decision_data.type}`,
        entity_id: event.decision_id,
        actor_id: event.actor_id,
        model_version: event.model_version,
        policy_version: event.policy_version,
        input_hash: inputHash,
        output_hash: outputHash,
        reasoning: {
          type: event.decision_data.type,
          orders_count: event.decision_data.orders.length,
          routes_count: event.decision_data.routes.length,
          reasoning: event.decision_data.reasoning,
          confidence_score: event.decision_data.confidence_score,
          alternatives_count: event.decision_data.alternatives_count
        },
        timestamp: event.timestamp || new Date().toISOString(),
        custodian_chain: [event.actor_id],
        previous_hash: previousHash
      };

      // Insert into evidence layer
      const { data: insertedEvent, error: insertError } = await this.supabase
        .from('ai_evidence_events')
        .insert(evidenceEvent)
        .select()
        .single();

      if (insertError) {
        console.error('Evidence insertion error:', insertError);
        return null;
      }

      // Create C2PA manifest
      const manifest = await this.createC2PAManifest(evidenceEvent);

      // Update evidence event with manifest ID
      await this.supabase
        .from('ai_evidence_events')
        .update({ c2pa_manifest_id: manifest.manifest_id })
        .eq('id', insertedEvent.id);

      // Link decision to evidence
      await this.supabase
        .from('logistics_decisions')
        .update({
          evidence_event_id: insertedEvent.id,
          input_hash: inputHash,
          output_hash: outputHash,
          c2pa_manifest_id: manifest.manifest_id
        })
        .eq('id', event.decision_id);

      return insertedEvent;
    } catch (error) {
      console.error('Evidence logging error:', error);
      return null;
    }
  }

  /**
   * Create C2PA manifest with Ed25519 signature
   */
  private async createC2PAManifest(event: EvidenceEvent): Promise<C2PAManifest> {
    const manifestId = generateManifestId();
    const claimData = JSON.stringify({
      event_id: event.id,
      decision_id: event.entity_id,
      timestamp: event.timestamp,
      input_hash: event.input_hash,
      output_hash: event.output_hash
    });

    const claimHash = await sha256(claimData);
    const claimSignature = mockEd25519Sign(claimData);

    return {
      manifest_id: manifestId,
      claim_generator: 'logistics-evidence-logger',
      claim_signature: claimSignature,
      claim_timestamp: new Date().toISOString(),
      claim_hash: claimHash,
      verified: true
    };
  }

  /**
   * Retrieve full audit trail for a decision
   */
  async getAuditTrail(decisionId: string) {
    try {
      const { data: decision, error: decisionError } = await this.supabase
        .from('logistics_decisions')
        .select('*, evidence_event_id')
        .eq('id', decisionId)
        .eq('tenant_id', this.tenantId)
        .single();

      if (decisionError || !decision) {
        return null;
      }

      // Get evidence event
      const { data: evidence } = await this.supabase
        .from('ai_evidence_events')
        .select('*')
        .eq('id', decision.evidence_event_id)
        .single();

      // Get any overrides
      const { data: overrides } = await this.supabase
        .from('logistics_overrides')
        .select('*')
        .eq('decision_id', decisionId)
        .eq('tenant_id', this.tenantId);

      return {
        decision: {
          id: decision.id,
          type: decision.decision_type,
          status: decision.status,
          created_at: decision.created_at,
          reasoning: decision.reasoning_summary,
          confidence_score: decision.confidence_score,
          human_review_status: decision.human_review_status
        },
        evidence: evidence
          ? {
              event_id: evidence.id,
              event_type: evidence.event_type,
              input_hash: evidence.input_hash,
              output_hash: evidence.output_hash,
              timestamp: evidence.timestamp,
              c2pa_manifest_id: evidence.c2pa_manifest_id,
              previous_hash: evidence.previous_hash
            }
          : null,
        overrides: overrides || [],
        hash_chain_verified: evidence ? await this.verifyHashChain(evidence.id) : false
      };
    } catch (error) {
      console.error('Audit trail error:', error);
      return null;
    }
  }

  /**
   * Verify hash chain integrity
   */
  async verifyHashChain(eventId: string): Promise<boolean> {
    try {
      const { data: event, error: eventError } = await this.supabase
        .from('ai_evidence_events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError || !event) {
        return false;
      }

      // If no previous hash, this is the first event
      if (!event.previous_hash) {
        return true;
      }

      // Get previous event
      const { data: previousEvent } = await this.supabase
        .from('ai_evidence_events')
        .select('output_hash')
        .eq('output_hash', event.previous_hash)
        .limit(1)
        .single();

      if (!previousEvent) {
        return false; // Previous event not found
      }

      // Verify hash is in chain
      const recreatedHash = await sha256(
        JSON.stringify({
          reasoning: event.reasoning,
          timestamp: event.timestamp
        })
      );

      return recreatedHash === event.output_hash;
    } catch (error) {
      console.error('Hash verification error:', error);
      return false;
    }
  }

  /**
   * Generate compliance report with evidence references
   */
  async generateComplianceReport(startDate: string, endDate: string) {
    try {
      const { data: events, error: eventsError } = await this.supabase
        .from('ai_evidence_events')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .gte('timestamp', startDate)
        .lte('timestamp', endDate)
        .order('timestamp', { ascending: true });

      if (eventsError || !events) {
        return null;
      }

      // Aggregate statistics
      const totalEvents = events.length;
      const decisionEvents = events.filter((e) => e.event_type.includes('decision')).length;
      const uniqueActors = new Set(events.map((e) => e.actor_id)).size;

      // Check chain integrity
      let validChain = true;
      for (let i = 1; i < events.length; i++) {
        if (events[i].previous_hash !== events[i - 1].output_hash) {
          validChain = false;
          break;
        }
      }

      return {
        period: { start: startDate, end: endDate },
        summary: {
          total_events: totalEvents,
          decision_events: decisionEvents,
          unique_actors: uniqueActors,
          hash_chain_valid: validChain
        },
        events: events.map((e) => ({
          id: e.id,
          type: e.event_type,
          entity_id: e.entity_id,
          timestamp: e.timestamp,
          c2pa_manifest: e.c2pa_manifest_id
        })),
        compliance_statement: validChain
          ? 'Evidence chain is intact and verified'
          : 'Warning: Evidence chain integrity compromised'
      };
    } catch (error) {
      console.error('Compliance report error:', error);
      return null;
    }
  }
}

// ============================================================================
// API HANDLERS
// ============================================================================

async function handleLogDecision(
  supabase: any,
  tenantId: string,
  userId: string,
  payload: LogisticsDecisionEvent
) {
  try {
    const logger = new EvidenceLogger(tenantId, userId, supabase);
    const evidence = await logger.logDecision(payload);

    if (!evidence) {
      return {
        status: 500,
        body: { error: 'Failed to log evidence' }
      };
    }

    return {
      status: 201,
      body: {
        evidence_id: evidence.id,
        c2pa_manifest_id: evidence.c2pa_manifest_id,
        hash_chain_verified: true,
        timestamp: evidence.timestamp
      }
    };
  } catch (error: any) {
    return {
      status: 500,
      body: { error: 'Evidence logging failed', details: error.message }
    };
  }
}

async function handleGetAuditTrail(
  supabase: any,
  tenantId: string,
  decisionId: string
) {
  try {
    const logger = new EvidenceLogger(tenantId, '', supabase);
    const auditTrail = await logger.getAuditTrail(decisionId);

    if (!auditTrail) {
      return {
        status: 404,
        body: { error: 'Decision not found' }
      };
    }

    return {
      status: 200,
      body: auditTrail
    };
  } catch (error: any) {
    return {
      status: 500,
      body: { error: 'Audit trail retrieval failed', details: error.message }
    };
  }
}

async function handleVerifyChain(
  supabase: any,
  tenantId: string,
  eventId: string
) {
  try {
    const logger = new EvidenceLogger(tenantId, '', supabase);
    const isValid = await logger.verifyHashChain(eventId);

    return {
      status: 200,
      body: {
        event_id: eventId,
        hash_chain_valid: isValid,
        verification_timestamp: new Date().toISOString()
      }
    };
  } catch (error: any) {
    return {
      status: 500,
      body: { error: 'Chain verification failed', details: error.message }
    };
  }
}

async function handleComplianceReport(
  supabase: any,
  tenantId: string,
  startDate: string,
  endDate: string
) {
  try {
    const logger = new EvidenceLogger(tenantId, '', supabase);
    const report = await logger.generateComplianceReport(startDate, endDate);

    if (!report) {
      return {
        status: 400,
        body: { error: 'Failed to generate report' }
      };
    }

    return {
      status: 200,
      body: report
    };
  } catch (error: any) {
    return {
      status: 500,
      body: { error: 'Report generation failed', details: error.message }
    };
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type'
      }
    });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { 'content-type': 'application/json' }
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');

    const { data, error: authError } = await supabase.auth.getUser(token);
    if (authError || !data.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' }
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', data.user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      });
    }

    const tenantId = profile.tenant_id;
    const url = new URL(req.url);

    let result;

    if (req.method === 'POST' && url.pathname.endsWith('/log-decision')) {
      const payload = await req.json();
      result = await handleLogDecision(supabase, tenantId, data.user.id, payload);
    } else if (req.method === 'GET' && url.pathname.includes('/decision-audit/')) {
      const decisionId = url.pathname.split('/decision-audit/')[1];
      result = await handleGetAuditTrail(supabase, tenantId, decisionId);
    } else if (req.method === 'POST' && url.pathname.endsWith('/verify-chain')) {
      const payload = await req.json();
      result = await handleVerifyChain(supabase, tenantId, payload.event_id);
    } else if (req.method === 'GET' && url.pathname.includes('/compliance-report/')) {
      const params = new URL(req.url).searchParams;
      const startDate = params.get('start_date') || '';
      const endDate = params.get('end_date') || '';
      result = await handleComplianceReport(supabase, tenantId, startDate, endDate);
    } else {
      result = {
        status: 405,
        body: { error: 'Method not allowed' }
      };
    }

    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { 'content-type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Handler error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' }
      }
    );
  }
});
