# n8n — Setup + Workflow-Recipes

Dies dokumentiert wie der n8n-Container aufgesetzt wird, wie ihn die
RealSync-Edge-Functions ansprechen, und drei Starter-Workflow-Rezepte.

## VPS-Setup (5 Min)

### 1. DNS-Record

Im Hostinger-DNS-Panel:

```
Type:  A
Name:  n8n
Value: 187.77.89.1
TTL:   3600
```

### 2. .env ergänzen

```bash
cd /root/RealSyncDynamics.AI/deploy/ollama-traefik
git pull origin claude/kodee-vps-assistant-QAj43

# N8N_ENCRYPTION_KEY generieren (einmalig, NIEMALS ändern — sonst Workflow-Credentials weg)
ENC=$(openssl rand -hex 32)
echo "N8N_ENCRYPTION_KEY=$ENC" >> .env

# Verifizieren
grep -E '^N8N|^OLLAMA|^WEBUI|^TRAEFIK' .env
```

### 3. Stack hochziehen

```bash
docker compose pull n8n
docker compose up -d
docker compose ps      # kodee-n8n sollte healthy sein nach ~30s
```

### 4. Erste Anmeldung

Browser → https://n8n.realsyncdynamicsai.de

Erste Registrierung wird automatisch Owner-Account. Email + starkes Passwort
in Passwort-Manager speichern, da n8n keinen Reset-per-Email-Flow hat.

## Supabase Edge-Function Secrets

In https://supabase.com/dashboard/project/ebljyceifhnlzhjfyxup/settings/functions
folgende Secrets setzen:

```
N8N_INTERNAL_URL          = https://n8n.realsyncdynamicsai.de
WORKFLOW_CALLBACK_SECRET  = <openssl rand -hex 32>
```

Den `WORKFLOW_CALLBACK_SECRET` brauchst Du **auch in jedem n8n-Workflow** —
in n8n unter **Settings → Variables → New** als `CALLBACK_SECRET` anlegen
(dann via `{{ $vars.CALLBACK_SECRET }}` in Workflow-Nodes referenziert).

## Trigger / Callback Vertrag

Wenn ein User auf `/workflows` einen Run startet, ruft die Edge-Function
`workflow-trigger` den n8n-Webhook deines Workflows auf:

```
POST  https://n8n.realsyncdynamicsai.de/webhook/<n8n_workflow_id>
Body  {
        "run_id":          "<uuid>",
        "callback_url":    "https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/workflow-callback",
        "callback_secret": "<aus N8N $vars.CALLBACK_SECRET>",
        "tenant_id":       "<uuid>",
        "workflow_id":     "<uuid>",
        "workflow_title":  "<string>",
        "input":           { ... beliebig vom Caller ... }
      }
```

Dein Workflow MUSS am Ende einen HTTP-Request zurück an `callback_url` machen:

```
POST  {{ $json.callback_url }}
Headers:
  Authorization: Bearer {{ $json.callback_secret }}
  Content-Type:  application/json
Body:
  {
    "run_id":   "{{ $json.run_id }}",
    "status":   "success",          // oder "error" / "timeout" / "cancelled"
    "output":   { ... },             // beliebig, landet in workflow_runs.output_payload
    "cost_usd": 0.0042                // optional, fließt in Cost-Tracking
  }
```

Falls dein Workflow **keinen** Callback macht, bleibt der Run-Eintrag in
`workflow_runs` mit `status='running'` hängen und wird nach 24h vom Cleanup
auf `timeout` gesetzt (TODO: Cleanup-Job).

## Drei Starter-Recipes

### Recipe 1 — AI Code-Erklärung über lokale Ollama

**Use case:** User triggert Workflow mit `input.code`, n8n schickt das an
die EU-lokale Ollama-Instanz, kommt zurück mit erklärendem Text.

**Nodes (in n8n Editor anlegen):**

