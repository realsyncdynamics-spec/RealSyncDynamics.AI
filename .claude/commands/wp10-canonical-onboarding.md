---
description: WP10 Ein kanonischer Onboarding-Pfad (Masterplan M1)
---

# WP10 — Kanonischer Onboarding-Pfad

**Voraussetzung:** Owner-Entscheid E-F5 (`/audit` als Scan-Einstieg) · **Branch:** `feat/wp10-canonical-onboarding`

## Rahmen (gilt für jede WP-Session)

Repository: realsyncdynamics-spec/RealSyncDynamics.AI
Lies zuerst: CLAUDE.md, docs/strategy/MASTERPLAN_2026-2027.md (nur §3 und den eigenen M-Punkt),
.claude/os-funnel/PLAN.md (§5 Leitplanken).

Ein Arbeitspaket pro Session. Eigener Branch von origin/main. Ein PR, Squash.

Verboten ohne separates GO:
- Deploy, Merge, Push auf main
- Supabase-Migration, Stripe-Änderung, Cloudflare/Worker/KV
- echte Provider- oder Agentenaktionen

Immer:
- Tenant nur über JWT user → memberships → tenant_id. Nie aus URL, Body, localStorage.
- Keine Service-Role im Browser.
- Keine Fake-KPIs. Fehlt eine Quelle: Empty State oder Preview-Label.
- Status nur aus src/product/implementation-status.ts: live · preview · coming-soon.
- Keine Claims „vollständig revisionssicher", „autonome Agenten live", „EU-konform garantiert".
- Design-Freeze auf /: keine Tokens umstylen.
- Nur die im WP genannten Dateien ändern. Keine Repo-weiten Refactors.

Prüfung: npm run lint · npm test (betroffene Suites). Nicht ausführbar → im PR begründen.

PR-Text: geänderte Dateien · wiederverwendete Strukturen · live · preview · coming soon · Checks.

## Auftrag

Befund: 6+ Einstiege nebeneinander (src/App.tsx):
- /audit → /onboarding/:scanId (GovernanceOnboarding, echter gdpr-audit-Scan)
- /welcome (src/pages/Welcome.tsx) → /setup-assistant (src/features/onboarding/SetupAssistant.tsx)
- /unified-entry/scan · /entscheidung · /preview · /trial-offer · /register
  (teils mit src/unified-entry/mock-data.ts)
- src/enterprise-os/pages/WelcomeWizardPage.tsx
- /app/activation (src/features/activation/GovernanceActivationView.tsx, persistiert in
  governance_activations)

Ziel: Genau ein Pfad
`/audit → Registrierung (/welcome) → Workspace + Firmenprofil → /app/activation → /app/dashboard`.

Aufgaben:
1. Ist-Analyse als Tabelle im PR: jeder Einstieg, Ziel nach Abschluss, Datenquelle
   (echt/Mock), Funnel-Events aus marketingAnalytics.ts.
2. Übrige Einstiege per <Navigate replace> auf den passenden Schritt des kanonischen Pfads
   (Query-Parameter wie scanId/plan erhalten). /unified-entry/transformation (Builder-Erstbau)
   NICHT anfassen.
3. Nach Registrierung: Wer noch kein Firmenprofil hat, landet auf dem Profilschritt;
   wer keine Activation hat, auf /app/activation; sonst /app/dashboard.
   Vorhandene Daten (save-company-profile, governance_activations) nutzen, nichts neu speichern.
4. Fortschrittsanzeige „Schritt n von 4" auf den Pfadseiten, ohne Tokens umzustylen.
5. Funnel-Events: scan_completed, signup_completed, profile_completed, activation_completed —
   nur über bestehende track.ts/marketingAnalytics.ts, nur nach Consent.
6. mock-data.ts nur löschen, wenn danach nichts mehr importiert.

Nicht tun: neue Tabellen/RPCs, Stripe-/Trial-Logik ändern (M6), Landing-Copy umschreiben.

Akzeptanz:
- Jeder alte Einstieg landet auf dem kanonischen Pfad (Unit-/e2e-Test pro Redirect)
- Neuer Nutzer kommt ohne toten Link von /audit bis /app/dashboard
- npm run build, npm run lint, npm test, check:landing-claims grün
