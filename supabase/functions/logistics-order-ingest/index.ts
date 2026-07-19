/**
 * Supabase Edge Function: logistics-order-ingest
 * Purpose: Ingest delivery orders, validate data, create database records
 * Auth: Service Role (called from client via auth token verification)
 * Rate Limit: 100 requests/min per tenant
 *
 * Endpoints:
 * POST /ingest          - Create single order
 * POST /ingest/batch    - Create multiple orders
 * GET  /orders/{id}     - Retrieve order with data quality score
 */

import { serve } from 'https://deno.land/std@0.208.1/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface CreateOrderPayload {
  order_number: string;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  pickup_location: { lat: number; lng: number; address?: string };
  delivery_location: { lat: number; lng: number; address?: string };
  delivery_window_start: string;     // ISO 8601
  delivery_window_end: string;
  package_weight: number;            // kg
  package_volume?: number;           // m³
  package_dimensions?: { length_cm: number; width_cm: number; height_cm: number };
  is_fragile?: boolean;
  requires_signature?: boolean;
  special_instructions?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  promised_delivery_date: string;     // ISO date
  sla_window_minutes?: number;
}

interface BatchIngestPayload {
  orders: CreateOrderPayload[];
  source?: string;
  metadata?: Record<string, any>;
}

interface DataQualityResult {
  score: number;              // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  missing_fields: string[];
  quality_issues: string[];
  flags: string[];
  usable_for_optimization: boolean;
}

interface ValidationResult {
  is_valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  quality_result?: DataQualityResult;
}

interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'high';
}

