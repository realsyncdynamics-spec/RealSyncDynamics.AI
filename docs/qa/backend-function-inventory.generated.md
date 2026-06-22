# Backend Function Inventory (87 Functions)

| Function | verify_jwt | Kategorie | FE-wired | Secrets | Tabellen | LOC |
|---|---|---|---|---|---|---|
| agent-os-runner | false | CRON_ONLY | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | tenants | 132 |
| ai-act-classify | false | AI_ACT | ✅ | AI_GATEWAY_IP_HASH_SALT, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | — | 270 |
| ai-act-risk-inventory | true | AI_ACT | ✅ | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | ai_act_risk_inventory, ai_tool_runs, memberships | 288 |
| ai-gateway | false | AI_GATEWAY | ✅ | AI_GATEWAY_IP_HASH_SALT, AI_GATEWAY_ANTHROPIC_MODEL, AI_GATEWAY_OPENAI_MODEL, AI_GATEWAY_OPENAI_EMBEDDING_MODEL, LM_STUDIO_BASE_URL, ANTHROPIC_API_KEY, OPENAI_API_KEY, LM_STUDIO_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | — | 263 |
| ai-invoke | true | AI_GATEWAY | ✅ | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | memberships | 80 |
| audit-drip-cron | false | CRON_ONLY | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM, PUBLIC_SITE_URL | — | 191 |
| audit-monitor-cron | false | CRON_ONLY | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, PLAYWRIGHT_SCANNER_URL, PLAYWRIGHT_SCANNER_KEY | audit_monitor_results, monitored_domains | 220 |
| audit-recheck-weekly | false | CRON_ONLY | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM, PUBLIC_SITE_URL | audit_recheck_subscriptions | 233 |
| audit-report-email | false | PUBLIC | ✅ | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AUDIT_EMAIL_FROM, RESEND_API_KEY, PUBLIC_SITE_URL | gdpr_audits | 212 |
| audit-report-pdf | false | PUBLIC | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY | documents, gdpr_audits, pii_redaction_log, profiles | 165 |
| automation-callback | false | STRIPE_WEBHOOK/RECEIVER | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AUTOMATION_CALLBACK_SECRET | automation_outputs, automation_run_events, automation_runs | 150 |
| automation-trigger | true | JWT_REQUIRED | ✅ | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, N8N_INTERNAL_URL, AUTOMATION_CALLBACK_SECRET | automation_run_events, automation_runs, automation_skills, memberships | 170 |
| business-metrics-cron | false | CRON_ONLY | ✅ | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BUSINESS_METRICS_SHARED_SECRET | business_metric_snapshots, business_revenue_timeseries, stripe_invoices, stripe_payment_events, subscriptions | 220 |
| ceo-brief-pdf | true | JWT_REQUIRED | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY | ceo_briefs, market_gaps, profiles | 211 |
| checkout-website-rebuild | false | PUBLIC | — | STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | products | 159 |
| classify-document | true | JWT_REQUIRED | ✅ | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | — | 243 |
| cookie-scan | false | PUBLIC | ✅ | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | — | 585 |
| cookie-scan-deep | false | PUBLIC | — | PLAYWRIGHT_SCANNER_URL, PLAYWRIGHT_SCANNER_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | gdpr_audits | 473 |
| daily-digest | false | CRON_ONLY | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FOUNDER_EMAIL, DIGEST_EMAIL_FROM, RESEND_API_KEY | gdpr_audits, outreach_contacts, page_views, sales_leads, subscriptions, tenants | 188 |
| enterprise-ai-os-agent-runs-list | false | PUBLIC | ✅ | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | enterprise_agent_runs | 51 |
| enterprise-ai-os-agents-list | false | PUBLIC | — | — | — | 30 |
| enterprise-ai-os-agents-run | false | PUBLIC | ✅ | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | enterprise_agent_runs, enterprise_ai_audit_events | 119 |
| enterprise-ai-os-discovery-intake | false | PUBLIC | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | enterprise_agent_runs, enterprise_ai_audit_events, enterprise_ai_system_registry | 201 |
| enterprise-ai-os-discovery-pending | false | PUBLIC | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | enterprise_ai_system_registry | 53 |
| enterprise-ai-os-evaluate | false | PUBLIC | — | — | — | 126 |
| enterprise-ai-os-feedback | false | PUBLIC | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | enterprise_feedback_reports | 86 |
| enterprise-ai-os-founding-access | false | PUBLIC | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | enterprise_founders_access | 101 |
| evidence-export | true | EVIDENCE | ✅ | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY | pii_redaction_log, tax_audit_events, tax_documents, tax_evidence_exports, tax_years | 256 |
| evidence-vault-export | true | EVIDENCE | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EVIDENCE_VAULT_SIGNING_KEY | ai_evidence_events, pii_redaction_log | 247 |
| gdpr-audit | false | GDPR | ✅ | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | gdpr_audits, sales_leads | 832 |
| gdpr-delete | true | GDPR | — | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | ai_tool_runs, memberships, workflow_runs | 134 |
| gdpr-export | true | GDPR | — | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | ai_tool_runs, c2pa_assets, memberships, pii_redaction_log, profiles, subscriptions … | 151 |
| generate-document | true | JWT_REQUIRED | ✅ | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | gdpr_audits, generated_documents | 459 |
| governance-agent | true | GOVERNANCE | ✅ | AGENT_MAX_TOKENS_PER_TURN, AGENT_LLM_PROVIDER, AGENT_LLM_MODEL, AGENT_ANON_LLM_MODEL, AGENT_LLM_MODEL_PROFILE, AGENT_ALLOW_US_ROUTING, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY | agent_runs, agent_sessions, llm_query_history, memberships | 1058 |
| governance-analytics-aggregator | false | CRON_ONLY | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | governance_kpi_snapshots, workspaces | 266 |
| governance-analytics-export | true | GOVERNANCE | ✅ | SUPABASE_URL, SUPABASE_ANON_KEY | workspace_members | 172 |
| governance-approvals | false | GOVERNANCE | ✅ | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | governance_approvals, governance_evidence, memberships | 164 |
| governance-connectors | false | GOVERNANCE | ✅ | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | — | 62 |
| governance-dpias | false | GOVERNANCE | ✅ | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | dpias, governance_assets, memberships | 134 |
| governance-dsr | false | GOVERNANCE | ✅ | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | dsr_requests, memberships, runtime_events, subject_ref_keys, subject_ref_mappings | 481 |
| governance-erasure-sweeper | false | CRON_ONLY | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | — | 82 |
| governance-incidents | false | GOVERNANCE | ✅ | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | governance_incidents | 88 |
| governance-ingest | false | STRIPE_WEBHOOK/RECEIVER | ✅ | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | governance_approvals, governance_assets, governance_events, governance_evidence, governance_ingest_keys, governance_policies … | 542 |
| governance-keys | false | GOVERNANCE | ✅ | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | governance_ingest_keys, memberships | 166 |
| governance-monitoring-scheduler | true | GOVERNANCE | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | governance_alerts, governance_events, monitoring_sources | 264 |
| governance-remediate | true | GOVERNANCE | ✅ | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | governance_assets, governance_events, memberships, remediation_snippets | 215 |
| governance-resources | false | GOVERNANCE | ✅ | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | asset_control_mappings, framework_controls, governance_assets, governance_evidence, governance_policies, memberships | 257 |
| governance-risk-score | false | GOVERNANCE | ✅ | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | asset_risk_history, governance_assets, governance_events | 179 |
| governance-vendors | false | GOVERNANCE | ✅ | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | memberships, runtime_events, vendors | 223 |
| governance-webhooks | false | STRIPE_WEBHOOK/RECEIVER | ✅ | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | governance_webhooks, memberships | 176 |
| health | false | MONITORING | ✅ | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | — | 46 |
| hostinger-agent-brief | true | JWT_REQUIRED | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | ceo_briefs, gdpr_audits, sales_leads | 220 |
| kodee | true | JWT_REQUIRED | ✅ | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, KODEE_SECRETS_KEY | vps_action_log, vps_connections, vps_ssh_keys | 936 |
| kodee-advise | true | JWT_REQUIRED | ✅ | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | memberships, vps_ssh_keys | 163 |
| kodee-diagnose | true | JWT_REQUIRED | ✅ | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | memberships, vps_ssh_keys | 160 |
| kodee-onboard | true | JWT_REQUIRED | ✅ | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | memberships, vps_connections, vps_ssh_keys | 212 |
| market-scanner | false | PUBLIC | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | ceo_briefs, market_gaps, research_runs | 313 |
| marketing-event | false | PUBLIC | ✅ | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY | marketing_events, memberships | 219 |
| mfa-admin-reset | true | JWT_REQUIRED | — | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | governance_admin_log, memberships, mfa_recovery_codes, profiles | 102 |
| mfa-recovery-redeem | true | JWT_REQUIRED | ✅ | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | mfa_recovery_codes | 88 |
| newsletter-confirm | false | PUBLIC | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | newsletter_subscribers | 52 |
| newsletter-subscribe | false | PUBLIC | ✅ | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEWSLETTER_EMAIL_FROM, RESEND_API_KEY | newsletter_subscribers | 153 |
| pitch-deck-pdf | true | JWT_REQUIRED | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY | gdpr_audits, profiles | 437 |
| rebuild-website | false | PUBLIC | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM, PUBLIC_SITE_URL | website_rebuild_steps, website_rebuilds | 341 |
| remediation-agent | true | JWT_REQUIRED | ✅ | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | memberships, remediation_agent_events, remediation_plans | 494 |
| sales-lead | false | PUBLIC | ✅ | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SALES_LEAD_WEBHOOK_URL | sales_leads | 113 |
| shopify-callback | false | STRIPE_WEBHOOK/RECEIVER | — | SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_APP_URL, SHOPIFY_SCOPES, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SHOPIFY_API_VERSION | shopify_scan_runs, shopify_shops, shopify_webhooks | 111 |
| shopify-install | false | PUBLIC | — | SHOPIFY_API_KEY, SHOPIFY_SCOPES, SHOPIFY_APP_URL | — | 45 |
| shopify-scan | true | JWT_REQUIRED | ✅ | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | shopify_drift_events, shopify_scan_runs, shopify_shops | 109 |
| shopify-webhooks | false | STRIPE_WEBHOOK/RECEIVER | — | SHOPIFY_WEBHOOK_SECRET, SHOPIFY_API_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | shopify_scan_runs, shopify_shops, shopify_webhooks | 61 |
| skills | true | JWT_REQUIRED | — | — | — | 163 |
| stripe-checkout | true | STRIPE | ✅ | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, PUBLIC_SITE_URL | memberships, products, subscriptions | 177 |
| stripe-meter-sync | false | STRIPE | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | metered_subscription_items, usage_limits_config, usage_meter_sync, usage_totals | 159 |
| stripe-portal | true | STRIPE | — | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | memberships, subscriptions | 104 |
| stripe-webhook | false | STRIPE | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_FROM, PUBLIC_SITE_URL | customer_onboarding, stripe_invoices, stripe_payment_events, stripe_trial_events, subscriptions, webhook_events … | 526 |
| sub-processor-notify | true | JWT_REQUIRED | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM, PUBLIC_SITE_URL | sub_processor_notifications, sub_processor_subscriptions | 211 |
| telegram-channels | true | JWT_REQUIRED | — | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | memberships, telegram_connections, tenants | 214 |
| telegram-webhook | false | STRIPE_WEBHOOK/RECEIVER | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, PUBLIC_APP_URL, APP_BASE_URL | telegram_connections | 474 |
| telemetry-ai-event | false | MONITORING | ✅ | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | ai_evidence_events, ai_policies, ai_runtime_events | 276 |
| tenant-audit | true | JWT_REQUIRED | ✅ | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY | memberships | 233 |
| tenant-invite | true | JWT_REQUIRED | ✅ | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | memberships, tenant_invites | 193 |
| tenant-members | true | JWT_REQUIRED | ✅ | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | governance_admin_log, memberships | 204 |
| track-pageview | false | MONITORING | ✅ | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | page_views | 86 |
| usage-increment | true | JWT_REQUIRED | ✅ | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | memberships | 107 |
| welcome-email | false | PUBLIC | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WELCOME_EMAIL_FROM, RESEND_API_KEY | profiles | 174 |
| workflow-callback | false | STRIPE_WEBHOOK/RECEIVER | — | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WORKFLOW_CALLBACK_SECRET | workflow_runs | 106 |
| workflow-trigger | true | JWT_REQUIRED | — | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, N8N_INTERNAL_URL, WORKFLOW_CALLBACK_SECRET | memberships, workflow_runs, workflows | 165 |

