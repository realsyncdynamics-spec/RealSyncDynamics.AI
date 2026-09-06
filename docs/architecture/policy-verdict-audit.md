# Phase 1 — Read-only Audit: Policy- und Verdict-Landschaft

**Datum**: 2026-08-23 · **Auftrag**: Arbeitsanweisung §27, erster Arbeitsschritt
**Status**: read-only. **Kein Produktionscode geändert, keine Migration, kein Refactoring.**

Dieses Dokument ist die Voraussetzung für das kanonische Verdict-Mapping. Es
stellt fest, *was tatsächlich existiert und wer es tatsächlich aufruft* — nicht,
was existieren sollte.

---

## 1. Verifikation (§27, Schritte 1–3)

| Prüfung | Ergebnis |
|---|---|
| Arbeitsbranch | `claude/github-repo-link-yhupho` |
| `origin/main` | `53c7e413` |
| `53c7e41` auf `main`? | **ja**, verifiziert mit `git merge-base --is-ancestor` nach `git fetch --all --prune` |
| Branch enthält `main`? | ja — kein Rebase nötig |
| PR #1128 | Draft, Basis `53c7e41`, CI grün (7/7) |
| Arbeitsbaum | sauber |

---

## 2. Die tatsächliche Policy-Landschaft

### 2.1 Korrektur des vorherigen Audits

`grok-export-audit.md` §2.1 nannte **fünf** konkurrierende Modelle und zählte
`ingestClient.ts` als eigenes Modell mit. Beides war ungenau. Gemessen:

- `ingestClient.ts` ist **kein** Modell, sondern ein Client-Typ, der die Ausgabe
  von `policyEngine.ts` spiegelt.
- **Zwei Engines fehlten** in der Zählung: `src/lib/enterprise-ai-os/policy-engine.ts`
  und die eigenständige Kopie davon in `supabase/functions/enterprise-ai-os-evaluate/index.ts`.

Korrekt waren zum Zeitpunkt der Aufnahme **sechs Implementierungen mit fünf
Verdict-Vokabularen**.

> **Nachtrag 2026-09-04.** Es sind inzwischen **sieben mit sechs Vokabularen**.
> `workers/govard-gateway/src/policy/engine.ts` ist über `main` dazugekommen —
> siehe §2.5. Damit exportieren jetzt **drei** Dateien im Repo eine Funktion
> namens `evaluatePolicies()`.

### 2.2 Vollständige Aufstellung

Ermittelt über `export function evaluate*` plus Rückverfolgung jedes Aufrufers.

| # | Implementierung | Funktion | Vokabular | Tatsächlicher Aufrufer | Laufzeit | Prod. |
|---|---|---|---|---|---|---|
| 1 | `supabase/functions/_shared/policyEngine.ts` | `evaluatePolicies()`, `evaluateRiskThresholds()` | `allow` `log` `warn` `block` `require_approval` | `governance-ingest` | Deno | ✅ |
| 2 | `supabase/functions/_shared/policy-engine.ts` | `evaluatePolicies()` | `allowed` `warned` `blocked` `requires_approval` `logged` | `telemetry-ai-event` | Deno | ✅ |
| 3 | `apps/agent-runtime/src/policy-engine.ts` | `evaluate()` | `{ok, reviewRequired}` / `{ok:false, reason}` | `apps/agent-runtime/src/gateway.ts` | Node (Port 8787) | Container |
| 4 | `src/lib/enterprise-ai-os/policy-engine.ts` | `evaluateAgentAction()` | `{allowed, requiresApproval, auditRequired, reasons}` | `agents/policy-enforcement-agent.ts` | **Browser** | — |
| 5 | `supabase/functions/enterprise-ai-os-evaluate/index.ts` | `evaluateAgentAction()` (**Kopie**, kein Import) | wie #4 | HTTP-Endpunkt | Deno | ✅ |
| 6 | `packages/agent-runtime-contracts` | — (nur Typen) | `ALLOW` `DENY` `REQUIRE_CONFIRMATION` | **niemand** | — | — |
| 7 | `workers/govard-gateway/src/policy/engine.ts` | `evaluatePolicies()` | `ALLOW` `DENY` `APPROVAL` (+ je Policy `PASS`/`VIOLATION`/`NOT_APPLICABLE`) | `workers/govard-gateway/src/index.ts:182` | Cloudflare Worker | — |

