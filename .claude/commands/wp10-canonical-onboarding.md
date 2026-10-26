---
description: WP10 Ein kanonischer Onboarding-Pfad bis zum ersten Nachweis (Masterplan M1)
---

# WP10 — Ein Onboarding-Pfad

**Voraussetzung:** Owner-Entscheid E-F5 (Empfehlung: `/audit` als Scan-Einstieg) · **Branch:** `feat/wp10-canonical-onboarding`

## Rahmen (gilt für jede WP-Session)

Repository: realsyncdynamics-spec/RealSyncDynamics.AI
Lies zuerst: CLAUDE.md, docs/strategy/MASTERPLAN_2026-2027.md (§3 Must-haves, §8 Owner-Entscheidungen).

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
- Nur die im WP genannten Dateien ändern. Keine Repo-weiten Refactors.

Prüfung: npm run lint · npm test (betroffene Suites) · npm run build. Nicht ausführbar → im PR begründen.

PR-Text: geänderte Dateien · wiederverwendete Strukturen · live · preview · coming soon · Checks.

## Auftrag

Befund (26.10.2026): Nach der Registrierung gibt es mindestens sechs Wege:
`Welcome.tsx` → `/setup-assistant`, `/unified-entry/*` → `PostRegisterOnboardingPage`,
`/audit` → `/onboarding/:scanId`, `/flow/*`, `/app/onboarding` (`OnboardingView`), `/app/activation`.
`src/unified-entry/mock-data.ts` wird noch genutzt.

Ziel-Pfad:
`/audit` (Scan) → `/welcome` (Registrierung, `?next=` bleibt) → Workspace + Firmenprofil
(`save-company-profile`, `claimPendingAudit`) → `/app/activation` (KI-Systeme erfassen) → `/app/dashboard`.

Aufgaben:
1. Ist-Fluss je Einstieg als Tabelle im PR dokumentieren (Route, Datei, schreibt in, endet bei).
2. `Welcome.tsx`: Ziel nach Registrierung ohne `next` und ohne `onboarded_at` = `/app/activation`
   statt `/setup-assistant`. SetupAssistant-Schritte, die Activation nicht abdeckt, dorthin übernehmen oder als Lücke melden.
3. Überzählige Einstiege per `<Navigate replace>` in `src/App.tsx` auf den Zielpfad, Query-Parameter erhalten.
   Keine Seiten löschen, nur umleiten.
4. Fortschrittsanzeige „Schritt x von 4“ in Activation, Zeitstempel für Time-to-First-Evidence
   über `src/lib/marketingAnalytics.ts` (nur nach Consent).
5. e2e-Spec: Scan → Registrierung → Activation → Dashboard.

Nicht in diesem WP: neues Design, Migrationen, Entfernen von `mock-data.ts` (WP11).
