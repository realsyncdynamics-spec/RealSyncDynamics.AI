-- Add yearly pricing variants (12 months for price of 10 = 2-month discount)
-- Plan keys: starter_yearly, growth_yearly, agency_yearly, scale_yearly

INSERT INTO subscription_plans (
  id,
  name,
  description,
  price_eur,
  stripe_product_id,
  stripe_price_id,
  recurring,
  billing_period_days,
  bot_quota_max_bots,
  bot_quota_max_answers_per_month,
  features,
  active
) VALUES
  ('starter_yearly', 'Starter Yearly', 'Annual plan: 12 months for price of 10', 790.00, 'prod_starter_yearly_ug', 'price_starter_yearly_ug', true, 365, 1, 500, '["dsgvo_scan", "dse_generator", "consent_setup", "monitoring", "evidence_trail", "email_alerts", "automation_skills"]'::jsonb, true),
  ('growth_yearly', 'Growth Yearly', 'Annual plan: 12 months for price of 10', 2490.00, 'prod_growth_yearly_ug', 'price_growth_yearly_ug', true, 365, 2, 2000, '["all_starter", "ai_governance", "ai_risk_register", "daily_monitoring", "drift_detection", "fix_recommendations", "risk_dashboard", "governance_bots", "automation_skills"]'::jsonb, true),
  ('agency_yearly', 'Agency Yearly', 'Annual plan: 12 months for price of 10', 6900.00, 'prod_agency_yearly_ug', 'price_agency_yearly_ug', true, 365, 10, 25000, '["all_growth", "governance_agents", "white_label_bots", "bot_handoff", "intent_matching", "industry_library", "api_webhooks", "kodee_vps", "c2pa_provenance", "bulk_jobs", "scheduler", "evidence_vault_advanced", "policy_packs", "priority_support"]'::jsonb, true),
  ('scale_yearly', 'Scale Yearly', 'Annual plan: 12 months for price of 10', 19000.00, 'prod_scale_yearly_ug', 'price_scale_yearly_ug', true, 365, 50, 100000, '["all_agency", "multi_tenant_dashboard", "subdomain_whitelabel", "full_api_access", "sla_4h_support"]'::jsonb, true)
ON CONFLICT (id) DO NOTHING;
