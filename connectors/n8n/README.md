# RealSyncDynamicsAI — n8n Custom Node

Sendet AI-Runtime-Events ans Compliance-OS aus einem n8n-Workflow.

## Installation (Self-Hosted n8n)

```bash
# 1. Build aus Source
cd connectors/n8n
npm install --no-save typescript @types/node
npx tsc --module commonjs --target es2020 RsdAiTelemetry.node.ts

# 2. In n8n custom-Folder kopieren
mkdir -p ~/.n8n/custom
cp RsdAiTelemetry.node.{ts,js} ~/.n8n/custom/

# 3. n8n restart
```

## Credentials konfigurieren

In n8n → Credentials → New → "rsdAiCredentialsApi":
- **Endpoint:** `https://realsyncdynamicsai.de/api/telemetry/ai-event` (oder Self-Hosted)
- **Tenant Key:** UUID aus dem RealSyncDynamicsAI-Workspace

## Use-Case

```
[ChatGPT-Node] → [RSD AI Telemetry] → [Slack-Notify]
```

Der Telemetry-Node sitzt zwischen dem AI-Vendor-Node und dem Output-Node. Er
sendet pro Item ein Event mit Vendor / Model / Event-Type / Prompt-Category /
Data-Class / Risk-Level. Die Response des Telemetry-Endpoints (event_id +
policy_status) landet in `item.json.rsd_telemetry` und kann von
nachfolgenden Nodes ausgewertet werden — z.B. „bei policy_status=blocked
sende Alert an Compliance-Channel".

## Out of Scope (kommt mit npm-Package)

- Eigenes `package.json` mit n8n-community-package metadata
- Icon (SVG)
- Echte Credentials-Type-Klasse als separater File
- Veröffentlichung auf npm + n8n.io Verified Community
