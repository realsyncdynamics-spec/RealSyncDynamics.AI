-- =========================================================================
-- RealSync Dynamics AI — ai-risk-agent Goldset Schema + Seed
-- Workstream 4 (Conversation 18.05.2026).
-- Internal QA tables (no tenant_id) — service_role only RLS.
-- =========================================================================

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE ai_risk_tier AS ENUM ('minimal', 'limited', 'high', 'prohibited');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE goldset_source AS ENUM ('manual', 'eu_ai_act_annex', 'customer_case', 'synthetic');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE eval_run_status AS ENUM ('running', 'passed', 'failed', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Goldset-Tabelle
CREATE TABLE IF NOT EXISTS public.ai_risk_goldset (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label                text NOT NULL,
  input_payload        jsonb NOT NULL,
  expected_risk_tier   ai_risk_tier NOT NULL,
  expected_reasons     text[] NOT NULL DEFAULT '{}',
  source               goldset_source NOT NULL,
  source_reference     text,
  is_active            boolean NOT NULL DEFAULT true,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  reviewed_by          text,
  reviewed_at          timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ai_risk_goldset_tier ON public.ai_risk_goldset (expected_risk_tier);
CREATE INDEX IF NOT EXISTS idx_ai_risk_goldset_active ON public.ai_risk_goldset (is_active);

-- 3. Eval-Run-Tabelle
CREATE TABLE IF NOT EXISTS public.ai_risk_eval_runs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_started_at       timestamptz NOT NULL DEFAULT now(),
  run_finished_at      timestamptz,
  agent_version        text NOT NULL,
  git_sha              text,
  ci_run_url           text,
  total_cases          int NOT NULL DEFAULT 0,
  correct_cases        int NOT NULL DEFAULT 0,
  accuracy             numeric(5,4),
  f1_high              numeric(5,4),
  f1_prohibited        numeric(5,4),
  fp_rate_prohibited   numeric(5,4),
  fn_rate_high         numeric(5,4),
  confusion_matrix     jsonb,
  per_tier_metrics     jsonb,
  status               eval_run_status NOT NULL DEFAULT 'running',
  failed_reason        text
);

CREATE INDEX IF NOT EXISTS idx_eval_runs_started ON public.ai_risk_eval_runs (run_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_eval_runs_status ON public.ai_risk_eval_runs (status);

-- 4. Eval-Case-Tabelle (Detail pro Run × Goldset-Eintrag)
CREATE TABLE IF NOT EXISTS public.ai_risk_eval_cases (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id               uuid NOT NULL REFERENCES public.ai_risk_eval_runs(id) ON DELETE CASCADE,
  goldset_id           uuid NOT NULL REFERENCES public.ai_risk_goldset(id),
  expected_tier        ai_risk_tier NOT NULL,
  predicted_tier       ai_risk_tier,
  predicted_reasons    text[] DEFAULT '{}',
  is_correct           boolean NOT NULL DEFAULT false,
  latency_ms           int,
  agent_raw_output     jsonb,
  error_message        text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eval_cases_run ON public.ai_risk_eval_cases (run_id);

-- 5. RLS — Service-Role only
ALTER TABLE public.ai_risk_goldset ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_risk_eval_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_risk_eval_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_goldset" ON public.ai_risk_goldset;
CREATE POLICY "service_role_all_goldset"
  ON public.ai_risk_goldset
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_eval_runs" ON public.ai_risk_eval_runs;
CREATE POLICY "service_role_all_eval_runs"
  ON public.ai_risk_eval_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_eval_cases" ON public.ai_risk_eval_cases;
CREATE POLICY "service_role_all_eval_cases"
  ON public.ai_risk_eval_cases
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =========================================================================
-- 6. Seed: 30 Goldset-Einträge nach EU AI Act Annex III
-- Verteilung: 10 minimal | 10 limited | 8 high | 2 prohibited
-- =========================================================================

INSERT INTO public.ai_risk_goldset
  (label, input_payload, expected_risk_tier, expected_reasons, source, source_reference, notes)
VALUES

-- ===== MINIMAL RISK (10) =====
('AI Spam Filter',
 '{"system_name":"Email Spam Classifier","purpose":"Filter incoming emails","data_types":["email_content"],"automation_level":"full","human_oversight":"opt_out_available","sector":"productivity","decisions_affect_persons":false,"deployment":"internal"}'::jsonb,
 'minimal', ARRAY['no_personal_decisions','user_can_disable','non_sensitive_data'],
 'eu_ai_act_annex', 'EU AI Act Art. 5 / Recital 53', 'Klassisches Beispiel minimal risk'),

('Game NPC Dialogue AI',
 '{"system_name":"In-Game Character Dialogue","purpose":"Generate NPC responses in single-player game","data_types":["game_state"],"automation_level":"full","human_oversight":"none","sector":"entertainment","decisions_affect_persons":false}'::jsonb,
 'minimal', ARRAY['entertainment_only','no_real_world_impact'],
 'eu_ai_act_annex', 'EU AI Act Recital 53', NULL),

('Inventory Demand Forecast',
 '{"system_name":"Warehouse Stock Predictor","purpose":"Predict restocking needs","data_types":["sales_history","seasonality"],"automation_level":"recommendation","human_oversight":"manager_approves","sector":"logistics","decisions_affect_persons":false}'::jsonb,
 'minimal', ARRAY['business_optimization','no_persons_affected','human_in_loop'],
 'eu_ai_act_annex', NULL, NULL),

('AI Photo Auto-Enhancement',
 '{"system_name":"Phone Camera Auto-Enhance","purpose":"Improve photo quality","data_types":["image"],"automation_level":"full","human_oversight":"user_disables_easily","sector":"consumer","decisions_affect_persons":false}'::jsonb,
 'minimal', ARRAY['consumer_convenience','no_decisions'],
 'eu_ai_act_annex', NULL, NULL),

('Grammar Correction Tool',
 '{"system_name":"Grammar Suggestion Engine","purpose":"Suggest writing corrections","data_types":["text"],"automation_level":"suggestion","human_oversight":"user_accepts_each","sector":"productivity","decisions_affect_persons":false}'::jsonb,
 'minimal', ARRAY['suggestion_only','user_controls_final'],
 'eu_ai_act_annex', NULL, NULL),

('Music Recommendation Engine',
 '{"system_name":"Playlist Generator","purpose":"Suggest songs based on listening history","data_types":["listening_history"],"automation_level":"recommendation","human_oversight":"user_can_skip","sector":"entertainment","decisions_affect_persons":false}'::jsonb,
 'minimal', ARRAY['entertainment_recommendation','reversible'],
 'eu_ai_act_annex', NULL, NULL),

('Customer Service FAQ Bot',
 '{"system_name":"FAQ Routing Chatbot","purpose":"Direct customers to relevant FAQ articles","data_types":["chat_input"],"automation_level":"recommendation","human_oversight":"human_escalation_available","sector":"customer_service","decisions_affect_persons":false}'::jsonb,
 'minimal', ARRAY['information_routing','no_decisions','human_fallback'],
 'eu_ai_act_annex', NULL, NULL),

('AI Translation in Browser',
 '{"system_name":"Webpage Translator","purpose":"Translate displayed pages","data_types":["public_web_content"],"automation_level":"full","human_oversight":"user_disables","sector":"productivity","decisions_affect_persons":false}'::jsonb,
 'minimal', ARRAY['no_personal_data','user_controlled'],
 'eu_ai_act_annex', NULL, NULL),

('Smart Thermostat Control',
 '{"system_name":"Home Climate AI","purpose":"Optimize heating schedule","data_types":["temperature_history","schedule"],"automation_level":"full","human_oversight":"manual_override","sector":"iot","decisions_affect_persons":false}'::jsonb,
 'minimal', ARRAY['comfort_optimization','manual_override_available'],
 'eu_ai_act_annex', NULL, NULL),

('Calendar Meeting Time Suggester',
 '{"system_name":"Meeting Time AI","purpose":"Suggest meeting slots","data_types":["calendar_availability"],"automation_level":"recommendation","human_oversight":"user_approves","sector":"productivity","decisions_affect_persons":false}'::jsonb,
 'minimal', ARRAY['scheduling_aid','user_approves_final'],
 'eu_ai_act_annex', NULL, NULL),

-- ===== LIMITED RISK (10) — Transparenzpflicht Art. 50 =====
('Customer Chatbot Sales Tier',
 '{"system_name":"Sales Chatbot","purpose":"Interact with website visitors","data_types":["chat_input","cookies"],"automation_level":"full","human_oversight":"handoff_on_request","sector":"sales","decisions_affect_persons":false,"interacts_with_humans":true,"discloses_ai_nature":false}'::jsonb,
 'limited', ARRAY['art_50_transparency','undisclosed_ai_interaction','must_inform_user'],
 'eu_ai_act_annex', 'EU AI Act Art. 50(1)', 'Muss als KI offengelegt werden'),

('Deepfake Video Generator',
 '{"system_name":"Synthetic Video Tool","purpose":"Generate marketing videos with synthetic actors","data_types":["face_likeness","voice"],"automation_level":"full","human_oversight":"creator_reviews","sector":"marketing","decisions_affect_persons":false,"generates_synthetic_content":true}'::jsonb,
 'limited', ARRAY['art_50_4_synthetic_disclosure','must_label_as_ai_generated'],
 'eu_ai_act_annex', 'EU AI Act Art. 50(4)', 'Synthetic Content Labeling Pflicht'),

('Emotion Recognition — Marketing Research (Consent)',
 '{"system_name":"Focus Group Emotion Tracker","purpose":"Analyze emotional reactions in opt-in market research","data_types":["facial_expression","voice_tone"],"automation_level":"full","human_oversight":"researcher_reviews","sector":"market_research","decisions_affect_persons":false,"participants_consented":true,"context":"non_workplace_non_education"}'::jsonb,
 'limited', ARRAY['biometric_emotion_outside_prohibited_contexts','transparency_required'],
 'eu_ai_act_annex', 'EU AI Act Art. 50(3)', 'Außerhalb Arbeitsplatz/Bildung mit Einwilligung'),

('AI-Generated News Article Tool',
 '{"system_name":"AutoNews Writer","purpose":"Generate news drafts for editor review","data_types":["news_topic","public_data"],"automation_level":"full","human_oversight":"editor_reviews","sector":"media","decisions_affect_persons":false,"public_facing":true,"discloses_ai_authorship":false}'::jsonb,
 'limited', ARRAY['art_50_4_public_interest_text','must_disclose_ai_authorship'],
 'eu_ai_act_annex', 'EU AI Act Art. 50(4)', 'Public-interest Texte müssen als KI gekennzeichnet werden'),

('Virtual Try-On AR Filter',
 '{"system_name":"AR Beauty Try-On","purpose":"Show makeup virtually on user face","data_types":["face_image"],"automation_level":"full","human_oversight":"user_controls","sector":"retail","decisions_affect_persons":false,"biometric_processing":true,"discloses_ai_nature":true}'::jsonb,
 'limited', ARRAY['biometric_visualization','transparency_obligation'],
 'eu_ai_act_annex', 'EU AI Act Art. 50', NULL),

('AI Voice Cloning for Audiobooks',
 '{"system_name":"Voice Clone Narrator","purpose":"Generate audiobook narration from licensed voice","data_types":["voice_samples"],"automation_level":"full","human_oversight":"producer_reviews","sector":"media","decisions_affect_persons":false,"synthetic_audio":true,"voice_owner_consented":true}'::jsonb,
 'limited', ARRAY['art_50_4_synthetic_audio','disclosure_required','consent_obtained'],
 'eu_ai_act_annex', 'EU AI Act Art. 50(4)', NULL),

('Chatbot for Mental Health Self-Help (Non-Diagnostic)',
 '{"system_name":"Wellness Chatbot","purpose":"Provide CBT-style journaling prompts","data_types":["user_input"],"automation_level":"full","human_oversight":"escalation_to_helpline","sector":"wellness","decisions_affect_persons":false,"medical_diagnosis":false,"interacts_with_humans":true}'::jsonb,
 'limited', ARRAY['ai_disclosure_required','non_medical_wellness','helpline_escalation'],
 'eu_ai_act_annex', 'EU AI Act Art. 50(1)', 'Nicht-medizinisch, aber AI-Disclosure Pflicht'),

('AI-Generated Product Description Tool',
 '{"system_name":"E-Commerce Copy Generator","purpose":"Generate product descriptions for catalog","data_types":["product_specs"],"automation_level":"full","human_oversight":"merchandiser_reviews","sector":"ecommerce","decisions_affect_persons":false,"public_facing":true}'::jsonb,
 'limited', ARRAY['synthetic_text_public','disclosure_if_unedited'],
 'eu_ai_act_annex', 'EU AI Act Art. 50(4)', 'Borderline minimal/limited je nach Public-Interest-Charakter'),

('Customer Service Voice Bot',
 '{"system_name":"Call Center IVR with NLP","purpose":"Route incoming calls","data_types":["voice","conversation"],"automation_level":"full","human_oversight":"human_handoff","sector":"customer_service","decisions_affect_persons":false,"interacts_with_humans":true,"discloses_ai_nature":true}'::jsonb,
 'limited', ARRAY['art_50_1_disclosed','human_handoff_available'],
 'eu_ai_act_annex', 'EU AI Act Art. 50(1)', NULL),

('AI Image Filter — Public Social Post',
 '{"system_name":"Style Transfer Filter","purpose":"Apply artistic style to user photos for posting","data_types":["user_photo"],"automation_level":"full","human_oversight":"user_chooses","sector":"social","decisions_affect_persons":false,"generates_synthetic_content":true,"public_distribution":true}'::jsonb,
 'limited', ARRAY['art_50_4_image_synthesis','disclosure_for_public_distribution'],
 'eu_ai_act_annex', 'EU AI Act Art. 50(4)', NULL),

-- ===== HIGH RISK (8) — Annex III =====
('CV Screening for Hiring',
 '{"system_name":"Recruitment AI Screener","purpose":"Rank CVs for shortlisting","data_types":["cv_text","candidate_demographics"],"automation_level":"recommendation","human_oversight":"recruiter_reviews_top","sector":"hr","decisions_affect_persons":true,"context":"employment_access"}'::jsonb,
 'high', ARRAY['annex_iii_4a_employment','affects_access_to_employment','requires_conformity_assessment'],
 'eu_ai_act_annex', 'EU AI Act Annex III(4)(a)', 'Klassischer high-risk-Fall'),

('Credit Scoring for Personal Loans',
 '{"system_name":"Consumer Credit Scorer","purpose":"Assess creditworthiness of loan applicants","data_types":["income","credit_history","employment"],"automation_level":"decision","human_oversight":"override_possible","sector":"finance","decisions_affect_persons":true,"context":"essential_service_access"}'::jsonb,
 'high', ARRAY['annex_iii_5b_creditworthiness','essential_private_service','fundamental_rights_impact'],
 'eu_ai_act_annex', 'EU AI Act Annex III(5)(b)', NULL),

('Exam Grading System for University',
 '{"system_name":"Automated Essay Grader","purpose":"Grade student essays in higher education","data_types":["essay_text","student_id"],"automation_level":"decision","human_oversight":"professor_can_override","sector":"education","decisions_affect_persons":true,"context":"education_assessment"}'::jsonb,
 'high', ARRAY['annex_iii_3b_education_evaluation','determines_access_to_education','fundamental_rights'],
 'eu_ai_act_annex', 'EU AI Act Annex III(3)(b)', NULL),

('Predictive Policing Hotspot Analysis',
 '{"system_name":"Crime Hotspot Predictor","purpose":"Predict areas of likely criminal activity","data_types":["historical_crime","demographics"],"automation_level":"recommendation","human_oversight":"officer_reviews","sector":"law_enforcement","decisions_affect_persons":true,"context":"public_authority"}'::jsonb,
 'high', ARRAY['annex_iii_6_law_enforcement','profiling_concerns','requires_dpia'],
 'eu_ai_act_annex', 'EU AI Act Annex III(6)', NULL),

('Asylum Application Risk Assessment',
 '{"system_name":"Migration Risk Tool","purpose":"Assist in processing asylum applications","data_types":["application_data","country_of_origin"],"automation_level":"recommendation","human_oversight":"caseworker_decides","sector":"migration","decisions_affect_persons":true,"context":"migration_asylum"}'::jsonb,
 'high', ARRAY['annex_iii_7_migration_asylum','vulnerable_population','fundamental_rights'],
 'eu_ai_act_annex', 'EU AI Act Annex III(7)', NULL),

('Insurance Premium Calculation — Life/Health',
 '{"system_name":"Life Insurance Pricing AI","purpose":"Determine life insurance premiums","data_types":["health_data","age","lifestyle"],"automation_level":"decision","human_oversight":"underwriter_reviews","sector":"insurance","decisions_affect_persons":true,"context":"life_health_insurance"}'::jsonb,
 'high', ARRAY['annex_iii_5c_life_health_insurance','price_discrimination_risk','essential_service'],
 'eu_ai_act_annex', 'EU AI Act Annex III(5)(c)', NULL),

('Worker Performance Monitoring AI',
 '{"system_name":"Productivity Tracking AI","purpose":"Evaluate worker performance for promotion/termination","data_types":["keystrokes","screen_activity","output_metrics"],"automation_level":"decision","human_oversight":"hr_reviews","sector":"hr","decisions_affect_persons":true,"context":"workplace_evaluation"}'::jsonb,
 'high', ARRAY['annex_iii_4b_workplace_evaluation','employment_decisions','worker_rights'],
 'eu_ai_act_annex', 'EU AI Act Annex III(4)(b)', NULL),

('Biometric Identification — Border Control',
 '{"system_name":"Border Face Match System","purpose":"Match travelers to passport biometrics at border","data_types":["face_image","passport_data"],"automation_level":"decision","human_oversight":"officer_confirms","sector":"border_control","decisions_affect_persons":true,"context":"post_remote_biometric_id"}'::jsonb,
 'high', ARRAY['annex_iii_1a_biometric_id','post_identification','requires_strict_safeguards'],
 'eu_ai_act_annex', 'EU AI Act Annex III(1)(a)', NULL),

-- ===== PROHIBITED (2) — Art. 5 =====
('Real-time Public Space Face Recognition (No Exception)',
 '{"system_name":"Live CCTV Face ID","purpose":"Real-time identify all faces in public squares for general surveillance","data_types":["live_video_feed","face_biometrics"],"automation_level":"full","human_oversight":"none","sector":"surveillance","decisions_affect_persons":true,"context":"real_time_remote_biometric_id_public","law_enforcement_exception_applies":false}'::jsonb,
 'prohibited', ARRAY['art_5_1_h_real_time_rbi','no_law_enforcement_exception','mass_surveillance'],
 'eu_ai_act_annex', 'EU AI Act Art. 5(1)(h)', 'Verboten ohne enge Ausnahmen'),

('Social Scoring System for Citizens',
 '{"system_name":"Citizen Behavior Scorer","purpose":"Assign social scores leading to detrimental treatment in unrelated contexts","data_types":["behavioral_data","social_network","purchase_history"],"automation_level":"decision","human_oversight":"none","sector":"government","decisions_affect_persons":true,"context":"general_social_scoring","leads_to_detrimental_treatment":true}'::jsonb,
 'prohibited', ARRAY['art_5_1_c_social_scoring','detrimental_unrelated_context','disproportionate_treatment'],
 'eu_ai_act_annex', 'EU AI Act Art. 5(1)(c)', 'Verbotenes Social Scoring nach AI Act');

-- =========================================================================
-- 7. Verifikation
-- =========================================================================
DO $$
DECLARE
  v_total int;
  v_minimal int;
  v_limited int;
  v_high int;
  v_prohibited int;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.ai_risk_goldset WHERE is_active = true;
  SELECT COUNT(*) INTO v_minimal FROM public.ai_risk_goldset WHERE expected_risk_tier = 'minimal' AND is_active;
  SELECT COUNT(*) INTO v_limited FROM public.ai_risk_goldset WHERE expected_risk_tier = 'limited' AND is_active;
  SELECT COUNT(*) INTO v_high FROM public.ai_risk_goldset WHERE expected_risk_tier = 'high' AND is_active;
  SELECT COUNT(*) INTO v_prohibited FROM public.ai_risk_goldset WHERE expected_risk_tier = 'prohibited' AND is_active;

  RAISE NOTICE 'Goldset gesamt: %, minimal: %, limited: %, high: %, prohibited: %',
    v_total, v_minimal, v_limited, v_high, v_prohibited;

  IF v_total < 30 THEN
    RAISE EXCEPTION 'Goldset hat % Einträge, erwartet >= 30', v_total;
  END IF;
END $$;
