# RealSyncDynamics.AI — Priorisierungs-Entscheid

> Dieses Dokument ist ein **Entscheid-Record**, kein neues Konzept. Es schärft
> die Reihenfolge aus [`ROADMAP.md`](../ROADMAP.md) und hält fest, *was* zuerst
> gebaut und verkauft wird — und *was bewusst nicht jetzt*. Scope-Disziplin
> bleibt [`docs/PRODUCT_FOCUS.md`](./PRODUCT_FOCUS.md), Nordstern bleibt
> [`docs/PLAN_100.md`](./PLAN_100.md) (5–10 echte Pilotkunden).
>
> Anlass: strategische Schärfung der Phasen-Reihenfolge. Manche Punkte
> **kollidieren mit bereits getroffenen Entscheidungen** — diese sind unten als
> offene Gabelungen markiert, nicht still überschrieben.

---

## Kern-Entscheid

**Ein Produkt, eine Codebase, ein Dashboard, ein Billing.** Der Website-Scan
*ist* das Vehikel, nicht ein eigenes Produkt. Verkauft wird in zwei Schritten:

| Schritt | Was | Preis | Funktion im Funnel |
|---|---|---|---|
| Einstieg | Governance-Scan | **kostenlos, reibungslos** | Lead / Reichweite |
| Kauf | Monitoring + **Evidence** | wiederkehrend | Moat / Kaufbegründung |

> Der Scan allein ist Commodity (eRecht24, Dr. DSGVO, Generatoren). Der Moat
> ist **kontinuierliches Monitoring + revisionssichere Evidence** — nicht die
> einmalige Analyse. Genau das, was der Evidence-Stack
> (`src/core/runtime/evidence.ts`, SHA-256 über kanonisches JSON) schon liefert.

---

## Übernommene Schärfungen