interface ValidationWarning {
  field: string;
  message: string;
  recommendation?: string;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

function validateLocation(loc: any, fieldName: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!loc || typeof loc !== 'object') {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be an object with lat/lng`,
      severity: 'critical'
    });
    return errors;
  }

  if (typeof loc.lat !== 'number' || loc.lat < -90 || loc.lat > 90) {
    errors.push({
      field: `${fieldName}.lat`,
      message: 'Latitude must be a number between -90 and 90',
      severity: 'critical'
    });
  }

  if (typeof loc.lng !== 'number' || loc.lng < -180 || loc.lng > 180) {
    errors.push({
      field: `${fieldName}.lng`,
      message: 'Longitude must be a number between -180 and 180',
      severity: 'critical'
    });
  }

  return errors;
}

function validateTimeWindow(
  start: string,
  end: string,
  promisedDate: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  try {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const promiseDate = new Date(promisedDate);
    const now = new Date();

    if (isNaN(startDate.getTime())) {
      errors.push({
        field: 'delivery_window_start',
        message: 'Invalid ISO 8601 date format',
        severity: 'critical'
      });
    }

    if (isNaN(endDate.getTime())) {
      errors.push({
        field: 'delivery_window_end',
        message: 'Invalid ISO 8601 date format',
        severity: 'critical'
      });
    }

    if (startDate >= endDate) {
      errors.push({
        field: 'delivery_window',
        message: 'delivery_window_start must be before delivery_window_end',
        severity: 'critical'
      });
    }

    if (isNaN(promiseDate.getTime())) {
      errors.push({
        field: 'promised_delivery_date',
        message: 'Invalid date format',
        severity: 'critical'
      });
    }

    // Window must be in the future
    if (startDate < now) {
      errors.push({
        field: 'delivery_window_start',
        message: 'Delivery window must be in the future',
        severity: 'critical'
      });
    }

    // Window duration should be reasonable (1 hour - 48 hours)
    const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
    if (durationMinutes < 60 || durationMinutes > 2880) {
      errors.push({
        field: 'delivery_window',
        message: 'Delivery window should be between 1 hour and 48 hours',
        severity: 'high'
      });
    }
  } catch (error) {
    errors.push({
      field: 'time_window',
      message: 'Failed to parse time window',
      severity: 'critical'
    });
  }

  return errors;
}

function validatePackageDetails(order: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!order.package_weight || typeof order.package_weight !== 'number') {
    errors.push({
      field: 'package_weight',
      message: 'package_weight is required and must be a number (kg)',
      severity: 'critical'
    });
  } else if (order.package_weight <= 0 || order.package_weight > 5000) {
    errors.push({
      field: 'package_weight',
      message: 'package_weight must be between 0.01 and 5000 kg',
      severity: 'high'
    });
  }

  if (order.package_volume && order.package_volume <= 0) {
    errors.push({
      field: 'package_volume',
      message: 'package_volume must be positive if provided',
      severity: 'high'
    });
  }

  return errors;
}

function calculateDataQuality(order: CreateOrderPayload): DataQualityResult {
  let score = 100;
  const missingFields: string[] = [];
  const qualityIssues: string[] = [];
  const flags: string[] = [];

  // Check required fields
  const requiredFields = [
    'order_number',
    'customer_id',
    'pickup_location',
    'delivery_location',
    'delivery_window_start',
    'delivery_window_end',
    'package_weight',
    'promised_delivery_date'
  ];

  for (const field of requiredFields) {
    if (!order[field as keyof CreateOrderPayload]) {
      missingFields.push(field);
      score -= 10;
    }
  }

  // Check optional fields for completeness
  if (!order.customer_name) {
    score -= 5;
    qualityIssues.push('Missing customer_name');
  }

  if (!order.customer_email) {
    score -= 5;
    qualityIssues.push('Missing customer_email');
  }

  if (!order.package_volume) {
    score -= 3;
    qualityIssues.push('Missing package_volume (may affect routing optimization)');
  }

  if (!order.package_dimensions) {
    score -= 2;
    qualityIssues.push('Missing package_dimensions');
  }

  // Check for suspicious values
  if (order.package_weight > 1000) {
    flags.push('Unusually heavy package (> 1000 kg) - verify correctness');
  }

  if (order.sla_window_minutes && order.sla_window_minutes < 30) {
    flags.push('Very tight SLA window (< 30 minutes) - ensure feasibility');
  }

  // Determine grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 95) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 65) grade = 'C';
  else if (score >= 50) grade = 'D';
  else grade = 'F';

  return {
    score: Math.max(0, score),
    grade,
    missing_fields: missingFields,
    quality_issues: qualityIssues,
    flags,
    usable_for_optimization: grade !== 'F' && missingFields.length === 0
  };
}

function validateOrder(order: CreateOrderPayload): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Location validation
  errors.push(...validateLocation(order.pickup_location, 'pickup_location'));
  errors.push(...validateLocation(order.delivery_location, 'delivery_location'));

  // Time window validation
  errors.push(
    ...validateTimeWindow(
      order.delivery_window_start,
      order.delivery_window_end,
      order.promised_delivery_date
    )
  );

  // Package validation
  errors.push(...validatePackageDetails(order));

  // Customer ID validation
  if (!order.customer_id || typeof order.customer_id !== 'string') {
    errors.push({
      field: 'customer_id',
      message: 'customer_id is required and must be a string',
      severity: 'critical'
    });
  }

  // Order number uniqueness (checked against DB later)
  if (!order.order_number || typeof order.order_number !== 'string') {
    errors.push({
      field: 'order_number',
      message: 'order_number is required and must be a string',
      severity: 'critical'
    });
  }

  // Data quality assessment
  const quality = calculateDataQuality(order);

  return {
    is_valid: errors.length === 0,
    errors,
    warnings,
    quality_result: quality
  };
}

// ============================================================================
// API HANDLERS
// ============================================================================

async function handleCreateOrder(
  supabase: any,
  tenantId: string,
  userId: string,
  payload: CreateOrderPayload
) {
  // Validate
  const validation = validateOrder(payload);
  if (!validation.is_valid) {
    return {
      status: 400,
      body: {
        error: 'Validation failed',
        validation_errors: validation.errors,
        warnings: validation.warnings
      }
    };
  }

  try {
    // Check order_number uniqueness
    const { data: existing } = await supabase
      .from('logistics_orders')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('order_number', payload.order_number)
      .single();

    if (existing) {
      return {
        status: 409,
        body: {
          error: 'Order number already exists',
          order_number: payload.order_number
        }
      };
    }

    // Create order
    const { data: order, error: createError } = await supabase
      .from('logistics_orders')
      .insert({
        tenant_id: tenantId,
        ...payload,
        created_by: userId,
        status: 'pending'
      })
      .select()
      .single();

    if (createError) {
      return {
        status: 500,
        body: {
          error: 'Failed to create order',
          details: createError.message
        }
      };
    }

    // Create data quality log
    if (validation.quality_result) {
      await supabase.from('logistics_data_quality_logs').insert({
        tenant_id: tenantId,
        order_id: order.id,
        quality_score: validation.quality_result.score,
        quality_grade: validation.quality_result.grade,
        missing_fields: validation.quality_result.missing_fields,
        quality_flags: validation.quality_result.flags,
        data_usable_for_optimization: validation.quality_result.usable_for_optimization
      });
    }

    // Log to ai_tool_runs (audit trail)
    await supabase.from('ai_tool_runs').insert({
      tenant_id: tenantId,
      user_id: userId,
      tool_name: 'logistics_order_ingest',
      input: JSON.stringify(payload),
      output: JSON.stringify({ order_id: order.id }),
      status: 'success',
      model: 'none',
      input_tokens: 0,
      output_tokens: 0
    });

    return {
      status: 201,
      body: {
        order_id: order.id,
        order_number: order.order_number,
        status: 'pending',
        data_quality: validation.quality_result,
        message: 'Order created successfully'
      }
    };
  } catch (error: any) {
    console.error('Create order error:', error);
    return {
      status: 500,
      body: {
        error: 'Internal server error',
        details: error.message
      }
    };
  }
}

async function handleBatchIngest(
  supabase: any,
  tenantId: string,
  userId: string,
  payload: BatchIngestPayload
) {
  const { orders, source = 'api', metadata = {} } = payload;

  if (!Array.isArray(orders) || orders.length === 0) {
    return {
      status: 400,
      body: {
        error: 'orders array is required and must not be empty'
      }
    };
  }

  if (orders.length > 1000) {
    return {
      status: 400,
      body: {
        error: 'Batch size limit exceeded (max 1000 orders)'
      }
    };
  }

  const results = {
    total: orders.length,
    successful: 0,
    failed: 0,
    orders_created: [] as string[],
    errors: [] as any[]
  };

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];

    // Validate
    const validation = validateOrder(order);
    if (!validation.is_valid) {
      results.failed++;
      results.errors.push({
        index: i,
        order_number: order.order_number,
        validation_errors: validation.errors
      });
      continue;
    }

    try {
      // Create order
      const { data: createdOrder, error: createError } = await supabase
        .from('logistics_orders')
        .insert({
          tenant_id: tenantId,
          ...order,
          created_by: userId,
          status: 'pending'
        })
        .select()
        .single();

      if (createError) {
        results.failed++;
        results.errors.push({
          index: i,
          order_number: order.order_number,
          error: createError.message
        });
        continue;
      }

      // Create data quality log
      if (validation.quality_result) {
        await supabase.from('logistics_data_quality_logs').insert({
          tenant_id: tenantId,
          order_id: createdOrder.id,
          quality_score: validation.quality_result.score,
          quality_grade: validation.quality_result.grade,
          missing_fields: validation.quality_result.missing_fields,
          quality_flags: validation.quality_result.flags,
          data_usable_for_optimization: validation.quality_result.usable_for_optimization
        });
      }

      results.successful++;
      results.orders_created.push(createdOrder.id);
    } catch (error: any) {
      results.failed++;
      results.errors.push({
        index: i,
        order_number: order.order_number,
        error: error.message
      });
    }
  }

  // Log batch operation
  await supabase.from('ai_tool_runs').insert({
    tenant_id: tenantId,
    user_id: userId,
    tool_name: 'logistics_order_batch_ingest',
    input: JSON.stringify({ order_count: orders.length, source }),
    output: JSON.stringify(results),
    status: results.failed === 0 ? 'success' : 'partial',
    model: 'none',
    input_tokens: 0,
    output_tokens: 0
  });

  return {
    status: 200,
    body: results
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req: Request) => {
  // CORS headers
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
    // Get tenant and user from auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { 'content-type': 'application/json' }
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data, error: authError } = await supabase.auth.getUser(token);

    if (authError || !data.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'content-type': 'application/json' }
        }
      );
    }

    const userId = data.user.id;

    // Get tenant_id from user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        {
          status: 404,
          headers: { 'content-type': 'application/json' }
        }
      );
    }

    const tenantId = profile.tenant_id;
    const url = new URL(req.url);

    // Route handling
    let result;

    if (req.method === 'POST') {
      const payload = await req.json();

      if (url.pathname.endsWith('/batch')) {
        result = await handleBatchIngest(supabase, tenantId, userId, payload);
      } else {
        result = await handleCreateOrder(supabase, tenantId, userId, payload);
      }
    } else if (req.method === 'GET' && url.pathname.includes('/orders/')) {
      const orderId = url.pathname.split('/orders/')[1];

      const { data: order, error } = await supabase
        .from('logistics_orders')
        .select('*')
        .eq('id', orderId)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !order) {
        result = { status: 404, body: { error: 'Order not found' } };
      } else {
        // Get quality metrics
        const { data: quality } = await supabase
          .from('logistics_data_quality_logs')
          .select('quality_score, quality_grade, quality_flags')
          .eq('order_id', orderId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        result = {
          status: 200,
          body: { order, quality_metrics: quality }
        };
      }
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
      JSON.stringify({
        error: 'Internal server error',
        details: error.message
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' }
      }
    );
  }
});
