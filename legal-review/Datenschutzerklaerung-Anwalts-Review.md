# Datenschutzerklärung RealSync Dynamics

**Stand:** 2026-05-07  
**Live-URL:** https://realsyncdynamicsai.de/legal/privacy

> **Status: Pre-Launch.** Verantwortlicher (Name, Anschrift) und Aufsichtsbehörde (TLfDI) sind eingetragen. Mustertext-Skelett — vor Produktiv-Einsatz durch DSGVO-Berater oder Anwalt prüfen lassen, insbesondere zur Anpassung an konkrete Verarbeitungsprozesse.

---

## 1. Verantwortlicher (Art. 4 Nr. 7 DSGVO)

**RealSync Dynamics**  
Schwarzburger Str. 31  
98724 Neuhaus am Rennweg  
Thüringen, Deutschland

E-Mail: privacy@realsyncdynamicsai.de  
Inhaber / Vertretungsberechtigt: **Dominik Steiner**

## 2. Datenschutzbeauftragter

Falls bestellungspflichtig nach § 38 BDSG: Kontaktdaten des DSB hier ergänzen. Andernfalls: *„Ein Datenschutzbeauftragter ist gesetzlich nicht vorgeschrieben; Anfragen richten Sie bitte an die unter Ziffer 1 genannte Adresse."*

## 3. Welche Daten wir verarbeiten

- **Account-Daten:** E-Mail, optional Name, Workspace-Zugehörigkeit (Tenant + Rolle).
- **Nutzungsdaten:** AI-Tool-Aufrufe (Prompt-Inhalt, Output, Token-Counts, Kosten), Workflow-Ausführungen, Asset-Metadaten.
- **Zahlungsdaten:** über Stripe; wir speichern Customer-ID und Subscription-Status — keine Karten-/IBAN-Daten.
- **Technische Daten:** IP-Adresse (kurzzeitig in Server-Logs), User-Agent, Login-Zeitpunkt.

## 4. Rechtsgrundlagen (Art. 6 DSGVO)

- **Art. 6 Abs. 1 lit. b** — Vertragserfüllung: Account-, Subscription-, Workspace-Daten.
- **Art. 6 Abs. 1 lit. f** — Berechtigtes Interesse: technische Logs zur Sicherheit, Audit-Trail, Cost-Tracking.
- **Art. 6 Abs. 1 lit. a** — Einwilligung: Cookie-Banner für nicht-notwendige Cookies, Marketing-Mails.
- **Art. 6 Abs. 1 lit. c** — Rechtliche Pflicht: handels- und steuerrechtliche Aufbewahrung von Rechnungen (10 Jahre, HGB/AO).

## 5. Empfänger der Daten / Sub-Prozessoren

Wir setzen Auftragsverarbeiter nach Art. 28 DSGVO ein. Die vollständige Liste mit Zwecken, Regionen und AVV/DPA-Links findet sich auf https://realsyncdynamicsai.de/legal/sub-processors.

Wesentliche Empfänger: Supabase (Frankfurt), Anthropic / Google / OpenAI (USA, mit EU-DPA + SCCs nach Art. 46 DSGVO), Stripe (Irland), Hostinger (Deutschland).

## 6. Datenresidenz / EU-lokal-Modus

Standardmäßig laufen AI-Aufrufe über die o. g. Cloud-Anbieter. Mit dem Schalter „EU-lokal" in den Account-Einstellungen kannst Du erzwingen, dass **alle** AI-Anfragen Deines Accounts ausschließlich auf unserem deutschen VPS verarbeitet werden. In diesem Modus verlassen Daten die EU nicht.

Workspace-Owner können die Wahl per `tenant.ai_data_residency_policy` für alle Mitglieder erzwingen.

## 7. Speicherdauer

