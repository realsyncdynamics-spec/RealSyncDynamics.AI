# ADR 0011 — Agenten-Organisationsmodell: fünf Vorentscheidungen vor der Migration

> **Status:** Accepted · 2026-09-01
> **Entscheid:** Eigentümer · **Umsetzung:** Governance Runtime
> **Related:** ADR 0004 (Enterprise Identity), ADR 0005 (Tenant-Rollenmodell),
> ADR 0006 (MFA/AAL2), RFC-003 (`docs/architecture/governance-memory-policy-rfc.md`),
> RFC-004 (`docs/architecture/governance-intelligence-economic-control-rfc.md`),
> `docs/architecture/agent-manager-roadmap.md`
> **Bindet:** den noch nicht existierenden Migrationsentwurf der
> Agenten-Organisationsebene (`org_units` … `agent_escalations`)

## Kontext

Für die Agenten-Organisationsebene standen fünf Punkte offen, die die spätere
Policy- und RLS-Struktur bestimmen — insbesondere D1 (Entscheidungsgrenze) und
D5 (Quelle der Plattform-Berechtigung). Sie werden hier **vor** dem
Migrationsentwurf festgezogen, weil eine falsche Grundstruktur später nur noch
destruktiv zu korrigieren wäre und CLAUDE.md §3 destruktive Migrationen
ausschließt.

Die Ebene ist neu: keiner der geplanten Tabellennamen existiert heute, weder im
Repo noch in Produktion (Messung unten). Es gibt also keinen Bestand zu
migrieren — nur einen Entwurf zu binden.

---

## Entscheidungen

### D1 — Entscheidungsgrenze des AGI Managers

Autonomer Deploy ist erlaubt genau dann, wenn

```text
severity ∈ {info, warn}
AND category ∉ {compliance, security}
```

Alles andere erzeugt einen Eintrag in `governance_approvals` und wartet.

| Befund | autonom |
|---|---|
| `info` + `performance` | ✅ |
| `warn` + `ux` | ✅ |
| `info` + `compliance` | ❌ |
| `warn` + `security` | ❌ |
| `error` + `performance` | ❌ |
| `critical` + beliebige Kategorie | ❌ |

**Die Grenze gilt serverseitig als Policy-Invariante, nicht als Entscheidung
des Agenten.** Der Agent darf einen Vorschlag erzeugen; ob dieser Vorschlag
ohne Freigabe ausgeführt wird, entscheidet die Policy Engine. Ein Agent, der
seine eigene Autonomiegrenze auswertet, ist kein Gate — er ist eine
Selbstauskunft.

**Abgeleitete Regel (Default-Deny):** Die Prüfung ist eine Positivliste. Eine
`severity` oder `category`, die das Gate nicht kennt, ist **nicht** autonom.
Andernfalls würde jede neu eingeführte Kategorie stillschweigend autonom —
genau die Klasse Fehler, die niemand bemerkt, weil nichts bricht.

### D2 — Kostenkontrolle: Ledger jetzt, Enforcement später

`ai_tool_runs` ist der verpflichtende Ledger für **jeden** Agent-Call.

Das Datenmodell wird von Anfang an budgetfähig gebaut, entlang der Hierarchie

```text
Platform
  └── Team
       └── Director / Agent
```

und mit Blick auf spätere Limits (`team_monthly_budget`,
`director_monthly_budget`, `agent_daily_budget`).

**Aber: keine erfundenen Limits und keine Blocking-Logik**, solange die
Business-Regeln dafür nicht entschieden sind. Ein Cap mit ausgedachter Zahl ist
schlechter als kein Cap — er sieht aus wie eine Zusage.

