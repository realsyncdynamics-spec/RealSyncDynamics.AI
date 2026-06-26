# Telegram Agent Gateway — Integration

RealSyncDynamics.AI Telegram Bot: Governance, Audit, Risk, Evidence und Compliance via Telegram.

## BotFather Setup

1. Öffne [@BotFather](https://t.me/BotFather) in Telegram
2. Sende `/newbot`
3. Vergib Name: `RealSync Agent Gateway`
4. Vergib Username: `RealSyncDynamicsBot` (oder eigener Name)
5. Kopiere den Bot-Token — **nie teilen oder in Code einchecken**
6. Setze Commands via `/setcommands`:

```
start - RealSync Telegram Agent starten
help - Hilfe und verfügbare Befehle anzeigen
connect - Telegram mit RealSync Workspace verbinden
status - Governance OS Status anzeigen
audit - Audit starten oder Auditbereich öffnen
risks - Aktuelle Risiken anzeigen
evidence - Evidence Vault Status anzeigen
compliance - Compliance Übersicht anzeigen
assistant - Frage an den RealSync Agent stellen
settings - Telegram Einstellungen anzeigen
```

## Benötigte ENV-Variablen

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Ja | Bot-Token von BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Empfohlen | Geheimes Token für Webhook-Verifikation |
| `PUBLIC_APP_URL` | Ja | Basis-URL der App (z.B. `https://app.realsyncdynamicsai.de`) |
| `SUPABASE_URL` | Ja | Supabase Projekt-URL |
| `SUPABASE_ANON_KEY` | Ja | Supabase Anon Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Ja | Supabase Service Role Key (nur in Edge Functions) |

Secrets werden in Supabase via **Dashboard → Edge Functions → Secrets** gesetzt,
niemals direkt im Code.

## Webhook setzen

```bash
TELEGRAM_BOT_TOKEN=<token> \
PUBLIC_APP_URL=https://app.realsyncdynamicsai.de \
TELEGRAM_WEBHOOK_SECRET=<secret> \
deno run --allow-env --allow-net scripts/setup-telegram-webhook.ts
```

Die Supabase Edge Function URL lautet:
```
https://<project-ref>.supabase.co/functions/v1/telegram-webhook
```

## Webhook-Status prüfen

```bash
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

Ausgabe enthält:
- `url`: aktuelle Webhook-URL
- `pending_update_count`: unverarbeitete Updates
- `last_error_message`: letzter Fehler

## Verbindungsflow

```
Nutzer → /connect im Bot
Bot → Erzeugt kurzlebigen Token (15 Min)
Bot → Sendet Link: /app/settings/integrations/telegram?token=<token>
Nutzer → Öffnet Link, ist eingeloggt
Frontend → POST telegram-channels { op: 'connect_complete', token, tenant_id }
Backend → Validiert Token-Hash, aktiviert Connection
Nutzer → Bot-Commands verfügbar
```

## Token-Rotation / Verbindung trennen

**Via Telegram Bot:**
```
/settings → Link zur Einstellungsseite
```

**Via Web-UI:**
Einstellungen → Integrations → Telegram → "Verbindung trennen"

**Via BotFather (Bot-Token neu generieren):**
1. `/mybots` → Bot auswählen → API Token → Revoke current token
2. Neues Token als ENV-Variable setzen
3. Webhook neu registrieren mit `setup-telegram-webhook.ts`

## Sicherheitshinweise

- **Bot-Token** niemals in Code, Logs oder Git-History
- **Webhook-Secret** immer setzen (`TELEGRAM_WEBHOOK_SECRET`)
- Der Webhook-Endpoint antwortet immer `200 OK` — Fehler werden intern geloggt, nie an Telegram zurückgegeben (verhindert Retry-Loops)
- Verbindungs-Tokens werden nur als SHA-256-Hash gespeichert, nie im Klartext
- Alle produktiven Agent-Aktionen werden im `governance_admin_log` protokolliert
- Destruktive Aktionen (z.B. Verbindung trennen) erfordern explizite Bestätigung

## Architektur

```
Telegram
  └─ Webhook POST /functions/v1/telegram-webhook
       └─ Command-Router
            ├─ /start  → Welcome-Message
            ├─ /connect → Token erzeugen + Link senden
            ├─ /status  → Governance-Snapshot
            ├─ /audit   → AI-Gateway → Audit-Agent
            ├─ /risks   → AI-Gateway → Risk-Agent
            ├─ /evidence → AI-Gateway → Evidence-Agent
            ├─ /compliance → AI-Gateway → Governance-Agent
            └─ Freitext → AI-Gateway → Assistant

Frontend /app/settings/integrations/telegram
  └─ Token validieren → telegram-channels { op: 'connect_complete' }
       └─ Connection aktivieren in telegram_connections (RLS-geschützt)
```

## Datenbank-Schema

Tabelle `telegram_connections`:

| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | uuid | Primärschlüssel |
| `tenant_id` | uuid | Verknüpfter Workspace |
| `user_id` | uuid | Verknüpfter Benutzer |
| `telegram_chat_id` | text | Telegram Chat-ID |
| `telegram_user_id` | text | Telegram User-ID (unique) |
| `telegram_username` | text | @username (optional) |
| `status` | text | `pending` / `connected` / `revoked` |
| `connection_token_hash` | text | SHA-256 des einmaligen Connect-Tokens |
| `connected_at` | timestamptz | Zeitpunkt der Verbindung |

RLS: Service-Role kann schreiben; authentifizierter Nutzer kann nur eigene Zeilen lesen.
