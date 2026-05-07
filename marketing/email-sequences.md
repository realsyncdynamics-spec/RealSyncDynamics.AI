# E-Mail-Sequenzen — Free → Professional Conversion

**Ziel:** Free-Tool-User in 14 Tagen zu Professional-Subscribern konvertieren.
**Erwarteter Lift:** +25% Free→Paid-Conversion (Branchen-Benchmark B2B SaaS).
**Tool-Empfehlung:** Postmark / Resend für Transactional, Customer.io oder Loops für Sequenzen.

---

## Sequenz-Übersicht

| # | Sequenz | Trigger | Mails | Ziel |
|---|---|---|---|---|
| **A** | Welcome (Free-Tool-User) | `audit_completed` | 7 Mails / 14 Tage | Pro Sign-up |
| **B** | Onboarding (Pro-Trial) | `trial_started` | 5 Mails / 14 Tage | Activation + Retention |
| **C** | Win-Back (Trial-Bouncer) | Trial-Ende ohne Conversion | 3 Mails / 21 Tage | Re-Activation |
| **D** | Cart-Abandonment | Stripe Checkout abandoned | 2 Mails / 24h | Conversion |
| **E** | Newsletter (Edu) | Opt-in via Free-Tool | 1×/Woche | Nurturing |

---

## Sequenz A — Welcome (Free-Tool-User)

**Trigger:** Audit-Tool wurde durchlaufen. E-Mail im PDF-Download-Schritt eingesammelt.
**DSGVO:** Double-Opt-in via Bestätigungs-Mail. Marketing-Consent separat.

### Mail A1 — „Dein DSGVO-Report" (Tag 0, sofort)

**Betreff:** Dein DSGVO-Score: {{score}}/100 — PDF anbei
**Pre-Header:** {{findings}} Findings. Top-Priorität: {{top_finding_short}}

```
Hallo {{first_name}},

danke fürs Scannen — hier ist dein Report:

  DSGVO-Score:  {{score}}/100
  Findings:     {{findings_count}} (davon {{high_severity}} kritisch)

PDF-Report: {{pdf_url}} (gültig 30 Tage)

Die wichtigsten 3 Findings im Überblick:

  1. {{finding_1.title}} — {{finding_1.paragraph}}
     {{finding_1.bafin_or_lfdi_reference}}

  2. {{finding_2.title}} — {{finding_2.paragraph}}

  3. {{finding_3.title}} — {{finding_3.paragraph}}

Jedes Finding kommt mit Paragraph-Referenz, Risiko-Klasse und konkreter
Handlungsempfehlung — nutzbar für DSB-Reports oder interne Audits.

→ Bei Fragen einfach auf diese Mail antworten.

Beste Grüße
{{founder_name}}
RealSyncDynamics.AI

—
P.S.: Die kostenlose Version deckt 8 Tools ab. Ab €149/Monat bekommst du
Continuous Monitoring + AVV/VVT/TOM-Generator + AI-Act-Klassifikator.
{{pro_link}}
```

**Send-Zeit:** Sofort (Trigger-basiert)
**KPI:** Open-Rate Ziel >55%, CTR PDF >65%

---

### Mail A2 — „Was Score {{score}} wirklich bedeutet" (Tag 1, +24h)

**Betreff:** Score {{score}}: ist das gut oder gefährlich?

```
{{first_name}},

dein Score liegt bei {{score}}/100. Zur Einordnung:

  90–100  Audit-ready. Du kannst BfDI/LfDI-Anfragen entspannt beantworten.
  70–89   Solide Basis, aber kritische Lücken bei {{score_gap_area}}.
  50–69   Risiko-Zone. Erste DSGVO-Beschwerde kostet ~€10–50k.
  <50     Akut handeln. Bußgeld-Wahrscheinlichkeit hoch.

Was deinen Score auf 95+ bringt:

  ✓ Continuous Monitoring (24/7 statt einmalig)
  ✓ Automatisiertes VVT/AVV bei jeder Tool-Änderung
  ✓ Pre-emptive Alerts vor Bußgeld-Trigger

Dafür haben wir den Professional-Plan gebaut — €149/Monat pro System.

→ 14 Tage testen ohne Risiko: {{trial_link}}

Beste Grüße
{{founder_name}}

—
Wenn du nur einen Single-Audit brauchst: kein Problem, der Free Tier
bleibt unbeschränkt nutzbar. Diese Mail ignorierst du dann einfach.
```

**Send-Zeit:** Tag 1, 09:30 Empfänger-TZ
**KPI:** CTR Trial >8%

---

### Mail A3 — Case Study (Tag 3)

