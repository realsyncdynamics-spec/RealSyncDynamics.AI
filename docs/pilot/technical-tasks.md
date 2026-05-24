# Priorisierte technische Aufgabenliste

Reihenfolge ist bindend. Ein Task wird erst gestartet, wenn der vorherige
abgeschlossen ist. „Abgeschlossen" = Tests grün, gemerged, deployed.

Format: `[Prio] · [Größe S/M/L] · [Owner] · Titel`

---

## P0 — Pilot-Readiness (Wochen 1–2)

### P0.1 · S · Eng — `realsync-cli` Smoke-Gate fixieren
- `python -m realsync.cli verify data/sample_bundle.json` → exit 0
- `python -m realsync.cli verify data/tampered_bundle.json` → exit 1
- `python -m realsync.cli replay data/sample_bundle.json` deterministisch
- CI-Workflow grün auf Python 3.10 / 3.11 / 3.12 (bestehend)
- Quelle: `tools/realsync-cli/`

### P0.2 · S · Eng — Landing-Section „Agenturen mit mehreren Mandanten"
- Eine `<section>` in `src/pages/AgenciesLanding.tsx` (nicht neue Page)
- Headline, 1 Absatz, 1 CTA → `/agency-pilot` (oder Formular)
- Keine Hype-Sprache, siehe `docs/pilot/agency-pilot-one-pager.md`
- Inhalt aus `outreach.md` + One-Pager 1:1

### P0.3 · S · Ops — Stripe-Pilot-Produkt + Preise
- Product: „RealSync Agency Pilot"
- Price A: 499 € einmalig (5 Sites)
- Price B: 1.500 € einmalig (bis 20 Sites)
- Price C: 299 €/Monat × 3 (Sub mit 3-Zyklen-Cap)
- Stripe-Link-Test mit Test-Karte, EU-MwSt aktiviert
- Quelle für Schema: `docs/stripe-pricing-seed.template.sql`

### P0.4 · S · Legal — Pilot-Vertrag + AVV-Anhang (1-Seiter)
- Standardvertrag (Hetzner DE, kein Drittland)
- AVV gemäß Art. 28 DSGVO
- Anwalts-Sign-off vor erstem Pilot

### P0.5 · S · Eng — Repository-Hygiene
- README im `tools/realsync-cli/` final (Doku-Pass)
- `metadata.json` aktualisieren (kurze Pilot-Erwähnung optional)
- Branch-Protection auf `main` (aktuell offen?)

---

## P1 — MVP-Workflow (Wochen 3–6)

### P1.1 · M · Eng — Datenmodell `agency / client / site / scan / finding / evidence_bundle`
- Migration in `supabase/migrations/`
- RLS-Policies: jeder Read/Write auf `agency_id` des Auth-Users
- Cross-Tenant-Test als Vitest + Playwright

### P1.2 · M · Eng — Agency-Dashboard `/agency`
- Route in `App.tsx`
- Liste Mandanten / Sites / letzter Scan / Risiko / Report-Link
- Eine Tabelle, keine Charts
- Wiederverwendung der bestehenden Audit-Result-Komponenten

### P1.3 · M · Eng — Mandant- und Site-CRUD
- React-Forms (kein eigenes Form-Framework, bestehendes nutzen)
- Keine Bulk-Operationen in MVP

### P1.4 · M · Eng — Scan-Scheduler (wöchentlich)
- n8n-Workflow ODER Supabase Cron (entscheiden, was schneller geht)
- Triggers `audit-*` Edge Function pro `site` mit `active = true`
- Idempotent: doppelter Trigger pro Woche = ein Scan

### P1.5 · M · Eng — Findings-Priorisierung
- Regel-Tabelle `services/governance/severity.ts`
- Eingabe: `finding_type, pre_consent, vendor_known, missing_required`
- Ausgabe: `low / medium / high / critical`
- Vitest-Cases pro Eingabekombination

### P1.6 · M · Eng — Report-Renderer (PDF + Markdown)
- Wiederverwendung `src/pdf/`
- Cover je Mandant + Agentur-Logo
- Pro Site eine Seite: Findings, Severity-Verteilung, Empfehlungen
- Anhang: Evidence-Bundle-Hash

### P1.7 · S · Eng — Evidence-Bundle-Export
- Bestehende `src/core/runtime/evidence.ts` → SPEC-001-JSON-Datei
- Download-Endpoint (signiert, kurzlebig)
- `realsync-cli verify` auf jedem exportierten Bundle = PASSED (E2E-Test)

### P1.8 · S · Eng — Detection-Coverage-Pass
- Pre-Consent-Tracking-Detection härten
- `known_vendors.json` initialisieren (Top 100 Trackers/CDNs)
- `known_ai_widgets.json` initialisieren (Intercom, Drift, Tidio, Crisp, …)

---

## P2 — Pilotbetrieb (Wochen 7–10)

### P2.1 · S · Eng — Pilot-Onboarding-Doku
- `docs/pilot/onboarding.md`
- Schritt-für-Schritt für nicht-technische Pilot-User

### P2.2 · S · Eng — False-Positive-Review-UI
- Pro Finding: „Falsch positiv markieren" + Begründungs-Feld
- Aggregation pro Tenant in Whitelist persistieren
- Wiederkehrender Scan respektiert Whitelist

### P2.3 · S · Eng — Wöchentlicher Re-Scan-Report-Versand
- Automatisierter E-Mail-Versand des Report-Links an Pilotkunden
- Kein Versand des Reports selbst per Mail (Link mit Auth)

### P2.4 · S · Eng — Findings-Diff zwischen Scans
- Welche Findings sind neu / geschlossen / unverändert?
- Anzeige im Dashboard und im Re-Scan-Report

### P2.5 · S · Eng — Status-Page intern
- `/internal/pilot-health`
- Scan-Erfolg, Scan-Dauer, Fehlerquote pro Pilot
- Nicht öffentlich

---

## P3 — Validierung & Lernen (Wochen 11–13)

### P3.1 · S · Eng — Pilot-Case-Study-Template
- `docs/pilot/case-studies/_template.md`
- Felder: Pilot, Mandanten-Anzahl, Top-Findings, Zeitersparnis, O-Töne

### P3.2 · S · Eng — Metrik-Dashboard intern
- `/internal/metrics`
- Werte aus `metrics.md` aggregiert
- Wöchentlicher Snapshot persistiert

### P3.3 · S · Eng — Pricing-Telemetrie
- Stripe-Events in DB spiegeln (`stripe_events` Tabelle, RLS)
- Conversion Outreach → Pilot → Abo nachverfolgbar

---

## Off-Scope (in `non-goals.md`, NICHT bauen)

- White-Label-Domains
- SSO/SAML
- Slack/Teams Webhooks
- Mobile-App-Scans
- Browser-Extension
- C2PA / Creator-Provenance
- Ledger-Anchoring
- Marketplace
- Mehrsprachigkeit > DE/EN
- ERP / Buchhaltung / CRM / IAM (alles aus `docs/PRODUCT_FOCUS.md` „Was wir nicht sind")