**Die Namensfalle**: #1 und #2 exportieren beide eine Funktion namens
`evaluatePolicies()` und liegen im selben Verzeichnis. Sie unterscheiden sich
allein in der Schreibweise des Dateinamens (`policyEngine.ts` vs.
`policy-engine.ts`). Ein Import-Tippfehler ist syntaktisch gültig und
semantisch falsch — ohne Typfehler.

### 2.3 Sie tun fachlich *nicht* dasselbe

Das ist der Grund, warum eine Zusammenlegung nicht angezeigt ist:

| | #1 `policyEngine.ts` | #2 `policy-engine.ts` |
|---|---|---|
| Gegenstand | Governance-**Event** + verknüpftes **Asset** | Runtime-**AI-Event** (Prompt, Tool-Call, Upload) |
| Bedingungssprache | JSONB-Matcher (`ai_act_class`, `data_types`, `vendor`) | typisierte `rule_type`-Fälle (5 Regeltypen) |
| Zusatzstufe | `evaluateRiskThresholds()` → Incident-Dispatch | keine |
| Auflösung | `ACTION_PRECEDENCE`, strengste gewinnt | strengste gewinnt |
| Ergebnisform | `{policy_id, action}` | `{status, matched_policy_id, matched_policy_ids[]}` |

Beide bewerten **bereits eingetretene** Ereignisse. #3 bewertet einen Agent-Run
grob (3 Prüfungen, kein Prüfpfad). #4/#5 bewerten eine geplante Agent-Aktion
gegen eine Policy-Zeile.

**Keine der sechs prüft einen vorgeschlagenen Tool-Aufruf gegen Kill Switch,
Rate Limit, Tenant, Permission, PII, Consent und Risk mit begründetem
Prüfpfad.** Genau diese Ebene liefert der Grok-Export — sie tritt neben die
bestehenden, sie ersetzt keine.

### 2.4 #4 und #5: Duplikat ohne Paritätstest

`enterprise-ai-os-evaluate/index.ts` enthält eine handkopierte Fassung von
`evaluateAgentAction()`. Zeile für Zeile verglichen: **heute semantisch
identisch** — gleiche Regeln, gleiche Reihenfolge, gleiche `reasons`-Texte.

Es gibt aber **keinen Test, der die beiden aneinander bindet**. Zum Vergleich:
Für RFC-003 existiert genau dafür `test/governance/rfc003-sql-parity.test.ts`,
und CLAUDE.md §5 macht die Doppelpflege dort ausdrücklich zur Regel. Hier fehlt
das Gegenstück. Eine einseitige Änderung an `src/lib/…` lässt Browser und Edge
verschieden entscheiden, ohne dass ein Test bricht.

Deno kann nicht aus `src/` importieren — die Kopie ist also nachvollziehbar.
Der fehlende Paritätstest ist es nicht.

### 2.5 Die siebte Engine — und was sie belegt

`workers/govard-gateway/src/policy/engine.ts` (194 Z.) kam am 2026-09-04 über
`main` dazu. Sie ist der wichtigste Einzelbefund seit der ersten Aufnahme,
aus zwei Gründen.

**Erstens bestätigt sie das kanonische Modell.** Ohne Bezug auf
`packages/agent-runtime-contracts` entscheidet sie
`decision: "ALLOW" | "DENY" | "APPROVAL"` — dieselbe Dreiteilung, nur mit
anderem Namen für die mittlere Stufe. Zwei unabhängig entstandene Entwürfe, die
auf dieselbe Form kommen, sind ein stärkeres Argument für dieses Vokabular als
jede Festlegung von außen.

