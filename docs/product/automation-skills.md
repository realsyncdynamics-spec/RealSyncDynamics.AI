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

**Phase 2 (geplant):** Aktivierung eines Skills erzeugt einen echten Lauf:

```
/app/automations
  → Skill auswählen
  → Supabase Edge Function
  → n8n Workflow
  → governance-agent / ai-gateway
  → Supabase Tabellen
  → Report / Ticket / Evidence
```

Die UI bleibt identisch — es ändert sich nur die Datenquelle (von statischem
Content zu Supabase-Tabellen) und die CTA-Aktion (von Link-Navigation zu
`automation_runs`-Insert + n8n-Webhook).

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

## Wie werden sie später mit n8n verbunden?

Jeder Skill bekommt in Phase 2 einen eigenen `n8n_webhook_url`-Eintrag in der
`automation_skills`-Tabelle. Die Aktivierung läuft über eine Edge Function,
die:

1. einen `automation_runs`-Eintrag anlegt (Status `queued`),
2. den n8n-Webhook mit `tenant_id`, `skill_id`, `input` und `run_id` aufruft,
3. Fortschritts-Events als `automation_run_events` zurückschreibt,
4. das Ergebnis als `automation_outputs` speichert und den Run auf
   `completed`/`failed` setzt.

## Welche Daten werden gespeichert? (Datenmodell Phase 2)

Neue Tabellen (additiv, RLS-geschützt, multi-tenant):

- **`automation_skills`** — Katalog: `id`, `name`, `category`, `description`,
  `input_schema`, `output_schema`, `workflow_type`, `n8n_webhook_url`,
  `required_plan`, `status`.
- **`automation_runs`** — ein Lauf: `tenant_id`, `skill_id`, `input`,
  `status`, `result`, `evidence_refs`, `created_at`.
- **`automation_run_events`** — Fortschritts-/Status-Events pro Lauf.
- **`automation_outputs`** — generierte Artefakte (Reports, Dokumente,
  Tickets) mit Referenz auf den jeweiligen Run.

## Wie werden Evidence und Reports erzeugt?

Wie bei allen externen Calls in RealSyncDynamics.AI gilt: jeder Aufruf eines
Skills wird im Prüfpfad protokolliert (`ai_tool_runs` / `workflow_runs`,
siehe `CLAUDE.md`). Reports, Dokumente und Tickets, die ein Skill erzeugt,
werden als `automation_outputs` referenziert und — soweit relevant — mit
Herkunftsnachweis (Evidence-Metadaten: Quelle, Zeitstempel, Hash) versehen,
analog zu den bestehenden Evidence-Strukturen unter `/app/evidence`.
