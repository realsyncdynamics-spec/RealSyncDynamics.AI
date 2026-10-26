---
description: WP9 Evidence pro KI-Call (ai-gateway / ai-invoke, M3)
---

# WP9 — Evidence pro authentifiziertem KI-Call

**Voraussetzung:** keine (Phase 0, erstes Paket) · **Masterplan:** §3 M3 · **Branch:** `feat/wp9-evidence-per-call`

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

Befund (geprüft 26.10.2026):
- supabase/functions/ai-gateway/handler.ts: Der anonyme Pfad (`mode: 'audit_anon'`) schreibt
  fail-closed in `anon_chat_runs` (deps.anonAuditLog). Fehlt das Log → 503 LOG_UNAVAILABLE.
- Authentifizierte Pfade (`/`, Stream, `/v1/chat/completions`) rufen nur `bookUsage` →
  deps.recordUsage → `usage_events`. Best-effort: Fehler wird geloggt, Call läuft weiter.
  Kein Evidence-Eintrag, keine Hash-Kette.
- supabase/functions/ai-invoke/index.ts: prüft Membership, schreibt keinen Evidence-Eintrag.
- packages/evidence-chain liefert Ketten-/Snapshot-Typen (ChainIssueKind, SnapshotRecord).

Ziel: Jeder authentifizierte, erfolgreiche oder durch Policy abgelehnte Call erzeugt genau
einen Evidence-Eintrag. Das Landing-Versprechen „jeder KI-Call wird geloggt" ist damit belegt.

Aufgaben:
1. Bestandsaufnahme (nur lesen, im PR dokumentieren): Welche bestehende Tabelle eignet sich
   als Ziel (Evidence Vault / bestehende evidence_*-Tabellen)? Reichen ihre Spalten für:
   tenant_id, actor (user_id), feature/Zweck, provider, model, provider_region, residency,
   input_tokens, output_tokens, policy_decision (allow|deny|redact), request_id, prev_hash, hash?
   Wenn nein: Migration nur als Vorschlag (SQL im PR-Text), NICHT anlegen → Owner-GO.
2. Neuer Dep im Handler, analog zu anonAuditLog: `recordEvidence(entry) => Promise<void>`.
   Aufruf in allen authentifizierten Pfaden, auch bei Policy-Deny und Provider-Fehler.
   Beim Streaming nach Abschluss (gleicher Hook wie bookUsage).
3. Fail-Verhalten festlegen und testen:
   - Evidence-Schreiben schlägt fehl → Call wird NICHT stillschweigend durchgereicht.
     Vorschlag: fail-closed wie anon-Pfad (503 EVIDENCE_UNAVAILABLE), per Env-Flag
     `AI_GATEWAY_EVIDENCE_MODE=enforce|warn` umschaltbar, Default `enforce`. Im PR begründen.
4. Hash-Kette über packages/evidence-chain (pro Tenant, prev_hash → hash). Keine Prompt-
   oder Antwortinhalte speichern, nur Hash des Inputs (DSGVO-Datensparsamkeit).
5. ai-invoke: denselben Dep nutzen oder im PR begründen, warum ai-invoke über ai-gateway läuft.
6. Unit-Tests (Deno, vorhandene ai-gateway-Tests erweitern):
   - erfolgreicher Call → genau 1 Evidence-Eintrag mit Modell, Region, Tokens
   - Policy-Deny → Eintrag mit policy_decision 'deny'
   - recordEvidence wirft → 503 im enforce-Modus, Antwort im warn-Modus + Log
   - kein Prompt-Klartext im Eintrag

Nicht tun: Migration anlegen, Deploy der Function, UI-Änderungen, Backfill alter Calls.

Akzeptanz:
- Jeder authentifizierte Pfad im Handler ruft recordEvidence (Test pro Pfad)
- Kein Klartext-Prompt im Evidence-Eintrag
- Fehlt eine Spalte/Tabelle: Migrations-Vorschlag im PR, Code hinter Dep-Interface fertig
- Deno-Tests grün, npm run lint grün
