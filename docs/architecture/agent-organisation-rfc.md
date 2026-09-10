# RFC-005 — Agenten-Organisationsebene: was ADR 0011 offen lässt

**Status:** Draft — Ergänzung zu [ADR 0011](../adr/0011-agent-organisationsmodell-plattform-scope.md), keine konkurrierende Entscheidung
**Owner:** Runtime / Governance
**Created:** 2026-09-06
**Bezug:**
[ADR 0011](../adr/0011-agent-organisationsmodell-plattform-scope.md) (Accepted, 2026-09-01),
PR #1202 (Migrationen `20260905000000`–`20260905000400`),
[`agent-manager-roadmap.md`](./agent-manager-roadmap.md) (M0–M4),
[`governance-os-blueprint.md`](./governance-os-blueprint.md) §6,
[`roadmap.md`](./roadmap.md) („Bewusst keine Phase"),
[Bestandsaufnahme 2026-09-06](../runbooks/agenten-bestandsaufnahme-2026-09-06.md)

---

## §0 Korrektur der ersten Fassung

Die erste Fassung dieses Dokuments (2026-09-06, Vormittag) trat an, um einen
Architektur-Entwurf für eine Agenten-Organisationsebene zu bewerten, und ging
davon aus, dass es dafür weder eine Entscheidung noch eine Umsetzung gibt. Das
war falsch. Richtig ist:

| Behauptung der ersten Fassung | Tatsächlich |
|---|---|
| Kein Repo-Dokument beschreibt das Organisationsmodell | **ADR 0011** liegt seit 2026-09-01 auf `main` und entscheidet fünf Vorfragen (D1–D5) |
| Die zehn Tabellennamen sind frei | `org_units` liegt seit dem Merge von PR #1135 (2026-09-06, 07:51 UTC) in `main` |
| Niemand baut die Ebene | **PR #1202** (offen seit 2026-09-04) bringt `platform_operators`, `org_units`, `agent_roles`, `agents` |

**Ursache:** Der Arbeitsstand, gegen den gemessen wurde, war der Checkout vom
2026-08-29. ADR 0011 und PR #1202 sind danach entstanden; `git grep` gegen den
lokalen Baum konnte sie nicht sehen. Die Lehre ist dieselbe wie bei Cron-
Gesundheitsprüfungen (siehe Bestandsaufnahme §3), nur eine Ebene tiefer: Auch
der eigene Checkout ist eine Messung mit Datum. Wer über den Stand von `main`
etwas behauptet, misst gegen `origin/main`.

**Ein Punkt der ersten Fassung war nicht nur überholt, sondern gefährlich.** Sie
empfahl, `is_platform_operator()` als Funktion über die vorhandene Spalte
`profiles.is_super_admin` zu bauen — „der Mechanismus existiert ja schon". ADR
0011 D5 entscheidet bewusst anders, und Befund B1 desselben ADR nennt den Grund:
Die UPDATE-Policy auf `profiles` hatte kein `WITH CHECK`, womit sich **jeder
eingeloggte Nutzer selbst `is_super_admin` setzen konnte**. Eine
Plattform-Berechtigung auf diese Spalte zu stützen, hätte eine
Rechteausweitung zur Grundlage der Sicherheitsgrenze gemacht. `platform_operators`
als eigene Quelle — RLS ohne Client-Policy, nur per Service-Role pflegbar — ist
die richtige Antwort. Die Empfehlung der ersten Fassung ist zurückgezogen.

Was unten steht, ist der Teil, der die Prüfung überlebt hat: Punkte, die ADR
0011 und PR #1202 **nicht** abdecken.

---

## §1 Was bereits entschieden ist — nicht hier wiederholt

ADR 0011 beantwortet die fünf offenen Fragen des Entwurfs abschließend:

| | Entscheid |
|---|---|
| **D1** | Autonomer Deploy nur bei `severity ∈ {info, warn}` **und** `category ∉ {compliance, security}`; serverseitige Policy-Invariante, Default-Deny für unbekannte Werte |
| **D2** | Kosten-Ledger jetzt, Enforcement nach Business-Entscheid |
| **D3** | Report-Versionierung als täglicher Snapshot |
| **D4** | Migrationsreihenfolge `platform_operators` → `org_units` → `agent_roles` → `agents` → … |
| **D5** | `is_platform_operator()` liest aus `platform_operators`, nicht aus `profiles` |

Diese RFC stellt davon nichts in Frage. Wer die Begründungen sucht, liest ADR
0011; sie sind dort belegt und vom Eigentümer angenommen.

## §2 Der ungelöste Widerspruch zur Agent-Manager-Roadmap

`agent-manager-roadmap.md` §3 hält fest: *„Die Manager-Schicht ist **kein**
fünftes Agenten-System."* §5 führt „ein fünftes, neues Agenten-Framework" als
Nicht-Phase. ADR 0011 und PR #1202 bauen eine eigene Tabellenfamilie neben den
vier bestehenden Subsystemen, ohne diesen Punkt zu berühren — er ist weder
aufgehoben noch eingelöst, sondern unerwähnt.

Auflösbar ist er, aber nur in einer Richtung: **Die Organisationsebene darf
keine eigene Ausführung bekommen.** Als Stammdatenebene über der M0-Registry —
wer ist zuständig, an wen wird eskaliert, wer verdichtet wessen Bericht — ist
sie mit der Roadmap vereinbar. Als zweiter Ort, an dem Agenten laufen, ist sie
genau die Nicht-Phase.

| vereinbar | nicht vereinbar |
|---|---|
| Rollen und Berichtslinien als Stammdaten über der Registry | eigene Task-Queue neben `agent_tasks` |
| Eskalationsziel je Rolle, das M1 beim Alarmieren liest | eigener Alert-Kanal neben `governance_alerts` |
| Berichts-Rollup als Sicht auf vorhandene Läufe | eigener Runner, der Berichte erzeugt |

Der Entscheid darüber steht aus. Er gehört in die Roadmap, nicht in eine
Migration.

## §3 Was der Entwurf beiträgt — und was doppelt

**Beiträge, die in keinem anderen Dokument stehen:**

1. **Trennung Rolle / Fähigkeit.** Verantwortung bleibt stabil, während die
   Besetzung wechselt. Die heutige Landschaft vermischt beides:
   `enterprise-ai-os-agents.ts` definiert Zuständigkeit und Modellwahl im
   selben Registry-Eintrag. ADR 0011 D4 setzt die Trennung strukturell um
   (`agent_roles` ≠ `agents`), begründet sie aber nicht als Prinzip.
2. **Bericht-Kompression mit hartem Deckel** — zehn Punkte je Ebene, jede
   Pfeilspitze eine Verdichtung statt einer Weiterleitung. Adressiert ein
   Problem, das weder Roadmap noch ADR aufgreifen.

**Was bereits geplant oder gebaut ist:**

| Entwurf | existiert als | Verhältnis |
|---|---|---|
| `agents` / `agent_teams` (wer läuft wo) | M0 `agent_registry` + `agent_runs_unified` | **Dopplung** — die Ebene sollte auf M0 aufsetzen, nicht daneben |
| Ticket mit Compliance-Impact → Freigabe | ADR 0011 D1; M3 (Approval-Routing) | entschieden |
| Budgetgrenzen pro Team/Director | ADR 0011 D2; M2 (Cost-Cap) | entschieden, Enforcement offen |
| Browser Agent X07 | `governance-os-blueprint.md` §6.1.1 „Website Drift Agent"; im Repo `website-maintenance-agent` (deployt) und `services/playwright-scanner` | **weitgehend vorhanden** — X07 wäre eine Umbenennung plus Ticket-Ausgabe, kein Neubau |
| Knowledge Graph | `evidence-graph-rfc.md`; Hash-Kette in `ai_evidence_events` | **teilweise** — Navigationsschicht neu, Beweisschicht nicht |

## §4 Namensraum: `org_units` kollidiert bereits

Am 2026-09-06 gegen `origin/main` geprüft: `20260824120000_org_subject_model_approval_gates.sql`
(aus PR #1135, gemergt 07:51 UTC) legt `public.org_units` an — mit
`tenant_id NOT NULL`, `kind`, `org_path` und **ohne** Spalte `key`. Die Fassung
aus PR #1202 (`20260905000200`) trägt eine höhere Version, läuft also später,
trifft auf `CREATE TABLE IF NOT EXISTS` und wird still übersprungen; erst der
Index auf `key` fällt.

Der PR-Autor hat das gemessen und als B7 dokumentiert — hier unabhängig gegen
`origin/main` bestätigt. Zwei Punkte, die daran hängen:

1. **Es ist ein Entscheid, kein Merge-Konflikt.** Die beiden Fassungen
   beantworten dieselbe Frage verschieden: #1135 schreibt `tenant_id NOT NULL`
   fest („Tenant bleibt die einzige Isolationsgrenze"), ADR 0011 D4/D5 verlangt
   `tenant_id IS NULL` als Plattform-Scope. Beides gleichzeitig geht nicht.
2. **GitHub zeigt es nicht.** Verschiedene Dateien, kein Textkonflikt,
   `mergeable_state: clean`. Grüne Prüfungen auf einer Basis ohne die andere
   Migration heißen hier *veraltet*, nicht *bestanden*. Dieselbe Klasse Fehler
   wie die Versionskollision vom 2026-08-24 — dort war es eine doppelte
   Versionsnummer, hier ein doppelter Tabellenname.

Zum `agent_`-Präfix: In Produktion tragen bereits vierzehn Tabellen aus vier
Subsystemen diesen Namensraum (`agent_actions_log` … `agent_token_usage`). Der
Vorschlag der ersten Fassung, die neue Ebene mit `agentorg_` zu trennen, kommt
für `org_units`/`agent_roles`/`agents` zu spät — die Migrationen sind
geschrieben und in Prüfung. Für die **noch nicht gebauten** Tabellen der Ebene
(`agent_teams`, `agent_tickets`, `agent_reports`, `agent_kg_*`,
`agent_escalations`) steht die Frage offen und ist billiger jetzt als später.

## §5 Sprachregelung: die Rolle heißt nicht „AGI Manager"

`roadmap.md` führt *„‚AGI/Autonomy' oder ‚Agents replace humans'-Narrativ"* als
Nicht-Phase; `agent-os.md` §1.7 verbietet Overclaim; `agent-manager-roadmap.md`
§3.4 legt fest, dass die Schicht intern „Agent Registry / Observability Layer"
heißt. ADR 0011 überschreibt D1 dennoch mit „Entscheidungsgrenze des **AGI
Managers**".

Intern ist das verteidigbar — der Entwurf argumentiert, es sei ein Rollenname
und kein Versprechen. Es hält nur nicht: Ein Name in einem Enum wandert über
Views und Screenshots nach außen, und dort steht dann ein Begriff, den die
Sprach-Leitlinie ausschließt.

*Vorschlag:* **Orchestrator**, bei unveränderter Aufgabe und Position. Der Wert
steht im `unit_type`-Enum des Entwurfs ohnehin
(`executive · orchestrator · director · team`). Das ist eine Umbenennung in
Dokumenten und einem Enum, keine strukturelle Änderung — und sie ist vor dem
ersten Deploy billig.

## §6 Der Betriebsbefund, den ADR 0011 nicht hat

ADR 0011 misst am 2026-09-01, dass die Tabellennamen frei sind. Es misst nicht,
ob die Ebene, die sie beschreiben sollen, in Betrieb ist. Das steht in der
[Bestandsaufnahme vom 2026-09-06](../runbooks/agenten-bestandsaufnahme-2026-09-06.md):

- `scan-scheduler-dispatch` scheitert seit 2026-08-12 am fehlenden Vault-Secret
  `service_role_key`; `websites`, `scan_runs`, `monitoring_sources` sind leer.
- Der `agent-os-runner` läuft seit 2026-09-01 grün, iteriert alle sechs Tenants
  und evaluiert **null** SLOs. `agent_observations`, `agent_events`,
  `governance_alerts`, `ai_tool_runs`: null Zeilen.

Das entwertet die Ebene nicht — Stammdaten und RLS-Struktur vor dem ersten
Betrieb festzuziehen ist genau die Begründung von ADR 0011, und sie trägt. Es
verschiebt aber, was als Nächstes zählt: Ein Ticketfluss und ein Berichts-Rollup
brauchen Beobachtungen, die es heute nicht gibt. `agent_teams` (laut PR #1202
der nächste Schritt) beschreibt eine Struktur; `agent_tickets` und
`agent_reports` beschreiben einen Betrieb. Die zweite Gruppe wartet sinnvoll,
bis die Kette oben Eingangsdaten hat.

**Vorbedingung für die Betriebs-Tabellen** (nicht für die Stammdaten-Tabellen):

```sql
SELECT vault.create_secret('<service-role-key>', 'service_role_key');
```

Ein Betreiberschritt, nicht aus dem Repo möglich.

## §7 Was diese RFC nicht entscheidet

- Nichts aus ADR 0011 D1–D5. Diese Entscheide stehen.
- Die `org_units`-Kollision aus §4 — sie ist eine Governance-Frage
  (`tenant_id NOT NULL` gegen Plattform-Scope) und gehört zum Eigentümer, nicht
  in eine nebenbei gewählte Migration.
- Ob die Organisationsebene über den Stand von PR #1202 hinaus gebaut wird.
- Den Schnitt von X07 gegen `website-maintenance-agent` und
  `services/playwright-scanner`.

---

*Erstellt 2026-09-06, korrigiert am selben Tag nach Messung gegen `origin/main`
(§0). Bei Widerspruch zwischen diesem Dokument und einer späteren Messung gilt
die Messung.*
