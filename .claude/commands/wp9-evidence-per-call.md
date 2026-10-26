---
description: WP9 Evidence-Eintrag für jeden angemeldeten KI-Call (Masterplan M3)
---

# WP9 — Evidence pro KI-Call

**Voraussetzung:** keine · **Branch:** `feat/wp9-ai-call-evidence`

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

Befund (26.10.2026): `supabase/functions/ai-gateway/handler.ts` bucht für angemeldete Aufrufe nur
`usage_events` über `bookUsage()`. Der PDP-Verdict aus `deps.pdpCheck()` (`warn` mit `reasons`, Block als Response) geht an den Client,
wird aber nicht persistiert. Nur der anonyme Pfad (`audit_anon`) schreibt ein Protokoll (`anon_chat_runs`).
Das Produktversprechen „jeder KI-Call wird geloggt“ ist damit nicht belegt.

Ziel: Jeder erfolgreiche und jeder blockierte angemeldete Call erzeugt genau einen Evidence-Eintrag.

Aufgaben:
1. Bestehende Evidence-Schreibpfade sichten, nicht neu erfinden:
   `supabase/functions/governance-evidence-handler/index.ts`, `packages/evidence-chain/src/index.ts`,
   Tabelle `evidence_items` (Health-Probe in `_shared/health.ts`).
2. In `ai-gateway/handler.ts` neben `bookUsage()` eine injizierbare Dependency `recordEvidence`
   (gleiches Muster wie `anonAuditLog`): tenant_id, feature, route, provider, model, Region/Residency,
   Tokens, Verdict, request_id. **Keine Prompt- oder Antwortinhalte** speichern (Datensparsamkeit).
3. Fehlerverhalten festlegen und testen: Evidence-Schreibfehler wird geloggt; ob der Call dann fail-closed
   abbricht, ist eine Owner-Entscheidung → im PR als Frage stellen, Default: fail-open mit Alarm-Log.
4. Reicht das bestehende Schema nicht: Migration **nur als Vorschlag** im PR beschreiben, nicht anlegen.
5. Unit-Tests für Erfolg, `warn`, Block (`pdpCheck` liefert Response), Streaming-Abschluss (`onDone`) und Schreibfehler.

Nicht in diesem WP: UI-Anzeige der Einträge (folgt in WP11), ai-invoke (eigenes Folge-WP).
