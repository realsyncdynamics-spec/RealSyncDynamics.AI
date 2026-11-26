# REA-Radar — Bericht 25.11.2026

Methode: `docs/rea/RADAR_METHODE.md`. Einstufung je Angabe: **belegt** (Primärquelle) ·
**Drittquelle** · **Annahme**. Recherche am 25.11.2026; Preise vor Verwendung erneut prüfen.

## Kernaussage

Die App-Builder (Replit, Google AI Studio, Bolt, Lovable) gewinnen das Rennen um
„Idee → laufende App“. Mit ihnen konkurrieren wir nicht. Wir übernehmen ihr stärkstes Muster,
**sichtbares Ergebnis in Minuten**, und wenden es auf unseren Kern an: **Telefon + WhatsApp
als ein KI-Sekretariat** für Betriebe. Der größte Hebel liegt nicht in neuem Code, sondern
darin, **Bestehendes zu verbinden**: Website-Check, Übergabe-Vertrag, WhatsApp-Webhook,
„Mein Betrieb“. Dazu kommt eine **verwaltete Voice-Laufzeit** statt des blockierten
Eigenbetriebs.

## Ist-Stand (aus dem Code, nur gelesen)

| Baustein | Status | Quelle |
|---|---|---|
| Website-Check `/audit` | live | `src/App.tsx`, `supabase/functions/gdpr-audit` u. a. |
| Übergabe-Vertrag Website-Check → SiteOS → Voice → Governance | vorhanden | `src/features/siteos/scanHandoff.ts` |
| Chat/WhatsApp/Telegram-Bots | `preview` | `implementation-status.ts` → `channel-bots`, `supabase/functions/whatsapp-webhook` |
| Voice-Onboarding | `preview` | `voice-agent-onboarding` |
| Telefonie | `coming-soon` — kein funktionierender Deploy-Pfad für `apps/agent-runtime` | `voice-telephony` |
| Kundenübersicht „Mein Betrieb“ | vorhanden | `/app/betrieb` |
| Preise WhatsApp / Voice Bot | je 99 €/Monat zzgl. Verbrauch; Add-on Voice 150 € + 0,25 €/Min. | `shared/pricing.ts` |

## Beobachtungen

### A. KI-App-Builder

| Werkzeug | Was neu ist | Einstufung | Muster für uns |
|---|---|---|---|
| Replit | Automatische Modellwahl je Aufgabe (28.08.2026); Agent liest Produktions-Logs und behebt Fehler (02/2026); Mobile-Build-Flow, gesenkte Cloud-Preise ab 01.08.2026; Pläne Core / Pro (bis 15 Builder, geteilte Credits) | belegt (Changelog) · Preise Drittquelle | **Modell-Routing je Gespräch** (Kosten senken), **Fehler aus Produktion zurück in den Loop** |
| Google AI Studio (Build) | Full-Stack mit Login, Secrets, Multiplayer (03/2026); native Android-Apps, Workspace-Anbindung, Export nach Antigravity (I/O 05/2026); Anmerkungen direkt in der Vorschau | belegt (Google-Blog) | **Korrektur direkt am Ergebnis**: Inhaber markiert eine Bot-Antwort und korrigiert sie |
| Bolt | Browser-Laufzeit (WebContainers), eigene Datenbank inkl. Auth/Files; Preise nach Tokens, Kritik am „Token-Cliff“ | Drittquelle | **Kein Verbrauchs-Schock**: Betriebe wollen planbare Monatspreise |
| Lovable | > 400 Mio. USD ARR (02/2026, gegenüber TechCrunch bestätigt); Agent-Modus Standard; Credits auch für KI-Funktionen in ausgelieferten Apps | belegt (TechCrunch) / Drittquelle (Sacra) | **Self-Service schlägt Vertrieb**: Wachstum ohne Sales-Team |

**Gemeinsame Lücke aller vier:** keine Telefonie, kein WhatsApp-Sekretariat, keine
Branchenabläufe im Handwerk, US-Hosting als Standard und keine Nachweise für Betriebe. Das ist
unser Feld.

### B. Voice-Infrastruktur

| Anbieter | Preis laut Quelle | Einstufung | Bemerkung |
|---|---|---|---|
| ElevenLabs Agents | 0,08 USD/Min. auf bezahlten Plänen (Burst 0,16); Telefonie extra; Kanal WhatsApp inkl. Anrufe dokumentiert | belegt (Preisseite/Doku) | Im Arbeitsumfeld bereits als MCP-Anbindung verfügbar |
| Vapi | 0,05 USD/Min. Plattform + durchgereichte STT/LLM/TTS, gesamt ca. 0,08–0,13 USD | Drittquelle | Datenresidenz nur im höheren Tarif (unbestätigt) |
| Retell | ab 0,07 USD/Min., realistisch ca. 0,09–0,11 USD | Drittquelle | EU-Hosting nicht belegt |

