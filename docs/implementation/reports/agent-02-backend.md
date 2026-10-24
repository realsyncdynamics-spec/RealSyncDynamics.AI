# Agent 02 – Backend/Supabase: verifizierte Architektur, Mandantentrennung, API-Verträge

Stand: 23.10.2026, Repo `/home/user/RealSyncDynamics.AI`, HEAD `b4f8a2f` (Branch `claude/adoring-euler-tpnlm1`).
Arbeitsweise: nur lesend. Keine Repo-Änderung, keine GitHub-Schreibaktion, kein Netzwerk-Call gegen Produktion/Supabase/Stripe.
Hilfsskripte (nur lesende Scanner über `supabase/migrations`) liegen außerhalb des Repos unter
`/tmp/claude-0/-home-user-RealSyncDynamics-AI/f7cd4ce3-3e59-5612-9832-d4dbd1e437cd/scratchpad/a02/`.

Statusmarker: **VERIFIZIERT** (im Repo/GitHub nachgelesen), **ABGELEITET** (aus Code geschlossen, nicht ausgeführt), **BLOCKIERT** (mit Grund).

Wichtiger Hinweis zur Basis: Die lokale Tracking-Ref `origin/main` steht auf `4df1fde` (#1966) und ist **7 Commits älter** als HEAD `b4f8a2f` (#1860). `git merge-base --is-ancestor origin/main HEAD` = wahr. Ein `git fetch` ist laut Brief verboten, daher wurde HEAD als Stand von `main` behandelt (VERIFIZIERT: `git rev-parse origin/main HEAD`).

---

## Kurzfassung (Kernbefunde)

1. **Bot/Conversation/Booking/Order-Schema existiert, zweimal und kollidierend.** Linie A (`bots`, `bot_conversations`, `bot_messages`, `bot_appointments`, `bot_orders`) wird vom gesamten Code genutzt. Linie B (`bot_agents`, `bot_question_catalog`, `availability_rules`, `appointments`, `orders`, `order_items`, `voice_channels`) ist toter Prod-Bestand. B hat A's `bot_conversations`/`bot_messages` still übersprungen, aber Schreib-Policies darauf ergänzt (VERIFIZIERT, `20260628193744_bots_foundation.sql:9-23,175-188`; `docs/runtime/PRODUCTION_BLOCKERS.md:121-290`).
2. **Für Akzeptanzszenarien 2/3 fehlt Wesentliches:** keine Slot-/Kalender-Modellierung und kein Doppelbuchungsschutz in A, keine Idempotenz bei `appointment-book`/`order-intake`, kein Katalog-/Preis-Schema (Restaurant-Preise in `bots.config`-JSON), keine Bot-Wissensbasis, kein `handed_off`/`tool`.
3. **Mandantentrennung (Szenario 7): mehrere Edge Functions mit Service-Role ohne eigene Auth- oder Membership-Prüfung** (nur `verify_jwt=true`, laut Repo-eigenem Kommentar akzeptiert das Gateway den Anon-Key als JWT): `webhook-deliver`, `webhook-dispatcher`, `calculate-seo-metrics`, `nis2-deadline-calculator`, `dashboard-digest-generate`, `hostinger-agent-brief`, `audit-determinism-verify`, `train-forecast-models`. Dazu kommen `cookie-scan-deep` (verify_jwt=false, `tenant_id` aus dem Body) und das auf `main` noch offene IDOR in `audit-report-pdf` und `audit-claim`, das PR #1869 behebt.
4. **8 public-Tabellen ohne RLS** (dokumentierte Ratsche in `test/runtime/db/security-regressions.db.test.ts:410-419`), keine davon bot-relevant. Echte `USING(true)`-Policies nur auf Referenz-/Katalogtabellen sowie `sub_processor_subscriptions` (anon INSERT).
5. **Zwei Membership-Tabellen:** `memberships` ist kanonisch (`is_tenant_member`). In `tenant_memberships` schreibt seit dem Backfill vom 02.06. niemand mehr, trotzdem steuert sie 17 Policies direkt plus `runtime_events` über `has_tenant_membership()` (u. a. `webhook_endpoints` INSERT/UPDATE). Folge: veraltete Rechte bzw. fehlende Rechte (ABGELEITET).
6. **Edge Functions:** 196 Verzeichnisse = 196 Einträge in `src/config/production-edge-functions.ts`, Allowlist leer (VERIFIZIERT). 71 Functions mit `verify_jwt=false`, die Webhook-Signaturen sind für Stripe/WhatsApp/Twilio/Telegram/GitHub/Shopify vorhanden.
7. **Migrations-Hygiene:** 390 Dateien, keine doppelte Version (Kollisions-Guard lokal: Exit 0). Drift-Guard **nicht ausführbar** (braucht Supabase-CLI + Prod-Token). #1650 (Prod-Schema ≠ Repo) offen. Seit 01.09. kein `DROP TABLE`/`DROP COLUMN`.
8. **PRs:** #1961 ist **inhaltlich identisch mit dem bereits gemergten #1966** (Schließkandidat). #1970 (Migration `20261023120000`) und #1908 (`20261023223000`) kollidieren nicht in Versionen; Zusammenspiel siehe F.

---

## A) Datenmodell

### A.1 Inventar `supabase/migrations` – VERIFIZIERT
- **390 Dateien**, 50.843 Zeilen. Zeitraum: `00001_initial_schema.sql` (Bootstrap, ohne Datum) sowie `20260406000000` … `20261020130000`.
- Verteilung nach Monat: 04/2026: 11 · 05: 99 · 06: 63 · 07: 84 · 08: 46 · 09: 67 · 10: 19.
- Namensschema `YYYYMMDDHHMMSS_snake_case.sql`. Zwei bewusst geduldete Ausnahmen: `00001_initial_schema.sql` und `20260510_ai_governance_core.sql` (8-stellig, `LEGACY_VERSIONS` in `scripts/check-migration-drift.mjs`, laut `docs/runtime/PRODUCTION_BLOCKERS.md:131-141`).
- **Keine doppelte Version** (`ls | sed … | uniq -d` leer). **Doppelte Namen** (gleicher Suffix, andere Version):
  - `bots_foundation|bots_entitlements|bots_ai_tool` je 3× (`20260628120000/120100/120200`, `20260628121531/121551/121603`, `20260628193744/193759/193820`). Die Versionen 121531ff. und 193744ff. wurden am 02.08. 1:1 aus dem Prod-Ledger zurückgeholt (Option A).
  - `canonical_plan_catalog` 13× (generiert von `scripts/generate-plan-catalog-sql.ts`, jede Fassung ersetzt die Katalogdaten; Kopfzeile `20261010090000_canonical_plan_catalog.sql:1-12`).
  - Je 2×: `customer_onboarding`, `optimize_governance_indices`, `shadow_runtime_events`, `subject_ref_lifecycle`.
- Statischer Scanner: 395 `CREATE TABLE`, davon 392 heute in `public` vorhanden, 656 überlebende Policies, 290 Funktionen, davon 208 `SECURITY DEFINER`. ABGELEITET: Regex-Scan, siehe Grenzen in B.6.

### A.2 Schema je Domäne

Legende: T = `tenant_id`-Spalte, RLS = aktiviert, P = Kern der Policies.

**Organisationen/Mandanten**
| Tabelle | Definition | Kern | T | RLS | Policies / Idempotenz |
|---|---|---|---|---|---|
| `tenants` (ex `organizations`) | `20260406000000_entitlements_schema.sql:8`, Umbenennung `20260430160000_rename_organizations_to_tenants.sql:6-20` | name, is_public_sector, industry (`20260720123711`) | – (id) | ja | `tenants member-read` `is_tenant_member(id)`, `owner-update` (`20260430180000_tenant_rls_and_webhook_events.sql:62,67`) |
| `memberships` (ex `organization_members`) | `20260406000000:17` | user_id, role ∈ owner/admin/editor/viewer_auditor, UNIQUE(tenant_id,user_id) | ja | ja | SELECT self/tenant; INSERT/UPDATE/DELETE nur Owner, oder Admin ohne Owner-Rolle (`20260927120000_gate0_rls_hardening.sql:161-181`) |
| `tenant_memberships` | `20260602100000_runtime_events_backbone.sql:75` | PK(tenant_id,user_id), role ∈ owner/admin/member/viewer | ja | ja | self-read, deny-writes (`:110,116`). **Kein Schreiber nach dem Backfill**, siehe B.4 |
| `tenant_invites` | `20260430300000_tenant_invites.sql:8` | token_hash, expires/accepted/revoked | ja | ja | tenant-read |
| `tenant_onboarding`, `tenant_provisioning_runs`, `tenant_activation` | `20260928132000:40`, `20260928150000:19`, `20260619000000:30` | – | ja | ja | member-read |
| `profiles` | `00001_initial_schema.sql:14` | is_super_admin | – (id=auth.uid) | ja | eigenes Profil lesen/ändern; Spaltengrenze per Tabellen-REVOKE (`20260915120000_profiles_privilege_boundary.sql:5-39`) |
| `company_profiles` | `20260824000000:30` | Branche/Sektor | ja | ja | – |

Helper: `is_tenant_member(uuid)` = SECURITY DEFINER, `search_path=public`, liest **nur `memberships`** (`20260723000001_rls_recursion_fix_security_definer.sql:21-33`). Daneben `is_tenant_owner_or_admin`, `is_tenant_owner`, `is_tenant_writer` und `has_tenant_membership` (liest `tenant_memberships`, `20260602100000:120`).

**Bots / Konversationen / Termine / Bestellungen** – siehe A.3. Weitere Kanaltabellen: `whatsapp_channels` (`20260826000000`, RLS: Member lesen, Owner/Admin schreiben), `telegram_connections` (`20260623000001`, service_role), `voice_bot_configs`, `voice_sessions`, `voice_executions`, `voice_tool_requests`, `voice_evidence`, `voice_number_bindings` (`20260928130000_voice_runtime_foundation.sql`), `fmt_bot_configs` (`20260924000000:373`).

**Wissensbasis**
| Tabelle | Definition | T | RLS | Bemerkung |
|---|---|---|---|---|
| `agent_knowledge_base` | `20260624000000_agent_operations_layer_schema.sql:153` | nullable (NULL = global) | ja | lesen: global oder Mitglied; schreiben: Mitglied (`:170-192`). **Nicht bot-gebunden.** |
| `hermes_knowledge_items` | `20260527000000_hermes_agent.sql:16` | ja | ja | Agent-spezifisch |
| `legal_documents`, `legal_chunks`, `legal_retrieval_log` | `20260614000000_legal_rag_foundation.sql:33,104,191` | – (globaler Rechtskorpus) | ja | Zugriff über RPC `legal_retrieve_chunks(_hybrid)` |
| `document_vault` | `20260715105402:13` | – | ja | `USING(true)` per `ALTER POLICY` auf super_admin eingeschränkt (`20260720124405:4-12`) |
| `bot_question_catalog` (B) | `20260628193744:49` | ja | ja | toter B-Bestand, FK auf `bot_agents` |

**Billing / Entitlements / Quoten / Trial**
| Tabelle | Definition | T | RLS | Idempotenz / Unique |
|---|---|---|---|---|
| `subscriptions` | `20260406000000:27` | ja | ja (tenant-read) | `stripe_subscription_id UNIQUE`; `UNIQUE(tenant_id)` (`20260711000001_subscription_tenant_unique.sql:12`); `trial_ends_at` (`20260720000000`) |
| `webhook_events` | `20260430180000:5` | – | ja (service-role only) | **PK = Stripe-Event-ID**, Insert-first-Dedupe in `stripe-webhook/index.ts:97-110`, bei Fehler Rollback-Delete (`:194-195`) |
| `entitlements`, `products`, `product_entitlements` | `20260430200000_entitlements_normalization.sql:20-65` | – | ja (lesen: authenticated) | Katalog, Upsert `ON CONFLICT (product_id, entitlement_id)` |
| `plan_catalog`, `plan_addons` | `20260802001000:20,50`; Policies `20260808130000:78-94` | – | ja (lesen: active, schreiben: service_role) | `plan_addons_stripe_price_id_key` (`20260904000000:51`) |
| `entitlement_grants` | `20260808100000:44` | ja | ja | – |
| `subscription_addons` | `20260406000000:45` | über subscription_id | **nein** (deny_all-Policy ohne RLS, `20260506170000:14`) | `stripe_item_id UNIQUE` |
| `usage_events` / `usage_totals` / `usage_limits_config` | `20260430220000_usage_tracking.sql:12,35,48` | ja | ja | **kein Idempotenzschlüssel** an `usage_events`; Totals per Trigger |
| `usage_counters` (Altbestand), `feature_usage` | `20260406000000:55`, `20260704000000:50` | ja | ja | UNIQUE(tenant, bucket) |
| `mcp_quota_counters`, `tenant_cost_ledger`, `tenant_cost_caps`, `metered_subscription_items`, `usage_meter_sync`, `stripe_trial_events`, `trial_audit_logs` | diverse (Liste in Scanner-Ausgabe) | ja | ja | – |
| Resolver `tenant_entitlements()` / `tenant_entitlements_resolve()` | `20260920130000_bots_quota_enforcement.sql:133,274`; Trial-Ablauf `20260928160000_wp2a_trial_end_expiry.sql:1-25` | – | – | `trialing` zählt nur bis `trial_end` |
| Bots-Quote | Trigger `bots_enforce_quota` mit `pg_advisory_xact_lock` je Mandant (`20260920130000:337-366`) | – | – | atomar |

Trial heute: **14 Tage Growth** (`supabase/functions/create-trial-subscription/index.ts:1,67-68`, Upsert `onConflict: 'tenant_id'` `:158`). Das Epic verlangt 72 h (Agent 08). VERIFIZIERT.

**Evidence / Audit-Logs**
| Tabelle | Definition | T | RLS | Append-only? |
|---|---|---|---|---|
| `ai_evidence_events` | `20260510_ai_governance_core.sql:50` | ja | ja; Insert durch Writer nur `ai_act_classification` (`20260927120000:144`) | ja (`20260901090000_evidence_append_only_anchors.sql`) |
| `evidence_anchors` | `20260901090000:296` | ja | ja | Kette |
| `governance_evidence` | `20260512000000_governance_events.sql:115` | ja (**ohne FK auf tenants**) | ja (Member lesen, service_role alles) | **nein**, PR #1908 offen |
| `audit_evidence`, `evidence_snapshots/items/versions/links/legal_holds`, `agent_change_evidence` (UNIQUE delivery_id) | `20260507100000`, `20260701140000`, `20260705040000`, `20261006120000` | ja | ja | teils |
| `audit_logs` | `00001_initial_schema.sql:99` | – | ja (eigene actor_id) | – |
| `audit_events`, `governance_audit_log`, `enterprise_ai_audit_events`, `trial_audit_logs`, `branding_audit_log` | div. | ja | ja | – |
| `seo_marketing_audit_log` | `20260707092902:166` | ja | **nein** | – |

**Policies / Freigaben**: `governance_policies` (+`governance_policy_versions` `20260620000004`), `ai_policies`, `policy_pack_catalog/controls/activations` (`20260701150000`), `policy_rule_templates`, `policy_snapshots`, `governance_approvals` (`20260513200000:10`), `pdp_approval_gates` (`20260824120000:206`), `runtime_approval_gates` (`20260516300000:50`), `terminal_approvals`. Alle mit RLS: Member lesen, Schreiben über service_role/RPC. VERIFIZIERT per Policy-Scan.

**Einwilligung / Leads**: `sales_leads` (`20260505100000:6`, nur super_admin lesen), `user_consents` (`20260608000001:10`, eigene Zeilen), `newsletter_subscribers` (DOI, `20260506240000`), `waitlist_signups` (`20260815230717`), `gdpr_audits` (Marketing-Consent `20261008133000`), Funnel/Erasure `20261015120000_funnel_lead_capture.sql` (`erase_lead_data`, `lead_erasure_log:687`, Retention-Cron `20261015130000`), `sub_processor_subscriptions` (anon INSERT, siehe B).

### A.3 Bot/Conversation/Booking/Order im Detail – VERIFIZIERT

Linie A (`20260628121531_bots_foundation.sql`, inhaltsgleich mit `20260628120000`):
- `bots` (`:20-37`): tenant_id, channel ∈ chat/voice/telegram/whatsapp, persona, greeting, capabilities JSONB, config JSONB, enabled. RLS: **jedes Mitglied** darf CRUD, auch `viewer_auditor` (`:139-146`).
- `bot_conversations` (`:40-62`): bot_id→`bots`, external_ref, contact_label, status ∈ open/closed. **UNIQUE(bot_id, external_ref) WHERE external_ref NOT NULL** (`:60-62`). Damit ist die Konversationsanlage idempotent.
- `bot_messages` (`:65-83`): role ∈ user/assistant/system, content, run_id, Token/Kosten. Kein Unique; WhatsApp dedupliziert über `metadata.wa_message_id` per `contains`-Abfrage (`whatsapp-webhook/index.ts:148-153`), ohne Index → Race möglich (ABGELEITET).
- `bot_appointments` (`:86-106`): customer_name, contact, service, `requested_at` (frei, optional), status ∈ requested/confirmed/cancelled. **Kein Endzeitpunkt, keine Ressource, kein Unique- oder Exclusion-Constraint.**
- `bot_orders` (`:109-130`): items JSONB, total_amount NUMERIC, status ∈ new/confirmed/fulfilled/cancelled. **Kein Positionsschema, kein Idempotenzschlüssel.**
- RLS (`:132-170`): SELECT Member; UPDATE bei appointments/orders jedes Mitglied; INSERT nur service_role (Edge Functions).

Linie B (`20260628193744_bots_foundation.sql`): legt per DO-Schleife (`:175-188`) RLS und `_sel/_ins/_upd/_del`-Policies (Owner/Admin) an, auch auf **A's `bot_conversations` und `bot_messages`**. Folge: Owner/Admin können den „Prüfpfad“ `bot_messages` clientseitig schreiben und löschen (VERIFIZIERT anhand der Policy-Schleife; in Prod ABGELEITET). Laut `PRODUCTION_BLOCKERS.md:236-254` (Messung 02.08.) haben B-Tabellen 0 Zeilen und 0 Code-Referenzen; `order_items` hat einen FK auf `inventory_items`.

Code-Nutzer von Linie A (VERIFIZIERT per grep): `supabase/functions/appointment-book`, `order-intake`, `bot-chat`, `bot-voice-webhook`, `whatsapp-webhook`, `_shared/bots.ts`, `_shared/restaurant-conversation.ts`, `apps/agent-runtime/src/voice/supabase-voice-store.ts` (schreibt `bot_appointments`), `src/features/bots/api.ts`.

**Was fehlt für Bot/Conversation/Booking/Order komplett (ABGELEITET aus Schema + Code):**
1. Kalender/Slots: kein `slot_start/slot_end`, keine Ressource oder Zeitzone, keine Verfügbarkeitsregeln in A (nur im toten B), keine Kalender-Bestätigung (`calendar_event_ref`) und kein Doppelbuchungsschutz (Exclusion-Constraint fehlt). Damit ist Szenario 2 („no claimed booking without calendar confirmation“) heute nicht abbildbar.
2. Katalog/Preise: Restaurant-Preise liegen in `bots.config` (`order-intake/index.ts:1-11`), und dieses JSON darf **jedes Mitglied** ändern. Es gibt keine versionierte Katalogtabelle, keinen Preis-Snapshot pro Position und keine MwSt.-Felder. Der allgemeine Pfad übernimmt `total_amount` vom Client (Body-Feld vorhanden, `order-intake` liest `body.total_amount`).
3. Idempotenz: `appointment-book` (`index.ts:73-84`) und `order-intake` (`:155`) legen bei jedem Retry eine neue Zeile an. Es gibt keinen `idempotency_key`.
4. Bot-Wissensbasis: keine bot- oder tenantgebundene KB-Tabelle mit Veröffentlichungsstatus. `agent_knowledge_base` ist für Agents gedacht und mischt globale Einträge ein.
5. Statusmodell: kein `handed_off` in `bot_conversations`, keine `tool`-Rolle in `bot_messages`, keine append-only Statushistorie für Termine und Bestellungen.
6. DSGVO: keine Felder für Rechtsgrundlage/Consent, Hinweisversion oder Aufbewahrungsfrist an Konversation/Termin/Bestellung (PII: `customer_name`, `contact`).
7. Missbrauchsschutz: öffentliche Endpunkte (`bot-chat`, `appointment-book`, `order-intake`) ohne Rate-Limit (grep `rateLimit` leer). Mit bekannter `tenant_id`+`bot_id` kann jeder die Monatsquote eines Mandanten verbrauchen oder PII-Spam einspielen.

---

## B) Mandantentrennung (Akzeptanzszenario 7)

### B.1 Tabellen ohne RLS – VERIFIZIERT
Die Ratsche `RLS_BEKANNTE_SCHULD` in `test/runtime/db/security-regressions.db.test.ts:410-419` deckt sich mit dem statischen Scan:
| Tabelle | Definition | tenant_id | Risiko |
|---|---|---|---|
| `seo_marketing_audit_log` | `20260707092902:166` | ja, old/new values | **Mittel**: bei Default-Grants für anon/authenticated lesbar und schreibbar |
| `_operation_metrics` | `20260717192000:42` | ja (+user_id) | Mittel |
| `_rate_limits`, `_circuit_breakers` | `20260717192000:4,15` | – | Niedrig–Mittel (Manipulation der Limits) |
| `provenance_records` | `20260406000000:80` | über asset | Mittel (deny_all-Policy wirkt ohne RLS nicht, `20260506170000:8-9`) |
| `subscription_addons` | `20260406000000:45` | über subscription | Mittel (Billing-Daten) |
| `memory_retention_policies` | `20260803000000:219` | – (Konfig) | Niedrig |
| `social_publishing_metrics_hourly` | `20260719193000:98` | – | Niedrig |
Einschränkung: Ob Prod hier abweicht (#1650: Prod ist teils strenger als das Repo), ist **BLOCKIERT** (kein Prod-Zugriff erlaubt).

### B.2 Policies mit `USING(true)` / `WITH CHECK(true)` (ohne `TO service_role`) – VERIFIZIERT
- Referenz- und Katalogdaten (vertretbar): `compliance_frameworks`, `framework_controls`, `iso_control_definitions/mappings`, `policy_pack_catalog/controls`, `policy_rule_templates`, `webhook_event_types`, `sub_processor_changes`.
- `agent_profiles` und `workflow_templates`: authenticated lesen global, inklusive `system_prompt` (`20260624000000:19-35,58`). **Niedrig.**
- `sub_processor_subscriptions`: `sp_sub_anon_insert` für anon und authenticated mit `WITH CHECK (true)` (`20260507140000_sub_processor_changes.sql:88-92`). Freie E-Mail-Anmeldung ohne Double-Opt-in auf DB-Ebene. **Niedrig–Mittel** (Consent).
- Fehlalarm geprüft: `document_vault` per `ALTER POLICY` korrigiert (`20260720124405`); `webhook_deliveries service_role_insert` ist mit `DROP TABLE … CASCADE` verschwunden (`20260705200000:80`).

### B.3 SECURITY DEFINER ohne `search_path` – VERIFIZIERT (Scan) / ABGELEITET (Wirkung)
17 Funktionen (letzte Definition, kein späteres `ALTER FUNCTION … SET search_path`), u. a. `update_member_role`, `create_notification`, `get_notifications`, `get_unread_notification_count`, `get_notification_preferences`, `mark_notification_read`, `queue_email_notification`, `notify_quota_alert`, `save_workflow_progress`, `complete_workflow`, `log_notification_event`, `create_default_notification_preferences`, `log_role_change`, `cleanup_social_dlq`, `rollup_publishing_metrics_hourly`, `log_enterprise_agent_run_event`, `legal_retrieve_chunks_hybrid`.
- Die meisten sind per `20260903044500_align_repo_function_grants_with_prod.sql:66-127` auf service_role beschränkt. Damit bleibt **Niedrig** (Härtung fehlt, kein direkter Client-Pfad).
- `legal_retrieve_chunks_hybrid` (`20260625200001:11-36`): DEFINER, ohne search_path, ohne REVOKE, also im Repo-Schema für PUBLIC ausführbar. Liest nur den globalen Rechtskorpus. **Niedrig.**
- Kandidaten, deren Grants nicht geprüft wurden: `log_role_change`, `create_default_notification_preferences`, `cleanup_social_dlq`, `rollup_publishing_metrics_hourly`, `log_enterprise_agent_run_event`. Es sind Trigger/Cron, der Rechte-Stand in Prod ist unbekannt.

### B.4 Doppelte Membership-Quelle – VERIFIZIERT (Struktur) / ABGELEITET (Wirkung)
- `tenant_memberships` wurde einmalig aus `memberships` befüllt (`20260602100000:91-104`). Kein Trigger, keine Edge Function und kein RPC schreibt danach hinein (grep in `supabase/functions` und den Migrationen ohne Treffer). Einzige Ausnahme ist das Löschen im offenen PR #1970.
- Abhängige Policies: `webhook_endpoints` (read/insert/update/delete), `api_calls`, `api_rate_limit_configs` (inkl. UPDATE), `api_rate_limit_violations`, `custom_controls`, `custom_framework_mappings`, `email_notifications`, `quota_alerts` sowie `runtime_events` über `has_tenant_membership()`.
- **Risiko Mittel:** Wer aus `memberships` entfernt wurde, behält über einen alten `tenant_memberships`-Eintrag Zugriff, z. B. Webhook-Endpunkte anlegen und damit Events abziehen. Mitglieder neuer Mandanten sehen diese Daten dagegen gar nicht (funktionaler Fehler). Prod-Datenlage: **BLOCKIERT**.

### B.5 Edge Functions mit Service-Role über Mandantengrenzen
Methode: Heuristik (Service-Role-Nutzung + `tenant_id` aus dem Request + keine Auth-/Membership-Prüfung), danach jeden Treffer manuell gelesen. Hinweis zu `verify_jwt=true`: Laut Repo-eigenem Kommentar ist der Anon-Key ein gültiges JWT (`supabase/functions/rebuild-website/index.ts:5-7`). Ob das bei neuen Publishable Keys noch gilt, ist offen (ABGELEITET).

| Function | verify_jwt | Befund (VERIFIZIERT am Code) | Risiko |
|---|---|---|---|
| `webhook-deliver` | true (Default) | Keine Auth, obwohl der Kommentar „service-role or internal“ verlangt (`index.ts:7`). `tenant_id` und `payload` kommen aus dem Body, gelesen wird `webhook_subscriptions.secret`, danach wird **signiert an Kundenendpunkte zugestellt** (`:95-170`) | **Hoch** (gefälschte, gültig signierte Events an Kundensysteme) |
| `webhook-dispatcher` | true | gleiches Muster, `tenantId` aus dem Body (`index.ts:37-50`), HMAC-Versand | **Hoch** |
| `calculate-seo-metrics` | true | `tenant_id` aus dem Body, liest `marketing_metrics`/`customer_lifecycle` jedes Mandanten und gibt Kennzahlen zurück (`index.ts:55-151`) | **Hoch** (Cross-Tenant-Read) |
| `nis2-deadline-calculator` | true | Kommentar fordert Membership (`:4`), Code prüft keine. Liest `incidents` mit `body.tenant_id` (`:25-58`) | **Mittel–Hoch** |
| `dashboard-digest-generate` | true | `tenant_id` optional aus dem Body, liest Audits/Incidents/Vendors und erzeugt Notifications | Mittel–Hoch |
| `hostinger-agent-brief` | true | „Auth: none“ (`index.ts:8`), liefert plattformweit letzte Audit-Domains/Scores und Lead-Status | Mittel |
| `audit-determinism-verify` | true | `tenantId` aus dem Body, liest/aktualisiert `audit_determinism_tests` | Mittel |
| `train-forecast-models` | true | `jwtDecode` ohne Prüfung, Mandant aus `user_metadata` (vom Nutzer änderbar), danach aber `body.tenant_id` (`index.ts:23-44`). Zieltabelle `seo_forecast_models` existiert in keiner Migration, daher heute vermutlich nicht lauffähig | Mittel (latent) |
| `sync-stripe-metrics` | true | `tenant_id` aus dem Body, nutzt dessen gespeicherten Stripe-Key. `tenant_settings` existiert in keiner Migration | Mittel (latent) |
| `cookie-scan-deep` | **false** | schreibt mit `body.tenant_id` in `gdpr_audits` (`index.ts:428-442`), Fehler wird nicht geprüft | Mittel (Fremdeinträge im Mandanten-Workspace) |
| `audit-report-pdf` | false | **main:** Prüfung nur, *wenn* ein Token mitkommt (`index.ts:97-111`). Ohne Token genügt die `audit_id`, Rückgabe: 24-h-Signed-URL samt E-Mail/Firma | **Hoch**, Fix in PR #1869 |
| `audit-claim` | true | **main:** Abweichende E-Mail wird nur protokolliert (`_shared/audit-claim.ts:116-119`, `audit-claim/index.ts:127-136`). Die Service-Role schreibt das Claim; die sichere RPC `claim_gdpr_audit` (`20260830091500`) bleibt ungenutzt | **Mittel–Hoch**, Fix in PR #1869 |
| `enterprise-ai-os-feedback/-founding-access` | false | öffentliches INSERT ohne Rate-Limit, gibt die Zeile zurück | Niedrig |
| `governance-connectors` | false | Stub, loggt beliebige Daten (`index.ts:1-30`) | Niedrig |
| `bot-chat`/`appointment-book`/`order-intake` | false | Design: öffentlich über (tenant_id, bot_id), `resolveBot` bindet den Mandanten (`_shared/bots.ts:77-93`). Kein Rate-Limit, Quote/PII-Spam möglich | Mittel |

Positiv geprüft (VERIFIZIERT): `stripe-webhook` (`constructEventAsync` + Dedupe), `whatsapp-webhook` (X-Hub-Signature), `bot-voice-webhook` (X-Twilio-Signature), `telegram-webhook` (Secret-Token-Header), `agent-change-evidence-webhook` (HMAC + UNIQUE delivery_id), Crons mit eigenem Key (`scheduler-dispatch`, `memory-decay-worker`, `governance-monitoring-scheduler`) oder SRK-Bearer (`audit-drip-cron`, `audit-recheck-weekly`, `sub-processor-notify`, `governance-analytics-aggregator`, `website-maintenance-daily-cron`), `compliance-alert-trigger`, `governance-risk-escalate` und `memory-confidence-trigger` (SRK-Bearer). #1964 hat `optimize-execute`, `governance-gap-analyzer` und `share-dashboard` bereits gefixt (git log).

Weitere Auffälligkeit: Rollen-Granularität bei Bots. `viewer_auditor` darf `bots` inkl. `config` (Preise) ändern (`20260628121531:139-146`). **Mittel.**

### B.6 Grenzen dieser Analyse
- Regex-Scanner, kein Postgres. DO-Schleifen, `DROP TABLE … CASCADE` und `ALTER POLICY` wurden manuell nachgeprüft, andere Sonderfälle könnten fehlen.
- Prod-Abweichungen (#1650) sind nicht prüfbar (**BLOCKIERT**: Prod-/Supabase-MCP-Calls laut Brief verboten).
- DB-Tests (`test/runtime/db/*.db.test.ts`, 54 Dateien) wurden nicht ausgeführt (**BLOCKIERT**: kein Postgres, kein `npm install`). `rls.db.test.ts` deckt nur `runtime_events` ab. **Für die Bot-Tabellen gibt es keinen Cross-Tenant-Test** (grep).

---

## C) Edge Functions

### C.1 Inventar – VERIFIZIERT
- `supabase/functions`: **196 Function-Verzeichnisse** + `_shared`.
- `src/config/production-edge-functions.ts`: 196 Einträge, `EDGE_FUNCTIONS_OBSERVED_MAX = 196`, gemessen `2026-10-16T12:07Z` (`:92-95`). Abgleich Verzeichnis ↔ Liste in beide Richtungen leer. Kleine Inkonsistenz: Der Kopfkommentar nennt noch „194 ACTIVE“ (`:13`).
- `scripts/edge-function-drift-allowlist.json`: `allow: []`; die fünf verwaisten Functions wurden am 11.08. gelöscht.
- `supabase/config.toml`: 75 `[functions.*]`-Blöcke, **71× `verify_jwt=false`**, 12× `true`. Alle übrigen nutzen den Default `true`.
- `verify_jwt=false`: stripe-webhook, shopify-*, agent-change-evidence-webhook, workflow-/automation-callback, governance-ingest/-decide/-router/-webhooks/-keys/-resources/-approvals/-dpias/-incidents/-connectors/-dsr/-vendors/-analytics-aggregator, security-signal-ingest, microsoft365-audit-sync, newsletter-*, checkout-website-rebuild, gdpr-audit, audit-report-email/-pdf, health, cookie-scan(-deep), browser-action-log, sales-lead, track-pageview, marketing-event, telemetry-ai-event, welcome-email, rebuild-website, market-scanner, ai-act-classify, die Crons (daily-digest, audit-*-cron, agent-os-runner, scheduler-dispatch, memory-decay-worker, email-auth-rescan, governance-erasure-sweeper, business-metrics-cron, stripe-meter-sync, website-maintenance-daily-cron, sub-processor-notify, governance-monitoring-scheduler), enterprise-ai-os-* (6), telegram-webhook, legal-embed, bot-chat, appointment-book, order-intake, bot-voice-webhook, whatsapp-webhook.
- Fehlerformat (VERIFIZIERT, `_shared/gateway.ts:49-59`): `{ ok:false, error:{ code, message, details? } }`.

### C.2 Logging der AI-Calls – VERIFIZIERT / ABGELEITET
- Zentral: `runAiTool` (`_shared/ai.ts`) schreibt `ai_tool_runs` (`:125,363`) und Usage (`ai_calls/ai_tokens/ai_cost_cents`). Residency ist seit #1966 fail-closed (`:15,181`). Aufrufer: ai-invoke, bot-chat, bot-voice-webhook, browser-execute, kodee-advise, kodee-diagnose, whatsapp-webhook.
- Über `_shared/aiGateway`: ai-gateway, governance-router, governance-agent, classify-document, telegram-webhook, ai-act-classify.
- **Direkte Provider-Calls ohne `ai_tool_runs`** (grep): `website-maintenance-agent`, `website-operations-agent` (Anthropic; nur `deployment_logs`), `legal-embed`, `legal-retrieve` (OpenAI Embeddings), `ai-act-classify` (Anthropic/OpenAI; eigener `anonAudit`-Pfad nicht weiter geprüft). Das widerspricht „Jeder Call wird geloggt“ (CLAUDE.md) und betrifft Issue #1646.

### C.3 Vertragsliste (Kandidaten für `docs/implementation/CONTRACTS.md`) – VERIFIZIERT aus Code-Köpfen
| Endpoint | Auth | Request | Response (ok) | Fehlercodes / Idempotenz |
|---|---|---|---|---|
| `POST bot-chat` | öffentlich (tenant_id+bot_id) | `{tenant_id, bot_id, message, conversation_ref?, contact_label?}` | `{ok, conversation_id\|null, reply, run_id\|null, policy_blocked?}` (`bot-chat/index.ts:98-104,161-166`) | 402 QUOTA_EXCEEDED, 403 Entitlement/disabled, 404 bot, 503 RESIDENCY_UNAVAILABLE. Konversation idempotent über (bot_id, external_ref). Abgelehnte Nachricht: ohne Persistenz, kein Quota-Verbrauch |
| `POST appointment-book` | öffentlich | `{tenant_id, bot_id, customer_name, contact?, service?, requested_at? (ISO), notes?, conversation_ref?}` | `{ok, appointment_id, status}` | 403 CAPABILITY_DISABLED/ENTITLEMENT_MISSING (`bots.appointments`). **Nicht idempotent, keine Slotprüfung** |
| `POST order-intake` | öffentlich | `{tenant_id, bot_id, customer_name, contact?, items, total_amount?, currency?, fulfillment?, delivery_address?, payment_method?, confirmed?, notes?, conversation_ref?}`; Restaurant: nur item_id+qty, Preise aus `bots.config` | `{ok, order_id, status, …}` | `bots.orders`-Gate. **Nicht idempotent** |
| `POST bot-voice-webhook` | Twilio-Signatur bzw. Mitglied (Modus B) | Twilio-Form oder `{tenant_id, bot_id, message, conversation_ref?, event?, duration_seconds?}` | TwiML bzw. `{ok, reply, conversation_id}` | CallSid = conversation_ref |
| `GET/POST whatsapp-webhook` | Meta-Verify / X-Hub-Signature-256 | Meta-Payload | immer 200 | Dedupe über `wa_message_id` in metadata (ohne Unique) |
| `POST stripe-webhook` | Stripe-Signatur | Stripe-Event | `{received:true[, duplicate:true]}` | Idempotent über `webhook_events.id`; Upserts `onConflict` `stripe_item_id`, `source,purchase_reference`, `stripe_invoice_id` (`index.ts:273,298,433,547`) |
| `POST stripe-checkout` | User-JWT | `{tenant_id, plan_key, return_url?}` | Checkout-URL | – |
| `POST create-trial-subscription` | User-JWT | `{tenantId?, planKey:'growth'}` | Trial-Stand | 400 TRIAL_NOT_AVAILABLE; Upsert `onConflict tenant_id`; **14 Tage** |
| RPC `tenant_entitlements(p_tenant_id)` | authenticated | – | `[{key, value…}]` | trialing nur bis trial_end |
| `POST ai-invoke` | User-JWT | `{tenant_id, tool_key, input, metadata?}` | Run-Ergebnis | 503 RESIDENCY_UNAVAILABLE, Quote |
| `POST tenant-invite` | User-JWT | `{op:'create'\|'list'\|'revoke'\|'accept', …}` | `{ok,…}` | Seat-Limit erst mit #1907 (402) |
| `POST gdpr-delete` | User-JWT (+AAL2 beobachtet) | `{confirm:'DELETE-MY-ACCOUNT'}` | `{…cascade_deleted, lead_data, erasure_receipt_id}` | 409 SOLE_OWNER (main: jeder Alleinbesitzer, #1970 ändert) |
| `GET gdpr-export` | User-JWT | – | JSON-Download | – |
| `POST provision-tenant` | User-JWT (Owner/Admin) oder service_role | `{tenant_id?, trigger?, domain?}` | Stand, idempotent | – |
| `POST audit-claim` | User-JWT | `{audit_id, tenant_id?}` | – | Sicherheitslücke auf main, siehe B.5/#1869 |

---

## D) Migrations-Hygiene

- `scripts/check-migration-collisions.mjs` gelesen: nur lesende Git-Aufrufe (`ls-tree`, `show`, `rev-parse`, `:136-155`), Netzwerk nur mit `GITHUB_TOKEN` (`:218-263,276`), keine Dateischreibzugriffe. **Ausgeführt** mit `env -u GITHUB_TOKEN -u GITHUB_ACTIONS BASE_REF=origin/main node scripts/check-migration-collisions.mjs` → Exit 0, „✅ Keine Migrations-Kollision“. Hinweis: Prüfung (4) gegen offene PRs ist „NICHT GELAUFEN“ (ohne Token), und die Basis ist die veraltete lokale `origin/main` (`4df1fde`). Der Lauf wertet daher nur `20261020130000_…` als neu. VERIFIZIERT.
- `scripts/check-migration-drift.mjs` gelesen: braucht `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID` und `supabase migration list --linked` (Prod) (`:40-56`). **Nicht ausgeführt** (BLOCKIERT: Prod-Call verboten, CLI nicht installiert: `which supabase` leer). Statisch: Ohne Secrets und bei CLI-Fehlern endet es mit Exit 0, ein grüner Lauf ist also ein Skip (`:40-55`, auch `PRODUCTION_BLOCKERS.md:166-168`).
- Drift-Lage: Die 11 Remote-only-Versionen sind seit 02.08. im Repo (Option A). Damals waren **119 lokale Migrationen auf Prod nicht angewendet** (`PRODUCTION_BLOCKERS.md:284-286`). Der heutige Stand ist unbekannt (BLOCKIERT).
- **Issue #1650** (gelesen, offen, 27.09.): In Prod haben 7 Views `security_invoker=true`, im Repo-Schema nicht. Die Prod-Änderung fehlt als Migration, also ist jede frische Umgebung offener. Weitere Fälle dieser Klasse sind im Repo dokumentiert: Out-of-Band-Revoke (`20260903044500:1-20`), Bots-Linie B.
- Destruktive Statements: Seit 01.09.2026 **kein `DROP TABLE`/`DROP COLUMN`/`TRUNCATE`**. Datenwirksam: `DELETE FROM product_entitlements …` in jeder `canonical_plan_catalog`-Fassung (z. B. `20261010090000:321`, Katalog-Abgleich auf interne Add-on-Produkte) und `ALTER TABLE … DROP CONSTRAINT` (CHECK-Austausch) in `20260905100000_microsoft365_connector.sql:320,349`. Weitere `DELETE`s liegen in Funktionskörpern für Lösch- und Retention-Pfade (`20261015120000:739-836`, `20260901090000:182`, `20260927170000:74`). Einziges `DROP TABLE … CASCADE`: `20260705200000_webhook_delivery_system.sql:80` (Juli).

---

## E) Weitere Backends (kurz) – VERIFIZIERT (Struktur) / ABGELEITET (Laufzeit)
| Komponente | Art / Deploy | Schnittstelle zum Supabase-Kern |
|---|---|---|
| `apps/agent-runtime` | Node/Docker, Deploy per `deploy-agent-runtime-vps.yml` (VPS) | Service-Role über REST: `voice_bot_configs`, `voice_number_bindings`, `voice_sessions`, `voice_tool_requests`, `voice_executions`, `voice_evidence`, `bot_appointments` (`src/voice/supabase-voice-store.ts:2-5,66-84`); PDP über `AGENT_PDP_URL` (`src/pdp-client.ts:40,169`) |
| `apps/mcp-server` | Node/Docker | Service-Role: `mcp_api_keys`, `mcp_key_usage`, `evidence_snapshots`, `tenants`, `framework_controls`, `compliance_frameworks` |
| `services/realsync-runtime-core` | Node/Docker, **eigene Postgres-DB** (`RUNTIME_CORE_DATABASE_URL`, `src/db/schema.sql`) | keine Supabase-Referenz |
| `services/realsync-evidence-runtime`, `services/openclaw-agent` | Node/Docker | keine Supabase-Referenz |
| `services/playwright-scanner` | Hono+Playwright, `deploy-playwright-scanner.yml` | von `cookie-scan-deep` per HTTP genutzt |
| `workers/govard-gateway` | Cloudflare Worker, eigene D1 (`migrations/0001_init.sql`), Durable Object `EvidenceSequencer`, R2 `govard-evidence-seals`, Workflow `CommandWorkflow` (`wrangler.jsonc:30-77`); `deploy-govard-gateway.yml` | **getrennter Datenhaushalt**, keine Supabase-Referenz |
| `workers/siteos-preview` | Cloudflare Worker, `deploy-siteos-preview.yml`; liefert SiteOS-Vorschauen von eigener Origin | Gegenstück `supabase/functions/siteos/preview.ts` |
| `platform/*` | Python (`governance_backend`, `builder_orchestrator`), docker-compose/Traefik, `nextjs_frontend` | builder_orchestrator mit 7 Supabase-Referenzen. Laut CLAUDE.md „nicht anfassen“, Laufzeitstatus unbekannt |
| `packages/*` | `agent-runtime-contracts`, `evidence-chain`, `sdk`, `siteos-core` | Bibliotheken |
Folge: Evidence entsteht an mindestens drei Orten (Supabase-Tabellen, govard D1/R2, runtime-core-DB). Für Szenario 5 muss im Vertrag festgelegt werden, welcher Ort maßgeblich ist.

---

## F) Offene PRs mit Backend-Bezug – VERIFIZIERT (get_files) / ABGELEITET (Konflikte)
| PR | Status | Backend-Dateien | Migration |
|---|---|---|---|
| #1970 GDPR Delete (Draft) | 23.10. | `gdpr-delete/index.ts`, neu `gdpr-delete/tenant-cleanup.ts`, `src/features/settings/AccountSettings.tsx`, Tests | **`20261023120000_account_self_deletion_sole_tenant.sql`**: RPC `delete_sole_member_tenants(uuid, bool)`, SECURITY INVOKER, `search_path=''`, nur service_role |
| #1961 AI-Residency & Bot-Policy (Draft) | 21.10. | `_shared/ai.ts`, `_shared/bots.ts`, `_shared/residencyGuard.ts`, `bot-chat`, `governance-router`, Tests, Doku | – . **Identische Dateiliste und Zeilenzahlen wie der gemergte #1966 (`4df1fde`, 9 Dateien, +267/−69)**. Inhalt ist auf main (`_shared/ai.ts:15,181`, `bot-chat/index.ts:77-109`) → **überholt** |
| #1926 Leads/Consent | 23.10. | `sales-lead/index.ts`, `audit-drip-cron/{index,consent-gate}.ts`, `gdpr-audit/index.ts` (1 Zeile), `scripts/plan-name-gate-baseline.json`, Test | – |
| #1918 Onboarding (Draft) | 23.10. | nur Frontend (`src/features/governance/**`, `src/i18n/handoffApp.ts`, Tests) | – |
| #1908 Evidence append-only (Draft) | 23.10. | Test | **`20261023223000_governance_evidence_append_only.sql`**: Trigger gegen UPDATE/DELETE, `REVOKE UPDATE, DELETE … FROM PUBLIC, anon, authenticated` |
| #1907 Billing Seats (Draft) | 23.10. | `tenant-invite/index.ts`, neu `_shared/seat-limit.ts`, `src/features/tenants/api.ts`, Test | – |
| #1869 Audit-Claim-Security | 23.10. | `_shared/audit-claim.ts`, `audit-claim/index.ts`, `audit-report-pdf/index.ts`, neu `_shared/audit-report-access.ts`, `src/core/onboarding/claimAudit.ts`, `src/features/audit/pendingAudit.ts`, `src/unified-entry/pages/PostRegisterOnboardingPage.tsx`, `NextBestActionCard.tsx`, `scripts/gtm-readiness-check.sh`, Doku, Tests | – (nutzt die bestehende RPC `claim_gdpr_audit`, `20260830091500`) |

Konfliktpotenzial:
- **Datei-Überschneidungen zwischen den 7 PRs: keine** (Dateilisten paarweise disjunkt). #1961 überschneidet sich vollständig mit `main` und erzeugt beim Rebase entweder einen Leer-Diff oder Konflikte.
- **Migrations-Versionen:** `20261023120000` (#1970) < `20261023223000` (#1908), beide > höchste Version auf main `20261020130000`. Keine Kollision.
- **Semantik #1970 × #1908:** `governance_evidence.tenant_id` hat keinen FK auf `tenants` (`20260512000000:117`). Beim Löschen eines Workspaces über #1970 bleiben `governance_evidence`-Zeilen verwaist zurück, mit Titeln wie „Website-Audit example.de“. Mit #1908 sind sie ohne Purge-Schalter nicht mehr löschbar. Das ist kein Merge-Konflikt, aber eine DSGVO-Lücke, die die Art.-17-Antwort von #1970 (`deleted_workspaces`) nicht ausweist.
- **#1970 × B.4:** #1970 berücksichtigt `tenant_memberships` als Mitgliedsquelle (gut). Ein Rest-Eintrag dort blockiert die Löschung mit `other_members`.
- **#1907 × Szenario 1/6:** Seat-Limit liest `limit.team_seats` aus Entitlements. Ein 72-h-Trial (Agent 08) muss den Schlüssel liefern, sonst lehnt der Code fail-closed ab (`SEATS_NOT_IN_PLAN`).
- Hotspot: Jede Preisänderung erzeugt eine neue `canonical_plan_catalog`-Migration. Parallele Billing-PRs kollidieren deshalb semantisch, nicht textuell.

---

## Abhängigkeiten zu offenen PRs/Issues
- **#1869** schließt die zwei mandantenübergreifenden Lücken `audit-report-pdf` (IDOR) und `audit-claim` auf main. Voraussetzung für Szenario 7. Bezug: Issue **#1865**.
- **#1961** ist überholt durch #1966 (gemergt). Schließen statt fortführen (Entscheidung Dominik).
- **#1970** (Art. 17) hängt mit #1908 und B.4 zusammen (siehe F).
- **#1908** ist Voraussetzung für append-only Evidence (Szenario 5, Agent 03).
- **#1907** liefert die Seat-Durchsetzung (Agent 08) und berührt `tenant-invite`.
- **#1926** liefert Consent/DOI bei Leads (Agent 06 nutzt dasselbe Muster für WhatsApp-Opt-in).
- **#1650** Schema-Drift: Jede Welle-2-Migration muss additiv sein und darf Prod-only-Zustände nicht überschreiben. Ohne lesenden Prod-Diff bleibt das Risiko bestehen.
- **#1646** AI-Gateway-Usage-Attribution betrifft die Lücke aus C.2 (direkte Provider-Calls ohne `ai_tool_runs`).
- **#1039/#923** Checkout→Webhook→Entitlements: Stripe-Idempotenz ist verifiziert (C.3), Trial = 14 Tage statt 72 h (A.2).
- `docs/runtime/PRODUCTION_BLOCKERS.md` Blocker 2: Bots-Linie A/B ist offen (Produktentscheidung).

## Vorschläge für Welle 2
Grundsatz: nur additive Migrationen. Policy-Ersatz (`DROP POLICY` + `CREATE POLICY`) und CHECK-Austausch sind datenerhaltend, verändern aber Verhalten und brauchen daher Einzelfreigabe. Migrationen bleiben laut Epic beim Orchestrator (Ownership).

**WP2-01 Security: Auth-Gates für Service-Role-Functions (Szenario 7)**
- Ziel: `requireServiceRole` bzw. `requireTenantMembership` (vorhandene `_shared`-Helper) in `webhook-deliver`, `webhook-dispatcher`, `calculate-seo-metrics`, `nis2-deadline-calculator`, `dashboard-digest-generate`, `hostinger-agent-brief`, `audit-determinism-verify`, `train-forecast-models`, `sync-stripe-metrics`. In `cookie-scan-deep` den Body-Parameter `tenant_id` ignorieren oder an Membership binden.
- Dateien: `supabase/functions/<obige>/index.ts`, neue Tests `test/edge/<fn>-auth.test.ts`.
- PR: neu, Muster wie das gemergte #1964. Kein bestehender PR deckt das ab.
- Risiko: Interne Aufrufer (pg_cron/Trigger) müssen den Bearer schicken. Vorher Aufrufer per grep in Migrationen (`net.http_post`) prüfen.
- Tests: Quelltext-Tests (Auth vor erstem `.from(`), Unit-Tests der Entscheidungsfunktion.

**WP2-02 #1869 fertigstellen und mergen** (bestehender PR fortführen). Tests liegen bei. Risiko: geänderter Claim-Flow im Frontend.

**WP2-03 RLS-Altschuld (8 Tabellen) + Membership-Konsolidierung**
- Ziel: (a) additive Migration `ENABLE ROW LEVEL SECURITY` + service_role-only bzw. Tenant-Policy für die 8 Tabellen, Ratsche in `security-regressions.db.test.ts` kürzen. (b) Entscheidung `tenant_memberships`: Sync-Trigger von `memberships` (additiv) **oder** die 17 Policies + `has_tenant_membership` auf `is_tenant_member` umstellen (Policy-Ersatz).
- Dateien: `supabase/migrations/2026102x…_rls_debt.sql`, `test/runtime/db/security-regressions.db.test.ts`.
- Risiko: Monitoring-Writer ohne Service-Role brechen. Prod-Abweichung (#1650) vorher lesend prüfen.

**WP2-04 Cross-Tenant-Testsuite (Szenario 7)**
- Ziel: DB-Test „Mandant A sieht/ändert nichts von B“ für `bots`, `bot_conversations`, `bot_messages`, `bot_appointments`, `bot_orders`, `whatsapp_channels`, `voice_*`, `subscriptions`, `usage_*`, `governance_evidence`, `webhook_endpoints`; zusätzlich Viewer-Rolle gegen Bot-Schreibzugriffe.
- Dateien: `test/runtime/db/tenant-isolation-bots.db.test.ts` (neu). Rein additiv, kein Konflikt.

**WP2-05 Minimales, nicht-destruktives Schema für Bot/Conversation/Booking/Order (nur Vorschlag, auf Linie A aufbauend; Linie B unangetastet)**
```sql
-- 0) Voraussetzung
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1) Bot-Wissensbasis (Szenario 2)
CREATE TABLE IF NOT EXISTS public.bot_knowledge_items (
  id uuid PK default gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bot_id uuid NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  title text NOT NULL, content text NOT NULL, source_url text,
  content_hash text NOT NULL, version int NOT NULL DEFAULT 1,
  is_published boolean NOT NULL DEFAULT false,
  created_at/updated_at timestamptz,
  UNIQUE (bot_id, content_hash));
-- RLS: SELECT is_tenant_member; INSERT/UPDATE/DELETE is_tenant_owner_or_admin

-- 2) Verfügbarkeit / Slots (Szenario 2)
CREATE TABLE IF NOT EXISTS public.bot_availability_rules (
  id uuid PK, tenant_id uuid NOT NULL, bot_id uuid NOT NULL REFERENCES bots(id),
  resource_key text NOT NULL DEFAULT 'default',
  weekday smallint CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL, end_time time NOT NULL CHECK (end_time > start_time),
  slot_minutes int NOT NULL CHECK (slot_minutes > 0),
  timezone text NOT NULL DEFAULT 'Europe/Berlin', is_active boolean DEFAULT true);

ALTER TABLE public.bot_appointments
  ADD COLUMN IF NOT EXISTS resource_key text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS slot_start timestamptz,
  ADD COLUMN IF NOT EXISTS slot_end timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS calendar_provider text,
  ADD COLUMN IF NOT EXISTS calendar_event_ref text,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_basis text,
  ADD COLUMN IF NOT EXISTS retention_until timestamptz;
ALTER TABLE public.bot_appointments
  ADD CONSTRAINT bot_appointments_slot_order CHECK (slot_end IS NULL OR slot_end > slot_start) NOT VALID;
ALTER TABLE public.bot_appointments
  ADD CONSTRAINT bot_appointments_no_double_booking
  EXCLUDE USING gist (tenant_id WITH =, resource_key WITH =, tstzrange(slot_start, slot_end) WITH &&)
  WHERE (slot_start IS NOT NULL AND status IN ('requested','confirmed'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_bot_appointments_idem
  ON public.bot_appointments (tenant_id, bot_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 3) Katalog + Positionen (Szenario 3)
CREATE TABLE IF NOT EXISTS public.bot_catalog_items (
  id uuid PK, tenant_id uuid NOT NULL, bot_id uuid REFERENCES bots(id),
  sku text NOT NULL, name text NOT NULL,
  unit_price_cents int NOT NULL CHECK (unit_price_cents >= 0),
  currency text NOT NULL DEFAULT 'EUR', tax_note text,
  is_available boolean DEFAULT true, version int DEFAULT 1, archived_at timestamptz,
  UNIQUE (tenant_id, sku));
CREATE TABLE IF NOT EXISTS public.bot_order_items (
  id uuid PK, tenant_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES bot_orders(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES bot_catalog_items(id) ON DELETE SET NULL,
  name_snapshot text NOT NULL, quantity int NOT NULL CHECK (quantity > 0),
  unit_price_cents_snapshot int NOT NULL);
ALTER TABLE public.bot_orders
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS total_cents int,
  ADD COLUMN IF NOT EXISTS price_source text CHECK (price_source IN ('catalog','legacy_config','client')),
  ADD COLUMN IF NOT EXISTS consent_basis text,
  ADD COLUMN IF NOT EXISTS retention_until timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bot_orders_idem
  ON public.bot_orders (tenant_id, bot_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 4) Append-only Statushistorie (Szenario 5, Evidence)
CREATE TABLE IF NOT EXISTS public.bot_booking_events (
  id uuid PK, tenant_id uuid NOT NULL,
  subject_type text CHECK (subject_type IN ('appointment','order')),
  subject_id uuid NOT NULL, from_status text, to_status text NOT NULL,
  actor text NOT NULL, policy_decision jsonb, created_at timestamptz DEFAULT now());
-- UPDATE/DELETE-Trigger wie ai_evidence_events / PR #1908

-- 5) Konversation: Handoff/Consent (additiv)
ALTER TABLE public.bot_conversations
  ADD COLUMN IF NOT EXISTS handoff_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS handed_off_to uuid,
  ADD COLUMN IF NOT EXISTS consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_notice_version text;
-- bewusst KEIN CHECK-Austausch für status 'handed_off' / role 'tool' (nur mit Einzelfreigabe)
```
- Verhaltensänderungen mit Einzelfreigabe: (a) `bots`-Schreib-Policies auf `is_tenant_owner_or_admin` einschränken (Policy-Ersatz). (b) B-Policies `bot_conversations_ins/upd/del`, `bot_messages_*` für Clients entfernen (Prüfpfad nur über service_role). (c) Linie B nur per `COMMENT … 'deprecated'` markieren, **nicht droppen**.
- Dateien: eine Migration (Orchestrator-Ownership), `supabase/functions/appointment-book`, `order-intake`, `_shared/bots.ts`, `_shared/restaurant-conversation.ts`, `src/features/bots/**` (Agent 07/04).
- PR: neu; Bezug PRODUCTION_BLOCKERS Blocker 2.
- Risiko: Die Exclusion-Constraint greift nur für Zeilen mit `slot_start`. Bestandsdaten bleiben unberührt, `NOT VALID` gilt für Altzeilen. `btree_gist` muss in Supabase verfügbar sein (Standard-Extension, ABGELEITET).
- Tests: DB-Tests für Doppelbuchung (gleiches Intervall → 23P01), Idempotenz (gleicher Schlüssel → gleiche ID), Cross-Tenant, Preisberechnung serverseitig.

**WP2-06 Idempotenz und Quote atomar**
- Ziel: `Idempotency-Key`-Header bzw. Body-Feld in `appointment-book`/`order-intake`. `consumeUsage` (`_shared/usage.ts:113-150`, Read-then-Insert, TOCTOU) als RPC mit Advisory-Lock und optionalem `idempotency_key` an `usage_events`. Rate-Limit für öffentliche Bot-Endpunkte (`_shared/aiGateway/rateLimit.ts` wiederverwenden).
- Risiko: Mittel (Billing-Pfad). Tests: Concurrency-DB-Test (n parallele Inserts ≤ Limit).

**WP2-07 AI-Call-Logging-Lücke** (#1646 fortführen): `website-maintenance-agent`, `website-operations-agent`, `legal-embed`, `legal-retrieve`, `ai-act-classify` auf `runAiTool`/Gateway umstellen oder `ai_tool_runs`-Zeile ergänzen.

**WP2-08 PR-Hygiene:** #1961 schließen (Duplikat von #1966). #1970 um den Umgang mit verwaisten `governance_evidence` ergänzen (FK fehlt). Reihenfolge: #1869 → #1908 → #1970 → #1907 → #1926 (keine Datei-Überschneidung, daher parallel möglich; Migrationen in Versionsreihenfolge).

## Blocker / offene Fragen an Dominik
1. **Bots-Linie B** (`bot_agents`, `appointments`, `orders`, …): weiter liegen lassen, als deprecated markieren oder später droppen? Der Welle-2-Vorschlag baut auf A und lässt B unberührt.
2. **Lesender Prod-Schema-Diff (#1650)**: Darf ein Agent lesend gegen Prod (`ebljyceifhnlzhjfyxup`) diffen (RLS-Status, Policies, Grants, Migrationsledger)? Ohne das sind B.1/B.4 und der Drift-Stand **BLOCKIERT**.
3. **Notfix-Freigabe** für WP2-01 (`webhook-deliver`/`webhook-dispatcher`/`calculate-seo-metrics` u. a.): als Security-PR vorziehen, trotz Welle-1-„keine Feature-PRs“?
4. **Trial:** 72 h (Epic) statt der heutigen 14 Tage Growth? Welche Plan-Basis (Starter 79 € laut Epic)? Betrifft `create-trial-subscription` und den Resolver.
5. **Rollenmodell Bots:** Dürfen `editor`/`viewer_auditor` Bot-Konfiguration und Preise ändern? Heute: ja.
6. **`tenant_memberships`:** auflösen (Policies auf `memberships` umstellen) oder synchronisieren?
7. **Evidence-Quelle maßgeblich:** Supabase (`ai_evidence_events`/`governance_evidence`) vs. govard-gateway (D1/R2) vs. runtime-core-DB.
8. **#1961** schließen?