**Zweitens ist sie in einem Punkt weiter als alles Bestehende.** Sie bewertet
*jede* aktive Policy-Version einzeln (`PASS` / `VIOLATION` / `NOT_APPLICABLE`)
statt nur die schärfste zu melden, sie ist dreifach deny-by-default (leeres
Policy-Set, unbekannter Regeltyp, nicht verifizierbare Angabe), und sie bindet
die Entscheidung kryptografisch an den Payload:

```
evaluation_hash = sha256({ payload_hash, decision, evaluated[] })
```

Damit lässt sich eine spätere Freigabe nicht auf einen anderen Inhalt
umhängen. Das ist genau die Eigenschaft, die dem `EvidenceEvent`-Entwurf des
Grok-Exports fehlt (§2.3), und sie kommt hier ohne die dortigen Schwächen.

**Folge für den Adapter**: `fromGovardGateway()` ergänzt, `APPROVAL` →
`REQUIRE_CONFIRMATION`. Die Engine selbst bleibt unangetastet.

**Folge für die Namensfalle**: `evaluatePolicies()` gibt es jetzt dreimal —
in beiden `_shared`-Dateien und hier. Die dritte liegt immerhin in einem
anderen Verzeichnisbaum.

---

## 3. Vorschlag: kanonisches Verdict-Mapping

Kanonisch ist `ALLOW` / `DENY` / `REQUIRE_CONFIRMATION` (Arbeitsanweisung §11).

| Quelle | Quellwert | → kanonisch |
|---|---|---|
| #1 | `block` | `DENY` |
| #1 | `require_approval` | `REQUIRE_CONFIRMATION` |
| #1 | `warn` | `ALLOW` + advisory `warn` |
| #1 | `log` | `ALLOW` + advisory `log` |
| #1 | `allow` | `ALLOW` |
| #2 | `blocked` | `DENY` |
| #2 | `requires_approval` | `REQUIRE_CONFIRMATION` |
| #2 | `warned` | `ALLOW` + advisory `warn` |
| #2 | `logged` | `ALLOW` + advisory `log` |
| #2 | `allowed` | `ALLOW` |
| #3 | `{ok:false, reason}` | `DENY` (+ `reason` in die Trace) |
| #3 | `{ok:true, reviewRequired:true}` | `REQUIRE_CONFIRMATION` |
| #3 | `{ok:true, reviewRequired:false}` | `ALLOW` |
| #4/#5 | `allowed:false` | `DENY` |
| #4/#5 | `allowed:true, requiresApproval:true` | `REQUIRE_CONFIRMATION` |
| #4/#5 | `allowed:true, requiresApproval:false` | `ALLOW` |
| #7 | `DENY` | `DENY` |
| #7 | `APPROVAL` | `REQUIRE_CONFIRMATION` |
| #7 | `ALLOW` | `ALLOW` |

### 3.1 Das Mapping ist verlustbehaftet — und das ist der eigentliche Befund

Fünf Werte auf drei abzubilden verliert Information: `warn` und `log` fallen
beide auf `ALLOW`. Der Unterschied ist aber real — „durchgelassen und der Nutzer
sieht eine Warnung" ist nicht dasselbe wie „durchgelassen und still
protokolliert". Wer nur den kanonischen Wert speichert, kann eine
Aufsichtsanfrage nicht mehr beantworten.

**Empfehlung**: `PolicyDecision` um ein optionales, nicht entscheidungs-
wirksames Feld erweitern, statt 5 → 3 zu erzwingen:

```ts
advisory?: "log" | "warn";   // nur Beiwerk; verdict bleibt maßgeblich
sourceEngine: "asset-policy" | "runtime-ai" | "agent-gateway" | "enterprise-os" | "agent-runtime";
sourceVerdict: string;       // Originalwert, unverändert
```

Damit ist die Rückrichtung verlustfrei und der Prüfpfad bleibt vollständig.
`decidedBy` bleibt `"policy-engine"`.

