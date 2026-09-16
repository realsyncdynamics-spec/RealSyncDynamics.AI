# Abnahme — RealSyncDynamics.AI Web App Builder

**Branch:** `feat/bolt-diy-builder-integration`  
**Basis vor dieser Lieferung:** `1926a274` (darunter `e3c3f06d`)  
**Snapshot:** `backup/pre-bolt-diy-2026-09-16` auf `main@7449166d`  
**Kein Merge nach main. Kein Production-Deploy. Keine angewendete Production-Migration.**

## Was in diesem Commit geschlossen wurde

- `siteos/code-persist` nutzt den kanonischen Resolver `requireAuthAndTenant` (JWT → User → `memberships`). `body.tenant_id` ist Claim, nicht Autorität.
- Isolationstests: unauthenticated DENY, Entitlement DENY, gefälschte `tenant_id` überschreibt Authz nicht, Tenant B liest/ändert/löscht Tenant A nicht, kein `.from('siteos_blueprints')`.
- Puck-Regression ausgeführt: Laden, Speichern, Publish-Gate, Navigation `/builder/:slug` → `/code` → zurück.
- Produktionspfad-Wächter: Workbench streamt nur über RealSync AI Gateway (`app_builder_code`), Persistenz nur über `siteos/code-persist`. Kein `api.x.ai` / keine `VITE_*`-Providerkeys im Builder.

## Code fertig, Production-Lauf BLOCKED ohne Infra-Mutation

Diese drei Punkte brauchen eine ausdrücklich verbotene Production-Mutation. Code ist reviewbar, nicht ausgerollt:

1. **Server-Persistenz (W, X)** — Migration `20260917000000_app_builder_projects.sql` + Handler `siteos/code-persist` + Client `persist-api`. Freigabe fehlt: Migration anwenden + Function `siteos` deployen.
2. **Gateway-Streaming live (Y)** — `generateStream` auf OpenAI/Anthropic/LM Studio, `op: stream` NDJSON, OpenAI-compat `stream: true`. Freigabe fehlt: Function `ai-gateway` deployen.
3. **WebContainer / COOP-COEP** — bewusst deaktiviert. Policy-Worker / KV unverändert gesperrt.

## Kernpfad (kein Mock)

User-Prompt → Auth (`useSupabaseAuth`) → Tenant (`useTenant`.activeTenantId, nie URL) → Entitlement (`canOpenAppBuilder` only) → Context-Pack → RealSync AI Gateway (`feature: app_builder_code`, Token-Stream) → Parser → Governance-Gate → FileStore → srcDoc-Preview → `siteos/code-persist`.

## Ausgeführte Tests (dieser Lauf)

```
npx vitest run test/app-builder test/siteos/workspace.test.tsx \
  test/edge/siteos-router.test.ts test/edge/entitlement-gates.test.ts
```

**10 files, 185 tests, alle grün.** Darunter:

| Suite | Tests | Relevanz |
|---|---|---|
| `test/siteos/workspace.test.tsx` | 22 | Puck laden/speichern/Publish-Gate, Nav Code, Nav zurück |
| `test/app-builder/bolt-engine.test.ts` | 22 | Parser, Gate, Follow-up, Secret, High-Risk, Preview |
| `test/app-builder/persist-isolation.test.ts` | 13 | 401/403/forged tenant/cross-tenant/no blueprints |
| `test/app-builder/gateway-stream.test.ts` | 5 | Adapter-Tokenstream, SSE, Context-Pack, `op: stream` |
| `test/app-builder/context-pack.test.ts` | 4 | Folgeprompts, Budget, Diagnostics |
| `test/app-builder/runtime-capability.test.ts` | 4 | srcDoc ja; React/ESM/Router/CDN/WebContainer nein |
| `test/app-builder/code-route.test.ts` | 5 | Routenordnung, Tenant nicht aus URL, Back-Link |
| `test/app-builder/production-path.test.ts` | 3 | Kein Provider-Direktpfad, kein `siteos_blueprints` |
| `test/edge/siteos-router.test.ts` | 23 | `code-persist` im Router |
| `test/edge/entitlement-gates.test.ts` | 84 | `siteos.builder` am Handler |

Migration `20260917000000` ist in diesem Branch eindeutig (keine lokale Versionskollision). `origin/main` war in dieser Umgebung nicht gefetcht — der CI-Guard gegen fremde PRs läuft dort.

Grok-Sandbox `scripts/grok-pwa-plugin.test.mjs`: 47 Tests, **39 grün, 8 rot**, identische Plattform-Chrome-Menge wie `docs/builder/GROK_PWA_BASELINE.md`. Keine Builder-Regression. `public/__grok/` und `grokPwaPlugin()` unangetastet.

## Matrix A–AC

PASS = der testbare Zielpfad wurde ausgeführt.  
BLOCKED = ausdrücklich verbotene Production-Mutation (Migration anwenden / Function deployen / COOP-COEP).  
PARTIAL = Code und Unit-/RTL-Pfad grün, Live-Production nicht erreichbar.

