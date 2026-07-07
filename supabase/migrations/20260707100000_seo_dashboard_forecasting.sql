-- Forecasting & Predictive Analytics for SEO-Marketing-Dashboard
-- Provides churn predictions, revenue forecasts, and trend analysis

-- Create table for predictive models and coefficients
CREATE TABLE IF NOT EXISTS seo_forecast_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  model_type VARCHAR(50) NOT NULL, -- churn_prediction, revenue_forecast, ltv_projection
  model_name VARCHAR(255) NOT NULL,
  model_version INT DEFAULT 1,
  algorithm VARCHAR(50), -- linear_regression, exponential_smoothing, arima
  coefficients JSONB, -- model parameters and weights
  accuracy_score NUMERIC, -- R² or similar metric
  rmse NUMERIC, -- root mean squared error
  last_trained_at TIMESTAMP WITH TIME ZONE,
  training_data_points INT,
  feature_importance JSONB, -- which factors matter most
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for forecast predictions
CREATE TABLE IF NOT EXISTS seo_forecast_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  forecast_model_id UUID NOT NULL REFERENCES public.seo_forecast_models(id) ON DELETE CASCADE,
  prediction_type VARCHAR(50) NOT NULL, -- churn_risk, revenue, ltv, conversion_trend
  prediction_date DATE NOT NULL,
  predicted_value NUMERIC,
  confidence_lower_bound NUMERIC,
  confidence_upper_bound NUMERIC,
  confidence_level NUMERIC, -- 0.9, 0.95, 0.99
  actual_value NUMERIC, -- filled in after period ends
  accuracy NUMERIC, -- how accurate this prediction was
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_at TIMESTAMP WITH TIME ZONE
);

-- Create table for forecast scenarios and what-if analysis
CREATE TABLE IF NOT EXISTS seo_forecast_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scenario_name VARCHAR(255) NOT NULL,
  scenario_description TEXT,
  scenario_type VARCHAR(50) NOT NULL, -- optimistic, pessimistic, realistic
  base_period_start DATE,
  base_period_end DATE,
  forecast_period_start DATE,
  forecast_period_end DATE,
  adjustments JSONB, -- parameter changes: {cac_reduction: 0.1, ltv_increase: 0.05}
  impact_metrics JSONB, -- projected outcomes
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archived_at TIMESTAMP WITH TIME ZONE
);

-- Create table for trend analysis and pattern detection
CREATE TABLE IF NOT EXISTS seo_trend_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  analysis_period_start DATE NOT NULL,
  analysis_period_end DATE NOT NULL,
  metric_type VARCHAR(50) NOT NULL, -- cac, ltv, conversion, churn, cmrr
  trend_direction VARCHAR(20), -- upward, downward, stable, volatile
  trend_strength NUMERIC, -- 0-1 indicating confidence
  seasonal_pattern BOOLEAN DEFAULT FALSE,
  cyclical_pattern BOOLEAN DEFAULT FALSE,
  anomalies JSONB, -- unusual data points and their causes
  pattern_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for alerts based on forecasts
CREATE TABLE IF NOT EXISTS seo_forecast_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL, -- high_churn_risk, revenue_decline, ltv_drop
  trigger_condition VARCHAR(255), -- the condition that triggered alert
  severity VARCHAR(20), -- critical, high, medium, low
  affected_metric VARCHAR(50),
  predicted_impact NUMERIC,
  recommended_action TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on all forecast tables
ALTER TABLE seo_forecast_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_forecast_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_forecast_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_trend_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_forecast_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for forecast models
CREATE POLICY seo_forecast_models_read ON public.seo_forecast_models
  FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY seo_forecast_models_insert ON public.seo_forecast_models
  FOR INSERT
  WITH CHECK (
    public.is_tenant_member(tenant_id) AND
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.user_id = auth.uid()
      AND memberships.tenant_id = seo_forecast_models.tenant_id
      AND memberships.role IN ('admin', 'owner')
    )
  );

-- RLS Policies for predictions
CREATE POLICY seo_forecast_predictions_read ON public.seo_forecast_predictions
  FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY seo_forecast_predictions_insert ON public.seo_forecast_predictions
  FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

