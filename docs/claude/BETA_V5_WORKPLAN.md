# Arbeitsplan Beta + Landing v5 — für Claude Code (token-sparend)

Stand 13.10.2026 · Owner: Dominik Steiner · Branch-Basis: `feat/landing-v5-beta`

## Regeln für jede Session (Token-Budget)

1. **Ein Arbeitspaket (WP) = eine Session = ein PR.** Nie zwei WPs mischen.
2. Prompt-Vorlage: `Lies nur docs/claude/BETA_V5_WORKPLAN.md Abschnitt WP-X und die dort genannten Dateien. Setze WP-X um, Tests, PR.`
3. **Nur die genannten Pfade öffnen.** Kein Glob über `src/`, kein Lesen von Lockfiles, `*.generated.ts`, `docs/` (außer dieser Datei), `.archive/`.
4. Suchen per `grep -n` mit Zeilennummern, dann gezielt `Read offset/limit` — nie ganze 1.000-Zeilen-Dateien.
5. Tests nur für betroffene Dateien: `npx vitest run <pfad>`; `npx tsc --noEmit` einmal am Ende.
6. `.mcp.json` leer lassen (Website-Session). Supabase-MCP nur in WP-3/WP-5 bewusst eintragen.
7. Merge und Deploy: separate Freigabe durch Dominik. Migrationen, Preise, Rechtstexte, Landing-Claims: Einzel-Freigabe.

## WP-1 — Landing v5 + Beta-Frontend ✅ (dieser Branch, fertig)

- `/` = `src/pages/LandingV5.tsx` (v2-Design/Hero/Buttons, v4-Texte via i18n `v4Hero*`, `LOOP_NODES`)
- Echte 3D-Szene `src/components/landing/v5/heroEuropeNetwork3D.ts` (three.js, lazy, Reduced-Motion, Fallback-Bild)
- Beta-Schalter `src/config/beta.ts` (`VITE_BETA_PHASE=off` beendet alles)
- `/checkout/:planKey` → Starter/Growth/Agency leiten in der Beta auf `/welcome?beta=1&plan=…&next=/app/dashboard` (`?purchase=1` = bewusster Kauf)
- Dashboard-Hinweis `src/components/governance-os/BetaAppBanner.tsx`
- Roadmap-Sektion liest nur `src/product/implementation-status.ts`
- v4 bleibt unter `/design/landing-v4`, v2 unter `/design/landing-v2`
- Tests: `test/landing/landing-v5-beta.test.tsx`, `test/landing/design-landing-previews.test.ts`

**Offen in WP-1 (klein):** `implementation-status.ts` Eintrag `public-landing` auf v5 umschreiben (Claim-Freigabe!), `CLAUDE.md`-Absatz „Startseite“ auf v5 ändern.

## WP-2 — Restliche Landing-Texte auf v4-Wortlaut

Dateien: `src/components/landing/v2/LandingV2Sections.tsx`, `PricingV2.tsx`, `LandingV2Footer.tsx`, Quelle `src/components/landing/v4/landing-v4-content.ts` + `src/i18n/handoff.ts` (nur `v4*`-Schlüssel greppen).
Ziel: Jede v2-Sektion bekommt den klaren v4-Text (Nicht-Techniker), Struktur/Design bleiben. Kein neuer Claim ohne Eintrag in `implementation-status.ts`. `npm run check:landing-claims` muss grün sein.

## WP-3 — Beta-Zugang serverseitig (Claims = Runtime)

