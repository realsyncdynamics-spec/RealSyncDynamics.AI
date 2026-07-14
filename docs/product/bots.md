# Bots — Konversations-Bots (Chat + Telefonie)

Konversations-Bots für Kundenservice mit optionaler Terminbuchung und
Bestellannahme. Multi-Tenant, RLS-geschützt, in die bestehende
Entitlements-/Usage-/AI-Tool-Infrastruktur integriert.

Bots sind ein **Growth+**-Feature (Growth · Agency · Scale · Enterprise).

## Architektur

```
Web-Widget / Twilio
        │  (kein JWT — Zugriff über tenant_id + bot_id)
        ▼
┌─────────────────────────────────────────────────────────────┐
│ Edge Functions (verify_jwt = false)                         │
│   bot-chat            Chat-Antworten                         │
│   appointment-book    Terminanfrage anlegen                 │
│   order-intake        Bestellung anlegen                    │
│   bot-voice-webhook   Telefonie (Twilio TwiML + generisch)  │
└─────────────────────────────────────────────────────────────┘
        │  service-role
        ▼
  _shared/bots.ts         resolveBot · upsertConversation · insertMessage
  _shared/ai.ts           runAiTool('bot_reply')  → ai_tool_runs + Usage
  _shared/entitlements.ts gateFeature(bots.enabled / bots.voice)
  _shared/usage.ts        consumeUsage(limit.bot_messages_monthly)
        │
        ▼
  Postgres (RLS)  bots · bot_conversations · bot_messages
                  bot_appointments · bot_orders
```

Zugriffskontrolle der öffentlichen Functions: das Paar **(tenant_id, bot_id)**.
Die `bot_id` ist eine nicht erratbare UUID und wirkt als Capability-Token
(gleiches Modell wie `browser-action-log` / `ai-gateway`). Zusätzlich gilt:
der Bot muss zum Tenant gehören **und** `enabled` sein, und der Tenant-Plan
muss `bots.enabled` (bzw. `bots.voice`) freigeschaltet haben.

## Datenmodell (Migration `20260628120000`)

| Tabelle             | Zweck                                   | Schreibpfad        |
|---------------------|-----------------------------------------|--------------------|
| `bots`              | Bot-Definition (Persona, Kanal, Config) | RLS-CRUD (Frontend)|
| `bot_conversations` | Konversationen (Chat/Voice/Messenger)   | Edge Functions     |
| `bot_messages`      | Nachrichten-Prüfpfad + Token/Kosten     | Edge Functions     |
| `bot_appointments`  | Terminanfragen                          | Edge Functions     |
| `bot_orders`        | Bestellungen                            | Edge Functions     |

Alle Tabellen sind RLS-geschützt (`is_tenant_member(tenant_id)`). `bots` ist
zusätzlich von Tenant-Mitgliedern direkt verwaltbar (Bot-Builder im Frontend).

## Entitlements (Migration `20260628120100`)

| Key                                | Art     | Growth | Agency | Scale | Enterprise |
|------------------------------------|---------|-------:|-------:|------:|-----------:|
| `bots.enabled`                     | boolean | ✓      | ✓      | ✓     | ✓          |
| `bots.voice`                       | boolean | –      | ✓      | ✓     | ✓          |
| `ai.tool.bot_reply`                | boolean | ✓      | ✓      | ✓     | ✓          |
| `limit.bots`                       | limit   | 2      | 10     | 50    | ∞          |
| `limit.bot_messages_monthly`       | limit   | 2.000  | 10.000 | 50.000| ∞          |
| `limit.bot_voice_minutes_monthly`  | limit   | –      | 500    | 2.500 | ∞          |

Starter und die Legacy-Pläne (bronze/silver/gold) erhalten Bots **nicht**.

## API

### `POST /functions/v1/bot-chat`
```json
{ "tenant_id": "…", "bot_id": "…", "message": "Habt ihr Samstag offen?",
  "conversation_ref": "web-session-123" }
```
→ `{ "ok": true, "conversation_id": "…", "reply": "…", "run_id": "…" }`

### `POST /functions/v1/appointment-book`
Voraussetzung: `bot.capabilities.appointments = true`.
```json
{ "tenant_id": "…", "bot_id": "…", "customer_name": "Max Mustermann",
  "contact": "max@example.com", "service": "Beratung",
  "requested_at": "2026-07-01T10:00:00Z", "conversation_ref": "web-session-123" }
```

### `POST /functions/v1/order-intake`
Voraussetzung: `bot.capabilities.orders = true`.
```json
{ "tenant_id": "…", "bot_id": "…", "customer_name": "Max Mustermann",
  "items": [{ "name": "Pizza Margherita", "qty": 2, "price": 8.5 }] }
```
`total_amount` wird aus `items` berechnet, falls nicht mitgeliefert.

### `POST /functions/v1/bot-voice-webhook`
- **Twilio** (`application/x-www-form-urlencoded`): antwortet mit TwiML.
  Number-Webhook auf
  `…/bot-voice-webhook?tenant_id=<…>&bot_id=<…>` setzen. `CallSid` dient als
  Konversations-Referenz. Am Status-Callback (`CallStatus=completed`,
  `CallDuration`) werden Minuten auf `limit.bot_voice_minutes_monthly` gebucht.
- **Generisch** (`application/json`): `{ tenant_id, bot_id, message,
  conversation_ref, event }`. `event:"hangup"` mit `duration_seconds` bucht
  Minuten.

## Frontend

- `/app/bots` — Übersicht + Anlage (`BotsView`)
- `/app/bots/:botId` — Bot-Builder: Persona, Kanal, Fähigkeiten, Integration (`BotBuilderView`)
- `/app/bots/inbox` — Posteingang: Konversationen, Termine, Bestellungen (`BotInboxView`)

Datenschicht: `src/features/bots/api.ts` (PostgREST + RLS).

## Deploy-Runbook

```bash
# 1. Migrationen einspielen (additiv, RLS-sicher)
supabase db push

# 2. Edge Functions deployen
supabase functions deploy bot-chat
supabase functions deploy appointment-book
supabase functions deploy order-intake
supabase functions deploy bot-voice-webhook

# 3. Smoke-Test (Bot zuvor im Builder anlegen → tenant_id + bot_id kopieren)
curl -X POST "$SUPABASE_URL/functions/v1/bot-chat" \
  -H 'content-type: application/json' \
  -d '{"tenant_id":"…","bot_id":"…","message":"Hallo"}'
```

`config.toml` deklariert alle vier Functions als `verify_jwt = false`; der
Edge-Function-Drift-Guard (`scripts/check-edge-function-drift.mjs`) verlangt
dafür ein vorhandenes `index.ts` — ist erfüllt.

## Offene operative Entscheidungen (kein Code mehr nötig)

1. **Telefonie-Provider**: EU-Provider wählen (z. B. Twilio EU-Region oder
   sipgate/Placetel), Nummer kaufen, Voice-Webhook auf `bot-voice-webhook`
   setzen. Minuten-Metering hängt bereits am Hangup-/Status-Event
   (`limit.bot_voice_minutes_monthly`).
2. **Stripe-Overage**: `limit.bot_voice_minutes_monthly` ist `billing_mode =
   metered` — Overage-Verrechnung in der Billing-Pipeline aktivieren, wenn
   gewünscht.
3. **Juristische Eignung**: DSB/Fachjurist für die konkrete
   Kundenservice-/Telefonie-Nutzung (DSGVO, ggf. Aufzeichnungshinweis).
