# RealSyncDynamics.AI — Zielbild der fertigen Plattform

**Stand:** 2026-10-24 · **Owner:** Dominik Steiner
**Status:** verbindlicher Maßstab. Module, Arbeitspakete (WP-x, O-WP-x, AP-x), PRs und Freigaben werden an diesem Zielbild gemessen.
**Bezug:** `PLAN.md` (Funnel), `OKTOBER-2026.md` (Build Studio). Dieses Dokument ersetzt keinen der beiden Pläne. Es legt fest, wohin sie führen.

> Leitsatz: RealSyncDynamics.AI hilft Unternehmen, künstliche Intelligenz sicher einzusetzen, digitale Risiken zu erkennen, Probleme zu beheben, Geschäftsprozesse zu automatisieren und die getroffenen Maßnahmen nachvollziehbar nachzuweisen – alles auf einer Plattform.

Grenze, die überall gilt: Die Plattform **unterstützt, prüft und dokumentiert** Compliance. Sie garantiert **keine** vollständige Rechtssicherheit und keine automatische Gesetzeskonformität. (Siehe verbotene Claims in `PLAN.md` §5.)

---

## 1. Was wir bauen

Ein europäisches KI-Betriebssystem für Unternehmen. Es prüft digitale Systeme, erkennt Risiken, setzt Maßnahmen um, kontrolliert KI-Agenten und dokumentiert die Einhaltung von Vorgaben nachvollziehbar.

- Der Nutzer braucht möglichst wenig technisches Vorwissen: Er beschreibt seinen Betrieb, verbindet Website und Anwendungen und wird Schritt für Schritt durch die Einrichtung geführt.
- Die Plattform erklärt nicht nur, was falsch läuft. Sie hilft, es zu beheben.
- RealSyncDynamics.AI ersetzt keine bestehende Unternehmenssoftware. Sie ist die **Kontrollschicht darüber**.

**Kundenprozess:** Prüfen → Verstehen → Handeln → Nachweisen → danach kontinuierlich überwachen, verbessern, dokumentieren.

---

## 2. Was ein Kunde am Ende damit machen kann

| # | Fähigkeit | Inhalt |
|---|---|---|
| 1 | Website kostenlos prüfen | Domain eingeben → verständlicher Bericht zu Cookies, Tracking, Datenschutz, technischen Risiken, Barrierefreiheit, erkennbaren KI-Einbindungen. Konkrete Empfehlungen, späterer Vergleich möglich. |
| 2 | Unternehmen einrichten | Geführtes Onboarding: Branche, Mitarbeiterzahl, Standorte, Ansprechpartner, KI-Anwendungen, Datenverarbeitungen → persönlicher Governance-Workspace mit passenden Regeln und Aufgaben. |
| 3 | Systeme verbinden | Websites, APIs, GitHub, CRM, ERP, Kommunikationskanäle, KI-Anbieter – schrittweise angebunden. |
| 4 | Rahmenwerke verwalten | KI-Systeme klassifizieren, Risiken bewerten, Verantwortliche bestimmen, Policy Packs aktivieren: DSGVO, EU AI Act; perspektivisch ISO 27001, NIS2, DORA, TISAX – soweit anwendbar. |
| 5 | KI-Agenten und Bots betreiben | Website-Chatbots, WhatsApp-Assistenten, Telefonbots, interne Agenten – mit Berechtigungen, Übergabe an Menschen, kontrollierter Datenverarbeitung. |
| 6 | KI-Aktionen kontrollieren | Die Governance Runtime bewertet Aktionen nach Regeln: protokollieren, warnen, menschliche Freigabe verlangen oder angebundene Vorgänge blockieren. Kritische Entscheidungen trifft kein Agent unkontrolliert. |
| 7 | Probleme mit KI beheben | Aus Befunden entstehen Aufgaben, Änderungsvorschläge, Code-Fixes, Tickets oder PRs. Ein Implementierungs-Agent entwickelt; unabhängige Prüfung und menschliches Go sichern die Ausführung. |
| 8 | Nachweise sammeln und exportieren | Evidence Vault: Prüfungen, Entscheidungen, Freigaben, Änderungen mit Zeitstempel und Integritätsnachweis → Berichte für interne Kontrolle, Kunden, Auditoren, Aufsicht. |
| 9 | Kontinuierlich überwachen | Wiederkehrende Scans, Risikobewertung, Benachrichtigung, Eskalation: neue Tracker, geänderte KI-Modelle, problematische Datenübertragungen, abweichende Berechtigungen. |
| 10 | Websites neu erstellen | DSGVO Web App Builder: Domain analysieren, Inhalte übernehmen, moderne Website neu entwickeln – mit Qualitätsprüfung und Anbindung ans Governance-System. |

---

## 3. Command Center (Zielansicht)