**Abgeleitete Regel:** „Budgetfähig" ist keine Absichtserklärung, sondern eine
Anforderung an *diese* Migration: Die Zuordnung (welcher Agent, welches Team)
muss **beim Schreiben** festgehalten werden. `ai_tool_runs` trägt heute
`tenant_id` und `user_id`, aber keine Agenten- oder Team-Zuordnung (Messung
unten). Was nicht mitgeschrieben wird, ist später nicht rekonstruierbar — ein
Budget-Enforcement, das erst 2027 kommt, kann 2026er Läufe dann nicht mehr
zuordnen.

### D3 — Report-Versionierung: täglicher Snapshot

`agent_reports` hält **einen komprimierten Zustands-Snapshot pro Tag**, maximal
10 aussagekräftige Punkte — kein Event-per-Change.

Damit ist die Semantik sauber getrennt:

```text
ai_tool_runs   = technische Ausführung
agent_tickets  = operative Arbeit
agent_kg_*     = Wissens-/Zustandsmodell
agent_reports  = Governance-Snapshot
```

Änderungen innerhalb eines Tages bleiben über `agent_tickets`, `agent_kg_*` und
`ai_tool_runs` nachvollziehbar. Der Report ist ein **Zustandsbild**, kein Event
Store — er ersetzt den Prüfpfad nicht und darf nicht als solcher zitiert werden.

### D4 — Migrationsreihenfolge

```text
org_units
→ agent_roles
→ agents
→ agent_teams
→ agent_tickets
→ agent_reports
→ agent_kg_*
→ agent_escalations
```

**Verschärfung gegenüber dem Vorschlag: Keine Tabelle wird produktiv sichtbar,
bevor ihre RLS-Policy existiert.** Nicht „RLS in einer Folgemigration", sondern
`CREATE TABLE`, `ENABLE ROW LEVEL SECURITY`, Policies und Grants in derselben
Migration. Eine Tabelle, die zwischen zwei Migrationen ohne Policy in Produktion
steht, ist in diesem Fenster offen — und Fenster dieser Art sind in diesem Repo
belegt vorgekommen (CLAUDE.md §5, `public.integrations`).

Das Modell unterscheidet **drei** Fälle, nicht zwei:

```text
tenant_id IS NULL          → Platform Scope → nur is_platform_operator()
tenant_id = current tenant → Tenant Scope   → Tenant-Mitglieder gemäß Policy
tenant_id = anderer Tenant → DENY
```

Insbesondere darf bei `tenant_id IS NULL` **niemals** versehentlich die
Standard-Tenant-Policy greifen. `is_tenant_member(NULL)` liefert `false` — das
ist richtig, aber es ist eine Eigenschaft der Implementierung, kein
zugesicherter Vertrag. Die Platform-Zeilen brauchen deshalb eine **eigene,
ausdrückliche** Policy, nicht das Ausbleiben einer anderen.

`visibility` kommt zusätzlich auf `agent_tickets` und `agent_reports`, mit den
Werten `internal` und `tenant_shared`. **`tenant_shared` bedeutet nicht
automatisch „für den Tenant öffentlich"** — die `tenant_id`-Zugehörigkeit muss
weiterhin erfüllt sein. `visibility` verengt, es erweitert nie.

**Abgeleitete Regel:** `visibility = 'tenant_shared'` bei `tenant_id IS NULL`
ist ein Widerspruch (mit wem geteilt?) und gehört per `CHECK`-Constraint
ausgeschlossen, nicht per Konvention.

### D5 — `is_platform_operator()` liest aus `platform_operators`

Die Plattform-Berechtigung bekommt eine **eigene Quelle**, keine weitere Spalte
auf `profiles`:

```text
platform_operators
------------------
user_id
role
active
created_at
```

Begründung: `profiles` beschreibt den Benutzer im normalen Produktkontext. Der
Plattform-Operator ist eine **privilegierte interne Berechtigung**, die gerade
nicht aus einem Tenant-Kontext abgeleitet werden darf. Die Sicherheitsgrenze
wird damit explizit:

```text
is_platform_operator()  →  platform_operators  →  auth.uid()
```

