# AI-Router & Economics — RFC

**Status:** Draft / Phase 0 abgeschlossen, Pricing-Entscheidungen getroffen —
keine Production-Änderung
**Scope:** Multi-Provider-AI-Routing, Kostenkontrolle, Monetarisierung
**Verhältnis zu bestehenden RFCs:** baut auf `runtime-kernel-rfc.md` §P4
(Economic Control) und `governance-intelligence-economic-control-rfc.md` auf.
Ersetzt keins von beiden.

Reihenfolge, verbindlich:

> Security → Cost Engine → Router → Ledger → Stripe → Dashboard → Upsell → Enterprise

## Entscheidungslog

| Punkt | Entscheidung | Wo |
|---|---|---|
| Growth 20 € → 37,35 € | **nicht ändern.** Separater Pricing-Change mit Bestandskundenstrategie; die Routing-Implementierung darf den Wert nicht implizit anfassen | §5.1 |
| Partner 500 € → 299,85 € | **nicht automatisch anwenden.** Bestand behält 50 000, neue Staffel nur für Neuverträge | §5.2 |
| `enterprise: -1` | **abschaffen.** Explizites Budget über Plan-Katalog + `tenant_cost_caps`, Reserve/Settle, Warnschwelle, definierte Exhaustion-Semantik | §5.4 |
| Leitinvariante | Kein Provider-Request außerhalb des Cost-Gates — als **Contract-Test**, nicht als Konvention | §3.3 |

Die 15-%-Formel aus der ersten Fassung ist damit **kein automatisch
anzuwendender Wert** mehr. Sie bleibt als Orientierung für Neuverträge und für
die Frage, ob ein bestehender Wert gedeckt ist — nicht als Migrationsvorlage.

---

## 0. Phase-0-Audit — Ist-Stand

Alles in diesem Abschnitt ist am Repo verifiziert. Was nicht verifizierbar war,
steht als `NOT VERIFIABLE` markiert.

### 0.1 Was bereits existiert

Der Konzeptentwurf ging davon aus, dass die Bausteine überwiegend vorhanden
sind. Das stimmt — und zwar weiter, als erwartet:

| Baustein | Ort | Zustand |
|---|---|---|
| Kosten-Ledger | `tenant_cost_ledger` (`supabase/migrations/20260603100000_tenant_cost_ledger.sql`) | produktiv, RLS, Replay-Guard |
| Monats-Caps | `tenant_cost_caps` (`20260604000000_economic_intelligence.sql:137`) | produktiv |
| Reserve/Settle | `cost_check_and_reserve` / `cost_writer_settle` (`20260604000000:162`) | **race-safe**, 5-min-Reservierung |
| Cap-Middleware | `supabase/functions/_shared/cost-cap.ts` | produktiv |
| Ledger-Writer | `supabase/functions/_shared/cost-writer.ts` | produktiv |
| Metered AI-Pipeline | `supabase/functions/_shared/ai.ts` | Gate → Quota → Reserve → Call → Run-Log → Usage → Settle |
| Usage-Aggregation | `usage_events` → `usage_totals` (DB-Trigger) | atomar |
| Kosten-Entitlement | `limit.ai_cost_monthly_cents` | **existiert bereits** |
| Warn-Schwelle 80 % | `tenant_cost_caps.warn_threshold DEFAULT 0.80` | existiert bereits |
| Quota-UI-Primitive | `src/core/access/QuotaBar.tsx`, `src/features/billing/UsageView.tsx` | existiert bereits |

**Konsequenz:** Der Reserve-/Settle-Pfad in `_shared/ai.ts` ist bereits das, was
der Entwurf als „Phase 4 — AI Ledger" beschrieben hat. Er muss nicht gebaut,
sondern *vervollständigt und flächendeckend erzwungen* werden.

### 0.2 Befund A — Fünf AI-Pfade, nur einer ist vollständig verrechnet

Das ist der wichtigste Architekturbefund. Die erste Fassung dieses Abschnitts
nannte drei Pfade; eine Nachprüfung über die direkten Provider-SDK-Importe hat
zwei weitere gefunden. Die korrigierte Liste:

```
Pfad 1  ai-invoke / _shared/ai.ts ........ Gate + Quota + Reserve + Ledger + Usage  ✅
Pfad 2  ai-gateway / aiGateway/router.ts . tenant-los, kein Ledger, kein Cap        ❌
Pfad 3  governance-router ................ ai_tool_runs mit cost_usd: 0             ❌
Pfad 4  governance-agent ................. eigene Preisschätzung, kein Reserve,
                                           kein tenant_cost_ledger                  ❌
Pfad 5  optimize-analyze ................. Anthropic direkt, tenantId bekannt,
                                           keinerlei Verrechnung                    ❌
```

Belege:

- `supabase/functions/ai-gateway/index.ts:109` — `tenant_id: null, // Gateway ist
  (noch) tenant-los: nur globale Policies`.
- `supabase/config.toml:168-170` benennt die Lücke selbst: *„Offen bleiben:
  Tenant-Auflösung, persistentes Rate-Limit, `ai_tool_runs`-Logging und
  Anbindung an `_shared/cost-cap.ts`."*
- `supabase/functions/governance-router/index.ts:404` — `cost_usd: 0`. Der
  Router zählt Calls gegen ein Stufen-Kontingent, attribuiert aber **keine
  Providerkosten**.
- `supabase/functions/governance-agent/index.ts:539, 906-911` — schreibt ein
  `cost_usd` in die eigene Runs-Tabelle, berechnet aus `MODEL_PRICING`
  (`_shared/modelSelection.ts:120-123`). Kein `reserveLlmBudget`, kein Eintrag
  in `tenant_cost_ledger`. Die Kosten sind sichtbar, aber nicht budgetwirksam.
