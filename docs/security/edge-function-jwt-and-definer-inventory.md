# Inventar: `verify_jwt = false` und SECURITY DEFINER

Nur Lesen. Kein Deploy, keine Migration, kein `REVOKE`/`GRANT` auf dem
Live-Projekt. Gemessen am 2026-11-13 gegen `ebljyceifhnlzhjfyxup`
(RealSyncDynamicsLive, eu-central-1).

## Prüfpfad

| Quelle | Was |
|---|---|
| `supabase/config.toml` | jede Stanza `[functions.*]` mit `verify_jwt = false` |
| `supabase/functions/**/config.toml` | keine Datei |
| `list_edge_functions` (live) | 200 Funktionen, davon 72 mit `verify_jwt=false`, Status `ACTIVE`. Die 72 Slugs decken sich mit der Config. |
| Funktionsquelltext | Signatur, Cron-Key, `auth.getUser`, `requireAuthAndTenant`, `requireCronKey`, Vault-Bearer |
| `execute_sql` (SELECT) | `pg_proc.prosecdef` und `has_function_privilege` für `anon` / `authenticated` |
| Security-Advisor | Stand `2026-11-13T12:25:38Z` |

`[api].schemas` im Repo: `public`, `storage`, `graphql_public`. `agentos` und
`creatorseal` stehen dort nicht. Ein Grant in diesen Schemas ist über die
Data API heute nicht erreichbar, bleibt aber ein Grant.

## Edge Functions mit `verify_jwt = false`

72 Stück. Klassen: **webhook** (fremdes System, Signatur oder Provider-Secret),
**cron** (pg_cron / Actions, eigener Bearer), **public-by-design** (bewusst
ohne Nutzer-JWT), **SHOULD-REQUIRE-JWT** (Aufrufer ist eine Nutzersitzung,
das Plattform-Gate ist aus).

Ein Handler-Check bleibt nötig, auch wenn das Gate später auf `true` geht:
der Legacy-Anon-Key ist ein Projekt-JWT und passiert `verify_jwt = true`.

### webhook (14)

| Funktion | Beleg |
|---|---|
| `stripe-webhook` | `stripe-signature` / `constructEvent` |
| `shopify-webhooks` | Shopify-HMAC |
| `shopify-callback` | OAuth-Callback, State-Cookie, HMAC in `_shared/shopify-oauth.ts` |
| `agent-change-evidence-webhook` | `X-Hub-Signature`, sonst 401 |
| `workflow-callback` | Bearer-Vergleich, sonst 401 |
| `automation-callback` | Bearer-Vergleich, sonst 401 |
| `governance-ingest` | API-Key `rsd_gov_` |
| `governance-decide` | API-Key `rsd_gov_` |
| `governance-router` | API-Key `rsd_gov_` |
| `security-signal-ingest` | `x-rsd-api-key`, sonst 401 |
| `whatsapp-webhook` | `X-Hub-Signature-256` gegen `WHATSAPP_APP_SECRET` |
| `telegram-webhook` | `X-Telegram-Bot-Api-Secret-Token`, aber nur wenn `TELEGRAM_WEBHOOK_SECRET` gesetzt ist. Fehlt die Variable, läuft der Handler ohne Prüfung (Fail-open). Ob das Secret in Produktion gesetzt ist, wurde nicht gelesen. |
| `bot-voice-webhook` | Twilio-Signatur; JSON-Modus zusätzlich `requireAuthAndTenant` |
| `checkout-website-rebuild` | Stripe-Return. Handler ruft `auth.getUser`. Gate bleibt aus, weil der Return kein Supabase-JWT mitbringt. |

### cron (26)

Interne Aufrufe ohne Nutzer-JWT. Die ersten Zeilen sind pg_cron, die letzten
vier sind Server-zu-Server mit eigenem Bearer.