- Account-Daten: bis Account-Löschung.
- Audit-Logs (AI-Tool-Calls, Workflow-Runs): bis Account-Löschung; danach anonymisiert für Cost-Tracking.
- Rechnungen / Subscriptions: 10 Jahre nach § 257 HGB / § 147 AO.
- Magic-Link-E-Mails: nicht persistiert.

## 8. Deine Rechte

- **Art. 15** Auskunftsrecht — Selfservice-Export unter /settings/account.
- **Art. 16** Recht auf Berichtigung — direkt im Profil.
- **Art. 17** Recht auf Löschung — Selfservice-Löschung unter /settings/account.
- **Art. 20** Datenübertragbarkeit — der Export liefert maschinenlesbares JSON.
- **Art. 21** Widerspruchsrecht gegen Verarbeitung auf Grundlage berechtigter Interessen.
- **Art. 77** Beschwerderecht bei der zuständigen Aufsichtsbehörde — für uns: **Thüringer Landesbeauftragter für den Datenschutz und die Informationsfreiheit (TLfDI)**, Häßlerstraße 8, 99096 Erfurt, poststelle@datenschutz.thueringen.de.

Anfragen die nicht im Selfservice abgedeckt sind: privacy@realsyncdynamicsai.de

## 9. Cookies

Wir setzen technisch notwendige Cookies (Session-Cookie für Login, keine Einwilligung erforderlich nach § 25 Abs. 2 TTDSG). Tracking-, Marketing- und Statistik-Cookies setzen wir nur nach expliziter Einwilligung über das Cookie-Banner ein.

## 10. Änderungen

Wir passen diese Datenschutzerklärung an, wenn sich die rechtliche Grundlage oder unsere Verarbeitungstätigkeiten ändern. Wesentliche Änderungen werden registrierten Nutzern per E-Mail avisiert.

---

## Anhang A — Selbst identifizierte Lücken (zur anwaltlichen Prüfung)

Diese Punkte hat Dominik Steiner als möglicherweise unvollständig markiert. Bitte prüfen und ggf. mit konkretem Vorschlag-Wording ergänzen:

1. **Art. 49 / Schrems II:** Drittlandtransfer USA (Anthropic, OpenAI, Google) wird in Sektion 5 nur als „SCCs nach Art. 46" abgehandelt. Transfer Impact Assessment nach EDPB-Empfehlungen 01/2020 fehlt. Welche zusätzlichen Schutzmaßnahmen (technische, organisatorische, vertragliche) sind hier zu dokumentieren?

2. **Betroffenenrechte unvollständig:**
   - Art. 18 (Einschränkung der Verarbeitung) fehlt in Sektion 8
   - Art. 22 (keine automatisierte Einzelentscheidung) fehlt — relevant da KI-Tools Risiko-Scores ausgeben (z.B. AI-Act-Klassifikator, Bußgeld-Rechner)

3. **AI-Cloud-Pfad — Prompt-Inhalte:**
   - Sektion 3 listet „Prompt-Inhalt" als Nutzungsdatum, aber: Bei Cloud-Pfad wandern Prompts an Anthropic/OpenAI/Google in den USA. Ist dies in Sektion 5 ausreichend abgedeckt, oder ist eine separate Sektion „Verarbeitung von KI-Eingaben" erforderlich?
   - Hinweis: User können in Prompts personenbezogene Daten Dritter eingeben (Mandantendaten, Mitarbeiterdaten). Ggf. Hinweis-Pflicht ggü. User?

