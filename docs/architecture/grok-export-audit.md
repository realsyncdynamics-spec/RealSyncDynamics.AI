# Audit: Grok-Export `orbit-dove-quiet-timber` → RealSyncDynamics.AI

**Datum**: 2026-08-23 · **Quelle**: `realsyncdynamics-spec/orbit-dove-quiet-timber`,
Commit `185b3bf` („Export from Grok", einziger Commit) · **Ziel**: dieser Branch

Reines Audit. **Es wurde nichts migriert.** Dieses Dokument stellt fest, was
übernommen werden kann, was widersprüchlich ist und was verworfen gehört.

---

## 0. Ausgangslage — die Contracts sind bereits portiert

Commit `53c7e41` („feat(agent-runtime): Voice-Contracts v0.1", 2026-08-23 11:49)
hat `packages/agent-runtime-contracts` angelegt. Er liegt auf **`main`**
(geprüft am 2026-08-23 gegen `origin/main`, nicht aus einem lokalen Ref
geschlossen). Punkt 1 des Übernahmeplans ist damit erledigt; das Audit prüft ab
hier die *Logik*, nicht die Typen.

---

## 1. Contracts: was existiert, was fehlt

### 1.1 Übernommen (`packages/agent-runtime-contracts/src/index.ts`, 180 Z.)

Alle sechs Contracts plus Nebentypen sind zeichengenau aus
`src/lib/contracts.ts` übernommen. Zwei bewusste Abweichungen:

| Abweichung | Bewertung |
|---|---|
| `ToolRequest.args`: `Record<string, string\|number\|boolean\|null>` → `Record<string, unknown>` | **Rückschritt.** Die enge Signatur war der Grund für `flattenArgs()`. Mit `unknown` kann ein verschachteltes Objekt in den Evidence-Hash wandern — siehe §2.3. |
| Demo-Konstanten (`DEMO_TENANT`, `VOICE_AGENT`, `RATE_LIMITS`, `ALL_PURPOSES`) entfernt | **Richtig.** Ein fiktiver Tenant gehört nicht in ein Contracts-Package. |

Der Header dokumentiert das Mapping auf `apps/agent-runtime` — gut. Er
dokumentiert **kein** Mapping auf die beiden Supabase-Engines (§2.1).

### 1.2 Nicht übernommen — die eigentliche Governance-Logik

| Datei | Zeilen | Externe Imports | Inhalt |
|---|---|---|---|
| `src/lib/policy-engine.ts` | 174 | **keine** | `evaluateToolRequest()` — 7 Checks, voller Trace |
| `src/lib/tools.ts` | 258 | **keine** | `ToolSpec`-Registry, Default-Verdicts, OpenAI-Function-Schemas, KB, `runTool()` |
| `src/lib/evidence.ts` | 64 | **keine** | `appendEvidence()` / `verifyChain()` über WebCrypto |
| `src/lib/pii.ts` | 36 | **keine** | `scanPii()` |
| `src/lib/store.ts` | 417 | zustand | Session-Orchestrierung (Browser) |
| `src/lib/voice-api.ts` | 133 | @tanstack/react-start | LLM- + TTS-Call |
| `src/components/voice-console.tsx` | 691 | react, lucide-react | Konsolen-UI |

**Die vier Kern-Dateien (532 Zeilen) haben zusammen null externe
Abhängigkeiten.** Nur WebCrypto und TypeScript. Das ist der wichtigste
Einzelbefund dieses Audits — der wertvolle Teil des Exports ist ohne jede
Dependency portierbar und läuft unverändert in Deno und Cloudflare Workers.

---

## 2. Widersprüche und Konflikte

### 2.1 Fünf konkurrierende Policy-Verdict-Modelle

> **Korrigiert am 2026-08-23.** Diese Zählung war ungenau. `ingestClient.ts`
> ist kein eigenes Modell, sondern ein Client-Typ; dafür fehlten zwei echte
> Engines (`src/lib/enterprise-ai-os/policy-engine.ts` und deren Kopie in
> `supabase/functions/enterprise-ai-os-evaluate/index.ts`). Korrekt sind
> **sechs Implementierungen mit fünf Vokabularen**, jeweils mit
> nachverfolgtem Aufrufer — siehe `policy-verdict-audit.md` §2.

| # | Ort | Vokabular |
|---|---|---|
| 1 | `packages/agent-runtime-contracts` (neu) | `ALLOW` / `DENY` / `REQUIRE_CONFIRMATION` + `trace[]` |
| 2 | `apps/agent-runtime/src/types.ts` | `{ok:true, reviewRequired}` \| `{ok:false, reason: DenyReason}` |
| 3 | `supabase/functions/_shared/policyEngine.ts` | `allow\|log\|warn\|block\|require_approval` (+ `ACTION_PRECEDENCE`) |
| 4 | `supabase/functions/_shared/policy-engine.ts` | `PolicyAction` + `PolicyStatus` (`allowed\|warned\|blocked\|requires_approval\|logged`) |
| 5 | `src/features/governance/ingestClient.ts` | `{event_id, policy_id, action}` |

Nur das Mapping 1 → 2 ist dokumentiert. Für 3/4/5 existiert keines.

Anmerkung ohne Bezug zum Export, aber relevant: **3 und 4 liegen im selben
Verzeichnis** und unterscheiden sich nur in der Schreibweise des Dateinamens
(`policyEngine.ts` / `policy-engine.ts`). Beide bewerten Policies gegen Events,
beide definieren `PolicyAction`. Das ist bereits eine Doppelung; eine sechste
Engine daneben verschärft sie.

**Unterschied in der Natur der Entscheidung** — und der Grund, warum #1 nicht
einfach in #3/#4 aufgeht:

- #3, #4, #5 bewerten **Ereignisse, die bereits stattgefunden haben**
  (Telemetrie, Ingest). Sie können nur noch protokollieren, warnen oder eine
  nachgelagerte Freigabe verlangen.
- #2 bewertet einen Agent-Run grob: 3 Checks (Agent existiert, Tool erlaubt,
  Aktion nicht restringiert), kein Trace, keine Begründungskette.
- #1 bewertet einen **vorgeschlagenen** Tool-Aufruf *vor* der Ausführung —
  gegen Kill Switch, Rate Limit, Tenant, Permission, PII, Consent, Risk — und
  liefert für jeden Schritt `pass` / `fail` / `flag` mit Klartextbegründung.

Diese Ebene fehlt im Hauptrepo vollständig.

### 2.2 Genesis-Konvention widersprüchlich

| | Grok / Contracts | Evidence Vault (Bestand) |
|---|---|---|
| Genesis | `GENESIS_HASH` = 64 × `"0"` | `prev_hash === null` |
| Typ | `prevHash: string` (nie null) | `prev_hash: string \| null` |

`src/lib/evidence/verifyChain.ts` meldet für einen Genesis-Snapshot mit
gesetztem `prev_hash` explizit `broken_link` („Genesis-Snapshot hat einen
prev_hash (erwartet: keiner)"). **Eine nach der Grok-Konvention geschriebene
Kette ist mit dem bestehenden Verifier nicht prüfbar.** Das ist zu entscheiden,
bevor das erste `EvidenceEvent` persistiert wird — nachträglich ist es eine
Migration über eine Hash-Kette, also praktisch nicht mehr korrigierbar.

### 2.3 Kanonisierung: die Grok-Kette ist schwächer

| | Grok `evidence.ts` | Vault `verifyChain.ts` |
|---|---|---|
| Gehashte Felder | ganzes Event inkl. `payload` | fester geordneter Subset |
| Hex-Normalisierung | nein | ja (`normalizeHex`) |
| Versionsnummer | **keine** | `version`, lückenlos ab 1 |
| Erkennt Manipulation | ja | ja |
| Erkennt Lücke / Duplikat | **nein** | ja (`version_gap`, `duplicate_version`) |
| Erkennt Löschung am Kettenende | **nein** | ja (`missing_genesis` / Zählung) |
| Legacy-Behandlung | keine | `event_timestamp === null` → „legacy", kein Manipulationsbefund |
| Hash-Funktion | fest verdrahtet | injiziert (`HashHex`) → testbar ohne Krypto |

Dazu: `JSON.stringify` über einen `payload` mit `Record<string, unknown>`
(§1.1) ist **nicht deterministisch kanonisch** — zwei semantisch gleiche
Payloads mit anderer Schlüsselreihenfolge ergeben verschiedene Hashes.

**Der bestehende Verifier ist dem Export in jeder Dimension überlegen.** Zu
übernehmen ist die *Ereignis-Ebene* (`EvidenceKind`, ein Event pro
Entscheidung, auch bei DENY), nicht die Ketten-Implementierung.

### 2.4 Tabellenname-Kollision: `agent_sessions`

`docs/architecture/voice-agent-v0.1.md`, Schritt 3, plant eine additive
Migration `agent_sessions`. Die Tabelle **existiert bereits** seit
`20260516100000_governance_agent.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id, tenant_id, user_id, history JSONB, last_turn_at, created_at
);
```

Das ist eine Chat-Historie. Kein `kill_switch`, kein `rate_limit`, kein
`last_evidence_hash`, kein `channel`, kein `consent_id`. Wegen
`IF NOT EXISTS` würde eine gleichnamige Migration **stillschweigend
durchlaufen und nichts anlegen** — der Fehler fällt erst zur Laufzeit auf.
Neuer Name zwingend, z. B. `agent_runtime_sessions`.

### 2.5 Consent-Modell hat kein DB-Gegenstück

`user_consents` (`20260608000001`) ist Cookie-/Scan-Consent:
`consent_type text`, `granted boolean`, `revoked_at`. Der Contract braucht
`purposes[]`, `lawfulBasis` (`art6_1_a|b|f`), `sessionId`, `tenantId`.

Es gibt im Hauptrepo **keinen** zweckbasierten Einwilligungs-Datensatz.
`lawfulBasis` / `ConsentPurpose` kommen außerhalb des neuen Packages nur in
einer Contentseite vor (`AiActGovernancePage.tsx`). Echte Lücke — hier ist der
Export inhaltlich am wertvollsten, aber es ist auch der Teil mit dem größten
Umsetzungsaufwand (Tabelle, RLS, Widerruf, Evidence-Kopplung).

### 2.6 PII: der Export ist schwächer, nicht besser

| | Grok `pii.ts` | `_shared/redact.ts` |
|---|---|---|
| Kategorien | 3 (email, phone_de, iban) | 10 (+ Kreditkarte, Steuer-ID, SVN, Geburtsdatum, IPv4/v6) |
| Regex-Modus | `match` ohne `/g` → **nur erster Treffer** | global, mit Trefferzählung |
| Ausgabe | maskierter Auszug (`ab•••yz`) | redigierter Text + `HitsByCategory` |
| Policy-Modi | keine | `always` / `third_party_only` / `never` |
| Protokollierung | keine | `pii_redaction_log` |

`pii.ts` **nicht übernehmen.** Neu ist allein das *Interface*: `redact.ts`
liefert Zähler, aber keine maskierten Auszüge für die Anzeige in der
Policy-Trace. Das ist ein kleiner additiver Zusatz zu `redact.ts`, keine
Portierung.

### 2.7 zod

`zod` erscheint in `package.json` des Exports, wird in `src/` aber nur an
**einer** Stelle benutzt: `preview-host-bridge.ts` — Grok-Sandbox-Infrastruktur,
die ohnehin verworfen wird. CLAUDE.md §4 („zod ist derzeit keine Dependency —
nicht ohne Absprache einführen") bleibt unangetastet: **aus diesem Export
entsteht kein zod-Bedarf.**

---

## 3. Was ist echte Runtime, was ist Demo

### Echt — deterministisch, testbar, framework-frei

- **`evaluateToolRequest()`** — sieben Checks in fester Reihenfolge, Fail-Fast
  auf DENY, jeder Schritt schreibt in `trace[]`. Reine Funktion. Der wertvollste
  Teil des Exports.
- **`TOOLS`-Registry** — Daten, kein Code. `risk`, `writes`, `piiLikely`,
  `defaultVerdict` pro Tool plus fertige OpenAI-Function-Schemas.
- **`appendEvidence` / `verifyChain`** — WebCrypto, läuft überall. Fachlich
  brauchbar, kryptografisch dem Bestand unterlegen (§2.3).
- **`scanPii`** — pure, aber schwächer als der Bestand (§2.6).
- **`use-speech.ts`** — Web Speech API, 65 Zeilen, framework-frei, direkt
  portierbar. Einschränkung: nur Chromium-basierte Browser.

### Demo — nicht portierbar

- **`runTool()`** — `Math.random()`-IDs, erfundene Ticketnummern
  (`T-1847`), kein Backend. Reine Attrappe.
- **`KB`** — fünf hartcodierte Absätze über eine fiktive „Müller Sanitär GmbH"
  im Thüringer Wald.
- **`DEMOS` / `injectDemo()`** — fünf Klick-Szenarien, die die Policy Engine
  ohne LLM füttern. Als Vorführpfad brauchbar, produktiv nicht.
- **`store.ts`** — Zustand-Store, alles im Browser-Speicher. Kein Persist,
  keine RLS, Session stirbt beim Reload.

### Der kritische Befund

**Die Policy Engine läuft im Browser.** In `store.ts` ruft `applyProposal()`
`evaluateToolRequest()` clientseitig auf und führt bei ALLOW direkt `runTool()`
aus. Für eine Vorführung tragbar — produktiv ist das genau das, was CLAUDE.md §2
ausschließt („Der Browser spricht **nie** direkt mit privilegierten
Ressourcen"). Beim Port muss die Entscheidung auf die Serverseite; der Client
darf das Verdict nur *anzeigen*, nie *fällen*.

### Halb-echt

`voice-api.ts` macht echte Calls: `api.x.ai/v1/chat/completions` (Modell
`grok-4.5`, `tools`, `tool_choice: auto`, Temperatur 0.3) und `api.x.ai/v1/tts`.
Der System-Prompt ist gut — er verbietet dem Modell ausdrücklich, Ausführung zu
behaupten. **Technisch aber nicht portierbar**: `createServerFn` aus
`@tanstack/react-start` ist genau das Nitro-/Vercel-Server-Pattern, das
ausgeschlossen ist. Fachlich übernehmbar sind System-Prompt, Tool-Schema-
Übergabe und Antwort-Parsing; das Transportgerüst nicht.

Nebenbefund: **x.ai/Grok ist kein Provider aus CLAUDE.md §2** (Anthropic,
Google GenAI, OpenAI, Ollama). Entweder Provider ergänzen oder umstellen. Jeder
externe Call muss in `ai_tool_runs` / `workflow_runs` geloggt werden.

---

## 4. Voice Console — Portierbarkeit

### Design: kompatibel

`src/styles.css` des Exports definiert `--color-obsidian: #0a0a0b`,
`--color-titanium: #e2e2e2`, `--color-security: #0052ff`, Radien 0–6px. Das ist
**identisch** mit dem App-/Dashboard-Token-Set in `tailwind.config.ts`
(Zeilen 11–13). Der Export wurde offenkundig mit dem RSD-Designsystem
geprompted. Zusätzlich: `--color-allow` / `--color-deny` / `--color-confirm` —
drei Verdict-Farben, die im Hauptrepo fehlen.

Der Design-Freeze (§10) ist nicht berührt: die Console gehört unter `/app/…`,
nicht auf die Landing.

### Abhängigkeiten der Console: nur `react` + `lucide-react`

Vollständig geprüft — `voice-console.tsx` importiert ausschließlich `react`,
`lucide-react`, `@/lib/cn` und eigene Module. **Kein Radix, kein cmdk, kein
vaul, kein shadcn.** Beide Dependencies sind im Hauptrepo bereits vorhanden.

| Komponente | Z. | Portierbar | Anmerkung |
|---|---|---|---|
| `PolicyRail` | 534 | **ja** | Kernstück: 7 Checks als Trace mit pass/fail/flag |
| `ConsentGate` | 228 | **ja** | Zweck-Auswahl, Art.-6-Anzeige |
| `SessionBar` | 289 | **ja** | Kill Switch, Rate-Limit-Zähler, Status |
| `PendingPane` | 606 | **ja** | REQUIRE_CONFIRMATION → Operator bestätigt/verweigert |
| `EvidenceFeed` | 654 | **ja** | Hash-Kette live |
| `VerdictBadge` | 592 | ja | trivial |
| `TranscriptPane` / `Composer` / `VoiceStage` | 397/432/338 | ja | an Web Speech gebunden |
| `Intro` / `ErrorBanner` / `Meta` | 191/210/330 | ja | trivial |
| `DemoRow` | 505 | nein | Demo |
| `AppShell` | — | nein | `@tanstack/react-router` `<Link>` |
| `preview-host-bridge` | — | nein | Grok-Sandbox |

Umschreibaufwand: `react-router-dom` statt `@tanstack/react-router`, und der
`zustand`-Store auf React-Context oder eine neue Dependency. Sonst nichts.

---

## 5. Dependencies — nicht übernehmen

### Hart abgelehnt (Architekturvorgabe: Vite + Cloudflare + Supabase, kein Vercel)

| Paket | Grund | Ersatz im Bestand |
|---|---|---|
| `@tanstack/react-start`, `@tanstack/router-plugin`, `nitro` | Server-/Nitro-Pattern, Build-Target Vercel | Supabase Edge Functions |
| `@tanstack/react-router` | anderes Routing-Modell | `react-router-dom` 7.17 |
| `better-auth`, `jose` | eigener Auth-Stack, Grok-Auth-Broker | Supabase Auth + RLS (§11) |
| `kysely`, `@electric-sql/pglite` | Neon / WASM-Postgres | Supabase PostgreSQL |
| `.vercel/**` | Build-Artefakt (`nitro.json`, `config.json`, `__server.func/`) | ersatzlos verwerfen |

`src/lib/db.ts` schaltet per `DATABASE_URL` zwischen **Neon** und einem
eingebetteten PGlite um; `src/lib/auth/server.ts` federiert an einen
Grok-Auth-Broker. Der gesamte Daten- und Auth-Layer des Exports (rund 2.400
Zeilen (ohne Tests) unter `src/lib/auth/`, `src/lib/app-data/`, `src/lib/db.ts`) ist
Sandbox-Gerüst und ohne Rest zu verwerfen.

### Nicht ohne Entscheidung

- **`zod`** — CLAUDE.md §4; aus diesem Export nicht nötig (§2.7)
- **`zustand`** — neu; React-Context genügt für die Console
- **21 × `@radix-ui/*`, `cmdk`, `vaul`, `sonner`, `cva`, `tailwind-merge`,
  `clsx`, `tw-animate-css`** — shadcn-Ökosystem, von CLAUDE.md §2 ausgeschlossen
  und **von der Console gar nicht benutzt**
- **`@tanstack/react-query`, `react-table`, `react-hook-form`,
  `@hookform/resolvers`, `date-fns`, `react-day-picker`,
  `react-resizable-panels`** — im relevanten Code nirgends verwendet

### Versionen nicht anfassen

`vite ^8.2.0` (Haupt: `^6.2.0`), `tailwind 4.3` (`4.1`), `recharts 2.x`
(`3.8.1`), `typescript ^5.7` (`~5.8.2`). Keine dieser Versionen ist zu
übernehmen.

### Ergebnis

**Null neue Dependencies.** Der übernahmewürdige Kern ist dependency-frei; die
UI braucht nur, was schon da ist.

---

## 6. Was direkt nach Supabase / Cloudflare kann

`policy-engine.ts`, `tools.ts`, `evidence.ts` und die Contracts sind reines
ESM-TypeScript ohne Imports — sie laufen unverändert in Deno (Supabase Edge
Functions), in Cloudflare Workers und in Vitest. Das ist exakt das Muster, das
`supabase/functions/_shared/policy-engine.ts` bereits beschreibt: „Pure-ESM-
TypeScript ohne externe Imports — laeuft in Deno und in Vitest gleichzeitig."

Realistischer Zuschnitt:

| Baustein | Ort | Bemerkung |
|---|---|---|
| Verdict-Modul | `supabase/functions/_shared/` | `evaluateToolRequest` + `TOOLS`, serverseitig |
| Turn-Endpoint | Edge Function (neu) | LLM-Call mit Server-Key, Policy-Auswertung, Evidence-Write; kein Service-Role im Client |
| Evidence | `ai_evidence_events` (existiert) | **erst nach Entscheidung zu §2.2/§2.3** |
| Sessions / ToolRequests / Decisions | additive Migration | **nicht** `agent_sessions` (§2.4) |
| Consent | additive Migration | kein Gegenstück im Bestand (§2.5) |
| UI | `src/features/…`, lazy, `<ProtectedRoute>` | react-router, keine neuen Dependencies |

---

## 7. Bewertung: ja — als Schicht, nicht als Anwendung

Der Export liefert etwas, das im Hauptrepo tatsächlich fehlt: eine
**Entscheidung pro vorgeschlagenem Tool-Aufruf, mit sichtbarem Prüfpfad**. Die
fünf bestehenden Modelle bewerten entweder Vergangenes (Telemetrie, Ingest)
oder entscheiden grob und ohne Begründungskette. Keines prüft einen Vorschlag
gegen Consent, PII, Rate Limit und Kill Switch und legt die Begründung offen.

Genau das trifft das Leitprinzip aus §14 — Unsichtbares sichtbar machen: die
`PolicyRail` macht eine Entscheidung nicht nur nachvollziehbar, sondern
*vorführbar*.

Was der Export **nicht** liefert: Persistenz, Tenant-Isolation auf DB-Ebene,
serverseitige Durchsetzung, echte Tools. Diese vier Punkte sind der eigentliche
Aufwand — und sie sind der Grund, warum eine Portierung der App als Ganzes
nichts brächte.

### Empfohlene Reihenfolge, falls portiert wird

1. **Verdict-Vokabular klären.** Ein Mapping-Modul zwischen den Modellen (§2.1),
   kein Rewrite der bestehenden Engines. Ohne diesen Schritt wächst die Zahl
   paralleler Wahrheiten auf sechs.
2. **Genesis- und Kanonisierungsfrage entscheiden** (§2.2, §2.3) — zwingend
   *vor* dem ersten geschriebenen `EvidenceEvent`.
3. **Policy-Modul serverseitig** in `supabase/functions/_shared/`, mit Tests.
   Contracts bleiben, wo sie sind.
4. **Migration** mit neuem Tabellennamen, `tenant_id NOT NULL` + RLS, additiv.
5. **Consent-Persistenz** — der größte Einzelposten, ohne Vorlage im Bestand.
6. **UI zuletzt**, unter `/app/…`, react-router, ohne neue Dependencies.

`.vercel/`, `better-auth`, `kysely`, `pglite`, `@tanstack/react-start` und
`nitro` werden in keinem dieser Schritte berührt — sie werden verworfen, nicht
adaptiert.
