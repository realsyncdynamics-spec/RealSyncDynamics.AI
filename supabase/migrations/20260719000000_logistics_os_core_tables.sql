-- Migration: 20260719000000_logistics_os_core_tables.sql
-- Description: RealSync Logistics OS core tables with RLS and indexes
-- Phase: 2 - Database Schema
-- Status: Production-Ready

-- ============================================================================
-- 1. LOGISTICS ORDERS TABLE
-- ============================================================================
-- Stores delivery orders to be routed and optimized
CREATE TABLE IF NOT EXISTS public.logistics_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_number VARCHAR NOT NULL,

  -- Order Details
  customer_id VARCHAR NOT NULL,           -- External customer reference
  customer_name VARCHAR,
  customer_email VARCHAR,

  -- Location
  pickup_location JSONB NOT NULL,         -- { lat, lng, address }
  delivery_location JSONB NOT NULL,       -- { lat, lng, address }

  -- Time Window
  delivery_window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  delivery_window_end TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Package Details
  package_weight NUMERIC(10, 2) NOT NULL, -- kg
  package_volume NUMERIC(10, 2),          -- m³
  package_dimensions JSONB,                -- { length, width, height } in cm
  is_fragile BOOLEAN DEFAULT false,
  requires_signature BOOLEAN DEFAULT false,
  special_instructions TEXT,

  -- Priority & SLA
  priority VARCHAR DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  promised_delivery_date DATE NOT NULL,
  sla_window_minutes INTEGER,             -- Max delivery delay in minutes

  -- Status Tracking
  status VARCHAR DEFAULT 'pending' CHECK (status IN (
    'pending', 'assigned', 'in_transit', 'delivered', 'failed', 'cancelled'
  )),
  assigned_route_id UUID,                 -- FK to logistics_routes

  -- Metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- Constraints
  CONSTRAINT orders_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE public.logistics_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_orders"
  ON public.logistics_orders
  FOR ALL
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE INDEX idx_logistics_orders_tenant ON public.logistics_orders(tenant_id);
CREATE INDEX idx_logistics_orders_status ON public.logistics_orders(status);
CREATE INDEX idx_logistics_orders_route ON public.logistics_orders(assigned_route_id);
CREATE INDEX idx_logistics_orders_window ON public.logistics_orders(delivery_window_start, delivery_window_end);
CREATE INDEX idx_logistics_orders_priority ON public.logistics_orders(priority, status);

-- ============================================================================
-- 2. LOGISTICS VEHICLES TABLE
-- ============================================================================
-- Vehicle registry for routing optimization
CREATE TABLE IF NOT EXISTS public.logistics_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vehicle_code VARCHAR NOT NULL UNIQUE,

  -- Vehicle Details
  vehicle_type VARCHAR NOT NULL,          -- van, truck, bike, etc.
  license_plate VARCHAR,
  vin VARCHAR,

  -- Capacity
  max_weight_kg NUMERIC(10, 2) NOT NULL,
  max_volume_m3 NUMERIC(10, 2) NOT NULL,
  current_load_kg NUMERIC(10, 2) DEFAULT 0,
  current_volume_m3 NUMERIC(10, 2) DEFAULT 0,

  -- Driver Assignment
  assigned_driver_id VARCHAR,             -- External driver reference
  assigned_driver_name VARCHAR,

  -- Operating Constraints
  max_daily_hours NUMERIC(5, 2) DEFAULT 10,    -- EU regulation
  current_daily_hours NUMERIC(5, 2) DEFAULT 0,
  max_daily_distance_km NUMERIC(8, 2),
  current_daily_distance_km NUMERIC(8, 2) DEFAULT 0,

  -- Environmental
  emission_class VARCHAR,                 -- Euro 5, Euro 6, EV, etc.
  co2_per_km_grams NUMERIC(8, 3),
  fuel_type VARCHAR,                     -- petrol, diesel, ev, hybrid

  -- Status
  status VARCHAR DEFAULT 'available' CHECK (status IN (
    'available', 'in_use', 'maintenance', 'inactive'
  )),
  last_location JSONB,                   -- { lat, lng, timestamp }

  -- Availability
  available_from TIMESTAMP WITH TIME ZONE,
  available_until TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT vehicles_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE public.logistics_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_vehicles"
  ON public.logistics_vehicles
  FOR ALL
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE INDEX idx_logistics_vehicles_tenant ON public.logistics_vehicles(tenant_id);
CREATE INDEX idx_logistics_vehicles_status ON public.logistics_vehicles(status);
CREATE INDEX idx_logistics_vehicles_code ON public.logistics_vehicles(vehicle_code);

