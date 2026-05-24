# Nicht bauen — Hard-Scope-Grenzen

Diese Liste ist *bindend* für die 90-Tage-Phase. Alles hier drauf ist
*nicht erlaubt*, ohne dass ein Pilotkunde es schriftlich verlangt.

## Marketing / Narrativ

- Keine neuen allgemeinen Landingpages
- Keine neuen Branchen-Seiten (HR, Healthcare, Logistik, …)
- Keine generischen „AI-Governance"-Texte
- Keine SEO-Content-Produktion über die bestehenden Pages hinaus
- Keine Whitepapers / E-Books / „Ultimate Guides"
- Keine Pressemitteilungen / PR
- Keine Konferenz-Vorträge ohne direkten Pilotbezug
- Keine neuen Kategorie-Namen erfinden
- Keine Investor-Pitches polieren
- Keine ARR-/Bewertungs-Decks

## Produkt / Features

- **Keine Enterprise-Suite** (SSO, SAML, RBAC-Vielfalt, Custom-Roles, Audit-API)
- **Kein eigenes CRM** — wir konsumieren, wir bauen keins
- **Kein eigenes Ticket-System** — Findings gehen ggf. via Webhook in Jira/Linear
- **Kein eigenes IAM** — Supabase Auth + RLS bleibt
- **Keine generische Workflow-Engine** — keine offenen Agentenausführungen
- **Keine LLM-Freitext-Datenschutzerklärungen** — Regelengine + Templates
- **Keine Mobile-App-Scans**
- **Keine Browser-Extension** (bestehende `extension*/` Ordner: kein Pilot-Bezug, nicht weiterbauen)
- **Keine neuen AI-Agenten** ohne Pilotbedarf
- **Kein Real-Time-Browser-Probing** (Pilotkunden brauchen Wochen-Scan, nicht Live)
- **Kein C2PA-/Creator-Provenance** in dieser Phase
- **Kein Ledger-Anchoring** (Blockchain) für Evidence
- **Kein Marketplace** für Vendor-Listen
- **Keine White-Label-Domains**
- **Keine Multi-Region-Deployments** außerhalb EU
- **Keine Mehrsprachigkeit** über DE/EN hinaus
- **Kein SSO / SAML** (separater Use Case, kommt mit Enterprise Phase)
- **Keine Slack-/Teams-Integrationen**, auch wenn 1 Tag Arbeit

## Compliance-Claims

- **Kein „ISO 27001 zertifiziert"**, solange nicht zertifiziert
- **Kein „SOC2"**, solange kein Type-II-Report existiert
- **Kein „TÜV-geprüft"** ohne tatsächlichen Prüfbericht
- **Kein „garantiert DSGVO-konform"** — die Konformität liegt beim Verantwortlichen
- **Kein „military-grade encryption"** (Werbe-Phrase ohne technische Bedeutung)
- **Kein „autonomous compliance"** — nichts ist autonom
- **Kein „unbreakable" / „tamper-proof"** — wir sagen „kryptographisch verifizierbar"
- **Kein „AI magic" / „self-healing"** / „intelligent" als Marketing-Adjektiv

## Pilot-Operativ

- **Keine Gratis-Piloten** (Ausnahme: erster Beta-Pilot als Referenz, dokumentiert)
- **Keine Piloten ohne AVV-Anhang**
- **Keine Custom-Anpassungen pro Pilot** (Logo/Name OK, mehr nicht)
- **Keine NDA-Verhandlungen** über 1 Stunde hinaus (Standard-NDA oder kein Deal)
- **Keine Piloten mit < 3 Mandanten-Websites** (kein Use-Case-Fit)

## Technik / Architektur

- **Keine neuen Microservices** ohne klaren Pilot-Trigger
- **Keine DB-Migration, die RLS bricht**
- **Keine Service-Role-Keys im Client-Code**
- **Keine neuen Drittlandtransfers** (US-CDN, US-Logging, US-Hosting)
- **Keine neue Programmiersprache** für den Stack
- **Keine eigene Container-Plattform** — Hetzner / Supabase reicht
- **Kein eigener AI-Modell-Hosting** über das bestehende Ollama-Setup hinaus
- **Keine GraphQL-Layer**, solange REST + Supabase Client reichen
- **Keine Mobile-Apps** (iOS/Android)

## Scope-Erweiterungs-Verfahren

Wenn ein Pilot ein Feature aus dieser Liste verlangt:

1. Schriftliche Anforderung (E-Mail/Call-Protokoll) festhalten
2. Eintrag in `docs/pilot/scope-requests.md` mit:
   - Pilot-Name
   - Datum
   - Anforderung wörtlich
   - „Make or break" — würde der Pilot ohne abspringen?
3. Entscheidung im Wochen-Review (max. 7 Tage Latenz)
4. Bei Aufnahme: Eintrag aus dieser `non-goals.md` entfernen + Begründung committen

Ohne diesen Pfad: keine Erweiterung. Auch wenn es 1 Tag dauert.
Auch wenn es „cool" wäre. Auch wenn es im Backlog steht.