1. **Webhook** (trigger) — Path: lass n8n generieren, Method `POST`, Response `Last Node`
2. **HTTP Request** — Method `POST`, URL `https://ollama.realsyncdynamicsai.de/api/chat`, Auth: HTTP Basic, Username `kodee`, Password aus `{{ $vars.OLLAMA_PASSWORD }}`. Body JSON:
   ```json
   {
     "model": "qwen2.5:3b",
     "messages": [
       { "role": "system", "content": "Du bist Senior-Entwickler. Erkläre Code prägnant auf Deutsch." },
       { "role": "user", "content": "{{ $('Webhook').item.json.input.code }}" }
     ],
     "stream": false
   }
   ```
3. **HTTP Request** (Callback) — POST zu `{{ $('Webhook').item.json.callback_url }}` mit Bearer `{{ $('Webhook').item.json.callback_secret }}`, Body:
   ```json
   {
     "run_id":   "{{ $('Webhook').item.json.run_id }}",
     "status":   "success",
     "output":   { "explanation": "{{ $('HTTP Request').item.json.message.content }}" },
     "cost_usd": 0
   }
   ```

### Recipe 2 — Stripe Customer Sync

**Use case:** Bei neuer Stripe-Subscription: Customer-Record in Supabase
anreichern (z. B. Marketing-Tags, Onboarding-Email triggern).

**Nodes:**

1. **Webhook** (trigger)
2. **Supabase** — Operation: Update; Table: `profiles`; UUID aus `{{ $json.input.user_id }}`; Field: `marketing_segment` = abhängig vom plan_key
3. **Email Send** — z. B. via SMTP an `{{ $json.input.email }}` mit Onboarding-Template
4. **HTTP Request** (Callback) — wie oben mit `output: { synced: true }`

### Recipe 3 — Asset C2PA-Sign nach Upload

**Use case:** User lädt Asset hoch, Workflow signiert mit C2PA und speichert
das signierte Asset in Supabase Storage zurück.

**Nodes:**

1. **Webhook** (trigger)
2. **HTTP Request** — GET zu Asset-URL aus `{{ $json.input.asset_url }}`, Response Format `Binary`
3. **Execute Command** — `c2pa-cli sign --input ... --output ...` (falls c2pa-cli im n8n-Container installiert; ansonsten extern via API-Service)
4. **Supabase** — Operation: Upload to Storage; Bucket: `c2pa-signed`; File from binary
5. **HTTP Request** (Callback) — `output: { signed_url: "...", c2pa_manifest_id: "..." }`

## Plan-Gating-Erinnerung

Quotas sind serverseitig hart erzwungen (siehe Migration
`20260503100000_workflows_n8n_schema.sql`):

| Plan | `ai.tool.workflows` | `limit.workflow_runs_monthly` |
|---|---|---|
| free | 0 | 0 |
| bronze | 0 | 0 |
| silver | 1 | 100 |
| gold | 1 | 1000 |
| enterprise_public | 1 | unlimited |

Free/Bronze-User sehen die `/workflows`-Page mit Plan-Lock und Upgrade-CTA.
Silver/Gold/Enterprise sehen die volle CRUD-Oberfläche.

## Troubleshooting

**`workflow has no n8n_workflow_id`** beim Run-Versuch —
In der Workflow-Liste auf den **n8n**-Button klicken, im Prompt die ID aus
der URL des n8n-Workflows einfügen (Format wie `qB8aE3Jhbg8K9Mxk`, nicht das
ganze `https://...`).

**`N8N_REJECTED 502`** —
n8n-Webhook hat das Event abgelehnt. Häufig: Webhook-Pfad in n8n ist
**Test**-Modus statt **Production** — auf "Make Active" klicken.

**`N8N_UNREACHABLE 503`** —
Edge-Function konnte n8n nicht erreichen. Prüfe `N8N_INTERNAL_URL` in den
Supabase-Secrets, und ob `kodee-n8n` Container läuft (`docker compose ps`).

**`run` bleibt auf status='running'** —
Workflow hat den Callback-Schritt nicht oder fehlerhaft. Im n8n-Editor →
Executions-Tab → letzte Execution öffnen → Callback-Node-Output prüfen.

**`Permission denied` beim Callback (401)** —
Im n8n-Workflow Bearer ist falsch. Stelle sicher dass dort
`{{ $('Webhook').item.json.callback_secret }}` referenziert wird (NICHT
hardcoded), so wird das Secret aus jedem Trigger frisch durchgereicht.