### 3.2 Was der Adapter *nicht* tun darf

- Keine bestehende Engine löschen oder umbenennen.
- Keine Signatur von `evaluatePolicies()` oder `evaluate()` ändern —
  `governance-ingest`, `telemetry-ai-event` und `gateway.ts` laufen produktiv.
- Keine sechste Engine bauen. Der Adapter **übersetzt**, er entscheidet nicht.

---

## 4. Befunde zur Autorisierungskette

Aufgenommen, weil die Kette `AgentSession → Tenant → PolicyDecision →
ToolRequest → AgentAction → EvidenceEvent` genau hier ihre Wurzel hat.

### 4.1 `/websites` — Ursache des RLS-Fehlers gefunden

`public.websites` hat nach `20260811020429_websites_registry_reconcile…` genau
zwei Policies:

```sql
websites_service_all  -- to service_role, FOR ALL,    using(true)
websites_tenant_read  -- to authenticated, FOR SELECT, using(is_tenant_member(tenant_id))
```

Für `authenticated` existiert **keine INSERT-, UPDATE- oder DELETE-Policy**. Der
Tabellenkommentar sagt es ausdrücklich: *„Schreibzugriff nur via service_role."*

`src/features/governance/scans/scansApi.ts:113` `addWebsiteForTenant()` führt
trotzdem ein **clientseitiges `INSERT`** mit dem `authenticated`-Schlüssel aus.
Das kann nicht gelingen — RLS lehnt jede Zeile ab.

Der Docstring der Funktion beschreibt den Widerspruch selbst:

> *„the server-side RLS / service-role-only insert policy is the actual gate
> (this just shapes the row)"*

Es ist also kein Konfigurationsfehler, sondern ein Aufruf gegen eine bekannte
Wand. Drei UI-Stellen laufen hinein:

- `src/features/governance/websites/WebsiteGovernanceView.tsx:236`
- `src/features/governance/websites/WebsiteGovernanceView.tsx:294`
- `src/features/governance/scans/ScansListView.tsx:170`

Ein Server-Pfad für die Registrierung in `websites` existiert **nicht**.
`website-domain-manager` arbeitet auf `website_projects`, nicht auf `websites`.

**Behoben** — `supabase/functions/tenant-website-register` plus umgestellter
Aufrufer in `scansApi.ts`.

Vorgehen nach §3 (REUSE > FIX > EXTEND > CREATE) geprüft, in dieser Reihenfolge:

| Weg | Ergebnis |
|---|---|
| REUSE einer bestehenden Function | keine schreibt in `websites` — nur `scan-pipeline.ts` und `schedule-assets.ts` lesen |
| EXTEND von `tenant-audit` | passt nicht: Registrierung ist eine eigene Aktion, alle drei Aufrufstellen legen eine Domain an, ohne zwingend zu scannen |
| RLS-INSERT-Policy für `authenticated` | **verworfen** — siehe unten |
| CREATE | gewählt, Auth-Muster 1:1 von `tenant-audit` |

**Warum keine INSERT-Policy.** Das war zunächst der naheliegende Weg: eine
Policy mit `is_tenant_member(tenant_id)` würde die Tenant-Grenze exakt
durchsetzen. Sie scheitert an den Spalten. `plan_tier` ist
`check in ('audit','rebuild','managed')` und `status` läuft bis `live` — beides
kaufmännische Zustände, die laut Tabellenkommentar von Stripe-Webhook und
Provisioning gesetzt werden. Mit einer INSERT-Policy dürfte der Browser sie
selbst wählen und sich ein bezahltes Paket eintragen. Die Function setzt sie
deshalb fest und übernimmt sie nie aus dem Body.

**Idempotent statt fehlerhaft.** `unique (tenant_id, domain)` existiert; die
Function gibt bei bereits registrierter Domain die bestehende Zeile mit
`created: false` zurück, und fängt den Wettlauf zweier paralleler
Registrierungen über `23505` ab. Damit entfällt der Sonderfall, den eine
Aufrufstelle bisher mit `/* RLS oder Duplikat */` verschluckt hat.

