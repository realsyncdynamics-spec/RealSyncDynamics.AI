# Outreach — RealSync Agency Pilot

Nüchtern, operativ, ohne Hype. Ziel: Erstgespräch, nicht Verkauf in der Mail.

---

## ICP (Ideal Customer Profile)

| Segment | Größenordnung | Schmerz | Erreichbarkeit |
|---|---|---|---|
| **Externe Datenschutzbeauftragte (eDSB)** | 5–50 Mandanten | Repetitive Website-Prüfung pro Mandant | LinkedIn, Fach-Communities (GDD, BvD) |
| **Datenschutz-Agenturen DACH** | 20–200 Mandanten | Manuelle Re-Audits, Dokumentationsaufwand | LinkedIn, Branchenverzeichnisse |
| **Web-Agenturen mit DSGVO-Fokus** | 10–100 Kundenseiten | Beschwerden nach Launch, fehlende Belege | Agentur-Verzeichnisse, Referrals |
| **IT-Security-Beratungen mit DSGVO-Modul** | 5–30 Mandanten | Tracker-/Vendor-Analyse oft ad hoc | LinkedIn, ISACA, BvD |
| **AI-Automation-Agenturen mit Compliance-Bedarf** | 10–50 Kunden | AI-Widget-Integrationen ohne Governance | LinkedIn, AI-Builder-Communities |

**Geografie Pilot:** DACH (DE/AT/CH). Sprache deutsch.

## Quellen für Recherche (manuell, kein Scraping)

- LinkedIn-Suche „Datenschutzbeauftragter", „DSB extern", „Datenschutz-Agentur"
- BvD-Mitgliederverzeichnis (Bundesverband Datenschutzbeauftragte)
- GDD-Mitgliederverzeichnis
- Agentur-Verzeichnisse: agenturmatching.de, sortlist.de
- Empfehlungen aus eigenem Netzwerk (höchste Conversion)

## Outreach 1 — E-Mail (kalt, DSB-Agentur)

**Betreff:** Multi-Website-Audits — 14-Tage-Pilot statt manueller Re-Audits

```
Hallo [Name],

kurze Frage zu Ihrer Arbeit als externer DSB:

Wie viele Mandanten-Websites prüfen Sie aktuell regelmäßig auf
Tracker-, Vendor- und AI-Risiken — und wie viel davon ist manueller
Klick-durch-die-Site?

Wir bauen RealSync, eine Runtime, die genau diese Wiederholungsarbeit
abnimmt: 5–50 Websites kontinuierlich scannen, priorisierte Findings,
exportierbare Evidence Reports für Ihre Mandantenkommunikation.

Wir haben gerade ein 14-Tage-Pilotprogramm aufgesetzt:
- 5 Mandanten-Websites
- wöchentlicher Re-Scan
- Evidence Reports (PDF, kryptographisch verifizierbar)
- Abschluss-Call mit Befundpriorisierung
- 499 € einmalig

Hätten Sie 20 Minuten für ein kurzes Gespräch? Falls das nicht passt:
auch ein „nein, hier ist warum" hilft uns weiter.

Beste Grüße
[Name]
realsyncdynamicsai.de · support@realsyncdynamicsai.de
```

## Outreach 2 — LinkedIn-DM (kürzer)

```
Hallo [Name], kurz und direkt: Wir bauen RealSync, Multi-Website-
Monitoring für DSB-Agenturen — 5 Mandanten-Sites, wöchentliche
Scans, priorisierte Findings, Evidence Reports.

Wir suchen 3 Pilotagenturen für 14 Tage (499 €).
20-Min-Call diese Woche denkbar?
```

## Outreach 3 — Follow-up (nach 5 Werktagen ohne Antwort)

