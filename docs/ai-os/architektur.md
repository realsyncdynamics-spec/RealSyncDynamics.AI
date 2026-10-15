---
title: AI-OS — Bestandsaufnahme und Architektur
owner: Plattform-Betrieb
reviewed: 2026-10-15
status: aktiv
---

# AI-OS — Bestandsaufnahme und Architektur

Stand 2026-10-15, gemessen gegen `main@a715805`.

## A. Bestandsaufnahme — was es schon gibt

| Bereich | Bestand | Verwendung im AI-OS |
|---|---|---|
| Operator-Rolle | `platform_operators`, `is_platform_operator()` (Migration `20261003060000`, ADR 0011 D5) | **wiederverwendet** — einzige Quelle für Zugang |
| MFA | `requireAal2.ts` (`decodeAalFromJwt`), `/settings/security` | **wiederverwendet** — Schreibaktionen nur mit AAL2 |
| Policy-Prinzip | PDP (`_shared/pdp/`), ADR 0011 D1 (Default-Deny, Grenze im Server) | **übernommen** als Gateway-Regel |
| Kosten | `tenant_cost_ledger`, `ai_tool_runs` | **wiederverwendet** — nur Summen |
| System-Health | RPC `admin_system_health` (pg_cron-Jobs, Integrationen) | **wiederverwendet** |
| CI/Guards | 38 Workflows, u. a. CI, E2E, CodeQL, 5 Drift-Guards, Merge-Hygiene | **registriert**, nicht ersetzt |
| pg_cron | ~19 Jobs (Agent-OS-Runner, Monitoring, DSR, Stripe-Meter …) | **registriert**, Live-Zustand im UI |
| Admin-Flächen | `/admin/*` (SuperAdminDashboard, SystemHealth …) | Einstieg verlinkt |
| Agenten | `agentMesh.ts`, WP5-Register, `enterprise_agents` | **nicht verwendet** — Kundenplattform |
| Skill-Register | `src/lib/skills/registry.ts`, `src/core/runtime/` | **nicht verwendet** — Kunden-Runtime |
| Govard-Gateway | `workers/govard-gateway` (Deny-by-default, Approval-Workflow) | Vorbild; nicht deployt (D1-ID Platzhalter) |

Lücken vor diesem Paket: kein Operator-Agentenregister, keine SKILL.md-Dateien,
kein Tool-Gateway mit Lese/Schreib/Kritisch-Klassen, keine GitHub-Sicht in der
App, kein plattformweites Aktionsprotokoll (`governance_admin_log.tenant_id` ist
NOT NULL), kein Hell-Modus, kein PWA-Manifest.

Überschneidungen mit offenen PRs: #1802/#1803/#1804 (Safety Control Plane für
Kunden-Agenten), #1724/#1729 (Browser-Runtime), #1706 (Claude Code Action in CI).
Das AI-OS berührt deren Dateien nicht; #1706 wäre der spätere Weg für
LLM-Ausführung ohne Sitzung.

## B. Zielarchitektur

```
Operator (Browser, /admin/ai-os)
   │  Nutzer-JWT (supabase-js), kein Token, keine Service-Role
   ▼
Edge Function ai-os-control ──► is_platform_operator() (Nutzer-JWT)
   │                         └─► authorizeAction()  packages/ai-os-core/gateway.ts
   │                               Default-Deny · kritisch nie · write = AAL2 + Bestätigung
   │                               · Agent-Positivliste
   ├─► ai_os_action_log  (write: „requested" VOR Ausführung, fail-closed)
   ├─► GitHub REST (AI_OS_GITHUB_TOKEN, Aufrufbudget je Operation)
   └─► Supabase (Service-Role nur für Summen und Protokoll)

GitHub Actions (Zeitplan / Ereignis / workflow_dispatch)
   └─► scripts/ai-os/routine.mjs ──► packages/ai-os-core (collect + reports)
          GITHUB_TOKEN nur read · timeout 10 min · Job-Summary + Artefakt 14 Tage

Claude Code (lokal oder Cloud-Sitzung)
   └─► .claude/skills/aios-*/SKILL.md  (MCP: GitHub, Supabase, Stripe, Google lesend)
```

**Ein Register, drei Laufzeiten.** `packages/ai-os-core` ist laufzeitfrei
(nur löschbare TS-Syntax) und läuft unverändert im Browser, in Deno und in
Node 22. Eine Zahl im Command Center und im Routinebericht entsteht aus
demselben Code.

**Sicherheitsgrenzen**

1. Zugang: nur aktive Plattform-Operatoren, serverseitig geprüft.
2. Aktionen: Positivliste je Agent; was nicht registriert ist, ist verboten.
3. Kritisch (Merge, Deploy, Migration, Stripe-Schreiben, E-Mail/Teilen) ist
   im AI-OS nicht ausführbar — nur der dokumentierte menschliche Weg.
4. Schreiben (Routine starten/pausieren, Wissens-Draft-PR): AAL2 +
   ausdrückliche Bestätigung + Protokoll vor Ausführung.
5. Routinen: nur Leserechte, keine Modellaufrufe, Zeit- und Aufrufbudget.
6. Kein Shell-Endpunkt, kein Terminal, keine fremden Skills: Skills sind
   Dateien in diesem Repository, Änderung nur per PR.
7. Keine Mandantendaten und keine personenbezogenen Daten in Berichten
   (PR-Nummern, Titel, Workflow-Namen — keine Autoren, keine Log-Inhalte).

**Erweiterung** (Codex, weitere Agentensysteme): neuer Ausführungskanal in
`types.ts` (`ToolChannel`), Aktionen im Katalog registrieren, Agent-Positivliste
erweitern. Der Vertrag bleibt: Agent + Aktion → `authorizeAction` → Protokoll.

**Mobil:** responsive Oberfläche (Navigation als Querleiste unter 1024 px,
Tabellen horizontal scrollbar). Ein PWA-Manifest wurde bewusst nicht ergänzt:
Es würde die ganze Site installierbar machen (`index.html` ist global), ein
Service Worker brächte Cache-Risiken für authentifizierte Daten, und Offline-
Betrieb ist für Live-Zustände nicht sinnvoll.

**Keine neue Infrastruktur:** Supabase (vorhanden), GitHub Actions (vorhanden),
Cloudflare Pages (vorhanden). Kosten: wenige Actions-Minuten pro Tag, keine
Modellkosten.
