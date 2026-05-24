# 90-Tage-Plan — RealSync Agency Pilot

Vier Phasen, 13 Wochen. Jede Phase hat ein Exit-Kriterium. Wenn ein
Exit-Kriterium nicht erreicht ist, wird nicht weitergebaut, sondern korrigiert.

---

## Phase 1 — Wochen 1–2: Pilot-Readiness

**Ziel:** Pilotangebot ist verkaufbar; Demo läuft Ende-zu-Ende auf einer
einzelnen Test-Site.

| # | Output | Owner | Fertig wenn |
|---|---|---|---|
| 1.1 | `realsync-cli` Smoke grün auf 3 OS (Linux/macOS/Windows) | Eng | `verify sample → PASSED`, `verify tampered → FAILED`, `replay` deterministisch |
| 1.2 | Agency-Pilot-One-Pager als PDF + Web-Snippet | GTM | siehe `agency-pilot-one-pager.md`, Stripe-Link aktiv |
| 1.3 | Outreach-Kit: 1 E-Mail, 1 LinkedIn-DM, 1 Follow-up | GTM | siehe `outreach.md` |
| 1.4 | Bestehende `AgenciesLanding.tsx`: Ein Abschnitt „Multi-Website Governance" + CTA „Agency Pilot anfragen" | Eng/Marketing | Kein Hype, kein neuer Page-Bau |
| 1.5 | Stripe-Pilot-Preis angelegt (499 € Setup, 299 € × 3 Monate Variante) | Ops | Test-Charge erfolgreich |
| 1.6 | Pilot-Vertrag (1-Seiter, EU/DSGVO-konform, AVV-Anhang) | Legal | Anwalts-Sign-off |

**Exit-Kriterium Phase 1:** Eine externe Person (nicht Mitgründer) liest
One-Pager + Outreach, versteht das Angebot, kann es weitererzählen.

---

## Phase 2 — Wochen 3–6: Erste Pilotgespräche + MVP-Hardening

**Ziel:** 15–25 qualifizierte Gespräche; 1–2 Piloten in Vorbereitung;
MVP-Workflow läuft auf realen Kunden-Sites stabil.

| # | Output | Fertig wenn |
|---|---|---|
| 2.1 | 50 ICP-Kontakte recherchiert (DSB-Agenturen DACH) | CSV mit Kontaktquelle, kein Scraping |
| 2.2 | 15–25 Erstgespräche geführt | Call-Notizen in einheitlichem Format |
| 2.3 | MVP-Workflow live (siehe `mvp-scope.md`) | Agency legt 5 Sites an → Scan → Findings → Evidence-Bundle → PDF/MD-Report |
| 2.4 | Findings-Priorisierung (Severity × Häufigkeit) | Regel-Tabelle in `services/governance/severity.ts` o.ä. |
| 2.5 | Erste False-Positive-Liste aus echten Scans | Mind. 50 Findings reviewt, FP-Rate < 20 % |

**Exit-Kriterium Phase 2:** Mindestens **1 unterschriebener bezahlter Pilot**
und ein zweiter konkret in Verhandlung.

---

## Phase 3 — Wochen 7–10: Pilotbetrieb + Lernen

**Ziel:** 3 bezahlte Piloten laufen; wöchentliche Re-Scans; Reports werden
tatsächlich vom Pilotkunden gegenüber *seinen* Mandanten genutzt.

| # | Output | Fertig wenn |
|---|---|---|
| 3.1 | 3 bezahlte Piloten aktiv | Stripe-Zahlung eingegangen, Onboarding-Call geführt |
| 3.2 | Wöchentliche Re-Scans automatisch | Cron/n8n Workflow stabil, keine manuellen Reruns |
| 3.3 | Reports an Endmandanten weitergegeben | Pilotkunde bestätigt Versand an mind. 1 Mandant |
| 3.4 | Bug-/UX-Backlog aus echtem Pilot-Feedback | Backlog priorisiert nach „blockiert Pilot" / „nice to have" |
| 3.5 | Replay-/Verification-Demo für Pilotkunden | Pilotkunde kann `realsync-cli verify` lokal auf eigenem Bundle ausführen |

**Exit-Kriterium Phase 3:** ≥ 25 Mandanten-Websites unter Monitoring, jede
Woche frisch gescannt; mindestens 1 Pilot erklärt schriftlich „würde
weiterzahlen".

---

## Phase 4 — Wochen 11–13: Validierung + Folge-Entscheidung

**Ziel:** Pilot-Abschlüsse; harte Daten für Folge-Entscheidung
(Skalierung A vs. Pivot vs. Use Case B/C ergänzen).

| # | Output | Fertig wenn |
|---|---|---|
| 4.1 | 3 Abschluss-Calls geführt | Pro Pilot: was hat funktioniert, was nicht, würde zahlen ja/nein |
| 4.2 | 3 Case Studies (anonymisierbar) | 1 Seite je Pilot: Mandantenanzahl, Findings, Zeitersparnis |
| 4.3 | Pricing-Validierung | Mind. 1 Pilot in Folgeabo überführt oder klares „nein, weil X" dokumentiert |
| 4.4 | Roadmap-Entscheidung | Schriftlicher Entscheid: A vertiefen / B ergänzen / C ergänzen / Pivot |
| 4.5 | Metrik-Review (siehe `metrics.md`) | Alle Zielmetriken erfasst, Ist vs. Soll |

**Exit-Kriterium Phase 4:** Schriftliche, datengestützte Entscheidung zur
nächsten 90-Tage-Phase. Keine Bauchgefühl-Roadmap.

---

## Hartes Anti-Drift

- Keine Phase wird übersprungen, weil „Engineering schneller wäre".
- Kein neues Feature aus `non-goals.md` wandert in den Scope, ohne dass
  ein Pilot es schriftlich verlangt hat.
- Kein zweiter Use Case (B/C) wird vor Woche 11 gestartet.