4. **Audit-Tool / Drittseiten-Scan:**
   - Plattform bietet öffentliches Audit-Tool an, das fremde Websites scannt (https://realsyncdynamicsai.de/audit). DNS-Lookup, HTTP-Header-Analyse, Subpage-Crawl. Wer ist hier Verantwortlicher? Pflicht zur Datenschutzhinweis-Anzeige für gescannte Seiten?

5. **Server-Log-IP-Speicherdauer:**
   - „kurzzeitig in Server-Logs" ist unspezifisch. Üblich sind 7–30 Tage mit Begründung. Konkrete Tage-Angabe und Rechtsgrundlage erbeten.

6. **DSFA-Pflicht nach Art. 35:**
   - Plattform verarbeitet Sub-Processor-Daten, KI-Outputs, Audit-Trails. Ist eine eigene DSFA für RealSync Dynamics als Betreiber erforderlich? Falls ja: Beauftragung erbeten.

7. **Auftragsverarbeitung mit Tenant-Kunden:**
   - B2B-Tenants verarbeiten via unsere Plattform potenziell personenbezogene Daten Dritter. Wir sind Auftragsverarbeiter ggü. Tenant. AVV-Pflicht-Hinweis in Datenschutzerklärung sinnvoll/erforderlich?

8. **Newsletter / § 7 UWG:**
   - Double-Opt-In implementiert. Wording der Bestätigungs-Mail nicht in Datenschutzerklärung referenziert. Sollte hinzugefügt werden?

9. **Resend Inc. (Email-Versand):**
   - Subprozessor mit US-Sitz, EU-Hosting (Ireland). Drittland-Pfad-Status: Adäquanzbeschluss DPF? Oder SCCs? Bewertung erbeten.

10. **Versionshistorie / Art. 12 Transparenz:**
    - Aktuell nur Datum sichtbar. Versionshistorie für ältere Stände der Datenschutzerklärung pflicht oder ratsam?

11. **Datenschutzbeauftragter Status:**
    - Aktuell Einzelunternehmen, 1 Person, < 20 Beschäftigte. Aber: Ggf. § 38 Abs. 1 Satz 2 BDSG (Kerntätigkeit besteht in Verarbeitung, die nach Art. 35 DSFA erfordert) trifft zu, wenn AI-Tools für Risiko-Klassifikation eingesetzt werden? Bewertung erbeten.

12. **EU AI Act ab August 2026:**
    - Hinweis auf zukünftige Geltung in Datenschutzerklärung sinnvoll, oder separater Abschnitt unter eigener Überschrift?

---

## Anhang B — Sub-Prozessoren-Liste (Snapshot)

Aktuelle Live-URL: https://realsyncdynamicsai.de/legal/sub-processors

| Anbieter | Zweck | Region | DPA |
|---|---|---|---|
| Supabase Inc. | Auth, Postgres-DB, Edge Functions, Storage | Frankfurt (eu-central-1, AWS) | https://supabase.com/legal/dpa |
| Anthropic, PBC | AI-Inferenz Cloud-Pfad (Claude) | USA mit EU-DPA + SCCs | https://www.anthropic.com/legal/dpa |
| Google LLC | AI-Inferenz Cloud-Pfad (Gemini) | USA mit EU-DPA + SCCs | https://cloud.google.com/terms/data-processing-addendum |
| OpenAI, L.L.C. | AI-Inferenz Cloud-Pfad (GPT, optional) | USA mit EU-DPA + SCCs | https://openai.com/policies/data-processing-addendum |
| Stripe Payments Europe Ltd. | Subscription-Zahlungen | Irland (EU) | https://stripe.com/legal/dpa |
| Hostinger International Ltd. | VPS-Hosting EU-lokal-Stack (Ollama, n8n) | Frankfurt (DE) | https://www.hostinger.com/legal/data-processing-agreement |
| Resend Inc. | Transaktionale E-Mails | EU (Ireland) Versand-Endpoint | https://resend.com/legal/dpa |
| GitHub, Inc. (Microsoft) | Frontend-Hosting via GitHub Pages | Global CDN, USA mit EU-DPA + SCCs | https://github.com/customer-terms/github-data-protection-agreement |

---

*Erstellt für Datenschutz-Anwalts-Review. Nicht zur direkten Veröffentlichung — vor Live-Schaltung Anwalt-Prüfung erforderlich.*