**Betreff:** Wie [Fintech XY] €38k Bußgeld vermieden hat

```
{{first_name}},

kurze Story aus letzter Woche:

Ein Fintech-Kunde (ich darf den Namen nicht nennen — BaFin-Sensibilität)
hat unseren Continuous Monitor angeschmissen.

Tag 4: Alert.

Ein internes Team hatte Google Maps für eine Kundenkarte eingebaut —
ohne Consent-Update. Genau das, was das LG München als €100/User-Schaden
bewertet hat.

Behoben in 2 Stunden statt nach Beschwerde-Welle.

Ohne Continuous Monitor wäre das erst beim nächsten manuellen Audit
aufgefallen — 3 Monate später. Geschätzter Schaden bei 380 Visitors
auf der Seite: €38.000.

Professional kostet €149/Monat. Pro System.

→ Trial starten: {{trial_link}}

—
{{founder_name}}
```

**Send-Zeit:** Tag 3, 10:00
**KPI:** CTR Trial >5%

---

### Mail A4 — EU AI Act Awareness (Tag 5)

**Betreff:** Nutzt dein Unternehmen ChatGPT/Claude/eigene KI?

```
{{first_name}},

Frage zwischendurch:

Setzt ihr KI ein für …
  • Recruiting-Screening?
  • Kreditscoring?
  • Kundensegmentierung?
  • Medizin-Diagnose?

Falls ja: ab Februar 2025 brauchst du eine Risiko-Klassifizierung
nach EU AI Act. Nachweis-Pflicht.

Strafrahmen: bis zu €35 Mio oder 7% Jahresumsatz.

Im Professional-Plan inklusive:

  ✓ Automatischer AI-Act-Klassifikator
  ✓ Konformitätsbewertung dokumentiert
  ✓ Integration mit deiner DSGVO-Struktur (kein Doppel-Doku)

→ AI-Act-Check kostenlos starten: {{ai_act_free_link}}
→ Professional testen: {{trial_link}}

—
{{founder_name}}
```

**Send-Zeit:** Tag 5, 09:00 (Mi optimal für B2B)

---

### Mail A5 — Social Proof + Logos (Tag 7)

**Betreff:** {{customer_count}} regulierte Unternehmen scannen mit uns

```
{{first_name}},

Status nach einer Woche RealSyncDynamics.AI:

  • {{customer_count}} aktive Unternehmen
  • {{audits_count}} durchgeführte Audits
  • Branchen: Fintech, E-Commerce, Healthcare, SaaS, Versicherungen
  • {{external_dpos}} externe Datenschutzbeauftragte

Was Kunden sagen:

  „Wir haben unsere Doku-Zeit von 40h auf 8h pro Monat reduziert."
  — {{testimonial_1_name}}, DSB Fintech

  „Endlich eine Plattform, die VVT, AVV UND AI-Act zusammenbringt."
  — {{testimonial_2_name}}, CTO E-Commerce

→ Trial-Plan: {{trial_link}} (14 Tage, kein Risiko)
→ Enterprise für DSB-Kanzleien: {{enterprise_link}}

—
{{founder_name}}

P.S.: Wenn ihr Mandanten betreut: Im Enterprise-Plan habt ihr
unbegrenzte Systeme. ROI-Beispiel im Anhang.
```

**Send-Zeit:** Tag 7, 09:00

---

### Mail A6 — Letzter-Push „Was hält dich ab?" (Tag 11)

**Betreff:** Eine Frage — und du gehst zurück zur Arbeit

```
{{first_name}},

direkt gefragt: was hält dich vom Professional-Plan ab?

  □ Zu teuer
  □ Funktion fehlt
  □ Schon andere Lösung
  □ Zeitlich grad nicht prio
  □ Brauche internes Buy-in

Antworte einfach mit der Zahl/dem Buchstaben — ich melde mich persönlich
binnen 24h.

Falls du unter „intern abstimmen" steckst: hier ist eine 1-Pager-Vorlage
mit ROI-Math, die ich an euer Management durchreichen kannst:

  → {{onepager_pdf}}

—
{{founder_name}}
direkter Kontakt: {{founder_calendly_link}}
```

**Send-Zeit:** Tag 11, 14:00 (post-Lunch)
**KPI:** Reply-Rate >3% (qualitative Insights wertvoller als CTR)

---

### Mail A7 — Sequenz-Ende „Bleib in Kontakt" (Tag 14)

**Betreff:** Letzte Mail dieser Reihe