**Noch nicht ausgerollt.** Die Function liegt im Repo, `deploy.yml` rollt sie
beim Merge aus. Bis dahin ist sie in `UNBACKED_CALLERS` vermerkt — der Test
`edge-function-contract.test.ts` verlangt genau das und meldet den Eintrag
wieder, sobald sie deployt ist. Der Client übersetzt ein 404 in „Registry-Dienst
ist nicht verfügbar (noch nicht ausgerollt)" statt in ein nacktes `HTTP 404`.

### 4.2 `website-domain-manager` — Tenant-Grenze wird nicht geprüft — **behoben 2026-09-06**

Gemessen am Stand vor dem Fix:

- läuft mit `SUPABASE_SERVICE_ROLE_KEY` (Modulebene, vor jeder Prüfung)
- nimmt `tenant_id`, `project_id` und `domain` **aus dem Request-Body**
- prüfte ausschließlich, ob das Paar `(project_id, tenant_id)` existiert
- las **keinen** `Authorization`-Header, rief **kein** `getUser`,
  **kein** `requireUser`, **kein** `requireTenantMembership`
- ist in `src/config/production-edge-functions.ts` als **deployt** geführt

#### Korrektur 1: die Begründung zur Erreichbarkeit war falsch, das Ergebnis richtig

Hier stand: *„es gibt **keine** `supabase/config.toml`"*. Das ist falsch —
`supabase/config.toml` existiert und vergibt für rund 40 Functions ausdrücklich
`verify_jwt = false`. `website-domain-manager` steht **nicht** darunter, also
greift die Voreinstellung `true`. Die Schlussfolgerung stimmte damit zufällig,
die Herleitung nicht.

Nachgeholt, was von Anfang an hätte dastehen müssen — eine Messung statt einer
Herleitung. Live gegen `ebljyceifhnlzhjfyxup`, ohne Token:

```
POST /functions/v1/website-domain-manager  →  401
```

Der Endpunkt ist **nicht anonym erreichbar**. Das ist jetzt belegt, nicht
geschlossen.

#### Korrektur 2: der Befund war schwerer, als er hier stand

Hier stand, ein Angreifer brauche „ein gültiges Paar `(project_id, tenant_id)`".
Für zwei der vier Aktionen stimmt das nicht — dort genügen die **eigenen,
vollständig legitimen** Zugangsdaten, und es muss keine einzige fremde ID
bekannt sein. Grund: Nach der Projektprüfung wurde `domain` aus dem Body ohne
weitere Eingrenzung verwendet.

| Aktion | Abfrage vor dem Fix | Folge |
|---|---|---|
| `check-ssl` | `.eq('domain', domain)` — **kein** Projekt-, kein Mandantenbezug | **Fremdlesen** mit eigenem Projekt: Existenz und Validierungsstand jeder Domain im System |
| `validate-domain` | erster Update projektbezogen, **zweiter** nur `.eq('domain', domain)` | **Fremdschreiben** mit eigenem Projekt: `ssl_status` und `last_checked_at` auf fremder Zeile |
| `validate-domain` | `checkDNSPropagation(domain)` lief vor jeder Besitzprüfung | ausgehender Aufruf mit fremdgewähltem Namen |
| `connect-domain` / `disconnect-domain` | über `project_id` eingegrenzt | nur mit fremdem Paar erreichbar — der ursprünglich beschriebene Fall |

Die beiden ersten Zeilen sind die eigentliche Lücke: Sie setzen keinerlei
Vorwissen voraus. Jedes angelegte Konto mit einem eigenen Website-Projekt
genügte.

#### Fix

Das etablierte Gegenmuster liegt im selben Repo: `supabase/functions/_shared/auth.ts`
stellt `requireUser()`, `requireTenantMembership()` und `requireAuthAndTenant()`
bereit; `governance-risk-score/index.ts` benutzt sie. Genutzt wird jetzt
`requireAuthAndTenant` — kein neuer Wächter, kein zweiter Auslegung derselben
Regel.

