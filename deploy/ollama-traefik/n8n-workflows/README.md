# n8n Growth/Compliance-Workflow-Vorlagen

Importierbare **Vorlagen** für den automatisierten Growth-/Compliance-Stack.
Alle Workflows sind bewusst **inaktiv** (`active: false`) und versenden **keine**
echten E-Mails — sie rufen die bestehenden Supabase Edge Functions auf bzw.
erzeugen nur Entwürfe. Aktivierung erst nach manueller Prüfung.

## Architektur-Prinzip

n8n ist **Orchestrator**, nicht Logik-Ort. Jeder Workflow ruft eine
bestehende Edge Function — es wird **keine** Audit-/Scan-/Billing-Logik in
n8n dupliziert und **keine** zweite Datenbank betrieben (Supabase bleibt
einzige Wahrheit, vgl. `deploy/ollama-traefik/docker-compose.yml` — n8n nutzt
nur sein eingebettetes SQLite für Workflow-Definitionen).

```
Schedule Trigger ─► HTTP Request ─► Supabase Edge Function ─► Supabase DB
                                     (RLS, ai_tool_runs/workflow_runs Logging)
```

## Workflows

| Datei | Zeitplan | Ruft | Zweck |
|---|---|---|---|
| `01-discovery-0800.json`      | täglich 08:00 | `market-scanner`       | Zielkunden finden, grob bewerten |
| `02-audit-1000.json`          | täglich 10:00 | `audit-drip-cron`      | Audit-Scans/Drip anstoßen |
| `03-outreach-draft-1400.json` | täglich 14:00 | *(nur Entwurf)*        | DSGVO-geprüfte Outreach-**Entwürfe** |
| `04-mrr-report-1700.json`     | täglich 17:00 | `business-metrics-cron`| MRR/Pipeline-Report |
| `05-healthcheck-hourly.json`  | stündlich     | `health`               | Infrastruktur-Healthcheck |

Zeiten in `Europe/Berlin` (Container-`TZ` ist bereits gesetzt).

## Import

1. n8n öffnen (`https://n8n.realsyncdynamicsai.de`), als Owner anmelden.
2. **Workflows → Import from File** → jeweilige `*.json` wählen.
3. Credentials anlegen (siehe unten) und in den HTTP-Request-Nodes zuweisen.
4. Vor dem Aktivieren je Workflow **einmal manuell „Execute Workflow"** und
   das Ergebnis prüfen.

## Credentials (nicht im Repo!)

Lege in n8n **Header Auth** Credentials an — niemals Secrets in die JSON
committen:

- **Name:** `RealSync Service`
- **Header:** `Authorization`
- **Value:** `Bearer <SUPABASE_SERVICE_ROLE_KEY>` *(nur in Edge-Function-
  geschützten Cron-Routen; sonst tenant-scoped User-JWT verwenden)*

Die Workflows referenzieren die Basis-URL über den Ausdruck
`={{ $env.SUPABASE_URL }}`. Setze `SUPABASE_URL` als n8n-Environment-Variable
(Container-Env), damit keine projektspezifische URL im Workflow steht.

## DSGVO-Gate für Outreach (Workflow 03)

`03-outreach-draft-1400.json` erzeugt **ausschließlich Entwürfe** und enthält
einen Function-Node, der jeden Kandidaten gegen die Regeln aus
`supabase/functions/_shared/outreach-gate.ts` spiegelt:

- nur B2B / öffentlich-geschäftliche Kontaktdaten (keine Freemail-Adressen)
- dokumentierte Quelle (`source_url`) + Rechtsgrundlage (berechtigtes
  Interesse mit Begründung **oder** Consent-Nachweis)
- Opt-Out hart durchgesetzt
- keine besonderen Datenkategorien (Art. 9 DSGVO)
- Pflicht-Opt-Out-Fußzeile in jeder Nachricht

Kandidaten, die das Gate nicht bestehen, werden **nicht** als Entwurf erzeugt,
sondern mit Begründung in der Workflow-Ausgabe markiert. Der eigentliche
Versand bleibt ein **separater, manuell freizugebender** Schritt.

> **STOP:** Workflow 03 niemals so erweitern, dass er ohne menschliche
> Freigabe echte E-Mails versendet. Echtversand erst nach Rechts-Review.
