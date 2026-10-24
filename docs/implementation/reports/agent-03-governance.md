# Agent 03 – Governance / Policies / Freigaben / Evidence / DSGVO / AI-Risiko

Stand: 23.10.2026, Repo `/home/user/RealSyncDynamics.AI`, HEAD `b4f8a2f` (== origin/main). Strikt lesend.
GitHub-Lesezugriffe: PR #1908, #1961, #1970, #1926, #1869 (get + get_files), Issue #1865 (get).
Statusmarker: **VERIFIZIERT** (Code/PR gelesen) · **ABGELEITET** (Schluss aus Belegen, nicht ausgeführt) · **BLOCKIERT**.
Keine Tests ausgeführt (node_modules fehlt, `npm install` gesperrt) – alle Aussagen sind statische Code-Lektüre.

---

## Kurzfazit

1. Es gibt **mindestens sieben Policy-Engines** mit unterschiedlichem Datenmodell. Die zentrale Supabase-Instanz (PDP v2, `_shared/pdp/*`) ist gut gebaut (strukturierte Fakten statt Prompt, Approval-Fingerprint), läuft aber **auf allen Kanälen per Default im `shadow`-Modus** – sie erzwingt im Auslieferungszustand nichts. VERIFIZIERT.
2. Akzeptanzszenario 5 („Policy denies/gates risky bot actions before execution; evidence logged“) ist **teilweise** erfüllt: Für Bot-*Antworten* existiert ein PEP vor dem Modellaufruf. Für riskante Bot-*Aktionen* (Bestellung, Termin) gibt es **keinen PDP-Aufruf**. Nur die Voice-Runtime in `apps/agent-runtime` hat ein vollständiges Entscheidung→Ausführung→Evidence-Modell mit DB-Triggern; sie ist aber vom Live-Twilio-Pfad getrennt. Die Evidence für Bot-Sperren ist je Kanal anders bzw. fehlt (bot-chat: keine). VERIFIZIERT.
3. Evidence ist auf ≥10 Speicher verteilt. Nur `ai_evidence_events`, `evidence_anchors`, `evidence_snapshots` und `voice_evidence` sind per Trigger append-only. `governance_evidence` ist es auf main nicht. Das behebt #1908. Daneben schreibt `governance-approvals` direkt mit `content_hash = null` an der Kette vorbei. VERIFIZIERT.
4. Die CLAUDE.md-Aussage „Jeder [AI-]Call wird geloggt“ ist **falsch**. Mindestens 6 Edge Functions rufen Anthropic oder OpenAI direkt per `fetch` auf, ohne `ai_tool_runs`, ohne Residency-Prüfung und ohne PDP. VERIFIZIERT.
5. #1961 ist **vollständig durch #1966 (Commit `4df1fde`) auf main ersetzt**: identische 9 Dateien, +267/−69. Er kann ohne Funktionsverlust geschlossen werden (Entscheidung: Dominik). VERIFIZIERT.
6. EU-AI-Act Art. 50: Das Produkt prüft *fremde* Websites auf fehlende KI-Kennzeichnung (`src/rules/ai-act.json` `AI_ACT_LIMITED_RISK_CHATBOT`). Die *eigenen* Bots (Chat, WhatsApp, Twilio-Voice) erzwingen keinen KI-Hinweis. VERIFIZIERT.

---

## A) Policy-Engine(s)

### A.1 Inventar (VERIFIZIERT)

| # | Engine | Ort | Datenquelle | Wird genutzt von | Modus/Default |
|---|---|---|---|---|---|
| 1 | Legacy AI-Policy-Engine | `supabase/functions/_shared/policy-engine.ts` (279 Z.) | `ai_policies` | `telemetry-ai-event/index.ts:29` | Nachgelagert: wertet Telemetrie aus, nicht vor der Ausführung |
| 2 | Legacy Governance-Policy-Engine | `supabase/functions/_shared/policyEngine.ts` (187 Z.) | `governance_policies` | `governance-ingest/index.ts:45`, `_shared/tenant-boot.ts:10` | Nachgelagert (Ingest) |
| 3 | **PDP v2** (Kern + Glue + PEP-Adapter) | `_shared/pdp/core.ts`, `decide.ts`, `botmessage.ts`, `toolcall.ts`, `classify.ts`, `m365event.ts` | beide Tabellen kompiliert, `policy_snapshots`, `pdp_approval_gates`, `pdp_shadow_log` | ai-gateway, governance-router, bot-chat, whatsapp-webhook, bot-voice-webhook, siteos publish-gate, governance-decide (HTTP), telemetry/ingest (shadow-Vergleich), m365 | **shadow** je Kanal per ENV (siehe A.3) |
| 4 | Agent-Runtime Registry-Engine | `apps/agent-runtime/src/policy-engine.ts` (43 Z.) | statische Agent-Registry (`agent-registry.ts`) | `/run-agent` in `apps/agent-runtime/src/gateway.ts:191` | aktiv (Allowlist Tool je Agent) |
| 5 | Voice-Tool-Policy | `apps/agent-runtime/src/voice-policy.ts` (240 Z.), `voice-tools.ts` | Kill-Switch, Rate, Consent, PII, Risk | `/voice-tool` (`gateway.ts:334 ff.`) | aktiv |
| 6 | GOVARD Gateway (Cloudflare Worker + D1 + Durable Object) | `workers/govard-gateway/src/policy/engine.ts` | eigene D1-DB (`migrations/0001_init.sql`), eigenes `org`-Modell | `/api/command` | deny-by-default (`engine.ts:18,169`), eigener Deploy-Workflow `.github/workflows/deploy-govard-gateway.yml` |
| 7 | Client-Engine „RealSync OS“ | `src/core/realsync-os/policyEngine.ts` (54 Z.) | In-Memory `AgentPolicy` | `src/core/realsync-os/commandCenter.ts` | Nur Browser, keine Durchsetzung |
| 8 | SiteOS Publish Gate | `packages/siteos-core/src/publish/gate.ts` + `supabase/functions/siteos/handlers/publish-gate.ts` | Blueprint-Befunde + PDP | SiteOS | serverseitig; PDP-Anteil `SITEOS_PUBLISH_PDP` Default `shadow` (`publish-gate.ts:745`) |
| (9) | Python-PDP-Client | `platform/governance_backend/app/services/pdp_client.py` | – | platform/ (nicht weiter geprüft) | ABGELEITET: Legacy |
| (10) | Mock-Agent | `src/lib/enterprise-ai-os/agents/policy-enforcement-agent.ts` | mock-data | UI | ABGELEITET: Demo |

