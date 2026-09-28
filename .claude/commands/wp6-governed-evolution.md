---
description: WP6 Governed-Evolution-Spec belegen (nur Doku)
---

# WP6 — Governed Evolution (nur Spec)

**Voraussetzung:** keine · **Branch:** `docs/wp6-governed-evolution`

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

Ziel: .claude/os-funnel/governed-evolution.md prüfen, gegen den Code-Bestand
(governance_approvals, Evidence-Chain, pdp_shadow_log, governance_policies)
abgleichen und offene Punkte markieren. KEIN Code.

Aufgaben:
1. Jede Tabelle/Function, die die Spec als „vorhanden" nennt, im Repo belegen
   (Pfad + Migration). Nicht belegbar → als „fehlt" markieren.
2. Den Abschnitt „Änderungsraum" gegen Art. 3 Nr. 23 und Art. 43 Abs. 4
   EU AI Act formulieren lassen, Quelle zitieren.
3. Im Abschnitt „Einordnung" festhalten: Umsetzung frühestens nach AP-3
   (governance_policies als Tenant-SSoT).

4. Die Spec bleibt unter .claude/os-funnel/, solange das Doku-Budget voll ist
   (npm run check:context). Umzug nach docs/product/ nur, wenn im selben PR ein
   abgelöstes Dokument nach .archive/ wandert — Budget nicht anheben.

Akzeptanz: Spec vollständig belegt, keine Implementierung im PR, check:context grün.
