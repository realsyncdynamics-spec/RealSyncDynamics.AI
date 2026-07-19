/**
 * Supabase Edge Function: logistics-constraint-engine
 * Purpose: Evaluate deklarative constraints for route optimization
 * Policy engine for logistics decisions with versioning & audit trail
 *
 * Endpoints:
 * POST /evaluate        - Evaluate constraints for routes/orders
 * GET  /policies        - List active policies for tenant
 * POST /policies        - Create new constraint policy (admin)
 * GET  /policies/{id}   - Get policy details
 */

import { serve } from 'https://deno.land/std@0.208.1/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ============================================================================
// TYPES
// ============================================================================

interface Constraint {
  id: string;
  constraint_type: ConstraintType;
  rule_condition: string;
  rule_action: 'reject' | 'penalty' | 'warn' | 'info';
  severity: 'critical' | 'high' | 'medium' | 'low';
  parameters?: Record<string, any>;
  priority_order: number;
  version_number: number;
}

type ConstraintType =
  | 'vehicle_capacity'
  | 'driver_time'
  | 'time_window'
  | 'sla'
  | 'environmental'
  | 'custom';

interface ConstraintEvaluationContext {
  orders: OrderContext[];
  vehicle: VehicleContext;
  route: RouteContext;
  policy_version: number;
}

interface OrderContext {
  id: string;
  weight: number;
  volume: number;
  delivery_window_start: string;
  delivery_window_end: string;
  sla_window_minutes: number;
  priority: string;
}

interface VehicleContext {
  id: string;
  max_weight_kg: number;
  max_volume_m3: number;
  max_daily_hours: number;
  max_daily_distance_km?: number;
  current_load_kg: number;
  current_daily_hours: number;
  current_daily_distance_km: number;
  emission_class?: string;
  co2_per_km_grams?: number;
}

interface RouteContext {
  total_weight: number;
  total_volume: number;
  estimated_duration_minutes: number;
  estimated_distance_km: number;
  estimated_co2_grams: number;
  stops: RouteStop[];
}

interface RouteStop {
  order_id: string;
  estimated_arrival: string;
  estimated_departure: string;
}

interface ConstraintEvaluationResult {
  constraint_id: string;
  constraint_name: string;
  satisfied: boolean;
  violation_type?: 'hard' | 'soft';
  severity: string;
  reason: string;
  penalty_score?: number;
  recommendation?: string;
}

interface ConstraintEvaluationResponse {
  policy_version: number;
  all_constraints_satisfied: boolean;
  hard_violations: ConstraintEvaluationResult[];
  soft_violations: ConstraintEvaluationResult[];
  warnings: ConstraintEvaluationResult[];
  total_penalty_score: number;
  overall_compliance_score: number;
}

// ============================================================================
// CONSTRAINT EVALUATION LOGIC
// ============================================================================

class ConstraintEvaluator {
  private constraints: Constraint[];
  private context: ConstraintEvaluationContext;

  constructor(constraints: Constraint[], context: ConstraintEvaluationContext) {
    this.constraints = constraints.sort((a, b) => a.priority_order - b.priority_order);
    this.context = context;
  }

  /**
   * Evaluate all constraints and return structured results
   */
  async evaluate(): Promise<ConstraintEvaluationResponse> {
    const results: ConstraintEvaluationResult[] = [];

    for (const constraint of this.constraints) {
      const result = this.evaluateConstraint(constraint);
      results.push(result);
    }

    // Categorize results
    const hardViolations = results.filter((r) => r.violation_type === 'hard' && !r.satisfied);
    const softViolations = results.filter((r) => r.violation_type === 'soft' && !r.satisfied);
    const warnings = results.filter((r) => r.satisfied === false && r.violation_type === undefined);

    // Calculate scores
    const totalPenaltyScore = softViolations.reduce((sum, r) => sum + (r.penalty_score || 0), 0);
    const allConstraintsSatisfied = hardViolations.length === 0;

    // Overall compliance score (0-100)
    // Hard violations = -50 each
    // Soft violations = -10 each
    let complianceScore = 100;
    complianceScore -= hardViolations.length * 50;
    complianceScore -= softViolations.length * 10;
    complianceScore = Math.max(0, complianceScore);

    return {
      policy_version: this.context.policy_version,
      all_constraints_satisfied: allConstraintsSatisfied,
      hard_violations: hardViolations,
      soft_violations: softViolations,
      warnings,
      total_penalty_score: totalPenaltyScore,
      overall_compliance_score: complianceScore
    };
  }

