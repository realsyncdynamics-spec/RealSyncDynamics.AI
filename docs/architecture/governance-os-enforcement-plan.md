# Governance OS — Ist-Analyse, Zielarchitektur und Umsetzungsplan (Enforcement)

**Status: P0 freigegeben und umgesetzt — Umsetzungsstand in §10.**
Stand: 2026-08-24 · Branch `claude/governance-os-plan-y5rplu` · Basis `c0e0858`

Dieses Dokument beantwortet den Auftrag „RealSyncDynamics.AI zum Governance OS
ausbauen" in der geforderten Reihenfolge: messen → Zielarchitektur → Plan 1 →
kritische Prüfung des eigenen Plans → Plan 2 → Risiken → offene Entscheidungen →
Priorisierung → Aufwand.

Die Abschnitte 1–9 sind die ursprüngliche Entscheidungsvorlage und beschreiben
den Zustand **vor** der Freigabe („GO" + E8-Ja am 2026-08-24); was seitdem
gebaut wurde, steht in §10. Für P1/P2 gilt weiterhin: erst Freigabe, dann Code.

## Verhältnis zu bestehenden Dokumenten

Es existieren bereits drei Dokumente in diesem Feld. Dieses hier ersetzt keines,
sondern schließt die Lücke, die alle drei offenlassen:

| Dokument | Was es leistet | Was es offenlässt |
|---|---|---|
| `docs/architecture/governance-os-blueprint.md` (1440 Z.) | Vollständiges Zielbild inkl. Policy-DSL, Agent-Fleet, Evidence-Modell | Beschreibt Zielzustand als wäre er Ist-Zustand; §4.4 „Inline mode" existiert im Code **nicht** |
| `docs/architecture/target-architecture.md` (878 Z.) | Fünf-Ebenen-Modell, Publish Gate, Pricing-Achsen | Kein Enforcement-Modell für Fremdsysteme |
| `docs/governance-os-implementation-plan.md` (824 Z.) | Feature-Lückenliste gegen Frameworks (NIS2, ISO 42001) | Keine Messung, kein PDP/PEP-Modell, keine Machbarkeitsprüfung pro Integration |

Neu in diesem Dokument: **gemessener** Ist-Zustand, das PDP/PEP-Modell, die
ehrliche Durchsetzbarkeits-Klassifikation pro Integration, und die
Selbstkritik am eigenen ersten Plan.

---

# 1. Ist-Zustand (gemessen, nicht geschätzt)

Methode: statische Analyse des Repositories auf `c0e0858` am 2026-08-24
(`grep`/`find` über `supabase/`, `src/`, `services/`, `platform/`, `connectors/`).
**Nicht** gegen die Live-Datenbank gemessen — für Produktionsaussagen gilt
weiterhin die Regel aus `CLAUDE.md` §5: gegen die Live-DB messen.

## 1.1 Grundmaße

| Größe | Wert |
|---|---|
| Edge Functions (ohne `_shared`) | 178 |
| Migrationen | 287 |
| Tabellen (aus `CREATE TABLE` in Migrationen, dedupliziert) | 345 |
| Public Pages (`src/pages/*.tsx`) | 113 |
| Feature-Module (`src/features/*`) | 42 |
| Test-Dateien (`test/`, `tests/`, `e2e/`) | 306 |
| Python-Dateien im `platform/`-Monorepo | 67 |

## 1.2 Was an Governance **wirklich** existiert

Die Substanz ist deutlich größer als bei einem typischen Compliance-Dashboard.
Vier Bausteine sind belastbar:

**a) Eine echte Policy-Auswertung.**
`supabase/functions/_shared/policy-engine.ts` (279 Z.) ist ein reiner,
importfreier Evaluator über `ai_policies`. Er kennt fünf Regeltypen
(`data_transfer`, `model_usage`, `human_review`, `logging_required`,
`vendor_restriction`), fünf Verdikte (`allowed`/`warned`/`blocked`/
`requires_approval`/`logged`) und eine Schärfe-Präzedenz
(Block > Approval > Warn > Log > Allow). 15 Unit-Tests in
`test/policy-engine.test.ts`. Konsumenten: `telemetry-ai-event`,
`enterprise-ai-os-evaluate`, `_shared/enterprise-ai-os-agents.ts`.

**b) Ein zweiter, unabhängiger Evaluator.**
`supabase/functions/_shared/policyEngine.ts` (187 Z.) — gleiche Präzedenz-Idee,
**andere** Tabelle (`governance_policies`), **andere** Bedingungssprache
(flaches JSONB, Top-Level-AND, Array=Overlap, Fallback in `payload`).
Konsumenten: `governance-ingest`, `_shared/securitySignals.ts`.

**c) Ein dritter Gate-Evaluator, in Python.**
`platform/governance_backend/app/services/gate_engine.py` (137 Z.) +
`risk_evaluator.py` (133 Z.) entscheiden `approved`/`warning`/`blocked` für
CI/CD-Deployments. Eigener Stack, eigene DB-Verbindung, nicht in der
Root-CI (nur `codeql.yml` und `deploy-cloudflare-pages.yml` referenzieren
`platform/` überhaupt).

**d) Ein sauberer Ingest-Pfad mit Hash-Kette.**
`governance-ingest` authentifiziert per SHA-256-gehashtem API-Key, prüft
`allowed_sources`, hat einen Cross-Tenant-Guard auf `asset_id`/`policy_id`
und feuert Tenant-Webhooks ab `min_risk_level`. `runtime_events`
(Migration `20260602100000`) führt eine **pro-Tenant** SHA-256-Hash-Kette
(`prev_hash` 32 Byte, `event_hash`), Genesis = `NULL`. Das ist ein echter
Prüfpfad-Baustein, kein Marketing.

Dazu: `runtime_approval_gates` (pending/granted/denied/expired, an
`runtime_executions` gebunden) und `governance-approvals`
(`list`/`approve`/`reject`) sind vorhanden — der Approval-Zustand ist also
modelliert, nicht nur behauptet.

## 1.3 Die zentrale Lücke: es gibt keinen Enforcement-Punkt

Der Auftrag verlangt „erkennen → prüfen → erlauben/warnen/blockieren →
dokumentieren" **während** der Aktion. Der Code kann das heute nirgends.

- `telemetry-ai-event` bewertet Policies **beim Ingest** und schreibt das
  Verdikt in `policy_status`. Die Antwort enthält `policy_status`, aber der
  Aufrufer meldet die Aktion, **nachdem** sie passiert ist.
- `connectors/anthropic-wrapper.ts` und `connectors/openai-wrapper.ts` sind
  ausdrücklich Post-hoc-Telemetrie: `const response = await claude.messages
  .create({...}); await logAnthropicMessage({...})`. Der Call ist gelaufen,
  bevor die Governance etwas sieht. Ein `blocked`-Verdikt kommt zu spät.
- `supabase/functions/ai-gateway/index.ts` (249 Z.) — der eine Ort, durch den
  Inferenz tatsächlich hindurchfließt — konsultiert **keine** Policy.
  Ein `grep -Ei "policy|govern|evidence|tenant"` über die Datei und über
  `_shared/aiGateway/router.ts` liefert **null Treffer**. Es gibt dort
  Rate-Limiting (IP-Hash, Minuten-/Stundenfenster), sonst nichts.

Der Blueprint beschreibt in §4.4 zwei Modi, „Observe" und „Inline
(p99 < 50ms)". Implementiert ist ausschließlich Observe. **Diese Doku-Aussage
ist heute nicht durch Code gedeckt.**

## 1.4 Fragmentierung als Hauptbefund

Dieselbe Fachlichkeit existiert mehrfach, unabgestimmt:

| Domäne | Konkurrierende Implementierungen |
|---|---|
| Policy-Auswertung | `policy-engine.ts` (TS) · `policyEngine.ts` (TS) · `gate_engine.py` (Python) |
| Policy-Speicher | `ai_policies` · `governance_policies` (+ `governance_policy_versions`) · `decision_agent_policies` · `enterprise_agent_policies` · `policy_pack_*` |
| Evidence | `ai_evidence_events` · `governance_evidence` · `evidence_items`/`_versions`/`_links`/`_snapshots` · `audit_evidence` |
| Mandant | `tenants` + `tenant_memberships` (aktiv) · `organizations` + `organization_members` (**null Konsumenten** in `src/` und `supabase/functions/`) |
| Integrationen | `integrations`/`integration_configs` · `enterprise_connectors` · `integration_connectors` · `vps_connections` |

`enterprise_agent_policies` hat **keinen** Konsumenten im Code.
`decision_agent_policies` nur einen Typ und eine README.

Das ist kein Schönheitsproblem: Eine Policy, die der Kunde in der UI anlegt,
gilt je nach Tabelle für einen anderen Teil der Plattform. Ein „zentral
verwaltbares Regelwerk" (Auftrag §4, §6) ist so nicht herstellbar.

## 1.5 Sicherheitsbefunde (außerhalb des Auftragsrahmens gefunden, hier gemeldet)

**S1 — Kundenzugangsdaten im Klartext, aus dem Browser geschrieben. (kritisch)**
`src/features/integrations/IntegrationMarketplaceView.tsx` schreibt
`credentials` als Klartext-JSONB direkt in `integration_configs`:

```ts
const { error } = await supabase.from('integration_configs').insert({
  integration_id: selectedIntegration.id,
  name: configForm.name,
  credentials: configForm.credentials,   // Klartext
  enabled: true,
});
```

