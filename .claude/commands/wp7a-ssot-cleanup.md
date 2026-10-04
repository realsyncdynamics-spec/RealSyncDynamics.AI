---
description: WP7a SSoT-Bereinigung vor dem Landing-v4-Port (Bot-Status, toter PLANS-Export, SSO/SCIM/On-Prem, Hostinger-Roadmap)
---

# WP7a — SSoT-Bereinigung vor dem Port

**Voraussetzung:** keine für Aufgabe 1 und 2. Aufgabe 3–5 erst nach der jeweiligen
Entscheidung (PLAN §3: E-V7, E-V8, E-V9). Offene Entscheidung → Aufgabe auslassen und
im PR als „wartet auf E-V…" führen.
**Branch:** `fix/wp7a-ssot-cleanup`

## Rahmen (gilt für jede WP-Session)

Repository: realsyncdynamics-spec/RealSyncDynamics.AI
Lies zuerst: CLAUDE.md, .claude/os-funnel/PLAN.md (§1 B12/B13, §3, §5),
.claude/os-funnel/landing-v4-review.md (§2, §3).

Ein Arbeitspaket pro Session. Eigener Branch von origin/main. Ein PR, Squash.

Verboten ohne separates GO:
- Deploy, Merge, Push auf main
- Supabase-Migration, Stripe-Änderung, Cloudflare/Worker/KV
- Rechtstexte (Datenschutz, Unterauftragsverarbeiter, AGB, Impressum) — das ist H2

Immer:
- Status nur aus src/product/implementation-status.ts: live · preview · coming-soon.
- Im Zweifel untertreiben (Regel aus `platform-capabilities.ts`).
- Nur die im WP genannten Dateien ändern.

Prüfung: npm run lint · npm test (betroffene Suites). Bei `shared/pricing.ts`:
`npm run sync:pricing && npm run check:pricing && npm run check:offer-prices`.

PR-Text: geänderte Dateien · wiederverwendete Strukturen · live · preview · coming soon · Checks.

## Auftrag

1. **Bot-Laufzeit — eine Wahrheit.** `platform-capabilities.ts` führt „Bot-Laufzeit — Chat,
   WhatsApp, Telefon" als `live` (Messung 23.08.: Functions deployt),
   `implementation-status.ts` `channel-bots` als `preview` („volle Provider-Laufzeit noch
   Preview"). Beides misst Verschiedenes. Regel: `live` erst, wenn eine echte Nachricht über
   den Provider-Pfad beantwortet wurde — Messung mit Datum im Kommentar. Ohne Messung beide
   auf `preview`/`building`. `test/landing/platform-capabilities.test.ts` mitziehen.
2. **Toter Preis-Export.** `src/content/runtimeVocab.ts` exportiert `PLANS` (Free ·
   Monitoring 49 € · Governance 199 € · Partner) — nirgends importiert, aber eine Quelle für
   Preis-Drift (der Claude-Design-Export hat aus dieser Datei zitiert). Entfernen; Test, dass
   `runtimeVocab.ts` keine Preise mehr exportiert.
3. **E-V7 On-Prem / SCIM** (nur nach Entscheidung): `GovernanceFooter.tsx` („SSO, On-Prem,
   Custom-DPA, Behördenvertrag"), `src/config/seo.ts` („On-Premise-Option" für Behörden und
   EduTech), `EnterpriseKonfigurator.tsx` („SSO / SCIM gegen Ihr Verzeichnis").
4. **E-V8 Enterprise-SSO** (nur nach Entscheidung): `shared/pricing.ts` Enterprise —
   `outcomeHeadline` „… mit SLA und SSO", Feature „Single Sign-On" — auf
   „Single Sign-On (Preview, auf Anfrage)". Beleg: `TenantAdminConsole.tsx` (SSO Vorschau,
   kein SSO/SCIM-Build). Katalogänderung = Einzel-Freigabe.
5. **E-V9 Hostinger-Roadmap** (nur nach Entscheidung): `implementation-status.ts`
   `agent-os-hostinger-workers` streichen oder neu fassen;
   `test/core/realsync-os/agent-os-slice.test.ts` mitziehen.

## Nicht tun

Rechtstexte (H2) · Landing-Komponenten (WP7) · Preise ändern · neue Status-Werte erfinden.
