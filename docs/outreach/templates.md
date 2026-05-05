# Cold-Outreach Templates

Generiert aus den `market_gaps` Tabelleneinträgen via MarketGapScanner v10
(Anthropic Claude Opus 4.7). Ready-to-paste DM/Email-Templates pro Branche.

**Anwendung:** Templates kopieren, `[Name]` und ggf. `[Kanzlei]` / `[Heim]` /
`[Institut]` ersetzen, ggf. eine personalisierte Zeile am Anfang ergänzen
(„Habe gerade Deinen Beitrag zu X gesehen…"), absenden.

**Status nach Versand:** in `/outreach` UI auf `contacted` setzen,
`next_followup_at` = +4 Tage.

---

## 🥇 Legal — FristAssist

**Markt:** ~115.000 Anwälte in DACH-Kanzleien <15 MA · ACV 89-1.150€/M ·
Inhaber = User = Zahler · Sales-Cycle 3-6 Wochen · ARR-Potenzial bei 3%
Marktdurchdringung: **3,7M€**.

**Gap-ID:** `3b616f71-2b58-49e0-b4bf-ecb7ab948964`

### LinkedIn Cold-DM — Variante A (Pain-led)

> Hallo [Name],
>
> kurze Frage aus Neugier: Wie löst Du aktuell die Fristen-Synchronisation
> aus dem beA in Deiner Kanzlei?
>
> Bei vielen 3-15-Anwalt-Kanzleien läuft das noch in Excel + RA-MICRO-Notizen
> — durchschnittlich 4-6 h/Woche pro Anwalt allein für Fristen-Monitoring.
> Eine versäumte Frist = Haftungsfall mit ~25.000 € Schaden.
>
> Wir bauen FristAssist: beA-Eingang per OCR + LLM-Klassifikation,
> automatische Fristberechnung nach ZPO/StPO/VwGO inkl. Bundesland-
> Feiertagslogik, eskalierende Reminder T-14/T-7/T-3/T-1 und gerichtsfester
> Audit-Trail für die Haftpflichtversicherung.
>
> 89 €/Monat, kein Komplettpaket-Lock-in (also kein RA-MICRO-Wechsel nötig).
>
> Wenn Du 15 Min Zeit hast für eine Demo — gerne diese oder nächste Woche.
>
> VG, Dominik

### LinkedIn Cold-DM — Variante B (ROI-led)

> Hallo [Name],
>
> rechne kurz mit: 4 h/Woche pro Anwalt × 50 Wochen × 200 €/h Verrechnungssatz
> = 40.000 € Zeitwert jährlich allein für Fristen-Management. In einer
> 5-Anwalt-Kanzlei = 200.000 €/Jahr.
>
> FristAssist kostet 89 €/Monat = 1.068 €/Jahr und übernimmt: beA-Sync,
> automatische Fristberechnung nach ZPO/StPO/VwGO inkl. Feiertage je
> Bundesland, eskalierende Reminder, Audit-Log.
>
> ROI in der ersten Woche.
>
> 15-Min-Demo? VG, Dominik

### Email — Längere Variante (für Inhaber-Kanzleien per Kontaktformular)

> Betreff: FristAssist — beA-Fristen automatisch berechnen, 89 €/Monat
>
> Sehr geehrte/r Frau/Herr [Name],
>
> die ZPO/StPO/VwGO-Fristlogik ist seit Generationen unverändert — die
> Werkzeuge in vielen 3-15-Anwalt-Kanzleien aber leider auch.
>
> Aktuell läuft Fristen-Monitoring in 80% der DACH-Kanzleien noch über
> Excel-Tabellen oder die uralten Notiz-Funktionen in RA-MICRO/AnNoText.
> Pro Anwalt 4-6 h/Woche. Pro versäumte Frist Ø 25.000 € Haftungsschaden.
>
> **Was FristAssist macht:**
>
> 1. Synchronisiert sich per beA-Schnittstelle in Ihren Posteingang
> 2. Klassifiziert eingehende Schriftsätze per OCR + LLM (Klage, Berufung,
>    Urteil, Beschluss)
> 3. Berechnet automatisch Notfristen / Berufungsfristen / Erinnerungsfristen
>    nach ZPO/StPO/VwGO inkl. Feiertagslogik je Bundesland
> 4. Sendet eskalierende Reminder per Email + Outlook/Google-Kalender
>    (T-14 / T-7 / T-3 / T-1)
> 5. Erstellt gerichtsverwertbaren Audit-Trail für Ihre Haftpflicht
>
> **Was FristAssist NICHT macht:** Kein Komplettsystem, kein
> RA-MICRO-Wechsel, keine Akten-Verwaltung. Nur Fristen.
>
> 89 €/Monat ohne Mindestlaufzeit. ROI nach der ersten verhinderten
> versäumten Frist.
>
> Wenn das relevant klingt, würde ich Ihnen das gerne in 15 Minuten zeigen —
> hätten Sie diese oder nächste Woche kurz Zeit?
>
> Beste Grüße,
> Dominik Seed
> RealSync Dynamics
> realsyncdynamics-spec.github.io/RealSyncDynamics.AI/

### LinkedIn-Search-URLs für Targeting

| Suche | URL |
|---|---|
| Anwalts-Inhaber DACH, 100-500 Connections | `https://www.linkedin.com/search/results/people/?keywords=%22Inhaber%22%20Rechtsanwalt&geoUrn=%5B%22101282230%22%5D` |
| Bucerius Legal Tech Alumni | `https://www.linkedin.com/search/results/people/?keywords=Bucerius%20Legal%20Tech` |
| Ex-RA-MICRO / Ex-AnNoText | `https://www.linkedin.com/search/results/people/?keywords=%22RA-MICRO%22%20OR%20%22AnNoText%22` |
| Wolters-Kluwer / STP DACH | `https://www.linkedin.com/search/results/people/?keywords=%22Wolters%20Kluwer%22%20OR%20%22STP%22%20Rechtsanwalt` |
| Familie-/Arbeitsrecht-Anwälte (sensible Mandate, Compliance-Awareness) | `https://www.linkedin.com/search/results/people/?keywords=Familienrecht%20Inhaber%20Anwalt` |

---

## 🥈 HealthTech — PeBeM-Compliance-Cockpit

**Markt:** ~8.500 Pflegeheime DE (50-200 Betten) · ACV 1.788 €/Jahr ·
PDL = User, GF = Zahler · Sales-Cycle 4-8 Wochen · ARR bei 5%
Marktdurchdringung: **760 k€**, bei 15%: **2,3M€**.

**Gap-ID:** `5ec6078f-b2a0-4a62-8178-73177267c5df`

### LinkedIn Cold-DM (an PDL)

> Hallo [Name],
>
> wie viele Stunden investierst Du aktuell pro Monat in den
> PeBeM-Soll-Ist-Abgleich nach §113c SGB XI? Bei 80% der Pflegeheime
> 50-200 Betten läuft das noch in Excel — 8-15 h/Monat allein für Dich.
>
> Wir bauen ein PeBeM-Compliance-Cockpit als **Layer obendrauf** auf eure
> bestehende Dienstplan-Software (Vivendi/SNAP/Connext bleibt):
>
> - CSV/Excel-Import des Dienstplans + Bewohnerliste
> - Auto-Abgleich gegen PeBeM-Soll-Werte je Qualifikationsstufe (QN1-QN3)
> - Monatlicher prüfsicherer PDF-Report für Pflegekasse + MDK
> - Frühwarn-Dashboard bei Unterbesetzung
>
> 149 €/Monat, kein Lock-in. Wenn Dein GF auch Sorgen wegen
> MDK-Beanstandungen hat — gerne 15 Min Demo.
>
> VG, Dominik

### LinkedIn-Search-URLs

| Suche | URL |
|---|---|
| Pflegedienstleitung 50-200 Betten | `https://www.linkedin.com/search/results/people/?keywords=Pflegedienstleitung%20Pflegeheim` |
| QM-Beauftragte Pflege | `https://www.linkedin.com/search/results/people/?keywords=%22QMB%22%20OR%20%22Qualit%C3%A4tsmanagement%22%20Pflege` |
| Ex-Vivendi / Ex-Connext / Ex-MEDIFOX (Vertriebsnetz) | `https://www.linkedin.com/search/results/people/?keywords=%22Vivendi%22%20OR%20%22Connext%22%20OR%20%22MEDIFOX%22%20Pflege` |
| BPA Bundesverband privater Anbieter | `mail@bpa.de` (Verband direkt anschreiben) |

---

## 🥉 FinTech — DORA & MaRisk Reporting Cockpit

**Markt:** ~450 BaFin-lizenzierte Fintechs DACH · ACV 9.600-30.000 €/Jahr ·
Sales-Cycle **3-6 Monate**, Multi-Stakeholder · ARR-SAM: **8-12 M€**.

**Gap-ID:** `bde634a8-b180-402b-9cbb-885c43474314`

⚠️ **Diesen Track NICHT solo verfolgen** ohne MaRisk-Compliance-Co-Founder.
Käufer sind Domain-Experten. Hier nur als Asset für später.

### LinkedIn Cold-DM (Compliance-Officer, vorsichtige Variante)

> Hallo [Name],
>
> kurze Frage zur DORA-Implementation in Eurer Compliance-Praxis: Wie löst Ihr
> aktuell das Auslagerungsregister nach §25b KWG + Kritikalitäts-Scoring nach
> DORA Art. 28? Wir hören von vielen lizenzierten Fintechs ~40-80 PT pro
> Quartalsmeldung in Excel.
>
> Wir bauen ein DORA & MaRisk Reporting Cockpit (kein OneTrust/Regnology-
> Niveau-Preis) — Pre-built-Connectoren zu Jira/AWS/Vendor-DBs, automatisches
> IKT-Vorfalls-Klassifikations + 4 h/24 h/1 m-Meldetimer, Export im
> MVP-Portal-XBRL-Format.
>
> Eher als Validierungs-Gespräch als Sales: hätten Sie 30 Minuten? Wir suchen
> 3 Pilot-Fintechs Q3 2026.
>
> VG, Dominik Seed

---

## Workflow

1. **Tag 0:** 5 Profile pro Branche aus den Search-URLs picken → in `/outreach`
   anlegen mit Status `new` + Template-Variante in den Notes
2. **Tag 0:** DMs versenden → Status auf `contacted`, `next_followup_at` = +4
3. **Tag +4:** Falls keine Reply: höflicher Bump (1 Satz: „Hey [Name], hast Du
   noch Zeit für die kurze Demo?")
4. **Tag +7:** Letzter Bump oder `lost` markieren
5. **Reply rein:** Status auf `replied`, in 1-2 Sätzen Demo-Termin vereinbaren

## Tracking (was du nach 1 Woche brauchst)

| Branche | DMs versendet | Antworten | Demos gebucht |
|---|---|---|---|
| Legal | _/15 | _/15 | _ |
| HealthTech | _/15 | _/15 | _ |
| FinTech | _/5 (vorsichtig) | _/5 | _ |

Wenn nach 15 DMs in einer Branche **0 Antworten** → Messaging-Bug, nicht
Markt-Bug. Hook ändern.
Wenn **3+ Antworten** → Demos buchen, GitHub Pages URL teilen.

---

*Generiert: 2026-05-05 · Quelle: `market_gaps` Tabelle, IDs in den Gap-Boxen
oben referenziert. Iterierbar — füge bessere Hooks hinzu wenn welche
funktionieren.*
