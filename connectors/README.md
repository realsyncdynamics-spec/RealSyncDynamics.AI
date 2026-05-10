# RealSyncDynamicsAI — Agent Connectors

Integrationen für AI-Tools, Workflows und SDKs. Alle Connectors senden
strukturierte Runtime-Events ans Compliance-OS (`telemetry-ai-event`).

## Connectors in dieser Iteration

| Connector | Pfad | Use-Case |
|---|---|---|
| **OpenAI Wrapper** | `openai-wrapper.ts` | Drop-in-Wrap für `openai` SDK + per-Call-Helper |
| **Anthropic Wrapper** | `anthropic-wrapper.ts` | Drop-in-Wrap für `@anthropic-ai/sdk` + per-Call-Helper |
| **n8n Custom Node** | `n8n/` | RsdAiTelemetry-Node für n8n-Workflows |
| **Make.com Blueprint** | `make/` | HTTP-Module-Blueprint für Make-Scenarios |

## Privacy-Default

Alle Connectors halten sich an die Plattform-Regel: **Presence statt Content.**
Es werden niemals Prompt-Texte oder Response-Inhalte gesendet, nur
Metadaten (Vendor, Modell, Token-Counts, Latenz, Datenklasse, Risk-Level).

## Backend

Connectors targeten den Telemetry-Endpoint:
```
POST https://realsyncdynamicsai.de/api/telemetry/ai-event
Headers:
  x-rsd-tenant-key: <tenant uuid>
  content-type:    application/json
```

Schema + Validierung: siehe `supabase/functions/telemetry-ai-event/index.ts`.
TypeScript-Types: `src/sdk/telemetry.ts`.

## Wahl des Connectors

```
Du nutzt ...                    → Connector
─────────────────────────────────────────────────────────────
openai-SDK (Node/Edge)          → connectors/openai-wrapper.ts
@anthropic-ai/sdk               → connectors/anthropic-wrapper.ts
n8n (self-hosted)               → connectors/n8n/
Make.com Scenarios              → connectors/make/
Eigener Stack                   → src/sdk/telemetry.ts (raw)
```

## Out of Scope (Folge-PRs)

- Veröffentlichung als npm-Packages: `@realsyncdynamicsai/openai`,
  `@realsyncdynamicsai/anthropic`, `@realsyncdynamicsai/n8n-nodes`
- Python-Connectors für openai-python + anthropic-python
- Zapier-Integration
- LangChain / LlamaIndex Callbacks
- HMAC-Signing (kommt mit `tenant_api_keys`-Tabelle, separater PR)