und **nicht**:

```text
tenant_id  →  profiles  →  irgendwelche Tenant-Rollen
```

Die Funktion ist `SECURITY DEFINER`, liefert ausschließlich `boolean`, exponiert
keine privilegierten Daten und liest aus einer eng begrenzten, **vom Benutzer
nicht manipulierbaren** Quelle. Repo-Muster dafür ist
`public.is_tenant_member()` (`20260723000001_rls_recursion_fix_security_definer.sql`):
`STABLE`, `SECURITY DEFINER`, `SET search_path = public`.

Daraus folgt für die RLS-Logik:

```sql
-- Platform Scope
tenant_id IS NULL AND public.is_platform_operator()

-- Tenant Scope
public.is_tenant_member(tenant_id)
```

Damit existiert **keine Policy, die `tenant_id IS NULL` versehentlich als
„global sichtbar" interpretiert.**

**Abgeleitete Regel — sonst wandert das Problem nur:** `platform_operators`
trägt RLS **ohne jede Client-Policy** und ohne `INSERT`/`UPDATE`/`DELETE`-Grant
für `authenticated` oder `anon`. Gepflegt wird sie ausschließlich per
Service-Role aus einer Edge Function oder per Migration. Eine
Berechtigungsquelle, die ihr eigenes Subjekt beschreiben darf, ist keine
Sicherheitsgrenze — siehe Befund B1.

---

## Was die Entscheidungen für den Migrationsentwurf binden

1. Jede der acht Tabellen bringt RLS, Policies und Grants in ihrer eigenen
   Migration mit (D4).
2. `platform_operators` und `is_platform_operator()` müssen **vor** `org_units`
   liegen — die erste Platform-Scope-Policy braucht die Funktion bereits. Die
   Reihenfolge aus D4 beginnt damit faktisch bei `platform_operators`.
3. Die Autonomiegrenze aus D1 ist eine serverseitige Prüfung (Policy Engine),
   kein Feld auf der Agenten-Zeile.
4. `ai_tool_runs` bekommt additive, nullable Zuordnungsspalten für Agent und
   Team (D2) — additiv, ohne bestehende Schreiber zu brechen.
5. `agent_reports` bekommt eine Eindeutigkeit pro (Scope, Tag) statt einer
   Append-Historie (D3).

---

## Messung 2026-09-01

Live-Projekt `RealSyncDynamicsLive` (`ebljyceifhnlzhjfyxup`, eu-central-1),
Management-API, Quellen `pg_tables`, `pg_policy`, `information_schema.columns`,
`information_schema.column_privileges`, `pg_trigger`,
`supabase_migrations.schema_migrations`.

| Prüfung | Ergebnis |
|---|---|
| `org_units`, `agent_roles`, `agents`, `agent_teams`, `agent_tickets`, `agent_reports`, `agent_escalations`, `platform_operators` in `public` | **keine davon vorhanden** — Namensraum frei |
| `governance_approvals` (Ziel von D1) | vorhanden, 0 Zeilen |
| `ai_tool_runs` (Ledger aus D2) | vorhanden, 0 Zeilen |
| `ai_tool_runs`-Spalten | `tenant_id`, `tool_id`, `tool_key`, `user_id`, `input_tokens`, `output_tokens`, `cached_tokens`, `cost_usd`, `duration_ms`, `status`, `error_code`, `error_message`, `metadata`, `created_at` |
| `profiles` | 1 Zeile, davon 1 mit `is_super_admin = true` |
| `profiles`-UPDATE-Policy | `USING ((SELECT auth.uid()) = id)`, `WITH CHECK` = **NULL**, `polroles` = **PUBLIC** |
| Spalten-Grant `profiles.is_super_admin` | `UPDATE` für `authenticated` **und** `anon` |
| Trigger auf `profiles` | nur `trig_profiles_updated_at` (setzt `updated_at`) |