-- RLS Policies for scenarios
CREATE POLICY seo_forecast_scenarios_read ON public.seo_forecast_scenarios
  FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY seo_forecast_scenarios_create ON public.seo_forecast_scenarios
  FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

-- RLS Policies for trends
CREATE POLICY seo_trend_analysis_read ON public.seo_trend_analysis
  FOR SELECT
  USING (public.is_tenant_member(tenant_id));

-- RLS Policies for alerts
CREATE POLICY seo_forecast_alerts_read ON public.seo_forecast_alerts
  FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY seo_forecast_alerts_update ON public.seo_forecast_alerts
  FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

-- Create indexes for performance
CREATE INDEX idx_forecast_models_tenant_type ON public.seo_forecast_models(tenant_id, model_type);
CREATE INDEX idx_forecast_models_trained_at ON public.seo_forecast_models(last_trained_at DESC);

CREATE INDEX idx_forecast_predictions_model ON public.seo_forecast_predictions(forecast_model_id, prediction_date DESC);
CREATE INDEX idx_forecast_predictions_tenant_date ON public.seo_forecast_predictions(tenant_id, prediction_date DESC);
CREATE INDEX idx_forecast_predictions_type ON public.seo_forecast_predictions(prediction_type, created_at DESC);

CREATE INDEX idx_forecast_scenarios_tenant ON public.seo_forecast_scenarios(tenant_id, forecast_period_start DESC);
CREATE INDEX idx_forecast_scenarios_type ON public.seo_forecast_scenarios(scenario_type);

CREATE INDEX idx_trend_analysis_tenant_period ON public.seo_trend_analysis(tenant_id, analysis_period_start DESC);
CREATE INDEX idx_trend_analysis_metric ON public.seo_trend_analysis(metric_type);

CREATE INDEX idx_forecast_alerts_tenant_active ON public.seo_forecast_alerts(tenant_id, is_active);
CREATE INDEX idx_forecast_alerts_severity ON public.seo_forecast_alerts(severity);
CREATE INDEX idx_forecast_alerts_created ON public.seo_forecast_alerts(created_at DESC);

-- Function to calculate trend direction from metrics
CREATE OR REPLACE FUNCTION calculate_trend_direction(
  p_tenant_id UUID,
  p_metric_type VARCHAR,
  p_period_days INT DEFAULT 30
)
RETURNS TABLE (
  trend_direction VARCHAR,
  trend_strength NUMERIC,
  current_value NUMERIC,
  previous_value NUMERIC,
  change_percent NUMERIC,
  has_anomaly BOOLEAN
) AS $$
DECLARE
  v_current NUMERIC;
  v_previous NUMERIC;
  v_change_pct NUMERIC;
BEGIN
  -- Get current period average
  SELECT AVG(
    CASE
      WHEN p_metric_type = 'cac' THEN (revenue_generated / NULLIF(customers_acquired, 0))
      WHEN p_metric_type = 'ltv' THEN (revenue_generated / NULLIF(customers_acquired, 0))
      WHEN p_metric_type = 'conversion' THEN ((leads_generated / NULLIF(web_visitors, 0)) * 100)
      ELSE revenue_generated
    END
  ) INTO v_current
  FROM marketing_metrics
  WHERE tenant_id = p_tenant_id
    AND period_start >= CURRENT_DATE - (p_period_days || ' days')::INTERVAL;

  -- Get previous period average
  SELECT AVG(
    CASE
      WHEN p_metric_type = 'cac' THEN (revenue_generated / NULLIF(customers_acquired, 0))
      WHEN p_metric_type = 'ltv' THEN (revenue_generated / NULLIF(customers_acquired, 0))
      WHEN p_metric_type = 'conversion' THEN ((leads_generated / NULLIF(web_visitors, 0)) * 100)
      ELSE revenue_generated
    END
  ) INTO v_previous
  FROM marketing_metrics
  WHERE tenant_id = p_tenant_id
    AND period_start >= CURRENT_DATE - ((p_period_days * 2) || ' days')::INTERVAL
    AND period_start < CURRENT_DATE - (p_period_days || ' days')::INTERVAL;

  -- Calculate change
  IF v_previous IS NOT NULL AND v_previous != 0 THEN
    v_change_pct := ((v_current - v_previous) / v_previous * 100);
  ELSE
    v_change_pct := 0;
  END IF;

  RETURN QUERY SELECT
    CASE
      WHEN v_change_pct > 5 THEN 'upward'::VARCHAR
      WHEN v_change_pct < -5 THEN 'downward'::VARCHAR
      ELSE 'stable'::VARCHAR
    END,
    ABS(v_change_pct) / 100.0,
    v_current,
    v_previous,
    v_change_pct,
    (ABS(v_change_pct) > 25)::BOOLEAN;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to generate churn predictions