`integration_configs.credentials` ist `JSONB NOT NULL`, ohne Verschlüsselung.
Die RLS-Policy `integration_configs tenant_read` erlaubt **jedem**
Tenant-Mitglied `SELECT` — und die View liest mit `select('*')`. Jeder
`viewer` bekäme damit die API-Keys des Mandanten in den Browser.
Das verletzt Auftrag §5 („Secrets dürfen niemals unverschlüsselt in der
Datenbank oder im Frontend gespeichert werden") und `CLAUDE.md` §4.

**S1b — dieselbe Stelle ist zusätzlich funktionslos.** Der Insert setzt
`tenant_id` nicht, die Spalte ist `NOT NULL`. Der Aufruf muss scheitern.
Ein Formular, das nichts speichern kann, aber Zugangsdaten entgegennimmt,
ist nach `CLAUDE.md` §14 ein „Element, das etwas vortäuscht".
Nach §10.3 ist das Entfernen/Umschreiben **fragepflichtig** — deshalb steht
es hier als Befund und nicht als Änderung.

**S2 — `enterprise_connectors.tenant_id` ist nullable** (`tenant_id UUID`,
ohne `NOT NULL`). Bei tenant-basierter RLS ist eine NULL-Zeile je nach
Policy-Formulierung für niemanden oder für alle sichtbar. `CLAUDE.md` §3
verlangt `NOT NULL`.

**S3 — `public.app_secrets` speichert Werte im Klartext** (`value TEXT NOT
NULL`), abgesichert nur durch Deny-all-RLS plus `get_app_secret()` als
`SECURITY DEFINER` für `service_role`. Das ist für Plattform-Secrets
vertretbar, aber es ist keine Verschlüsselung — und es ist **nicht** das
Modell, mit dem man Kunden-Credentials von 5.000-Mitarbeiter-Mandanten hält.

**S4 — Hash-Kette ohne Fixierung nach außen.** `runtime_events` verkettet
korrekt, aber `service_role` kann schreiben. Ohne Append-only-Zwang auf
DB-Ebene und ohne externen Anker (Signatur + Zeitstempel eines Dritten) ist
„revisionssicher" gegenüber einem Prüfer schwer zu verteidigen. Dazu kommt
der bereits in `CLAUDE.md` §5 dokumentierte Free-Tarif ohne Backups/PITR.

**S5 — Microsoft 365 existiert nur als Attrappe.** Treffer für
`graph.microsoft`/`microsoft365` gibt es ausschließlich in
`src/lib/enterprise-ai-os/mock-data.ts` und `types.ts`. Es gibt keinen
Graph-Client, keinen OAuth-Flow, keine Subscription auf Audit-Logs.

## 1.6 Rollenmodell zu grob für den Auftrag

`tenant_memberships.role` kennt genau vier Werte:
`owner`, `admin`, `member`, `viewer`.

Auftrag §9 verlangt getrennte Sichten für CEO, Datenschutzbeauftragten,
IT-Administrator und Mitarbeiter. Ein Datenschutzbeauftragter ist kein
`admin` (er darf keine Connectors umkonfigurieren) und kein `viewer`
(er muss DSFAs freigeben). Standorte, Abteilungen und Geräte existieren als
Governance-Subjekt überhaupt nicht — `inventory_locations` ist Warenwirtschaft,
nicht Organisation.

---

# 2. Zielarchitektur

## 2.1 Der eine Satz

> Ein Governance OS ist nicht eine Menge Integrationen mit je eigener Logik.
> Es ist **eine** Entscheidungsinstanz, die viele Durchsetzungspunkte bedient.

Daraus folgt die Trennung, die dem heutigen Code fehlt:

- **PDP** (Policy Decision Point) — *entscheidet*. Einer. Kennt Policies,
  Subjekte, Klassifikation, Risiko. Kennt **keine** Integration.
- **PEP** (Policy Enforcement Point) — *setzt durch*. Viele. Sitzen je im
  Fremdsystem-Pfad, kennen dessen Protokoll, aber **keine** Policy-Logik.
- **PIP** (Policy Information Point) — *liefert Kontext*: Wer ist der Nutzer,
  zu welcher Abteilung gehört er, ist das Zielsystem freigegeben, wie ist
  diese Datei klassifiziert.
- **PAP** (Policy Administration Point) — die UI, in der Policies zentral
  verwaltet und versioniert werden.

## 2.2 Der Entscheidungsvertrag

Genau ein Datenvertrag zwischen PEP und PDP, versioniert, für alle
Integrationen gleich:

```
POST /functions/v1/governance-decide
{
  "contract": "v1",
  "tenant_id": "...",
  "principal":  { "type": "user|service|agent|device", "id": "...",
                  "org_unit": "...", "roles": ["employee"] },
  "action":     { "verb": "transfer|invoke|publish|read|write|deploy",
                  "channel": "ai_gateway|m365|siteos_publish|whatsapp|ci" },
  "target":     { "system_id": "...", "vendor": "...", "approved": false },
  "data":       { "classification": "personal_data", "signals": [...] },
  "context":    { "request_id": "...", "ts": "..." }
}
→
{
  "decision": "allow|warn|block|require_approval|log_only",
  "obligations": [ { "type": "redact", "fields": [...] } ],
  "reasons":  [ { "policy_id": "...", "policy_version": 7,
                  "rule": "data_transfer", "text_de": "..." } ],
  "approval": { "gate_id": "...", "approver_role": "dpo" },
  "evidence_id": "...",
  "ttl_ms": 30000,
  "engine_version": "..."
}
```

Zwei Eigenschaften sind nicht verhandelbar:

1. **`reasons` ist menschenlesbar und deutsch.** Auftrag §8 verlangt, dass ein
   Mitarbeiter versteht, warum etwas blockiert wurde. Der Text entsteht im PDP,
   nicht im PEP — sonst formuliert jede Integration ihre eigene Erklärung.
2. **`ttl_ms` erlaubt dem PEP zu cachen.** Ohne das ist jede
   Fremdsystem-Aktion ein zusätzlicher Netzwerk-Roundtrip.

## 2.3 Die ehrliche Durchsetzbarkeits-Klassifikation

Das ist der Teil, den Auftrag §3 verlangt und den der bestehende Blueprint
nicht liefert. **Nicht jede Aktion ist blockierbar.** Jede Integration wird in
genau eine Klasse eingeordnet, und die Klasse steht in der UI am Connector:

| Klasse | Bedeutung | Voraussetzung | Mögliche Verdikte |
|---|---|---|---|
| **A — Inline** | Aktion läuft **durch** uns, wir können sie anhalten | Wir sind im Datenpfad (Proxy/Gateway/SDK-Preflight) | allow · warn · **block** · approval |
| **B — Gate** | Aktion passiert eine Schranke, die wir besitzen | Wir kontrollieren den Übergang (Publish, Deploy, Versand) | allow · warn · **block** · approval |
| **C — Detect & React** | Wir erfahren es danach | Nur API/Webhook/Audit-Log-Zugriff | log · warn · **reagieren** (Zugriff entziehen, Ticket, Alarm) — **kein** Block |
| **D — Nicht erreichbar** | Kein technischer Zugriff | — | nur Dokumentation der Regel |

Einordnung der im Auftrag genannten Systeme, nach Prüfung des Repos und der
jeweiligen Plattform-Mechanik:

| System | Klasse | Begründung |
|---|---|---|
| Eigener AI-Gateway (`ai-gateway`) | **A** | Wir sind der Endpunkt. Sofort machbar. |
| SDK-Wrapper mit Preflight (`connectors/*`) | **A** | Nur wenn der Kunde den Wrapper einsetzt — freiwillige Adoption. |
| Eigene Agenten / Tool-Calls (`apps/agent-runtime`) | **A** | Wir betreiben die Tool-Schleife. |
| Chatbot · WhatsApp · Voice | **A** | Läuft über unsere Edge Functions. |
| SiteOS Publish | **B** | Publish Gate ist bereits als Vertrag beschrieben. |
| CI/CD-Deployment | **B** | `gate_engine.py` existiert bereits. |
| Microsoft 365 / Excel-Upload zu externem KI-Dienst | **C** | Graph liefert Audit-Events **nachgelagert**. Ein echter Block braucht Microsoft Purview DLP oder eine Netzwerk-/MDM-Ebene — **beides nicht unser Produkt**. |
| CRM · ERP · Warenwirtschaft · Logistik | **C** | API/Webhook, kein Interception-Punkt. |
| Mitarbeiter öffnet chatgpt.com im Browser | **D** (ohne Endpoint-Agent) | Ohne Endpunkt-Agent oder Unternehmensproxy technisch **nicht** abfangbar. |

**Das Beispiel aus dem Auftrag (Excel mit personenbezogenen Daten an einen
nicht freigegebenen KI-Dienst) ist damit heute Klasse C oder D, nicht A.**
Wir können es feststellen, melden, eskalieren und beweisen — verhindern nur
dann, wenn der Weg über unseren Gateway führt oder ein Endpunkt-Agent
installiert ist. Alles andere wäre eine Scheinimplementierung, und die ist
laut Auftrag §3 ausdrücklich untersagt.

## 2.4 Subjektmodell (neu)

```
tenant (bleibt die Isolationsgrenze — RLS unverändert)
└── org_unit            (Baum: Standort / Abteilung, materialisierter Pfad)
    ├── principal       (user | service_account | agent | device)
    │   └── role_binding  (Rolle × Geltungsbereich: tenant | org_unit)
    └── system          (Zielsystem, freigegeben ja/nein)
```

Rollen erweitert um `dpo` (Datenschutzbeauftragter), `it_admin`,
`compliance_officer`, `approver`. `owner`/`admin`/`member`/`viewer` bleiben
gültig — additiv, damit kein bestehender RLS-Ausdruck bricht.

Wichtig für RLS: Vererbung über den Org-Baum wird **nicht** rekursiv in der
Policy gelöst (Rekursionsgefahr, Kosten pro Zeile), sondern über einen
materialisierten Pfad (`org_path ltree`-artig als `text`) plus eine
`SECURITY DEFINER`-Auflösung — analog zum bestehenden Muster
`is_tenant_member()` aus `20260723000001`.

## 2.5 Policy-Verwaltung

- **Eine** Policy-Tabelle als Quelle der Wahrheit, versioniert
  (`governance_policy_versions` existiert bereits als Muster).
- Policies sind **Daten, nicht Code** — Auftrag §6. Sie werden gegen ein
  Schema validiert, nicht `eval`-t.
- Pro Policy ein **explizites Ausfallverhalten**:
  `on_engine_unavailable: 'allow' | 'block'`. Dieses Feld ist Pflicht ohne
  Default, damit die Entscheidung nach Auftrag §13 „nicht zufällig durch die
  Implementierung entsteht".
- Änderung einer Policy erzeugt eine neue Version + Evidence-Eintrag; PEPs
  ziehen den kompilierten Snapshot, kein Rechner wird angefasst (Auftrag §4).

## 2.6 Latenz-Modell

Der PDP darf nicht pro Entscheidung mehrere Tabellen lesen. Statt dessen:

1. Policy-Änderung ⇒ **kompilierter Tenant-Snapshot** (`policy_snapshot`,
   versioniert, unveränderlich).
2. PDP lädt den Snapshot, hält ihn im Instanz-Cache, geprüft per Version.
3. Entscheidung ist eine reine Funktion über (Snapshot, Request) —
   genau die Form, die `policy-engine.ts` heute schon hat.
4. PEP darf `ttl_ms` respektieren.

Budget: p95 < 30 ms, p99 < 80 ms für Klasse A ohne Kaltstart. Bei Kaltstart
greift das deklarierte Ausfallverhalten der Policy.

---

# 3. Plan 1 — erster Entwurf

Der Vollständigkeit halber dokumentiert, **bevor** die Selbstkritik greift.
Er ist nicht der finale Vorschlag; Abschnitt 4 zerlegt ihn.

| # | Vorhaben | Kern |
|---|---|---|
| P0-1 | Credential-Leck schließen | `integration_configs` sperren, Secrets in Edge-Function-Vault |
| P0-2 | Policy-Engines vereinheitlichen | `policy-engine.ts` und `policyEngine.ts` zu einer Engine verschmelzen, `ai_policies` und `governance_policies` in eine Tabelle migrieren |
| P0-3 | `governance-decide` bauen | Synchroner PDP-Endpunkt, liest Policies direkt aus der DB |
| P0-4 | `ai-gateway` als erster PEP | Vor jedem Provider-Call `governance-decide` aufrufen |
| P1-1 | Org-Hierarchie | `org_units`, `principals`, `role_bindings` + RLS mit rekursiver Vererbung |
| P1-2 | Rollen-Dashboards | Vier Sichten (CEO/DPO/IT/Mitarbeiter) |
| P1-3 | Endpunkt-Agent | Lokaler Agent für Windows/macOS, der Dateizugriffe abfängt |
| P2-1 | M365-Connector | Graph-Anbindung, Audit-Log-Ingest |
| P2-2 | Evidence-Konsolidierung | Fünf Evidence-Tabellen zu einer |
| P2-3 | Builder-Kopplung | Generierte Frontends erben Tenant-Policies |
| P3 | CRM/ERP/Logistik, Voice, Canva | Nach Kundennachfrage |

---

# 4. Kritische Prüfung des eigenen Plans

Zehn Befunde gegen Plan 1. Sieben davon ändern den Plan substanziell.

**K1 — P0-2 ist ein Big Bang mit Live-Verträgen. (kritisch)**
`policy-engine.ts` bedient `telemetry-ai-event`, `policyEngine.ts` bedient
`governance-ingest`. Beide sind extern erreichbare Ingest-Endpunkte mit
API-Key-Kunden. Eine Verschmelzung ändert die Bedingungssprache und damit die
Semantik bestehender Kundenpolicies **still**. Eine Policy, die heute matcht,
matcht danach vielleicht nicht mehr — und niemand merkt es, weil das Ergebnis
„allow" ist. Das ist die gefährlichste Fehlerklasse überhaupt: stilles
Nicht-Greifen einer Sicherheitsregel.
→ **Konsequenz:** keine Verschmelzung. Neue Engine v2 **neben** den alten,
Adapter je Altbestand, verpflichtende **Shadow-Phase** (v2 rechnet mit,
entscheidet nicht, Divergenzen werden protokolliert), Umschaltung erst bei
gemessener Deckungsgleichheit.

**K2 — P0-3 liest pro Entscheidung aus der DB. (kritisch)**
Ein synchroner PDP, der bei jedem Aufruf `ai_policies` liest, addiert einen
DB-Roundtrip plus möglichen Kaltstart in einen Pfad, der laut Auftrag §13
nicht spürbar verlangsamen darf. Bei einem Mandanten mit 5.000 Mitarbeitern
ist das der erste Engpass.
→ **Konsequenz:** kompilierter Policy-Snapshot + Instanz-Cache + `ttl_ms`
(Abschnitt 2.6). Das ist keine Optimierung für später, das ist Teil der
Definition von „fertig" für P0-3.

**K3 — Plan 1 hat das Ausfallverhalten vergessen. (kritisch)**
Nirgends steht, was passiert, wenn `governance-decide` nicht antwortet.
Genau davor warnt Auftrag §13. Ein Timeout, der zufällig zu „durchlassen"
führt, ist ein Sicherheitsloch; einer, der zu „blockieren" führt, legt bei
einem Ausfall die Arbeit des Kunden lahm.
→ **Konsequenz:** `on_engine_unavailable` als Pflichtfeld pro Policy, ohne
Default. Plus: der PEP muss den letzten gültigen Snapshot lokal auswerten
können, damit ein PDP-Ausfall nicht sofort zur Grundsatzfrage wird.

**K4 — P1-3 (Endpunkt-Agent) ist in P1 falsch platziert. (schwer)**
Ein Agent, der auf Mitarbeiterrechnern Dateizugriffe abfängt, ist ein eigenes
Produkt: Treiber-/Hook-Ebene je Betriebssystem, Signierung, Update-Kanal,
Betriebsrat und Mitbestimmung (§87 BetrVG), DSFA über die
Mitarbeiterüberwachung, und eine erhebliche neue Angriffsfläche — ein
kompromittierter Agent mit Dateisystem-Hook ist schlimmer als gar kein
Governance-Produkt. Für einen Mittelständler ist er außerdem der teuerste
Teil des Ganzen. Und: er blockiert nichts, solange nicht auch die
Netzwerkebene abgedeckt ist (Browser-Upload).
→ **Konsequenz:** nach P3, als eigene Produktentscheidung. Vorher wird der
Wert über Klasse A und B geliefert.

**K5 — Die Klassifikation der Daten war in Plan 1 unterstellt. (schwer)**
Der Vertrag hat ein Feld `data.classification` — aber woher kommt der Wert?
Plan 1 sagt es nicht. Ohne Klassifikation ist jede `data_transfer`-Policy
zahnlos, und eine falsche Klassifikation erzeugt entweder Fehlalarme
(Mitarbeiter umgehen das System) oder Blindheit.
→ **Konsequenz:** eigener Baustein PIP-Klassifikation mit drei Quellen in
dieser Reihenfolge: (1) deklariert durch den Aufrufer, (2) abgeleitet aus
System-/Asset-Metadaten, (3) inhaltsbasiert erkannt. Erkennungsgüte wird
gemessen und in der UI ausgewiesen; eine unsichere Klassifikation führt zu
`warn`, nicht zu `block`.

**K6 — Prompt Injection war nicht adressiert. (schwer)**
Auftrag §14 nennt es ausdrücklich. Für Klasse-A-Agenten gilt: wenn der PEP den
*Prompt* bewertet, kann ein injizierter Text die Bewertung beeinflussen.
→ **Konsequenz:** der Agent-PEP bewertet **Tool-Calls und deren Argumente**,
nicht freien Text. Der PDP bekommt strukturierte Fakten (welches Tool, welches
Zielsystem, welche Datenklasse), nie Modell-Ausgabe als Entscheidungsgrundlage.
Modellausgabe ist Evidenz, nie Autorität.

**K7 — P1-1 riskiert RLS-Rekursion. (mittel)**
Rekursive Vererbung über einen Org-Baum in einer RLS-Policy ist genau das
Muster, das im Repo bereits einmal umgangen werden musste (Kommentar in
`20260822000000`: „SECURITY DEFINER, damit die Policy keine RLS-Rekursion auf
memberships ausloest").
→ **Konsequenz:** materialisierter Pfad + `SECURITY DEFINER`-Resolver.

**K8 — Plan 1 hat den Design-Freeze übergangen. (mittel)**
P1-2 („vier Rollen-Dashboards") ist nach `CLAUDE.md` §10 kein freies Feld.
Neue Sektionen mit vorhandenen Komponenten sind erlaubt; ein Neuentwurf der
Dashboard-Oberfläche oder neue Optik ist gesperrt und bräuchte die
Drei-Fragen-Regel.
→ **Konsequenz:** Rollen-Sichten werden als **Filter und Startseiten über
bestehenden Komponenten** gebaut, nicht als neues UI-System. Wo Bestehendes
geändert werden müsste, wird gefragt.

**K9 — Wirtschaftlichkeit und Preis-Achsen fehlten. (mittel)**
Enforcement ist ein Verkaufsargument, aber Plan 1 sagt nicht, in welchem Plan
es enthalten ist. `shared/pricing.ts` ist die einzige Quelle
(`hasPermission()`/`hasModule()`/`limitOf()`), und ein Feature ohne
Entitlement wird entweder verschenkt oder später schmerzhaft nachgezogen.
→ **Konsequenz:** jede Enforcement-Fähigkeit bekommt beim Bau ein
Entitlement; die Zuordnung zu Plänen ist eine offene Entscheidung (siehe §7).

**K10 — Der Free-Tarif untergräbt das Kernversprechen. (mittel)**
Bereits in `CLAUDE.md` §5 dokumentiert: keine Backups, kein PITR, kein SLA.
Ein Governance OS, dessen Prüfpfad nicht wiederherstellbar ist, verkauft ein
Versprechen, das es nicht halten kann. Das ist keine Frage der Architektur,
sondern der Beschaffung — gehört aber in diese Vorlage, weil es P0 blockiert.

Zwei Punkte aus Plan 1 haben die Prüfung **unverändert** überstanden:
P0-1 (Credential-Leck) und P0-4 (`ai-gateway` als erster PEP). Beide bleiben.

---

# 5. Plan 2 — revidierter Vorschlag

## 5.1 Was sich gegenüber Plan 1 geändert hat

| Änderung | Grund |
|---|---|
| Engine-Verschmelzung → **v2 neben Altbestand + Shadow-Phase** | K1: stilles Nicht-Greifen von Kundenpolicies |
| PDP liest DB → **kompilierter Snapshot + Cache + TTL** | K2: Latenz bei 5.000 Nutzern |
| Ausfallverhalten **neu aufgenommen** (`on_engine_unavailable`) | K3: war schlicht vergessen |
| Endpunkt-Agent P1 → **P3, eigene Produktentscheidung** | K4: Recht, Betriebsrat, Angriffsfläche, Kosten |
| Klassifikation **neu als eigener Baustein** | K5: war unterstellt |
| Agent-PEP bewertet **Tool-Calls statt Prompts** | K6: Prompt Injection |
| Org-Vererbung rekursiv → **materialisierter Pfad** | K7: RLS-Rekursion |
| Rollen-Dashboards → **Filter über Bestehendem** | K8: Design-Freeze §10 |
| Entitlement **je Fähigkeit** ergänzt | K9: Preis-SSoT |

## 5.2 P0 — Fundament (ohne das ist nichts anderes seriös)

**P0-1 · Credential-Leck schließen** *(Aufwand: M)*
- Ziel: keine Kunden-Secrets im Browser, keine im Klartext in der DB.
- Betroffen: `src/features/integrations/IntegrationMarketplaceView.tsx`,
  `integration_configs`, neue Migration, neue Edge Function für Anlage/Rotation.
- Umsetzung: Schreib-/Lesepfad für Credentials ausschließlich über eine Edge
  Function; Speicherung als Envelope-Encryption; RLS gibt nie
  Credential-Felder frei, nur Metadaten (Status, letzter Sync, Fehler).
  `tenant_id` beim Schreiben verpflichtend.
- **Fragepflichtig nach §10.3**: die bestehende Marketplace-View muss
  geändert werden. Vorlage der Frage vor der Umsetzung.
- Tests: RLS-Test „Mitglied darf Credential-Feld nicht lesen"; Negativtest
  gegen direkten Client-Insert.

**P0-2 · Entscheidungsvertrag + PDP v2 als reines Modul** *(L)*
- Ziel: eine Entscheidungslogik, testbar ohne DB, ohne Netzwerk.
- Betroffen: neues `supabase/functions/_shared/pdp/` (+ Frontend-Spiegel für
  Vitest, wie bei `aiGateway/openaiCompat.ts` bereits praktiziert).
- Enthält: Vertrag v1 (2.2), Präzedenz, deutsche Begründungstexte,
  `on_engine_unavailable`. **Keine** Änderung an bestehenden Engines.
- Tests: Portierung der 15 Fälle aus `test/policy-engine.test.ts` +
  Äquivalenztests gegen beide Alt-Engines.

**P0-3 · `governance-decide` (synchroner PDP-Endpunkt)** *(M)*
- Betroffen: neue Edge Function; Snapshot-Tabelle + Kompilierer.
- Latenzbudget aus 2.6 ist Abnahmekriterium, nicht Wunsch.
- Evidence: jede Entscheidung ≠ `allow` erzeugt einen Evidence-Eintrag.

**P0-4 · Erster echter PEP: `ai-gateway`** *(M)*
- Betroffen: `supabase/functions/ai-gateway/index.ts`,
  `_shared/aiGateway/router.ts`.
- Vor dem Provider-Call entscheiden; `block` ⇒ HTTP 403 mit deutschem
  `reasons`-Text und optionalem „Freigabe anfordern"; `require_approval` ⇒
  Eintrag in `runtime_approval_gates`.
- Damit ist zum ersten Mal eine Aktion **tatsächlich** verhinderbar.

**P0-5 · Shadow-Mode für die Altbestände** *(M)*
- `telemetry-ai-event` und `governance-ingest` rufen v2 zusätzlich auf,
  entscheiden aber weiter mit der Alt-Engine. Divergenzen werden geloggt.
- Abnahme: definierter Beobachtungszeitraum ohne unerklärte Divergenz.
- **Ohne diesen Schritt keine Umschaltung.**

## 5.3 P1 — Nutzbar für ein echtes Unternehmen

**P1-1 · Org-Einheiten, Principals, Rollen** *(L)* — Modell aus 2.4,
materialisierter Pfad, additive Rollen, keine RLS-Rekursion.
**P1-2 · Klassifikations-PIP** *(L)* — drei Quellen, gemessene Güte,
Unsicherheit ⇒ `warn`.
**P1-3 · Rollen-Sichten** *(M)* — CEO/DPO/IT/Mitarbeiter als Filter und
Einstiegsseiten über bestehenden Komponenten (§10-konform).
**P1-4 · Approval-Flow End-to-End** *(M)* — von `require_approval` über
`runtime_approval_gates` und `governance-approvals` bis zur Rückgabe an den
wartenden PEP. Heute existieren die Teile, aber nicht die Kette.
**P1-5 · Agent-PEP** *(M)* — Tool-Calls in `apps/agent-runtime` gehen durch
`governance-decide`; Agent bekommt Identität, erlaubte Tools, Datenquellen.
**P1-6 · Evidence härten** *(M)* — Append-only auf DB-Ebene, externer Anker,
Antwort auf S4.

## 5.4 P2 — Reichweite

**P2-1 · Connector-Rahmenwerk mit Klassen-Kennzeichnung** *(L)* — ein Modell
für alle Integrationen (System, Auth-Art, Umfang, Status, letzter Sync,
Fehler, Verantwortlicher, **Enforcement-Klasse A/B/C/D**). Die Klasse steht
sichtbar am Connector; kein Kunde soll glauben, C sei A.
**P2-2 · Microsoft 365 (Klasse C)** *(XL)* — Graph-OAuth, Audit-Log-Ingest,
Reaktion statt Block. Ehrlich als „nachgelagert" ausgewiesen.
**P2-3 · SiteOS Publish Gate als PEP (Klasse B)** *(M)* — der Vertrag ist in
`target-architecture.md` §7 bereits normativ beschrieben.
**P2-4 · CI/CD-Gate anschließen (Klasse B)** *(M)* — `gate_engine.py` ruft den
PDP, statt eigene Logik zu führen.
**P2-5 · Bot-Governance vereinheitlichen** *(M)* — Chatbot, WhatsApp, Voice
über denselben PEP.

## 5.5 P3 — Vision, bewusst nach hinten

Endpunkt-Agent (K4) · Unternehmensproxy für Klasse-A-Abdeckung von
Browser-Traffic · CRM/ERP/Warenwirtschaft/Logistik · Canva und vergleichbare ·
Builder-Kopplung an Tenant-Policies · Konsolidierung der Evidence- und
Policy-Alttabellen (erst wenn v2 überall produktiv ist).

## 5.6 Was bewusst **nicht** getan wird

- Keine Löschung oder Umschreibung bestehender Policy-Tabellen in P0/P1.
- Keine Änderung an `ai_policies`/`governance_policies`-Semantik, solange die
  Shadow-Phase läuft.
- Kein `zod` (laut `CLAUDE.md` §4 keine Dependency ohne Absprache) — Validierung
  mit den vorhandenen Mitteln in `_shared/validate.ts`.
- Keine Änderung am eingefrorenen Design.
- Keine Behauptung von Blockier-Fähigkeit für Klasse C oder D.

---

# 6. Risiken

| # | Risiko | Wirkung | Gegenmaßnahme |
|---|---|---|---|
| R1 | Kunden-Credentials heute im Klartext lesbar (S1) | Kompromittierung fremder Systeme über unser Produkt | P0-1 zuerst |
| R2 | Stilles Nicht-Greifen einer Policy nach Engine-Wechsel | Compliance-Versprechen bricht unbemerkt | Shadow-Mode P0-5, Divergenz-Log |
| R3 | Latenz im Klasse-A-Pfad | Kunde umgeht den Gateway | Snapshot+Cache, p99 als Abnahmekriterium |
| R4 | Falsches Ausfallverhalten | Entweder Loch oder Arbeitsstillstand | Pflichtfeld je Policy, kein Default |
| R5 | Über-Blockieren ⇒ Schatten-IT | Governance verliert Sichtbarkeit **und** Kontrolle | Start in `warn`, Umstellung auf `block` erst nach Messung |
| R6 | Klassifikation zu ungenau | Fehlalarme oder Blindheit | Güte messen, Unsicherheit ⇒ `warn` |
| R7 | Prompt Injection | Agent umgeht Governance | PEP bewertet Tool-Calls, nie Modelltext |
| R8 | Free-Tarif ohne Backup/PITR (S4, K10) | Prüfpfad-Versprechen nicht haltbar | Beschaffungsentscheidung, siehe §7 |
| R9 | Endpunkt-Agent (falls doch früh) | Recht, Betriebsrat, Angriffsfläche | nach P3, eigene Entscheidung |
| R10 | Drei Stacks (TS-Edge, Python-`platform/`, Services) | Doppelte Wartung, divergierende Semantik | PDP ist der einzige Entscheider; Python ruft ihn auf |
| R11 | Mandant mit 5.000 Nutzern | Snapshot-Größe, Approval-Flut | Snapshot je Org-Einheit, Approval-Bündelung |

---

# 7. Offene Entscheidungen — die brauche ich von dir

Diese Punkte kann ich nicht aus dem Code beantworten. Jeder ändert den Plan.

**E1 — Reichweite des Enforcements.**
Bleibt Enforcement auf Klasse A/B beschränkt (alles, was durch uns läuft),
oder ist der Endpunkt-Agent/Unternehmensproxy ein erklärtes Produktziel?
*Empfehlung: A/B zuerst. Der Agent ist ein zweites Produkt.*

**E2 — Standard-Ausfallverhalten.**
Wenn eine Policy nichts anderes sagt und der PDP nicht antwortet:
durchlassen (Arbeitsfähigkeit) oder blockieren (Sicherheit)?
*Empfehlung: durchlassen + laute Alarmierung, außer bei Policies, die
ausdrücklich `block` deklarieren — dort fail closed.*

**E3 — Welche Policy-Tabelle wird die Quelle der Wahrheit?**
`ai_policies` (feinere Regeltypen) oder `governance_policies` (versioniert)?
*Empfehlung: `governance_policies` als Träger, Regeltypen aus `ai_policies`
übernehmen — Versionierung ist teurer nachzurüsten als Regeltypen.*

**E4 — Supabase-Tarif.**
Ohne Backups/PITR ist „revisionssicherer Prüfpfad" nicht verteidigbar.
Wird der Tarif vor dem ersten Enforcement-Kunden gewechselt?

**E5 — Rolle des `platform/`-Monorepos.**
Bleibt der Python-Stack als zweite Laufzeit (dann: er ruft den PDP), oder wird
er mittelfristig eingeschmolzen?

**E6 — Erste echte Fremdintegration.**
Microsoft 365 (größter Kundenwunsch, aber Klasse C und XL) oder erst die
eigenen Kanäle vollständig (Gateway, Agenten, Bots, Publish)?
*Empfehlung: eigene Kanäle zuerst — sie sind die einzigen, wo wir wirklich
blockieren können, und sie beweisen das Produkt.*

> **Entschieden am 2026-09-04: eigene Kanäle.** Damit ist P2-2 (Microsoft 365)
> zurückgestellt und die Reihenfolge festgelegt: P2-3 (Publish Gate) → P2-4
> (CI/CD-Gate) → P2-5 (Bot-Governance). P2-3 ist umgesetzt.

**E7 — Preis-Zuordnung.**
In welchen Plänen ist aktives Enforcement enthalten? Ohne Antwort kann ich
`shared/pricing.ts` nicht sauber erweitern.

**E8 — Freigabe für P0-1.**
Die Änderung an `IntegrationMarketplaceView.tsx` ist nach §10.3
fragepflichtig. Formal:
> **Achtung, Funktionsänderung — sollen wir dies machen? Ja oder nein?**
> Betrifft: Speicherung von Zugangsdaten in
> `src/features/integrations/IntegrationMarketplaceView.tsx`. Zugangsdaten
> würden künftig nicht mehr aus dem Browser in die Datenbank geschrieben,
> sondern über eine Edge Function verschlüsselt abgelegt und nie mehr
> zurückgelesen.

---

# 8. Priorisierung und Begründung

1. **P0-1 (Credentials)** — zuerst, weil es ein offenes Leck ist und weil
   jede Integration darauf aufbaut. Ein Governance-Produkt, das selbst Secrets
   verliert, ist erledigt (Auftrag §14).
2. **P0-2/P0-3 (PDP)** — die eine Entscheidungsinstanz. Jeder PEP danach ist
   billig, jeder PEP davor wäre wieder eine Insellösung.
3. **P0-4 (`ai-gateway` PEP)** — der erste Punkt, an dem die Plattform von
   „stellt fest" zu „verhindert" wechselt. Kleinster Weg zum Beweis.
4. **P0-5 (Shadow)** — Voraussetzung dafür, den Altbestand überhaupt
   anfassen zu dürfen.
5. **P1-1/P1-2 (Org + Klassifikation)** — ohne sie sind die Policies aus §2
   des Auftrags („user.role = employee", „data.classification =
   personal_data") nicht formulierbar. Sie sind die Voraussetzung dafür, dass
   Enforcement über den Einzelfall hinaus etwas bedeutet.
6. **P1-4 (Approval-Kette)** — löst die Anforderung „der CEO darf nicht jede
   Aktion freigeben müssen": Freigabe geht an eine **Rolle**, nicht an eine
   Person.
7. Alles Weitere nach E6.

---

# 9. Aufwand

Relativ, keine erfundenen Zeitangaben.

| Phase | Umfang | Aufwand |
|---|---|---|
| P0-1 Credentials | 1 View, 1 Migration, 1 Edge Function, RLS-Tests | **M** |
| P0-2 PDP-Modul | Neues `_shared/pdp/`, Vertrag, Tests, Äquivalenztests | **L** |
| P0-3 `governance-decide` | Edge Function, Snapshot-Kompilierer, Cache | **M** |
| P0-4 `ai-gateway` PEP | Eingriff in bestehenden Pfad + Fehlerbilder | **M** |
| P0-5 Shadow-Mode | 2 Edge Functions, Divergenz-Log, Auswertung | **M** |
| **P0 gesamt** | | **L–XL** |
| P1-1 Org/Principals/Rollen | Migrationen, RLS-Resolver, Tenant-UI | **L** |
| P1-2 Klassifikation | Drei Quellen, Güte-Messung | **L** |
| P1-3 Rollen-Sichten | Filter über Bestehendem (§10-konform) | **M** |
| P1-4 Approval-Kette | Verbindung vorhandener Teile + wartender PEP | **M** |
| P1-5 Agent-PEP | Tool-Call-Interception in `apps/agent-runtime` | **M** |
| P1-6 Evidence härten | Append-only, externer Anker | **M** |
| **P1 gesamt** | | **XL** |
| P2-1 Connector-Rahmen | Modell + UI + Klassen-Kennzeichnung | **L** |
| P2-2 Microsoft 365 | OAuth, Graph, Audit-Ingest, Betrieb | **XL** |
| P2-3/4/5 Publish · CI · Bots | je vorhandene Pfade an PDP hängen | **M** je |
| P3 | Endpunkt-Agent, Proxy, CRM/ERP, Alt-Konsolidierung | **XL+** |

---

# 10. Umsetzungsstand

**2026-08-24 — Freigabe „GO" erhalten.** Umgesetzt auf diesem Branch:

| Vorhaben | Stand | Wo |
|---|---|---|
| P0-2 PDP-v2-Kern | ✅ | `supabase/functions/_shared/pdp/core.ts` — Vertrag v1, Kompilierung beider Alt-Formate, deutsche Begründungen, Ausfallverhalten. 21 Tests inkl. Äquivalenz gegen beide Alt-Engines (`test/governance/pdp-core.test.ts`) |
| P0-3 Snapshot + Endpunkt | ✅ | Migration `20260824090000_pdp_snapshots_shadow.sql` (`policy_snapshots`, `pdp_shadow_log`, RLS) · `_shared/pdp/decide.ts` (Instanz-Cache, 30 s TTL) · Edge Function `governance-decide` (`rsd_gov_`-Key-Auth, Evidence bei Nicht-allow) |
| P0-4 ai-gateway-PEP | ✅ | `AI_GATEWAY_ENFORCEMENT=off\|shadow\|enforce`, **Default `shadow`** — Produktionsverhalten ändert sich erst durch bewusstes Umschalten. Grenze dokumentiert: Gateway ist tenant-los (nur globale Policies), Vendor steht erst nach Routing fest |
| P0-5 Shadow-Mode | ✅ | `telemetry-ai-event` und `governance-ingest` rechnen v2 auf denselben geladenen Policy-Zeilen mit; Divergenzen → `pdp_shadow_log`. Antwortverhalten unverändert |
| P1-1 Subjektmodell | ✅ (Freigabe „go" 2026-08-24) | Migration `20260824120000`: `org_units` (materialisierter Pfad, Zyklen-/Tenant-Guard per Trigger, Teilbaum-Umhängen inkl. Nachfahren-Repath), `principals` (user/service/agent/device), `role_bindings` (additive Rollen `dpo`/`it_admin`/`compliance_officer`/`approver`/`employee`, Geltungsbereich Tenant oder Teilbaum). PIP-Anreicherung in `decide.ts` (Rollen entlang des Org-Pfads); generic-Bedingungen `principal_roles`/`principal_type`/`org_unit` (Teilbaum-Matching) mit payload-Fallback ohne Principal (K1-Schutz) |
| P1-4 Approval-Kette | ✅ (Freigabe „go" 2026-08-24) | `pdp_approval_gates` (Request-Fingerprint `approvalFingerprint()`, genau ein offenes Gate je Fingerprint, 7-Tage-Ablauf); `decide()` erzeugt Gates und erkennt erteilte Deckung (→ allow mit Begründung); `governance-approvals` neu: `gates_list`/`gate_approve`/`gate_reject` — freigeben darf owner/admin **oder** die Rolle aus `approver_role`; Evidence je Gate-Entscheidung. v1-Grenze dokumentiert: Rollen-Check tenantweit, Teilbaum-Eingrenzung folgt mit P1-3 |
| P1-2 Klassifikations-PIP | ✅ (Freigabe „go" 2026-08-24) | `_shared/pdp/classify.ts`: Signal-Erkennung (`detectSignals()`) läuft **beim PEP**, an den PDP gehen nur Signalnamen — nie Inhalte (DSGVO Art. 5 Abs. 1 lit. c). Drei Quellen (Deklaration, Stammdaten, Signale); **Abweichung vom Planwortlaut, begründet**: den Wert bestimmt die *strengste* Quelle, nicht die erste — eine Deklaration `public` hätte sonst jede `data_transfer`-Regel ausgehebelt. Unsichere Klassifikation (< 0,6) schwächt einen **klassifikationsbasierten** Block zur Warnung ab, mit Ausweis in `classification.downgraded_from`; Vendor-/Rollen-/Modellsperren bleiben hart |
| P1-3 Rollen-Sichten (Gate-UI) | ✅ (Freigabe „go" 2026-08-24/25) | `/app/governance/gates` (`ApprovalGatesView`): offene Gates freigeben/ablehnen mit Pflichtbegründung, Statusfilter, Ablaufanzeige, Fingerprint. `AccessManagementPanel`: Einheiten anlegen/umbenennen/löschen, Principals anlegen und deaktivieren, Rollen vergeben/entziehen — **schreibend über `governance-access`**, nie direkt aus dem Browser, damit jede Rollenvergabe im Prüfpfad landet. `/app/governance/start` (`GovernanceHomeView`): rollenspezifischer Einstieg (Datenschutz, IT, Compliance, Freigabe, Mitarbeitende) als **Filter über den vorhandenen Modulen**, kein neues UI-System. Alles mit vorhandenen Komponenten und Tokens (§10.2) |
| P1-5 Agent-PEP | ✅ (Freigabe „go" 2026-08-25; `/voice-tool` am 2026-08-30 nachgezogen) | `_shared/pdp/toolcall.ts`: Abbildung Tool-Call → Entscheidungsanfrage, **einmalig auf der PDP-Seite** (nicht je Runtime — Fragmentierungsbefund §1.4). `governance-decide` nimmt zusätzlich die Form `{ contract:'v1', tool_call:{…} }`. `apps/agent-runtime`: `sanitizeToolCall()` als Manipulationsgrenze — es verlassen nur Werkzeugname, Aufgabenart, Zielsystem, Anbieter, Modell, deklarierte Klasse und die **Namen** der Argumente den Prozess; **keine Argumentwerte, kein freier Text, keine Modellausgabe** (K6). `AGENT_PDP_ENFORCEMENT=off\|shadow\|enforce`, Default `shadow`. Die lokale Prüfung bleibt erste Schranke: der PDP kann zusätzlich anhalten, nie zusätzlich erlauben. Gilt für **beide** Werkzeugrouten — `/run-agent` und `/voice-tool`; letztere kam mit #1127 während der Arbeit hinzu und entschied bis dahin allein über ihre Kanal-Policy, also an der zentralen Governance vorbei |
| P1-6 Evidence-Härtung | ✅ (Freigabe „go" 2026-09-01) | **Korrektur der eigenen Ist-Analyse:** Befund S4 war zu pauschal — `runtime_events` ist seit 20260602100000 gehärtet (Reject-Trigger, Verifier-RPC). Die Lücke lag bei `ai_evidence_events`, genau der Tabelle, in die der PDP schreibt. Migration `20260901090000`: UPDATE ausnahmslos abgewiesen (eine Korrektur ist ein neuer Eintrag); DELETE nur über `ai_evidence_purge_expired()`, die den Nachweis **vor** der Löschung schreibt und ohne hinterlegte Frist nichts löscht — kein absolutes Löschverbot, weil DSGVO Art. 17 und die eigene Aufbewahrungsregel Löschen möglich lassen müssen. `ai_evidence_verify_chain()` rechnet die Kette nach statt sie zu glauben. `evidence_anchors` (append-only, Ed25519-signiert soweit Schlüssel vorhanden) hält Prüfpunkte fest; Edge Function `evidence-anchor` und `/app/governance/evidence` machen das bedienbar. **Grenze im Code, in der Doku und in der Oberfläche benannt:** Das macht Manipulation nicht unmöglich — wer service_role hält, kann den Ausnahmepfad selbst setzen. Es hebt die Schwelle von „stilles Umschreiben durch beliebigen Code" auf „ausdrückliche Absicht" und macht spätere Änderungen **erkennbar**, sofern der Anker die Plattform verlässt. Ein Anker, den niemand exportiert, ist Dekoration; echte Unveränderlichkeit braucht WORM-Speicher oder einen Zeitstempeldienst Dritter (Klasse C, eigene Integration) |
| P0-1 Credentials | ✅ (E8: **Ja** am 2026-08-24) | Migration `20260824110000`: Spaltenrechte — `credentials`/`credentials_enc` erreichen Clients nie mehr, kein Client-INSERT; Edge Function `integration-credentials` (AES-256-GCM-Siegel via `_shared/secretBox.ts`, owner/admin-only, Audit-Log, 503 statt Klartext-Fallback); View liest/schreibt nur noch Metadaten |

**P1 ist damit vollständig.**

**2026-09-04 — P2 begonnen (Freigabe „go").**

| Vorhaben | Stand | Wo |
|---|---|---|
| P2-4 CI/CD-Gate als PEP | ✅ (E6, eigene Kanäle zuerst) | Derselbe Befund wie bei P2-3, in der dritten Laufzeit: `platform/governance_backend/app/services/gate_engine.py` entschied vollständig aus eigener Logik (Risikoklasse, Gate-Katalog, Build-Artefakte); die Mandantenrichtlinien hatten an der **Auslieferungsschranke** keine Wirkung — Risiko R10 („drei Stacks, divergierende Semantik") an genau der Stelle, an der es weh tut. Neu: `app/services/pdp_client.py` ruft `governance-decide` über HTTP; `GOVERNANCE_PDP_MODE=off\|shadow\|enforce`, Default `shadow`. **Bewusste Abweichung vom Planwortlaut**: Der Plan sagt „ruft den PDP, **statt** eigene Logik zu führen". Wörtlich genommen wäre das ein Rückbau guter Regeln (Art. 5 AI Act: verbotene Praktik liefert nie aus; fehlende Tests blockieren immer). Der PDP kommt deshalb **hinzu** und kann nur verschärfen, nie lockern — ein `allow` macht aus einem lokal blockierten Build kein `approved`. Das ist die zentrale Prüfung der Testdatei, nicht eine Randnotiz. `require_approval` **sperrt** hier, statt durchzuwinken: Eine Pipeline kann niemanden fragen; die Begründung nennt den Weg zur Freigabe, sonst wäre die Sperre eine Sackgasse. Ausfall sperrt (wie P2-3), nennt sich aber ausdrücklich als Ausfall und **nennt den Ausweg** (`GOVERNANCE_PDP_MODE=off`) — ein blockierender PDP hielte sonst auch die Auslieferung des eigenen Fixes an. „Nicht konfiguriert" ist bewusst **kein** Ausfall, sonst blockierte die Anbindung jede Umgebung ohne PDP. Tests: 14 Fälle (`tests/test_gate_pdp.py`) |
| P2-3 SiteOS Publish Gate als PEP | ✅ (E6 entschieden 2026-09-04: eigene Kanäle zuerst) | **Befund vorweg, weil er den Umfang bestimmt:** Der Publish Gate existierte seit dem 2026-08-22 — korrekt als Klasse-B-Schranke, fail-closed, hash-gebunden. Er rief aber **keinen PDP**. `policy_compliant` und `human_approval_required` kamen ausschließlich aus fest verdrahteten Regeln in `gate.ts` (Dimensions-/Severity-Tabelle plus zwei Blueprint-Flags); die Richtlinien des Mandanten hatten beim Veröffentlichen **keine Wirkung**. Genau §1.4 und R10, an der schärfsten Stelle des Produkts. P2-3 war deshalb „Gate an den einen Entscheider hängen", nicht „Gate bauen". **Der Vertrag aus Zielarchitektur §7 bleibt wörtlich unverändert**: Das Verdikt wird in die vorhandenen Felder gefaltet — `block` → `policy_compliant=false`, `require_approval` → `human_approval_required=true`, `warn` → Warnung. Kein sechstes Feld, weil das die generierte Spalte in der Datenbank und die Ableitung im Kern hätte auseinanderlaufen lassen (G2). `PolicyEngineState` ist **Pflichtfeld**: Wäre es optional, sähe „nicht befragt" genauso aus wie „vergessen zu befragen" — die K1-Fehlerklasse. Der Typ zwang prompt beide Bestandstests, sich zu erklären. Der PDP-Aufruf liegt im Deno-Handler, nicht im Kern: `gate.ts` bleibt abhängigkeitsfrei und deterministisch, sonst wäre keine Bewertung mehr nachvollziehbar. `SITEOS_PUBLISH_PDP=off|shadow|enforce`, **Default shadow** — der Merge ändert das Produktionsverhalten nicht. **Ausfallverhalten weicht bewusst ab**: hier fail-closed nach §7 G3, nicht fail-open wie der allgemeine Default aus E2 — Veröffentlichen ist eine bewusste, wiederholbare Handlung, und §7 ist normativ und spezieller. Die Sperre nennt den Ausfall beim Namen, damit niemand den Fehler in den Analysebefunden sucht |
| P2-1 Connector-Rahmenwerk | ✅ | **Die Klasse ist abgeleitet, nicht eingegeben** — das ist der ganze Punkt. `shared/enforcement-classes.ts` trägt die Zuordnung Systemtyp → Klasse samt Begründung; `connector_enforcement_class()` (Migration `20260904100000`) trägt sie in SQL; ein BEFORE-Trigger auf `connector_registry` **überschreibt** jeden mitgeschickten Wert. Dürfte ein Mandant sein Microsoft 365 auf „A" setzen, behauptete die Oberfläche eine Blockierfähigkeit, die es dort nicht gibt — genau die Scheinimplementierung, die der Auftrag §3 untersagt. Ein DB-Test stellt den Angriff nach. Unbekannte Systemtypen ergeben **C, nicht A**: Ein System, dessen Integrationspunkt niemand belegt hat, kann nichts verhindern. `connector_enforcement_summary()` beantwortet die erste Prüferfrage („bei wie vielen können Sie wirklich verhindern?") in der Datenbank statt im Frontend, wo eine falsche Formel unbemerkt bliebe. Oberfläche: `/app/governance/connectors`. **Additiv**: Die vier Bestandstabellen (`integrations`, `integration_configs`, `integration_connectors`, `enterprise_connectors`) bleiben unangetastet, die Registratur legt sich darüber und zeigt per `source_table`/`source_id` auf die jeweilige Zeile |

| P2-3 SiteOS Publish Gate als PEP | ✅ | **Das Gate kannte die Regeln seines Betreibers nicht.** `policy_compliant` kam allein aus der fest verdrahteten Befundtabelle des Produkts (`LEGALLY_BLOCKING` × Severity) — die Untergrenze für jeden Mandanten, aber nicht die Regel DES Mandanten. Wer „keine Veröffentlichung ohne Freigabe des DSB" hinterlegt hatte, hatte keinen Weg, das auf die Veröffentlichung wirken zu lassen; die Oberfläche zeigte trotzdem ein Gate. Jetzt fragt der Handler den PDP (`consultPolicyEngine`, Kanal `siteos_publish`, Verb `publish`). **Die normative Ableitungsregel aus §7 bleibt unangetastet**: `block` nimmt `policy_compliant`, `require_approval` setzt `human_approval_required`, `warn` erzeugt einen Hinweis — ein sechstes Vertragsfeld hätte §7 geändert. **Fail-closed** nach G3 im Durchsetzbetrieb, ausdrücklich anders als der allgemeine Default (E2): Ein durchgelassener Gateway-Aufruf lässt sich nachträglich bewerten, eine Veröffentlichung nicht zurückholen. Der Default ist `SITEOS_PUBLISH_PDP=shadow` — der dritte Zustand `not_enforcing` macht im Sperrtext sichtbar, dass die Regeln des Mandanten hier gerade **nicht** binden. Wer das verschweigt, lässt ein Gate strenger wirken, als es ist |

**Zur Injektionsgrenze bei P2-3 (K6), schärfer als beim Agenten:** Ein
Blueprint besteht überwiegend aus fremdem Text — aus dem Prompt eines Nutzers
oder aus einer **gescannten fremden Website**. Ginge er in die
Entscheidungsgrundlage, könnte der Betreiber der gescannten Seite die Bewertung
seiner eigenen Übernahme beeinflussen, durch nichts weiter als einen Satz auf
seiner Startseite. Den Prozess verlassen deshalb nur Merkmale, keine Inhalte:
Slug, Artefakt-Hash, Befund**zahl**, DSFA-Kennzeichen, Art.-9-Einstufung.

**Zwei Umsetzungen, zusammengeführt am 2026-09-04.** Zwei Sitzungen haben P2-3
unabhängig gebaut — dasselbe Muster wie beim `gdpr-audit`-Ausfall (CLAUDE.md
§5). Beide kamen zum **gleichen** Vertragsergebnis: Faltung in vorhandene
Felder, kein sechstes Feld, fail-closed. Sie unterschieden sich im Default.
Übernommen wurde die Fassung mit `shadow` als Vorgabe, weil die andere auf
einer nachprüfbar **falschen** Prämisse beruhte: Sie nahm an, es gebe keinen
Publish-Pfad in Produktion. `cloudflare-deployer` und `website-domain-manager`
stehen aber beide in `PRODUCTION_SET` — sofortiges Durchsetzen hätte echte
Veröffentlichungen sperren können. Lehre: Eine Prämisse, die eine
Vorsichtsmaßnahme überflüssig erscheinen lässt, ist die, die man misst.

**Zwei Lagen, ein Vertragsfeld — und warum das in der Datenbank steht:** Im
Contract sind „eine Richtlinie hat gesperrt" und „der PDP war nicht erreichbar"
beide `policy_compliant: false`. Für den Betroffenen ist der Unterschied
entscheidend (Site ändern vs. Dienst reparieren), für einen Prüfer ebenso: Ein
Gate, das wegen eines Ausfalls sperrt, hat nicht „die Richtlinie durchgesetzt".
Migration `20260904110000` trennt die drei Lagen (`consulted`,
`not_enforcing`, `unavailable`) maschinell auswertbar und erzwingt per CHECK,
dass ein **Ausfall** nie als konform gespeichert werden kann — dieselbe
Überlegung, aus der `publishable` eine generierte Spalte ist.

| P2-5 Bot-Governance | ✅ | **Drei kundenseitige Kanäle liefen ohne jede Richtliniendurchsetzung.** `bot-chat`, `whatsapp-webhook` und `bot-voice-webhook` enthielten keinen einzigen Treffer für `decide` oder `policy`. Jetzt hängen alle drei an **einem** PEP (`_shared/pdp/botmessage.ts`), jeweils **vor** dem Modellaufruf — danach ist das Geld ausgegeben, und bei WhatsApp und Voice ist die Antwort erzeugt. `BOT_PDP_ENFORCEMENT=off\|shadow\|enforce`, Vorgabe `shadow`; in `enforce` fail-closed. `require_approval` sperrt dort wie `block`, und das ist eine Entscheidung: Web-Chat, WhatsApp und Telefonat sind synchron, es gibt niemanden, der binnen Sekunden freigeben könnte |

**Zur Injektionsgrenze bei P2-5 — die schärfste im Produkt:** `bot-chat` und
`whatsapp-webhook` laufen mit `verify_jwt = false`. Der Text, über den
entschieden wird, stammt von **einem beliebigen Fremden aus dem Internet**.
Ginge er in die Entscheidungsgrundlage, könnte jeder Absender die Regeln des
Mandanten adressieren, indem er sie in seine Nachricht schreibt. Den Prozess
verlassen deshalb nur Signal**namen** aus `detectSignals` und Zählwerte — kein
Zeichen des Textes. Ein Test schickt eine Nachricht mit Injektionsversuch und
IBAN durch und weist nach, dass beides die Anfrage nicht erreicht.

**Der Sperrgrund erreicht den Absender nie.** Er ist Kunde *des Mandanten*,
nicht der Mandant. Ihm die Richtlinie zu nennen, gäbe interne Regeln an einen
Dritten preis — und lüde dazu ein, sie durch Umformulieren zu umgehen. Er
bekommt einen neutralen Satz, der Prüfpfad die Begründung. Stille wäre die
schlechteste Variante: Sie klingt nach technischem Ausfall.

### Befund in der eigenen P2-3-Umsetzung, gefunden und behoben am 2026-09-04

Beim Bauen des Bot-PEP fiel auf, dass der Publish Gate
`logShadowComparison(admin, tenantId, 'siteos_publish', request, result, null)`
aufrief — **sechs Positionsargumente gegen eine Objekt-Signatur**. `entry` war
damit die Tenant-ID, `entry.tenant_id` undefined, der Insert wäre an `NOT NULL`
gescheitert. Der Aufruf lag hinter `.catch(() => {})`.

Zweiter, unabhängiger Fehler an derselben Stelle: `pdp_shadow_log.source` liess
`siteos_publish` gar nicht zu — die CHECK-Bedingung kannte nur die drei
Alt-Pfade. Auch ein *korrekter* Aufruf wäre abgewiesen worden.

**Die Folge wiegt schwerer als der Fehler**: `shadow` ist der Vorgabewert. Der
Beobachtungsbetrieb — die Vorstufe, aus der heraus über `enforce` entschieden
werden soll — hätte also nichts gesammelt, und zwar im Normalfall, still.

**Kein vorhandenes Gate konnte das sehen**: `tsc --noEmit` deckt
`supabase/functions` nicht ab, `check:edge-syntax` ist ein Parse-Check,
`check:edge-refs` prüft nur, ob Namen auflösen. Geschlossen durch
`test/governance/bot-pep-wiring.test.ts`, das alle Aufrufstellen am Quelltext
prüft und dessen Wirksamkeit gegen den wiederhergestellten Fehler belegt ist.
Migration `20260904120000` erweitert die CHECK-Bedingung additiv.

**Nebenbefund**: `_shared/pdp/decide.ts` stand nie unter dem Typechecker, weil
kein Test sie importierte. Der erste Import brachte einen echten Typfehler ans
Licht (`Set<unknown>` gegen `string[]`). Behoben. Die Datei steht damit ab
jetzt unter `npm run lint`.

**Offen in P2**: nichts mehr — P2-1, P2-3, P2-4 und P2-5 sind umgesetzt. P2-2 (Microsoft 365)
bleibt zurückgestellt — **E6 ist am 2026-09-04 vom Eigentümer entschieden:
eigene Kanäle zuerst.** Offen bleiben E1–E5 und E7 aus §7 sowie Phase P3.

**Drei Entscheidungen liegen beim Eigentümer** — und es ist dieselbe Frage
dreimal: `SITEOS_PUBLISH_PDP` (P2-3), `GOVERNANCE_PDP_MODE` (P2-4) und
`BOT_PDP_ENFORCEMENT` (P2-5) stehen alle auf `shadow`. Bis jemand `enforce`
setzt, binden die Richtlinien des Mandanten **nirgends** — die Kanäle sind
verdrahtet, das Protokoll füllt sich, gesperrt wird nichts.

Das ist der beabsichtigte Zwischenzustand und kein Versehen: So verlangt es
das Vorgehen aus P0. Aber er ist eben auch keine Durchsetzung. Der
Umschaltzeitpunkt gehört entschieden, sonst bleibt das ganze Governance OS ein
Beobachter mit vollständiger Verkabelung. Grundlage dafür ist
`pdp_shadow_log` — und die schrieb bis zum 2026-09-04 für den Publish Gate
nichts, siehe oben.

### Befund am Prüfstand selbst, gemessen am 2026-09-04

Beim Verdrahten von P2-3 zeigte sich, dass **`Migration validation` nur
`security-regressions.db.test.ts` ausführt**, nicht das Verzeichnis. Die
DB-Tests aus P2-1 (`connector-registry.db.test.ts`) liefen deshalb **in keinem
einzigen CI-Lauf**; ein grüner Job belegte nur, dass die Migration durchläuft —
nicht, dass der Fälschungsschutz wirkt. Eine frühere Aussage in dieser Sitzung,
die Tests seien „nachgewiesen", war damit falsch.

Behoben: Beide Enforcement-Dateien sind namentlich in `ci.yml` verdrahtet, und
`requireDbOrFail()` in `db-helpers.ts` macht ein stilles Überspringen unter
`REQUIRE_DB_TESTS=1` zum lauten Fehler — bisher trug nur eine einzige Datei
diese Vorkehrung.

**Nicht behoben, weil außerhalb des Auftragsrahmens:** Gegen das voll migrierte
Schema bestehen **16 der 23** Dateien in `test/runtime/db/`; 7 scheitern
(`addon-entitlements`, `entitlement-grants`, `event-ordering`, `mv-aggregates`,
`rls`, `subject-ref`, `tenant-entitlements-callers`) — sie sind gegen den
minimalen Harness aus `scripts/test-db/up.sh` geschrieben. Die 14 weiteren
lauffähigen Dateien nachzuziehen ist eigene Arbeit. Besonders `rls.db.test.ts`
wiegt schwer: Die Mandantentrennung wird heute nur durch
`security-regressions` geprüft.

**Nebenbefund aus P1-6, gemeldet statt stillschweigend behoben:**
`ai_evidence_retention.hard_delete_after_days` stand seit der Einführung im
Schema, ohne dass irgendein Code sie durchsetzte — die Aufbewahrungsfrist war
deklariert, gelöscht hat nie jemand. `ai_evidence_purge_expired()` macht die
Regel jetzt ausführbar, wird aber von **nichts automatisch aufgerufen**: Es gibt
keinen Cron-Job dafür. Das ist Absicht — wann und ob Evidence gelöscht wird, ist
eine Aufbewahrungsentscheidung des Mandanten, keine, die eine Migration
stillschweigend trifft.

**Abweichung beim Ausfallverhalten des Agent-PEP, bewusst:** Während der
allgemeine Default fail open ist (E2, offen), ist er für die Agent-Runtime
**fail closed** (`AGENT_PDP_FAILURE_MODE=block`). Ein Agent handelt autonom,
ohne Zuschauer; eine angehaltene Agentenaktion kostet einen Lauf, eine
ungeprüfte kostet die Zusage des Produkts. Umstellbar, aber nur bewusst.

**Vierte Policy-Auswertung, neu hinzugekommen:** `apps/agent-runtime/src/voice-policy.ts`
(aus #1127) entscheidet eigenständig über Sprachkanal-Werkzeuge — neben
`policy-engine.ts`, `policyEngine.ts` und `gate_engine.py`. Sie ist inhaltlich
reicher als der PDP (Einwilligung, Kill-Switch, Rate-Limit) und bleibt deshalb
erste Schranke; der PDP liegt seit dem 2026-08-30 darüber. Für die
Konsolidierung gilt der Weg aus P0-5: erst Shadow-Vergleich, dann Umschaltung —
nicht ersetzen, solange nichts gemessen ist.

**Ohne Test-Harnisch:** `apps/agent-runtime` hat kein `test/`-Verzeichnis,
obwohl `package.json` ein `test`-Skript darauf zeigt. Die reine Logik
(`sanitizeToolCall`, `applyVerdict`, `loadPdpConfig`) wird deshalb aus der
Root-Suite mitgetestet; die Verdrahtung der Routen selbst ist ungetestet.

**Grenze des Agent-PEP, ehrlich benannt:** Die Agent-Runtime führt **keine**
eigene Signal-Erkennung auf Argumentwerten durch — der Detektor aus P1-2 liegt
im Deno-Modul und würde hier dupliziert, was genau der Fragmentierungsbefund
ist. Sie meldet die vom Aufrufer deklarierte Klasse weiter. Ein Agent, der
personenbezogene Daten in einem Argumentwert transportiert, ohne sie zu
deklarieren, wird darüber heute nicht erkannt.

**Bewusst nicht enthalten in P1-3, damit es nicht aufgebläht wird:** Das
Verknüpfen eines `user`-Principals mit einem Benutzerkonto ist nur über die
API möglich (die Oberfläche legt Principals ohne Konto-Bindung an) — bis dahin
wirken deren Rollen nicht. Das Löschen einer Einheit ist auf leere Einheiten
beschränkt: `ON DELETE CASCADE` würde sonst stillschweigend den ganzen Teilbaum
samt Rollenbindungen mitnehmen. Umhängen bestehender Einheiten und Principals
geht über die API, nicht über die Oberfläche.

**Neue Grenze aus P1-2, ehrlich benannt:** Die Signal-Erkennung deckt gängige
EU-Muster ab (E-Mail, IBAN, Steuer-ID, Kartennummer, Telefon, Anschrift) plus
kurze Wortlisten für Art.-9-Kategorien. Sie ist bewusst konservativ: ein
Fehlalarm kostet Vertrauen und treibt in Schatten-IT (R5). Sie ersetzt **kein**
DLP-Produkt und erkennt nichts in Binärformaten (PDF, Office, Bilder) — dort
sieht sie nur, was der PEP ihr als extrahierten Text übergibt.

Noch nicht deployt: `governance-decide` und die Migrationen laufen erst mit dem
nächsten `deploy.yml`-Lauf nach dem Merge (siehe CLAUDE.md §5 — Repo ≠ Produktion).

**Umschalt-Kriterium bleibt:** v2 übernimmt nirgends die Entscheidung, bevor der
Shadow-Log über einen definierten Beobachtungszeitraum keine unerklärte
Divergenz zeigt. Der `ai-gateway`-`enforce`-Modus betrifft nur globale
Policies und ist eine bewusste Betriebsentscheidung, kein Deploy-Nebeneffekt.

Für die weiteren Phasen gilt weiterhin: Teilfreigaben per Nummer
(z. B. „P1-1 und P1-4 freigegeben").