| ID | Kriterium | Status | Beleg |
|---|---|---|---|
| A | Authenticated happy path | PARTIAL | Workbench + Gateway-Client + Gate. Live-Modell erst nach `ai-gateway`-Deploy. |
| B | Fehlende Session | PASS | `authorizePersist` 401; Engine schreibt nichts ohne Auth; Puck leitet nach `/welcome`. |
| C | Ungültiger Tenant | PASS | `requireAuthAndTenant` → 403; TenantProvider, nie URL. |
| D | Cross-Tenant-Zugriff | PASS | MemoryProjectStore: B kann A nicht laden/ändern/löschen; Handler scoped `eq('tenant_id', tenantId)`. |
| E | Einfacher Prompt | PARTIAL | Parser/Ingest/Demo-Generator grün. Live-LLM BLOCKED bis Gateway-Deploy. |
| F | Streaming | PARTIAL | Adapter `generateStream` mit Token-Deltas ausgeführt; Edge-`op: stream` im Quelltext. Live-Edge BLOCKED. |
| G | Mehrere Dateien | PASS | FileStore-Snapshot, Preview-Inlining, Context-Pack-Tree. |
| H | Folgeprompt | PASS | Engine behält den Baum; Context-Pack + `lastChange`. |
| I | Dateiänderung | PASS | `writeFile` + Preview-Update-Test. |
| J | Dateilöschung | PASS | `deleteFile` nur nach Gate-Allow. |
| K | Preview | PASS | `htmlFromFiles` aus dem Dateibaum, kein Fixture. |
| L | Preview-Update | PASS | Follow-up ändert Datei → Preview-HTML ändert sich. |
| M | Reload/Persistenz | BLOCKED | Code: `app_builder_projects` + `code-persist`. Nicht angewandt, nicht deployt. |
| N | Syntax-/Buildfehler | PASS | `diagnoseFiles` flaggt unausgewogenes HTML. |
| O | Fehlerkorrektur | PASS | Diagnostics im Context-Pack; Repair-Prompt-Pfad in der Workbench. |
| P | Secret-Erkennung | PASS | `findSecretLeak` + hydrate re-scan, Write blockiert. |
| Q | High-Risk HOLD | PASS | High-Risk-Prompt: kein File-Write, Gate `require_approval`. |
| R | Verbotener Prod-Befehl | PASS | `wrangler`/`git push` → block, nicht ausgeführt. |
| S | Zulässige Dateioperation | PASS | `index.html` allow nach Auth/Tenant/Entitlement. |
| T | Audit/Evidence | PASS | Prüfpfad-Einträge an Gate-Entscheidung, Merkle, kein erfundenes Ergebnis. |
| U | Responsive Layout | PARTIAL | `min-h-11`, Wrap, Mobile-Code-Link. Kein Production-Viewport-E2E. |
| V | Puck/SiteOS weiter funktionsfähig | PASS | 22 Workspace-Tests ausgeführt (Laden, Speichern, Gate, Nav). |
| W | Server-Persistenz Dateibaum | BLOCKED | Code reviewbar. Migration + Deploy ausdrücklich nicht. |
| X | Close-Browser / Re-Auth / Server-Load | BLOCKED | Hängt an W. |
| Y | Token-SSE RealSync AI Gateway | BLOCKED | Code reviewbar (`op: stream`, Adapter-Tests grün). Function nicht deployt. |
| Z | Projektkontext Folgeprompts | PASS | `packProjectContext` Budget/Diagnostics/lastChange. |
| AA | Tenant-Isolation Security | PASS | 401 / Entitlement 403 / forged tenant / cross-tenant. |
| AB | Puck vollständig | PASS | `/builder/:slug` öffnen, edit, save, load, publish-gate, Nav Code, Nav zurück. |
| AC | Runtime-Fähigkeit | PASS | srcDoc: HTML/CSS/lokales JS. Kein React/ESM/Router/CDN/WebContainer. Dokumentiert in `docs/builder/RUNTIME_CAPABILITY.md`. |

## Bewusst nicht gebaut

- WebContainer / COOP-COEP
- Zweite Frontend-Schale
- Landing, Payments, Orchestrator, KV, Policy-Worker
- Production-Migration, Production-Deploy, Merge nach `main`
- `grok-4.5` als Sonderpfad (Produkt geht über bestehendes Gateway-Profil `cloud-fallback`)

## Was nach Freigabe noch zu tun ist

1. Migration `20260917000000_app_builder_projects.sql` anwenden.
2. Edge Functions `siteos` (Router inkl. `code-persist`) und `ai-gateway` (`op: stream`) deployen.
3. Danach Production-E2E: A, E, F, M, W, X, Y gegen die echte Session.

Bis dahin bleibt der Browser-Cache in der Workbench als degradierter Fallback, sichtbar als „Browser-Cache · Server nicht ausgerollt“. Das ist kein PASS für W/X.
