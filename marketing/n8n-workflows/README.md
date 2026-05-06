# n8n Workflows — Sales-Loop-Automation

3 ready-to-import Workflows für den n8n-Stack auf `n8n.realsyncdynamicsai.de`.

## Workflows

### 01 — Audit-Submit → Outreach-Insert + Slack-Ping
**File**: `01-audit-to-outreach.json`

**Trigger**: Webhook `/audit-submitted` (rufst Du nach jedem `/functions/v1/gdpr-audit`-Submit von der Frontend-App OPTIONAL ein zweites Mal auf, oder via gdpr-audit Edge-Function-Hook).

**Aktion**:
- Wenn `severity ∈ {critical, high}` → Insert in `outreach_contacts` + Slack-Notification
- Sonst: nur 200 OK

**Use-case**: Hot-Lead-Routing. Critical-Findings landen automatisch im Outreach-CRM + du kriegst eine Slack-Push.

### 02 — Outreach Follow-up Sequence (3-7-14 Tage)
**File**: `02-outreach-followup-sequence.json`

**Trigger**: Cron 09:00 Mo–Fr.

**Aktion**:
- Day-3-Bump: status=new + ≥3 Tage alt → Slack mit Liste
- Day-7-Reply-Boost: status=contacted + ≥7 Tage alt → Slack mit Liste

**Use-case**: Ersetzt manuelle Reminder-Disziplin. Cold-Outreach folgt einem Standard-Pattern (Touch, Bump, Reply-Boost).

### 03 — Daily Digest 08:00
**File**: `03-daily-digest.json`

**Alternative zu**: `daily-digest` Edge Function (siehe `supabase/functions/daily-digest`)

Wahl: nimm n8n wenn Du KPIs in eine eigene Workflow-Pipeline einspeisen willst (z.B. Slack + Notion + Email parallel). Sonst Edge Function — die ist deployed + cron-scheduled (08:00 UTC) und braucht **0 Config**.

## Import-Steps

1. **Click**: https://n8n.realsyncdynamicsai.de
2. Login (erste Registrierung wird Admin)
3. **Settings** → **Credentials** → 2 Credentials anlegen:
   - **Supabase API**: URL `https://ebljyceifhnlzhjfyxup.supabase.co`, Service-Role-Key aus https://supabase.com/dashboard/project/ebljyceifhnlzhjfyxup/settings/api
   - **Resend Email** (optional für Workflow 03): API-Key aus https://resend.com/api-keys
4. **Settings** → **Variables**:
   - `SUPABASE_URL` = `https://ebljyceifhnlzhjfyxup.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = `eyJ…`
   - `SLACK_WEBHOOK_URL` = `https://hooks.slack.com/services/…` (optional)
   - `FOUNDER_EMAIL` = `kontakt@realsyncdynamicsai.de`
5. **Workflows** → **Import from File** → JSON-File hochladen → **Activate**

## Konkurrierende Lösungen

| Layer | Edge Function | n8n |
|-------|---------------|-----|
| Daily Digest | ✅ deployed (`daily-digest` v1) | als Backup |
| Audit-zu-Outreach | nicht in EF | Workflow 01 |
| Follow-up-Reminders | nicht in EF | Workflow 02 |
| Slack-Notifications | sales-lead EF macht's bereits | Workflow 01 für audit-route |

**Empfehlung**: Edge Function für Daily-Digest (deployed + zero-config), n8n für Workflow 01 + 02 (browser-editierbar).

## Webhook-URL für Workflow 01

Nach Import zeigt n8n eine URL wie:
```
https://n8n.realsyncdynamicsai.de/webhook/audit-submitted
```

Optional kannst du die `gdpr-audit` Edge Function ergänzen mit einem fire-and-forget POST an diese Webhook nach jedem erfolgreichen Audit. Code-Snippet:

```typescript
// In gdpr-audit/index.ts nach dem Insert:
fetch('https://n8n.realsyncdynamicsai.de/webhook/audit-submitted', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ audit_id, score, severity, domain, email, company }),
}).catch(() => { /* non-blocking */ });
```
