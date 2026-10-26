---
description: WP9 Evidence pro authentifiziertem KI-Call (Masterplan M3)
---

# WP9 — Evidence pro KI-Call

**Voraussetzung:** keine · **Branch:** `feat/wp9-evidence-per-call`
Nicht zu verwechseln mit O-WP9 (Publish Controller/Rollback).

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

Befund (Stand 26.10.2026):
- supabase/functions/ai-gateway/handler.ts protokolliert nur den anonymen Pfad
  (`audit_anon` → anon_chat_runs). Authentifizierte Calls buchen best-effort
  usage_events über `bookUsage` → `deps.recordUsage` — das ist Abrechnung, kein Nachweis.
- supabase/functions/ai-invoke/index.ts bucht ebenfalls nur `recordUsage` (_shared/usage.ts).
- Ziel-Tabelle existiert: ai_evidence_events (Migration 20260510_ai_governance_core.sql),
  append-only seit 20260901090000, Hash-Kette per Trigger (prev_hash/event_hash/chain_index),
  gelesen von evidence-vault-export und evidence-anchor. Schreibmuster:
  governance-decide/index.ts und telemetry-ai-event/index.ts.

Ziel: Jeder erfolgreiche UND jeder durch Policy abgelehnte authentifizierte Call
erzeugt genau einen ai_evidence_events-Eintrag. Keine Migration.

Aufgaben:
1. Eine Hilfsfunktion in supabase/functions/_shared/aiGateway/ (z. B. callEvidence.ts):
   baut den Insert aus { tenantId, userId, route, feature, model, provider, providerRegion,
   residency, tokens (in/out), pdpDecision, policyId?, requestId, latencyMs }.
   event_type 'ai:call' bzw. 'ai:call_blocked'; risk_level aus PDP-Entscheid
   (allow → info, log_only → low, block → high). KEIN Prompt-/Antworttext im evidence-JSON
   (Datenminimierung) — höchstens Längen und sha256 des Prompts über _shared/hash.ts.
2. ai-gateway: neue optionale Dependency `recordEvidence` in GatewayDeps, analog zu
   recordUsage injiziert (index.ts). Aufruf nach erfolgreichem Call und bei PDP-Block.
   Fehler beim Schreiben brechen die Antwort nicht (fail-open), werden aber mit
   scope 'ai-gateway-evidence' geloggt. Streaming-Pfad mit abdecken.
3. ai-invoke: denselben Helper nach runAiTool aufrufen.
4. Tests (Deno, neben bestehenden handler-Tests): Evidence wird bei Erfolg und bei Block
   geschrieben; Fehler im Evidence-Write → Antwort trotzdem 200 + Logzeile;
   anonymer Pfad unverändert; evidence-JSON enthält keinen Prompt-Text.

Nicht tun: Migration, neue Tabelle, fail-closed (Owner-Entscheid laut Masterplan §8),
Änderungen an evidence-anchor/-export, Deploy der Functions.

Akzeptanz:
- Authentifizierter Call → genau 1 Zeile in ai_evidence_events (im Test über Mock belegt)
- Kein personenbezogener Inhalt außer user_id-Referenz im evidence-JSON
- Bestehende ai-gateway-Tests grün; npm run lint, npm test grün