### S1 — Ein Produkt statt zwei Verpackungen
„Datenschutz-Check" und „Website Governance OS" sind **kein** separater Platz 1
und 2, sondern dasselbe Produkt mit zwei Marketing-Frames. Eine Codebase, eine
Story mit Segment-Sektionen (deckt sich mit `PLAN_100.md` #9/#10). Als
Solo-Founder keine parallele Energie auf zwei Produkte verteilen.

### S2 — NIS2 raus aus Phase 1
Anderer Käufer (IT-Leitung / GF Mittelstand), anderer Sales-Cycle (lang,
beratungsintensiv), andere Sprache. NIS2 bleibt **reiner Lead-Magnet**
(„NIS2-Betroffenheits-Check in 2 Min"), aber dort wird **kein Produkt** gebaut.

### S3 — Evidence von Phase 4 nach Phase 1 ziehen  ⚠️ Delta zu ROADMAP
**Wichtigste Korrektur.** `ROADMAP.md` verortet das Evidence-Vault heute in
**Phase 4** (Z. 172–177). Evidence ist aber nicht der *Ausbau* — es ist die
**Kaufbegründung**. Bezahlt wird ab „wir überwachen weiter und dokumentieren
nachweisbar", nicht ab „wir haben gescannt".

→ **Aktion:** Ein schlanker, revisionssicherer Evidence-Trail (append-only,
gehashte Scan-/Drift-Ereignisse, exportierbares Prüfpfad-PDF) gehört in das
**erste zahlende Tier**. Das volle Vault (HAR-Archiv, Ledger-Anchoring,
Langzeit-Retention) darf in Phase 4 bleiben.

### S4 — AI Vendor Registry vor AI Governance OS
Innerhalb der AI-Achse: erst das **KI-Inventar** („Welche KI nutzt euer Team?",
5 Min) als leichtes, schnelles „Aha", das die Daten fürs Governance OS
einsammelt — gleiche Land-and-Expand-Logik wie beim Scan. Erst danach das volle
Risiko-/AI-Act-Doku-Modul als Upsell an die bestehende Basis.

---

## Korrigierte Reihenfolge

| Phase | Produkt | Funktion | Verkauft als |
|---|---|---|---|
| 0–6 Mo | Governance-Scan + Monitoring | Scan, Drift-Alerts, **Evidence-Trail** | „Kostenloser Check" → bezahltes Monitoring |
| 6–12 Mo | AI Vendor Registry | KI-Inventar | „Welche KI nutzt euer Team?" (5 Min) |
| 12–18 Mo | AI Governance OS | Risiko + AI-Act-Doku | Upsell an bestehende Basis |
| 18+ Mo | Continuous-Compliance-Vision | Endbild | nur wenn die Basis trägt |

Dies ist eine **Reihenfolge, keine Parallelität** (vgl. `PRODUCT_FOCUS.md`,
Monetarisierungsachsen).

---

## Entschiedene Gabelungen — Founder-Entscheid vom 2026-06-20

> Diese drei Punkte des Memos widersprachen bereits dokumentierten
> Entscheidungen. Bewusst **nicht** eigenmächtig geändert, sondern dem Founder
> vorgelegt. **Entscheid am 2026-06-20: alle drei wie empfohlen.**

### K1 — Preis 49 € vs. 79 €  · ✅ ENTSCHIEDEN: 79 €
Das Memo nannte einen 49-€-Monitoring-Einstieg. `src/config/pricing.ts`
dokumentiert eine **bewusste Rebalance vom 2026-05-10** (Test-Kunden-Critique):
*„Starter 49 → 79: 49 wirkt wie Hobby-Tool. 79 ist der DACH-Compliance-
Sweet-Spot (Cookiebot ~110, Iubenda ~280)."* → 49 € ist eine **bereits
verworfene** Option.

**Entscheid:** Bei **79 €** bleiben. `pricing.ts` bleibt Single Source of
Truth und unverändert. Keine Code-Änderung nötig — bestätigt den Status quo.

### K2 — Zielgruppe „Handwerker" vs. reguliertes KMU  · ✅ ENTSCHIEDEN: up-market
Das dokumentierte ICP (`marketing/icp-und-sales-navigator.md`) zielt auf
**regulierte KMU, 5–500 MA** (Kanzlei, Arztpraxis, FinTech, Verwaltung) und
**disqualifiziert Solo-Freelancer / reine Privatpraxen explizit**. Der
„Handwerker"-Frame zog down-market — dorthin, wo der Evidence-Moat **wenig
wert** ist (ein Handwerker braucht eine Datenschutzerklärung, keinen
gerichtsfesten Prüfpfad). Die ganze Architektur (Evidence, AI-Act, DSB) ist
up-market gebaut.

**Entscheid:** **Up-market / reguliertes KMU.** Die *Mechanik* des Memos wird
übernommen (Gratis-Scan als Lead, ein Produkt, Evidence früh als Kaufgrund),
aber die *Zielgruppe* bleibt das dokumentierte regulierte KMU. Dort ist
Compliance existenziell und der Evidence-Trail zahlungswirksam. ICP unverändert.

### K3 — „Zwei Landingpages" vs. „eine Landingpage"  · ✅ ENTSCHIEDEN: eine Seite
`PLAN_100.md` #10 fordert explizit Konsolidierung auf **eine** Landingpage
(Nischen als Segment-Sektionen) statt paralleler Pflege.

**Entscheid:** **Eine Landingpage** mit Segment-Sektionen statt zwei separat
gepflegter Seiten. Dies ist die einzige der drei Entscheidungen mit konkreter
Bau-Aufgabe → nachgezogen als offener Punkt unten.

---

## Offene Bau-Aufgaben aus den Entscheidungen

- [ ] **Landingpage-Konsolidierung** (aus K3): Nischen-Seiten zu *einer* Story
  mit Segment-Sektionen zusammenführen (deckt sich mit `PLAN_100.md` #10).
- [ ] **Evidence-Trail ins erste zahlende Tier** (aus S3): schlanker
  append-only Prüfpfad mit exportierbarem PDF, *nicht* das volle Vault.

---

## Die harte Frage (Nordstern-Erinnerung)

> Hier liegt mehr durchdachte Architektur als Umsatz. Der nächste Schritt ist
> **kein weiteres Konzept** — es ist **ein zahlender Kunde** (vgl. `PLAN_100.md`
> Block 0: 5–10 Piloten). Konkrete Blockade benennen und 5 Outbound-Gespräche
> aus dem dokumentierten ICP führen, bevor weiter gebaut wird.

---

*Erstellt: 2026-06-20 · Gabelungen entschieden: 2026-06-20 · ergänzt `ROADMAP.md` + `docs/PRODUCT_FOCUS.md`*
