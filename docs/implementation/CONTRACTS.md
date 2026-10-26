# CONTRACTS – Schnittstellen, Abhängigkeiten und Übergaben (Epic #1972)

Stand: 26.10.2026, Agent 00. Codebasis aller Belege: `b4f8a2ffc5e46aebfbd9d7264ac84a00756ba523`.
Quellen sind die gesicherten Welle-1-Berichte unter `docs/implementation/reports/` (Commit `9563c3d`).

- **Teil A** ist Ist-Stand und aus dem Code verifiziert.
- **Teile B bis D** sind Vorschläge der Agenten. Verbindlich werden sie erst mit Dominiks Freigabe für Welle 2.
- **Regel aus #1972:** Je Datei und je API-Vertrag gibt es genau einen Owner. Shared Types, Migrationen und Router-Dateien ändert nur der Orchestrator, nach abgestimmter Schnittstelle.

## A. Bestehende API-Verträge (Ist)

Quelle: `agent-02-backend.md`, C.3 (aus Code-Köpfen verifiziert). Lücken jeweils mit eigener Quelle.
Fehlerformat aller Edge Functions: `{ ok:false, error:{ code, message, details? } }` (`supabase/functions/_shared/gateway.ts:49-59`; `agent-02-backend.md`, C.1).

| Endpoint | Auth | Request | Response (ok) | Fehler / Idempotenz | Bekannte Lücke (Quelle) |
|---|---|---|---|---|---|
| `POST bot-chat` | öffentlich über tenant_id+bot_id, `verify_jwt=false` | `{tenant_id, bot_id, message, conversation_ref?, contact_label?}` | `{ok, conversation_id\|null, reply, run_id\|null, policy_blocked?}` (`bot-chat/index.ts:98-104,161-166`) | 402 QUOTA_EXCEEDED, 403, 404, 503 RESIDENCY_UNAVAILABLE; Konversation idempotent über (bot_id, external_ref) | kein Rate-Limit, keine Origin-Allowlist (`agent-03-governance.md` D.5); PDP default `shadow` (`agent-03-governance.md` A.3) |
| `POST appointment-book` | öffentlich | `{tenant_id, bot_id, customer_name, contact?, service?, requested_at?, notes?, conversation_ref?}` | `{ok, appointment_id, status}` | 403 CAPABILITY_DISABLED/ENTITLEMENT_MISSING (`bots.appointments`) | nicht idempotent, keine Slots, kein Doppelbuchungsschutz (`agent-11-qa.md` D.4); ohne PDP (`agent-03-governance.md` A.4) |
| `POST order-intake` | öffentlich | `{tenant_id, bot_id, customer_name, contact?, items, total_amount?, currency?, fulfillment?, delivery_address?, payment_method?, confirmed?, notes?, conversation_ref?}` | `{ok, order_id, status, …}` | Gate `bots.orders` | Legacy-Pfad übernimmt Client-Preise (`order-intake/index.ts:22-30,145-146`; `agent-11-qa.md` D.4); nicht idempotent |
| `POST bot-voice-webhook` | Twilio-Signatur bzw. Mitglied | Twilio-Form oder `{tenant_id, bot_id, message, conversation_ref?, event?, duration_seconds?}` | TwiML bzw. `{ok, reply, conversation_id}` | CallSid = conversation_ref | Minutenbuchung ohne Replay-Schutz (`index.ts:215-218`; `agent-11-qa.md` D.2); kein KI-Hinweis (`index.ts:238,283`; `agent-03-governance.md` E) |
| `GET/POST whatsapp-webhook` | Meta-Verify / X-Hub-Signature-256 | Meta-Payload | immer 200 | Dedupe über `wa_message_id` (ohne Unique) | fail-open ohne Secret (`index.ts:64`); Persistenz vor PEP (`:160,184,194` vor `:206`; `agent-03-governance.md` A.4) |
| `POST telegram-webhook` | Secret-Token-Header | Telegram-Update | – | – | fail-open ohne Secret, kein Vergleich in konstanter Zeit (`index.ts:372,374`; `agent-11-qa.md` D.2) |
| `POST stripe-webhook` | Stripe-Signatur | Stripe-Event | `{received:true[, duplicate:true]}` | idempotent über `webhook_events.id`, Insert-first (`index.ts:97-115`) | nicht retry-sicher bei Abbruch; kein `async_payment_*`; Erstattung entzieht keine Rechte (`agent-08-billing.md` Kurzfazit 6, F #10) |
| `POST stripe-checkout` | User-JWT | `{tenant_id, plan_key, return_url?}` | Checkout-URL | Enterprise `ENTERPRISE_CONTRACT_ONLY` (`index.ts:43,137-141`) | – |
| `POST create-trial-subscription` | User-JWT | `{tenantId?, planKey:'growth'}` | Trial-Stand | 400 TRIAL_NOT_AVAILABLE; Upsert `onConflict tenant_id` | 14 Tage fest; eine Testphase je Mandant, nicht je Person (`agent-08-billing.md` F #3) |
| RPC `tenant_entitlements(p_tenant_id)` | authenticated | – | `[{key, value…}]` | trialing nur bis trial_end | Starter ohne `ai.tool.bot_reply` (`shared/pricing.ts:657` vs. `:1977ff`; `agent-08-billing.md` Kurzfazit 3) |
| `POST ai-invoke` | User-JWT | `{tenant_id, tool_key, input, metadata?}` | Run-Ergebnis | 503 RESIDENCY_UNAVAILABLE, Kontingent | – |
| `POST tenant-invite` | User-JWT | `{op:'create'\|'list'\|'revoke'\|'accept', …}` | `{ok,…}` | – | Seat-Limit nicht durchgesetzt; behebt #1907 |
| `POST gdpr-delete` | User-JWT (AAL2 nur beobachtet) | `{confirm:'DELETE-MY-ACCOUNT'}` | `{…cascade_deleted, lead_data, erasure_receipt_id}` | 409 SOLE_OWNER | Defekt bei alleinigen Ownern; behebt #1970 (`agent-01-audit.md` A1) |
| `GET gdpr-export` | User-JWT | – | JSON-Download | – | – |
| `POST provision-tenant` | User-JWT (Owner/Admin) oder service_role | `{tenant_id?, trigger?, domain?}` | Stand, idempotent | – | – |
| `POST audit-claim`, `audit-report-pdf` | JWT bzw. öffentlich | `{audit_id, tenant_id?}` | – | – | IDOR auf main (`audit-report-pdf/index.ts:97-111`); behebt #1869 (`agent-02-backend.md` B.5) |
| RPC `consumeUsage` (`_shared/usage.ts:113-160`) | intern | – | – | – | Check-then-Insert, nicht atomar; fail-open bei fehlendem Key (`agent-11-qa.md` D.4; `agent-08-billing.md` F #6) |
| PDP v2 `decide()` / `enforceBotMessage()` (`_shared/pdp/*`) | intern | `DecisionRequest` v1 (`pdp/core.ts`) | `DecisionResult` v1 | Modus je Kanal per ENV, Default `shadow` | (`agent-03-governance.md` A.1–A.3) |

Vertragsbrüche ohne offenen PR (Security, Quelle `agent-02-backend.md` B.5): `webhook-deliver`, `webhook-dispatcher` und `calculate-seo-metrics` (hoch); `nis2-deadline-calculator`, `dashboard-digest-generate` (mittel bis hoch). Sie übernehmen `tenant_id` ungeprüft aus dem Body und laufen mit Service-Role.

## B. Vorschlag: Bot-Aktions-Vertrag `bot-action/v1`

Quelle: `agent-03-governance.md`, „Vorschläge für Welle 2 / Vertrag für Bot-Aktionen“. Owner: Agent 03. Nutzer: Agenten 04, 06, 07.

- Erweitert PDP v2 (`DecisionRequest`/`DecisionResult` v1) und verallgemeinert das Voice-Modell (`voice_tool_requests`/`voice_executions`/`voice_evidence`, Migration `20260928130000`). **Keine neue Engine.**
- Eintrittspunkte: `decideBotAction(admin, BotActionRequest) → BotActionDecision` und `recordBotActionResult(admin, requestId, result)`.
- `BotActionRequest` enthält:
  - `tenant_id`: nie aus dem Body, sondern aus Bot- oder Number-Binding
  - `bot_id`, `channel` (bot-chat, bot-whatsapp, bot-voice), `conversation_id`, `action`
  - `argument_keys`: nur Namen
  - `signals`: nie Inhalte
  - `data_classification`
  - `risk`: aus der statischen Registry, nicht vom LLM
  - `amount_minor`: serverseitig berechnet
  - `idempotency_key`, `disclosure_shown` (Art. 50), `consent_purposes`
- `BotActionDecision` enthält:
  - `verdict`: ALLOW, DENY, REQUIRE_CONFIRMATION oder REQUIRE_APPROVAL
  - `reasons_de`, `safe_reply`, `matched_policy_ids`, `snapshot_version`, `approval_gate_id`
  - `mode`: off, shadow oder enforce
  - `evidence_id`: immer gesetzt
- Ausführung nur bei ALLOW oder bestätigtem REQUIRE_CONFIRMATION, **per DB-Trigger erzwungen**.
- Evidence in `ai_evidence_events` (append-only), nur Metadaten. Modus pro Mandant. Aktionen mit Außenwirkung sind fail-closed.
- Statische Registry: `reply` = ALLOW; `order.create`/`appointment.create` = REQUIRE_CONFIRMATION; `payment.link` = REQUIRE_APPROVAL; `transcript.export` = DENY.
- Neue additive Tabellen `bot_action_requests`/`bot_action_executions`. Die Voice-Tabellen bleiben unverändert.
- Offen: Ist PDP v2 oder GOVARD kanonisch (`agent-03-governance.md`, Blocker 3)?

## C. Vorschlag: Contract-Tests vor der Implementierung

Quelle: `agent-11-qa.md`, „Contract-Test-Liste“. Owner: Agent 11. Die Tests laufen zuerst rot.

| ID | Vertrag | Erwartung heute |
|---|---|---|
| CT-WH-1 | Webhooks fail-closed: fehlendes Secret ⇒ 503, kein DB-Write, kein Provider-Call | rot (WhatsApp, Telegram) |
| CT-WH-2 | Signaturprüfung gegen eine unabhängige Referenz-HMAC, konstante Zeit | rot (Telegram), fehlt (WhatsApp) |
| CT-WH-3 | Doppelzustellung derselben Event-ID ⇒ genau eine Wirkung | rot (WhatsApp, Voice) |
| CT-WH-4 | Stripe-Handler mit signierter Test-Nutzlast, korrekte Starter-Entitlements, Retry möglich | fehlt |
| CT-Q-1 | `consumeUsage` atomar bei parallelen Aufrufen | rot |
| CT-T-1 | 72-h-Trial aus der SSoT, nach Ablauf `TRIAL_EXPIRED` | fehlt (Produktentscheidung offen) |
| CT-RLS-1 | Cross-Tenant-Zugriff auf alle Tabellen mit `tenant_id`, inkl. `bot_*` = 0 Zeilen | fehlt für `bot_*` |
| CT-RLS-2 | viewer darf `bots` nicht ändern | rot |
| CT-BK-1 | überlappende Termine ⇒ zweiter abgelehnt | rot |
| CT-BK-2 | „gebucht“ nur bei Kalender-ACK | rot |
| CT-ORD-1 | Client-Preise in allen Pfaden abgelehnt, Idempotency-Key | rot (Legacy-Pfad) |
| CT-PI-1 | Prompt-Marker-Spoofing neutralisiert | rot |
| CT-PEP-1 | PEP vor Quota und vor Persistenz in allen Bot-Eingängen | rot (WhatsApp, Voice) |
| CT-CI-1 | Ratchet-Tests mit Positivprobe | rot (Fabrication-Check) |

## D. Ownership und Übergaben zwischen den Agenten (Vorschlag)

### D.1 Datei-Ownership

Grundlage: `agent-03-governance.md` (Arbeitspakete, Hotspot-Hinweis), `agent-11-qa.md` (Arbeitspakete), `agent-12-devops.md` F, `agent-01-audit.md` C.

| Bereich | Owner | Regel |
|---|---|---|
| `supabase/migrations/**` | Agent 00, nach Einzel-Freigabe | additiv, einzeln, nie parallel. **Ein Merge löst sofort einen Prod-Deploy über `deploy.yml` aus** (`agent-12-devops.md` R1) |
| `supabase/functions/_shared/pdp/*`, Bot-Webhooks | Agent 03 | nur seriell; 04, 06 und 07 nicht parallel (`agent-03-governance.md`, Reihenfolge) |
| `src/App.tsx`, `src/config/seo.ts`, `shared/pricing.ts` | Agent 00 | Hotspots (`agent-01-audit.md` C); `shared/pricing.ts` braucht eine Preis-Einzel-Freigabe |
| `appointment-book`, `order-intake` | Agent 07 | über Vertrag B |
| `whatsapp-webhook`, `telegram-webhook`, Web-Widget (`public/sdk/`) | Agent 06 | über Vertrag B; erst nach Phase-0-Punkt 0.9 (Secret-Belegung) |
| `src/features/bots/**`, `bot-chat` | Agent 04 | über Vertrag B |
| `create-trial-subscription`, `_shared/usage.ts`, `stripe-*` | Agent 08 | Stripe nur Testmodus, Staging nötig (`agent-08-billing.md` Kurzfazit 7) |
| `test/**` (Contract-Tests) | Agent 11 | Tests vor der Implementierung |
| `.github/**`, `scripts/**`, `package*.json`, `wrangler*.toml`, `deploy/**`, `workers/**`, `functions/**` | niemand ohne Einzel-Freigabe | bei Same-Repo-PRs mit Prod-Secrets wirksam (`agent-12-devops.md` R2, F) |

### D.2 Übergaben

| Von → An | Übergabe | Voraussetzung | Quelle |
|---|---|---|---|
| 12 → alle | Freigabefähiger Rahmen: Branches `claude/*`/`agent/*`; Draft-PRs nur mit `docs/**` oder `src/**`; Tabu-Pfade wie in D.1 | – | `agent-12-devops.md` F |
| 12 → 06 | Secret-Belegung `WHATSAPP_APP_SECRET`, `TELEGRAM_WEBHOOK_SECRET` vor dem Fail-closed-Fix | Phase 0, Punkt 0.9 | `agent-11-qa.md` QA-2; `agent-03-governance.md` Blocker 1 |
| 03 → 04/06/07 | Vertrag `bot-action/v1` (Teil B) | Freigabe Welle 2; Entscheidung zur kanonischen Engine | `agent-03-governance.md` Welle 2 |
| 03 → 00 | #1908 (Evidence append-only) als Fundament vor allen Evidence-Konsumenten | Einzel-Freigabe Migration | `agent-03-governance.md` G1 |
| 11 → 02/04/06/07/08 | Contract-Tests (Teil C), zuerst rot | – | `agent-11-qa.md` Welle 2 |
| 02 → 07 | Additive Schema-Erweiterung auf Linie A (`bot_appointments` mit EXCLUDE-Constraint, Idempotenz); Linie B unberührt | Einzel-Freigabe Migration | `agent-02-backend.md` A.3, Blocker 1 |
| 02 → 03/11 | Membership-Quelle: `memberships` ist kanonisch, `tenant_memberships` steuert weiter 17 Policies | Entscheidung „auflösen oder synchronisieren“ | `agent-02-backend.md` B.4, Blocker 6 |
| 08 → 00 | Preis-, Trial- und Kostendeckel-Entscheidungen als Einzel-Freigaben | Dominik | `agent-08-billing.md` Blocker |
| 01 → 00 | Merge-Reihenfolge der offenen PRs und Überlappungsliste | Einzel-Freigaben laut Triage-Policy | `agent-01-audit.md` B |

### D.3 Abhängigkeiten zu offenen PRs

Quelle: `agent-01-audit.md` B (Stand 23.10.2026). Merge-Reihenfolge laut Agent 01; jeder Schritt braucht Dominiks Freigabe:
- **Security:** #1869 → #1926 → #1961 schließen (Duplikat von #1966, `4df1fde`) → #1970 (Migration `20261023120000`) → #1908 (Migration `20261023223000`).
- **Fixes:** #1963 → #1888 → #1887 oder #1918 (nach Entscheidung zum Ziel von „Audit starten“).
- **Legal/Pricing/Landing:** #1969, möglichst aufgeteilt.
- **Features:** #1891 → #1907 → #1967 (Migration `20261022090000`; die Zeitstempel-Reihenfolge ist zu klären).

Gemeinsam geänderte Dateien:

| Datei | PRs |
|---|---|
| `CustomerStartPanel.tsx` | #1918, #1963, #1967 |
| `startPanelModel.ts` | #1918, #1963 |
| `src/i18n/handoffApp.ts` | #1918, #1963 |
| `BrowserTopBar.tsx`, `WebsiteGovernanceView.tsx` | #1887, #1918 |
| `AuditLanding.tsx` | #1888, #1969 |
| `App.tsx` | #1967, #1969 |
| `CommandCenterDashboard.tsx` | #1891, #1967 |
