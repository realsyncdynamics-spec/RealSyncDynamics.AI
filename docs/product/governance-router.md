# Governance Open Router

OpenAI-kompatibler Eingang vor dem bestehenden AI-Gateway. Cursor, SDKs und interne Automationen setzen die Base URL auf RealSyncDynamicsAI; davor liegen Mandant, Residenz, Kontingent, Policy Decision Point und ein Prüfpfad **ohne Prompt-Inhalt**.

Das ist Sicherheitsinfrastruktur und Produktfläche, kein Modell-Reseller.

## Anschluss (Cursor)

1. Settings → Models → **Override OpenAI Base URL**
2. Base URL:

   `{SUPABASE_URL}/functions/v1/governance-router/v1`

   Produktions-Beispiel: `https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/governance-router/v1`

3. API-Key: `rsd_gov_…` aus `/app/keys`, Quelle `api` (oder `sdk` / `agent_runtime`; leere `allowed_sources` gelten für alle).
4. Modell: ein auf der aktuellen Stufe erlaubter Name (`fast-local`, `gpt-4o-mini`, ab Growth auch `gpt-4o` / `cloud-fallback`).

Dashboard: `/app/governance/router`. Gate: `ai.tool.automations` (Starter+).

Live seit Deploy-Lauf 34282015173 (2026-09-08, 21:51 UTC) auf `main` @ `2380d027`.

Der öffentliche Assistent (`ai-gateway`, JWT, mandantenlos) bleibt unverändert. Die beiden Endpunkte sind nicht austauschbar — `ai-gateway` mit `verify_jwt = false` wäre unauthentifizierte Inferenz.

## Expansion mit Kundenzahl und Umsatz

Die Stufe ist **keine eigene Preisliste**. Sie wird aus den bestehenden Entitlements abgeleitet. Ein Stripe-Upgrade ändert `tenant_entitlements()`; der Katalog und das Kontingent folgen am nächsten Request. Es gibt keine automatische Abbuchung, kein VPS-Provisioning, keine neuen `ENTITLEMENT_KEYS`.

| Stufe | Ableitung | Modelle | Kontingent |
|---|---|---|---|
| `observe` | kein `ai.tool.automations` (Free) | keine — 403 `PLAN_REQUIRED` | — |
| `studio` | Automationen, kein/niedriges `limit.ai_calls_monthly` (Starter) | EU-lokal | `limit.llm_queries_monthly` |
| `growth` | `ai_calls` ≥ 2000 (Growth) | plus Cloud-Fallback | `limit.ai_calls_monthly` |
| `agency` | ≥ 10 000 | plus Cloud-Fallback | `limit.ai_calls_monthly` |
| `sovereign` | `-1` (Enterprise) oder ≥ 50 000 (Partner) | plus Cloud-Fallback | System-Cap aus; der Vertrag begrenzt |

EU-lokale Residenz (`/settings/ai-residency`) sperrt Cloud-Profile **auf jeder Stufe**.

## Was der Router durchsetzt

- Auth: SHA-256 gegen `governance_ingest_keys`. `tenant_id` nur aus dem Key.
- Residenz: `resolve_ai_residency`. Fällt die RPC aus, gilt `cloud` — dieselbe Fail-open-Regel wie `_shared/ai.ts` / `runAiTool`. Ein EU-lokal-Mandant kann in diesem Ausfall Cloud sehen. Bewusst analog, kein eigener Fail-closed-Schnitt.
- PDP: `AI_GATEWAY_ENFORCEMENT` `off|shadow|enforce`, Default `shadow`, Fail-open bei Ausfall (wie `ai-gateway`).
- Prüfpfad: `ai_tool_runs.tool_key = governance_router`. Metadaten: Profil, Provider, Residenz, Stufe, PDP — **kein Prompt**.
- Art. 50: `_governance.disclosure` an der Antwort.

Kein Eintrag in `pdp_shadow_log` in diesem Schnitt: die Quellenliste ist eine geschlossene CHECK-Bedingung und steht doppelt zur SQL-Funktion. Ein neuer Kanal wäre eine eigene Migration.

## Was bewusst nicht skaliert

- Kein automatisches Plan-Upgrade
- Kein Token-Streaming (Cursor `stream: true` erhält eine Ein-Chunk-SSE-Hülle nach der fertigen Antwort; echte Token-Streams sind ein eigener Schnitt)
- Residenz-RPC bleibt fail-open auf `cloud` (wie `runAiTool`); Fail-closed wäre ein eigener Schnitt
- Kein zweiter Provider-Marktplatz
- `ai-gateway` bleibt JWT-pflichtig
