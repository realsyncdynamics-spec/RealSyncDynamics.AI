-- Migration: 20260719010000_logistics_governance_tables.sql
-- Description: Governance, risk assessment, and compliance tracking for Logistics OS
-- Phase: 2 - Database Schema (Part 2)
-- Status: Production-Ready

-- ============================================================================
-- 1. LOGISTICS RISK ASSESSMENTS TABLE
-- ============================================================================
-- Pre-deployment and continuous risk assessment records
CREATE TABLE IF NOT EXISTS public.logistics_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Assessment Metadata
  assessment_type VARCHAR NOT NULL CHECK (assessment_type IN (
    'pre_deployment', 'periodic', 'post_incident', 'model_update'
  )),
  assessment_date DATE NOT NULL,

  -- Model & Policy Versions
  model_version VARCHAR NOT NULL,        -- e.g., claude-3.5-sonnet
  policy_version INTEGER NOT NULL,

  -- Risk Evaluation
  overall_risk_level VARCHAR NOT NULL CHECK (overall_risk_level IN (
    'critical', 'high', 'medium', 'low', 'minimal'
  )),
  risk_score NUMERIC(5, 3),              -- 0.0-1.0

  -- Risk Factors Assessed
  autonomy_level VARCHAR,
  impact_scope VARCHAR,
  reversibility VARCHAR,
  frequency_level VARCHAR,
  transparency_level VARCHAR,

  -- Identified Risks
  identified_risks JSONB,                 -- Array of risk objects
  mitigation_strategies JSONB,            -- Array of mitigation objects
  residual_risks JSONB,

  -- Approval
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  reviewed_by_external UUID[],            -- External auditor IDs

  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT risk_assessments_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE public.logistics_risk_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_risk_assessments"
  ON public.logistics_risk_assessments
  FOR ALL
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE INDEX idx_risk_assessments_tenant ON public.logistics_risk_assessments(tenant_id);
CREATE INDEX idx_risk_assessments_type ON public.logistics_risk_assessments(assessment_type);
CREATE INDEX idx_risk_assessments_date ON public.logistics_risk_assessments(assessment_date DESC);

-- ============================================================================
-- 2. LOGISTICS COMPLIANCE VIOLATIONS TABLE
-- ============================================================================
-- Tracking of SLA breaches, constraint violations, and compliance gaps
CREATE TABLE IF NOT EXISTS public.logistics_compliance_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Violation Details
  violation_type VARCHAR NOT NULL CHECK (violation_type IN (
    'sla_breach', 'constraint_violation', 'data_quality_issue',
    'bias_detected', 'safety_concern'
  )),
  severity VARCHAR NOT NULL CHECK (severity IN (
    'critical', 'high', 'medium', 'low'
  )),

  -- Related Entities
  order_id UUID REFERENCES public.logistics_orders(id) ON DELETE SET NULL,
  route_id UUID REFERENCES public.logistics_routes(id) ON DELETE SET NULL,
  decision_id UUID REFERENCES public.logistics_decisions(id) ON DELETE SET NULL,

  -- Violation Details
  violation_description TEXT NOT NULL,
  violation_data JSONB,                  -- Detailed violation info

  -- SLA Impact
  promised_time TIMESTAMP WITH TIME ZONE,
  actual_time TIMESTAMP WITH TIME ZONE,
  delay_minutes INTEGER,
  customer_impact VARCHAR,               -- 'none', 'minor', 'major'

  -- Root Cause Analysis
  root_cause VARCHAR,
  root_cause_analysis TEXT,

  -- Resolution
  status VARCHAR DEFAULT 'open' CHECK (status IN (
    'open', 'investigating', 'resolved', 'escalated'
  )),
  resolution_actions TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT compliance_violations_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE public.logistics_compliance_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_compliance_violations"
  ON public.logistics_compliance_violations
  FOR ALL
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE INDEX idx_compliance_violations_tenant ON public.logistics_compliance_violations(tenant_id);
CREATE INDEX idx_compliance_violations_type ON public.logistics_compliance_violations(violation_type);
CREATE INDEX idx_compliance_violations_status ON public.logistics_compliance_violations(status);
CREATE INDEX idx_compliance_violations_order ON public.logistics_compliance_violations(order_id);
CREATE INDEX idx_compliance_violations_created ON public.logistics_compliance_violations(created_at DESC);

