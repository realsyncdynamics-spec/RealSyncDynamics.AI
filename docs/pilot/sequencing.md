# Reihenfolge der Umsetzung — 13 Wochen

Eine Liste, eine Zeitachse, ein Pfad. Reihenfolge ist bindend.
Bei Verzug wird *Scope reduziert*, nicht „weitergehen ohne Fundament".

## Visueller Pfad

```
Woche  1   2   3   4   5   6   7   8   9   10  11  12  13
       │   │   │   │   │   │   │   │   │   │   │   │   │
P0  ───┴───┘                                            │
       Pilot-Readiness                                  │
                                                        │
P1          ┌───┴───┴───┴───┘                           │
            MVP-Workflow                                │
                                                        │
P2                          ┌───┴───┴───┴───┘           │
                            Pilotbetrieb                │
                                                        │
P3                                          ┌───┴───┴───┘
                                            Validierung
                                            + Folge-Entscheidung
```

## Reihenfolge in Sätzen

1. **Woche 1–2:** CLI grün, One-Pager fertig, Stripe-Preis live, Vertrag
   anwaltlich freigegeben, Landing-Section ergänzt. Erste 50 ICP-Kontakte
   recherchiert. **Verkauf beginnt sofort, parallel zu Engineering.**

2. **Woche 3–4:** Outreach läuft (15+ Kontakte/Woche). Engineering baut
   Datenmodell + Agency-Dashboard. Erste Demos auf Test-Sites.

3. **Woche 5–6:** Scan-Scheduler stabil. Findings-Priorisierung. Report-
   Renderer fertig. Erste Pilot-Verhandlungen. **Ziel: 1 Pilot
   unterschrieben, 1–2 in Verhandlung.**

4. **Woche 7–8:** Pilot 1 läuft. Onboarding-Doku entsteht aus echtem
   Pilot. False-Positive-Review-UI. Pilot 2 startet.

5. **Woche 9–10:** Pilot 3 startet. Wöchentliche Re-Scans laufen
   autonom. Findings-Diff im Dashboard. Replay-Demo mit Pilotkunde
   durchgespielt.

6. **Woche 11–12:** Pilot-Abschluss-Calls. Case-Study-Drafts. Pricing-
   Telemetrie. Erstes Folge-Abo-Gespräch.

7. **Woche 13:** Metrik-Review. Schriftliche Entscheidung zur
   Folge-Phase (siehe `metrics.md` Entscheidungsregeln). Roadmap-Update
   im Repo committen.

## Was passiert, wenn ein Meilenstein verfehlt wird?

| Verfehlt | Reaktion (keine Eskalation, harte Regel) |
|---|---|
| P0 nicht in Woche 2 fertig | Outreach trotzdem starten mit *manuellem* Pilot-Setup; Eng schließt P0 in Woche 3 ab |
| < 5 Outreach-Calls in Wochen 3–4 | GTM-Block, **Engineering reduziert auf P1.1–P1.3**, Rest pausiert bis Calls anziehen |
| 0 Piloten bis Woche 6 | Pricing prüfen (Option A → Option B/C anbieten?), Outreach-Text iterieren, NICHT mehr Features |
| < 3 Piloten bis Woche 10 | Frühzeitiger Pivot-Check; Phase 4 vorziehen, ehrliche Analyse |
| FP-Rate > 30 % in Pilot | Detection-Pass priorisieren über alles andere; ggf. Pilot pausieren |

## Wer macht was

| Rolle | Verantwortung |
|---|---|
| **Eng** | P0.1, P0.5, P1.* (alle), P2.2–P2.5, P3.2–P3.3 |
| **GTM** | Outreach (täglich), Pilot-Calls, Case-Study-Interviews |
| **Ops** | Stripe (P0.3), Pilot-Onboarding-Kalender, Vertrag verschicken |
| **Legal** | P0.4, AVV-Anhang, Anwalts-Kontakt |
| **Founder/Product** | Wöchentliches Review-Protokoll, Entscheidung in Phase 4 |

Wenn Rollen in einer Person liegen: Zeit-Budgeting (max 50 % Eng /
Woche, mindestens 30 % GTM während Wochen 3–10).

## Anti-Patterns, die diese Reihenfolge bricht

- „Lass uns noch X bauen, bevor wir verkaufen." → Nein. Verkauf läuft
  ab Woche 1, auch wenn manuell.
- „Wenn wir nur noch Y hätten, käme der Pilot." → Wenn Y nicht in den
  bestehenden Tasks ist, ist es vermutlich nicht der Engpass.
- „Use Case B sieht auch interessant aus." → Erst nach Woche 11
  überlegen, dokumentiert in Phase 4.
- „Lass uns die Marketing-Site überarbeiten." → Steht in `non-goals.md`.
  Nicht in dieser Phase.

## Eine Frage pro Woche

Im Freitag-Review eine Frage schriftlich beantworten:

> Welche Aktion in den nächsten 7 Tagen bringt einen Pilotkunden näher
> an die Unterschrift — und welche nicht?

Alles, was die Antwort *nicht* ist, wird verschoben oder gestrichen.