```
Hallo [Name],

falls die erste Mail untergegangen ist: noch ein konkretes Beispiel.

Bei einem Test-Scan auf einer mittelgroßen Mandanten-Website fanden
wir typischerweise:
- 2–4 Pre-Consent-Tracker (oft Google Tag Manager, Meta Pixel)
- 1–3 unbekannte Vendor-Domains (CDNs, Fonts, Ads)
- 0–1 nicht dokumentiertes Chat-/AI-Widget
- 1 fehlender oder veralteter Datenschutz-Link

Das sind die Findings, die in Ihrer manuellen Prüfung Zeit fressen.
RealSync erzeugt sie automatisch, priorisiert und exportierbar.

Falls relevant: gerne 20 Min nächste Woche.
Falls nicht: kein Problem, dann lasse ich Sie in Ruhe.

Beste Grüße
[Name]
```

---

## Nutzenargumente (3 konkrete)

1. **Zeitersparnis pro Mandant:** Wer 30 Mandanten hat und je 2 h
   manuelle Re-Audits/Monat macht, spart bei wöchentlich-automatischem
   Scan messbar Stunden — pro Mandant, jede Woche.
2. **Mandantenkommunikation mit Substanz:** Statt „wir haben geschaut"
   ein versionierter, kryptographisch verifizierbarer Report, der zeigt
   *was wann wo* erkannt wurde.
3. **EU AI Act Vorbereitung:** AI-/Chatbot-Widgets werden inventarisiert
   — ohne dass die Agentur jeden Mandanten einzeln befragen muss.

## Häufige Einwände + Antworten

| Einwand | Antwort |
|---|---|
| „Wir haben schon Tool X (Cookiebot, Usercentrics, OneTrust)" | Diese Tools sind Consent-Manager, kein Multi-Site-Monitoring für Agenturen. Sie laufen *auf* der Site, wir scannen *die* Site — von außen, ohne Installation, mandantenübergreifend. |
| „Was ist mit False Positives?" | Im Pilot reviewen Sie die ersten 50 Findings mit uns. Bekannte FP wandern in eine Whitelist pro Tenant. Wir veröffentlichen FP-Raten — derzeit < 20 % auf Test-Sites. |
| „Wir scannen lieber selbst" | Verstehen wir. Der Pilot ist 14 Tage und 499 € — wenn Sie nach 14 Tagen sagen „lieber selbst", ist das ein klares Signal für uns. Kein Lock-in. |
| „Wir brauchen Whitelabel / eigenes Branding" | MVP unterstützt Agentur-Logo + Name auf Reports. Volles Whitelabel ist Phase 2, sobald 2 Piloten es schriftlich verlangen. |
| „Sind die Daten DSGVO-konform gehostet?" | Hetzner Frankfurt, AVV-Anhang im Pilot inklusive, keine Drittlandtransfers, keine US-CDN. |
| „Was passiert nach dem Pilot mit den Daten?" | Sie entscheiden: Export (JSON-Bundles), Löschung, oder Übernahme in Folge-Abo. Default = Export + Löschung nach 30 Tagen Karenz. |
| „Kein Budget" | 499 € einmalig sind eine Stunde Ihres Mandantenstundensatzes. Wenn das nicht passt, ist der Pilot vermutlich kein Fit — kein Problem. |

## Disqualifikatoren (nicht verfolgen)

- Einzelpersonen ohne mehrere Mandanten
- Agenturen ohne Datenschutz-Mandat (nur SEO/Marketing)
- Unternehmen mit < 3 Websites
- Konzerne mit eigenem IT-Security-Team (Enterprise-Use-Case, später)

---

## Tracking

Pro Outreach-Kontakt in CSV oder Notion festhalten:
- Datum erster Kontakt
- Kanal (Mail / LinkedIn / Empfehlung)
- Antwort: ja-Call / nein-Grund / kein-Response
- Nach Call: Pilot ja/nein, Folge-Termin, Pilot-Variante

Wöchentliches Review: Conversion-Quote pro Kanal, Top-Disqualifikator,
beste Antwort-Rate.
