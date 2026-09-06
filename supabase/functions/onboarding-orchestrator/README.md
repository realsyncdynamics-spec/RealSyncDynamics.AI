# onboarding-orchestrator

> **Diese Datei ist nicht geschrieben, sondern geborgen.** `index.ts` wurde am
> 2026-08-30 aus der laufenden Produktions-Function zurückgeholt, nicht neu
> verfasst. Sie stand vorher nirgends im Repo.

## Herkunft

| | |
|---|---|
| Angelegt in Produktion | 2026-08-29, 01:06 UTC |
| Zuletzt deployt | 2026-08-29, 01:17 UTC (Version 4) |
| Im Repo seit | 2026-08-30 (nachgezogen) |
| Git-History davor | **keine** |
| `verify_jwt` | `true` |
| `ezbr_sha256` der deployten Version 4 | `a2f1ec7ba615c788e0bb92fc8791015278d517be5c1349001af0793aaca1e38b` |

Die Function ging zusammen mit der Migration
`20260829011038_onboarding_orchestrator_hardening` direkt nach Produktion,
vorbei an Repo und CI — ein vollständiges Feature ohne Prüfpfad. Aufgefallen
bei der Drift-Messung vom 2026-08-30, festgehalten in `CLAUDE.md` §5.

**`index.ts` ist bewusst unverändert übernommen**, einschließlich der dichten
Formatierung. Der Zweck dieser Datei ist, dass das Repo abbildet, was
tatsächlich läuft. Wer sie umformatiert, verliert genau diese Eigenschaft —
und die Möglichkeit, den Stand gegen `ezbr_sha256` zu prüfen. Umformatieren
also erst zusammen mit einem bewussten Redeploy, nicht nebenbei.

## Was sie tut

Ein `POST` mit `{ sector, tenantId?, answers? }` provisioniert einen frisch
onboardeten Tenant in einem Durchgang:

1. `tenants` — Firmenname, Branche, `onboarded_at`, Public-Sector-Flag
2. `company_profiles` — Sektor und die Onboarding-Antworten
3. `websites` — nur wenn eine Domain angegeben war, Status `audit_pending`
4. `ai_systems` — der Assistent als registriertes KI-System (`ai_act_class: unknown`)
5. `bots` + `agent_profiles` — Persona je nach Sektor
6. `agent_configuration` — Budget, Rate-Limit, Caching
7. `agent_knowledge_base` — Firmenkontext aus dem Onboarding
8. `policy_pack_activations` — DSGVO und ISO 27001 immer; EU AI Act bei
   `healthcare`, NIS2 bei `public_sector`

Anschließend schreibt sie zwei Prüfpfad-Einträge: `inventory_audit_events`
und `enterprise_ai_audit_events`, beide mit `ONBOARDING_PROVISIONED`.

Alle Schreibvorgänge laufen über `one()` — lesen, dann aktualisieren oder
anlegen. Ein zweiter Aufruf für denselben Tenant erzeugt also keine Duplikate.

## Sicherheit

Die Function nutzt den Service-Role-Key und umgeht damit RLS. Das ist für die
tabellenübergreifende Provisionierung nötig und entspricht §4 (Service-Role
ausschließlich in Edge Functions). Sie schützt sich stattdessen selbst:

- `verify_jwt: true` auf Plattformebene
- `Authorization: Bearer …` ist Pflicht, das Token wird über
  `auth.getUser()` geprüft — kein Vertrauen in Angaben aus dem Body
- **Mandantentrennung**: Ist `tenantId` gesetzt, wird die Mitgliedschaft in
  `memberships` geprüft und sonst mit `403 FORBIDDEN` abgelehnt. Ohne
  `tenantId` wird der Tenant aus der Mitgliedschaft abgeleitet; bei mehr als
  einer Mitgliedschaft bricht sie mit `TENANT_AMBIGUOUS` ab, statt zu raten.
- `sector` wird gegen eine Allowlist geprüft
- Fehler werden geloggt, nach außen geht nur `PROVISIONING_FAILED` ohne Details

Das offene `Access-Control-Allow-Origin: '*'` ist unkritisch, weil jeder
Aufruf ein gültiges Bearer-Token braucht — CORS ersetzt hier keine
Autorisierung.

## Offen

Die Function wird **nirgends im Frontend aufgerufen** (Stand 2026-08-30) und
steht nicht in `src/config/production-edge-functions.ts`. Sie läuft, aber
niemand nutzt sie. Ob der zugehörige Onboarding-Pfad noch kommt oder das
Feature aufgegeben wurde, ist offen und eine Produktentscheidung.
