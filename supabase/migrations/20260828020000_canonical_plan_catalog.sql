-- ═══════════════════════════════════════════════════════════════════════════
--  Kanonischer Plan-Katalog — Neuausgabe: Scans sind unbegrenzt kostenlos
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Ersetzt die Katalog-Daten aus 20260808140000_canonical_plan_catalog.sql.
-- Migrationen sind unveränderlich, sobald sie deployt sind — eine Änderung an
-- der Pricing-SSoT erfordert deshalb eine NEUE Katalog-Migration statt einer
-- Bearbeitung der alten. Tabellen-, RLS- und Index-Definitionen stehen
-- weiterhin in 20260802001000 und werden hier nicht wiederholt; dieser Lauf
-- schreibt ausschließlich Katalog-Daten.
--
-- Neu gegenüber 20260808140000 — Entscheidung des Eigentümers vom 2026-08-24:
--
--   „Mache die Scans immer kostenlos, wir verkaufen was anderes — nämlich die
--    dauerhafte Überwachung, die dann im Dashboard nach dem Buchen des ersten
--    Pakets beginnt. Der Rest passiert im Dashboard."
--
--   Der Scan ist damit die Eintrittskarte, nicht die Ware. Konkret:
--     - `free_audit.technicalSubheadline`: „Einmaliger Runtime-Scan …" →
--       „Unbegrenzte Runtime-Scans …"
--     - das Kontingent selbst steht nicht im Katalog, sondern als
--       Berechtigung `website.scan_monthly_limit = -1` in
--       20260828000000_entitlement_base_keys_paid_plans
--
--   `limits.auditReportsPerMonth` bleibt unverändert (1/2/12/50/200/500). Das
--   Feld meint **Compliance-Exporte**, nicht Scans — es speist
--   `complianceExportsMonthly` in src/core/billing/entitlements.ts. Ein
--   früherer Entwurf hatte die beiden verwechselt und dieses Feld als
--   Scan-Kontingent behandelt.
--
-- Der Block unten wird von `scripts/generate-plan-catalog-sql.ts` erzeugt und
-- von `test/config/pricing-ssot.test.ts` gegen shared/pricing.ts geprüft.
-- NICHT von Hand bearbeiten — stattdessen `npm run gen:plan-catalog`.
-- >>> GENERATED PLAN CATALOG (scripts/generate-plan-catalog-sql.ts) >>>
-- NICHT VON HAND BEARBEITEN. Quelle: shared/pricing.ts

