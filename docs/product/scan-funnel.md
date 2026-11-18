# Public Scan Funnel & Landing IA

**Stand:** 2026-09-12  
**SSoT Runtime-Claims:** `src/product/implementation-status.ts`  
**Kanonischer Acquisition-Scan:** `/audit?domain=` (kein paralleler Scanner; Scan ≠ Produkt)

---

## Narrative (lock)

> RealSync erkennt, bewertet, steuert und dokumentiert Compliance kontinuierlich.

Nicht „wähle einen Check / hier sind viele Tools.“  
Position: Control/Policy/Audit/Evidence-Layer über Modelle und Agenten — **kein** Chatbot, **kein** Cookie-/Website-DSGVO-Scanner. Kein Complianty Visual Clone (kein Cyan/White/Purple).

**Hero (DE):** Erkenne, steuere und belege jede KI-Nutzung in deinem Unternehmen.  
**Subline:** Eine Governance- und Evidence-Schicht über ChatGPT, Claude, Agenten und internen AI-Workflows.  
**Slogan:** In Minuten scannen. In Stunden strukturieren. Dauerhaft kontrollieren.  
**EN kicker:** Govern every AI system in one control layer.

**Operating loop:** Detect → Analyze → Govern → Remediate → Evidence → Monitor  

**Product spine:** SCAN → DISCOVER → RISK → GOVERN → AUTOMATE → EVIDENCE → MONITOR → AUDIT → EXPAND  

Scan = **Acquisition only**. Danach: Risiken → Score → Governance Activation → Workspace / Policies / Remediation / Evidence / Monitoring.

---

## Header IA (Complianty pattern, unsere Inhalte)

| Group | Inhalt | Hinweis |
|---|---|---|
| Produkt ▾ | Runtime + AI / Privacy / Agent Governance + Evidence + Automation + Platform | Sections mit Live/Preview-Badges |
| Lösungen ▾ | Unternehmen, Agenturen, DPO, AI Teams, Enterprise, Entwickler | Echte Routen |
| Ressourcen ▾ | AI Act / DSGVO Guides, Docs, API, Security, Roadmap | Nur reale Routen |
| Unternehmen | About, Kontakt, Sicherheit, Impressum | |
| Preise | Starter/Growth/Agency + Enterprise Anfrage | Preise unverändert |
| Login | `/welcome` | |
| Primary CTA | `Governance kostenlos starten →` | nie Demo |

Agent Governance = **Preview** (Hub `/agent-governance`; Kernel-Slice #1331).

---

## Post-scan Choice Row — aktualisierter Owner-Auftrag 18.11.2026

1. **Frontend-Vorschau (primär, Preview)** → `/handwerk-website?source_url=…&audit_id=…`, Domain wird aus dem öffentlichen Scan vorausgefüllt; SiteOS-Analyse erfordert Login und Tenant.
2. **Governance ohne Redesign (Live-Einstieg)** → `/welcome?next=/app/activation`; der vorhandene Audit-Claim-/Tenant-Pfad bleibt maßgeblich.
3. **Fix-Plan** → `/onboarding/:id` bei Findings, sonst Optimizer Preview.
4. **Evidence-Export** → nach Login; kein automatischer, nicht nachgewiesener PDF-Export.

Auf der direkten Ergebnisroute `/audit/result/:auditId` ist ebenfalls der Website-Preview-Einstieg sichtbar.

### Verbindliche Reihenfolge

`/audit` → echtes Ergebnis → `/handwerk-website` (bestehende SiteOS-Funktionen `siteos/discover`, `siteos/runtime-scan`, `siteos/builder`) → Frontend-Vorschau → Angebot/Checkout → **optionale** Voice-Konfiguration (`/phonebot/start`) **oder** Governance (`/welcome?next=/app/activation`).

**Wichtig:** Die SiteOS-Vorschau ist nicht die fertig veröffentlichte Kundenwebsite. Der Website-Neubau ändert das bestehende Backend nicht. Ein öffentlicher URL-Scan kann weder Authentifizierungslogik noch beliebige fremde APIs, Payment-Integrationen, CMS oder Datenbanken automatisch übernehmen. Für einen Live-Cutover benötigt der Kunde eine geprüfte Integrationsmatrix, Einwilligungen/Berechtigungen, einen Staging-Regressionstest und einen Rollback.

Voice wird auf diesem Pfad nur optional zur Vorbereitung angeboten. Produktive Telefonie, Nummernprovisionierung und kaufbarer Standalone-Checkout bleiben bis zur nachgewiesenen E2E-Freigabe gesperrt. Es wird keine automatische Voice-Aktivierung vorgetäuscht.

### Release-Gates (alle obligatorisch, kein 100%-Marketingclaim)

- [ ] Öffentlicher Scan und echter Audit-Befund mit id, Domain, Coverage und Findings geprüft; schlechte/fehlgeschlagene Scans zeigen Fehler statt Erfolg.
- [ ] Audit-Permalink **und** /audit-Ergebnis führen mit derselben Domain auf SiteOS, ohne Findings in URLs zu leaken.
- [ ] Login → Rücksprung nach SiteOS ist korrekt; Tenant-Isolation und RLS durch Negativtests bestätigt.
- [ ] SiteOS-Discover, Runtime-Scan, Builder, sandboxed Preview und Checkout bestehen reale E2E-Tests auf Staging.
- [ ] Backend bleibt unverändert; vorhandene APIs/Login/Formulare/Payment sind inventarisiert, im Staging gegen das neue Frontend regressiongetestet oder ausdrücklich als nicht unterstützt markiert.
- [ ] Voice: Ja zeigt nur freigegebene Konfiguration, Nein geht zur Governance; kein Kauf/Anruf/Nummer ohne freigegebene, geprüfte Provisionierung.
- [ ] Governance übernimmt Nutzer, Tenant, Audit-Claim und Evidence ohne Cross-Tenant-Datenzugriff.
- [ ] Fehlerzustände, E-Mail-/Checkout-Abbruch, Consent, Security, Monitoring und Rollback auf Staging geprüft.
- [ ] Kein Produktionsdeploy bis CI + manuelle Go/No-Go-Prüfung erfolgreich abgeschlossen sind.

---

## Proof

Evidence **timeline** (nicht nur Score): Scan → Risk → Policy → Control → Evidence sealed → Hash.  
Labeled Preview ohne Fake-Timestamps/KPIs. Agent-Wedge: Action Request → … → Evidence.

---

## Out of scope

Chrome Extension, neue Stripe-Produkte, Sphere auf `/`, Preise senken, Complianty-Look.
