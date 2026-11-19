---
title: SF-001 – Software Factory Phase 0 (isolierter Simulationsvertrag)
owner: Plattform-Betrieb
reviewed: 2026-11-20
status: entwurf
---

# SF-001 – Factory-Verträge und Mock-Worker

**Stand:** 20.11.2026. **Kein produktiver Worker, kein eingeschalteter Agent, keine produktive Freigabe.**

## Architekturanbindung und Grenzen

SF-001 erweitert **die vorhandene interne AI-OS-Codebasis**. Die neue reine TypeScript-Datei `packages/ai-os-core/src/factory-contract.ts` ist zunächst **nicht** aus `index.ts` exportiert und wird von keinem bestehenden Server, Browser, Cron oder Workflow importiert.

Wiederverwendbare Bausteine, die vor dem tatsächlichen Anschluss geprüft werden müssen:

- `packages/ai-os-core/src/types.ts`, `gateway.ts`, `agents.ts`, `tools.ts`: Operator- und Aktionsmodell; Default-Deny; `critical` nie im Server-Gateway.
- `src/features/ai-os/` und `supabase/functions/ai-os-control/`: vorgesehene Operator-Oberfläche und Gateway, **hier unverändert**.
- `src/core/agent-os/`: vorhandene Aufgaben-/Entscheidungsverträge. **Nicht** als persistenter Factory-Job-Store übernehmen: vorhandener In-Memory-Zustand und Best-Effort-Postgres-Hook sind nicht fail-closed.
- `agent_tasks`, `agent_decisions`, `agent_events`, `ai_os_action_log`: möglicher späterer Anschluss **nur** nach überprüftem Schema, Operator-Rechten, Isolation und Atomizität.

Die interne AI-OS-Dokumentation untersagt Kundendaten. Das Mock-Feld `scopeId` bildet **synthetische interne Arbeitsbereiche** ab; keine reale `tenant_id` der Kundenplattform, kein Zugriff auf Kundendaten. Negativtest „fremder Tenant“ wird als fremder **Mock-Arbeitsbereich** modelliert. Eine spätere echte Multi-Tenant-Factory benötigt eine eigene Freigabe-/Isolationsprüfung.

## Zustandsmaschine

```text
draft --specify--> specified --approve_sandbox--> approved_for_sandbox
  --start_mock--> running --mock_succeeded--> testing
  --tests_passed--> review_required --accept_review--> completed

running --mock_crashed--> failed
testing --tests_failed--> failed
aktive Zustände --block--> blocked
aktive Zustände --cancel--> cancelled
```

`blocked`, `failed`, `cancelled` und `completed` sind in Phase 0 endgültig. Wiederanläufe erfordern später ausdrücklich **einen neuen Jobversuch** mit durablem Lease, deduplizierter Eventverarbeitung und gesondertem Review. Keine automatische Wiederaufnahme nach Absturz.

## Was der Code tatsächlich tut

- Prüft *simulierte* Zustandsübergänge, erwartete Version, Schema-Hash, synthetische Approval-Daten, AAL2-Mock, Scope-Match, Kostenlimit und Idempotency-Key.
- Hält synthetische Ereignis- und Receipt-Listen in **zurückgegebenen JavaScript-Objekten**; keine Datenbank, kein Evidence Vault, keine Hash-Verkettung und keine unveränderbare Speicherung.
- `simulateFactoryWorker` erzeugt deterministische Statusfolgen: Erfolg bis `review_required`, Testfehler oder Worker-Absturz. **Es wird kein Code gebaut oder ausgeführt**.
- Bei `mode: 'production'`, unregistrierten Operationen oder `attempted_production` folgt Ablehnung. Es existiert weder GitHub-Schreibrecht, Shell, Netzwerkanbindung noch Deploy-Adapter.