INSERT INTO public.plan_catalog (
  plan_key, plan_id, name, outcome_headline, technical_subheadline,
  price_monthly_eur, price_yearly_eur, price_one_time_eur, currency, purchase_mode, trial_days,
  recurring, max_bots, max_answers_per_month,
  limits, modules, permissions, channels, addons, features, support
) VALUES
  (
    'free_audit',
    'free',
    'Free Audit',
    'Sehen Sie in 90 Sekunden, wo Ihre Governance-Lücken liegen.',
    'Unbegrenzte Runtime-Scans Ihrer Domain mit Governance Score, Top-Risiken und Planempfehlung.',
    0,
    NULL,
    NULL,
    'EUR',
    'free',
    0,
    false,
    0,
    0,
    '{"bots":0,"answersPerMonth":0,"domains":1,"automationRunsPerMonth":0,"seats":1,"apiCallsPerMonth":0,"tenants":1,"evidenceStorageGb":0.5,"auditReportsPerMonth":1,"remediationPlans":0,"bulkJobsPerMonth":0,"apiKeys":0}'::jsonb,
    '["dsgvo","audit_center","compliance_reports"]'::jsonb,
    '{"scheduler":false,"api":false,"webhooks":false,"whiteLabelReports":false,"whiteLabelDashboard":false,"multiTenant":false,"evidenceVault":false,"auditExport":false,"sso":false,"bulkOperations":false,"provenanceSigning":false,"prioritySupport":false}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '{"audit_evidence":["Runtime-Scan einer Domain mit Governance Score 0–100","Top-3-Risiken mit Paragraphenbezug","Kompakter PDF-Bericht","Prüfpfad einsehbar (kein Export)"],"ai_governance":["DSGVO-Basisprüfung","Automatische Planempfehlung auf Basis des Scores"],"automation_ops":["Kein Account, kein Setup erforderlich"],"multi_tenant_reseller":[]}'::jsonb,
    'community'
  ),
  (
    'starter',
    'starter',
    'Starter',
    'Ein nachweisbares Governance-Fundament, das jeden Prüfer überzeugt.',
    'Kontinuierlicher DSGVO- und AI-Act-Scan mit lückenloser Hash-Chain und exportierbarem Prüfpfad.',
    79,
    790,
    NULL,
    'EUR',
    'checkout',
    14,
    true,
    1,
    500,
    '{"bots":1,"answersPerMonth":500,"domains":1,"automationRunsPerMonth":25,"seats":1,"apiCallsPerMonth":0,"tenants":1,"evidenceStorageGb":2,"auditReportsPerMonth":2,"remediationPlans":5,"bulkJobsPerMonth":0,"apiKeys":0}'::jsonb,
    '["dsgvo","eu_ai_act","evidence_vault","audit_center","monitoring","compliance_reports","automation_engine","alerts","ai_bots","website_chat"]'::jsonb,
    '{"scheduler":false,"api":false,"webhooks":false,"whiteLabelReports":false,"whiteLabelDashboard":false,"multiTenant":false,"evidenceVault":true,"auditExport":true,"sso":false,"bulkOperations":false,"provenanceSigning":false,"prioritySupport":false}'::jsonb,
    '["website"]'::jsonb,
    '[]'::jsonb,
    '{"audit_evidence":["Vollständiger DSGVO-Scan mit Paragraphenbezug","Evidence Vault mit Hash-Chain-Verifizierung","Audit-Export als PDF und JSON","Lückenloser Prüfpfad über alle Läufe"],"ai_governance":["Policy Packs: DSGVO und EU AI Act","Generator für Datenschutzerklärung","Technische Consent-Empfehlungen"],"automation_ops":["Kontinuierliches Monitoring","E-Mail-Alert bei neuen Findings","25 Automationsläufe pro Monat","1 Governance-Bot mit 500 Antworten (Website)"],"multi_tenant_reseller":[]}'::jsonb,
    'email'
  ),
  (
    'growth',
    'growth',
    'Growth',
    'KI-Governance, die sich selbst überwacht — statt einmal im Jahr geprüft zu werden.',
    'Tägliche Runtime-Läufe mit Drift Detection, Risk Register und Policy Engine über drei Rahmenwerke.',
    249,
    2490,
    NULL,
    'EUR',
    'checkout',
    14,
    true,
    2,
    2000,
    '{"bots":2,"answersPerMonth":2000,"domains":3,"automationRunsPerMonth":100,"seats":5,"apiCallsPerMonth":0,"tenants":1,"evidenceStorageGb":10,"auditReportsPerMonth":12,"remediationPlans":20,"bulkJobsPerMonth":0,"apiKeys":0}'::jsonb,
    '["dsgvo","eu_ai_act","iso_27001","policy_engine","evidence_vault","audit_center","risk_register","monitoring","compliance_reports","automation_engine","alerts","workflows","drift_detection","remediation","background_jobs","ai_bots","website_chat","whatsapp","telegram","multi_channel_messaging"]'::jsonb,
    '{"scheduler":false,"api":false,"webhooks":false,"whiteLabelReports":false,"whiteLabelDashboard":false,"multiTenant":false,"evidenceVault":true,"auditExport":true,"sso":false,"bulkOperations":false,"provenanceSigning":false,"prioritySupport":false}'::jsonb,
    '["website","whatsapp","telegram"]'::jsonb,
    '["response_pack","whatsapp","compliance_pack"]'::jsonb,
    '{"audit_evidence":["Alles aus Starter","Evidence Vault mit Versionierung","Bis zu 12 Audit-Berichte pro Monat","Consent-Timing-Analyse (Requests vor Einwilligung)"],"ai_governance":["Policy Packs: DSGVO, EU AI Act, ISO 27001","Policy Engine mit versionierten Richtlinien","AI Risk Register mit Bewertung und Eigentümern","Governance Score je Rahmenwerk"],"automation_ops":["Tägliches Monitoring mit Drift Detection","Behebungsvorschläge mit Code-Snippets","100 Automationsläufe pro Monat","2 Governance-Bots mit 2.000 Antworten (Website, WhatsApp, Telegram)"],"multi_tenant_reseller":[]}'::jsonb,
    'priority'
  ),
  (
    'agency',
    'agency',
    'Agency',
    'Governance für viele Kunden gleichzeitig — automatisiert und mit Ihrem Logo.',
    'Scheduler, Bulk Jobs und REST-API über fünf Rahmenwerke, mit White-Label-Berichten und signiertem Herkunftsnachweis.',
    699,
    6900,
    NULL,
    'EUR',
    'checkout',
    14,
    true,
    10,
    25000,
    '{"bots":10,"answersPerMonth":25000,"domains":10,"automationRunsPerMonth":500,"seats":15,"apiCallsPerMonth":50000,"tenants":1,"evidenceStorageGb":50,"auditReportsPerMonth":50,"remediationPlans":100,"bulkJobsPerMonth":100,"apiKeys":10}'::jsonb,
    '["dsgvo","eu_ai_act","iso_27001","nis2","tisax","policy_engine","evidence_vault","audit_center","risk_register","monitoring","compliance_reports","automation_engine","alerts","workflows","drift_detection","remediation","background_jobs","scheduler","n8n","kodee","bulk_jobs","ai_bots","website_chat","whatsapp","telegram","voice","multi_channel_messaging","api","webhooks","human_handoff"]'::jsonb,
    '{"scheduler":true,"api":true,"webhooks":true,"whiteLabelReports":true,"whiteLabelDashboard":false,"multiTenant":false,"evidenceVault":true,"auditExport":true,"sso":false,"bulkOperations":true,"provenanceSigning":true,"prioritySupport":true}'::jsonb,
    '["website","whatsapp","telegram","slack","teams","email","voice"]'::jsonb,
    '["response_pack","whatsapp","voice","compliance_pack","agency_bot_pack","white_label"]'::jsonb,
    '{"audit_evidence":["Alles aus Growth","Evidence Vault Advanced: unveränderliche Snapshots, Retention, Legal Hold","Herkunftsnachweis mit Ed25519-Signatur und Chain-of-Custody","White-Label-Berichte mit eigenem Logo"],"ai_governance":["Policy Packs: DSGVO, EU AI Act, ISO 27001, NIS2, TISAX","Branchenbibliothek vorkonfigurierter Governance-Profile","Governance Agents für Prüfungen und Maßnahmen (Review-pflichtig)"],"automation_ops":["Scheduler für geplante Läufe mit Slack-/Teams-/Webhook-Alerts","Bulk Jobs: Massen-Scan vieler Domains per CSV","n8n-Anbindung und Kodee Server-Assistent","REST-API und Webhooks für CI/CD","500 Automationsläufe pro Monat","10 Governance-Bots mit 25.000 Antworten (alle Kanäle inkl. Voice)"],"multi_tenant_reseller":["White-Label-Berichte mit eigenem Branding","Bis zu 10 Domains unter einem Konto"]}'::jsonb,
    'priority'
  ),
  (
    'enterprise',
    'enterprise',
    'Enterprise',
    'Konzernweite Governance über alle sechs Rahmenwerke — mit SLA und SSO.',
    'Multi-Tenant-Runtime für bis zu 5 Organisationen, zentrale Rechteverwaltung und unbegrenzte geplante Läufe.',
    1249,
    12490,
    NULL,
    'EUR',
    'checkout',
    14,
    true,
    20,
    50000,
    '{"bots":20,"answersPerMonth":50000,"domains":25,"automationRunsPerMonth":2000,"seats":50,"apiCallsPerMonth":250000,"tenants":5,"evidenceStorageGb":200,"auditReportsPerMonth":200,"remediationPlans":500,"bulkJobsPerMonth":500,"apiKeys":50}'::jsonb,
    '["dsgvo","eu_ai_act","iso_27001","nis2","tisax","dora","policy_engine","evidence_vault","audit_center","risk_register","monitoring","compliance_reports","automation_engine","alerts","workflows","drift_detection","remediation","background_jobs","scheduler","n8n","kodee","bulk_jobs","ai_bots","website_chat","whatsapp","telegram","voice","multi_channel_messaging","api","webhooks","human_handoff"]'::jsonb,
    '{"scheduler":true,"api":true,"webhooks":true,"whiteLabelReports":true,"whiteLabelDashboard":true,"multiTenant":true,"evidenceVault":true,"auditExport":true,"sso":true,"bulkOperations":true,"provenanceSigning":true,"prioritySupport":true}'::jsonb,
    '["website","whatsapp","telegram","slack","teams","email","voice"]'::jsonb,
    '["response_pack","whatsapp","voice","compliance_pack","agency_bot_pack","white_label"]'::jsonb,
    '{"audit_evidence":["Alles aus Agency","Audit Center Pro mit 200 Berichten pro Monat","Evidence Vault Enterprise mit 200 GB Nachweisspeicher"],"ai_governance":["Alle sechs Policy Packs: DSGVO, EU AI Act, ISO 27001, NIS2, TISAX, DORA","Erweiterte Analysen und Risk Scoring","Eigene Richtlinien und Kontrollkataloge"],"automation_ops":["Unbegrenzter Scheduler für geplante Läufe","2.000 Automationsläufe pro Monat","API Premium mit 250.000 Aufrufen pro Monat","20 Governance-Bots mit 50.000 Antworten (alle Kanäle)","Priorisierter Support mit 4 h Reaktionszeit"],"multi_tenant_reseller":["Multi-Tenant-Dashboard für bis zu 5 Organisationen","Zentrale Benutzerverwaltung mit Rollen und Rechten","Single Sign-On","White-Label mit Branding, Logo und Farben"]}'::jsonb,
    'dedicated'
  ),
  (
    'partner',
    'partner',
    'Partner',
    'Verkaufen Sie Governance als eigenes Produkt — bis zu 50 Mandanten unter Ihrer Marke.',
    'Vollständig mandantengetrennte Runtime mit White-Label-Subdomain, eigenem Branding und voller API.',
    1999,
    19000,
    NULL,
    'EUR',
    'inquiry',
    0,
    true,
    50,
    100000,
    '{"bots":50,"answersPerMonth":100000,"domains":100,"automationRunsPerMonth":10000,"seats":100,"apiCallsPerMonth":1000000,"tenants":50,"evidenceStorageGb":500,"auditReportsPerMonth":500,"remediationPlans":-1,"bulkJobsPerMonth":-1,"apiKeys":-1}'::jsonb,
    '["dsgvo","eu_ai_act","iso_27001","nis2","tisax","dora","policy_engine","evidence_vault","audit_center","risk_register","monitoring","compliance_reports","automation_engine","alerts","workflows","drift_detection","remediation","background_jobs","scheduler","n8n","kodee","bulk_jobs","ai_bots","website_chat","whatsapp","telegram","voice","multi_channel_messaging","api","webhooks","human_handoff"]'::jsonb,
    '{"scheduler":true,"api":true,"webhooks":true,"whiteLabelReports":true,"whiteLabelDashboard":true,"multiTenant":true,"evidenceVault":true,"auditExport":true,"sso":true,"bulkOperations":true,"provenanceSigning":true,"prioritySupport":true}'::jsonb,
    '["website","whatsapp","telegram","slack","teams","email","voice"]'::jsonb,
    '["response_pack","whatsapp","voice","compliance_pack","agency_bot_pack","white_label"]'::jsonb,
    '{"audit_evidence":["Alles aus Enterprise","500 GB Nachweisspeicher, 500 Audit-Berichte pro Monat","Unbegrenzte Behebungspläne und Bulk Jobs"],"ai_governance":["Alle sechs Policy Packs je Mandant getrennt aktivierbar","Mandantenspezifische Richtlinien und Kontrollkataloge"],"automation_ops":["10.000 Automationsläufe pro Monat","Voller API-Zugriff mit 1 Mio. Aufrufen pro Monat","50 Governance-Bots mit 100.000 Antworten, mandantengetrennt","SLA 4 h auf Fehlermeldungen mit festem Ansprechpartner"],"multi_tenant_reseller":["Multi-Tenant-Dashboard für bis zu 50 Mandanten","White-Label-Subdomain je Mandant","Vollständiges Branding: Logos, Farben, Texte","Mandanten-Isolation mit Unterkonten","Unbegrenzte API-Schlüssel"]}'::jsonb,
    'dedicated'
  ),
  (
    'governance_launch',
    'governance_launch',
    'Governance Launch',
    'Einmalige Governance-Implementierung für Ihren ersten Anwendungsfall.',
    'Einmalige Einrichtung: Rahmenwerk-Konfiguration, Evidence Vault und Audit Center für eine Domain.',
    0,
    NULL,
    349,
    'EUR',
    'one_time',
    0,
    false,
    1,
    1000,
    '{"bots":1,"answersPerMonth":1000,"domains":1,"automationRunsPerMonth":10,"seats":3,"apiCallsPerMonth":0,"tenants":1,"evidenceStorageGb":5,"auditReportsPerMonth":5,"remediationPlans":0,"bulkJobsPerMonth":0,"apiKeys":0}'::jsonb,
    '["dsgvo","policy_engine","evidence_vault","audit_center","compliance_reports"]'::jsonb,
    '{"scheduler":false,"api":false,"webhooks":false,"whiteLabelReports":false,"whiteLabelDashboard":false,"multiTenant":false,"evidenceVault":true,"auditExport":true,"sso":false,"bulkOperations":false,"provenanceSigning":false,"prioritySupport":false}'::jsonb,
    '["website"]'::jsonb,
    '[]'::jsonb,
    '{"audit_evidence":["Evidence Vault mit 5 GB Nachweisspeicher","Audit Center mit vollständigem Prüfpfad","Fünf Audit-Berichte inklusive"],"ai_governance":["Policy Pack DSGVO eingerichtet und aktiv","Policy Engine für eigene Richtlinien","Compliance Reports als PDF und JSON"],"automation_ops":["Zehn Automationsläufe für die Einrichtung","Ein Governance-Bot für die Website"],"multi_tenant_reseller":[]}'::jsonb,
    'email'
  )