**Annahme (zu prüfen):** Bei 0,25 €/Min. im Add-on Voice bleibt nach Plattform- und
Telefoniekosten eine positive Marge. Fehlend: Kosten für deutsche Rufnummern und Minuten beim
Telefonieanbieter, EU-Datenresidenz und AVV des Voice-Anbieters.

### C. WhatsApp Business Platform

- **Richtlinie:** Seit 15.01.2026 sind **allgemeine KI-Chatbots** (ChatGPT-ähnlich) auf der
  Business-API untersagt; KI für Support, Vertrieb und Termine bleibt erlaubt. *Belegt über
  Fachpresse (TechCrunch); Wortlaut in den Meta-Bedingungen prüfen.* → Unser Sekretariat muss
  **auf den Betrieb begrenzt** bleiben (kein offenes Allzweck-Gespräch). Das gehört als Policy in
  den Bot-Prompt und in den Prüfpfad.
- **Gebühren seit 01.10.2026:** die ersten 1.000 Service-Nachrichten pro Nummer und Monat
  frei, danach Utility-Satz (DE ca. 0,0456 €); Marketing DE ca. 0,1131 €. *Drittquelle
  (BSP-Blogs); Meta-Rate-Card prüfen.* → Für ein Sekretariat (überwiegend Service) sind die
  Kanalkosten **gering**.
- **WhatsApp Calling** ist über BSPs (z. B. Twilio) verfügbar → ein Agent kann Telefon- **und**
  WhatsApp-Anrufe annehmen.

### D. Direkte Wettbewerber (DE/AT)

fonio (Wien; laut Anbieter > 10.000 Kunden, 60+ Sprachen), HalloPetra (monatlich kündbar
und **pausierbar**, passend für Saisonbetriebe), Famulor/Petra (schreibt Aufträge **direkt in
Handwerkersoftware**), Zeeg (ab 49 € für 250 Inbound-Minuten), Vokaro (ab 99 €/Monat,
Handwerksvorlagen). *Alles Drittquellen bzw. Anbieterangaben.*

→ Unser Preispunkt (99 € + Verbrauch) liegt im Markt. Differenzierung, die keiner der Genannten
vollständig hat: **Telefon + WhatsApp in einem Sekretariat, eine Auftragskarte, ein Prüfpfad**,
EU-Betrieb, Einrichtung aus der eigenen Website.

## Vorschläge: drei Sprünge (bewertet nach Methode)

| # | Sprung | Nutzen | Einf. | Monet. | Skal. | Umsetzb. | Gov. | Σ |
|---|---|---|---|---|---|---|---|---|
| 1 | **Sekretariat aus der Website**: Domain eingeben → Website-Check liest Leistungen, Öffnungszeiten, FAQ → fertiger Entwurf für den Assistenten, Inhaber gibt frei | 3 | 3 | 2 | 3 | 2 | 3 | **16** |
| 2 | **Eine Auftragskarte für alle Kanäle**: Anruf und WhatsApp erzeugen dieselbe Karte (Name, Rückrufnummer, Anliegen, Ort, Dringlichkeit, Fotos aus WhatsApp) in „Mein Betrieb“ + Benachrichtigung an den Inhaber | 3 | 3 | 2 | 3 | 2 | 3 | **16** |
| 3 | **Verwaltete Voice-Laufzeit statt Eigenbetrieb** (ADR + Spike): ElevenLabs Agents vs. Twilio ConversationRelay vs. `apps/agent-runtime` | 3 | 2 | 3 | 3 | 2 | 2 | **15** |

Danach (Kandidaten, noch nicht priorisiert): Korrektur direkt im Gesprächsverlauf
(Muster AI Studio), Modell-Routing je Gespräch (Muster Replit), Rückruf-/Terminerinnerung per
WhatsApp-Vorlage mit serverseitig gespeicherter Einwilligung, Partner/White-Label-Paket für
Agenturen, weitere Branchen (Praxen, Kanzleien, Immobilien).

### Arbeitspaket 1 — Sekretariat aus der Website

- **Bestand:** `/audit`, `scanHandoff.ts`, `bot-chat`, `channel-bots` (Preview).
- **Umfang:** Aus dem Ergebnis des Website-Checks einen **Konfigurationsentwurf** ableiten
  (nur öffentliche Website-Inhalte), in „Mein Betrieb“ anzeigen; erst nach Freigabe durch den
  Inhaber aktiv. Herkunftsnachweis je Feld (welche Seite, wann gelesen).
- **Abnahme:** Domain → Entwurf in < 2 Min.; jedes Feld editierbar; ohne Freigabe keine
  Aktivierung; Tests für Normalisierung und Freigabe-Gate.
- **Freigabe nötig:** Profil `website` + ggf. `database` (neue Tabelle → Migration = Einzel-Freigabe).

### Arbeitspaket 2 — Auftragskarte