Ein zentrales Dashboard statt zehn Tools. Zielkacheln: Governance-Reifegrad, offene Risiken, aktive KI-Systeme, ausstehende Freigaben, Compliance-Status je Rahmenwerk, aktuelle Maßnahmen mit Priorität und Status.

**Regel:** In Produktion nur echte Werte aus echten Quellen. Fehlt eine Quelle → Empty State oder `Preview`-Label (keine Fake-KPIs, `PLAN.md` §5). Beispielzahlen nur in klar markierten Konzeptdemos.

---

## 4. Referenz-Szenario: Handwerksbetrieb

1. Geschäftsführer gibt `meine-firma.de` ein und startet den kostenlosen Website-Check.
2. Die Plattform erkennt mögliche Datenschutzprobleme und erklärt sie verständlich.
3. Er richtet den Workspace ein und beantwortet wenige Fragen zu Mitarbeitern, Kundendaten und KI-Systemen.
4. Er erstellt einen KI-Telefonassistenten, der Anrufe annimmt und Terminwünsche erfasst.
5. Die Governance Runtime kontrolliert, welche Daten der Assistent nutzen und an welche Dienste er sie übermitteln darf.
6. Die Plattform dokumentiert relevante Aktionen und schlägt bei Problemen Korrekturen vor.
7. Er sieht offene Aufgaben und exportiert einen Nachweisbericht.

Ergebnis: nützliche KI-Funktionen für den Betrieb; Risiken, Berechtigungen und Nachweispflichten zentral verwaltet – ohne Datenschutzexperte oder Programmierer zu sein. Dieses Szenario ist der E2E-Abnahmetest für das Gesamtprodukt.

---

## 5. Produktwelten

| Welt | Umfang |
|---|---|
| **Governance OS** | Datenschutz, KI-Risikomanagement, Kontrollen, Freigaben, Nachweise |
| **AI Automation OS** | KI-Agenten, Kundenkommunikation, Telefonbots, Workflows, kontrollierte Automatisierung |
| **AI Development OS** | Website-Erstellung, Codeanalyse, Optimierung, geprüfte technische Umsetzung |

Kernbausteine: Risk Engine · Policy Engine · AI Agents · Evidence Vault · Automation · Audit Center.
Wettbewerbsvorteil: nicht die Menge an KI-Tools, sondern dass **alle über dieselbe vertrauenswürdige Governance-Ebene** laufen (Authority-Pfad `PLAN.md` §2).

---

## 6. Ist-Stand (öffentliche Website, 2026-10-24)

| Bereich | Öffentlich erkennbarer Stand |
|---|---|
| Landingpage und Governance-Check | vorhanden |
| Command Center | mit Demo-Daten dargestellt |
| Policy Engine und Runtime API | dokumentiert |
| Evidence Vault | als Produktfunktion beschrieben |
| Monitoring | teilweise als Preview ausgewiesen |
| n8n-Automatisierung | Preview, keine produktive Ausführung ausgewiesen |
| Vollständige automatische Fehlerbehebung | weiterer Ausbauschritt |
| Vollautomatische Unternehmens-Governance | langfristiges Gesamtziel |

Dokumentation und Produktbeschreibungen zeigen die Ausrichtung, belegen aber noch keinen vollständig produktiven End-to-End-Betrieb. Status-Vokabular in Produkt und Website ausschließlich aus `src/product/implementation-status.ts` (`live` · `preview` · `coming-soon`).

---

## 7. Priorisierung (verbindlich)

| Phase | Ziel | Fähigkeiten (§2) | Abnahme |
|---|---|---|---|
| **1** | Kostenloser Scan → Onboarding → funktionierendes Kundendashboard, durchgängig | 1, 2, Command Center mit echten Daten | Referenz-Szenario Schritte 1–3 und 7 (Aufgaben sehen) ohne Bruch, ohne Demo-Daten |
| **2** | Kontinuierliche Kontrollen und Nachweise | 4, 6, 8, 9 | Jede Freigabe hat einen Evidence-Eintrag; Nachweisbericht exportierbar; wiederkehrender Scan meldet Änderungen |
| **3** | Agenten, Bots, automatische Fehlerbehebung, Website Builder | 3, 5, 7, 10 | Referenz-Szenario vollständig (Schritte 4–6) |

**Regel für neue Arbeit:** Ein PR oder Arbeitspaket nennt die Phase und die Fähigkeit (§2), der es dient. Phase-3-Arbeit startet erst, wenn Phase 1 abgenommen ist – Ausnahmen nur Security-, Recht- und Triage-PRs (wie WIP-Stopp in `OKTOBER-2026.md` §3).

**Claims:** Rahmenwerke ohne gebautes Policy Pack (aktuell ISO 27001, NIS2, DORA, TISAX) erscheinen in Produkt und Website nur als `coming-soon` oder `preview`.

🦞