  /**
   * Evaluate a single constraint
   */
  private evaluateConstraint(constraint: Constraint): ConstraintEvaluationResult {
    let satisfied = true;
    let reason = '';
    let penalty = 0;
    let recommendation = '';

    switch (constraint.constraint_type) {
      case 'vehicle_capacity':
        const capacityCheck = this.checkVehicleCapacity();
        satisfied = capacityCheck.satisfied;
        reason = capacityCheck.reason;
        penalty = capacityCheck.penalty;
        recommendation = capacityCheck.recommendation;
        break;

      case 'driver_time':
        const timeCheck = this.checkDriverTime();
        satisfied = timeCheck.satisfied;
        reason = timeCheck.reason;
        penalty = timeCheck.penalty;
        break;

      case 'time_window':
        const windowCheck = this.checkTimeWindows();
        satisfied = windowCheck.satisfied;
        reason = windowCheck.reason;
        break;

      case 'sla':
        const slaCheck = this.checkSLA();
        satisfied = slaCheck.satisfied;
        reason = slaCheck.reason;
        penalty = slaCheck.penalty;
        recommendation = slaCheck.recommendation;
        break;

      case 'environmental':
        const envCheck = this.checkEnvironmental();
        satisfied = envCheck.satisfied;
        reason = envCheck.reason;
        penalty = envCheck.penalty;
        recommendation = envCheck.recommendation;
        break;

      default:
        reason = 'Unknown constraint type';
    }

    return {
      constraint_id: constraint.id,
      constraint_name: constraint.constraint_type,
      satisfied,
      violation_type: !satisfied ? this.getViolationType(constraint.rule_action) : undefined,
      severity: constraint.severity,
      reason,
      penalty_score: penalty > 0 ? penalty : undefined,
      recommendation: recommendation || undefined
    };
  }

  /**
   * Check vehicle capacity constraint
   */
  private checkVehicleCapacity() {
    const totalWeight = this.context.route.total_weight;
    const totalVolume = this.context.route.total_volume;
    const maxWeight = this.context.vehicle.max_weight_kg;
    const maxVolume = this.context.vehicle.max_volume_m3;

    const weightOk = totalWeight <= maxWeight;
    const volumeOk = totalVolume <= maxVolume;

    if (!weightOk && !volumeOk) {
      return {
        satisfied: false,
        reason: `Exceeds both weight (${totalWeight}/${maxWeight}kg) and volume (${totalVolume}/${maxVolume}m³) limits`,
        penalty: 20,
        recommendation: 'Split into multiple routes or use larger vehicle'
      };
    }

    if (!weightOk) {
      return {
        satisfied: false,
        reason: `Exceeds weight limit (${totalWeight}/${maxWeight}kg)`,
        penalty: 15,
        recommendation: 'Remove heaviest orders or use larger vehicle'
      };
    }

    if (!volumeOk) {
      return {
        satisfied: false,
        reason: `Exceeds volume limit (${totalVolume}/${maxVolume}m³)`,
        penalty: 10,
        recommendation: 'Remove bulkiest orders'
      };
    }

    return {
      satisfied: true,
      reason: `Within capacity (${totalWeight}/${maxWeight}kg, ${totalVolume}/${maxVolume}m³)`,
      penalty: 0
    };
  }

  /**
   * Check driver time constraints (EU regulations)
   */
  private checkDriverTime() {
    const estimatedHours = this.context.route.estimated_duration_minutes / 60;
    const maxHours = this.context.vehicle.max_daily_hours;
    const currentHours = this.context.vehicle.current_daily_hours;
    const totalHours = currentHours + estimatedHours;

    if (totalHours > maxHours) {
      const overageHours = totalHours - maxHours;
      return {
        satisfied: false,
        reason: `Exceeds daily driver limit (${totalHours.toFixed(1)}/${maxHours}h, overage: ${overageHours.toFixed(1)}h)`,
        penalty: 25
      };
    }

    // Warning if close to limit (>80% of daily max)
    if (totalHours > maxHours * 0.8) {
      return {
        satisfied: true,
        reason: `Approaching daily driver limit (${totalHours.toFixed(1)}/${maxHours}h)`,
        penalty: 0
      };
    }

    return {
      satisfied: true,
      reason: `Within driver time limit (${totalHours.toFixed(1)}/${maxHours}h)`,
      penalty: 0
    };
  }