| Funktion | Beleg |
|---|---|
| `daily-digest`, `audit-drip-cron`, `audit-recheck-weekly`, `governance-deadline-monitor`, `governance-score-calculator`, `automation-trigger-trial-webhook`, `sub-processor-notify` | `requireCronKey` (dedizierter Vault-Key, fail-closed) |
| `audit-monitor-cron`, `email-auth-rescan`, `bot-voice-enforcer` | `timingSafeEqual` gegen Cron-Key, sonst 401 |
| `governance-monitoring-scheduler`, `scheduler-dispatch`, `memory-decay-worker`, `governance-analytics-aggregator` | Bearer-Vergleich, Kommentar „cron only“ |
| `microsoft365-audit-sync` | Vault-Bearer, sonst 401 |
| `agent-os-runner` | Vault `agent_os_runner_token`, sonst 401 |
| `governance-erasure-sweeper` | Vault `governance_erasure_sweeper_token`, sonst 401 |
| `business-metrics-cron` | Vault `business_metrics_shared_secret`, sonst 401 |
| `stripe-meter-sync` | `STRIPE_METER_SHARED_SECRET` / Vault, sonst 403; fehlt das Secret: 500 |
| `website-maintenance-daily-cron` | `Authorization` muss `Bearer <SERVICE_ROLE_KEY>` sein, sonst 401. Der Cron-Bearer ist damit der Service-Role-Key selbst. |
| `provision-voice-agent` | `VOICE_PROVISION_KEY`, `timingSafeEqual` |
| `legal-embed` | `LEGAL_EMBED_SECRET`, sonst 503/401 |
| `welcome-email` | Service-Role-Bearer. Ein Anon-JWT reicht nicht. |
| `rebuild-website` | Service-Role plus `auth.getUser` auf dem Admin-Pfad |
| `market-scanner`, `ai-act-classify` | Bearer gegen Vault (`get_app_secret`), sonst 401 |

### public-by-design (20)

| Funktion | Beleg |
|---|---|
| `health` | öffentlicher Probe. Antwort: Status, Latenz, Version. Provider-Keys werden nur auf Vorhandensein geprüft (`_shared/health.ts`), der Wert steht nicht in der Antwort. |
| `gdpr-audit`, `cookie-scan`, `cookie-scan-deep` | öffentlicher Scan. `cookie-scan` begrenzt per IP im Isolate (fällt bei Cold Start weg). |
| `audit-report-email` | ohne Nutzer-Bearer nur kurz nach `created_at` (`gate.ts`) |
| `audit-report-pdf` | `timingSafeEqual` und optional `auth.getUser` |
| `sales-lead`, `newsletter-subscribe` | öffentliches Formular, Confirm-Token |
| `newsletter-confirm` | UUID-Token, sonst 400/404 |
| `track-pageview` | kein Signatur-Check. Schreibt einen bereinigten Seitenaufruf. |
| `marketing-event` | optional `auth.getUser`, sonst anonymer Event |
| `telemetry-ai-event` | Referenz auf `rsd_gov_` im Code |
| `shopify-install` | OAuth-Start: Shop-Domain, State-Cookie, Redirect. Kein eingehendes HMAC, weil der Redirect der erste Schritt ist. |
| `bot-chat`, `appointment-book`, `order-intake` | öffentliches Widget. Grenze: `(tenant_id, bot_id)`, Feature-Gate, IP-Limit. `tenant_id` kommt vom Client. |
| `enterprise-ai-os-agents-list` | statische Registry, kein DB-Zugriff |
| `enterprise-ai-os-evaluate` | reine Funktion, Policy kommt im Body, kein DB-Zugriff |
| `enterprise-ai-os-feedback` | öffentliches Formular, Insert mit Service Role. Tabelle `enterprise_feedback_reports`: RLS an, **0 Policies**. Der Service-Role-Client umgeht RLS. |
| `enterprise-ai-os-founding-access` | öffentliches Formular, Service Role, Deckel 100 oder `2026-08-02`. Tabelle `enterprise_founders_access`: RLS an, 0 Policies. |

### SHOULD-REQUIRE-JWT (12)

Der Handler erwartet eine Nutzersitzung. `verify_jwt = false` lässt den
Request bis in die Funktion. Wo `auth.getUser` oder `requireAuthAndTenant`
steht, lehnt der Handler einen Anon-Key ab. Wo nichts davon steht, ist das
Gate die einzige fehlende Schicht.

