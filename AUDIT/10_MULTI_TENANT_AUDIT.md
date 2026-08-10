# 10 — Multi-Tenancy

## 1. Modell

```
auth.users  ──1:n──▶  memberships (user_id, tenant_id, role)  ──n:1──▶  tenants
                                                                         │
   role ∈ {owner, admin, member, viewer}                                 ▼
                                     governance_assets · governance_events
                                     runtime_events · ai_evidence_events
                                     dsr_requests · findings · scan_runs
                                     subscriptions · vendors · dpias · …
```

CLAUDE.md: „Ein User gehört zu genau einem Tenant." Im Schema ist `memberships`
jedoch n:m modelliert — dazu existiert zusätzlich `tenant_memberships` (für
`runtime_events`-RLS) sowie `organizations`/`organization_members` (nicht in
Produktion). **Drei parallele Mitgliedschaftsmodelle** sind ein Konsistenzrisiko:
ein Fix in einem Modell wirkt nicht in den anderen.

---

## 2. Kette der Autorisierung

| Beziehung | Autorisierungsgebunden | Beleg |
|---|---|---|
| USER → TENANT | ✅ | `memberships`, RLS-Subquery |
| TENANT → DOMAIN/WEBSITE | ✅ | `websites.tenant_id` + RLS |
| DOMAIN → SCAN | ✅ | `scan_runs.tenant_id` |
| SCAN → FINDING | ✅ | `findings.tenant_id` |
| FINDING → EVIDENCE | ✅ | `runtime_events` RLS über `tenant_memberships` |
| TENANT → ASSET | ✅ | `governance_assets` |
| TENANT → API-KEY | ✅ | `governance_ingest_keys`, service-only |
| TENANT → REPORT | ⚠️ | `report-generator` ohne Autorisierung (F-04) |
| TENANT → BOT | ❌ | `bot_agents`, `voice_channels` **ohne RLS** (F-08) |
| TENANT → DOKUMENT | ⚠️ | `document_vault` behoben; `tax_documents` **ohne RLS** (F-08) |
| TENANT → AGENT-CONFIG | ❌ | `agent_configuration` `FOR ALL USING(true)` (F-09) |
| TENANT → ORDER | ❌ | `orders`, `order_items` **ohne RLS** (F-08) |

---

## 3. Durchgeführte Tests

**Live gegen Produktion (nur lesend, anonym):** siehe `03_DATABASE_SECURITY.md` §3 —
14 Kern-Tabellen, alle liefern `[]`. **Kein Cross-Tenant-Leak über PostgREST.**

**Nicht durchgeführt** (Regel 12/16 — keine Änderungen an Produktion, keine
Exfiltration echter Kundendaten):
- Tenant A → Tenant B Update/Delete
- Ausnutzung von F-04 gegen `governance-risk-score` (LIVE, schreibend)
- Abruf des globalen Dumps aus `enterprise-ai-os-discovery-pending` (LIVE, lesend —
  hätte fremde Kundendaten in den Audit-Kontext gebracht)

Diese Tests gehören gegen eine **lokale** Instanz und existieren dafür bereits als
`test/runtime/db/rls.db.test.ts` — sie laufen nur in keinem CI-Workflow (F-07).

---

## 4. Bewertung

**Die Datenbankschicht trägt.** Das RLS-Pattern
(`tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid())`)
ist korrekt, konsistent angewandt und live verifiziert.

**Die Anwendungsschicht trägt nicht durchgängig.** 170 von 178 Edge Functions
arbeiten mit `service_role` und umgehen RLS damit vollständig. Die Mandantentrennung
hängt dort allein an der Autorisierungslogik der jeweiligen Function — und die fehlt
in 24 Fällen (18× keine Auth, 6× wertlose Präfix-Prüfung).

**Bewertung Multi-Tenancy: 50/100.** Fundament gut, Durchsetzung lückenhaft.
Vor Aufnahme von Kanzleien oder Enterprise-Kunden mit sensiblen Beständen sind
F-04, F-05, F-08 und F-09 zwingend zu schließen.