  /**
   * Check time window feasibility
   */
  private checkTimeWindows() {
    const violations: string[] = [];

    for (const stop of this.context.route.stops) {
      const order = this.context.orders.find((o) => o.id === stop.order_id);
      if (!order) continue;

      const arrival = new Date(stop.estimated_arrival);
      const windowStart = new Date(order.delivery_window_start);
      const windowEnd = new Date(order.delivery_window_end);

      if (arrival < windowStart) {
        violations.push(`Order ${order.id}: arrives too early`);
      }

      if (arrival > windowEnd) {
        violations.push(`Order ${order.id}: arrives outside delivery window`);
      }
    }

    if (violations.length > 0) {
      return {
        satisfied: false,
        reason: `${violations.length} order(s) have time window violations: ${violations.join('; ')}`
      };
    }

    return {
      satisfied: true,
      reason: 'All orders within delivery windows'
    };
  }

  /**
   * Check SLA compliance
   */
  private checkSLA() {
    let violationCount = 0;
    let slaRiskCount = 0;

    for (const order of this.context.orders) {
      if (!order.sla_window_minutes) continue;

      const stop = this.context.route.stops.find((s) => s.order_id === order.id);
      if (!stop) continue;

      const arrivalTime = new Date(stop.estimated_arrival);
      const promisedTime = new Date(order.delivery_window_end);
      const delayMinutes = (arrivalTime.getTime() - promisedTime.getTime()) / (1000 * 60);

      if (delayMinutes > order.sla_window_minutes) {
        violationCount++;
      } else if (delayMinutes > order.sla_window_minutes * 0.5) {
        slaRiskCount++;
      }
    }

    if (violationCount > 0) {
      return {
        satisfied: false,
        reason: `${violationCount} order(s) violate SLA window`,
        penalty: 15 * violationCount,
        recommendation: 'Prioritize high-SLA orders or adjust route sequence'
      };
    }

    if (slaRiskCount > 0) {
      return {
        satisfied: true,
        reason: `${slaRiskCount} order(s) at SLA risk (>50% of window used)`,
        penalty: 0
      };
    }

    return {
      satisfied: true,
      reason: 'All orders within SLA windows',
      penalty: 0
    };
  }

  /**
   * Check environmental constraints
   */
  private checkEnvironmental() {
    if (!this.context.vehicle.co2_per_km_grams) {
      return {
        satisfied: true,
        reason: 'No environmental data available',
        penalty: 0
      };
    }

    const estimatedCO2 = this.context.route.estimated_co2_grams;
    const dailyCO2Budget = 5000000; // 5kg per vehicle per day (example)

    if (estimatedCO2 > dailyCO2Budget) {
      return {
        satisfied: false,
        reason: `Exceeds daily CO2 budget (${(estimatedCO2 / 1000).toFixed(1)}g / ${(dailyCO2Budget / 1000).toFixed(1)}g)`,
        penalty: 10,
        recommendation: 'Consolidate routes or use lower-emission vehicles'
      };
    }

    return {
      satisfied: true,
      reason: `Within CO2 budget (${(estimatedCO2 / 1000).toFixed(1)}g / ${(dailyCO2Budget / 1000).toFixed(1)}g)`,
      penalty: 0
    };
  }

  /**
   * Determine violation type (hard = reject, soft = penalty)
   */
  private getViolationType(action: string): 'hard' | 'soft' {
    return action === 'reject' ? 'hard' : 'soft';
  }
}

// ============================================================================
// API HANDLERS
// ============================================================================

