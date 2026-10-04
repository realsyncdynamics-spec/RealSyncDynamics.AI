---
description: WP7 Landing v4 auf / — #1742 nach E-V1–E-V4 fertigstellen (Optik aus dem Export, Inhalte aus dem SSoT)
---

# WP7 — Landing v4 auf `/` fertigstellen

**Voraussetzung:** E-V1–E-V4 ✅ (2026-10-04). Vorher gemergt: #1748 (USt/Bruttopreise),
#1750 (VPS-Claims); empfohlen #1744 (Control-Room-Fake-KPIs). WP7a-Teile, die Inhalte
ändern (Bot-Status, SSO-Wortlaut), möglichst vorher.
**Branch:** `claude/new-session-nqc4y8` — das ist **#1742**. Kein neuer Parallel-PR.

## Rahmen (gilt für jede WP-Session)

Repository: realsyncdynamics-spec/RealSyncDynamics.AI
Lies zuerst: CLAUDE.md, .claude/os-funnel/PLAN.md (§1 B12/B13, §3 E-V1–E-V9, §5),
.claude/os-funnel/landing-v4-review.md.

Ein Arbeitspaket pro Session. Ein PR (#1742), Squash.

Verboten ohne separates GO:
- Deploy, Merge, Push auf main
- Supabase-Migration, Stripe-Änderung, Cloudflare/Worker/KV, CSP-Änderung
- Änderungen an `shared/pricing.ts` und an Rechtstexten

Immer:
- Keine Fake-KPIs. Fehlt eine Quelle: Empty State oder Preview-Label.
- Status nur aus src/product/implementation-status.ts: live · preview · coming-soon.
- Keine Claims „vollständig revisionssicher", „autonome Agenten live", „EU-konform garantiert".
- Nur die im WP genannten Dateien ändern. Keine Repo-weiten Refactors.

Prüfung: npm run lint · npm test (betroffene Suites). Nicht ausführbar → im PR begründen.

PR-Text: geänderte Dateien · wiederverwendete Strukturen · live · preview · coming soon · Checks.

## Ausgangslage (#1742, Stand 2026-10-04)

Richtig und bleibt: `LandingV4.tsx` rendert Header/Hero neu und darunter die geprüften
v2-Sektionen (Preise aus der SSoT, FAQ = JSON-LD-Quelle); Statusleiste ohne
„operational"; Hero-Bild `/europe-globe.*` (Europa sichtbar, WebP 120 KB) mit
`fetchPriority="high"`; nur Dunkel; CTAs in bestehende Routen; CLAUDE.md auf v4.

## Auftrag

1. **Rebase** auf aktuelles `origin/main` (`npm run sync:main`).
2. **Kette (E-V2):** `LV4_PIPELINE` = `LV2_PIPELINE` (sechs Stufen), nicht die Namen aus
   `LV2_LIFECYCLE`. `LifecycleGrid` bildet keine eigene Vier-Schritt-Kette: Kicker der vier
   Karten auf die sechs Stufen abbilden — „Discover" · „Assess" · „Govern · Execute" ·
   „Verify · Prove". Kommentar in `landing-v4-content.ts` korrigieren.
3. **Free-Spalte (E-V3):** `PricingV2` zeigt `free` vor Starter/Growth/Agency/Enterprise;
   Texte und CTA aus `shared/pricing.ts` (`free_audit`), CTA nach
   `/audit?source=landing-v4-pricing`. Layout für fünf Karten prüfen (Desktop, Tablet, Mobil).
4. **CTAs:** Sekundär-CTA heißt „Demo-Dashboard ansehen" (Ziel `/demo-tour/dashboard` —
   es ist eine Demo, kein Live-Dashboard). Optional als Primär-Einstieg ein URL-Feld mit
   `auditPathFor(value, 'landing-v4-hero')` aus `src/features/audit/auditPrefill.ts`;
   dann ersetzt es den Primär-Button, nicht zusätzlich.
5. **Marke:** Logo-Text aus `LV4_BRAND` (eine Schreibweise), nicht hart „RealSync Dynamics.AI".
6. **Claims in den wiederverwendeten Sektionen** gegen Runtime prüfen und nur Belegtes sagen:
   - `LV2_LIFECYCLE`: „KI-Inventar in Echtzeit … Schatten-KI über … SaaS-Integrationen" und
     „Policies zur Laufzeit … setzt Kontrollen direkt im Request-Pfad durch" — PEPs laufen
     im Repo-Default `shadow`; Durchsetzung nur nennen, wo sie belegt aktiv ist.
   - Hero-Unterzeile: keine Daueraussage („continuous …"), solange
     `continuous-domain-monitoring` coming-soon ist.
   - FAQ „Ausschließlich in der EU …": präzise fassen (Datenbank, Auth und Edge Functions bei
     Supabase in Frankfurt; weitere Auftragsverarbeiter → `/legal/sub-processors`).
     **Wortlaut Dominik vorlegen** (Landing-Claim).
7. **Optik aus dem Export — nur Werte:** Serif-Display, Champagner-Gold-Verlauf, Abstände,
   Sektionsrhythmus. Höchstens drei Schriftfamilien, self-hosted. Ein Token-Block in
   `landing-v4.css`. Keine Google-Preconnects, keine CDN-Requests, kein Inline-Script.
8. **PR-Text #1742 korrigieren:** Der offene Punkt „HRB-Nummer im Impressum fehlt noch"
   ist gegenstandslos — Einzelunternehmen, kein HR-Eintrag (`company.ts`). „Bundle-Prompt:
   exakte Werte nachziehen" gilt nur für Optik.

## Nie aus dem Export übernehmen

Footer-Firmenangaben (GmbH/HRB Berlin) · absolute Links auf `realsyncdynamics.ai` ·
99,9-%-SLA · Seal-Line/Chain-Height (#1352) · HUD-Werte (Risk Score, „EU AI Act READY",
„Monitoring Live") · „6 Policy Packs" · „Drift in Echtzeit" · „Alle Daten in Europa" ·
„Volle Konformität" · „Enforcement statt Empfehlung" · SCIM · On-Prem · Städte-Knoten ·
„Deutsche Ingenieurskunst" · Zufalls-Hashes · Theme-Schalter · 3D-Erde (→ WP7b).

## Nicht tun

3D-Erde (WP7b, eigenes GO nach Lighthouse-Messung) · neue Routen · Änderungen an
`shared/pricing.ts`, Rechtstexten oder der CSP · Roadmap-Seite umbauen.

## Prüfung

- `npm run lint` · `npm run check:context` · `npm run check:offer-prices`
- Vitest: `landing-v4`, `landing-v2`, `design-landing-previews`, `pages-reachable`,
  `handoff-screens`, `homepage-hero`, `landing-infrastructure-claims`
- Playwright gegen den Cloudflare-Preview-Deploy: keine CSP-Verletzung, alle CTA-Ziele
  liefern 200, Anker `#produkt` · `#evidence` · `#preise` treffen, kein Text aus der
  „Nie übernehmen"-Liste im DOM, Lighthouse mobil LCP < 2,5 s.