| Funktion | Beleg im Handler | Risiko jetzt |
|---|---|---|
| `browser-action-log` | `requireAuthAndTenant` | Handler dicht. Config sagt selbst: auf `true` stellen, dann die Stanza entfernen. |
| `enterprise-ai-os-discovery-intake` | `requireAuthAndTenant` | Handler dicht. `tenantId` im Body ist nur ein Claim. |
| `governance-webhooks` | `auth.getUser`, sonst 401. Legt beim Anlegen ein HMAC-Secret an und gibt es einmal zurück. | Handler dicht. In `config.toml` unter „External webhooks“ eingeordnet, der Code ist CRUD mit Nutzer-JWT. |
| `governance-keys`, `governance-resources`, `governance-approvals`, `governance-dpias`, `governance-incidents`, `governance-dsr`, `governance-vendors` | `auth.getUser`, sonst 401 | Handler dicht. Gate aus, weil der Drift-Guard den Live-Stand spiegelt. |
| `governance-connectors` | **kein** Check. Service-Role-Client wird erzeugt und im Handler nicht abgefragt; die Antwort spiegelt `action` aus dem Body. | Mittel. Heute kein Lesezugriff. Jede spätere Nutzung von `supabase` in diesem Handler wäre unauthentifiziert und mit Service Role. |
| `enterprise-ai-os-agent-runs-list` | **kein** Check. Client ist der Anon-Key, `tenantId` kommt aus der Query. | Mittel, heute fail-closed. `enterprise_agent_runs` hat RLS; SELECT nur für `authenticated` und `is_tenant_member(tenant_id)`. Ein Anon-Key liefert keine Zeilen. Ein Wechsel auf Service Role würde die Findings auslesen. |

Vorschlag, ohne ihn auszuführen: bei den zehn Funktionen mit Handler-Check
`verify_jwt = true` deployen und die `false`-Stanza entfernen. `governance-connectors`
und `enterprise-ai-os-agent-runs-list` vorher mit `requireAuthAndTenant`
schließen, den Anon-Key in der Run-Liste nicht als Abfrage-Client benutzen.

## SECURITY DEFINER, ausführbar für `anon` oder `authenticated`

74 Funktionen. `search_path` ist bei allen gesetzt.

| Schema | Anzahl | davon `anon` |
|---|---|---|
| `public` | 65 | 29 |
| `agentos` | 5 | 5 |
| `creatorseal` | 4 | 4 |

Die Data API exponiert `agentos` und `creatorseal` laut Repo-Config nicht.
Die Grants sind trotzdem da.

### Hoch

Erreichbar über die Data API (`public`) oder ein Schreib-/Token-Orakel,
sobald das Schema exponiert wird.

| Funktion | Wer | Warum | Vorschlag |
|---|---|---|---|
| `public.verify_api_key(p_full_key text)` | nur `anon` | Liefert bei passendem Key `tenant_id`, `scopes`, `rate_limit_requests`. Advisor `anon_security_definer_function_executable`. | `REVOKE` von `anon` und `PUBLIC`. Nur `service_role`. Nicht live ausgeführt. |
| `public.get_tenant_branding_by_domain(p_domain text)` | nur `anon` | Liefert `tenant_id`, Support-Mail, Telefon, `custom_css`. Advisor dieselbe Lint. | Öffentliche Felder (Name, Farben, Logo) behalten, Kontakt und `tenant_id` streichen oder den Aufruf auf `service_role` begrenzen. |
| `creatorseal.sync_stripe_subscription(...)` | `anon` und `authenticated` | Schreibt Abo-Felder für ein übergebenes `p_user_id`. Kein `auth.uid()`. | `REVOKE` von `PUBLIC`, `anon`, `authenticated`. Nur der Stripe-Webhook mit `service_role`. |
| `creatorseal.check_and_increment_quota(p_user_id uuid)` | beide | Erhöht das Kontingent eines beliebigen Users. | dasselbe `REVOKE` |
| `creatorseal.get_current_usage(p_user_id uuid)` | beide | Liest Verbrauch eines beliebigen Users. | dasselbe `REVOKE` |
| `agentos.resolve_api_token(p_raw_token text)` | beide | Liefert `tenant_id`, `user_id`, `user_email`, `user_role`, `token_id`. | `REVOKE` von `anon`/`authenticated`. Aufrufer bleibt die Server-Funktion. |
| `agentos.custom_access_token_hook(event jsonb)` | beide | Auth-Hook ohne Prüfung des Aufrufers. | `REVOKE` von `anon`/`authenticated`. Execute nur für `supabase_auth_admin`. |
| `agentos.touch_api_token(p_token_id uuid, p_ip inet)` | beide | Schreibt Last-Use für eine Token-Id. | `REVOKE` von `anon`/`authenticated`. |