ON CONFLICT (plan_key) DO UPDATE SET
  plan_id = EXCLUDED.plan_id,
  name = EXCLUDED.name,
  outcome_headline = EXCLUDED.outcome_headline,
  technical_subheadline = EXCLUDED.technical_subheadline,
  price_monthly_eur = EXCLUDED.price_monthly_eur,
  price_yearly_eur = EXCLUDED.price_yearly_eur,
  price_one_time_eur = EXCLUDED.price_one_time_eur,
  currency = EXCLUDED.currency,
  purchase_mode = EXCLUDED.purchase_mode,
  trial_days = EXCLUDED.trial_days,
  recurring = EXCLUDED.recurring,
  max_bots = EXCLUDED.max_bots,
  max_answers_per_month = EXCLUDED.max_answers_per_month,
  limits = EXCLUDED.limits,
  modules = EXCLUDED.modules,
  permissions = EXCLUDED.permissions,
  channels = EXCLUDED.channels,
  addons = EXCLUDED.addons,
  features = EXCLUDED.features,
  support = EXCLUDED.support,
  updated_at = now();

INSERT INTO public.plan_addons (addon_id, name, description, price_eur, price_note, interval, available_for) VALUES
  (
    'response_pack',
    'Response Pack',
    'Zusätzliche 5.000 Bot-Antworten pro Monat.',
    49,
    '/ Monat',
    'month',
    '["growth","agency","enterprise","partner"]'::jsonb
  ),
  (
    'whatsapp',
    'WhatsApp',
    'WhatsApp-Business-Kanal für Ihre Governance-Bots.',
    99,
    '/ Monat',
    'month',
    '["growth","agency","enterprise","partner"]'::jsonb
  ),
  (
    'voice',
    'Voice',
    'Sprachkanal über Telefonie mit IVR.',
    150,
    '/ Monat zzgl. 0,25 € pro Minute',
    'month',
    '["agency","enterprise","partner"]'::jsonb
  ),
  (
    'compliance_pack',
    'Compliance Pack',
    'Erweitertes Logging, Audit-Export und Review-Workflows.',
    149,
    '/ Monat',
    'month',
    '["growth","agency","enterprise","partner"]'::jsonb
  ),
  (
    'agency_bot_pack',
    'Agency Bot Pack',
    'Fünf zusätzliche Governance-Bots für Kundenprojekte.',
    199,
    '/ Monat',
    'month',
    '["agency","enterprise","partner"]'::jsonb
  ),
  (
    'white_label',
    'White Label',
    'Vollständiges Branding mit eigener Domain.',
    299,
    '/ Monat',
    'month',
    '["agency","enterprise","partner"]'::jsonb
  )
ON CONFLICT (addon_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_eur = EXCLUDED.price_eur,
  price_note = EXCLUDED.price_note,
  interval = EXCLUDED.interval,
  available_for = EXCLUDED.available_for,
  updated_at = now();

UPDATE public.plan_catalog SET active = false, updated_at = now()
  WHERE plan_key NOT IN ('free_audit', 'starter', 'starter_yearly', 'growth', 'growth_yearly', 'agency', 'agency_yearly', 'enterprise', 'enterprise_yearly', 'partner', 'partner_yearly', 'governance_launch');
-- <<< GENERATED PLAN CATALOG <<<