-- ============================================================================
-- 3. LOGISTICS ROUTES TABLE
-- ============================================================================
-- Optimized delivery routes with full reasoning
CREATE TABLE IF NOT EXISTS public.logistics_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  route_number VARCHAR NOT NULL,

  -- Assignment
  assigned_vehicle_id UUID NOT NULL REFERENCES public.logistics_vehicles(id) ON DELETE RESTRICT,
  assigned_driver_id VARCHAR,

  -- Route Details
  route_stops JSONB NOT NULL,             -- Ordered array of stop locations
  total_distance_km NUMERIC(8, 2),
  estimated_duration_minutes INTEGER,

  -- Scoring & Optimization
  route_score NUMERIC(5, 2),              -- 0-100, higher is better
  optimization_efficiency NUMERIC(5, 3),  -- vs. optimal (0.8-1.0)
  cost_estimate NUMERIC(10, 2),
  co2_estimate_grams NUMERIC(12, 2),

  -- Constraints Satisfaction
  constraints_satisfied BOOLEAN DEFAULT true,
  constraint_violations JSONB,             -- { constraint_name: reason }[]

  -- Status
  status VARCHAR DEFAULT 'planned' CHECK (status IN (
    'planned', 'optimizing', 'ready', 'dispatched', 'in_transit',
    'completed', 'partial', 'failed', 'cancelled'
  )),

  -- Tracking
  actual_start_time TIMESTAMP WITH TIME ZONE,
  actual_end_time TIMESTAMP WITH TIME ZONE,
  actual_distance_km NUMERIC(8, 2),
  actual_duration_minutes INTEGER,

  -- SLA Tracking
  sla_compliance_count INTEGER DEFAULT 0, -- Number of deliveries on-time
  sla_violation_count INTEGER DEFAULT 0,  -- Number of deliveries late
  sla_compliance_rate NUMERIC(5, 3),      -- 0.0-1.0

  -- Metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT routes_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT routes_vehicle_fk FOREIGN KEY (assigned_vehicle_id) REFERENCES public.logistics_vehicles(id)
);

ALTER TABLE public.logistics_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_routes"
  ON public.logistics_routes
  FOR ALL
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE INDEX idx_logistics_routes_tenant ON public.logistics_routes(tenant_id);
CREATE INDEX idx_logistics_routes_vehicle ON public.logistics_routes(assigned_vehicle_id);
CREATE INDEX idx_logistics_routes_status ON public.logistics_routes(status);
CREATE INDEX idx_logistics_routes_score ON public.logistics_routes(route_score DESC);

-- ============================================================================
-- 4. LOGISTICS CONSTRAINTS TABLE
-- ============================================================================
-- Deklarative constraint rules for optimization and validation
CREATE TABLE IF NOT EXISTS public.logistics_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  constraint_name VARCHAR NOT NULL,

  -- Definition
  constraint_type VARCHAR NOT NULL CHECK (constraint_type IN (
    'vehicle_capacity', 'driver_time', 'time_window', 'sla', 'environmental', 'custom'
  )),

  -- Rule Definition
  rule_condition VARCHAR NOT NULL,        -- e.g., "driving_hours > 10"
  rule_action VARCHAR NOT NULL CHECK (rule_action IN (
    'reject', 'penalty', 'warn', 'info'
  )),
  severity VARCHAR NOT NULL CHECK (severity IN (
    'critical', 'high', 'medium', 'low'
  )),

  -- Configuration
  parameters JSONB DEFAULT '{}',          -- Variable parameters
  is_active BOOLEAN DEFAULT true,
  priority_order INTEGER DEFAULT 100,     -- Lower = higher priority

  -- Versioning
  version_number INTEGER DEFAULT 1,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  change_reason TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT constraints_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE public.logistics_constraints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_constraints"
  ON public.logistics_constraints
  FOR ALL
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE INDEX idx_logistics_constraints_tenant ON public.logistics_constraints(tenant_id);
CREATE INDEX idx_logistics_constraints_type ON public.logistics_constraints(constraint_type);
CREATE INDEX idx_logistics_constraints_active ON public.logistics_constraints(is_active, priority_order);

