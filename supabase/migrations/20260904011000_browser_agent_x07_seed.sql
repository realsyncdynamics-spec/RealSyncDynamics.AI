-- ═══════════════════════════════════════════════════════════════════════════
--  Browser Agent X07 — Platform-Scope-Organisation als Saat
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Modell: Artifact „Organisationsmodell …" v0.2, §01 und §02.
-- Entscheid: ADR 0011 D4 (Reihenfolge, Platform Scope).
--
-- ── Warum diese Migration überhaupt existiert ──────────────────────────────
--
-- `agent_tickets.source_agent_id` ist NOT NULL mit ON DELETE RESTRICT: Ein
-- Befund ohne Melder hat keine Herkunft. Die Edge Function `browser-agent-x07`
-- kann also ohne diese Zeilen kein einziges Ticket schreiben — sie meldet dann
-- ehrlich HTTP 503 statt stillschweigend nichts zu tun.
--
-- ── Was hier NICHT passiert ────────────────────────────────────────────────
--
-- Es wird nicht das ganze Organigramm aus §01 angelegt. Nur die Kette, die
-- X07 tatsächlich braucht:
--
--     CEO → AGI Manager → Platform Director → Browser Team → Browser Agent X07
--
-- Die fünf übrigen Directors und ihre Teams (Governance, Security, Compliance,
-- Customer-Success, Intelligence) stehen im Modell, haben aber heute keine
-- Besetzung. Sie hier anzulegen hiesse, ein Organigramm zu behaupten, hinter
-- dem niemand steht — dieselbe Klasse Fehler wie erfundener Vorschau-Text
-- (CLAUDE.md §10, Freigabe 2026-09-01).
--
-- Namen und Struktur sind aus §01 übernommen, nicht gewählt. Alle Zeilen
-- tragen `tenant_id IS NULL` (Platform Scope): X07 beobachtet die eigene
-- Plattform, nicht ein Kundensystem.
--
-- Idempotent: ON CONFLICT DO NOTHING gegen die Scope-Unique-Indizes aus
-- 20260904010200 / 20260904010300. Ein zweiter Lauf ändert nichts.

BEGIN;

-- ── Organigramm: vier Ebenen, feste UUIDs ──────────────────────────────────
--
-- Feste UUIDs statt gen_random_uuid(), damit die Zeilen über Umgebungen hinweg
-- dieselbe Identität haben. Ein Ticket, das lokal auf eine andere org_unit
-- zeigt als in Produktion, ist beim Vergleich zweier Stände wertlos.
INSERT INTO public.agent_org_units (id, tenant_id, parent_unit_id, unit_type, name, mission) VALUES
  ('0a7e0000-0000-4000-8000-000000000001', NULL, NULL,
   'executive', 'CEO',
   'Mandat und Rahmen der Plattform-Organisation.'),
  ('0a7e0000-0000-4000-8000-000000000002', NULL, '0a7e0000-0000-4000-8000-000000000001',
   'orchestrator', 'AGI Manager',
   'Orchestrierung und Entscheidung auf Basis aggregierter Berichte.'),
  ('0a7e0000-0000-4000-8000-000000000003', NULL, '0a7e0000-0000-4000-8000-000000000002',
   'director', 'Platform Director',
   'Verantwortet die ausgelieferte Plattform.'),
  ('0a7e0000-0000-4000-8000-000000000004', NULL, '0a7e0000-0000-4000-8000-000000000003',
   'team', 'Browser Team',
   'Beobachtet den ausgelieferten Browser-Zustand.')
ON CONFLICT (id) DO NOTHING;

-- ── Rolle ──────────────────────────────────────────────────────────────────
--
-- authority_level 4 = Ausführungs-Agent, die unterste Ebene. decision_scope
-- dokumentiert die Zuständigkeit und ist ausdrücklich KEIN Gate (ADR 0011 D1):
-- Ob ein Befund ohne Freigabe zu einem Deploy führt, prüft die Policy Engine.
INSERT INTO public.agent_roles (id, tenant_id, key, title, org_unit_id, authority_level, decision_scope) VALUES
  ('0a7e0000-0000-4000-8001-000000000001', NULL,
   'browser_watcher', 'Browser Watcher',
   '0a7e0000-0000-4000-8000-000000000004', 4,
   ARRAY['ui_bug', 'performance'])
ON CONFLICT (id) DO NOTHING;

-- ── Agent ──────────────────────────────────────────────────────────────────
--
-- capability_type 'tool_runner': X07 ist kein Chat-Agent, sondern ein
-- wiederkehrender Playwright-Lauf (§02). `model` bleibt NULL — es läuft kein
-- Sprachmodell; ein eingetragenes Modell wäre eine Kostenzuordnung, die nie
-- entsteht.
--
-- last_heartbeat_at bleibt NULL, bis der erste Lauf stattfindet. Registriert
-- ist nicht gelaufen — dieselbe Lehre wie beim pg_cron-Job
-- `memory-decay-hourly` (CLAUDE.md §5), der seit dem 2026-08-12 registriert
-- ist und in allen 470 Läufen gescheitert war.
INSERT INTO public.agents (id, tenant_id, role_id, agent_key, capability_type, model, specialization, status) VALUES
  ('0a7e0000-0000-4000-8002-000000000001', NULL,
   '0a7e0000-0000-4000-8001-000000000001',
   'browser-agent-x07', 'tool_runner', NULL,
   '{"domain": ["chromium", "dom", "console", "viewport", "performance"]}'::jsonb,
   'active')
ON CONFLICT (id) DO NOTHING;

-- ── Team ───────────────────────────────────────────────────────────────────
INSERT INTO public.agent_teams (id, tenant_id, org_unit_id, lead_agent_id) VALUES
  ('0a7e0000-0000-4000-8003-000000000001', NULL,
   '0a7e0000-0000-4000-8000-000000000004',
   '0a7e0000-0000-4000-8002-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.agent_team_members (team_id, agent_id, tenant_id) VALUES
  ('0a7e0000-0000-4000-8003-000000000001',
   '0a7e0000-0000-4000-8002-000000000001', NULL)
ON CONFLICT (team_id, agent_id) DO NOTHING;

COMMIT;
