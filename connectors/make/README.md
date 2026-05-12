# RealSyncDynamicsAI — Make.com Blueprint

Sende AI-Telemetry-Events an das Compliance-OS aus einem Make.com (ehem.
Integromat) Scenario.

## Import

1. Make.com → Scenarios → "Create new scenario" → "..."-Menü → "Import Blueprint"
2. `blueprint.json` aus diesem Ordner hochladen
3. Connection für HTTP erstellen (default reicht — Auth läuft via Header)

## Parameter mappen

Im Scenario-Editor folgende Variablen aus dem Trigger-Modul (z.B.
OpenAI-Modul) auf die HTTP-Body-Felder mappen:

| Field | Quelle |
|---|---|
| `rsd_endpoint` | konstant: `https://realsyncdynamicsai.de/api/telemetry/ai-event` |
| `rsd_tenant_key` | konstant: deine Tenant-UUID |
| `vendor` | aus Vorgänger-Modul (z.B. `openai`) |
| `model` | aus Vorgänger-Modul (`gpt-4.1`, `claude-opus-4-7`) |
| `event_type` | konstant: `response_received` |
| `prompt_category` | je nach Workflow-Zweck |
| `data_class` | je nach Daten im Workflow |
| `risk_level` | `info` / `low` / `medium` / `high` / `critical` |
| `team` | konstant pro Scenario |
| `user_id` | optional, aus Auth-Modul |
| `prompt_tokens` | aus OpenAI-Response (`usage.prompt_tokens`) |
| `response_tokens` | aus OpenAI-Response (`usage.completion_tokens`) |
| `latency_ms` | aus Variable (Subtraktion) |
| `metadata` | optional JSON-Object |

## Use-Case

Klassisches Beispiel:
```
[Webhook-Trigger] → [OpenAI-Module] → [HTTP: RSD Telemetry] → [Mailgun]
```

Der Telemetry-HTTP-Call läuft parallel/nach dem AI-Call. Response
(`event_id`, `policy_status`) ist im Scenario verfügbar — bei
`policy_status === "blocked"` kann ein Alert-Pfad ausgelöst werden.