Problem: Das Frontend sagt „alle Funktionen kostenlos testen“ — die Plattform muss das wirklich gewähren.
- Edge Function `beta-enroll` (verify_jwt **an**): Tenant aus authentifiziertem Principal (nie aus Body/URL), setzt über den **bestehenden Tenant-Entitlement-Pfad** `subscriptions.plan_key='growth'`, `status='trialing'`, `current_period_end=2027-01-31`, `source='beta'`. Idempotent. Kein Stripe.
- Migration (additiv, Einzel-Freigabe): Spalte `subscriptions.source text` falls fehlend; `beta_enrollments(tenant_id pk, enrolled_at, plan_key, ends_at)`.
- Frontend: `/welcome` ruft nach Login bei `?beta=1` `beta-enroll` auf, dann `next`.
- Ablauf 31.01.2027: Cron setzt `status='expired'` → bestehender Payment/Downgrade-Pfad. 14 Tage vorher Mail.
- Tests: Entitlement-Parität (`npm run check:entitlements`), Tenant-Isolation (RLS).

## WP-4 — Dashboard „echt“ für Beta-Tester

Dateien: `/app/dashboard` → `DashboardRouter` (per grep lokalisieren), `scripts/seed-beta-tenant.ts` als Vorlage.
- Leerer Mandant ⇒ geführter Erststart: Domain eintragen → Scan → Befunde erscheinen (echte Daten, keine Demo-Zahlen).
- Optional „Beispieldaten laden“ (klar als Beispiel markiert, per Edge Function, löschbar).
- Jede Kachel: echter Wert oder ehrlicher Leerzustand mit Aktion. Keine statischen Mock-Werte im App-Bereich.
- Feedback-Button (statt `/kontakt?topic=beta-feedback`): Tabelle `beta_feedback` (tenant_id, user_id, route, text, created_at, RLS), Admin-Ansicht.

## WP-5 — Agent-Credits (Abrechnung agentischer Aktionen)

Basis vorhanden: `token_tracking`, `tenant_cost_ledger`, `agent_runs_metering`, `stripe_meter_sync` (Migrationen 2026-05…07). Nichts neu erfinden, darauf aufbauen.
- Einheit **Credit** (eigene Leistungseinheit, *nicht* „Claude-Token weiterverkaufen“ — siehe Pricing-Analyse).
- Preis-Tabelle `credit_rates(action_type, model, credits)` in `shared/pricing.ts`-SSoT + Sync-Check.
- Jede Agent-Aktion: Vorab-Schätzung → Budget-Check (Tenant-Limit) → Ausführung → Ist-Verbrauch ins Ledger → Stripe-Meter.
- Beta: Freikontingent pro Tenant/Monat (Kostendeckel), danach Stopp mit Hinweis, kein Überziehen.
- Dashboard: Verbrauchsanzeige (heute / Monat / Rest), Export.

## WP-6 — GitHub-Infrastruktur

- Issue-Form `.github/ISSUE_TEMPLATE/beta-feedback.yml` (intern, für Team-Triage aus `beta_feedback`).
- Labels: `beta`, `beta-feedback`, `wp-1`…`wp-6`, `automerge` (nur per Label).
- `ci.yml`: Job „landing-v5“ = `vitest run test/landing` + `check:landing-claims` + `tsc`.
- Preview-Deploy pro PR (Cloudflare Pages Preview, bestehender Workflow `deploy-cloudflare-pages.yml`) + Lighthouse (bestehend).
- Branch-Ziel ≤ 7 offene Branches/PRs bleibt.

## WP-7 — Roadmap-Seite & Pricing-Seite auf Beta

- `/roadmap`: Beta-Meilensteine (Start, Feedback-Runden, Ende 31.01.2027, Preise ab Feb. 2027) aus einer Konstante in `src/config/beta.ts`.
- `/pricing`: Enterprise mit Preis sichtbar (SSoT `shared/pricing.ts`, 1.249 €), Beta-Hinweis über allen Self-Service-Plänen, Credits-Tabelle (nach WP-5).

## Reihenfolge

WP-1 (PR) → WP-3 → WP-4 → WP-2 → WP-6 → WP-5 → WP-7. WP-3 ist Pflicht, bevor die Beta öffentlich beworben wird (sonst Claim ohne Runtime).