**Konkurrenz:** Ja. Die Engines 1 und 2 haben bewusst unterschiedliche Match-Semantik. Der PDP portiert beide 1:1 und vereinheitlicht sie nicht (`pdp/core.ts:20-26`, „Befund K1“). Die Engines 4 und 5 entscheiden lokal vor dem PDP und sind „erste Schranke“ (`bot-voice-webhook/index.ts:100-106`). Engine 6 ist ein vollständig separater Stack mit eigenem Mandantenmodell (`org`) und eigener Evidence-Kette. Er hat keine Verbindung zu `tenants`, RLS oder `ai_evidence_events`. VERIFIZIERT (README `workers/govard-gateway/README.md:30-90`).

### A.2 Aufrufketten (VERIFIZIERT)

**(a) Website-Bot-Nachricht (`bot-chat`, öffentlich, `verify_jwt=false`, `supabase/config.toml:438-439`)**
```
POST /functions/v1/bot-chat
 → resolveBot(tenant_id, bot_id aus Body)                    bot-chat/index.ts:64
 → gateFeature('bots.enabled')                               :68
 → findExistingConversationId + loadRecentHistory (lesend)   :76-82
 → enforceBotMessage(admin,{channel:'bot-chat',…})           :86  ── PEP
     → detectSignals(message) lokal; Text verlässt Prozess nicht   pdp/botmessage.ts:199 ff.
     → mode = BOT_PDP_ENFORCEMENT ?? 'shadow'                pdp/botmessage.ts:65
     → decide(): enrichPrincipal → enrichClassification → loadSnapshot → evaluateSnapshot → resolveApproval → persistSnapshot   pdp/decide.ts:383-395
     → shadow: logShadowComparison → pdp_shadow_log, allowed=true
     → enforce: block|require_approval ⇒ allowed=false       pdp/botmessage.ts:292
 → if !allowed: safe_reply, KEINE Persistenz, KEIN Evidence-Eintrag   bot-chat/index.ts:95-104
 → consumeUsage → upsertConversation → insertMessage(user)
 → runRestaurantConversationTurn (ggf. bot_orders INSERT, ohne PDP)
 → runAiTool('bot_reply') → ai_tool_runs                     _shared/ai.ts
```
**(b) Agent-Tool-Call (`apps/agent-runtime`)**
```
POST /run-agent (Bearer, zod-Envelope; input: z.record(z.unknown()))   gateway.ts:148-158
 → Voice-Agent wird abgewiesen (Kanal-Guard)                           :171-188
 → evaluate(): Agent existiert? Tool in Allowlist? restricted taskType?   policy-engine.ts
 → askPdp(sanitizeToolCall(...)) → HTTP governance-decide (nur Argument-NAMEN)   gateway.ts:237-249, pdp-client.ts
     → governance-decide: Key→tenant_id; toolCallToDecisionRequest; decide(); bei ≠allow/log_only INSERT ai_evidence_events   governance-decide/index.ts:60-145
 → applyVerdict (AGENT_PDP_ENFORCEMENT ?? 'shadow', pdp-client.ts:33)
 → emitAuditEvent → NUR stdout                                          audit-log.ts:45
 → Antwort 'accepted' — /run-agent FÜHRT NICHTS AUS                     gateway.ts:280-298
```
**(c) Voice-Tool (`/voice-tool`)** → `evaluateVoiceToolRequest` (Kill → Rate → Tenant → Permission → PII → Consent → Risk) → PDP → `voice_tool_requests`/`voice_executions`/`voice_evidence`. DB-Trigger erzwingen: Entscheidung ist einmalig und stammt nur von `policy-engine`; keine Ausführung ohne ALLOW oder bestätigtes REQUIRE_CONFIRMATION; Evidence ist append-only mit Hash-Kette (`supabase/migrations/20260928130000_voice_runtime_foundation.sql:252-320`). Echter Executor nur `schedule_appointment` → `bot_appointments` (`apps/agent-runtime/src/voice/tool-executors.ts`). VERIFIZIERT.

### A.3 Erzwingung serverseitig vs. Client – Ist-Zustand (VERIFIZIERT)

| Durchsetzungspunkt | Ort | Default | Verhalten bei PDP-Ausfall | Evidence bei Sperre |
|---|---|---|---|---|
| ai-gateway | `ai-gateway/index.ts:67-69, 94-130` | `AI_GATEWAY_ENFORCEMENT=shadow` | **fail open** (`:129`); `tenant_id: null` → nur globale Policies (`:102`) | nur `console.log` |
| Bot-Kanäle | `pdp/botmessage.ts:65,86` | `BOT_PDP_ENFORCEMENT=shadow` | in enforce: fail closed (`BOT_PDP_FAILURE_MODE=block`) | bot-chat: **keine**; WhatsApp: `audit()` + bot_messages-Metadaten; Voice: nur bot_messages-Metadaten |
| SiteOS Publish | `siteos/handlers/publish-gate.ts:745` | `SITEOS_PUBLISH_PDP=shadow` | enforce: fail closed | Custody-Kette / `audit()` |
| Agent-Runtime | `apps/agent-runtime/src/pdp-client.ts:33` | `AGENT_PDP_ENFORCEMENT=shadow` | `AGENT_PDP_FAILURE_MODE=block` | stdout |
| governance-decide (HTTP) | `governance-decide/index.ts` | entscheidet; Durchsetzung beim Aufrufer | 500 ENGINE_UNAVAILABLE | **`ai_evidence_events`** (`:120-140`) |
| Client RealSync OS | `src/core/realsync-os/policyEngine.ts` | – | – | keine; ohne Durchsetzungswirkung |

ABGELEITET: Ob in Produktion `*_ENFORCEMENT=enforce` gesetzt ist, lässt sich nur mit Secret- bzw. ENV-Zugriff prüfen. Im Repo ist überall `shadow` der Default. **BLOCKIERT** für die Live-Prüfung (Supabase-Calls verboten).

### A.4 Akzeptanzszenario 5 – was existiert, was fehlt

**Existiert (VERIFIZIERT):**
- Ein gemeinsamer Bot-PEP für drei Kanäle (`enforceBotMessage`). Er sitzt vor dem Modell, gibt keinen Prompt-Text an den PDP und antwortet neutral mit `safe_reply`.
- PDP-Approval-Gates mit Fingerprint-Bindung (`pdp_approval_gates`, `decide.ts:215-300`).
- governance-decide schreibt an der Entscheidungsstelle in `ai_evidence_events`.
- Voice-Runtime-Datenmodell mit fail-closed-Triggern (Goldstandard im Repo).
- browser-execute: Freigabe einmalig verwendbar und an den Fingerprint gebunden (`browser-execute/index.ts:44-95`); Evidence über `append_governance_evidence`.
- GOVARD: deny-by-default mit `evaluation_hash`-gebundener Freigabe (separater Stack).