**Sicherheitswarnung:** `FactoryMockContext` und dessen Approval-Objekte sind vom Test bereitgestellt und damit **nicht authentisch**. Diese Funktion ist keine produktive Authentifizierung, Autorisierung oder Budgetreservierung. Der Server müsste später Identität, MFA, Scope, Approvals, Zustand und Ausgaben unabhängig und transaktional prüfen. Ebenso beweist ein syntaktisches `evidenceRef` **keine** reale unveränderbare Evidenz. Nur ein verifizierter, dauerhaft gespeicherter Vault-Eintrag darf dafür verwendet werden.

## Negative Abnahmetests

| Bedingung | Erwartung |
| --- | --- |
| Kein Operator oder nicht verifizierte Identität | Ablehnen |
| Fremder Scope / simuliert fremder Mandant | Ablehnen |
| Keine bestätigte Sandbox-Freigabe / fehlende AAL2 / fremde Job-ID / falscher Spec-Hash | Ablehnen |
| Abgelaufene Freigabe | Ablehnen |
| Budgetüberschreitung | Keine Zustandsänderung |
| Produktionsmodus, Deploy-Aktion oder Shell-/Netzwerkversuch | Kein Ausführungspfad, Ablehnen |
| Worker-Absturz | `failed`, kein automatischer Retry |
| Testfehler | `failed`, kein `completed` |
| Übersprungener Status, abgeschlossener Job | Ablehnen |
| Doppelter Request | Identische Wiederholung ohne neues Event, Konflikt bei verändertem Inhalt |
| Erfolg ohne abschließende menschliche Abnahme | `review_required` bleibt bestehen |

## Lokale Prüfung (separat vom GitHub-Branch)

- Mit Node 22 und `--experimental-strip-types` wurde der **lokale Prototyp** über 11 unabhängige Smoke-Prüfungen getestet: **11/11 bestanden**.
- `tsc --strict --noEmit --target es2022 --module nodenext --moduleResolution nodenext --allowImportingTsExtensions factory-contract.ts` auf dem lokalen Prototyp: **bestanden**.
- **Nicht ausgeführt:** `vitest` für `test/ai-os/factory-contract.test.ts` auf dem GitHub-Branch; Repository-`npm test`, Gesamt-Typecheck, CI, GitHub-Checks, Tests gegen produktives Supabase, tatsächlicher Worker oder E2E. Die GitHub-Datei wurde separat geschrieben und muss auf dem Branch erneut verifiziert werden.

## Gate zum nächsten Entwicklungsblock

1. Branch-Inhalt mit lokalem Prototyp abgleichen; CI/Typecheck und Vitest-Testfälle am Branch vollständig grün.
2. Die interne Operator- und Freigabeberechtigung **serverseitig** testbar an `ai-os-control` anbinden. Keine Kundendaten auf `/admin/ai-os`.
3. Durable Job-Verträge beschließen: atomarer Statuswechsel (CAS), verlässliche Job- und Approval-Persistenz, Leases/Heartbeat, Outbox, Retry- und Recovery-Regeln, versionierte Spec und echte Evidence-Verankerung.
4. Kosten reservieren vor jeder externen Ausführung; Abbruch und Timeout auch bei Worker-/Provider-Ausfällen durchsetzen.
5. PR #2336 separat fertigstellen: **Required Reviewers für Environment production**, Branch-Restriktion auf `main`, danach Checks. Bis dahin **kein automatisches Merge/Deploy** aus der Factory.
6. WIP-Regel aus `.github/PR_TRIAGE_POLICY.md`: Bei über 20 offenen PRs keinen neuen Feature-PR anlegen; die Phase-0-Änderungen bleiben auf isoliertem Branch ohne Merge.
7. Erst anschließend einen wirklich isolierten Coding-Worker erarbeiten; REA erst nach Berechtigungs-/Ausführungsaudit integrieren.

**Freigabezustand:** SF-001 als Simulations- und Designbasis; **kein GO für autonome Coding-Ausführung, selbstständige PR-Merges oder produktive Releases**.