## Kategorien-Verteilung
- JWT_REQUIRED: 22
- PUBLIC: 21
- GOVERNANCE: 13
- CRON_ONLY: 8
- STRIPE_WEBHOOK/RECEIVER: 7
- STRIPE: 4
- GDPR: 3
- MONITORING: 3
- AI_ACT: 2
- AI_GATEWAY: 2
- EVIDENCE: 2

## Möglicherweise nicht im Frontend verdrahtet (manuelle Prüfung): 29
- audit-report-pdf (PUBLIC)
- ceo-brief-pdf (JWT_REQUIRED)
- checkout-website-rebuild (PUBLIC)
- cookie-scan-deep (PUBLIC)
- enterprise-ai-os-agents-list (PUBLIC)
- enterprise-ai-os-discovery-intake (PUBLIC)
- enterprise-ai-os-discovery-pending (PUBLIC)
- enterprise-ai-os-evaluate (PUBLIC)
- enterprise-ai-os-feedback (PUBLIC)
- enterprise-ai-os-founding-access (PUBLIC)
- evidence-vault-export (EVIDENCE)
- gdpr-delete (GDPR)
- gdpr-export (GDPR)
- governance-monitoring-scheduler (GOVERNANCE)
- hostinger-agent-brief (JWT_REQUIRED)
- market-scanner (PUBLIC)
- mfa-admin-reset (JWT_REQUIRED)
- newsletter-confirm (PUBLIC)
- pitch-deck-pdf (JWT_REQUIRED)
- rebuild-website (PUBLIC)
- shopify-install (PUBLIC)
- skills (JWT_REQUIRED)
- stripe-meter-sync (STRIPE)
- stripe-portal (STRIPE)
- stripe-webhook (STRIPE)
- sub-processor-notify (JWT_REQUIRED)
- telegram-channels (JWT_REQUIRED)
- welcome-email (PUBLIC)
- workflow-trigger (JWT_REQUIRED)
