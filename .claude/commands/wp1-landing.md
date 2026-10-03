---
description: WP1 Landing / schärfen (Kontrollschicht, Scan-CTA, Loop mit Learn=Coming Soon)
---

# WP1 — Landing `/` schärfen

> ## ⛔ Überholt — nicht mehr ausführen (Stand 2026-10-03)
>
> **Dieses Arbeitspaket ist erledigt und sein Ziel ist weggezogen.** Wer den
> Auftrag unten wörtlich ausführt, baut gegen eine Seite, die nicht mehr `/` ist,
> oder überschreibt eine spätere Entscheidung.
>
> | Datum | Commit | Was |
> |---|---|---|
> | 2026-09-27 | `6523ac2` (#1673) | WP1 **vollständig umgesetzt** — auf `/`, das damals `DesignGovernanceAiLanding` war |
> | 2026-09-28 | `7a8fa8b` (#1686) | `/` wird auf `LandingV2` umgestellt |
>
> Die WP1-Arbeit liegt seither auf `/design/governance-ai`. Der gesamte
> „Bestand"-Abschnitt unten (`DesignGovernanceAiLanding.tsx`,
> `GovernanceOsHero.tsx`, `HomepageBriefSections.tsx`) beschreibt diese
> Referenzroute, nicht die Startseite.
>
> **E-F3 ist damit abgelöst** (Entscheidung 2026-10-03, siehe `PLAN.md` §3). Die
> Startseite trägt die Headline aus dem Landing-v2-Handoff und die
> Sechs-Stufen-Schleife `Discover → Assess → Govern → Execute → Verify → Prove`
> — letztere ausdrücklich als „Entscheidung Dominik, 28.09.2026" im Code
> vermerkt, also **einen Tag nach** E-F3. Die frühere Entscheidung durch die
> spätere zu ersetzen wäre ein Rückschritt, nicht eine Umsetzung.
>
> Was auf dem heutigen `/` gemessen wurde (2026-10-03, `main` @ `ac1815d`):
>
> | Akzeptanzkriterium | Stand | Beleg |
> |---|---|---|
> | CTA führt auf `/audit` | ✅ erfüllt | `checkoutHrefForPlan('free')` → `/audit?source=landing-v2-hero` |
> | Loop sichtbar | ✅ erfüllt | `LV2_PIPELINE`, sechs Stufen |
> | Kein Overclaim | ✅ erfüllt | `npm run check:landing-claims` grün (7 Phrasen, 20 Items) |
> | Hero nennt Kontroll-/Nachweisschicht | ❌ bewusst nicht | H1 = „AI Compliance Operations OS for Europe" |
> | Learn als COMING SOON | ❌ bewusst nicht | Stufe existiert in Landing v2 nicht |
>
> Die beiden offenen Punkte sind **keine Lücken mehr, sondern die getroffene
> Entscheidung**. Eine Landing-Änderung braucht eine neue Freigabe und ein neues
> Arbeitspaket — nicht dieses.
>
> Der Auftrag bleibt unverändert stehen, weil er dokumentiert, was #1673
> umgesetzt hat. Als Anweisung gilt er nicht mehr.

**Voraussetzung:** ~~✅ E-F3 entschieden (2026-09-27)~~ → **abgelöst 2026-10-03** · **Branch (historisch):** `feat/wp1-landing-control-layer`
**Freigabe:** Landing-Claims = Einzel-Freigabe im PR

## Rahmen (gilt für jede WP-Session)

Repository: realsyncdynamics-spec/RealSyncDynamics.AI
Lies zuerst: CLAUDE.md, .claude/os-funnel/PLAN.md (§1 Ist-Befund, §5 Leitplanken).

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

Ziel: Die Landing erklärt in 5 Sekunden: RealSyncDynamics.AI ist die Kontroll- und
Nachweisschicht für KI im Unternehmen. Einstieg ist der kostenlose Scan. Das AI
Governance OS ist das Zielbild — ehrlich als solches markiert.

Bestand (nicht neu bauen):
- src/pages/design/DesignGovernanceAiLanding.tsx (Sektionsreihenfolge)
- src/components/landing/GovernanceOsHero.tsx
- src/components/governance-frontend/hero-content.ts (HERO_SCAN_CTA_LABEL u. a.)
- src/components/landing/HomepageBriefSections.tsx (Architecture/Value/Executive/Principles)
- src/config/public-nav.ts: PUBLIC_CTA zeigt bereits auf /audit — Ziel NICHT ändern.

Aufgaben:
1. Hero-Copy
   Headline (verbindlich, E-F3): „Die Kontrollschicht für KI im Unternehmen."
   Keine Alternative, kein „Governance OS für KI-Agenten" als Headline.
   Subline: „RealSyncDynamics.AI macht sichtbar, welche KI-Systeme, Bots und Agenten
   im Einsatz sind, welche Daten sie nutzen, welche Regeln gelten und welche
   Nachweise entstehen."
   Primär-CTA: „Kostenlosen KI-/DSGVO-Scan starten" → PUBLIC_CTA.to (/audit)
   Sekundär-CTA: „Enterprise sprechen" → bestehender /contact-sales-Link
   Label-Änderung zentral in hero-content.ts bzw. public-nav.ts, nicht inline duplizieren.

2. Zielbild-Abschnitt „AI Governance OS" — bestehende Sektion wiederverwenden
   (ArchitectureSection oder GovernanceSystemStory), keine neue Komponente, wenn
   eine vorhandene die Struktur tragen kann.
   Inhalt: Control Loop Observe → Evaluate → Decide → Act → Verify → Record → Learn.
   „Learn / Governed Evolution" trägt Badge COMING SOON (STATUS_LABEL).
   Darunter der Einstiegspfad: Scan (live) → Governance Core (live) →
   kontrollierte Bots/Agenten (preview) → Agent OS Premium (coming soon).
   Satz: „Agenten dürfen handeln — aber nur innerhalb der Governance-Runtime."

3. Claim-Audit der Seite: jede Aussage gegen src/product/implementation-status.ts
   halten. Treffer für „revisionssicher", „garantiert", „autonom", „live" (bei
   nicht-live Features) auflisten und korrigieren.

Nicht tun: Tokens/Farben ändern, neue Sektionen neben bestehenden bauen, Preise
im Hero nennen, Routing ändern.

Akzeptanz:
- Hero nennt Kontroll-/Nachweisschicht, CTA führt auf /audit
- Loop sichtbar, Learn als COMING SOON
- Kein Overclaim laut Claim-Audit (Liste im PR)
- npm run lint grün; bestehende Landing-Tests grün