`public.verify_c2pa_assertion` steht im selben Advisor-Lint (anon, kein
`auth.uid()`). Sie vergleicht nur einen Hash und liest keine Mandantendaten.
Risiko niedrig; `REVOKE` von `anon` ist trotzdem sauberer, wenn nur der
Server sie ruft.

### Mittel

`public.can_set_membership_role(p_tenant_id, p_user_id, p_new_role)` — nur
`authenticated`, kein `auth.uid()` im Körper. Sie schreibt nicht. Sie
antwortet, ob die neue Rolle `owner` ist oder ob ein anderer Owner existiert.
Jedes eingeloggte Konto kann das für fremde Mandanten fragen. Vorschlag:
Mitgliedschaft prüfen oder Execute auf die RLS-interne Nutzung begrenzen.

Diese `anon`-Funktionen prüfen `is_tenant_member` oder `auth.uid()` und
fail-closed. Der `anon`-Grant ist überflüssig, weil `anon` kein Mitglied ist:

`ai_evidence_verify_chain`, `asset_lifecycle_state`,
`connector_enforcement_summary`, `m365_reaction_summary`,
`pdp_shadow_readiness`, `update_onboarding_progress` (wirft `unauthenticated`).

Vorschlag: `REVOKE EXECUTE FROM anon`. `authenticated` behält den Grant,
die Prüfung im Körper bleibt.

### Niedrig, bewusst oder nur Trigger

RLS-Helfer, von Policies gebraucht, Körper prüft `auth.uid()`:
`is_tenant_member`, `is_tenant_admin`, `is_tenant_owner_or_admin`,
`has_tenant_membership`, `is_platform_operator`. `is_tenant_owner` und
`is_tenant_writer` sind nur `authenticated`.

Öffentliche Lese-Endpunkte mit engem Ergebnis:
`audit_share_get` (nur `is_shareable`), `affiliate_validate` (Boolean),
`platform_stats` (Aggregate).

12 Trigger-Funktionen in `public` sind für `anon` ausführbar und liefern
`trigger` (unter anderem `ai_evidence_block_delete`,
`audit_evidence_block_modification`, `platform_operators_sync_profile_flag`).
PostgREST ruft `RETURNS trigger` nicht als RPC. Der Grant ist trotzdem
breiter als nötig. Vorschlag: `REVOKE` von `anon` und `authenticated`;
der Trigger läuft als Owner. Nicht live ausgeführt.
`agentos.handle_new_auth_user` und `creatorseal.handle_new_auth_user`
sind dieselbe Lage.

`agentos.accept_tenant_invite(p_token text)` prüft den Token und
`auth.uid()`. Niedrig, solange der Token unerratbar ist. Schema nicht in
der Data API.

### Nur `authenticated`, mit Prüfung im Körper (36 in `public`)

Alle außer `can_set_membership_role` enthalten `auth.uid()`,
`is_tenant_member`, `is_platform_operator`, `is_tenant_admin` oder
`is_tenant_owner`. Dazu gehören die Admin-RPCs (`admin_customers_list`,
`admin_erase_lead_data`, `admin_funnel_kpis`, `admin_funnel_leads`,
`admin_system_health`), Analytics, Governance-KPIs, `tenant_entitlements`,
`set_finding_status`, `claim_gdpr_audit`, `resolve_agent_decision`.
Der Advisor listet sie als
`authenticated_security_definer_function_executable`. Das ist der normale
Supabase-Hinweis auf DEFINER plus Grant, kein Beleg, dass die Prüfung fehlt.
Ein Grant ohne die genannte Prüfung wäre der Befund oben bei
`can_set_membership_role`.

## Nicht geändert

Keine Zeile unter `supabase/migrations/`. Kein `REVOKE`, kein `GRANT`,
kein Function-Deploy. Die Vorschläge brauchen eine eigene Migration und
eine Einzel-Freigabe; ein Bulk-`REVOKE` hat am 2026-08-23 die RLS-Helfer
gebrochen (`scripts/check-function-acl-drift.mjs`).
