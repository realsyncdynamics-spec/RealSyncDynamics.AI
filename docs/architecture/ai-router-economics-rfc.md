# AI-Router & Economics — RFC

**Status:** Draft / Phase 0 abgeschlossen — keine Production-Änderung
**Scope:** Multi-Provider-AI-Routing, Kostenkontrolle, Monetarisierung
**Verhältnis zu bestehenden RFCs:** baut auf `runtime-kernel-rfc.md` §P4
(Economic Control) und `governance-intelligence-economic-control-rfc.md` auf.
Ersetzt keins von beiden.

Reihenfolge, verbindlich:

> Security → Cost Engine → Router → Ledger → Stripe → Dashboard → Upsell → Enterprise

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

### 0.2 Befund A — Drei parallele AI-Pfade, nur einer ist verrechnet

Das ist der wichtigste Architekturbefund.

```
Pfad 1  ai-invoke / _shared/ai.ts ........... Gate + Quota + Cap + Ledger + Usage   ✅
Pfad 2  ai-gateway / aiGateway/router.ts .... tenant-los, kein Ledger, kein Cap     ❌
Pfad 3  governance-router .................. ai_tool_runs mit cost_usd: 0          ❌
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

Damit ist die Invariante des Entwurfs („jeder Provider-Request ist einem
Tenant, einer Policy und einem Budget zugeordnet") heute an zwei von drei
Eingängen verletzt. Ein Multi-Provider-Router, der auf diese Basis aufsetzt,
skaliert die Lücke mit.

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

### 0.9 Offene Sicherheitsbefunde, die vorher zu schließen sind

`AUDIT/11_AI_SECURITY.md:69-70`:

| ID | Prio | Befund |
|---|---|---|
| F-AI1 | P1 | `cookie-scan-deep` unauthentifiziert, holt beliebige URLs → SSRF-Proxy |
| F-AI2 | P2 | Keine Prompt-Injection-Abwehr bei Verarbeitung fremder Website-Inhalte |

Beide betreffen Pfade, die Modell-Input erzeugen. Ein Router, der Tool-Autorität
über mehrere Provider verteilt, vergrößert den Effekt beider Befunde.

### 0.10 NOT VERIFIABLE

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

Bevor Phase 3 beginnt:

- **S1** — `ai-gateway` bekommt Tenant-Auflösung, `ai_tool_runs`-Logging und
  `cost-cap.ts`-Anbindung. Die Lücke ist in `supabase/config.toml:168-170`
  bereits benannt; sie zu schließen ist Voraussetzung, nicht Folgearbeit.
- **S2** — `governance-router` schreibt echte `cost_usd` statt `0`
  (`governance-router/index.ts:404`).
- **S3** — F-AI1 (SSRF, `cookie-scan-deep`) geschlossen.
- **S4** — Untrusted-Content-Pfad ohne Tool-Autorität (F-AI2).
- **S5** — Fehlende Entitlement-Schlüssel führen zu **deny**, nicht zu
  *skip*. Das ist ein Verhaltenswechsel an `_shared/ai.ts:126-135` und
  `usage.ts:127` und braucht einen eigenen, getesteten Schritt — er kann
  bestehende Tenants sperren.
- **S6** — Starter bekommt explizite AI-Limits (§5.1).

S5 und S6 gehören zusammen: S5 allein würde Starter von AI abschneiden, S6
allein ließe die Fail-Open-Semantik für jeden künftigen Plan bestehen.

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

### 5.1 Plan-Limits — Korrekturvorschlag

Leitplanke: maximale Providerkosten als Anteil am Monatspreis. 15 % ist der
Ansatz aus dem Entwurf und bleibt als Startwert; er ist bewusst konservativ,
weil aus demselben Preis Supabase, Cloudflare, Storage, Stripe, Monitoring und
Support bezahlt werden.

| Plan | Preis | `ai_cost_monthly_cents` heute | Vorschlag | Anzeige |
|---|---|---|---|---|
| starter | 79 € | *(fehlt → 250 USD)* | 1 185 | 11 850 Units |
| growth | 249 € | 2 000 | 3 735 | 37 350 Units |
| agency | 699 € | 10 000 | 10 485 | 104 850 Units |
| enterprise | 1 249 € | **-1** | vertraglich, nie `-1` | Custom |
| partner | 1 999 € | 50 000 | 29 985 | 299 850 Units |

Zwei Punkte, die eine Entscheidung brauchen und nicht still gesetzt werden
dürfen:

- **Growth steigt** von 20 € auf 37,35 €. Fachlich richtig, aber es erhöht die
  Providerkosten bestehender Tenants. Vor der Umstellung: Verteilung des
  Ist-Verbrauchs über `usage_totals` prüfen.
- **Partner sinkt** von 500 € auf 299,85 €. Partner ist Legacy/Bestand
  (`shared/pricing.ts:38`). Eine Absenkung bei Bestandstenants ist eine
  Vertragsfrage, keine Konfigurationsfrage — daher: neue Staffel nur für
  Neuverträge, Bestand behält 50 000 bis zur Vertragsanpassung.

`enterprise: -1` ist der einzige Wert, der ohne Diskussion weg muss. Ein
unbegrenztes Providerbudget ist mit der Geschäftsregel in §8 unvereinbar.

### 5.2 AI Capacity Packs

Preise werden **nicht** in diesem Dokument festgelegt. Sie werden gegen
tatsächliche Providerkosten und Zielmarge simuliert, sobald `ai_model_prices`
und der Divergenz-Report aus §2.1 eine Periode Daten haben. Die Struktur:

```
Pack  →  N AI Units  →  N/10 EUR-Cent zusätzliches ai_cost_monthly_cents
```

Anbindung ausschließlich über bestehende Wege: `plan_addons` →
`product_entitlements` → `tenant_entitlements()`. Kein zweiter
Abrechnungsmechanismus, keine eigene Credits-Tabelle.

### 5.3 Auto Top-Up

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
| 1 | S1–S4: Gateway-Tenanting, Router-Kosten, SSRF, Injection | Security-Review |
| 2 | `ai_model_prices` + Divergenz-Report | eine Periode deckungsgleich |
| 3 | S5+S6: Fail-Closed-Semantik, Starter-Limits, `enterprise: -1` weg | Regressionstest über alle Pläne |
| 4 | Router mit Budget-Guard, tool-weise aktiviert | Rollback pro Tool möglich |
| 5 | Capacity Packs über `plan_addons` | Margensimulation aus Phase 2 |
| 6 | Dashboard-Sektion AI Control | — |
| 7 | Auto Top-Up mit hartem Monatsmaximum | — |
| 8 | xAI-Adapter; Enterprise BYOK / EU-Only / Custom Policy | — |

Phase 3 vor Phase 4: Ein Router, der auf einer Fail-Open-Quota aufsetzt,
verteilt unkontrollierten Verbrauch schneller über mehr Provider.

---

## 8. Invarianten

> **I-1** — Der AI-Router darf kein Kundenversprechen erzeugen, dessen maximale
> Providerkosten nicht durch das Kundenentgelt gedeckt sind.

> **I-2** — Jeder Provider-Request ist vor Ausführung einem Tenant, einer Policy
> und einem Kostenbudget zugeordnet.

> **I-3** — Ein fehlendes Kontingent ist eine Ablehnung, keine Freigabe.

> **I-4** — Der Budget-Guard darf eine Policy-Entscheidung nie überschreiben.
> Kein zulässiges Modell im Budget ⇒ blockieren, nicht ausweichen.

> **I-5** — Es gibt genau eine Preis- und Entitlement-Wahrheit:
> `shared/pricing.ts` → `plan_catalog` → `product_entitlements` →
> `tenant_entitlements()`.

I-2 und I-3 sind heute verletzt (Befunde A, B). Das sind die beiden Positionen,
die Phase 1 und Phase 3 schließen.

---

## 9. Was bewusst offen bleibt

- „Unlimited AI Access" als Außenkommunikation: erst nach Phase 7, und dann als
  Fair-Use-Zusage mit dokumentierter Obergrenze — nicht als unbegrenzte
  Providerkosten.
- Prompt-Caching und Batch-Verarbeitung als Kostenhebel: real, aber erst nach
  Phase 2 messbar. Vorher ist jede Einsparungsangabe geschätzt.
- Konkrete Pack-Preise (§5.2).
- Partner-Bestandsvertragsanpassung (§5.1).
