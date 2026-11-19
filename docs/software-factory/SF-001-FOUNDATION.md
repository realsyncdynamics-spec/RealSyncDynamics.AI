# SF-001 — Software Factory Foundation (intern)

Stand: 20.11.2026. **Status: Entwurf auf isoliertem Branch; kein Live-Service, kein freigegebener PR und keine Produktionsfreigabe.**

## Zweck und Abgrenzung

Dies ist der erste, bewusst begrenzte Implementierungsschritt. Er ergänzt das vorhandene **interne** AI-OS (`packages/ai-os-core`, `/admin/ai-os`) um pure Factory-Verträge, eine deterministische Statusmaschine und Unit-Tests. Er erzeugt weder Agenten-Ausführungen noch Pull Requests. Er ersetzt **nicht** das AI-OS, Governance OS oder die Kunden-Agent-OS-Runtime.

- Quellcode: `packages/factory-core/src/` (keine Abhängigkeiten, kein Netzwerk, keine Secrets).
- Tests: `test/factory/state-machine.test.ts` (bestehende Vitest-Konfiguration schließt den Testpfad ein).
- Betrieb: **keiner**; es gibt keinen Worker, keine Queue, keine neue Supabase-Tabelle, keinen MCP-Server und keine neue Edge Function.
- Referenz: REA steht hier für das externe Werkzeug **Reverse Engineer Anything**; es ist **nicht** der in anderen RealSync-Entwürfen erwähnte Runtime Evidence Agent. Keine REA-Installation in diesem Schritt.

## Lifecycle

`queued → analyzing → planning → implementing → validating → draft_pr_ready`

Alternative Ausgänge: `blocked`, `failed`, `cancelled`. Ein blockierter Auftrag kann in `queued` neu beginnen. `validating → implementing` erlaubt begrenzte Nachbesserungsversuche. Die Endzustände sind terminal; es gibt bewusst **keinen** Status `merged`, `deployed`, `production` oder `approved`.

Jeder Übergang benötigt einen nichtleeren `evidenceRef` und eine `actorKind`-Beschriftung. Diese Beschriftung ist **kein Authentifizierungsnachweis**. Ein späterer serverseitiger Policy Decision Point muss Identität, Tenant/Operator, Zweck, Zielressource, Tool-Allowlist, Freigabe, Widerruf und Kill-Switch prüfen. Evidenzreferenzen müssen serverseitig validiert, zugriffsgeschützt und unveränderbar protokolliert werden. Das hier enthaltene Event-Array ist nur eine In-Memory-Darstellung, kein revisionssicherer Audit-Trail.

`maxCostCents` begrenzt den reinen Rechenzustand des Jobs. Eine produktive Integration muss Budgetreservierung **vor** Provideraufrufen atomar persistieren und bei Fehlern fail-closed entscheiden. Der Pure-Core ist kein Ersatz für Kostenkontrolle im Provider-Gateway.

## Integrationsfolge (bewusst noch nicht umgesetzt)

1. Ist-Zustand von `packages/ai-os-core`, `/admin/ai-os`, `ai-os-control`, RLS und Audit-Laufzeit gegen `main` sowie echte Laufzeit prüfen. Bisherige Doku enthält Preview-Stände.
2. Separaten Sandbox-Worker mit zeit-/speicher-/netzwerkbegrenzter Umgebung, minimalen GitHub-Rechten und eindeutiger Auftragsbindung spezifizieren.
3. Optionalen REA-MCP-Adapter nur für erlaubte Analyseziele einführen. Ergebnisse bleiben **untrusted**, Toolaufrufe werden von der Server-Policy erzwungen. Lizenz, Quelle und Nutzungserlaubnis je Artefakt dokumentieren; keine fremden Secrets, Sessions oder geschützten Assets kopieren.
4. Separate Zuordnungen zu vorhandenen Audit-/Evidence-Diensten und sicherem Server-Gateway erstellen, bevor irgendeine Live-Aktion möglich wird.
5. Anschließend Worker-Unit-Tests, negative Tenant-/Auth-Tests, Sandbox-Integration, vollständige PR-CI, Staging-E2E. Merge und Produktionsdeploy erst nach **je eigener Owner-Freigabe**.

## Relevante offene Blocker

- PR #2336 (Produktions-Environment-Gates) ist am 20.11. noch Draft. Merge darf derzeit nicht als sichere Produktionsfreigabe interpretiert werden.
- Issues #2337 (Migration Drift), #2285 (isolierte DB-Tests), #2200 (Cron Health) sind vor Runtime-/Datenbankarbeit zu prüfen.
- `.github/PR_TRIAGE_POLICY.md`: Solange mehr als 20 PRs offen sind, gilt ein WIP-Stopp für neue Feature-PRs. Diese isolierte Branch wird daher **nicht** eigenmächtig als Feature-PR eröffnet.
- REA-Produkt-Blueprint liegt bereits in PR #2345. Diese Foundation dupliziert nicht dessen Produktkonzept.

## Abnahme für diesen kleinen Schritt

- [x] Source und Tests im separaten Branch vorhanden
- [x] `tsc --noEmit` für den isolierten Pure-Core erfolgreich (lokale Kopie, TS 5.8.3)
- [ ] Vitest auf dem Repository-Head erfolgreich (maßgeblich)
- [x] Kein Code unter `supabase/`, `.github/workflows/`, `src/App.tsx` oder `shared/pricing.ts` verändert
- [x] Kein neuer Feature-PR unter WIP-Stopp, kein Merge, kein Deploy

**Nachweisstufen:** Quellcode im Branch ≠ erfolgreiche CI ≠ produktiver Betrieb. Das Beispiel `simulateFactoryJob` ist ausdrücklich nur eine deterministische Simulation.