Die Nullstände sind kein Ausfall: `workflow_runs`, `runtime_events`,
`agent_runs`, `agent_sessions`, `agent_token_usage` stehen ebenfalls bei 0. Die
Runtime ist in Produktion schlicht noch nicht gelaufen. Der Schreibpfad nach
`ai_tool_runs` existiert und ist plausibel (`_shared/ai.ts` schreibt per
Service-Role im Erfolgs- **und** im Fehlerfall).

---

## Befunde

Diese Befunde stammen aus der Messung zu dieser ADR, nicht aus dem Entscheid.
Sie sind **nicht** mit ihm beschlossen und brauchen eigene Entscheidungen.

### B1 — `profiles.is_super_admin` ist heute selbst setzbar (P0)

Die UPDATE-Policy auf `public.profiles` lautet `USING (auth.uid() = id)` und hat
**kein** `WITH CHECK`. Postgres verwendet in diesem Fall den `USING`-Ausdruck
auch als Check — die Zeile bleibt also erlaubt, solange `id` unverändert bleibt.
Welche **Spalten** dabei geschrieben werden, prüft die Policy nicht, und der
Spalten-Grant auf `is_super_admin` schließt `authenticated` ein. Ein
Schutz-Trigger existiert nicht.

Damit kann jeder eingeloggte Benutzer sich selbst zum Plattform-Administrator
machen. Das ist keine theoretische Grenze: `is_super_admin` steht an 51 Stellen
in 24 Migrationsdateien (RLS-Policies und Admin-RPCs), in 4 Edge Functions
(darunter `mfa-admin-reset`) und in 12 Frontend-Ansichten (7 unter
`src/features/admin/`, dazu Analytics, Audit, Market, Outreach und
`BusinessDashboard`). Dahinter liegt Cross-Tenant-Lesezugriff auf Kunden,
Leads, Onboarding-Daten, Analytics und Audits — sowie das Zurücksetzen fremder
MFA.

**Verifiziert, nicht ausprobiert.** Der Befund ist aus Policy-Definition,
Spalten-Grants und Trigger-Liste belegt; es wurde kein Eskalationsversuch
ausgeführt.

**Warum das hierher gehört:** Es ist exakt die Begründung von D5. Die
Entscheidung, die Plattform-Berechtigung aus `profiles` herauszunehmen, ist
damit nicht nur Modellhygiene — sie behebt eine offene Rechteausweitung. **D5
allein schließt sie aber nicht**: `platform_operators` regelt nur die *neue*
Ebene; die 51 bestehenden Prüfungen auf `is_super_admin` bleiben unberührt.

**Vorschlag (nicht umgesetzt, braucht Entscheid):**
1. Sofort: `WITH CHECK` auf die Policy und `REVOKE UPDATE (is_super_admin, …)`
   für `authenticated`/`anon`. Additiv, bricht keinen bekannten Schreibpfad —
   das Frontend liest die Spalte, es schreibt sie nicht.
2. Danach: `is_super_admin` gegen `is_platform_operator()` ablösen, damit es nur
   **eine** Plattform-Quelle gibt statt zweier nebeneinander. Das berührt ADR
   0005, wo `profiles.is_super_admin` als Plattform-Rolle festgeschrieben ist.

Die heutige Exposition ist gering (ein einziges Profil in Produktion, das dem
Eigentümer gehört). Sie steigt mit dem ersten fremden Sign-up auf P0.

### B2 — `ai_tool_runs` kennt keine Agenten-Zuordnung

Für D2 fehlt die Achse, entlang derer später gedeckelt werden soll: Es gibt
`tenant_id` und `user_id`, aber kein Feld für Agent, Team oder Director. Ohne
additive Spalten (oder eine verbindliche `metadata`-Konvention) ist der Ledger
zwar vollständig, aber nicht auf die Hierarchie aus D2 auswertbar.