CREATE OR REPLACE FUNCTION predict_churn_risk(
  p_tenant_id UUID,
  p_lookback_days INT DEFAULT 90
)
RETURNS TABLE (
  prediction_date DATE,
  churn_probability NUMERIC,
  confidence NUMERIC,
  risk_factors TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  WITH recent_customers AS (
    SELECT
      cl.id,
      cl.churn_risk_score,
      mm.period_start,
      ROW_NUMBER() OVER (PARTITION BY cl.id ORDER BY mm.period_start DESC) as rn,
      LAG(mm.revenue_generated) OVER (PARTITION BY cl.id ORDER BY mm.period_start) as prev_revenue,
      mm.revenue_generated
    FROM customer_lifecycle cl
    JOIN marketing_metrics mm ON cl.tenant_id = mm.tenant_id
    WHERE cl.tenant_id = p_tenant_id
      AND mm.period_start >= CURRENT_DATE - (p_lookback_days || ' days')::INTERVAL
  )
  SELECT
    CURRENT_DATE + (interval '1 day' * gen_series(1, 30))::DATE,
    (CASE
      WHEN avg(churn_risk_score) > 0.7 THEN 0.85
      WHEN avg(churn_risk_score) > 0.5 THEN 0.65
      WHEN avg(churn_risk_score) > 0.3 THEN 0.35
      ELSE 0.15
    END) + (RANDOM() * 0.1),
    (CASE
      WHEN count(*) > 100 THEN 0.95
      WHEN count(*) > 50 THEN 0.85
      WHEN count(*) > 20 THEN 0.75
      ELSE 0.65
    END),
    ARRAY_AGG(DISTINCT
      CASE
        WHEN churn_risk_score > 0.7 THEN 'high_churn_score'
        WHEN prev_revenue IS NOT NULL AND (revenue_generated / NULLIF(prev_revenue, 0)) < 0.8 THEN 'revenue_decline'
        ELSE 'monitoring'
      END
    ) FILTER (WHERE churn_risk_score > 0 OR prev_revenue IS NOT NULL)
  FROM recent_customers
  WHERE rn = 1
  GROUP BY 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to generate revenue forecasts
CREATE OR REPLACE FUNCTION forecast_revenue(
  p_tenant_id UUID,
  p_lookback_months INT DEFAULT 12,
  p_forecast_months INT DEFAULT 3
)
RETURNS TABLE (
  forecast_month DATE,
  predicted_revenue NUMERIC,
  lower_bound NUMERIC,
  upper_bound NUMERIC,
  confidence NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH monthly_data AS (
    SELECT
      DATE_TRUNC('month', period_start)::DATE as month,
      SUM(revenue_generated) as monthly_revenue,
      AVG(revenue_generated) as avg_revenue,
      STDDEV(revenue_generated) as stddev_revenue
    FROM marketing_metrics
    WHERE tenant_id = p_tenant_id
      AND period_start >= CURRENT_DATE - (p_lookback_months || ' months')::INTERVAL
    GROUP BY DATE_TRUNC('month', period_start)
    ORDER BY month
  ),
  trend_calc AS (
    SELECT
      REGR_SLOPE(monthly_revenue, ROW_NUMBER() OVER (ORDER BY month)) as slope,
      REGR_INTERCEPT(monthly_revenue, ROW_NUMBER() OVER (ORDER BY month)) as intercept,
      AVG(stddev_revenue) as avg_std
    FROM monthly_data
  )
  SELECT
    (CURRENT_DATE + (interval '1 month' * gen_series(1, p_forecast_months)))::DATE,
    (SELECT intercept FROM trend_calc) + (SELECT slope FROM trend_calc) * (
      (EXTRACT(YEAR FROM CURRENT_DATE) * 12 + EXTRACT(MONTH FROM CURRENT_DATE)) +
      gen_series(1, p_forecast_months)
    ),
    (SELECT intercept FROM trend_calc) + (SELECT slope FROM trend_calc) * (
      (EXTRACT(YEAR FROM CURRENT_DATE) * 12 + EXTRACT(MONTH FROM CURRENT_DATE)) +
      gen_series(1, p_forecast_months)
    ) - (SELECT avg_std FROM trend_calc) * 1.96,
    (SELECT intercept FROM trend_calc) + (SELECT slope FROM trend_calc) * (
      (EXTRACT(YEAR FROM CURRENT_DATE) * 12 + EXTRACT(MONTH FROM CURRENT_DATE)) +
      gen_series(1, p_forecast_months)
    ) + (SELECT avg_std FROM trend_calc) * 1.96,
    0.95
  FROM trend_calc;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to detect seasonal patterns
CREATE OR REPLACE FUNCTION detect_seasonal_patterns(
  p_tenant_id UUID,
  p_metric_type VARCHAR,
  p_lookback_days INT DEFAULT 365
)
RETURNS TABLE (
  has_seasonality BOOLEAN,
  seasonal_period INT,
  seasonal_strength NUMERIC,
  peak_months INT[],
  trough_months INT[]
) AS $$
DECLARE
  v_variance_between_months NUMERIC;
  v_variance_total NUMERIC;
  v_seasonality_ratio NUMERIC;
BEGIN
  -- Calculate variance between months vs total variance
  WITH monthly_data AS (
    SELECT
      EXTRACT(MONTH FROM period_start)::INT as month,
      CASE
        WHEN p_metric_type = 'cac' THEN AVG(revenue_generated / NULLIF(customers_acquired, 0))
        WHEN p_metric_type = 'ltv' THEN AVG(revenue_generated / NULLIF(customers_acquired, 0))
        WHEN p_metric_type = 'conversion' THEN AVG((leads_generated / NULLIF(web_visitors, 0)) * 100)
        ELSE AVG(revenue_generated)
      END as metric_value
    FROM marketing_metrics
    WHERE tenant_id = p_tenant_id
      AND period_start >= CURRENT_DATE - (p_lookback_days || ' days')::INTERVAL
    GROUP BY EXTRACT(MONTH FROM period_start)
  ),
  variance_calc AS (
    SELECT
      VARIANCE((metric_value - (SELECT AVG(metric_value) FROM monthly_data))) as var_between,
      (SELECT VARIANCE(metric_value) FROM monthly_data) as var_total
    FROM monthly_data
  )
  SELECT * INTO v_variance_between_months, v_variance_total
  FROM variance_calc
  LIMIT 1;

  v_seasonality_ratio := COALESCE(v_variance_between_months / NULLIF(v_variance_total, 0), 0);

  RETURN QUERY
  SELECT
    (v_seasonality_ratio > 0.3)::BOOLEAN,
    12::INT,
    v_seasonality_ratio,
    ARRAY[]::INT[],
    ARRAY[]::INT[];
END;
$$ LANGUAGE plpgsql STABLE;

-- Create view for forecast dashboard
CREATE OR REPLACE VIEW seo_forecast_overview AS
SELECT
  fm.tenant_id,
  fm.model_type,
  fm.model_name,
  COUNT(fp.id) as total_predictions,
  MAX(fp.prediction_date) as latest_prediction_date,
  AVG(fp.accuracy) as average_accuracy,
  fm.accuracy_score as model_accuracy,
  fm.last_trained_at,
  fm.training_data_points
FROM seo_forecast_models fm
LEFT JOIN seo_forecast_predictions fp ON fm.id = fp.forecast_model_id
GROUP BY fm.id, fm.tenant_id, fm.model_type, fm.model_name, fm.accuracy_score, fm.last_trained_at, fm.training_data_points;

-- Create view for active alerts
CREATE OR REPLACE VIEW seo_active_forecast_alerts AS
SELECT
  alert_id,
  tenant_id,
  alert_type,
  severity,
  affected_metric,
  predicted_impact,
  recommended_action,
  created_at,
  (NOW() AT TIME ZONE 'UTC' - created_at) as time_since_alert
FROM seo_forecast_alerts
WHERE is_active = TRUE
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY
  CASE severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    ELSE 4
  END,
  created_at DESC;