- **Bestand:** `whatsapp-webhook`, `bot-voice-webhook`, `/app/betrieb`, `features/governance/handoff`.
- **Umfang:** Ein gemeinsames Schema für Übergaben aus allen Kanälen, Anzeige in
  „Mein Betrieb“, Status offen → erledigt, Eintrag im Prüfpfad.
- **Abnahme:** Testnachricht aus WhatsApp-Webhook (Fixture) erzeugt Karte; Tenant-Isolation per
  RLS-Test; kein Mandant aus dem Request-Body.
- **Freigabe nötig:** Migration (Einzel-Freigabe), Security-Review (`aios-security-audit`).

### Arbeitspaket 3 — ADR Voice-Laufzeit

- **Umfang:** Entscheidungsvorlage `docs/` (Kosten/Min., Latenz, deutsche Rufnummern,
  EU-Datenresidenz, AVV, Übergabe an Menschen, Abhängigkeit) + lokaler Spike ohne Deploy.
- **Abnahme:** Vergleichstabelle mit Primärquellen, Empfehlung, offene Rechtsfragen.
- **Freigabe nötig:** Konten oder kostenpflichtige Tests beim Anbieter (Einzel-Freigabe).

## Bewusst nicht verfolgt

- Eigener allgemeiner App-Builder gegen Replit/Lovable: kapitalintensiv, kein Vorteil für Handwerk.
- Allzweck-Chatbot auf WhatsApp: seit 15.01.2026 laut Fachpresse untersagt.

## Offene Fragen an Dominik

1. Darf REA für Arbeitspaket 3 ein Testkonto bei einem Voice-Anbieter nutzen (Kosten)?
2. Welche Handwerkersoftware nutzen die ersten Zielkunden? Davon hängt die erste Integration ab.
3. Soll „pausierbar“ (Muster HalloPetra) als Preisoption geprüft werden? (Preisentscheidung)

## Quellen

- Replit Changelog: [28.08.2026](https://docs.replit.com/updates/2026/08/28/changelog), [24.07.2026](https://docs.replit.com/updates/2026/07/24/changelog), [20.02.2026](https://docs.replit.com/updates/2026/02/20/changelog); Pläne: [AlternativeTo](https://alternativeto.net/news/2026/2/replit-restructures-plans-with-lower-core-pricing-and-launches-pro-for-advanced-teams)
- Google AI Studio: [Full-Stack Vibe Coding](https://blog.google/innovation-and-ai/technology/developers-tools/full-stack-vibe-coding-google-ai-studio/), [I/O 2026](https://blog.google/innovation-and-ai/technology/developers-tools/google-ai-studio-io-2026?authuser=3)
- Bolt: [Banani – Pricing 2026](https://www.banani.co/blog/bolt-new-pricing), [Automation Atlas – Review 2026](https://automationatlas.io/answers/bolt-new-review-2026/)
- Lovable: [Sacra](https://www.sacra.com/c/lovable), [Lovable Agent](https://lovable.dev/blog/agent)
- ElevenLabs: [Preise Agents](https://elevenlabs.io/pricing/agents), [Kosten-Hilfe](https://elevenlabs.io/docs/help-center/product/eleven-agents/how-much-does-eleven-agents-cost), [WhatsApp-Doku](https://elevenlabs.io/docs/eleven-agents/whatsapp.md)
- Vapi/Retell: [Telnyx – Vapi Pricing](https://telnyx.com/resources/vapi-pricing), [Zeeg – Retell Pricing](https://zeeg.me/en/blog/post/retell-ai-pricing-guide), [Dupple – Vergleich](https://dupple.com/learn/vapi-vs-retell-ai)
- WhatsApp: [TechCrunch – Verbot allgemeiner Chatbots](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform), [respond.io – Policy 2026](https://respond.io/blog/whatsapp-chatbot-policy-2026), [Meta – Pricing](https://developers.facebook.com/docs/whatsapp/pricing), [Chatarmin – Kosten 2026](https://chatarmin.com/en/blog/whatsapp-business-costs), [Twilio – WhatsApp Calling](https://www.twilio.com/en-us/voice/whatsapp-business-calling)
- Wettbewerb DE: [OMR – KI-Telefonassistent Handwerk](https://omr.com/de/reviews/contenthub/ki-telefonassistent-handwerk), [Dr. Web – Vergleich 2026](https://www.drweb.de/ki-telefonassistenten-vergleich/), [Zeeg – Handwerk](https://zeeg.me/content/ki-telefonassistent-handwerk), [KI-Syndikat – HalloPetra](https://www.ki-syndikat.de/tools/hallopetra/)

## Verlauf

| Datum | Schwerpunkt | Vorgeschlagene Arbeitspakete |
|---|---|---|
| 25.11.2026 | Erstlauf: Builder, Voice, WhatsApp, Wettbewerb DE | Sekretariat aus Website · Auftragskarte · ADR Voice-Laufzeit |
