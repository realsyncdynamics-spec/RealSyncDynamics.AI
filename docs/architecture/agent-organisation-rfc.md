# RFC-005 — Organisations- und Rollenebene für die Agenten-Landschaft

**Status:** Draft — Bewertung eines Entwurfs, keine Freigabe zur Umsetzung
**Owner:** Runtime / Governance
**Created:** 2026-09-06
**Bezug:**
[`agent-manager-roadmap.md`](./agent-manager-roadmap.md) (M0–M4),
[`agent-os.md`](./agent-os.md) §1 (Designprinzipien),
[`governance-os-blueprint.md`](./governance-os-blueprint.md) §6 (Agentic GRC),
[`roadmap.md`](./roadmap.md) („Bewusst keine Phase"),
[Bestandsaufnahme 2026-09-06](../runbooks/agenten-bestandsaufnahme-2026-09-06.md)

**Gegenstand.** Ein Architektur-Entwurf schlägt eine Unternehmensstruktur aus
Agenten vor: CEO → AGI Manager → sechs Directors → Teams → Fach-Agenten, dazu
zehn neue Tabellen, Berichts-Rollups mit Zehn-Punkte-Deckel, ein Ticketfluss
von der Anomalie zum verifizierten Fix, ein Knowledge Graph als gemeinsames
Gedächtnis und ein schmal geschnittener Browser-Beobachter („X07").

Diese RFC entscheidet **nicht**, ob das gebaut wird. Sie klärt, was davon die
bestehende Roadmap ergänzt, was sie doppelt, wo es ihr widerspricht — und
beantwortet die fünf offenen Fragen des Entwurfs gegen den gemessenen
Repo- und Produktionsstand.

---

## §1 Der Widerspruch, der zuerst aufzulösen ist

`agent-manager-roadmap.md` §3 hält fest: *„Die Manager-Schicht ist **kein**
fünftes Agenten-System."* §5 führt „ein fünftes, neues Agenten-Framework, das
A–D ersetzt" ausdrücklich als Nicht-Phase.

Der Entwurf schlägt in dieser Lesart genau das vor: eine eigene Hierarchie mit
eigener Datenhaltung neben den vier bestehenden Subsystemen.

Der Widerspruch ist auflösbar, aber nur in einer Richtung: **Die
Organisationsebene darf keine eigene Ausführung haben.** Sie ist tragfähig als
*Beschriftung* der Registry aus M0 — wer ist wofür zuständig, an wen wird
eskaliert, wer fasst wessen Bericht zusammen — und untragbar als zweiter Ort,
an dem Agenten laufen. Konkret:

| tragfähig | untragbar |
|---|---|
| Rollen und Berichtslinien als Stammdaten **über** der M0-Registry | eigene Task-Queue neben `agent_tasks` |
| Eskalationsziel je Rolle, das M1 beim Alarmieren liest | eigener Alert-Kanal neben `governance_alerts` |
| Berichts-Rollup als Sicht auf vorhandene Läufe | eigener Runner, der Berichte erzeugt, bevor es Läufe gibt |

## §2 Was der Entwurf beiträgt — und was er doppelt

**Beiträge, die in keinem bestehenden Dokument stehen:**

1. **Trennung Rolle / Fähigkeit.** Verantwortung und Berichtslinie bleiben
   stabil, während die Besetzung (LLM, Agent, Multi-Agent) wechselt. Die
   heutige Landschaft vermischt beides: `enterprise-ai-os-agents.ts` definiert
   Zuständigkeit und Modellwahl im selben Registry-Eintrag. Die Trennung ist
   die substanzielle Idee des Entwurfs.
2. **Bericht-Kompression mit hartem Deckel.** Zehn Stichpunkte je Ebene, jede
   Pfeilspitze eine Verdichtung statt einer Weiterleitung. Das ist eine
   Antwort auf ein Problem, das die Roadmap gar nicht adressiert.
3. **Eskalation als Datensatz statt als Chat.** `agent_escalations` mit
   `reason`, `decision`, `decided_by` ist prüfbar; eine Konversation ist es
   nicht.

**Was bereits geplant oder gebaut ist:**

| Entwurf | existiert als | Verhältnis |
|---|---|---|
| `agents` / `agent_teams` (wer läuft wo) | M0 `agent_registry` + `agent_runs_unified` | **Dopplung** — der Entwurf sollte auf M0 aufsetzen, nicht daneben |
| Ticket mit Compliance-Impact → Freigabe | M3 (Approval-Routing auf `governance_approvals`) | **Dopplung** |
| Budgetgrenzen pro Team/Director | M2 (Cost-Cap über `llm-quota.ts`) | **Dopplung** |
| Browser Agent X07 | `governance-os-blueprint.md` §6.1.1 „Website Drift Agent"; im Repo `website-maintenance-agent` (deployt) und `services/playwright-scanner` | **weitgehend vorhanden** — X07 wäre eine Umbenennung plus Ticket-Ausgabe |
| Knowledge Graph | `evidence-graph-rfc.md`; Hash-Kette in `ai_evidence_events` | **teilweise** — die Navigationsschicht ist neu, die Beweisschicht nicht |

## §3 Namenskollision: das Präfix `agent_` ist belegt

Der Entwurf vergibt `agent_`-Namen, „um sie von den fachlichen
`governance_*`-Tabellen zu unterscheiden". Das trennt in die falsche Richtung:
In Produktion existieren am 2026-09-06 bereits **vierzehn** `agent_*`-Tabellen
aus vier verschiedenen Subsystemen — `agent_actions_log`, `agent_configuration`,
`agent_decisions`, `agent_events`, `agent_inputs`, `agent_knowledge_base`,
`agent_memory`, `agent_observations`, `agent_outputs`, `agent_profiles`,
`agent_runs`, `agent_sessions`, `agent_tasks`, `agent_token_usage`.

Die zehn vorgeschlagenen Namen kollidieren mit keiner davon — geprüft gegen
`pg_tables` und gegen `supabase/migrations/`. Sie wären aber im selben
Namensraum wie die Altsysteme nicht mehr von ihnen zu unterscheiden, und genau
diese Unterscheidbarkeit ist der Zweck von M4.

**Vorschlag:** Präfix `agentorg_` für die Organisationsebene
(`agentorg_units`, `agentorg_roles`, `agentorg_tickets`, …). Ein Blick auf den
Namen sagt dann, ob eine Tabelle Ausführung protokolliert oder Organisation
beschreibt.

## §4 Die fünf offenen Fragen, gegen den Ist-Stand beantwortet

**01 — Entscheidungsgrenze des Orchestrators.**
Der Entwurf schlägt eine neue Regel vor (`severity ∈ {info, warn}` und
`category ∉ {compliance, security}`). Dafür gibt es bereits eine Achse:
`enterprise-ai-os-agents.ts` deklariert je Agent eine **Autonomiestufe**
(`observe_only` → `recommend_only` → `human_approval_required` →
`limited_execution`), und `enterprise-agents.md` beschreibt, wie sie das
Ergebnis steuert. *Antwort:* keine zweite Grenzlogik erfinden — die
Autonomiestufe an die **Rolle** hängen statt an den Agenten. Das ist genau die
Rolle/Fähigkeit-Trennung aus §2 und macht M3 einfacher, nicht schwerer.

**02 — Kostenkontrolle.**
`ai_tool_runs` steht bei **0 Zeilen** (2026-09-06). Ein Budget je Team oder
Director setzt auf einer Verbrauchsmessung auf, die es heute nicht gibt.
*Antwort:* nicht vor M2 entscheidbar. Vorbedingung ist, dass überhaupt
protokolliert wird — siehe den offenen Punkt in der Bestandsaufnahme §4.

**03 — Versionierungstiefe der Berichte.**
*Antwort:* Tages-Snapshot, wie der Entwurf selbst empfiehlt. Der
Zehn-Punkte-Deckel erzwingt die Kompression ohnehin, und Event-per-Change
erzeugt genau das Bericht-Archiv, das der Knowledge Graph vermeiden soll. Die
Frage ist nachrangig — sie wird erst relevant, wenn ein zweiter Bericht
existiert.

**04 — Migrationsreihenfolge.**
Die vorgeschlagene Reihenfolge ist tragfähig und additiv; alle Namen sind frei
(§3). *Antwort:* Reihenfolge bestätigt, Präfix ändern, und **kein Schritt vor**
den Vorbedingungen aus §6. Eine Migration, die zehn leere Tabellen anlegt, ist
kein Fortschritt, sondern erhöht die Zahl der Tabellen ohne Zeilen von 351 auf
361.

**05 — Wer betreibt `is_platform_operator()`.**
Der Mechanismus existiert bereits, nur nicht als Funktion: `profiles` hat die
Spalte `is_super_admin BOOLEAN` (live bestätigt), und die Migrationen prüfen
sie an rund fünfzig Stellen als **eingebettete Unterabfrage**
(`WHERE p.id = auth.uid() AND p.is_super_admin = true`).
*Antwort:* keine eigene Rollen-Tabelle für internes Personal.
`is_platform_operator()` als `STABLE SECURITY DEFINER`-Funktion über genau
diese Spalte — gebaut wie das bestehende `is_tenant_member()`, mit
`SET search_path`. Das ist zugleich eine Verbesserung des Ist-Zustands: Die
fünfzig eingebetteten Prüfungen wären damit an einer Stelle änderbar.

> Bei Arbeit an dieser Funktion die Lehre aus dem ACL-Vorfall vom 2026-08-23
> beachten (CLAUDE.md §5): Client-Rollen brauchen ein ausdrückliches `GRANT
> EXECUTE`, und `scripts/`-Soll-Listen für `npm run check:function-acls` sind
> mitzuziehen.

## §5 Sprachregelung: die Rolle heißt nicht „AGI Manager"

`roadmap.md` führt *„‚AGI/Autonomy' oder ‚Agents replace humans'-Narrativ"* als
Nicht-Phase; `agent-os.md` §1.7 verbietet Overclaim, solange nur
Single-Skill-Executions laufen; `agent-manager-roadmap.md` §3.4 legt fest, dass
die Schicht intern „Agent Registry / Observability Layer" heißt, nicht
„Multi-Agent Manager".

Der Entwurf argumentiert dagegen an — „AGI Manager ist der Name einer Rolle,
kein Versprechen" — und das ist intern auch verteidigbar. Es hält nur nicht:
Ein Tabellenname wandert über Views, Dashboards und Screenshots nach außen, und
dort steht dann ein Begriff, den die Sprach-Leitlinie ausschließt.

*Vorschlag:* Die Rolle heißt **Orchestrator**. Sie behält Aufgabe und Position
unverändert. `unit_type` wird `executive · orchestrator · director · team` — der
Entwurf sieht diesen Wert im Enum ohnehin schon vor.

## §6 Vorbedingungen — was vor der ersten Migration erfüllt sein muss

Aus der [Bestandsaufnahme](../runbooks/agenten-bestandsaufnahme-2026-09-06.md):

1. Vault-Secret `service_role_key` angelegt (Betreiberschritt), vier rote
   Cron-Jobs wieder grün.
2. Gemessen, dass der Scan-Dispatch `websites` und `scan_runs` füllt — also
   dass die Kette Eingangsdaten hat.
3. `monitoring_sources` nicht mehr leer, `agent_observations` wächst.
4. M0 (Registry und Read-Layer) steht, mit einem Health-Kriterium, das
   **Ausgabe** misst statt Dispatch-Status.

Erst wenn (1)–(4) erfüllt sind, beschreibt eine Organisationsebene einen
Betrieb, den es gibt. Vorher beschreibt sie einen, den es nicht gibt.

## §7 Was diese RFC nicht entscheidet

- Ob die Organisationsebene überhaupt gebaut wird — das ist eine
  Produktentscheidung nach den Vorbedingungen in §6.
- Das DDL der zehn Tabellen. Der Entwurf hat die Felder; sie sind hier nicht
  wiederholt, weil sie sich mit §3 (Präfix) und §4.01 (Autonomiestufe statt
  `authority_level`) ändern.
- Den Schnitt von X07 gegen `website-maintenance-agent` und
  `services/playwright-scanner`. Dass es weitgehend vorhanden ist, steht in §2;
  ob umbenennen, erweitern oder neu bauen, gehört in eine eigene Bewertung.

---

*Erstellt 2026-09-06 auf Basis eines Architektur-Entwurfs (Draft 0.1,
2026-07-27) und einer Messung gegen die Produktions-DB vom selben Tag. Bei
Widerspruch zwischen diesem Dokument und einer späteren Messung gilt die
Messung.*
