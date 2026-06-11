# Metriken — 90 Tage Agency Pilot

Was wir messen — und was wir bewusst *nicht* messen.

## Produkt-Metriken

| Metrik | Wie erhoben | Zielwert 90 Tage |
|---|---|---|
| Anzahl angelegter Mandanten | DB `client` | ≥ 15 |
| Anzahl gescannter Websites | DB `site` (active) | 25–100 |
| Anzahl initialer Scans | DB `scan` (kind = initial, status = done) | ≥ 50 |
| Anzahl wöchentlicher Re-Scans | DB `scan` (kind = recurring) | wachsend, kein Drift |
| Findings gesamt | DB `finding` | ≥ 500 (nur als Volumencheck) |
| Findings nach Severity | Aggregation `finding.severity` | Verteilung verfügbar |
| Zeit von Site-Anlage → erstes Finding | Diff `site.created_at` → erstes `finding.created_at` | < 5 Min p50 |
| Zeit Scan-Start → Scan-Ende | Diff `scan.started_at` → `finished_at` | < 60 s p50 pro Site |
| Zeit vom Scan-Ende → Report-Download | `scan.finished_at` → `report.downloaded_at` | < 24 h p50 |
| False-Positive-Rate (manuell gelabelt) | `finding.review_state = false_positive` | < 20 % bei priorisierten Findings |
| Scan-Stabilität (Fehlerquote) | `scan.status = failed / total` | < 5 % |
| Evidence-Bundle `verify` Success Rate | `realsync-cli verify` Exit-Code 0 | 100 % auf eigenen Bundles |

## Business-Metriken

| Metrik | Quelle | Zielwert 90 Tage |
|---|---|---|
| Outreach-Kontakte | CSV / Notion | 150–250 |
| Erstgespräche geführt | Calendar | 15–25 |
| Qualifizierte Leads | „Pilot-Slot reserviert" | 5–8 |
| Bezahlte Piloten | Stripe Payment Intent: succeeded | **≥ 3** |
| Conversion Outreach → Call | Calls / Kontakte | 5–15 % |
| Conversion Call → Pilot | Piloten / Calls | 15–25 % |
| Conversion Pilot → Folge-Abo | Abo nach Pilot / Pilote | **≥ 33 % (1 von 3)** |
| Durchschnittliche Websites pro Pilotkunde | Sum sites / count tenants | 8–20 |
| Pilot-Cycle-Length | Erstkontakt → Pilotstart | < 21 Tage p50 |

## Qualitative Metriken (Pflicht, nicht Kür)

- Pro Pilot ein **Onboarding-Call-Protokoll** (Pain Points wörtlich)
- Pro Pilot ein **Mid-Pilot-Check** (Tag 7) — Was funktioniert / blockt
- Pro Pilot ein **Abschluss-Protokoll** (Tag 14/Ende)
  - Würden Sie zahlend weitermachen? Ja / Nein / Vielleicht + Grund
  - Was war der eine wichtigste Befund?
  - Was war überraschend?
  - Was hat enttäuscht?

Diese Protokolle landen in `docs/pilot/case-studies/` (anonymisiert,
falls Pilot nicht zur Veröffentlichung freigibt).

## Was wir *nicht* messen (bewusst)

- ARR-Projektionen
- Anzahl Page Views auf Marketing-Site
- Social-Media-Reach
- Twitter-/LinkedIn-Likes
- „Sentiment" oder „Brand-Awareness"
- Anzahl Features im Backlog
- Anzahl Commits / PRs

Diese Metriken lenken in dieser Phase ab und sind nicht entscheidungsrelevant.

## Wöchentliches Review-Format

Jeden Freitag, 30 Min, schriftlich (max. 1 Seite):

```
Woche N — Agency Pilot

Outreach:
- Kontakte: X (kumuliert Y)
- Antworten: X
- Erstgespräche: X (kumuliert Y)

Piloten:
- Aktiv: X
- In Verhandlung: X
- Abgesprungen: X (Grund)

Produkt:
- Sites unter Monitoring: X
- Scans abgeschlossen: X
- Findings: X (FP-Rate Y)
- Top-3 Bug-/UX-Punkte

Was hat blockiert
Was war überraschend
Nächste Woche: 3 Prioritäten
```

## Entscheidungsregeln (Phase 4 Folge-Roadmap)

Bei Review nach Woche 13:

| Ergebnis | Folge-Entscheidung |
|---|---|
| ≥ 3 Piloten + ≥ 1 Folge-Abo + FP-Rate < 20 % | **Skalieren A** — mehr Sales-Kapazität, Whitelabel, Bulk-Import |
| ≥ 3 Piloten aber 0 Folge-Abos | **Pricing/Value-Prop neu** — Kategorie stimmt, Angebot nicht |
| < 3 Piloten trotz ≥ 100 Outreaches | **Use-Case-Pivot prüfen** — Option B oder C als Hypothese testen |
| < 50 Outreaches | **GTM-Problem, nicht Produkt** — Kapazität / Disziplin fixen vor Pivot |
