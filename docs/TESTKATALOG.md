# Testkatalog – RealSyncDynamics.AI

> **Basis-URL:** `https://realsyncdynamicsai.de`  
> **Stand:** Juni 2026  
> **Scope:** Öffentliche Routen, Navigation, DSGVO, EU-AI-Act, Checkout, Consent

---

## FE – Frontend / Öffentliche Routen

| ID | Route | Erwartung | Priorität |
|---|---|---|---|
| FE-001 | `/` | Startseite lädt ohne Fehler, kein JS-Error in Console | 🔴 Kritisch |
| FE-002 | `/` | Primäre CTAs vorhanden, Navigation funktioniert | 🔴 Kritisch |
| FE-003 | `/audit` | Seite lädt, Domain-Eingabefeld sichtbar | 🔴 Kritisch |
| FE-004 | `/ai-act/` | Seite lädt, Usecase-Einstieg vorhanden | 🔴 Kritisch |
| FE-005 | `/oeffentliche-verwaltung/` | Seite lädt korrekt | 🟡 Hoch |
| FE-006 | `/healthtech` | Seite lädt korrekt | 🟡 Hoch |
| FE-007 | `/saas-anbieter/` | Seite lädt korrekt | 🟡 Hoch |
| FE-008 | `/checkout/starter/` | Seite lädt, Login/Checkout-Einstieg sichtbar | 🔴 Kritisch |

---

## CO – Checkout

| ID | Szenario | Erwartung | Priorität |
|---|---|---|---|
| CO-001 | `/checkout/starter/` lädt | Klare CTA, kein Fehler | 🔴 Kritisch |
| CO-002 | Stripe-Integration | Nur Testmodus, keine echten Zahlungen | 🔴 Kritisch |
| CO-003 | Ohne Stripe-Testkeys | Test wird sauber übersprungen (`test.skip`) | 🟡 Hoch |
| CO-004 | Checkout-Abschluss | **MANUELL** – nicht blind automatisieren | ⚪ Manuell |

---

## SEC – Security / Consent

| ID | Szenario | Erwartung | Priorität |
|---|---|---|---|
| SEC-001 | Tracker vor Consent | Keine nicht-notwendigen Tracker feuern vor Consent | 🔴 Kritisch |
| SEC-002 | Consent-Banner | Banner erscheint beim ersten Besuch | 🟡 Hoch |
| SEC-003 | Consent ablehnen | Nach Ablehnung: nur notwendige Cookies gesetzt | 🟡 Hoch |
| SEC-004 | Consent annehmen | Nach Annahme: Analytics-Events korrekt | 🟡 Hoch |

---

## GOV – Governance / Audit / AI-Act

| ID | Szenario | Erwartung | Priorität |
|---|---|---|---|
| GOV-001 | `/audit` lädt | Domain-Eingabe vorhanden, Scan erreichbar | 🔴 Kritisch |
| GOV-002 | Audit-Scan starten | Eingabe einer Test-Domain löst Scan-Flow aus | 🟡 Hoch |
| GOV-003 | Audit-Ergebnis | Report-Bereich wird nach Scan sichtbar | 🟡 Hoch |
| GOV-004 | `/ai-act/` lädt | Usecase-/Risikoklassifizierungslogik oder Einstieg | 🔴 Kritisch |
| GOV-005 | AI-Act Usecase-Auswahl | Mindestens 1 Usecase auswählbar | 🟡 Hoch |

---

## MAIL – Mail-Trigger

| ID | Szenario | Erwartung | Priorität |
|---|---|---|---|
| MAIL-001 | Kontaktformular | **MANUELL** – nur mit Mail-Capture-Umgebung | ⚪ Manuell |
| MAIL-002 | Checkout-Bestätigung | **MANUELL** – erfordert Stripe-Test + SMTP-Capture | ⚪ Manuell |
| MAIL-003 | Audit-Report per Mail | **MANUELL** – erfordert `TEST_EMAIL` + Capture | ⚪ Manuell |

---

## LEGAL – Impressum / Datenschutz

| ID | Route | Erwartung | Priorität |
|---|---|---|---|
| LEGAL-001 | `/impressum` | Seite lädt, Pflichtangaben vorhanden | 🟡 Hoch |
| LEGAL-002 | `/datenschutz` | Seite lädt, DSGVO-Angaben vorhanden | 🟡 Hoch |
| LEGAL-003 | `/agb` | Seite lädt (falls vorhanden) | 🟢 Normal |

---

## Legende

- 🔴 **Kritisch** – Muss in CI immer grün sein
- 🟡 **Hoch** – Soll in CI laufen, Fehler erzeugen Warning
- 🟢 **Normal** – Nice-to-have
- ⚪ **Manuell** – Nicht automatisiert, erfordert Testumgebung