-- ============================================================================
-- 5. LOGISTICS DECISIONS TABLE
-- ============================================================================
-- Routing decisions with full reasoning and evidence trail
CREATE TABLE IF NOT EXISTS public.logistics_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Decision Metadata
  decision_type VARCHAR NOT NULL,         -- 'route_optimization', 'override', 'replan'
  decision_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  decision_epoch INTEGER,                 -- Sequential decision counter

  -- Related Entities
  orders_input_ids UUID[],                -- Orders being decided on
  routes_generated_ids UUID[],            -- Routes generated by decision

  -- AI Model Information
  model_provider VARCHAR DEFAULT 'anthropic',
  model_name VARCHAR DEFAULT 'claude-3.5-sonnet',
  model_version VARCHAR,

  -- Policy & Governance
  policy_version INTEGER,
  policy_constraints_evaluated JSONB,     -- { constraint_id: { satisfied, penalty } }

  -- Decision Reasoning
  reasoning_summary TEXT,                 -- Plain-language explanation
  reasoning_detailed JSONB,                -- Full reasoning structure
  confidence_score NUMERIC(5, 3),         -- 0.0-1.0

  -- Alternatives Considered
  alternatives_count INTEGER DEFAULT 1,
  alternatives_considered JSONB,          -- Array of alternative routes with scores

  -- Constraints Evaluation
  all_constraints_satisfied BOOLEAN,
  violated_constraints JSONB,

  -- Human Oversight
  human_review_required BOOLEAN DEFAULT true,
  human_reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  human_review_timestamp TIMESTAMP WITH TIME ZONE,
  human_review_status VARCHAR CHECK (human_review_status IN (
    'pending', 'approved', 'rejected', 'modified'
  )),
  human_override_reason TEXT,

  -- Execution
  status VARCHAR DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'executed', 'cancelled'
  )),
  executed_at TIMESTAMP WITH TIME ZONE,

  -- Evidence & Audit
  evidence_event_id UUID,                 -- Link to ai_evidence_events
  input_hash VARCHAR,                     -- SHA-256 of orders input
  output_hash VARCHAR,                    -- SHA-256 of route decision
  c2pa_manifest_id VARCHAR,               -- C2PA signing reference

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT decisions_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE public.logistics_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_decisions"
  ON public.logistics_decisions
  FOR ALL
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE INDEX idx_logistics_decisions_tenant ON public.logistics_decisions(tenant_id);
CREATE INDEX idx_logistics_decisions_timestamp ON public.logistics_decisions(decision_timestamp);
CREATE INDEX idx_logistics_decisions_status ON public.logistics_decisions(status);
CREATE INDEX idx_logistics_decisions_reviewer ON public.logistics_decisions(human_reviewer_id);
CREATE INDEX idx_logistics_decisions_evidence ON public.logistics_decisions(evidence_event_id);

-- ============================================================================
-- 6. LOGISTICS DECISION VARIANTS TABLE
-- ============================================================================
-- Alternative routes considered during optimization
CREATE TABLE IF NOT EXISTS public.logistics_decision_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  decision_id UUID NOT NULL REFERENCES public.logistics_decisions(id) ON DELETE CASCADE,

  -- Variant Details
  variant_rank INTEGER NOT NULL,          -- 1 = selected, 2+ = alternatives
  route_ids UUID[],
  total_distance_km NUMERIC(8, 2),
  estimated_cost NUMERIC(10, 2),
  co2_estimate_grams NUMERIC(12, 2),

  -- Scoring
  variant_score NUMERIC(5, 2),
  optimization_efficiency NUMERIC(5, 3),

  -- Constraint Satisfaction
  constraints_satisfied BOOLEAN,
  violated_constraints JSONB,

  -- Reasoning for Rejection
  rejection_reason TEXT,                  -- Why wasn't this variant chosen?

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT variants_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT variants_decision_fk FOREIGN KEY (decision_id) REFERENCES public.logistics_decisions(id)
);

ALTER TABLE public.logistics_decision_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_variants"
  ON public.logistics_decision_variants
  FOR ALL
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE INDEX idx_logistics_variants_tenant ON public.logistics_decision_variants(tenant_id);
CREATE INDEX idx_logistics_variants_decision ON public.logistics_decision_variants(decision_id);
CREATE INDEX idx_logistics_variants_rank ON public.logistics_decision_variants(variant_rank);