-- ============================================================================
-- 3. LOGISTICS BIAS DETECTION TABLE
-- ============================================================================
-- Systemic bias monitoring (geographic, temporal, driver, customer)
CREATE TABLE IF NOT EXISTS public.logistics_bias_detection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Assessment Period
  assessment_period VARCHAR NOT NULL,     -- 'daily', 'weekly', 'monthly'
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,

  -- Bias Types Assessed
  geographic_bias_detected BOOLEAN DEFAULT false,
  geographic_variance NUMERIC(5, 3),     -- 0.0-1.0
  geographic_details JSONB,              -- Variance by postcode, etc.

  temporal_bias_detected BOOLEAN DEFAULT false,
  temporal_variance NUMERIC(5, 3),
  temporal_details JSONB,                -- Variance by hour/day

  driver_workload_bias_detected BOOLEAN DEFAULT false,
  driver_variance NUMERIC(5, 3),
  driver_details JSONB,                  -- Variance by driver

  customer_segment_bias_detected BOOLEAN DEFAULT false,
  customer_variance NUMERIC(5, 3),
  customer_details JSONB,                -- Variance by customer type

  -- Overall Assessment
  systemic_bias_detected BOOLEAN,
  bias_severity VARCHAR,
  bias_description TEXT,

  -- Action Taken
  mitigation_actions TEXT,
  policy_adjustments JSONB,
  review_required BOOLEAN DEFAULT false,

  -- Metadata
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT bias_detection_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE public.logistics_bias_detection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_bias_detection"
  ON public.logistics_bias_detection
  FOR ALL
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE INDEX idx_bias_detection_tenant ON public.logistics_bias_detection(tenant_id);
CREATE INDEX idx_bias_detection_period ON public.logistics_bias_detection(period_start_date, period_end_date);

-- ============================================================================
-- 4. LOGISTICS DATA QUALITY LOGS TABLE
-- ============================================================================
-- Data quality tracking for compliance and audit
CREATE TABLE IF NOT EXISTS public.logistics_data_quality_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Related Decision
  decision_id UUID REFERENCES public.logistics_decisions(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.logistics_orders(id) ON DELETE SET NULL,

  -- Quality Metrics
  quality_score NUMERIC(5, 2),            -- 0-100
  quality_grade VARCHAR CHECK (quality_grade IN ('A', 'B', 'C', 'D', 'F')),

  -- Issue Categories
  missing_fields VARCHAR[],
  invalid_entries JSONB,
  data_type_mismatches JSONB,
  freshness_issues JSONB,

  -- Overall Assessment
  data_usable_for_optimization BOOLEAN DEFAULT true,
  requires_manual_review BOOLEAN DEFAULT false,
  quality_flags VARCHAR[],

  -- Resolution
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes TEXT,
  corrected_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT data_quality_logs_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE public.logistics_data_quality_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_data_quality"
  ON public.logistics_data_quality_logs
  FOR ALL
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE INDEX idx_data_quality_tenant ON public.logistics_data_quality_logs(tenant_id);
CREATE INDEX idx_data_quality_score ON public.logistics_data_quality_logs(quality_score);
CREATE INDEX idx_data_quality_decision ON public.logistics_data_quality_logs(decision_id);

-- ============================================================================
-- 5. LOGISTICS ETA PERFORMANCE TABLE
-- ============================================================================
-- Track ETA prediction accuracy for model monitoring
CREATE TABLE IF NOT EXISTS public.logistics_eta_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Prediction vs. Reality
  order_id UUID REFERENCES public.logistics_orders(id) ON DELETE SET NULL,
  route_id UUID REFERENCES public.logistics_routes(id) ON DELETE SET NULL,

  predicted_arrival_time TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_arrival_time TIMESTAMP WITH TIME ZONE,

  prediction_error_minutes INTEGER,      -- Actual - Predicted
  prediction_accuracy_percent NUMERIC(5, 3),

  -- Routing Performance
  predicted_distance_km NUMERIC(8, 2),
  actual_distance_km NUMERIC(8, 2),
  distance_error_percent NUMERIC(5, 3),

  -- Environmental Impact
  predicted_co2_grams NUMERIC(12, 2),
  actual_co2_grams NUMERIC(12, 2),

  -- Context
  weather_conditions VARCHAR,
  traffic_conditions VARCHAR,
  route_complexity VARCHAR,               -- 'simple', 'moderate', 'complex'

  -- Metadata
  prediction_model_version VARCHAR,
  model_confidence_score NUMERIC(5, 3),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT eta_performance_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE public.logistics_eta_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_eta_performance"
  ON public.logistics_eta_performance
  FOR ALL
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE INDEX idx_eta_performance_tenant ON public.logistics_eta_performance(tenant_id);
CREATE INDEX idx_eta_performance_order ON public.logistics_eta_performance(order_id);
CREATE INDEX idx_eta_performance_created ON public.logistics_eta_performance(created_at DESC);

-- ============================================================================
-- 6. LOGISTICS ANALYTICS DAILY SUMMARY TABLE
-- ============================================================================
-- Daily aggregated metrics for KPI tracking and dashboards
CREATE TABLE IF NOT EXISTS public.logistics_analytics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Date
  report_date DATE NOT NULL,
  report_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- Volume Metrics
  total_orders INTEGER,
  delivered_orders INTEGER,
  failed_orders INTEGER,
  pending_orders INTEGER,

  -- SLA Metrics
  sla_compliance_rate NUMERIC(5, 3),     -- 0.0-1.0
  on_time_deliveries INTEGER,
  late_deliveries INTEGER,
  average_delay_minutes NUMERIC(8, 2),

  -- Efficiency Metrics
  total_routes INTEGER,
  routes_completed INTEGER,
  average_route_efficiency NUMERIC(5, 3),
  total_distance_km NUMERIC(10, 2),
  average_distance_per_order NUMERIC(8, 2),

  -- Cost Metrics
  total_cost_estimate NUMERIC(12, 2),
  cost_per_order NUMERIC(10, 2),
  cost_vs_baseline NUMERIC(5, 3),        -- Efficiency ratio

  -- Environmental Metrics
  total_co2_grams NUMERIC(12, 2),
  co2_per_order_grams NUMERIC(8, 2),
  co2_vs_baseline NUMERIC(5, 3),

  -- Quality Metrics
  data_quality_avg NUMERIC(5, 2),
  manual_overrides_count INTEGER,
  override_rate NUMERIC(5, 3),

  -- Compliance Metrics
  violations_count INTEGER,
  constraint_violations INTEGER,
  bias_alerts INTEGER,

  -- Metadata
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT analytics_daily_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT analytics_daily_unique UNIQUE (tenant_id, report_date)
);

