-- Seeding von Subscription-Plänen (basierend auf src/config/pricing.ts)
-- Diese Datei wird nach der Hauptmigration ausgeführt.

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
  -- Free Audit (no account needed, handled separately)
  (
    'free_audit',
    'Free Audit',
    'URL-Scan mit DSGVO-Compliance-Score',
    0.00,
    NULL, -- Not in Stripe, handled separately
    NULL,
    false,
    0,
    0,
    0,
    '["url_scan", "compliance_score", "mini_report"]'::jsonb,
    true
  ),
  -- Starter (€79/month)
  (
    'starter',
    'Starter',
    'Für Unternehmen mit niedriger Governance-Komplexität',
    79.00,
    'prod_starter_ug', -- Update with real Stripe Product ID
    'price_starter_monthly_ug', -- Update with real Stripe Price ID
    true,
    30,
    1,
    500,
    '["dsgvo_scan", "dse_generator", "consent_setup", "monitoring", "evidence_trail", "email_alerts", "automation_skills"]'::jsonb,
    true
  ),
  -- Growth (€249/month)
  (
    'growth',
    'Growth',
    'Für mittlere Governance-Komplexität mit KI-Governance',
    249.00,
    'prod_growth_ug',
    'price_growth_monthly_ug',
    true,
    30,
    2,
    2000,
    '["all_starter", "ai_governance", "ai_risk_register", "daily_monitoring", "drift_detection", "fix_recommendations", "risk_dashboard", "governance_bots", "automation_skills"]'::jsonb,
    true
  ),
  -- Agency (€699/month)
  (
    'agency',
    'Agency',
    'Für hohe Governance-Komplexität mit White-Label und Agents',
    699.00,
    'prod_agency_ug',
    'price_agency_monthly_ug',
    true,
    30,
    10,
    25000,
    '["all_growth", "governance_agents", "white_label_bots", "bot_handoff", "intent_matching", "industry_library", "api_webhooks", "kodee_vps", "c2pa_provenance", "bulk_jobs", "scheduler", "evidence_vault_advanced", "policy_packs", "priority_support"]'::jsonb,
    true
  ),
  -- Scale (€1.999/month) — for multi-tenant resellers
  (
    'scale',
    'Scale',
    'Für DSB-Kanzleien und Compliance-Dienstleister mit 11–50 Mandanten',
    1999.00,
    'prod_scale_ug',
    'price_scale_monthly_ug',
    true,
    30,
    50,
    100000,
    '["all_agency", "multi_tenant_dashboard", "subdomain_whitelabel", "full_api_access", "sla_4h_support"]'::jsonb,
    true
  ),
  -- Enterprise (individuell)
  (
    'enterprise',
    'Enterprise',
    'Für regulierte Unternehmen mit individuellem Setup',
    0.00,
    'prod_enterprise_ug',
    NULL, -- Enterprise invoiced manually
    true,
    30,
    -1, -- Unlimited
    -1, -- Unlimited
    '["all_scale", "custom_setup", "sla_guarantee", "ai_act_governance", "dsb_integration", "evidence_vault_unlimited", "unlimited_domains", "custom_contracts"]'::jsonb,
    true
  );

COMMIT;