| | vorher | nachher |
|---|---|---|
| Service-Role-Client | Modulebene, vor jeder Prüfung | ausschliesslich aus dem `AuthContext`, nach der Mitgliedschaftsprüfung |
| `tenant_id` | aus dem Body, ungeprüft in Abfrage und `insert` | aus dem Body nur als *Behauptung* an `requireAuthAndTenant`; verwendet wird der geprüfte Wert |
| Zugriffe auf `website_domains` | teils ohne Bezug | durchgehend `.eq('project_id', projectId)` |
| Eindeutigkeitsprüfung der Domain | global, ununterscheidbar von einem Versehen | weiterhin global, aber als `// GLOBAL:` gekennzeichnet und begründet — `website_domains.domain` ist systemweit `UNIQUE`, die Prüfung *muss* über alle Mandanten laufen |
| unbekannte vs. fremde Domain | verschiedene Pfade | beide `DOMAIN_NOT_FOUND` — von aussen nicht unterscheidbar |

**Warum die globale Abfrage bleibt**: Sie beantwortet nur „belegt oder nicht"
und liefert `select('id')`, keine fremden Felder. Ohne sie schlüge statt einer
lesbaren Meldung der Datenbank-Constraint zu. Der Unterschied zu vorher ist,
dass sie jetzt *als Entscheidung erkennbar* ist statt als Auslassung.

**Gesichert durch** `test/edge/website-domain-manager-tenant-boundary.test.ts`
(8 Fälle). Geprüft wird die **Form der Abfrage**, nicht das Verhalten: Beide
Defekte lieferten dem ehrlichen Aufrufer das richtige Ergebnis und sahen wie
funktionierender Code aus — ein Verhaltenstest hätte sie nicht gefunden. Der
Test zählt die Zugriffsketten auf `website_domains` und verlangt für jede
entweder die Projekt-Eingrenzung oder die ausdrückliche `// GLOBAL:`-Marke.

Gegenprobe, dass der Test trägt: dreimal absichtlich zurückgebaut — `check-ssl`
wieder global, `insert` wieder mit `body.tenant_id`, `// GLOBAL:`-Marke entfernt
— jedes Mal rot, danach wiederhergestellt und wieder grün.

**Noch nicht wirksam**: Die Function ist deployt, der Fix erreicht Produktion
erst mit dem nächsten `deploy.yml`-Lauf.

#### Offen, weil §10.3 und §14: der Aufrufer

`src/features/website-operations/DomainManager.tsx` ist die einzige Stelle im
Repo, die diese Function ruft. Drei Befunde, keiner davon hier behoben:

1. Sie sendet **keinen** `Authorization`-Header. Das Gateway antwortet also mit
   `401`, bevor die Function überhaupt läuft — der Aufruf kann heute nicht
   gelingen, und zwar unabhängig von diesem Fix.
2. Sie liest `tenant_id` aus `localStorage.getItem('tenantId')` — wörtlich das
   in §23 untersagte Muster.
3. `loadDomains()` ruft `/api/website-projects/:id/domains`. Einen solchen
   Endpunkt gibt es in dieser Vite-SPA nicht.

Dazu kommt: **Das gesamte Verzeichnis `src/features/website-operations/` wird
von nichts importiert.** Nur die eigene `index.ts` re-exportiert es; kein
Router, keine Seite, kein Test greift darauf zu. Die Oberfläche ist nicht
erreichbar.

Der Fix an der Function bricht deshalb keinen funktionierenden Aufrufer — es
gibt keinen. Das Umschreiben des Aufrufers wäre nach §14 „Umschreiben" und
damit fragepflichtig, und nach §10.1 stellt sich zusätzlich die Frage, ob das
Feature überhaupt eine Route bekommen soll. **Das gehört entschieden, nicht
nebenbei geändert.**