ALTER TABLE public.logistics_analytics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_analytics_daily"
  ON public.logistics_analytics_daily
  FOR ALL
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE INDEX idx_analytics_daily_tenant ON public.logistics_analytics_daily(tenant_id);
CREATE INDEX idx_analytics_daily_date ON public.logistics_analytics_daily(report_date DESC);

-- ============================================================================
-- 7. LOGISTICS COMPLIANCE REPORTS TABLE
-- ============================================================================
-- Regulatory compliance reports (per Article 6(2) EU AI Act)
CREATE TABLE IF NOT EXISTS public.logistics_compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Report Details
  report_type VARCHAR NOT NULL CHECK (report_type IN (
    'monthly', 'quarterly', 'annual', 'audit', 'incident'
  )),
  report_period_start DATE NOT NULL,
  report_period_end DATE NOT NULL,

  -- Executive Summary
  total_decisions INTEGER,
  sla_compliance_rate NUMERIC(5, 3),
  override_rate NUMERIC(5, 3),
  incident_count INTEGER,
  risk_events INTEGER,

  -- Detailed Content
  detailed_metrics JSONB,
  incident_log JSONB,
  risk_assessment_summary TEXT,
  compliance_statement TEXT,

  -- Generation & Approval
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,

  -- Storage
  report_pdf_url VARCHAR,                -- PDF export location
  is_public BOOLEAN DEFAULT false,       -- Can be shared with regulators

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT compliance_reports_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

ALTER TABLE public.logistics_compliance_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_compliance_reports"
  ON public.logistics_compliance_reports
  FOR ALL
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE INDEX idx_compliance_reports_tenant ON public.logistics_compliance_reports(tenant_id);
CREATE INDEX idx_compliance_reports_type ON public.logistics_compliance_reports(report_type);
CREATE INDEX idx_compliance_reports_period ON public.logistics_compliance_reports(report_period_start, report_period_end);

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Created 7 additional tables for Governance & Compliance:
-- 1. logistics_risk_assessments (pre/post-deployment risk evaluation)
-- 2. logistics_compliance_violations (SLA, constraint, data quality issues)
-- 3. logistics_bias_detection (systemic bias monitoring)
-- 4. logistics_data_quality_logs (quality tracking for compliance)
-- 5. logistics_eta_performance (model accuracy monitoring)
-- 6. logistics_analytics_daily (KPI aggregation)
-- 7. logistics_compliance_reports (regulatory reporting)
--
-- All tables:
-- ✅ RLS-enabled with tenant isolation
-- ✅ Properly indexed for performance
-- ✅ Support audit logging & compliance tracking
-- ✅ Enable continuous monitoring per EU AI Act
--
-- Total new tables: 15 (8 core + 7 governance/compliance)
-- Next: Phase 3 - Order Management API & Edge Functions