```
{{first_name}},

das war's für die Welcome-Sequenz. Ich höre auf zu nerven.

Falls du den Free Tier weiter nutzt: super, jeder Audit hilft uns,
das Tool zu verbessern.

Falls du dich später für Professional interessierst — der Link
funktioniert immer:

  → {{trial_link}}

Falls du im Newsletter bleiben willst (1× pro Woche, kein Spam,
nur DSGVO-Urteile + neue Features):

  → {{newsletter_optin}}

Sonst: Abmelden mit einem Klick: {{unsubscribe_link}}

Frohes Compliance-Schaffen.

—
{{founder_name}}
RealSyncDynamics.AI
```

**Send-Zeit:** Tag 14, 16:00

---

## Sequenz B — Pro-Trial Onboarding

**Trigger:** Stripe Checkout = Trial Start (€0 für 14 Tage)
**Ziel:** Activation („Aha-Moment" innerhalb 48h) + Retention

### Mail B1 — „Trial gestartet — die 3 Schritte" (Tag 0, sofort)

**Betreff:** Trial aktiv. Hier sind die ersten 3 Klicks.

```
Willkommen, {{first_name}}!

Dein Professional-Trial läuft 14 Tage. Damit du in Tag 1 zum
„Aha-Moment" kommst, hier die 3 wichtigsten Klicks:

  1. System verknüpfen (3 Min)
     → {{system_link}} – DNS-Token oder Tag-Snippet einbauen.

  2. Continuous Monitor starten (1 Min)
     → {{monitor_link}} – ab dann 24/7 Scans alle 6h.

  3. VVT-Generator durchlaufen (5 Min)
     → {{vvt_link}} – fertiges Art. 30 DSGVO-Dokument als PDF.

Das war's. Nach diesen 9 Minuten hast du:
  ✓ Continuous Monitoring aktiv
  ✓ Audit-fähiges VVT als PDF
  ✓ Erste Compliance-Score-Daten in deinem Dashboard

Bei jeder Frage: einfach antworten. Direkt-Reply geht an mich.

—
{{founder_name}}
```

**Send-Zeit:** Sofort

---

### Mail B2 — „Schritt 1 noch nicht erledigt?" (Tag 2, falls System nicht verknüpft)

**Betreff:** Dein Trial wartet noch auf Schritt 1

```
{{first_name}},

dein Trial läuft seit 48h, aber das System ist noch nicht verknüpft.

Gängige Hürden:

  1. DNS-Zugang fehlt → Wir haben einen Tag-Snippet, der ohne DNS funktioniert: {{snippet_docs}}
  2. Multi-Domain → Pro-Plan deckt 1 System, Enterprise unbegrenzt: {{enterprise_link}}
  3. Frage zur Integration → 15-Min-Call: {{calendly_link}}

—
{{founder_name}}
```

**Send-Zeit:** Tag 2, 11:00 (nur wenn `system_connected = false`)

---

### Mail B3 — Activation-Tipp (Tag 5)

**Betreff:** Alarm-Channel verknüpfen — wichtigste Funktion

```
{{first_name}},

eine Funktion, die 90% der User in den ersten 14 Tagen verpassen:

  → Slack-/Teams-/E-Mail-Alerts für kritische Findings

Statt täglich ins Dashboard schauen, kommt der Alert automatisch
zu dir/deinem Team.

3 Klicks: {{alerts_setup_link}}

Beispiel-Alert:
  „[CRITICAL] realsyncdynamicsai.de: Google Fonts-Tracker ohne Consent
   detektiert. Letzter Audit: 2026-05-07 09:14. Risiko: Art. 25 TTDSG."

—
{{founder_name}}
```

---

### Mail B4 — Power-User-Feature (Tag 9)

**Betreff:** Dein VVT als Mandanten-Vorlage exportieren

```
{{first_name}},

falls du externe DSBs / Compliance-Beratung machst:

VVT-Templates können als „Mandanten-Vorlage" gespeichert werden.
Einmal konfigurieren → 10× wiederverwenden für ähnliche Mandanten.

  → Templating-Doku: {{templates_docs}}
  → Direkt im Dashboard: {{templates_link}}

Im Enterprise-Plan gibt's dazu Custom-Branding & API-Export.

—
{{founder_name}}
```

---

### Mail B5 — „Trial endet in 3 Tagen" (Tag 11)

**Betreff:** Trial endet {{trial_end_date}} — was bisher passiert ist

```
{{first_name}},

dein Trial endet am {{trial_end_date}} (in 3 Tagen).

Was du bisher bekommen hast:

  ✓ {{audits_count}} Audits durchgeführt
  ✓ {{findings_count}} Findings detektiert ({{high_severity}} kritisch)
  ✓ {{vvt_count}} VVT-Dokumente generiert
  ✓ Continuous Monitor seit {{monitor_days}} Tagen aktiv

Wenn alles passt: nichts tun. Trial konvertiert automatisch zu €149/Monat.
14-Tage-Geld-zurück bleibt aktiv.

Wenn du kündigen willst: ein Klick → {{cancel_link}}

Bei Fragen: einfach antworten.

—
{{founder_name}}
```

---

## Sequenz C — Win-Back (Trial-Bouncer)

**Trigger:** Trial endete ohne Conversion

### Mail C1 — Tag 1 nach Trial-Ende

**Betreff:** Trial vorbei — Daten bleiben 30 Tage

```
{{first_name}},

dein Trial ist gestern abgelaufen. Schade, dass es nicht gepasst hat.

Wichtig: Deine Audit-Daten + VVTs bleiben 30 Tage gespeichert (DSGVO-konform).
Wenn du innerhalb von 30 Tagen reaktivierst, machst du dort weiter, wo du
aufgehört hast.

  → Reaktivieren: {{reactivate_link}} ({{reactivate_discount}} Rabatt 1. Monat)

Falls du Feedback hast, was nicht gepasst hat — ich lese jede Mail persönlich.

—
{{founder_name}}
```

---

### Mail C2 — Tag 7 nach Trial-Ende

**Betreff:** Was wir basierend auf Feedback gebaut haben

```
{{first_name}},

kurzes Update: in den letzten 7 Tagen haben wir gebaut, was Trial-User
gefehlt hat:

  • {{new_feature_1}}
  • {{new_feature_2}}
  • {{new_feature_3}}

Falls eines davon den Ausschlag gibt:

  → 14 Tage Trial reaktivieren: {{reactivate_link}}

—
{{founder_name}}
```

*(Diese Mail dynamisch befüllen aus Changelog — Nutzer wertschätzen
Produkt-Velocity.)*

---

### Mail C3 — Tag 21 nach Trial-Ende

**Betreff:** Letztes Angebot — 50% off 1. Monat

```
{{first_name}},

ich nerve normalerweise nicht. Dies ist meine letzte Mail.

Falls du Professional unter 50%-Off testen willst:

  → {{discount_link}} (gültig 7 Tage, Code: COMEBACK50)

Nach diesen 7 Tagen kommen keine weiteren Mails dieser Art.

—
{{founder_name}}
```

---

## Sequenz D — Cart-Abandonment

**Trigger:** Stripe Checkout-Session erstellt, aber `checkout.session.completed` nicht gefeuert binnen 60 Min.

### Mail D1 — +1h

**Betreff:** Klick verloren? Trial weiter starten

```
{{first_name}},

Stripe-Checkout sieht aus, als wärst du irgendwo rausgeflogen.

Wenn's an Zahlungsmethode lag: Stripe akzeptiert Karte, SEPA, Apple Pay,
Google Pay, Klarna, Link.

  → Direkt zum Trial: {{checkout_resume_link}}

Falls du noch grübelst: hier sind die Top-3-Fragen, die andere Trial-Starter
hatten:

  1. Wann startet die €149-Abrechnung? → Erst nach Tag 14.
  2. Kann ich downgraden? → Ja, jederzeit. Auf Free Tier zurück = €0.
  3. Daten-Export bei Kündigung? → Vollständig, JSON + PDF, DSGVO-konform.

—
{{founder_name}}
```

---

### Mail D2 — +24h

**Betreff:** Letzte Erinnerung — Trial-Link läuft ab

```
{{first_name}},

dein Checkout-Link läuft in 24h ab.

Falls noch was unklar ist — hier mein direkter Calendly:
{{founder_calendly}} (15 Min, persönlich, kein Sales-Druck).

Sonst: {{checkout_resume_link}}

—
{{founder_name}}
```

---

## Sequenz E — Newsletter (Wöchentlich, Edu)

**Cadence:** 1× pro Woche, Donnerstag 09:00 (höchste B2B-Open-Rate)
**Inhalt:** DSGVO-Urteile, neue Features, AI-Act-News, Case Studies

### Template-Struktur

```
Betreff: {{topic_short}} — {{week_of}}
Pre-Header: {{key_takeaway}}

Hi {{first_name}},

[1 starker Hook-Satz mit konkretem Pain oder Urteil]

DAS URTEIL / DIE NEWS:
[100–150 Wörter mit Paragraph-Referenzen, Aktenzeichen, Strafhöhe]

WAS DAS FÜR DICH HEISST:
[3 Bulletpoints, konkrete Handlungsempfehlung]

UNSER TAKE:
[Kurzer Founder-Take, persönlich, mit Tool-Verweis falls relevant]

Bei Fragen: antworte direkt.

—
{{founder_name}}

Inspirieren dich diese News? → Im Tool: {{tool_link}}
```

**Beispiel-Topics für die ersten 8 Wochen:**
1. LG München Google-Fonts-Urteil — Was 2026 anders ist
2. EU AI Act Phase 1 (Februar 2025) — Praxis-Update
3. BfDI-Bußgeld-Statistik 2025 — Welche Branchen am stärksten getroffen
4. Cookie-Banner-Studie 2026 — 80% der DAX-30 nicht konform
5. Schrems III? Aktueller Stand EU-US Data Privacy Framework
6. NIS-2-Umsetzung in Deutschland — Was Compliance-Teams jetzt tun
7. Recruiting-KI: Hochrisiko-Klassifikation am Beispiel
8. Auftragsverarbeitung mit US-Cloud-Providern — Sicher oder nicht?

---

## DSGVO-Compliance der E-Mails selbst

**Pflicht-Elemente in jeder Mail:**
- ✓ Impressum-Link im Footer
- ✓ Abmelde-Link in jeder Marketing-Mail (Art. 21 DSGVO)
- ✓ Datenschutz-Link im Footer
- ✓ Absender-Adresse mit verifizierter Domain (DKIM, SPF, DMARC)
- ✓ Versand erst nach Double-Opt-in (außer Trial-/Pro-User → Vertragsinteresse)
- ✓ Tracking-Pixel: nur mit Consent (DSGVO Art. 6 + § 25 TTDSG)

**Trennung von Mail-Typen:**
| Typ | Rechtsgrundlage | Opt-out |
|---|---|---|
| Transactional (Audit-Report, Trial-Onboarding) | Art. 6 Abs. 1 b (Vertrag) | Nicht erforderlich |
| Marketing-Sequenz (A6+, C1+) | Art. 6 Abs. 1 a (Consent) | Pflicht in jeder Mail |
| Newsletter | Consent | Pflicht |

---

## KPIs & A/B-Test-Hypothesen

### Baseline-KPIs (Branchen-Benchmark B2B SaaS)
| Mail-Typ | Open-Rate | CTR | Conversion |
|---|---|---|---|
| Transactional (A1) | 60–75% | 50–70% | n/a |
| Marketing-Welcome | 35–50% | 5–12% | 2–5% |
| Re-Engagement | 20–30% | 3–8% | 1–2% |
| Newsletter | 25–35% | 3–6% | 0,5–2% |

### A/B-Test-Hypothesen (in dieser Reihenfolge)
1. **Subject-Line A1:** „Dein DSGVO-Score: {{score}}/100" vs. „PDF-Report bereit ({{score}}/100)"
2. **CTA A2:** Button-Color Gold vs. Blue
3. **Sender A3–A7:** Founder-Name vs. „Team RealSyncDynamics"
4. **Send-Zeit Newsletter:** Do 09:00 vs. Di 14:00
5. **Discount C3:** 50% off vs. 30 Tage Extra-Trial

---

## Tool-Setup

### Resend (Transactional)
- DKIM/SPF/DMARC für `realsyncdynamicsai.de`
- React-Email für Templates (Type-Safe Props)
- Webhook → Postgres `email_events` Tabelle

### Customer.io oder Loops (Sequenzen)
- Segments: `free_tool_user`, `trial_active`, `paid_pro`, `lapsed`
- Workflows: Sequenzen A–E als Multi-Step-Flow
- Conversion-Tracking via Stripe-Webhook → Customer.io Event

### Datenfluss
```
Free-Tool-Use → audit_completed event → Resend (A1) + Customer.io (Trigger A2–A7)
Trial-Start  → trial_started event   → Customer.io (Sequenz B)
Trial-End    → trial_ended event     → Customer.io (Sequenz C, falls !converted)
Stripe-Hook  → checkout_abandoned    → Customer.io (Sequenz D)
```

---

## Launch-Reihenfolge

1. **Woche 1:** Sequenz A (Welcome) live — höchster ROI (jeder Free-User durchläuft sie)
2. **Woche 2:** Sequenz B (Pro-Trial) live — sobald erste Trials starten
3. **Woche 3:** Sequenz D (Cart-Abandonment) — Quick-Win bei jedem Stripe-Drop-off
4. **Woche 4:** Sequenz C (Win-Back) — sobald erste Trial-Bouncer existieren
5. **Monat 2:** Sequenz E (Newsletter) — separates Opt-in nach 100 Subscribern Critical Mass