-- ============================================================================
-- 7. LOGISTICS EVENTS TABLE
-- ============================================================================
-- Real-time tracking events (delivery status updates, tracking)
CREATE TABLE IF NOT EXISTS public.logistics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Event Details
  event_type VARCHAR NOT NULL CHECK (event_type IN (
    'order_created', 'route_assigned', 'route_started', 'stop_arrived',
    'stop_completed', 'route_completed', 'delivery_failed', 'eta_updated',
    'vehicle_location_update', 'sla_breach', 'constraint_violation'
  )),

  -- Related Entities
  order_id UUID REFERENCES public.logistics_orders(id) ON DELETE SET NULL,
  route_id UUID REFERENCES public.logistics_routes(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.logistics_vehicles(id) ON DELETE SET NULL,

  -- Event Data
  event_data JSONB NOT NULL,              -- { location, timestamp, status, etc. }
  event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- Location Tracking
  location JSONB,                         -- { lat, lng, accuracy_meters }

  -- SLA Impact
  sla_impact VARCHAR CHECK (sla_impact IN ('compliant', 'at_risk', 'violated')),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT events_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE public.logistics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_events"
  ON public.logistics_events
  FOR ALL
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE INDEX idx_logistics_events_tenant ON public.logistics_events(tenant_id);
CREATE INDEX idx_logistics_events_type ON public.logistics_events(event_type);
CREATE INDEX idx_logistics_events_timestamp ON public.logistics_events(event_timestamp DESC);
CREATE INDEX idx_logistics_events_order ON public.logistics_events(order_id);
CREATE INDEX idx_logistics_events_route ON public.logistics_events(route_id);
CREATE INDEX idx_logistics_events_vehicle ON public.logistics_events(vehicle_id);

-- ============================================================================
-- 8. LOGISTICS OVERRIDES TABLE
-- ============================================================================
-- Human interventions and manual routing overrides (audit trail)
CREATE TABLE IF NOT EXISTS public.logistics_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Override Details
  override_type VARCHAR NOT NULL CHECK (override_type IN (
    'route_approval', 'route_rejection', 'manual_assignment',
    'emergency_reroute', 'constraint_waiver'
  )),

  -- Related Decision
  decision_id UUID REFERENCES public.logistics_decisions(id) ON DELETE SET NULL,

  -- Override Action
  override_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  override_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- Override Details
  original_route_id UUID REFERENCES public.logistics_routes(id) ON DELETE SET NULL,
  new_route_id UUID REFERENCES public.logistics_routes(id) ON DELETE SET NULL,

  -- Reasoning
  override_reason TEXT NOT NULL,
  business_justification JSONB,           -- Structured reason data

  -- Impact
  expected_sla_impact VARCHAR,            -- 'positive', 'neutral', 'negative'
  expected_cost_impact NUMERIC(10, 2),
  expected_co2_impact NUMERIC(12, 2),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT overrides_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE public.logistics_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_overrides"
  ON public.logistics_overrides
  FOR ALL
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE INDEX idx_logistics_overrides_tenant ON public.logistics_overrides(tenant_id);
CREATE INDEX idx_logistics_overrides_user ON public.logistics_overrides(override_by_user_id);
CREATE INDEX idx_logistics_overrides_decision ON public.logistics_overrides(decision_id);
CREATE INDEX idx_logistics_overrides_timestamp ON public.logistics_overrides(override_timestamp DESC);

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Created 8 new tables for Logistics OS:
-- 1. logistics_orders (delivery orders to route)
-- 2. logistics_vehicles (vehicle registry)
-- 3. logistics_routes (optimized routes)
-- 4. logistics_constraints (deklarative rules)
-- 5. logistics_decisions (AI decisions with reasoning)
-- 6. logistics_decision_variants (alternatives considered)
-- 7. logistics_events (real-time tracking)
-- 8. logistics_overrides (human interventions audit trail)
--
-- All tables:
-- ✅ Have RLS enabled with tenant isolation
-- ✅ Have appropriate indexes for performance
-- ✅ Are fully typed with constraints
-- ✅ Support audit logging via existing infrastructure
-- ✅ Integrate with governance runtime & evidence layer
--
-- Next: Phase 3 - Order Management API
