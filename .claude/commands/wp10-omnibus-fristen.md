---
description: WP10 Fristen-Texte auf Omnibus-Stand (VO 2026/1744) + CI-Guard
---

# WP10 — AI-Act-Fristen nach Digital Omnibus

**Voraussetzung:** keine (Phase 0) · **Masterplan:** §2a, §3 M8 · **Branch:** `fix/wp10-omnibus-fristen`

## Rahmen (gilt für jede WP-Session)

Repository: realsyncdynamics-spec/RealSyncDynamics.AI
Lies zuerst: CLAUDE.md, docs/strategy/MASTERPLAN_2026-2027.md (nur den genannten Abschnitt),
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

Befund: In src/pages, src/components/landing und public/llms.txt stehen ca. 20 Stellen mit
„August 2026" / „02.08.2026" als Hochrisiko-Stichtag. Nach VO (EU) 2026/1744 gilt:

| Thema | Frist |
|---|---|
| Art. 4 KI-Kompetenz | seit 02.02.2025 (unverändert) |
| Art. 50 Transparenz | seit 02.08.2026; Bestandssysteme Art. 50(2) bis 02.12.2026 |
| Neue Verbote Art. 5 | ab 02.12.2026 |
| Hochrisiko Anhang III | 02.12.2027 (statt 02.08.2026) |
| Hochrisiko Anhang I | 02.08.2028 (statt 02.08.2027) |

Vor dem Ändern: Fristen gegen den Amtsblatt-Text (ABl. 24.07.2026) prüfen. Weicht etwas ab,
gilt das Amtsblatt, und die Abweichung kommt in den PR-Text.

Aufgaben:
1. SSoT: `src/config/aiActDeadlines.ts` mit den Fristen oben (ISO-Datum, Artikel, Kurztext,
   Quelle 'VO (EU) 2026/1744'). Texte, die eine Frist nennen, importieren daraus, wo es ohne
   Umbau geht. Reine Copy-Strings dürfen literal bleiben.
2. Alle Fundstellen finden: `grep -rnE "08\.2026|August 2026|2\. August|02\.08\.2027"`
   in src/pages, src/components, src/config/seo.ts, public/llms.txt, Branchen-Landings,
   AI-Act-Klassifizierer (nur Texte, keine Regel-Logik). Jede Stelle korrigieren:
   kein „Pflicht seit August 2026" für Hochrisiko mehr. Art. 50 seit 02.08.2026 bleibt korrekt.
3. scripts/check-landing-claims.mjs erweitern: Liste veralteter Fristen-Muster
   (z. B. Hochrisiko + 2026-08-02, Anhang I + 2027-08-02) → CI-Fehler mit Datei:Zeile.
   Liste in src/product/implementation-status.ts oder aiActDeadlines.ts, nicht im Script hartkodiert.
4. Klassifizierer: nur Anzeige-Texte zu Fristen anpassen. Ob Art.-5-Verbote ab 02.12.2026
   neue Regeln brauchen, im PR als offenen Punkt notieren (eigenes WP).

Nicht tun: Rechtstexte (Impressum, Datenschutz, AGB) ändern → Owner-GO. Keine neuen Claims.
Kein Redesign.

Akzeptanz:
- `grep` nach Hochrisiko + August 2026 in Scope-Dirs: 0 Treffer
- npm run check:landing-claims grün; schlägt fehl, wenn ein altes Muster wieder eingefügt wird (Test/Fixture)
- npm run check:fabrication grün, npm run build grün
- PR listet jede geänderte Fundstelle (Datei, alt → neu)