### 4.3 Größenordnung — ausdrücklich **nicht** als Befund, sondern als Triage-Bedarf

160 Edge Functions verwenden den Service-Role-Key; 103 davon enthalten in
`index.ts` weder `requireUser` noch `getUser`. **Das ist keine Aussage über 103
Sicherheitslücken.** Cron-Jobs, Webhook-Empfänger und bewusst öffentliche
Endpunkte brauchen keinen Nutzer-JWT. Verifiziert ist genau ein Fall (§4.2).

Die Zahl benennt den **Prüfumfang**, nicht das Ergebnis. Eine Triage — welche
dieser 103 nehmen tenant-bezogene Parameter vom Client entgegen und handeln
darauf — ist ein eigener Arbeitsschritt.

### 4.4 Widerspruch in der Produktionsdokumentation

`src/config/production-edge-functions.ts` schreibt im Kopf: *„Im Repository
liegen 177 Function-Verzeichnisse, in Produktion laufen 103."*
`CLAUDE.md` §5 nennt für den 2026-08-22 gemessen **177 von 177**.

Beide können nicht gleichzeitig stimmen. Nach §24 ist vor jeder Aussage zum
Produktionsstand zu messen, nicht zu zitieren. Nicht in diesem Schritt aufgelöst.

---

## 5. Entscheidungsmatrix

### KEEP — unverändert übernehmen

| Gegenstand | Begründung |
|---|---|
| `packages/agent-runtime-contracts` | liegt auf `main`, sechs Contracts, korrekt entkernt |
| `evaluateToolRequest()` (Export) | 7 Prüfungen mit Prüfpfad — diese Ebene fehlt im Repo |
| `TOOLS`-Registry (Export) | Daten, keine Logik; OpenAI-Schemas direkt nutzbar |
| `EvidenceKind`-Ereignismodell | inkl. Pflicht-Event bei `DENY` |
| `use-speech.ts` | 65 Z., framework-frei, keine Abhängigkeit |
| `_shared/redact.ts` | bleibt die einzige PII-Engine |
| `src/lib/evidence/verifyChain.ts` | bleibt der kanonische Verifier |
| Design-Tokens des Exports | identisch mit `tailwind.config.ts` |

### ADAPT — fachlich übernehmen, technisch neu bauen

| Gegenstand | Anpassung |
|---|---|
| Policy-Auswertung | vom Browser auf Edge Function (§14) |
| `ToolRequest.args` | zurück auf enge Signatur (§12), sonst Kanonisierung testen |
| Evidence-Kette | `prev_hash = NULL` statt `GENESIS_HASH`, Vault-Kanonisierung (§13) |
| Session-Persistenz | `agent_runtime_sessions`, Tenant + RLS (§15) |
| Consent | zuerst prüfen, ob Bestand erweiterbar; sonst neue Tabelle (§16) |
| LLM-Anbindung | System-Prompt + Tool-Schema-Übergabe behalten, Transport ersetzen |
| Voice-Console-Komponenten | `react-router-dom` statt TanStack, Store ohne `zustand` |

### REJECT — nicht übernehmen

| Gegenstand | Grund |
|---|---|
| `.vercel/**` | Build-Artefakt eines ausgeschlossenen Ziels |
| `@tanstack/react-start`, `router-plugin`, `nitro` | Server-Pattern des ausgeschlossenen Ziels |
| `better-auth`, `jose` | konkurrierendes Auth-Modell |
| `kysely`, `@electric-sql/pglite` | konkurrierende Persistenz |
| `src/lib/db.ts`, `src/lib/auth/**`, `src/lib/app-data/**` | ~2.400 Z. Sandbox-Gerüst |
| `pii.ts` | schwächer als `_shared/redact.ts` (3 vs. 10 Kategorien, kein `/g`) |
| `runTool()`, `KB`, `DEMOS`, `injectDemo()` | Attrappen |
| `preview-host-bridge`, `AppShell` | Grok-Sandbox / fremdes Routing |
| feste x.ai-Bindung | Provider muss abstrahiert sein (§18) |
| `zod` | im Export nur in verworfenem Code; CLAUDE.md §4 |