**Fehlt (VERIFIZIERT, sofern nicht anders markiert):**
1. **Durchsetzung im Default:** Alle PEPs stehen auf `shadow`. Ohne ENV-Umstellung wird nichts gesperrt.
2. **Riskante Bot-Aktionen ohne PDP:**
   - `bot_orders` INSERT in `_shared/restaurant-conversation.ts:209` prüft nur Capability, Entitlement, explizite Kundenbestätigung und Quote-Hash. Positiv: Der Preis kommt deterministisch aus dem Menü, nie vom LLM (`:193-206`).
   - `appointment-book` (öffentlich, `verify_jwt=false`, `config.toml:441-442`) schreibt `bot_appointments` ohne PDP, ohne Rate-Limit, ohne Captcha und ohne Audit. Laut grep enthält die Datei nur `gateFeature` und `insert`.
   - `social-publisher-worker` (Versand an LinkedIn, WordPress, Ghost, SendGrid) enthält keine PDP- oder Approval-Referenz (grep: 0 Treffer). ABGELEITET: unbegutachteter Außenversand.
3. **Kein Evidence-Eintrag bei Bot-Sperre in bot-chat.** Der enforce-Block persistiert absichtlich nichts (`bot-chat/index.ts:95-104`), es entsteht aber auch kein metadatenbasierter Evidence-Eintrag. Damit ist nicht erfüllt: „evidence logged“.
4. **WhatsApp und Voice speichern vor dem PEP:**
   - WhatsApp: `consumeUsage` (`whatsapp-webhook/index.ts:160`), `upsertConversation` (`:184`) und `insertMessage(user)` (`:194`) laufen alle vor `enforceBotMessage` (`:206`).
   - Voice: `insertMessage(user)` (`bot-voice-webhook/index.ts:92`) läuft vor `enforceBotMessage` (`:108`).
   - Das gleiche Problem wurde für bot-chat in #1966 behoben. Dieser PR nennt die Lücke selbst als offen (`docs/security/ai-residency-fail-closed-release-gates-2026-10-21.md`, letzter Abschnitt).
5. **`require_approval` ist in synchronen Bot-Kanälen gleich `block`** (`botmessage.ts:282-292`). Einen asynchronen Pfad „an einen Menschen übergeben, Freigabe, dann Ausführung“ gibt es für Chat und WhatsApp nicht. Nur die Voice-Runtime hat `REQUIRE_CONFIRMATION` mit `confirmed_by IN ('caller','staff')`.
6. **Agent-Runtime:** `/run-agent` liefert nur `accepted` und führt nichts aus. Das Audit geht nur nach stdout. `tenantId` stammt aus dem Body, der PDP-Key ist dagegen an genau einen Tenant gebunden (`governance-decide/index.ts:60-68, 109-113`). ABGELEITET: Bei einer Runtime für mehrere Mandanten wertet der PDP die Policies des Key-Tenants aus, nicht die des angefragten Tenants.
7. **Twilio-Voice (`bot-voice-webhook`) und die Voice-Runtime (`apps/agent-runtime`) sind zwei getrennte Welten.** Live erreichbar ist der Twilio-Pfad ohne Disclosure, Consent und `voice_evidence`.

---

## B) Approval-Gates (Human in the Loop)

### B.1 Datenmodelle (VERIFIZIERT)

| Tabelle | Migration | Zustände | Erzeuger | Auflöser | Durchsetzung im Zustandsautomaten |
|---|---|---|---|---|---|
| `governance_approvals` (Legacy) | `20260512000000_governance_events.sql` (ABGELEITET, nicht vollständig gelesen) | pending/approved/rejected/… | governance-ingest (Policy-Aktion `require_approval`) | `governance-approvals` op approve/reject, nur owner/admin (`index.ts:117-171`) | nur im Code |
| `pdp_approval_gates` | `20260824120000_org_subject_model_approval_gates.sql:205-240` | `pending/approved/rejected/expired`, `expires_at` +7 Tage, Unique je (tenant, fingerprint) bei pending | `resolveApproval` im PDP (`decide.ts:215-300`) | `governance-approvals` gates_approve/gates_reject: owner/admin ODER `role_bindings.role = approver_role` (`index.ts:217-275`) | nur im Code; RLS: SELECT für Mitglieder, kein Client-Write |
| `voice_tool_requests` + `voice_executions` | `20260928130000_voice_runtime_foundation.sql:121-190, 252-300` | verdict ALLOW/DENY/REQUIRE_CONFIRMATION, `confirmed_by caller/staff` | Voice-Runtime | Anrufer oder Mitarbeitende | **DB-Trigger fail-closed** (Entscheidung final, keine Ausführung ohne Freigabe) |
| SiteOS `publish-approve` | `siteos/handlers/publish-gate.ts` | – | Publish Gate | owner/admin (ABGELEITET) | serverseitig neu bewertet |
| browser-execute Reservierung | `20260930190000_browser_execution_reservations.sql` | einmalige Nutzung, Fingerprint-Abgleich | – | – | RPC + UNIQUE(approval_id) |
| GOVARD approvals | `workers/govard-gateway/migrations/0001_init.sql` | `WHERE state = ?` optimistisch | – | Rolle `approver` | DB (D1) + State Machine |

### B.2 Umgehbarkeit und Schwächen

- **Race beim Legacy-Approve (VERIFIZIERT):** In `governance-approvals/index.ts:140-148` setzt das UPDATE auf `governance_approvals` den neuen Status ohne `.eq('status','pending')`. Die Prüfung auf pending (`:132`) und das Schreiben sind getrennt (TOCTOU). Zwei parallele Requests können approve und reject nacheinander überschreiben. Beide schreiben danach je einen Evidence-Eintrag.
- **Gates-Approve (VERIFIZIERT):** Das UPDATE filtert zwar auf pending (`:251`), aber die Zahl der betroffenen Zeilen wird nicht geprüft. Auch wer das Rennen verloren hat, schreibt `ai_evidence_events` „Freigabe erteilt“ (`:255 ff.`). Der Prüfpfad kann also eine Freigabe zeigen, die nicht gilt.
- **Kein Zustandsautomat in der DB** für `governance_approvals` und `pdp_approval_gates`: kein Trigger, der `approved → pending` oder eine erneute Auflösung verhindert. Service-Role-Code kann beliebig umschreiben. VERIFIZIERT (in der Migration keine Trigger auf `pdp_approval_gates`).
- **Keine Vier-Augen-Regel / Selbstfreigabe:** `requested_by` wird beim Auflösen nicht gegen `userId` geprüft. Für PDP-Gates ist der Antragsteller meist ein Service- oder Agent-Principal, das Risiko ist dort also gering. Für Legacy-Approvals darf jede owner/admin-Person alles freigeben. ABGELEITET.
- **Rollen-Scope:** Die Rolle gilt tenantweit, nicht für einen Teilbaum. Das ist bewusst so dokumentiert (`index.ts:230-235`).
- **AAL2/MFA** wird beim Freigeben nicht verlangt (in `governance-approvals` kein `requireAal2`-Import, grep). ABGELEITET: Für Freigaben mit hohem Risiko ist das zu prüfen.
- **Ausführung wartet nur bei SiteOS-Publish und browser-execute** tatsächlich auf eine Freigabe. Das sagt auch die Matrix aus #1869 („Freigaben · P1 · PARTIAL“). Bei Bots führt eine Freigabe zu keiner späteren Ausführung.

