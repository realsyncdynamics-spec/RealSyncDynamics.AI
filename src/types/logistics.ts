/**
 * RealSync Logistics OS Type Definitions
 * Auto-generated from database schema (Phase 2)
 * All types are RLS-protected and tenant-isolated
 */

import { UUID } from './shared';

// ============================================================================
// ORDER TYPES
// ============================================================================

export interface LogisticsOrder {
  id: UUID;
  tenant_id: UUID;
  order_number: string;

  // Customer Info
  customer_id: string;
  customer_name?: string;
  customer_email?: string;

  // Location
  pickup_location: Location;
  delivery_location: Location;

  // Time Window
  delivery_window_start: string; // ISO 8601
  delivery_window_end: string;   // ISO 8601

  // Package Details
  package_weight: number;        // kg
  package_volume?: number;       // m³
  package_dimensions?: Dimensions;
  is_fragile: boolean;
  requires_signature: boolean;
  special_instructions?: string;

  // Priority & SLA
  priority: 'low' | 'normal' | 'high' | 'critical';
  promised_delivery_date: string; // ISO date
  sla_window_minutes?: number;

  // Status
  status: OrderStatus;
  assigned_route_id?: UUID;

  // Metadata
  created_by?: UUID;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

export type OrderStatus = 'pending' | 'assigned' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';

export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface Dimensions {
  length_cm: number;
  width_cm: number;
  height_cm: number;
}

export type CreateOrderInput = Omit<LogisticsOrder, 'id' | 'created_at' | 'updated_at' | 'status'>;

// ============================================================================
// VEHICLE TYPES
// ============================================================================

export interface LogisticsVehicle {
  id: UUID;
  tenant_id: UUID;
  vehicle_code: string;

  // Details
  vehicle_type: string;           // van, truck, bike, etc.
  license_plate?: string;
  vin?: string;

  // Capacity
  max_weight_kg: number;
  max_volume_m3: number;
  current_load_kg: number;
  current_volume_m3: number;

  // Driver
  assigned_driver_id?: string;
  assigned_driver_name?: string;

  // Constraints
  max_daily_hours: number;        // EU regulation
  current_daily_hours: number;
  max_daily_distance_km?: number;
  current_daily_distance_km: number;

  // Environmental
  emission_class?: string;         // Euro 5, Euro 6, EV, etc.
  co2_per_km_grams?: number;
  fuel_type?: string;

  // Status
  status: 'available' | 'in_use' | 'maintenance' | 'inactive';
  last_location?: Location;

  // Availability
  available_from?: string; // ISO 8601
  available_until?: string; // ISO 8601

  // Metadata
  created_by?: UUID;
  created_at: string;
  updated_at: string;
}

export type CreateVehicleInput = Omit<LogisticsVehicle, 'id' | 'created_at' | 'updated_at'>;

// ============================================================================
// ROUTE TYPES
// ============================================================================

export interface LogisticsRoute {
  id: UUID;
  tenant_id: UUID;
  route_number: string;

  // Assignment
  assigned_vehicle_id: UUID;
  assigned_driver_id?: string;

  // Details
  route_stops: RouteStop[];
  total_distance_km?: number;
  estimated_duration_minutes?: number;

  // Scoring
  route_score?: number;            // 0-100
  optimization_efficiency?: number; // 0.8-1.0
  cost_estimate?: number;
  co2_estimate_grams?: number;

  // Constraints
  constraints_satisfied: boolean;
  constraint_violations?: ConstraintViolation[];

  // Status
  status: RouteStatus;

  // Tracking
  actual_start_time?: string; // ISO 8601
  actual_end_time?: string;
  actual_distance_km?: number;
  actual_duration_minutes?: number;

  // SLA
  sla_compliance_count: number;
  sla_violation_count: number;
  sla_compliance_rate?: number;

  // Metadata
  created_by?: UUID;
  created_at: string;
  updated_at: string;
}

export type RouteStatus = 'planned' | 'optimizing' | 'ready' | 'dispatched' | 'in_transit' | 'completed' | 'partial' | 'failed' | 'cancelled';

export interface RouteStop {
  order_id: UUID;
  stop_number: number;
  location: Location;
  estimated_arrival_time: string; // ISO 8601
  estimated_departure_time: string;
  actual_arrival_time?: string;
  actual_departure_time?: string;
  status: 'pending' | 'arrived' | 'completed' | 'failed';
}

export interface ConstraintViolation {
  constraint_name: string;
  violation_type: 'hard' | 'soft'; // hard = rejected, soft = penalized
  reason: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export type CreateRouteInput = Omit<LogisticsRoute, 'id' | 'created_at' | 'updated_at'>;

// ============================================================================
// CONSTRAINT TYPES
// ============================================================================

export interface LogisticsConstraint {
  id: UUID;
  tenant_id: UUID;
  constraint_name: string;