### INTEGRATE — Zielarchitektur

```
Browser (React/Vite)          zeigt Verdict + Trace, entscheidet nie
        ↓ Tool-Vorschlag
Supabase Edge Function        requireUser + requireTenantMembership
        ↓
Verdict-Adapter               übersetzt 5 Vokabulare → ALLOW/DENY/REQUIRE_CONFIRMATION
        ↓
Policy-Auswertung             serverseitig, Prüfpfad vollständig
        ↓
Tool Runner                   nur bei ALLOW bzw. nach Bestätigung
        ↓
Evidence (Vault-Kette)        prev_hash NULL → hash, DENY inbegriffen
        ↓
Postgres + RLS                tenant_id NOT NULL auf jeder Zeile
```

Cloudflare bleibt Edge/Hosting, Supabase bleibt Auth/DB/RLS/Functions.
**Null neue npm-Dependencies** für diesen Pfad.

---

## 6. Umsetzungsstand

Nach §27 und der bestätigten Reihenfolge:

| Schritt | Stand |
|---|---|
| Tests für das kanonische Modell | ✅ `test/governance/verdict-mapping.test.ts` — 35 Fälle, inklusive `warn`/`log`-Verlustfreiheit, Fail-closed und govard-gateway |
| Paritätstest #4 ↔ #5 | ✅ `test/governance/enterprise-os-evaluate-parity.test.ts` — 5 Fälle, Vorgehen wie `rfc003-sql-parity.test.ts` |
| Adapter-Modul | ✅ `supabase/functions/_shared/verdict.ts` — reine Übersetzung, keine Entscheidung |

**Getroffene Annahme**: umgesetzt ist die **verlustfreie** Variante aus §3.1
(`advisory` + `sourceEngine` + `sourceVerdict`). Begründung: `warn` und `log`
ohne Seitenkanal auf `ALLOW` zu kollabieren zerstört Prüfpfad-Information.
Die harte 5→3-Abbildung bliebe eine Streichung des `advisory`-Feldes.

**Verifiziert statt behauptet:**

- Der Paritätstest fängt Drift tatsächlich: eine künstlich geänderte
  Regel-Begründung in der Edge-Kopie ließ ihn rot werden, danach wurde das
  Original wiederhergestellt.
- `supabase/functions` steht in `tsconfig.json` unter `exclude`. `verdict.ts`
  wird über den Test-Import trotzdem typgeprüft — mit einem absichtlichen
  Typfehler nachgewiesen (`error TS2322`), danach zurückgenommen.
- `npm run lint` exit 0 · `npm test` 3342 bestanden, 0 Fehlschläge.

**Keine bestehende Engine wurde angefasst.** `governance-ingest`,
`telemetry-ai-event` und `gateway.ts` laufen unverändert; der Adapter hat
bislang keinen Aufrufer — er wird erst in Phase 4 (serverseitige Durchsetzung)
verdrahtet.

Erst danach Phase 2 (Evidence).

## 7. Offene STOPP-Punkte (§25)

| # | Punkt | Warum gestoppt |
|---|---|---|
| 1 | ~~`/websites`-INSERT~~ | **erledigt** — `tenant-website-register`, siehe §4.1 |
| 2 | ~~`website-domain-manager`~~ | **erledigt** — `requireAuthAndTenant` + Projekt-Eingrenzung, siehe §4.2. Neu offen: der Aufrufer `DomainManager.tsx` und die Frage, ob `website-operations` eine Route bekommt |
| 3 | 103 Functions ohne JWT-Prüfung | Triage nötig, Zahl ist kein Befund |
| 4 | 103 vs. 177 deployt | Doku widerspricht sich; messen statt zitieren |
| 5 | Consent-Modell | erst prüfen, ob Bestand erweiterbar (§16) |