async function handleEvaluateConstraints(
  supabase: any,
  tenantId: string,
  payload: {
    orders: OrderContext[];
    vehicle: VehicleContext;
    route: RouteContext;
    policy_version?: number;
  }
) {
  try {
    // Get active constraints for tenant
    const { data: constraints, error: constraintsError } = await supabase
      .from('logistics_constraints')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('priority_order', { ascending: true });

    if (constraintsError) {
      return {
        status: 500,
        body: {
          error: 'Failed to fetch constraints',
          details: constraintsError.message
        }
      };
    }

    const policyVersion = payload.policy_version || 1;

    const context: ConstraintEvaluationContext = {
      orders: payload.orders,
      vehicle: payload.vehicle,
      route: payload.route,
      policy_version: policyVersion
    };

    const evaluator = new ConstraintEvaluator(constraints || [], context);
    const result = await evaluator.evaluate();

    // Log evaluation to audit trail
    await supabase.from('ai_tool_runs').insert({
      tenant_id: tenantId,
      tool_name: 'logistics_constraint_evaluation',
      input: JSON.stringify({
        order_count: payload.orders.length,
        constraint_count: constraints?.length || 0
      }),
      output: JSON.stringify({
        all_satisfied: result.all_constraints_satisfied,
        hard_violations: result.hard_violations.length,
        soft_violations: result.soft_violations.length,
        compliance_score: result.overall_compliance_score
      }),
      status: result.all_constraints_satisfied ? 'success' : 'partial',
      model: 'none',
      input_tokens: 0,
      output_tokens: 0
    });

    return {
      status: 200,
      body: result
    };
  } catch (error: any) {
    return {
      status: 500,
      body: {
        error: 'Constraint evaluation failed',
        details: error.message
      }
    };
  }
}

async function handleListPolicies(supabase: any, tenantId: string) {
  try {
    const { data: policies, error } = await supabase
      .from('logistics_constraints')
      .select('id, constraint_name, constraint_type, severity, is_active, version_number')
      .eq('tenant_id', tenantId)
      .order('priority_order', { ascending: true });

    if (error) {
      return {
        status: 500,
        body: { error: 'Failed to fetch policies', details: error.message }
      };
    }

    // Group by type
    const byType = policies?.reduce(
      (acc, p) => {
        if (!acc[p.constraint_type]) acc[p.constraint_type] = [];
        acc[p.constraint_type].push(p);
        return acc;
      },
      {} as Record<string, any[]>
    );

    return {
      status: 200,
      body: {
        total: policies?.length || 0,
        by_type: byType,
        policies: policies || []
      }
    };
  } catch (error: any) {
    return {
      status: 500,
      body: { error: 'Failed to list policies', details: error.message }
    };
  }
}

async function handleCreatePolicy(
  supabase: any,
  tenantId: string,
  userId: string,
  payload: any
) {
  try {
    // Validate required fields
    if (!payload.constraint_name || !payload.constraint_type || !payload.rule_condition) {
      return {
        status: 400,
        body: {
          error: 'Missing required fields: constraint_name, constraint_type, rule_condition'
        }
      };
    }

    const { data: constraint, error } = await supabase
      .from('logistics_constraints')
      .insert({
        tenant_id: tenantId,
        constraint_name: payload.constraint_name,
        constraint_type: payload.constraint_type,
        rule_condition: payload.rule_condition,
        rule_action: payload.rule_action || 'warn',
        severity: payload.severity || 'medium',
        parameters: payload.parameters || {},
        is_active: payload.is_active !== false,
        priority_order: payload.priority_order || 100,
        version_number: 1,
        changed_by: userId,
        change_reason: payload.change_reason || 'Initial creation'
      })
      .select()
      .single();

    if (error) {
      return {
        status: 500,
        body: { error: 'Failed to create policy', details: error.message }
      };
    }

    // Audit log
    await supabase.from('ai_tool_runs').insert({
      tenant_id: tenantId,
      user_id: userId,
      tool_name: 'logistics_constraint_create',
      input: JSON.stringify(payload),
      output: JSON.stringify({ constraint_id: constraint.id }),
      status: 'success',
      model: 'none',
      input_tokens: 0,
      output_tokens: 0
    });

    return {
      status: 201,
      body: constraint
    };
  } catch (error: any) {
    return {
      status: 500,
      body: { error: 'Failed to create policy', details: error.message }
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

    if (req.method === 'POST' && url.pathname.endsWith('/evaluate')) {
      const payload = await req.json();
      result = await handleEvaluateConstraints(supabase, tenantId, payload);
    } else if (req.method === 'GET' && url.pathname.endsWith('/policies')) {
      result = await handleListPolicies(supabase, tenantId);
    } else if (req.method === 'POST' && url.pathname.endsWith('/policies')) {
      const payload = await req.json();
      result = await handleCreatePolicy(supabase, tenantId, data.user.id, payload);
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
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' }
      }
    );
  }
});