  // Definition
  constraint_type: ConstraintType;
  rule_condition: string;          // e.g., "driving_hours > 10"
  rule_action: 'reject' | 'penalty' | 'warn' | 'info';
  severity: 'critical' | 'high' | 'medium' | 'low';

  // Configuration
  parameters?: Record<string, any>;
  is_active: boolean;
  priority_order: number;

  // Versioning
  version_number: number;
  changed_by?: UUID;
  change_reason?: string;

  // Metadata
  created_at: string;
  updated_at: string;
}

export type ConstraintType = 'vehicle_capacity' | 'driver_time' | 'time_window' | 'sla' | 'environmental' | 'custom';

export type CreateConstraintInput = Omit<LogisticsConstraint, 'id' | 'created_at' | 'updated_at' | 'version_number'>;

// ============================================================================
// DECISION TYPES
// ============================================================================

export interface LogisticsDecision {
  id: UUID;
  tenant_id: UUID;

  // Metadata
  decision_type: 'route_optimization' | 'override' | 'replan';
  decision_timestamp: string; // ISO 8601
  decision_epoch?: number;

  // Entities
  orders_input_ids?: UUID[];
  routes_generated_ids?: UUID[];

  // AI Model
  model_provider: 'anthropic' | 'google' | 'openai' | 'local';
  model_name: string;
  model_version?: string;

  // Governance
  policy_version?: number;
  policy_constraints_evaluated?: Record<string, ConstraintEvaluation>;

  // Reasoning
  reasoning_summary?: string;
  reasoning_detailed?: Record<string, any>;
  confidence_score?: number;

  // Alternatives
  alternatives_count: number;
  alternatives_considered?: RouteAlternative[];

  // Constraints
  all_constraints_satisfied?: boolean;
  violated_constraints?: ConstraintViolation[];

  // Human Oversight
  human_review_required: boolean;
  human_reviewer_id?: UUID;
  human_review_timestamp?: string;
  human_review_status?: 'pending' | 'approved' | 'rejected' | 'modified';
  human_override_reason?: string;

  // Execution
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'cancelled';
  executed_at?: string;

  // Evidence & Audit
  evidence_event_id?: UUID;
  input_hash?: string;
  output_hash?: string;
  c2pa_manifest_id?: string;

  // Metadata
  created_at: string;
  updated_at: string;
}

export interface ConstraintEvaluation {
  satisfied: boolean;
  penalty?: number;
  reason?: string;
}

export interface RouteAlternative {
  rank: number;
  route_ids: UUID[];
  total_distance_km: number;
  estimated_cost: number;
  variant_score: number;
  constraints_satisfied: boolean;
  rejection_reason?: string;
}

export type CreateDecisionInput = Omit<LogisticsDecision, 'id' | 'created_at' | 'updated_at' | 'evidence_event_id'>;

// ============================================================================
// DECISION VARIANT TYPES
// ============================================================================

export interface LogisticsDecisionVariant {
  id: UUID;
  tenant_id: UUID;
  decision_id: UUID;

  variant_rank: number;
  route_ids: UUID[];
  total_distance_km?: number;
  estimated_cost?: number;
  co2_estimate_grams?: number;

  variant_score?: number;
  optimization_efficiency?: number;

  constraints_satisfied?: boolean;
  violated_constraints?: ConstraintViolation[];

  rejection_reason?: string;

  created_at: string;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export interface LogisticsEvent {
  id: UUID;
  tenant_id: UUID;

  event_type: LogisticsEventType;

  // Related Entities
  order_id?: UUID;
  route_id?: UUID;
  vehicle_id?: UUID;

  // Data
  event_data: Record<string, any>;
  event_timestamp: string; // ISO 8601

  // Location
  location?: Location;

  // SLA Impact
  sla_impact?: 'compliant' | 'at_risk' | 'violated';

  created_at: string;
}

export type LogisticsEventType =
  | 'order_created'
  | 'route_assigned'
  | 'route_started'
  | 'stop_arrived'
  | 'stop_completed'
  | 'route_completed'
  | 'delivery_failed'
  | 'eta_updated'
  | 'vehicle_location_update'
  | 'sla_breach'
  | 'constraint_violation';

// ============================================================================
// OVERRIDE TYPES
// ============================================================================

export interface LogisticsOverride {
  id: UUID;
  tenant_id: UUID;

