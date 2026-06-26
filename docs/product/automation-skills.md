# Automatisierungs-Skills

Self-Service-Modul innerhalb von RealSyncDynamics.AI: **Wählen. Aktivieren. Nutzen.**

Routen:
- `/automations` — öffentliche Teaser-Landingpage
- `/app/automations` — Übersicht im Workspace (auth-gated)

## Was sind Automatisierungs-Skills?

Automatisierungs-Skills sind vordefinierte Workflows, die Unternehmen direkt
aktivieren können — ohne Beratungsgespräch, ohne individuelles Setup, ohne
"Call buchen". Jeder Skill löst ein konkretes Problem (Compliance, Vertrieb,
Support, Dokumente, Meetings) und liefert ein klares Ergebnis: einen Report,
ein Dokument, ein Protokoll oder ein Ticket.

Das Modul ist **kein** separates Produkt und **keine** Agenturleistung —
es ist eine Sicht auf bestehende Tools und Workflows von RealSyncDynamics.AI,
zusammengefasst nach "Skill auswählen → aktivieren → Ergebnis erhalten".

## Wie funktionieren sie? (Architektur)

**Phase 1 (aktueller Stand):** rein Frontend. `/app/automations` zeigt das
fest definierte Skill-Set aus `src/content/automationSkills.ts`. Jeder
"Skill aktivieren"/"Workflow ansehen"/"Im Dashboard öffnen"-Button verlinkt
auf eine **bereits vorhandene** Route (z. B. `/audit`, `/dokumente-bundle`,
`/assistant`). Es werden noch keine echten Backend-Runs ausgeführt.

**Phase 2 (Datenmodell + Edge Functions, dieser Stand):** das Backend für
echte Läufe ist angelegt — `automation_skills`/`automation_runs`/
`automation_run_events`/`automation_outputs` (Migration
`20260624000000_automation_skills_runs.sql`) sowie die Edge Functions
`automation-trigger` und `automation-callback` (analog `workflow-trigger`/
`workflow-callback`, siehe `supabase/functions/`). `automation_skills` ist mit
den 6 Skills aus `src/content/automationSkills.ts` befüllt, aber noch **ohne**
`n8n_workflow_id` — `automation-trigger` lehnt einen Trigger-Versuch dafür mit
`409 NOT_BOUND` ab. Das Frontend nutzt weiterhin die Phase-1-Links.

```
/app/automations
  → Skill auswählen
  → Edge Function automation-trigger
  → n8n Workflow (sobald n8n_workflow_id gesetzt ist)
  → async Callback → Edge Function automation-callback
  → automation_runs / automation_run_events / automation_outputs
  → Report / Ticket / Evidence
```

**Phase 2b (offen):** pro Skill einen n8n-Workflow verdrahten
(`automation_skills.n8n_workflow_id` setzen) und das Frontend von
Link-Navigation auf `automation-trigger`-Aufruf + Run-Status-Anzeige (Realtime
auf `automation_runs`) umstellen. Die UI-Struktur bleibt dabei identisch.

## Welche Skills gibt es?

| Skill | Kategorie | Status | Plan | CTA (Phase 1) |
|---|---|---|---|---|
| DSGVO Audit Skill | Compliance | Verfügbar | Free | `/audit` |
| Dokumenten Skill | Dokumente | Verfügbar | Bronze | `/dokumente-bundle` |
| Meeting Compliance Skill | Meetings | Beta | Silver | `/app/automations?skill=meeting` |
| Screenshot Feedback Skill | Support | Beta | Silver | `/app/automations?skill=feedback` |
| Lead Risk Skill | Vertrieb | Verfügbar | Bronze | `/audit` |
| Support Skill | Support | Geplant | Gold | `/assistant` |

### 1. DSGVO Audit Skill
Prüft Website, Tracker, Consent, Header und Pflichtseiten.
**Output:** Befunde, Risiko-Score, Evidence, Report.

### 2. Dokumenten Skill
Erzeugt aus den Audit-Befunden Datenschutzerklärung, AVV, VVT, TOM.
**Output:** Datenschutzerklärung, AVV, VVT, TOM, Audit-Zusammenfassung.