Zweitens schreiben nach `ai_tool_runs` heute nur `_shared/ai.ts` und
`log-tool-run`. Die Subsysteme B (`agent-os-runner`, Hermes-Brief) und C
(Enterprise-Agents) hängen nicht daran — das ist derselbe Punkt, den
`docs/architecture/agent-manager-roadmap.md` §M2 bereits offen führt. „Ledger
für jeden Agent-Call" ist damit eine Zusage, die erst mit M2 eingelöst ist.

### B3 — `governance_approvals` hat keinen Anker für D1

Die Tabelle trägt `event_id`, `policy_id`, `asset_id`, `requested_action`,
`status` — aber **kein** Feld für `severity` oder `category`, also für genau die
beiden Größen, an denen D1 die Grenze zieht. Ein abgelehnter Vorschlag landet
dort ohne die Begründung, warum er nicht autonom war. Der Migrationsentwurf muss
entscheiden, ob D1 eine additive Spalte, ein strukturiertes
`requested_action`-Format oder einen eigenen Vorschlags-Datensatz bekommt.

### B4 — `agent_decisions` überschneidet sich mit dem Vorschlags-Objekt aus D1

`public.agent_decisions` existiert bereits (0 Zeilen) mit den Feldern
`decision_title`, `options`, `recommendation`, `risk_level`, `reversibility`,
`status`, `proposed_by`, `approved_by`, `superseded_by` — inhaltlich sehr nah an
dem, was der AGI Manager als Vorschlag erzeugt. Angebunden ist sie über
`src/core/decision-agent/decision.ts` und `20260529000000_decision_agent.sql`.
Vor dem Entwurf eines neuen Vorschlags-Objekts gehört geprüft, ob D1 hier
einhakt statt ein zweites, konkurrierendes Modell zu eröffnen.

Gleiches gilt für `agent_kg_*` gegenüber den vorhandenen `agent_knowledge_base`
und `agent_memory` (Letztere ist RFC-003-Gegenstand, siehe CLAUDE.md §5).

### B5 — `agent-manager-roadmap.md` §2 ist überholt

Der Abschnitt hält fest, `20260705180000_autonomous_agents_core.sql` sei nie
angewendet worden. Gemessen am 2026-09-01 ist die Version im Ledger verbucht,
und die vier Tabellen `autonomous_agents`, `autonomous_agent_runs`,
`autonomous_agent_tasks`, `autonomous_agent_events` existieren live. Die
Migration legt heute diese `autonomous_*`-Namen an, nicht mehr
`agents`/`agent_runs`/`agent_tasks`. Die Kernaussage bleibt richtig:
`public.agents` existiert in Produktion nicht — der Name ist für D4 frei. Die
Datei ist mit einem datierten Hinweis korrigiert.

---

## Offene Punkte (bewusst nicht entschieden)

- **Konkrete Budget-Zahlen** für `team_monthly_budget`,
  `director_monthly_budget`, `agent_daily_budget` — Enforcement erst nach
  Business-Entscheid (D2).
- **Enum-Umfang** von `severity` und `category`: D1 nennt `info`/`warn` und
  `compliance`/`security` namentlich; die vollständige Liste beider Achsen ist
  noch nicht festgeschrieben. Bis dahin greift die Default-Deny-Regel aus D1.
- **Rollenwerte in `platform_operators.role`** — welche Rollen es gibt und ob
  `is_platform_operator()` zwischen ihnen unterscheidet, oder ob die Funktion
  bewusst grobkörnig `boolean` bleibt und feinere Prüfungen eigene Funktionen
  bekommen.
- **Verhältnis zu ADR 0005**: ob `super_admin` (dort als Plattform-Rolle
  festgeschrieben) durch `platform_operators` ersetzt wird oder daneben bestehen
  bleibt. Zwei Plattform-Quellen nebeneinander wären der Zustand, den D5
  vermeiden will (siehe B1).
- **Der Fix zu B1** — Entscheid steht aus.