  override_type: 'route_approval' | 'route_rejection' | 'manual_assignment' | 'emergency_reroute' | 'constraint_waiver';

  decision_id?: UUID;

  override_by_user_id: UUID;
  override_timestamp: string; // ISO 8601

  original_route_id?: UUID;
  new_route_id?: UUID;

  override_reason: string;
  business_justification?: Record<string, any>;

  expected_sla_impact?: 'positive' | 'neutral' | 'negative';
  expected_cost_impact?: number;
  expected_co2_impact?: number;

  created_at: string;
}

// ============================================================================
// GOVERNANCE & COMPLIANCE TYPES
// ============================================================================

export interface LogisticsRiskAssessment {
  id: UUID;
  tenant_id: UUID;

  assessment_type: 'pre_deployment' | 'periodic' | 'post_incident' | 'model_update';
  assessment_date: string; // ISO date

  model_version: string;
  policy_version: number;

  overall_risk_level: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
  risk_score?: number;

  identified_risks?: Record<string, any>[];
  mitigation_strategies?: Record<string, any>[];
  residual_risks?: Record<string, any>;

  approved_by?: UUID;
  approved_at?: string;

  notes?: string;

  created_at: string;
  updated_at: string;
}

export interface LogisticsComplianceViolation {
  id: UUID;
  tenant_id: UUID;

  violation_type: 'sla_breach' | 'constraint_violation' | 'data_quality_issue' | 'bias_detected' | 'safety_concern';
  severity: 'critical' | 'high' | 'medium' | 'low';

  order_id?: UUID;
  route_id?: UUID;
  decision_id?: UUID;

  violation_description: string;
  violation_data?: Record<string, any>;

  promised_time?: string;
  actual_time?: string;
  delay_minutes?: number;

  root_cause?: string;

  status: 'open' | 'investigating' | 'resolved' | 'escalated';
  resolved_at?: string;
  resolved_by?: UUID;

  created_at: string;
  updated_at: string;
}

export interface LogisticsAnalyticsDaily {
  id: UUID;
  tenant_id: UUID;

  report_date: string; // ISO date

  // Volume
  total_orders: number;
  delivered_orders: number;
  failed_orders: number;

  // SLA
  sla_compliance_rate: number;
  average_delay_minutes?: number;

  // Efficiency
  total_routes: number;
  average_route_efficiency: number;
  total_distance_km: number;

  // Cost
  total_cost_estimate?: number;
  cost_per_order?: number;

  // Environment
  total_co2_grams?: number;
  co2_per_order_grams?: number;

  // Quality
  data_quality_avg?: number;
  manual_overrides_count: number;

  // Compliance
  violations_count: number;

  calculated_at: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface OptimizeRoutesRequest {
  order_ids: UUID[];
  vehicle_ids?: UUID[];
  constraints?: UUID[];
  options?: {
    include_alternatives: boolean;
    max_alternatives: number;
    optimization_timeout_seconds: number;
  };
}

export interface OptimizeRoutesResponse {
  decision_id: UUID;
  primary_routes: LogisticsRoute[];
  alternative_routes?: LogisticsRoute[][];
  reasoning: string;
  confidence_score: number;
  requires_human_approval: boolean;
  status: 'pending_approval' | 'approved' | 'rejected';
}

export interface RouteExplainabilityResponse {
  route_id: UUID;
  summary: string;
  rationale: string[];
  alternatives: RouteAlternativeExplanation[];
  constraints_applied: ConstraintExplanation[];
  confidence: 'high' | 'medium' | 'low';
  limitations: string[];
}

export interface RouteAlternativeExplanation {
  rank: number;
  distance_km: number;
  reason_not_chosen: string;
  estimated_impact: string;
}

export interface ConstraintExplanation {
  name: string;
  status: 'satisfied' | 'violated' | 'near_limit';
  details: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface PaginationParams {
  offset: number;
  limit: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  has_more: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

// Type guard helpers
export const isOrderStatus = (status: any): status is OrderStatus => {
  return ['pending', 'assigned', 'in_transit', 'delivered', 'failed', 'cancelled'].includes(status);
};

export const isRouteStatus = (status: any): status is RouteStatus => {
  return ['planned', 'optimizing', 'ready', 'dispatched', 'in_transit', 'completed', 'partial', 'failed', 'cancelled'].includes(status);
};