### 3. Meeting Compliance Skill
Erkennt aus Meeting-Notizen/Transkripten Aufgaben, Risiken sowie DSGVO- und
AI-Act-relevante Aussagen.
**Output:** Protokoll, To-dos, Compliance-Hinweise.

### 4. Screenshot Feedback Skill
Wandelt Screenshots von Kunden/Beta-Nutzern in strukturierte Bug-Tickets um.
**Output:** Bug-Ticket, Priorität, betroffene Seite, Fehlerbeschreibung,
Weiterleitung an GitHub/n8n.

### 5. Lead Risk Skill
Scannt potenzielle Kunden-Websites auf DSGVO-Risiken.
**Output:** DSGVO-Risiken, Outreach-Text, Angebotsempfehlung.

### 6. Support Skill
Beantwortet Kundenfragen anhand der Wissensbasis.
**Output:** Antwort, Quellen, Ticket falls nötig.

## Wie werden sie mit n8n verbunden?

Jeder Skill bekommt einen `n8n_workflow_id`-Eintrag in der
`automation_skills`-Tabelle. Die Aktivierung läuft über `automation-trigger`:

1. legt einen `automation_runs`-Eintrag an (Status `pending`) und ein
   `automation_run_events`-Event vom Typ `queued`,
2. ruft `POST ${N8N_INTERNAL_URL}/webhook/${n8n_workflow_id}` mit
   `{ run_id, callback_url, callback_secret, tenant_id, skill_id, skill_title, input }` auf,
3. setzt den Run bei erfolgreichem n8n-Accept auf `running`
   (+ `n8n_execution_id`), bei Fehler/Timeout direkt auf `error`.

Der n8n-Workflow ruft am Ende `automation-callback` auf (Bearer
`AUTOMATION_CALLBACK_SECRET`, siehe `deploy/ollama-traefik/N8N-SETUP.md`):

- Zwischenschritte ohne `status` → `automation_run_events` (`progress`/`log`),
  Run bleibt `running`.
- Finaler Aufruf mit `status` (`success`/`error`/`timeout`/`cancelled`) →
  `automation_runs` wird aktualisiert, `output_refs` werden als
  `automation_outputs` gespeichert, bei `success` zählt `recordUsage` gegen
  `limit.automation_runs_monthly`.

## Welche Daten werden gespeichert? (Datenmodell)

Tabellen (additiv, RLS-geschützt, multi-tenant — Migration
`20260624000000_automation_skills_runs.sql`):

- **`automation_skills`** — Katalog: `id`, `title`, `category`, `status`,
  `description`, `input_schema`, `output_schema`, `n8n_workflow_id`,
  `required_plan`.
- **`automation_runs`** — ein Lauf: `tenant_id`, `skill_id`, `triggered_by`,
  `status` (`pending`/`running`/`success`/`error`/`timeout`/`cancelled`,
  identisch zu `workflow_runs`), `input`, `result`, `cost_usd`,
  `duration_ms`, `n8n_execution_id`, `started_at`/`finished_at`.
- **`automation_run_events`** — Fortschritts-/Status-Events pro Lauf
  (`event_type`: `queued`/`progress`/`log`/`result`/`error`).
- **`automation_outputs`** — generierte Artefakte (`output_type`:
  `report`/`document`/`ticket`/`protocol`) mit `storage_path` und
  `metadata` (Herkunftsnachweis), Referenz auf den jeweiligen Run.

Entitlements: `ai.tool.automations` (boolean, alle Pläne aktiv) und
`limit.automation_runs_monthly` (free 5, bronze 20, silver 100, gold 1000,
enterprise unlimited). Skill-spezifisches Plan-Gating erfolgt zusätzlich über
`automation_skills.required_plan` (UI-Badge, siehe `AutomationSkillCard`).

## Wie werden Evidence und Reports erzeugt?

Wie bei allen externen Calls in RealSyncDynamics.AI gilt: jeder Aufruf eines
Skills wird im Prüfpfad protokolliert (`ai_tool_runs` / `workflow_runs`,
siehe `CLAUDE.md`). Reports, Dokumente und Tickets, die ein Skill erzeugt,
werden als `automation_outputs` referenziert und — soweit relevant — mit
Herkunftsnachweis (Evidence-Metadaten: Quelle, Zeitstempel, Hash) versehen,
analog zu den bestehenden Evidence-Strukturen unter `/app/evidence`.
