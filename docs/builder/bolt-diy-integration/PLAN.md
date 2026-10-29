# Integrationsplan — bolt.diy als Fundament (Ausbau des bestehenden Adapters)

## bolt.diy (upstream, MIT, ~20k★, aktiv bis 2026-10-14) — was wir übernehmen
| Mechanik | Upstream | RealSync-Status |
|---|---|---|
| AI-Codegen via Artifact-Protokoll (`<boltArtifact>/<boltAction>`) | `app/lib/runtime/message-parser.ts`, `enhanced-message-parser.ts` | ✅ reimplementiert (`bolt/message-parser.ts`) |
| Action-Runner (file/shell/start/build) | `app/lib/runtime/action-runner.ts` | ✅ ohne Shell-Ausführung, gated |
| File-Management / Validierung | `stores/files`, `projectFileValidation.ts` | ✅ `file-store.ts`, `path-guard.ts`; ⏳ Validierungsregeln von upstream abgleichen |
| Preview | WebContainer + Preview-Store | ⚠️ nur srcDoc; WebContainer gesperrt (COOP/COEP = Infra) |
| Build/Error-Loop | Terminal-Errors → "Ask Bolt" Fix | ✅ `diagnostics.ts`, `error-recovery.ts` |
| Context-Selection | `.server/llm` select-context | ✅ `context-pack.ts` |
| LLM-Provider-Registry, Deploy (Netlify/Vercel), Supabase-Connector, Remix-App | — | ❌ bewusst NICHT übernommen (RealSync AI Gateway + Governance ersetzen das) |

## Was RealSync behält vs. wo bolt.diy andockt
bolt.diy liefert nur: Protokoll, Parser, Datei-Baum, Runner-Semantik, Fehler-Loop, Prompt-Muster.
RealSync behält: Auth, Tenant, Entitlement, AI-Gateway (Keys/Budget), Governance-Gate, Audit, Evidence/Merkle, Persistenz, Puck, CSP.
Andockpunkt = jede `BoltAction` läuft durch `governance-gate.ts` → AuditRecord → FileStore-Hash.

## Phasen
- **P0 (dieser Lauf, erledigt)**: Safety-Branch, IST + PLAN dokumentiert. Kein Code geändert.
- **P1 – Upstream-Parität (rein Frontend/Tests, kein Infra)**: Parser-Testfälle aus upstream `message-parser.spec.ts`/`__snapshots__` portieren; `projectFileValidation`-Regeln (Größen/Pfade/Binär) in `path-guard.ts` übernehmen; Diff/Undo pro Action; MIT-Attribution in UI-Footer der Workbench.
- **P2 – Governance-Tiefe**: AuditRecord → `governance-evidence-handler`/`evidence-vault` anbinden (Merkle-Root pro Version anchoren); Risikoklasse "high" → `governance-approvals` statt Hard-Block; Export der Prüfpfade über `export-audit`. Braucht Review der Edge-Fn-Contracts.
- **P3 – Produktivschaltung (Dominik/Infra-Freigabe)**: Migration `20260917000000_app_builder_projects.sql` anwenden; `siteos` (code-persist) + `ai-gateway` (stream) deployen; Feature-Flag pro Tenant.
- **P4 – Laufzeit-Preview (Infra-Freigabe)**: WebContainer oder isolierte Preview-Domain (COOP/COEP, separate Origin, CSP `frame-src`); Lizenz/ToS von `@webcontainer/api` (kommerzielle Nutzung lizenzpflichtig!) prüfen; Alternative: Sandpack/eigene Sandbox auf separater Origin.

## Governance/Compliance-Touchpoints
EU AI Act Transparenz (KI-generierter Code kennzeichnen), Risikoklassifizierung im Gate, DSGVO (Prompts/Dateien tenant-scoped, Lösch-Sweeper `governance-erasure-sweeper` auf `app_builder_projects` ausweiten), Secret-Leak-Scan vor Persist, Append-only Versionierung, AAL2 für Freigaben.

## Risiken
1. WebContainer-Lizenz kommerziell (nicht MIT) – Blocker für P4 ohne Vertrag.
2. COOP/COEP bricht ggf. Drittanbieter-Embeds/Auth-Popups → nur auf separater Origin.
3. Upstream-Drift: Reimplementierung statt Vendoring → Paritätstests nötig (P1).
4. Migration "REVIEW ONLY" noch nicht angewendet → Persist in Prod schlägt fehl bis P3.
5. Prompt-Injection über generierten Code → srcDoc-Sandbox ohne `allow-same-origin` beibehalten.