- `supabase/functions/optimize-analyze/index.ts:42` — ruft Anthropic direkt mit
  `ANTHROPIC_API_KEY` auf. Die `tenantId` liegt in derselben Funktion vor
  (`:24`), wird aber weder für Reserve noch für Ledger noch für Usage benutzt.

Pfad 5 ist der aussagekräftigste Fall: der Tenant ist bekannt, und trotzdem
wird nichts verrechnet. Das zeigt, dass die Lücke keine fehlende Information
ist, sondern eine fehlende Durchsetzung.

Damit ist die Invariante („jeder Provider-Request ist einem Tenant, einer
Policy und einem Budget zugeordnet") heute an **vier von fünf** Eingängen
verletzt. Ein Multi-Provider-Router, der auf diese Basis aufsetzt, skaliert die
Lücke mit.

Die Zahl „fünf" ist ausdrücklich eine untere Schranke: sie stammt aus einer
Suche nach direkten Provider-SDK-Importen. Genau deshalb gehört die Invariante
nicht in ein Dokument, sondern in einen Test (§3.3) — eine Aufzählung veraltet
mit dem nächsten Merge.


### 0.3 Befund B — Starter (79 €) hat gar kein AI-Limit

`shared/pricing.ts:1893-1919` (Plan `starter`) enthält **keinen** der drei
Schlüssel `limit.ai_calls_monthly`, `limit.ai_tokens_monthly`,
`limit.ai_cost_monthly_cents` — nur `limit.llm_queries_monthly: 100`.

Die Vorprüfung in `_shared/ai.ts:126-135` ist:

```ts
if (typeof callLimit === 'number' && callLimit !== -1 && ...)
```

Fehlt der Schlüssel, ist der Wert `undefined`, die Bedingung ist falsch — **die
Prüfung wird übersprungen**. `usage.ts:127` dokumentiert dieselbe Semantik
ausdrücklich: *„-1 = unlimited, 0 / missing = no quota."*

Der einzige verbleibende Rückfall ist `cost_check_and_reserve`. Existiert für
den Tenant keine `tenant_cost_caps`-Zeile, greift der Hardcode-Default in
`20260604000000_economic_intelligence.sql:187-192`:

```sql
IF v_caps.tenant_id IS NULL THEN
    v_caps.llm_usd_monthly := 250.00;
```

**Ein Starter-Tenant für 79 € darf damit bis zu 250 USD Providerkosten im Monat
verursachen.** Das ist kein theoretisches Risiko, sondern die aktuell
konfigurierte Obergrenze.

### 0.4 Befund C — Die Limit-Staffel ist nicht monoton und nicht gedeckt

`shared/pricing.ts:1946-2134`:

| Plan | Preis | `ai_cost_monthly_cents` | = max. Providerkosten | Anteil am Umsatz |
|---|---|---|---|---|
| starter | 79 € | *(fehlt)* | 250 USD (Default-Cap) | **> 250 %** |
| growth | 249 € | 2 000 | 20 € | 8 % |
| agency | 699 € | 10 000 | 100 € | 14 % |
| enterprise | 1 249 €* | **-1** | **unbegrenzt** | **∞** |
| partner | 1 999 €* | 50 000 | 500 € | 25 % |

\* `enterprise` und `partner` sind `priceOnRequest` / Inquiry bzw. Legacy —
siehe `shared/pricing.ts:404-419, 830-833`.

Growth und Agency liegen plausibel. Starter und Enterprise sind die beiden
offenen Flanken; Partner liegt mit 25 % über dem, was nach Abzug von Supabase,
Cloudflare, Storage, Stripe und Support tragfähig ist.

### 0.5 Befund D — Keine zentrale Preistabelle

`grep` über `supabase/migrations` und `supabase/functions` findet **keine**
Tabelle `ai_model_prices` / `model_pricing`. Preise hängen stattdessen als
Spalten am *Tool*, nicht am *Modell*
(`_shared/ai.ts:52-53` → `ai_tools.cost_input_per_million_usd`,
`cost_output_per_million_usd`).

Zwei Folgen:

1. Dasselbe Modell kann über zwei Tools mit zwei verschiedenen Preisen
   verrechnet werden.
2. Eine Providerpreis-Änderung erfordert ein `UPDATE` über alle Tool-Zeilen.
   Es gibt keine Historisierung (`effective_from`), also auch keine korrekte
   Rückrechnung vergangener Perioden.

`cost-writer.ts:34-36` nimmt den Preis als Parameter entgegen — die
Preis-Wahrheit liegt also beim Aufrufer. Das ist genau die Stelle, an der eine
SSoT fehlt.

Tatsächlich existieren heute **drei** unabhängige Preisquellen:

| Quelle | Ort | Granularität |
|---|---|---|
| `ai_tools.cost_*_per_million_usd` | DB-Spalten pro Tool | pro Tool |
| Parameter an `writeLlmCost` | `cost-writer.ts:34-36` | pro Aufrufer |
| `MODEL_PRICING` | `_shared/modelSelection.ts:120-123` | hartcodiert, Haiku/Sonnet |

`MODEL_PRICING` ist der ungünstigste Fall: zwei Modelle, fest im Code, ohne
Gültigkeitsdatum. Er speist die Kostenschätzung von `governance-agent`
(Pfad 4) und die dortige „Savings"-Rechnung (`estimateSavings`). Eine
Providerpreis-Änderung verschiebt damit stillschweigend eine Zahl, die als
Einsparung ausgewiesen wird.

### 0.6 Befund E — xAI/Grok existiert nicht

`supabase/functions/_shared/providers.ts:67`:

```ts
export type ProviderId = 'anthropic' | 'google' | 'openai' | 'ollama';
```

Der Konzeptentwurf rechnet durchgehend mit Grok als viertem Cloud-Provider
(Routing-Anteile, Preisvergleich, Circuit Breaker). Dafür gibt es heute weder
Adapter noch Key-Auflösung noch Policy-Eintrag. Die Treffer auf `grok` liegen
ausschließlich in `lmStudioAdapter.ts` (lokale Modellnamen), nicht in einem
Cloud-Pfad.

**Das Grok-Routing ist ohne neuen Adapter nicht baubar.** Es gehört nicht in
Phase 3, sondern hinter einen eigenen, abgegrenzten Schritt.

### 0.7 Befund F — Währungsbruch USD ↔ EUR

`tenant_cost_caps.llm_usd_monthly` ist USD. `shared/pricing.ts` ist EUR.
`limit.ai_cost_monthly_cents` ist einheitenlos benannt, wird in `_shared/ai.ts:227`
aber aus `costUsd` befüllt — also faktisch **US-Cent**, während der Plan in Euro
verkauft wird. Bei 10 % FX-Bewegung verschiebt sich die Marge still.

### 0.8 Befund G — Der Ledger ist ausdrücklich nicht für Kunden-Dashboards

`20260603100000_tenant_cost_ledger.sql:1-9`:

> *„NICHT Stripe-Billing. NICHT Invoice-Generation. Es ist internal
> runtime-financial observability … Public Dashboards lesen NICHT diese Tabelle."*

Das AI-Control-Center darf also **nicht** gegen `tenant_cost_ledger` lesen. Die
kundenseitige Wahrheit ist `usage_totals` + `tenant_entitlements()`.

### 0.9 Befund H — `override_until` ist tot

`tenant_cost_caps.override_until`
(`20260604000000_economic_intelligence.sql:146`) existiert als Spalte und wird
**nirgends gelesen**. Eine Suche über `supabase/`, `src/`, `shared/` und
`platform/` findet genau einen Treffer: die Schema-Definition selbst.

`cost_check_and_reserve` wertet die Spalte nicht aus. Es gibt damit heute
keinen unterstützten Weg, ein erschöpftes Budget befristet anzuheben — und die
RLS auf der Tabelle ist `FOR ALL USING (false)` (`:155-157`), also ist selbst
das manuelle Setzen nur mit Service-Role möglich und nirgends dokumentiert.

Das ist für §5.4.4 (Enterprise-Exhaustion) direkt relevant: die vorgesehene
Entlastungsmechanik ist angelegt, aber nicht verdrahtet.

### 0.10 Offene Sicherheitsbefunde, die vorher zu schließen sind

`AUDIT/11_AI_SECURITY.md:69-70`:

| ID | Prio | Befund |
|---|---|---|
| F-AI1 | P1 | `cookie-scan-deep` unauthentifiziert, holt beliebige URLs → SSRF-Proxy |
| F-AI2 | P2 | Keine Prompt-Injection-Abwehr bei Verarbeitung fremder Website-Inhalte |

Beide betreffen Pfade, die Modell-Input erzeugen. Ein Router, der Tool-Autorität
über mehrere Provider verteilt, vergrößert den Effekt beider Befunde.

### 0.11 NOT VERIFIABLE

Aus dieser Session nicht überprüfbar, bewusst offen gelassen:

- Produktions-SHA auf Cloudflare Pages
- Tatsächlich in Supabase angewendeter Migrationsstand
- Stripe-Checkout-E2E gegen Live-Preise
- Belegung von `tenant_cost_caps` in Produktion (wie viele Tenants ohne Zeile)
- Reale Providerpreise zum Stichtag (siehe §2.2 — bewusst ohne Zahlen im Code)

---

## 1. Was aus dem Entwurf bleibt — und was nicht

### 1.1 Bleibt

- Nicht Token verkaufen, sondern Kapazität. Die Begründung trägt: Input-,
  Output-, Cache- und Tool-Preise unterscheiden sich je Provider so stark, dass
  eine reine Tokenzahl kein Produktmaß ist.
- Router entscheidet über Qualität **und** Kosten, nicht nur Qualität.
- Budget-Guard mit abgestuftem Verhalten statt hartem Abbruch.
- Zwei getrennte Caps: Kunden-Cap und Provider-Cap.
- EU-Only als blockierende Policy, nicht als Präferenz.
- Untrusted Content bekommt keine Tool-Autorität.
- Keine zweite Billing-Wahrheit neben `shared/pricing.ts`.

### 1.2 Fällt weg — AI Units werden keine neue Währung

Der Entwurf definiert `1 AI Unit = 0,001 € kalkulatorische Providerkosten` und
schlägt eine neue Persistenz dafür vor.

Das ist unnötig. `limit.ai_cost_monthly_cents` **ist bereits** ein
kostendenominiertes Kontingent — mit Entitlement-Katalog, Plan-Zuordnung,
`usage_totals`-Aggregation und Stripe-Meter-Anbindung.

> **AI Units sind eine Darstellungsform, keine Speicherform.**
>
> `1 Cent = 10 AI Units`. Die Umrechnung lebt in genau einer Funktion im
> Frontend. Es gibt keine `ai_units`-Spalte, keine `ai_units`-Tabelle und keinen
> zweiten Zähler.

Damit entfällt die Hälfte der im Entwurf vorgeschlagenen neuen Tabellen.

### 1.3 Reduziert — neue Persistenz

Der Entwurf listet zehn neue Tabellen. Notwendig sind zwei:

| Tabelle | Warum nicht wiederverwendbar |
|---|---|
| `ai_model_prices` | Befund D: Preis hängt am Tool, nicht am Modell; keine Historie |
| `ai_routing_decisions` | Kein bestehendes Objekt hält *warum* ein Modell gewählt wurde |

Alles andere wird abgebildet auf: `tenant_cost_ledger` (Kosten),
`ai_tool_runs` (Requests), `usage_events`/`usage_totals` (Kontingent),
`runtime_events` (Budget-Ereignisse, siehe `cost.cap_violation_blocked`),
`ai_policies` (Provider-Zulässigkeit).

`ai_provider_health` wird bewusst **nicht** persistiert — Health gehört in einen
In-Memory-/KV-Zustand mit TTL, nicht in Postgres.

---

## 2. Cost Engine

### 2.1 `ai_model_prices` als SSoT

```
ai_model_prices
  provider          text     -- ProviderId
  model_id          text
  input_per_mtok    numeric
  output_per_mtok   numeric
  cache_read_per_mtok   numeric null
  cache_write_per_mtok  numeric null
  currency          text     -- 'USD'
  effective_from    timestamptz
  effective_to      timestamptz null
  primary key (provider, model_id, effective_from)
```

`ai_tools.cost_*_per_million_usd` wird **nicht sofort entfernt**. Migrationspfad:

1. Tabelle anlegen, mit den heutigen Tool-Preisen befüllen.
2. `cost-writer.ts` liest den Preis über `(provider, model_id, occurred_at)`.
3. Divergenz-Report: Tool-Preis vs. Tabellen-Preis, über eine Abrechnungsperiode.
4. Erst bei Deckungsgleichheit werden die Tool-Spalten `deprecated`.

Schritt 3 ist nicht optional. Er ist der Beleg, dass die Umstellung die
bestehende Verrechnung nicht verschiebt.

### 2.2 Keine Providerpreise im Code

Preise ändern sich häufiger als Releases. Sie gehören in Daten
(`ai_model_prices`) mit `effective_from`, nicht in TypeScript-Konstanten und
nicht in dieses Dokument. Jede hier eingetragene Zahl wäre am Tag der ersten
Providerpreis-Änderung falsch — und dieses Dokument ist dann die falsche
Wahrheit, die jemand zitiert.

### 2.3 Währung

`limit.ai_cost_monthly_cents` wird auf **EUR-Cent** festgelegt. Die Umrechnung
USD → EUR erfolgt einmal beim Ledger-Write mit dem Kurs aus
`ai_model_prices.currency` und wird in `raw_metadata` mitgeschrieben
(`fx_rate`, `fx_date`), damit die Periode später reproduzierbar ist.

---

## 3. Security-Gate vor dem Router

Kein Provider-Call ohne diese Kette. Reihenfolge ist normativ:

```
Browser
  ↓  Anon-Key ist im Bundle — kein Vertrauensanker
Cloudflare
  ↓
Authenticated Edge Function
  ↓  Tenant-Auflösung            ← heute fehlend in ai-gateway
Policy Engine (ai_policies)
  ↓  Provider-Allowlist, Residency
Data Classification
  ↓  PII, Untrusted-Content-Flag
Cost Guard (cost_check_and_reserve)
  ↓  reserve vor dem Call
AI Router
  ↓
Provider
  ↓
Settle + Ledger + usage_events
```

### 3.1 Vorbedingungen (blockierend)

Bevor der Router (Phase 4) beginnt:

- **S1** — `ai-gateway` bekommt Tenant-Auflösung, `ai_tool_runs`-Logging und
  `cost-cap.ts`-Anbindung. Die Lücke ist in `supabase/config.toml:168-170`
  bereits benannt; sie zu schließen ist Voraussetzung, nicht Folgearbeit.
- **S2** — `governance-router` schreibt echte `cost_usd` statt `0`
  (`governance-router/index.ts:404`).
- **S2b** — `governance-agent` und `optimize-analyze` gehen über Reserve/Settle
  (Pfade 4 und 5). `governance-agent` gibt dabei seine eigene Preisrechnung aus
  `MODEL_PRICING` auf und liest aus `ai_model_prices` (§2.1).
- **S3** — F-AI1 (SSRF, `cookie-scan-deep`) geschlossen.
- **S4** — Untrusted-Content-Pfad ohne Tool-Autorität (F-AI2).
- **S5** — Fehlende Entitlement-Schlüssel führen zu **deny**, nicht zu
  *skip*. Das ist ein Verhaltenswechsel an `_shared/ai.ts:126-135` und
  `usage.ts:127` und braucht einen eigenen, getesteten Schritt — er kann
  bestehende Tenants sperren.
- **S6** — Starter bekommt einen expliziten AI-Kostenschlüssel (§5.1).
- **S7** — `test/contracts/ai-cost-gate-guard.test.ts` läuft in CI (§3.3), mit
  Ausnahmeliste für die noch offenen Pfade.
- **S8** — `enterprise: -1` ist ersetzt (§5.4), `override_until` verdrahtet
  (Befund H).

S5 und S6 gehören zusammen: S5 allein würde Starter von AI abschneiden, S6
allein ließe die Fail-Open-Semantik für jeden künftigen Plan bestehen.

S7 sollte **früh** kommen, nicht am Ende: er ist ab Tag eins grün und
verhindert, dass während der Arbeit an S1–S2b neue Umgehungen entstehen, die
danach einzeln nachzuziehen wären.

### 3.2 Untrusted Content

```
Fremder Website-/Dokumentinhalt
        ↓
als DATEN markiert, nie als Instruktion
        ↓
Tool-Autorität = 0
        ↓
Modell
```

Konkret: Inhalte aus Crawls, Uploads und externen APIs werden in einem eigenen
Message-Segment übergeben, das keine Tool-Calls auslösen darf. Ein Modell, das
aus solchem Inhalt heraus ein Tool anfordert, wird abgelehnt und erzeugt ein
`runtime_events`-Ereignis.

---

### 3.3 Die Invariante gehört in einen Test, nicht in ein Dokument

Der eigentliche Hebel ist nicht das Routing, sondern dieser Satz:

> **Kein AI-Provider-Request darf außerhalb des zentralen
> Cost-Gate-/Reserve-/Settle-Pfades stattfinden.**

Befund A zeigt, warum das nicht als Konvention reicht. Die erste Fassung dieses
RFC nannte drei Umgehungen; eine zweite Suche fand fünf. Eine Aufzählung in
einem Dokument veraltet mit dem nächsten Merge, und darauf zu vertrauen, dass
jeder neue Provider-Adapter korrekt rechnet, ist genau die Annahme, die heute
vierfach gebrochen ist.

Deshalb wird die Invariante als **Contract-Test** geführt, in der bestehenden
Reihe `test/contracts/` (neben `stripe-price-guard.test.ts`,
`offer-price-guard.test.ts`, `migration-version-collision.test.ts`):

`test/contracts/ai-cost-gate-guard.test.ts`

Zwei Zusicherungen, beide statisch über den Quellbaum — kein Provider-Call im
Test, keine Netzabhängigkeit:

1. **Kein Provider-SDK außerhalb der Allowlist.** Ein Import von
   `@anthropic-ai/sdk`, `@google/genai`, `openai` oder ein `fetch` gegen einen
   bekannten Provider-Host ist nur in einer expliziten Allowlist erlaubt
   (`_shared/providers.ts`, `_shared/aiGateway/*Adapter.ts`). Jede neue Datei,
   die einen Provider direkt anspricht, bricht den Test.
2. **Wer einen Provider erreicht, erreicht auch das Cost-Gate.** Jede Edge
   Function, die — direkt oder transitiv über die Allowlist — einen Provider
   aufruft, muss `reserveLlmBudget` und `settleLlmBudget` erreichen. Das ist die
   Zusicherung, die `optimize-analyze` (Pfad 5) heute verletzen würde.

Der Test wird mit einer dokumentierten Ausnahmeliste eingeführt, die die
heutigen fünf Pfade enthält, und diese Liste schrumpft mit jedem geschlossenen
Pfad. So ist der Test ab Tag eins grün, verhindert aber sofort **neue**
Umgehungen — der teurere Fall, weil jede neue Umgehung später einzeln
nachgezogen werden muss.

Eine Ausnahme in dieser Liste braucht eine Begründung im Code, keinen stillen
Eintrag. Wenn die Liste leer ist, ist Invariante I-2 durchgesetzt statt
behauptet.

Grenzen, die der Test nicht abdeckt und die deshalb hier stehen: er ist
statisch. Ein Provider-Call über eine dynamisch zusammengesetzte URL oder aus
einem separaten Dienst heraus (`services/openclaw-agent/` hat eine eigene
`cost-cap.js`) entgeht ihm. Das ist ein bewusster Schnitt — ein statischer
Test, der 90 % abdeckt und in CI läuft, ist einem vollständigen Konzept
überlegen, das niemand ausführt.

## 4. Router

### 4.1 Signale

```
quality · cost · privacy · risk · latency
context · tools · region · availability · tenant_budget
```

### 4.2 Verhältnis zu bestehendem Code

Es existieren heute zwei Auswahlmechanismen, die der Router **ablöst**, nicht
ergänzt:

- `_shared/modelSelection.ts` — Keyword-Heuristik, nur `haiku | sonnet`,
  Anthropic-only, genutzt vom Governance-Agent.
- `_shared/aiGateway/router.ts` — feste Fallback-Kette
  LM Studio → Anthropic → OpenAI, Provider je `ModelProfile` hart gemappt
  (`router.ts:23-29`).

Beide bleiben zunächst in Betrieb. Der neue Router wird daneben gestellt und
pro Tool über ein `routing_profile`-Feld aktiviert, damit die Umstellung
tool-weise und rückrollbar erfolgt.

### 4.3 Budget-Guard

Abgestuft statt binär. Die 80-%-Schwelle existiert bereits als
`tenant_cost_caps.warn_threshold`:

| Verbrauch | Verhalten |
|---|---|
| 0–70 % | normal |
| 70–85 % | kostenoptimiert |
| 85–95 % | aggressiv kostenoptimiert |
| 95–100 % | günstigstes zulässiges Modell |
| > 100 % | blockiert → Top-up oder Upgrade |

„Zulässig" heißt: nach Policy erlaubt. Der Budget-Guard darf eine
Residency- oder Allowlist-Entscheidung **nie** überschreiben. Ist kein
zulässiges Modell im Budget, wird blockiert — nicht ausgewichen.

### 4.4 Circuit Breaker

Fallback nur innerhalb der Policy-Allowlist des Tenants. Ein Ausfall von
Provider A führt nicht automatisch zu Provider B, wenn B für den Tenant nicht
zugelassen ist. Health wird als TTL-Zustand geführt, nicht in Postgres (§1.3).

### 4.5 Grok / xAI

Eigener, nachgelagerter Schritt (Befund E): Adapter in
`_shared/providers.ts`, Erweiterung von `ProviderId`, Key-Auflösung über
`getApiKey`, Preiszeilen in `ai_model_prices`, Policy-Eintrag. Erst danach
darf der Router xAI als Kandidat führen.

---

## 5. Monetarisierung

### 5.1 Plan-Limits — entschieden

Die erste Fassung schlug eine durchgehende 15-%-Staffel vor. Entschieden wurde
gegen die pauschale Anwendung: eine Budgetzahl ist kein reiner Rechenwert,
sondern eine Zusage an bestehende Kunden.

| Plan | Preis | `ai_cost_monthly_cents` heute | Entscheidung |
|---|---|---|---|
| starter | 79 € | *(fehlt → 250-USD-Default)* | **Schlüssel setzen** — offene Flanke, siehe unten |
| growth | 249 € | 2 000 | **bleibt 2 000** |
| agency | 699 € | 10 000 | bleibt 10 000 |
| enterprise | 1 249 €* | **-1** | **`-1` entfällt** → §5.4 |
| partner | 1 999 €* | 50 000 | Bestand bleibt 50 000, Neuverträge §5.2 |

\* `priceOnRequest` / Inquiry bzw. Legacy (`shared/pricing.ts:404-419, 830-833`).

**Growth bleibt beim bestehenden Wert.** Eine Erhöhung des AI-Kostenbudgets ist
kein technisches Nachziehen, sondern eine Änderung des Leistungsumfangs für
bestehende Kunden. Sie wird separat entschieden, mit eigener Migration und
Bestandskundenstrategie.

> Normativ: Die Routing-Implementierung darf das Growth-Budget nicht implizit
> verändern. Weder ein Default im Router, noch ein Fallback im Cost-Gate, noch
> eine Backfill-Migration darf `limit.ai_cost_monthly_cents` für `growth`
> anfassen. Wer den Wert ändern will, ändert `shared/pricing.ts` in einem
> eigenen PR mit `check:pricing`.

**Starter ist davon nicht gedeckt.** Growth einzufrieren heißt nicht, Starter
einzufrieren — Starter hat heute *gar keinen* Wert und fällt deshalb auf 250
USD zurück (Befund B). Das ist keine Zusage, die geschützt werden müsste,
sondern eine Lücke. Einen Schlüssel zu setzen senkt die faktische Obergrenze
und ist damit kein Leistungsentzug gegenüber dem Beworbenen, sondern die
Herstellung des beworbenen Zustands. Der konkrete Wert bleibt offen, bis der
Ist-Verbrauch der Starter-Tenants über `usage_totals` ausgewertet ist; bis
dahin ist nur festgelegt, **dass** ein Wert gesetzt wird.

### 5.2 Partner — Bestandsschutz

Bei Partner entscheidet nicht die Preisformel, sondern was vertraglich zugesagt
wurde.

- **Bestehende Partner-Tenants:** 50 000 bleiben. Keine automatische Absenkung,
  keine Migration, die den Wert anfasst.
- **Neuverträge:** neue Staffel.

Technisch heißt das, dass die Plan-Ebene allein nicht ausreicht — zwei Tenants
auf demselben `planKey` brauchen unterschiedliche Budgets. Der Weg dafür ist
`tenant_cost_caps` als tenant-spezifische Überschreibung über dem
Plan-Entitlement (§5.4), nicht ein zweiter Plan-Key `partner_legacy`. Ein
zweiter Key würde die Plan-Taxonomie aufblähen und wäre in `plan_catalog`,
Stripe und `normalizePlanKey()` nachzuziehen.

> Normativ: Eine Migration, die `limit.ai_cost_monthly_cents` für `partner`
> absenkt, ist ohne geprüfte Vertragslage unzulässig.

### 5.3 AI Capacity Packs

Preise werden **nicht** in diesem Dokument festgelegt. Sie werden gegen
tatsächliche Providerkosten und Zielmarge simuliert, sobald `ai_model_prices`
und der Divergenz-Report aus §2.1 eine Periode Daten haben. Die Struktur:

```
Pack  →  N AI Units  →  N/10 EUR-Cent zusätzliches ai_cost_monthly_cents
```

Anbindung ausschließlich über bestehende Wege: `plan_addons` →
`product_entitlements` → `tenant_entitlements()`. Kein zweiter
Abrechnungsmechanismus, keine eigene Credits-Tabelle.

### 5.4 Enterprise — von `-1` auf ein explizites Budgetmodell

`enterprise: -1` entfällt. Ein unbegrenztes Providerkostenbudget ist mit dem
Governance-Anspruch unvereinbar: Ein Produkt, das Kunden Kostenkontrolle über
ihre KI verkauft, kann sie für sich selbst nicht aussetzen.

#### 5.4.1 `-1` ist heute ohnehin kein funktionierendes Versprechen

Bemerkenswert am Ist-Zustand ist, dass `-1` nicht liefert, was es zusagt.
Der Ablauf für einen Enterprise-Tenant ohne `tenant_cost_caps`-Zeile:

```
limit.ai_cost_monthly_cents = -1
      ↓  _shared/ai.ts:126-135 → Quota-Check wird übersprungen
reserveLlmBudget
      ↓  cost_check_and_reserve, keine caps-Zeile
      ↓  Fallback: llm_usd_monthly := 250.00
250 USD erreicht → decision = 'throttle' → 429 COST_LIMIT_EXCEEDED
```

Der Plan sagt „unbegrenzt", die Runtime bricht bei 250 USD ab. `-1` ist damit
gleichzeitig ein Margenrisiko (falls jemand eine großzügige caps-Zeile setzt)
und ein Leistungsversprechen, das ohne diese Zeile nicht gehalten wird. Es
gegen ein explizites Budget zu tauschen ist keine Einschränkung gegenüber dem
heutigen Verhalten, sondern die erste ehrliche Fassung davon.

#### 5.4.2 Zwei Caps, klar getrennt

Das Modell trennt, was heute vermischt ist:

| | `limit.ai_cost_monthly_cents` | `tenant_cost_caps.llm_usd_monthly` |
|---|---|---|
| Bedeutung | Kunden-Kontingent (gekauft) | Provider-Backstop (was RealSync je ausgibt) |
| Quelle | `shared/pricing.ts` → `plan_catalog` | pro Tenant, vertraglich |
| Geprüft gegen | `usage_totals` | `SUM(tenant_cost_ledger.amount_usd)` |
| Sichtbar für Kunden | ja (Dashboard) | nein |
| Kennt „unbegrenzt" | heute `-1` | nein, `NOT NULL numeric` |

Regel: `tenant_cost_caps` ist die **tenant-spezifische Überschreibung** über dem
Plan-Default und nie niedriger als das verkaufte Kontingent. Sie ist zugleich
der Weg für die Partner-Bestandsfälle aus §5.2 und für Enterprise-Verträge —
ohne dass dafür neue Plan-Keys entstehen.

Ein Defekt, der dabei zu schließen ist: die beiden Caps werden heute gegen
**verschiedene Datenquellen** geprüft — das Entitlement gegen `usage_totals`,
der Cap gegen die Ledger-Summe. Beide zählen dieselben Calls, können aber
auseinanderlaufen (ein fehlgeschlagenes `recordUsage` in `ai.ts:224-232` wird
nur geloggt). Vor der Enterprise-Umstellung braucht es einen
Abgleichsreport über eine Periode; ohne den ist nicht entscheidbar, welcher der
beiden Werte im Konfliktfall gilt.

#### 5.4.3 Enterprise-Budget setzen

```
Vertrag
   ↓  ein expliziter Monatsbetrag, nie -1
plan_catalog            → konservativer Default für 'enterprise'
   ↓
tenant_cost_caps        → vertraglicher Wert pro Tenant
   ↓
cost_check_and_reserve  → Reserve VOR dem Provider-Call
   ↓
Provider
   ↓
cost_writer_settle      → Settle mit tatsächlichem Verbrauch
   ↓
usage_events → usage_totals → Dashboard
   ↓
runtime_events          → Evidence
```

Der Default im Plan-Katalog ist bewusst konservativ: Enterprise ist
`priceOnRequest`, es gibt also keinen öffentlichen Preis, aus dem sich ein
Budget ableiten ließe. Der Default ist die Untergrenze für einen Vertrag, der
noch keinen eigenen Wert gesetzt hat — nicht die Zusage.

#### 5.4.4 Exhaustion-Semantik

Heute gibt es genau einen Ausgang: `throttle` → HTTP 429. Für einen
Enterprise-Vertrag ist ein unangekündigter harter Stopp mitten im Monat keine
angemessene Antwort — und stilles Weiterlaufen ist es ebenso wenig.

Definiert werden drei Ausgänge, pro Tenant konfiguriert:

| Modus | Verhalten bei 100 % | Für wen |
|---|---|---|
| `block` | Ablehnung, `429`, Ereignis `cost.cap_violation_blocked` | Default, Self-Service |
| `degrade` | nur noch das günstigste **policy-zulässige** Modell | opt-in |
| `overage` | Weiterlauf, Mehrverbrauch metered abgerechnet | nur vertraglich |

Vorgelagert, unverändert aus dem Bestand: `warn_threshold` (Default 0.80)
liefert bereits `decision = 'warn'`. Dieses Signal wird heute nicht sichtbar
gemacht — es bekommt Dashboard-Anzeige und Benachrichtigung.

`degrade` darf die Policy nicht brechen (Invariante I-4): „günstigstes Modell"
heißt immer „günstigstes zulässiges Modell". Ist keines zulässig, gilt `block`,
auch im `degrade`-Modus.

Für die befristete Entlastung wird `tenant_cost_caps.override_until`
verdrahtet — die Spalte existiert, wird aber nirgends gelesen (Befund H). Ohne
sie gibt es keinen unterstützten Weg, einen Vertrag mitten im Monat zu
entlasten, außer einem Service-Role-`UPDATE` an der RLS vorbei.

> Normativ: `-1` ist für `limit.ai_cost_monthly_cents` in keinem Plan mehr
> zulässig. Die Abwesenheit eines Budgets ist kein Budget.

### 5.5 Auto Top-Up

```
AI CAPACITY   72 %
[██████████████░░░░░░]

Auto Top-Up          ON
Auslöser             20 % Restkapazität
Pack                 50 000 AI Units
Monatliches Maximum  100 €
```

Das monatliche Maximum ist Pflichtfeld, nicht optional. Ohne harte Obergrenze
ist Auto-Top-up ein unbegrenztes Lastschriftmandat.

---

## 6. Dashboard

Kein neues Dashboard. `/app/dashboard` führt über `DashboardRouter` auf
`ComplianceStatusDashboard` (`src/features/governance/dashboard/DashboardRouter.tsx:13`);
die Usage-Primitiven existieren in `src/core/access/QuotaBar.tsx` und
`src/features/billing/UsageView.tsx`.

Neu ist **eine Sektion**: AI Control.

```
┌───────────────────────────────────────────────────────────┐
│ REALSYNC AI CONTROL                                       │
├──────────────┬──────────────┬──────────────┬──────────────┤
│ AI Capacity  │ AI Cost      │ Requests     │ Savings      │
│ 72 %         │ 18,42 €      │ 8 421        │ 31,80 €      │
├──────────────┴──────────────┴──────────────┴──────────────┤
│ AI ROUTING                                                │
│ Claude 34 %   GPT 28 %   Gemini 26 %   lokal 12 %         │
├──────────────────────────────────────────────────────────┤
│ Security ● Protected │ Governance ● EU │ Billing ● OK     │
└──────────────────────────────────────────────────────────┘
```

Datenquellen — verbindlich:

| Kachel | Quelle |
|---|---|
| AI Capacity | `usage_totals` + `tenant_entitlements()` |
| AI Cost | `usage_totals['limit.ai_cost_monthly_cents']` |
| Requests | `usage_totals['limit.ai_calls_monthly']` |
| Routing-Verteilung | `ai_tool_runs.metadata.provider` |
| Security/Governance | `runtime_events`, `ai_policies` |

**Nicht** `tenant_cost_ledger` — Befund G.

„Savings" wird erst ausgeliefert, wenn eine belastbare Baseline definiert ist
(Kosten desselben Requests auf dem teuersten zulässigen Modell). Ohne diese
Definition ist die Zahl eine Behauptung und gehört nicht ins Kundenbild.

---

## 7. Umsetzungsreihenfolge

| Phase | Inhalt | Gate |
|---|---|---|
| 0 | Audit (dieses Dokument) | ✅ abgeschlossen |
| 1 | **S7**: Contract-Test mit Ausnahmeliste | grün ab Tag eins |
| 2 | S1, S2, S2b: alle fünf Pfade auf Reserve/Settle; Ausnahmeliste leeren | Liste leer |
| 3 | S3, S4: SSRF, Prompt-Injection | Security-Review |
| 4 | `ai_model_prices` + Divergenz-Report; `MODEL_PRICING` entfällt | eine Periode deckungsgleich |
| 5 | S5, S6, S8: Fail-Closed, Starter-Schlüssel, Enterprise-Budget, `override_until` | Regressionstest über alle Pläne |
| 6 | Router mit Budget-Guard, tool-weise aktiviert | Rollback pro Tool möglich |
| 7 | Capacity Packs über `plan_addons` | Margensimulation aus Phase 4 |
| 8 | Dashboard-Sektion AI Control | — |
| 9 | Auto Top-Up mit hartem Monatsmaximum | — |
| 10 | xAI-Adapter; Enterprise BYOK / EU-Only / Custom Policy | — |

Zwei Reihenfolgen sind nicht verhandelbar:

- **Phase 1 vor allem anderen.** Der Contract-Test kostet wenig und friert den
  Ist-Zustand ein. Ohne ihn wächst die Zahl der Umgehungen während der Arbeit
  an ihnen.
- **Phase 5 vor Phase 6.** Ein Router auf einer Fail-Open-Quota verteilt
  unkontrollierten Verbrauch nur schneller über mehr Provider.

Die Implementierung der Routing-Lücken (Phase 2) ist ein eigener PR, getrennt
von diesem RFC.

---

## 8. Invarianten

> **I-1** — Der AI-Router darf kein Kundenversprechen erzeugen, dessen maximale
> Providerkosten nicht durch das Kundenentgelt gedeckt sind.

> **I-2** — Kein AI-Provider-Request findet außerhalb des zentralen
> Cost-Gate-/Reserve-/Settle-Pfades statt. Jeder ist vor Ausführung einem
> Tenant, einer Policy und einem Kostenbudget zugeordnet.
>
> Diese Invariante wird **getestet, nicht angenommen** (§3.3). Sie ist die
> einzige im Dokument mit einer maschinellen Entsprechung — weil sie die
> einzige ist, die heute mehrfach gebrochen ist, ohne dass es jemandem
> auffiel.

> **I-3** — Ein fehlendes Kontingent ist eine Ablehnung, keine Freigabe.

> **I-4** — Der Budget-Guard darf eine Policy-Entscheidung nie überschreiben.
> Kein zulässiges Modell im Budget ⇒ blockieren, nicht ausweichen.

> **I-5** — Es gibt genau eine Preis- und Entitlement-Wahrheit:
> `shared/pricing.ts` → `plan_catalog` → `product_entitlements` →
> `tenant_entitlements()`.

> **I-6** — `-1` ist für `limit.ai_cost_monthly_cents` in keinem Plan
> zulässig. Die Abwesenheit eines Budgets ist kein Budget.

I-2, I-3 und I-6 sind heute verletzt (Befunde A, B, C). I-2 schließt Phase 2,
I-3 und I-6 schließen Phase 5.

Zu I-1 eine Einschränkung, die der Redlichkeit halber hier steht: sie ist
heute nicht nachprüfbar. Solange `ai_model_prices` fehlt und drei Preisquellen
nebeneinander stehen (Befund D), lässt sich „durch das Kundenentgelt gedeckt"
nicht ausrechnen. I-1 wird erst mit Phase 4 prüfbar.

---

## 9. Was bewusst offen bleibt

Entschieden ist die *Richtung*, nicht jede Zahl. Offen und bewusst nicht
festgelegt:

- **Der Starter-Kostenschlüssel** (§5.1). Dass einer gesetzt wird, ist
  entschieden; welcher, hängt am Ist-Verbrauch über `usage_totals`.
- **Der Enterprise-Default im Plan-Katalog** (§5.4.3). Enterprise ist
  `priceOnRequest` — der Default ist eine Untergrenze, kein Preisbestandteil.
- **Konkrete Pack-Preise** (§5.3), bis die Margensimulation aus Phase 4 Daten
  hat.
- **Die Growth-Anhebung** (§5.1) als eigener Vorgang, terminlich ungebunden.
- **Die Partner-Vertragsanpassung** (§5.2) — Vertragsfrage, nicht
  Konfigurationsfrage.
- **Prompt-Caching und Batch** als Kostenhebel: real, aber erst nach Phase 4
  messbar. Vorher ist jede Einsparungsangabe geschätzt.
- **„Unlimited AI Access"** als Außenkommunikation: erst wenn die Kette
  geschlossen ist, und dann als Fair-Use-Zusage mit dokumentierter Obergrenze.
  Nach §5.4.1 ist das keine theoretische Vorsicht: `enterprise: -1` ist der
  Beleg, dass ein unbegrenztes Versprechen im Code ohnehin bei der erstbesten
  Grenze endet — nur eben unangekündigt.