---

## C) Evidence / Prüfpfad

### C.1 Evidence-Speicher (VERIFIZIERT, soweit Zeile angegeben)

| Speicher | Hash-Kette | Append-only | Mandant/RLS | Schreiber |
|---|---|---|---|---|
| `ai_evidence_events` | ja (prev_hash/event_hash/chain_index, Prüf-RPC `ai_evidence_verify_chain`) | **ja**: Trigger `ai_evidence_events_no_update/no_delete`, Purge nur mit `app.evidence_retention_purge=on` (`20260901090000_evidence_append_only_anchors.sql:79-106`) | SELECT für Mitglieder; Client-INSERT nur `ai_act_classification` (`20260927120000_gate0_rls_hardening.sql:143-151`) | governance-decide, governance-approvals (Gates), telemetry/ingest u. a. |
| `evidence_anchors` | Ketten-Anker | ja (`…anchors.sql:360-369`) | – | evidence-anchor |
| `governance_evidence` | ja pro Tenant (content_hash/previous_hash), Advisory-Lock-RPC `append_governance_evidence` (`20260928140100_gate2_evidence_append_rpc.sql`) | **nein auf main** → #1908 | SELECT `is_tenant_member` (`20260723000001…:148-153`), service_role ALL | tenant-audit, email-auth-rescan, browser-execute (über RPC); **governance-approvals direkt mit `content_hash: null`** (`governance-approvals/index.ts:152-168`) |
| `evidence_items` | nein | nein | – | governance-evidence-handler (laut #1908 „eigener Schritt“) |
| `voice_evidence` | ja pro Session | ja (Trigger, Kaskade nur bei Session-Löschung) | Tenant-Konsistenz-Trigger + RLS-Read | Voice-Runtime |
| `pdp_shadow_log` | nein | nicht geprüft | – | PDP im Shadow-Modus |
| `audit_log` / `governance_admin_audit_log` (`_shared/auditLog.ts`) | nein | nicht geprüft | – | WhatsApp-Sperre, governance-agent u. v. m. |
| `bot_messages.metadata` | nein | nein | Tenant | Voice- und WhatsApp-Sperren |
| `ai_tool_runs` | nein | nein (wird bei gdpr-delete anonymisiert) | Tenant | `runAiTool` |
| stdout | – | – | – | agent-runtime `audit-log.ts:45`, ai-gateway PEP |
| GOVARD DO-Sequencer + D1 + R2-Siegel | ja | ja | `org` (eigenes Modell) | GOVARD |
| `agent_change_evidence`, Provenance-Custody, `runtime_events` | teils | teils (`20261006120000_agent_change_evidence.sql` taucht in der grep-Liste „append-only“ auf) | – | nicht im Detail geprüft (ABGELEITET) |

**Mandantentrennung:** Für `ai_evidence_events`, `governance_evidence` und `voice_*` erfolgt sie per RLS über die Mitgliedschaft (VERIFIZIERT). Die Hash-Ketten laufen pro Tenant (`governance_evidence`) bzw. pro Session (`voice_evidence`). GOVARD trennt nur auf Repository-Ebene, D1 kennt kein RLS (README). ABGELEITET: Ein „Prüfpfad pro Mandant“ ist über die verteilten Speicher nicht zusammenhängend abfragbar.

### C.2 Abdeckung „Jeder AI-Call wird geloggt“ (CLAUDE.md) – **nicht zutreffend**

`runAiTool` (`_shared/ai.ts`) schreibt `ai_tool_runs`, auch im Fehlerfall (`insertErrorRun`, `:113-135`), und prüft die Residency fail-closed (`:169-189`). VERIFIZIERT.
Direkte Provider-Aufrufe ohne `ai_tool_runs`, ohne Residency-Prüfung und ohne PDP (VERIFIZIERT per grep):

| Function | Provider | Protokollierung |
|---|---|---|
| `ai-act-classify/index.ts:360,397` | OpenAI, Anthropic | nur `anon_chat_runs` (Quota) |
| `legal-embed/index.ts:81`, `legal-retrieve/index.ts:80` | OpenAI Embeddings | keine gefunden |
| `website-maintenance-agent/index.ts:443` | Anthropic (`claude-3-5-sonnet-20241022`) | nur `deployment_logs` |
| `website-operations-agent/index.ts:311` | Anthropic | nur `deployment_logs` |
| `governance-agent/index.ts:31,449` (Anthropic SDK) | Anthropic | `agent_runs` + `audit()`, eigener Pfad, **US-Routing per Body-Flag `acknowledge_us_routing=true` freischaltbar** (`:406`) |
| `market-scanner`, `optimize-analyze` (über `_shared/providers.ts`) | diverse | `research_runs` u. a. (ABGELEITET: nicht `ai_tool_runs`) |

ai-gateway: Nutzung über `recordUsage` (`ai-gateway/index.ts:186-187`). Fehler beim Buchen werden nur geloggt, nicht blockiert (`handler.ts:280-296`).

### C.3 PR #1908 (Evidence append-only) – Vergleich mit main

- **Inhalt (VERIFIZIERT):** Neue Migration `20261023223000_governance_evidence_append_only.sql`. UPDATE wird immer abgewiesen. DELETE wird abgewiesen, außer `app.evidence_retention_purge=on`. `REVOKE UPDATE, DELETE` von PUBLIC, anon und authenticated. Dazu ein DB-Test mit 7 Fällen. Draft, mergeable `clean`, Basis `b4f8a2f`.
- **Noch nötig:** ja. Auf main fehlt jeder Trigger auf `governance_evidence`: grep findet nur RLS-Policies (`20260512000000…:255-259`, `20260723000001…:148`).
- **Konflikte / Folgen:**
  - Hartes Löschen von `governance_assets`/`governance_events` mit verknüpfter Evidence scheitert danach (FK SET NULL bzw. CASCADE laufen in den Trigger). Im PR dokumentiert.
  - Mit #1970 verträglich, weil die Tabellen keinen FK auf `tenants` haben. Das sagt der PR, ich habe es nicht selbst nachgeprüft.
  - Die Migrations-Timestamps `20261023120000` (#1970) und `20261023223000` (#1908) kollidieren nicht.
- **Nicht abgedeckt:** `governance-approvals` schreibt weiterhin direkt mit `content_hash: null` und reißt damit die Kette. Nach #1908 ist das zwar unveränderlich, aber außerhalb der Kette. `evidence_items` bleibt ohne Schutz.

---

## D) DSGVO

### D.1 PR #1970 – GDPR Delete (Selbstlöschung mit Ein-Personen-Workspace)

- **Inhalt (VERIFIZIERT):**
  - RPC `delete_sole_member_tenants(p_user_id, p_dry_run)`, SECURITY INVOKER, nur service_role.
  - Sperrt den Workspace `FOR UPDATE`.
  - Blockiert bei weiteren Mitgliedern (`other_members`), bei Stripe-Bezug (`billing_records`) und wenn ein Lösch-Trigger oder FK greift (`retained_records`).
  - Alles oder nichts; der Probelauf rollt per Subtransaktion zurück.
  - `gdpr-delete` ruft zuerst den Probelauf auf und den echten Lauf nach Lead-Löschung und Anonymisierung.
  - `tenant-cleanup.ts` ist fail-closed und gibt keine SQLSTATEs nach außen.
  - UI-Hinweis in `AccountSettings.tsx`.
  - Tests: 13 Unit, 8 DB.
- **Reifegrad:** Draft. Lokal nur mit einem Vitest-Shim getestet. Der DB-Job läuft bei Draft-PRs nicht (laut PR-Text). Deploy-Reihenfolge riskant, weil `db-push` und `functions-deploy` parallel laufen (laut PR-Text).
- **Governance-Wechselwirkung (ABGELEITET):** Jeder Workspace mit `ai_evidence_events`, `evidence_anchors` oder `voice_evidence` ohne Session-Kaskade landet in `WORKSPACE_RETAINED` und damit in einem manuellen Prozess über privacy@. Diesen Prozess gibt es noch nicht (offene Frage im PR).

### D.2 PR #1926 – Leads / Consent

- **Inhalt (VERIFIZIERT):**
  - `audit-drip-cron` prüft Einwilligung und Double-Opt-in vor dem Versand ein zweites Mal (`consent-gate.ts`), fail-closed.
  - Der öffentliche `sales-lead` verschickt keine Mails mehr an frei wählbare Adressen und übernimmt keine `marketing_consent` mehr vom Client.
  - DB-Fehlertexte gehen nicht mehr an anonyme Aufrufer.
- **Reifegrad:** Nicht Draft, mergeable `clean`, CI-Bestätigung offen. Keine Migration.
- **Überlappung:** Keine Datei überschneidet sich mit #1970 (gdpr-delete) oder #1908. Mit #1860 (bereits auf main als `b4f8a2f`) nur in `gdpr-audit/index.ts`, in getrennten Abschnitten.

### D.3 PR #1961 / Branch `fix/residency-fail-closed-bot-preflight-20261021` – AI-Residency & Bot-Policy

- **Inhalt:**
  - `residencyGuard.ts`: Residency fail-closed in `runAiTool` und `governance-router`.
  - bot-chat: PEP vor Quota und Persistenz.
- **Status (VERIFIZIERT):** **Bereits auf main** über #1966, Commit `4df1fde`. `git show --stat` zeigt dieselben 9 Dateien mit +267/−69 wie der PR. #1961 hat als Basis `feat/ai-os-governed-assistant-20261021` (gestapelt auf #1959). ⇒ **Überholt, Kandidat zum Schließen.**
- **Offene P0-Reste, die der PR selbst nennt und die auf main weiter offen sind (VERIFIZIERT):**
  - WhatsApp und Voice speichern vor dem PEP.
  - governance-agent: Legacy-US-Pfad (`acknowledge_us_routing` per Body, `governance-agent/index.ts:406`).
  - ai-gateway: PDP mit `tenant_id:null`, shadow, fail-open.
  - `resolve_ai_residency` liefert für API-Key- und anonyme Aufrufe unter `user_choice` den Wert `cloud`.
- **eu_local/Ollama fail-closed?**
  - Ja für `runAiTool`: Ist kein `ollama_model_id` gesetzt, kommt `503 LOCAL_UNAVAILABLE`, kein Cloud-Fallback (`_shared/ai.ts:258-268`).
  - Ja für den governance-router: Bei `eu_local` gibt es kein Cloud-Modell (`governanceRouterCatalog.ts:140,217`, `governance-router/index.ts:271-273`).
  - **Nein** für die direkten Provider-Aufrufe aus C.2: Sie kennen keine Residency.
  - Die Landing- bzw. Chatbot-Aussage „ohne externe AI-Aufrufe“ (laut #1869-Matrix `ChatbotStartPage:36,87`) stimmt nur, wenn `eu_local` erzwungen ist. ABGELEITET.

### D.4 PR #1869 / Issue #1865 – Audit-Claim-Security

- **Inhalt (VERIFIZIERT, Dateiliste plus PR-Text; Patch der Matrix-Doku auszugsweise gelesen):**
  - `audit-claim` schreibt nur noch über die RPC `claim_gdpr_audit` mit dem Nutzer-Token.
  - `audit-report-pdf` verlangt eine Authentifizierung vor dem Lesen (`_shared/audit-report-access.ts`).
  - Claim-Fluss im Client mit stabilen Fehlercodes.
  - Neue Matrix `docs/qa/landing-to-runtime-parity.md` (402 Z.).
  - 14 Dateien, +1214/−329. Nicht Draft, `clean`.
- **Bezug zu Governance:** Die Matrix im PR deckt sich mit diesem Bericht, unter anderem bei:
  - „Evidence Vault … governance_evidence und evidence_items (**nicht** append-only)“
  - „Telefonbot … Evidence –“
  - „Website-Chatbot … Evidence –“
  - Folgeliste „5. bot-chat: Rate-Limit pro IP/Origin“
  - Folgeliste „7. Append-only-Trigger für governance_evidence“ (= #1908)
- **Abhängigkeit:** #1867 härtet die RPC (laut PR). Issue #1865 verlangt im Abnahmepunkt einen „nachvollziehbaren Evidence-Eintrag“. Der PR schreibt `audit.claim` über `audit()`, nicht in eine Hash-Kette. ABGELEITET.
- **Überlappung:** Keine gemeinsamen Dateien mit #1908, #1970, #1926 oder #1961 (Dateilisten verglichen).

### D.5 Weitere DSGVO-Befunde (VERIFIZIERT)

- **WhatsApp-Signaturprüfung ist fail-open:** `if (!APP_SECRET) return true;` (`whatsapp-webhook/index.ts:64`). Ohne Secret ist der Webhook fälschbar. Ein Angreifer könnte Bot-Antworten an beliebige WA-IDs auslösen (Kosten, Spam) und Nachrichten personenbezogen speichern lassen. Voice ist dagegen fail-closed (`bot-voice-webhook/index.ts:53-58, 189-198`).
- **bot-chat** ist öffentlich über `(tenant_id, bot_id)` erreichbar, ohne Rate-Limit und ohne Origin-Allowlist (grep in `bot-chat/index.ts`: keine Treffer).

---

## E) EU-AI-Act-Risikoklassifizierung / Art. 50

**Existiert (VERIFIZIERT):**
- Klassifizierungs-Features für Kundensysteme: `ai-act-classify`, `ai-act-auto-classify`, `ai-act-risk-inventory`, `src/rules/annex-iii.json`, `src/rules/ai-act.json`, `src/lib/skills/aiActRisk.ts`.
- Eine Regel für fremde Websites: `AI_ACT_LIMITED_RISK_CHATBOT` (Art. 50 Abs. 1).
- Die Scanner-Heuristik `_shared/ai-disclosure-check.ts`.
- Im Datenmodell vorhanden:
  - `bot_agents.disclosure_text` und `bot_agents.ai_act_inventory_id` (`20260628193744_bots_foundation.sql:41-42`). „Feature B“, laut `docs/runtime/PRODUCTION_BLOCKERS.md` nicht die genutzte Bot-Welt.
  - `voice_bot_configs.disclosure_text` (Pflicht, Default „Hinweis: Sie sprechen mit einem KI-Assistenten.“), `voice_sessions.disclosure_played_at`, `consent_purposes`, Evidence-Arten `disclosure.played` und `consent.granted/revoked` (`20260928130000…:42,100-104,198-199`).
- Die Voice-Runtime nimmt die Disclosure aus dem DB-Snapshot, ignoriert Werte des Aufrufers und protokolliert `disclosure.played` (`apps/agent-runtime/src/voice/session-runtime.ts:11,208-311`).

**Fehlt (VERIFIZIERT):**
- `public.bots` hat weder eine Disclosure-Spalte noch eine Verknüpfung zum AI-Act-Inventar (`20260628120000_bots_foundation.sql:30-33`: nur `greeting`, `capabilities`). `bot_agents` ist nicht die genutzte Tabelle.
- Twilio-Voice spricht als Default „Hallo, hier ist ${bot.name}. Wie kann ich Ihnen helfen?“ (`bot-voice-webhook/index.ts:238,283`). Das ist **kein KI-Hinweis**. `voice_bot_configs` wird von keiner Edge Function gelesen (grep 0 Treffer in `supabase/functions`).
- Bot-Builder-Placeholder „Hallo! Wie kann ich Ihnen helfen?“ (`src/features/bots/BotBuilderView.tsx:377`). Kein Pflichtfeld, keine Prüfung.
- WhatsApp und bot-chat: Kein serverseitiger Erstkontakt-Hinweis. Der Kommentar in `whatsapp-webhook/index.ts:27-30` beruft sich auf Art. 50, setzt aber nur den Prüfpfad um, nicht die Transparenz.
- Keine Risikoklasse je Bot bzw. Use-Case, die eine Policy oder Freigabe auslösen würde (keine `ai_act`-Referenz in `src/features/bots`, `_shared/bots.ts`).

**Was für Voice/WhatsApp gelten müsste (ABGELEITET, juristisch durch Dominik bzw. Rechtsberatung zu bestätigen):**
1. Art. 50 Abs. 1: Hinweis spätestens bei der ersten Interaktion, also im ersten TwiML `<Say>` und in der ersten WA-Antwort einer neuen Konversation. Serverseitig erzwingen, nicht abschaltbar, und als Evidence `disclosure.played` belegen.
2. Aufzeichnung bzw. Transkript bei Voice: Einwilligung bzw. Information nach DSGVO Art. 6/13 und, je nach Fall, § 201 StGB. `consent_purposes` existiert nur in der Voice-Runtime.
3. WhatsApp-Outbound außerhalb des 24-h-Fensters braucht Opt-in (Meta-Policy plus UWG § 7). Im Code gibt es bisher keinen Outbound-Pfad außer Antworten; das ist so beizubehalten.
4. Bots sind in der Regel „limited risk“. Bei Terminbuchung im Gesundheitswesen, Kreditprüfung oder Ähnlichem kann Anhang III greifen. Deshalb braucht jeder Bot einen Verweis auf `ai_act_risk_inventory`.

---

## F) Prompt-Injection- und Tool-Missbrauchsschutz

**Stark (VERIFIZIERT):**
- PDP-Grenze K6: An den PDP gehen nur Signalnamen, Argument-*Namen* und strukturierte Fakten, nie Prompt, Argumentwerte oder Modellausgabe (`pdp/toolcall.ts:1-22`, `pdp/botmessage.ts:12-30`, `apps/agent-runtime/src/pdp-client.ts` `sanitizeToolCall`, `argument_keys` max. 50).
- Agent-Registry-Allowlist (`apps/agent-runtime/src/policy-engine.ts`), Voice-Tool-Allowlist (`voice-tools.ts`) und `KNOWN_TOOLS` im governance-agent (`_shared/agent-tools.ts:206-225`).
- Restaurant: Das LLM schlägt nur `item_id`/`qty` vor. Preis und Verfügbarkeit kommen deterministisch aus `bots.config.restaurant.menu`. Die Bestellung entsteht nur nach expliziter Textbestätigung und mit Quote-Hash (`restaurant-turn.ts:42-54,75-81`, `restaurant-conversation.ts:193-206,262-300`).
- Voice-DB: `proposed_by='llm'` ist nur ein Vorschlag. Entscheidung durch `policy-engine`, Trigger fail-closed.

**Schwach (VERIFIZIERT, sofern nicht anders markiert):**
- **`src/runtime/validator.ts` ist kein Laufzeitschutz.** Es validiert Agent-Manifeste bzw. -Verträge (ajv, 9 JSON-Schemas) bei der Registrierung und in CI und Tests (`validator.ts:1-15`). Kein Tool-Call-Pfad importiert es (einziger Import: `src/runtime/agents/developer-remediation-agent.contract.ts:17`, Kommentar).
- **Keine Schemaprüfung der Tool-Argumente zur Laufzeit:**
  - `/run-agent` nimmt `input: z.record(z.unknown())` an (`gateway.ts:153`).
  - governance-agent `dispatchTool` reicht die LLM-Eingabe direkt an Query-Filter weiter (`agent-tools.ts:227-238`). Supabase parametrisiert die Werte, eine SQL-Injection ist also nicht zu erwarten (ABGELEITET). Das `input_schema` an Anthropic ist aber nur ein Hinweis an das Modell.
  - Voice-Executor `schedule_appointment` liest freie Strings ohne Schema (`tool-executors.ts`).
- **Bot-Prompt:** Der Nutzertext wird mit Persona und Verlauf zu *einem* Eingabestring verkettet (`_shared/bots.ts:256-282`). Es gibt keine Rollen-Trennung, keine Ausgabeprüfung und keinen Output-PEP. Die Modellausgabe geht unverändert an WhatsApp bzw. TTS. Der PEP prüft nur die Eingabe. ABGELEITET: Prompt-Injection kann den Bot zu beliebigen Aussagen bringen (Reputations- und Haftungsrisiko, Preisversprechen außerhalb des Restaurant-Pfads).
- **Öffentliche Endpunkte ohne Missbrauchsschutz:**
  - `appointment-book`: kein Rate-Limit.
  - `bot-chat`: kein Rate-Limit, keine Origin-Allowlist.
  - WhatsApp: fail-open ohne Secret.

---

## Abhängigkeiten zu offenen PRs/Issues

| PR/Issue | Bezug | Empfehlung |
|---|---|---|
| #1908 Evidence append-only | Pflicht-Baustein C; noch nötig | Fortführen, mergen vor allen Evidence-Konsumenten der Welle 2; danach governance-approvals auf `append_governance_evidence` umstellen |
| #1961 AI-Residency & Bot-Policy | identisch mit #1966 (`4df1fde`), bereits auf main | Schließen als überholt (Dominik); offene Reste in Welle-2-WP |
| #1966 (gemergt) | Basis für Bot-PEP-Reihenfolge | WhatsApp/Voice gleichziehen |
| #1970 GDPR Delete | Wechselwirkung mit Append-only-Triggern (WORKSPACE_RETAINED) | Fortführen; manueller Art.-17-Prozess für Evidence-Workspaces festlegen |
| #1926 Leads/Consent | Consent-Gate-Muster (fail-closed) wiederverwendbar für WA-Opt-in | Fortführen, unabhängig |
| #1869 / #1865 / #1867 | Matrix bestätigt Evidence- und Bot-Lücken; Claim-Evidence nur über `audit()` | Fortführen; Matrix als Referenz für Welle 2 |
| #1959 (Basis von #1961, governed-assistant) | Residency/US-Routing des governance-agent | Status durch Orchestrator prüfen (nicht gelesen) |
| #1646 AI Gateway usage attribution | C.2: direkte Provider-Aufrufe ohne Attribution | WP „AI-Call-Abdeckung“ hier andocken |
| #1153 Voice/Storage Pricing | Voice-Runtime vs. Twilio-Pfad | Konsolidierung beachten |

---

## Vorschläge für Welle 2

### Vertrag für Bot-Aktionen (Policy + Evidence) – von 04/06/07 zu nutzen

Grundlage sind die vorhandenen Verträge `DecisionRequest`/`DecisionResult` v1 (`_shared/pdp/core.ts`) und das Voice-Modell (`voice_tool_requests`/`voice_executions`/`voice_evidence`). **Keine neue Engine**, sondern eine Erweiterung um eine kanalneutrale Aktionsschicht.

```ts
// supabase/functions/_shared/pdp/botaction.ts  (neu, rein, importfrei bis auf Typen)
export type BotChannel = 'bot-chat' | 'bot-whatsapp' | 'bot-voice';
export type BotActionKind =
  | 'reply'                 // Antwort senden (bestehender enforceBotMessage)
  | 'order.create'          // bot_orders
  | 'appointment.create'    // bot_appointments
  | 'payment.link'          // künftig, default require_approval
  | 'handoff.human'
  | 'transcript.export';    // default block

export interface BotActionRequest {
  contract: 'bot-action/v1';
  tenant_id: string;                 // NIE aus Body: aus Bot/Number-Binding aufgelöst
  bot_id: string;
  channel: BotChannel;
  conversation_id: string | null;    // null = vor Persistenz
  action: BotActionKind;
  argument_keys: string[];           // nur Namen (K6)
  signals: string[];                 // aus detectSignals, nie Inhalte
  data_classification: string;       // aus classifyFromSignals
  risk: 'low' | 'medium' | 'high';   // aus statischer Action-Registry, nicht vom LLM
  amount_minor?: number;             // nur bei order/payment, serverseitig berechnet
  idempotency_key: string;           // z.B. sha256(tenant:bot:conv:revision:quote_hash)
  disclosure_shown: boolean;         // Art. 50: Hinweis in dieser Konversation belegt
  consent_purposes: string[];        // z.B. ['process_transcript','execute_tools']
}

export type BotActionVerdict = 'ALLOW' | 'DENY' | 'REQUIRE_CONFIRMATION' | 'REQUIRE_APPROVAL';

export interface BotActionDecision {
  contract: 'bot-action/v1';
  request_id: string;               // = bot_action_requests.id
  verdict: BotActionVerdict;
  reasons_de: string[];             // nur Prüfpfad, nie an Absender
  safe_reply: string | null;        // neutraler Text für Absender bei DENY/REQUIRE_*
  matched_policy_ids: string[];
  snapshot_version: string;
  approval_gate_id: string | null;  // pdp_approval_gates bei REQUIRE_APPROVAL
  mode: 'off' | 'shadow' | 'enforce';
  evidence_id: string;              // IMMER gesetzt — auch bei ALLOW und shadow
}

/** Einziger Eintrittspunkt. Reihenfolge: Request persistieren (Metadaten) →
 *  PDP → Entscheidung final schreiben → Evidence anhängen → Verdict.
 *  Ausführung (insert bot_orders/bot_appointments/send) NUR mit
 *  decision.verdict==='ALLOW' oder bestätigter REQUIRE_CONFIRMATION —
 *  in der DB per Trigger erzwungen, nicht nur im Code. */
export declare function decideBotAction(admin: unknown, req: BotActionRequest): Promise<BotActionDecision>;
export declare function recordBotActionResult(admin: unknown, requestId: string,
  r: { status: 'succeeded' | 'failed'; external_ref?: string; error_code?: string }): Promise<{ evidence_id: string }>;
```

Regeln dazu:
- **Evidence-Senke:** `ai_evidence_events` (append-only, Hash-Kette, vorhanden) mit `event_type` aus `bot:action.requested|decided|confirmed|executed|failed`, `bot:disclosure.shown` und `bot:consent.*`. Payload nur Metadaten; Inhalte bleiben in `bot_messages`.
- **Generalisierung:** `voice_tool_requests`/`voice_executions` als `bot_action_requests`/`bot_action_executions` (kanalneutral). Die Voice-Tabellen bleiben, sie werden nicht umbenannt (keine destruktive Migration).
- **Modus:** pro Tenant schaltbar, nicht nur per globaler ENV.
- **Ausfall:** bei Aktionen mit Außenwirkung fail closed.
- **Statische Action-Registry** (`risk`, `default_verdict`): `reply=ALLOW`, `order.create`/`appointment.create`=REQUIRE_CONFIRMATION, `payment.link`=REQUIRE_APPROVAL, `transcript.export`=DENY. Das LLM kann `risk` nicht setzen.

### Arbeitspakete

| WP | Ziel | Betroffene Dateien (Ownership) | Bestehender PR? | Risiko | Tests |
|---|---|---|---|---|---|
| G1 Evidence-Fundament | #1908 mergen; `governance-approvals` auf `append_governance_evidence` umstellen; das Race beim Legacy-Approve schließen (`.eq('status','pending')` plus Zeilenzahl prüfen); Gate-Evidence nur bei tatsächlicher Statusänderung | `supabase/migrations/20261023223000_*` (#1908), `supabase/functions/governance-approvals/index.ts` | **#1908 fortführen**; Approvals-Fix als kleiner Folge-PR | mittel (Migration, Review-Pflicht) | DB-Test aus #1908; neuer Test für paralleles approve/reject |
| G2 Bot-PEP-Parität | WhatsApp und Voice: PEP vor `consumeUsage`/`upsertConversation`/`insertMessage` (Muster #1966); Evidence-Eintrag bei jeder Sperre (alle 3 Kanäle, Metadaten) | `supabase/functions/whatsapp-webhook/index.ts`, `bot-voice-webhook/index.ts`, `bot-chat/index.ts`, `_shared/pdp/botmessage.ts` | Folge zu #1966 (neuer kleiner PR; #1961 schließen) | mittel (Live-Kanäle; nur mit `shadow` ausrollen) | Reihenfolge-Tests analog `test/governance/bot-chat-privacy-order.test.ts` |
| G3 Bot-Aktions-Vertrag | `decideBotAction` plus additive Tabellen `bot_action_requests`/`bot_action_executions` mit Triggern wie bei Voice; `restaurant-conversation.ts` und `appointment-book` darüber leiten | `_shared/pdp/botaction.ts` (neu), `_shared/restaurant-conversation.ts`, `appointment-book/index.ts`, neue Migration | neu (nach G1) | hoch (Migration + Live-Bestellung) | DB-Trigger-Test (keine Ausführung ohne ALLOW), Unit-Tests für Action-Registry, Idempotenz |
| G4 Art. 50 / Consent | Disclosure-Pflichtfeld für `public.bots` (additiv) bzw. `voice_bot_configs` im Twilio-Pfad lesen; erste Antwort je Konversation erzwingt den Hinweis; Evidence `bot:disclosure.shown`; BotBuilder-Pflichtfeld | `bot-voice-webhook/index.ts`, `whatsapp-webhook/index.ts`, `bot-chat/index.ts`, `_shared/bots.ts`, `src/features/bots/BotBuilderView.tsx`, neue additive Migration | neu | mittel | Unit: erster Turn enthält Hinweis; Snapshot-Test des TwiML |
| G5 Webhook-/Missbrauchshärtung | WhatsApp fail-closed ohne `WHATSAPP_APP_SECRET`; Rate-Limit und Origin-Allowlist für `bot-chat`/`appointment-book` (Muster `_shared/anonRateLimit.ts`, Turnstile) | `whatsapp-webhook/index.ts`, `bot-chat/index.ts`, `appointment-book/index.ts` | Folgeliste aus #1869-Matrix | niedrig–mittel (Konfiguration muss vor Deploy gesetzt sein) | Signaturtest (fehlt laut Matrix), Rate-Limit-Test |
| G6 AI-Call-Abdeckung | Direkte Provider-Aufrufe (C.2) auf `runAiTool` bzw. ai-gateway umstellen oder mindestens `ai_tool_runs` plus Residency-Guard; CLAUDE.md-Aussage bis dahin nicht als Produkt-Claim verwenden | `ai-act-classify`, `legal-embed`, `legal-retrieve`, `website-maintenance-agent`, `website-operations-agent`, `governance-agent` | an #1646 andocken | mittel | Source-Test „kein `api.anthropic.com`/`api.openai.com` außerhalb `_shared/aiGateway`/`providers.ts`“ als Ratsche |
| G7 Enforcement-Readiness | Freigabe-Checkliste pro Kanal von shadow auf enforce anhand `pdp_shadow_log` (UI `ShadowReadinessView` existiert); ai-gateway-PEP mit Tenant-Kontext statt `tenant_id:null` | `ai-gateway/index.ts`, `src/features/governance/ShadowReadinessView.tsx` | neu | hoch (Verhaltensänderung live) | Shadow-Divergenzbericht, keine Umschaltung ohne Dominik |
| G8 Engine-Konsolidierung (nur Doku/Entscheidung) | Festlegen: PDP v2 ist kanonisch; GOVARD und Client-Engine einordnen (Produkt oder Experiment?) | `docs/architecture/governance-os-enforcement-plan.md` (nur auf Anweisung) | – | niedrig | – |

**Reihenfolge:** G1 → G2 → G5 → G4 → G3 → G6 → G7. G8 parallel als Entscheidungsvorlage. Hotspot: `supabase/functions/_shared/pdp/*` und die Bot-Webhooks dürfen nur seriell bearbeitet werden. Agenten 04/06/07 sollten diese Dateien nicht parallel anfassen.

---

## Blocker / offene Fragen an Dominik

1. **Produktions-ENV (BLOCKIERT, Supabase-Zugriff verboten):** Welche Werte haben `BOT_PDP_ENFORCEMENT`, `AI_GATEWAY_ENFORCEMENT`, `SITEOS_PUBLISH_PDP`, `AGENT_PDP_ENFORCEMENT` und ist `WHATSAPP_APP_SECRET` gesetzt? Im Repo-Default läuft alles in `shadow`, die WhatsApp-Signatur ist ohne Secret aus.
2. Darf #1961 als überholt geschlossen werden? Er ist identisch mit dem gemergten #1966.
3. Welche Engine ist kanonisch: PDP v2 (Supabase) oder GOVARD (Cloudflare D1)? Zwei vollständige Governance-Stacks mit getrennten Mandantenmodellen widersprechen „eine Governance-Schicht“.
4. Ist der Twilio-Pfad (`bot-voice-webhook`) live mit Kundennummern? Falls ja, hat der Art.-50-Hinweis (G4) Vorrang vor allem anderen in diesem Bereich.
5. `governance-agent`: Soll `acknowledge_us_routing=true` aus dem Request-Body weiterhin US-Routing freischalten dürfen (`governance-agent/index.ts:406`)?
6. Art. 17 bei Workspaces mit append-only-Evidence (`WORKSPACE_RETAINED`, #1970): Wer übernimmt den manuellen Prozess, und wird Evidence pseudonymisiert oder gelöscht (über `app.evidence_retention_purge`)?
7. Sollen Bot-Freigaben (`require_approval`) asynchron ausgeführt werden („Mitarbeiter bestätigt, Bot meldet sich zurück“), oder bleibt es bei „sperren und an einen Menschen verweisen“?
