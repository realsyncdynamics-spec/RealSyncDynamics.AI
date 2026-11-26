# Spike: React-Vorschau per Sandbox im Code-Builder (22.11.2026)

Status: **Spike, Draft-PR, kein Merge, kein Deploy, keine Migration.**
Branch `spike/code-builder-sandbox-preview`. Freigabe Dominik („Go“, 22.11., 21:36) gilt
nur für diesen Umfang.

Legende: **geplant** · **implementiert** · **getestet (Fake)** · **produktiv verifiziert** (nichts davon).

---

## 1. Bestand (nur gelesen, Stand `main` `283ea01`)

| Frage | Beleg |
|---|---|
| Route und Gate | `src/App.tsx:267` (lazy), `src/App.tsx:1250` `<Route path="/builder/:slug/code">`. Gate: `src/features/app-builder/BoltCodeBuilderPage.tsx:20-40` (Session, `activeTenantId`, `canOpenAppBuilder` auf `siteos.builder`), Sperrbild `:68-94`. |
| Wie entstehen Dateien | Prompt → `gateway.ts:61-103` (`processAIGatewayStream`, `feature: 'app_builder_code'`) → bolt-Parser `bolt/message-parser.ts` → `bolt/governance-gate.ts` → `bolt/action-runner.ts` → `bolt/file-store.ts`. Shell/Start/Build werden **nicht** ausgeführt: `bolt/governance-gate.ts:156-161` (`require_approval`, control `runtime.webcontainer-disabled`), `bolt/action-runner.ts:1-6`. |
| Wie werden sie gespeichert | Browser `persist/persist-api.ts:41-90` → `POST siteos/code-persist` → `supabase/functions/siteos/handlers/code-persist.ts:77-111` (`requireAuthAndTenant`, `gateFeature(...,'siteos.builder')`) → Tabelle `app_builder_projects` (`supabase/migrations/20260917000000_app_builder_projects.sql:11-40`, Spalte `files JSONB`). Grenzen 80 Dateien / 200 KB / 1,5 MB (`code-persist.ts:20-22`, `persist/contract.ts:78-80`). Ob die Migration produktiv angewandt ist: **nicht geprüft** (Kopf der Migration: „REVIEW ONLY — do not apply“). |
| Wo wird die Vorschau gerendert | `BoltWorkbench.tsx:178-181` (`htmlFromFiles`), `BoltWorkbench.tsx:634-642` (`<iframe srcDoc sandbox={sandboxTokens(isolation)}>`). Inlining `bolt/preview.ts:17-59`. Isolation/CSP `src/lib/preview-sandbox.ts:54-59` (nie `allow-same-origin`), `:87-106` (CSP `default-src 'none'`). |
| Fähigkeitsprüfung | `bolt/runtime-capability.ts:19-68` (React, ESM, Router, CDN, WebContainer = `no`), `:85-106` (`assessProjectRuntime`). `bolt/types.ts:125` `WEBCONTAINER_BACKEND = 'disabled'`. |
| Übernommene bolt.diy-Teile, Lizenz | Nur das Artefakt-Protokoll (`<boltArtifact>`, `<boltAction>`), neu implementiert: `bolt/VENDOR.md:1-24`. MIT-Text mit Copyright „2024 StackBlitz, Inc. and bolt.diy contributors“: `docs/builder/BOLT_DIY_LICENSE.txt:1-3`. Kopfhinweis in `bolt/types.ts:1-11`. |
| WebContainer-Verweise | Nur Text/Konstanten, **kein Import** von `@webcontainer/api` und kein Eintrag in `package.json`: `bolt/runtime-capability.ts`, `bolt/types.ts:125`, `bolt/governance-gate.ts:161`, `bolt/action-runner.ts:4`, `bolt/preview.ts:6`, `README.md:30`, `bolt/VENDOR.md:15,20`; außerdem `test/app-builder/runtime-capability.test.ts`, `test/app-builder/bolt-engine.test.ts`, `src/features/build-studio/README.md`. Treffer in `services/realsync-runtime-core/package-lock.json` (Lockfile, nicht gelesen). |
| Budget-/Nutzungskontrolle | (a) `supabase/functions/_shared/usage.ts:1-22` `consumeUsage` je `entitlement_key`/Monat — laut eigener Doku **race-prone** unter Parallelität. (b) `supabase/functions/_shared/bot-budget.ts:1-30` mit atomarer Reservierung per Advisory-Lock (Migration `20261027120000_bot_usage_budget_hardening.sql`) — **das passende Muster** für Sandbox-Kontingente. (c) `usage-increment` Edge Function. |

**Widersprüche (gemeldet, nicht aufgelöst):**

1. `src/features/app-builder/README.md:7,28` sagt „kein Merge nach `main`“, der Code liegt aber auf
   `main` und ist unter `/builder/:slug/code` geroutet. Der Ursprungs-Commit ist im flachen Klon
   nicht ermittelbar (`git log` zeigt nur die Klon-Grenze `f714288`). Klärung: README anpassen
   oder Route sperren — Entscheidung Dominik.
2. Das im Auftrag genannte Grundlagendokument `claude/builder-landing-integrationsplan-2026-11-22.md`
   existiert auf `283ea01` **nicht** (in `claude/` liegt nur `pr2044-f04-reimplementation-2026-10-27.md`).
3. `bolt/VENDOR.md:23-24` sagt, der Lizenztext komme „when this module is merged“ nach
   `docs/builder/BOLT_DIY_LICENSE.txt` — die Datei existiert bereits. Kein Mangel, nur veralteter Satz.

---

## 2. Optionsvergleich (offizielle Quellen, abgerufen 22.11.2026)

Alles ohne Quelle ist **nicht verifiziert**. Preise ohne MwSt., ohne Freikontingente.

| | a1) E2B | a2) Vercel Sandbox | b) Cloudflare Sandbox SDK / Containers | c) Sandpack (CodeSandbox) |
|---|---|---|---|---|
| Lizenz Client/SDK | Repo Apache-2.0 ([LICENSE](https://raw.githubusercontent.com/e2b-dev/E2B/main/LICENSE)); npm-Paket `e2b` 2.64.0 meldet **MIT** ([npm](https://registry.npmjs.org/e2b/latest)) — Widerspruch, klären | `@vercel/sandbox` 4.1.0 Apache-2.0 ([npm](https://registry.npmjs.org/@vercel/sandbox/latest)) | `@cloudflare/sandbox` 1.0.3 Apache-2.0 ([LICENSE](https://raw.githubusercontent.com/cloudflare/sandbox-sdk/main/packages/sandbox/LICENSE)) | sandpack-react/-client Apache-2.0 ([LICENSE](https://raw.githubusercontent.com/codesandbox/sandpack/main/LICENSE)); **Nodebox: Sustainable Use License** ([LICENSE](https://raw.githubusercontent.com/codesandbox/nodebox-runtime/main/LICENSE)) |
| Kommerzielle Bedingungen | FoundryLabs Inc., Delaware-Recht, JAMS-Schiedsverfahren SF ([terms](https://e2b.dev/terms)) | DPA für Pro/Enterprise ([dpa](https://vercel.com/legal/dpa)); Hobby: nicht verifiziert | Workers Paid ($5/Monat) Voraussetzung ([pricing](https://developers.cloudflare.com/containers/platform/pricing/)); Containers/Sandbox GA seit 13.04.2026, Scheduling-Policy `durable_object` noch **Beta** ([changelog](https://developers.cloudflare.com/changelog/post/2026-04-13-containers-sandbox-ga/), [docs](https://developers.cloudflare.com/sandbox/index.md)) | **„any vite template“ braucht kommerzielle Lizenz von CodeSandbox** ([FAQ](https://sandpack.codesandbox.io/docs/resources/faq)) |
| EU-Region | Geteilter EU-Cluster GCP `europe-west1` auf Antrag beim Support ([eu-region](https://docs.e2b.dev/faq/eu-region), [egress](https://docs.e2b.dev/faq/egress-ip-ranges)); BYOC nur Enterprise ([byoc](https://docs.e2b.dev/byoc)) | `fra1`, `cdg1`, `dub1`, `arn1` wählbar ([regions](https://vercel.com/docs/sandbox/concepts/regions)) | `jurisdiction: "eu"` (EEUR/WEUR); Images/Snapshots davon **nicht** erfasst; DurableObjectId wird außerhalb geloggt ([placement](https://developers.cloudflare.com/containers/concepts/placement/), [data-location](https://developers.cloudflare.com/durable-objects/reference/data-location/)) | nicht verifiziert; Bundler/CDN unter `*.codesandbox.io` |
| AVV/DPA | über Trust Center ([security](https://e2b.dev/security)) | ja, SCC 2021 ([dpa](https://vercel.com/legal/dpa)) | ja, v6.4, SCC Modul 2/3 ([dpa](https://www.cloudflare.com/cloudflare-customer-dpa/)) | nicht verifiziert (Seite 403) |
| Subprozessoren | nur per E-Mail an trust@e2b.dev | security.vercel.com | [Liste](https://www.cloudflare.com/gdpr/subprocessors/) | nicht verifiziert |
| Preismodell | $0.000014/vCPU-s, $0.0000045/GiB-s; Pro $150/Monat ([pricing](https://e2b.dev/pricing)); nur-aktive-CPU: nicht verifiziert | Active CPU $0.128/h, Speicher $0.0212/GB-h (Preise `iad1`; **EU-Preise nicht verifiziert**) ([pricing](https://vercel.com/docs/vercel-sandbox/pricing)) | $0.000020/vCPU-s **nur aktiv**, $0.0000025/GiB-s, Disk $0.00000007/GB-s ([pricing](https://developers.cloudflare.com/containers/platform/pricing/)); min. 3 GiB je vCPU ([changelog](https://developers.cloudflare.com/changelog/post/2026-09-29-remove-disk-to-memory-ratio/)) | Lizenzpreis nur auf Anfrage |
| **Schätzung je Sitzung** (15 min, 2 vCPU) | ≈ $0.041 (4 GiB, volle Laufzeit) | ≈ $0.028 (10 % CPU) bis $0.085 (100 %), 4 GiB, US-Preise | ≈ $0.023 (10 % CPU) bis $0.055 (100 %), `standard-3` 8 GiB; + $5/Monat Grundgebühr | nicht berechenbar |
| Kaltstart | keine Zahl (nicht verifiziert) | „Millisekunden“, keine Zahl | „often 1–3 s“, abhängig vom Image ([faq](https://developers.cloudflare.com/containers/faq/)) | — (Browser) |
| Max. Laufzeit | Standard 5 min; max. 1 h Hobby / 24 h Pro ([lifetime](https://docs.e2b.dev/faq/sandbox-lifetime.md)) | Standard 5 min; max. 45 min Hobby / 24 h Pro | keine feste Grenze; Inaktivität bis 6 h ([lifetime](https://developers.cloudflare.com/sandbox/concepts/lifetime/index.md)) | — |
| Netzwerk-Isolation | Egress standardmäßig **offen**; `allowInternetAccess:false`, Allow/Deny-Listen ([internet](https://docs.e2b.dev/sandbox/internet-access)) | `deny-all`, Domain-Allowlist (SNI, Domain-Fronting-Risiko laut Vercel) ([firewall](https://vercel.com/docs/sandbox/concepts/firewall)) | In 1.0 **standardmäßig kein Internet**; Freigabe je Host über Outbound-Handler ([1.0](https://developers.cloudflare.com/sandbox/sdk/migrate/changes-in-1-0/)) | Code läuft im Browser des Nutzers; lädt von CodeSandbox-CDN |
| Vorschau-URL | `5173-<id>.e2b.app`, öffentlich; optional Pflicht-Header `e2b-traffic-access-token` ([restrict](https://docs.e2b.dev/network/restrict-public-access.md)) | `sandbox.domain(port)`, öffentlich; Auth nicht dokumentiert | Routing im eigenen Worker, eigene (Wildcard-)Domain, **Auth selbst bauen** ([previews](https://developers.cloudflare.com/sandbox/previews/index.md)) | `id-port.nodebox.codesandbox.io` |
| Anbindungsaufwand | mittel: Adapter + Edge-Call; Token-Header passt nicht zu iframe-`src` → eigener Proxy nötig | mittel: Adapter; Vorschau öffentlich ohne Token → eigener Proxy | mittel–hoch: eigener Worker (Sandbox-Binding, Preview-Routing, Auth), eigene Vorschau-Domain | niedrig technisch, aber Lizenz blockiert |
| Mandantentrennung | eine Sandbox je Sitzung (microVM laut Anbieter, nicht verifiziert) | eine Sandbox je Sitzung | ein Container je Sandbox-ID (Durable Object) | Code im Browser des jeweiligen Nutzers |

WebContainer (StackBlitz): Produktion in kommerziellem Umfeld lizenzpflichtig
([enterprise](https://webcontainers.io/enterprise)) — wie vorgegeben **nicht** eingebaut.

**Rechnung Schätzung (Annahmen offen):** 15 min aktiv, 2 vCPU.
E2B: 2×900×0.000014 + 4×900×0.0000045 = 0.0252 + 0.0162 ≈ $0.041.
Cloudflare `standard-3`: CPU 2×900×0.00002 = $0.036 (100 %) bzw. $0.0036 (10 %), RAM 8×900×0.0000025 = $0.018,
Disk 16×900×0.00000007 ≈ $0.001. `npm install` erzeugt kurz Volllast, danach liegt ein Dev-Server
überwiegend im Leerlauf — die 10-%-Annahme ist **nicht gemessen**.

---

## 3. Empfehlung

**Cloudflare Sandbox SDK (Option b), unter Vorbehalt; Rückfall E2B-EU-Cluster.**

Begründung:
- Einzige Option mit dokumentierter EU-Bindung der Ausführung (`jurisdiction: "eu"`) plus DPA mit SCC.
- Apache-2.0-SDK; Abrechnung nur aktiver CPU; Ausgehendes Netz standardmäßig aus (passt zu „so eng wie möglich“).
- Liegt auf dem vorhandenen Cloudflare-Stack (Pages). Ob dasselbe Konto genutzt werden kann: **nicht geprüft**.
- Sandpack scheidet für Vite aus (Nodebox-Lizenz). Vercel hat EU-Regionen und DPA, aber unbelegte EU-Preise und
  eine öffentliche Vorschau-URL ohne dokumentierte Auth. E2B-EU ist auf Antrag möglich, Vertrag aber US-Recht/Schiedsverfahren.

Vorbehalte (vor Produktion klären):
- Scheduling-Policy `durable_object` ist Beta.
- Images/Snapshots fallen nicht unter `jurisdiction: "eu"` — im Image dürfen keine Kundendaten liegen (ist bei
  diesem Design so: Kundendateien kommen erst zur Laufzeit hinein).
- Vorschau-Auth und -Routing müssen selbst gebaut werden; die Vorschau braucht eine **eigene registrierbare
  Domain** (keine Subdomain von `realsyncdynamicsai.de`, sonst gleiche Site). Der Code lehnt App-Host und
  Subdomains bereits ab (`isForeignHttpsUrl`).
- Kostenannahme je Sitzung: **≈ $0.02–0.06** + $5/Monat Workers Paid. Obergrenze durch die festen Limits:
  20 Sitzungen × $0.055 ≈ $1.10 je Mandant und Tag; global höchstens 10 gleichzeitig.

**Ohne EU-Beleg nicht produktionsfähig:** Vercel (EU-Preise und Vorschau-Auth offen), E2B (nur nach Freischaltung
des EU-Clusters und DPA-Prüfung), Sandpack (EU nicht verifiziert, Lizenz).

---

## 4. Implementiert / getestet / nur Fake

| Teil | Datei | Status |
|---|---|---|
| Schnittstelle `PreviewRuntime` (start, writeFiles, status, stop, previewUrl) | `supabase/functions/_shared/preview-sandbox/types.ts` | implementiert |
| Feste Limits + atomare Reservierung | `.../preview-sandbox/limits.ts` — 15 min hart, 3 min Leerlauf, 1 gleichzeitig je Mandant, 10 global, 20 je Mandant und Tag | implementiert, getestet (Fake) |
| Dateiprüfung, fester Startbefehl, Egress-Allowlist | `.../preview-sandbox/files.ts` — kein `.env`/`.npmrc`/`..`/`node_modules`, nur Registry-Versionen, `npm install --ignore-scripts`, `vite --cors` | implementiert, getestet (Fake) |
| Sitzungsverwaltung (Autorisierung, Mandantentrennung, Sweep, fremde Origin) | `.../preview-sandbox/manager.ts` | implementiert, getestet (Fake) |
| Fake-Adapter | `.../preview-sandbox/fake-runtime.ts` | implementiert; **führt keinen Code aus** |
| Edge-Endpunkt `siteos/code-preview` | `supabase/functions/siteos/handlers/code-preview.ts`, Router `siteos/index.ts` | implementiert; ohne `APP_BUILDER_SANDBOX_PREVIEW=true` → 404; mit Flag → 503, weil kein Anbieter-Adapter und kein dauerhafter Store existieren. **Nicht deployt, nicht ausgeführt** (kein Deno im Container). |
| Browser-Client + Panel | `src/features/app-builder/preview-runtime/client.ts`, `SandboxPreviewPanel.tsx`, Reiter „Laufzeit“ in `BoltWorkbench.tsx` | implementiert hinter `VITE_APP_BUILDER_SANDBOX_PREVIEW` (Standard aus); iframe ohne `allow-same-origin`; Heartbeat 30 s; Stopp bei Unmount und `pagehide` (`keepalive`) |
| Echter Anbieter-Adapter (Cloudflare/E2B) | — | **nicht implementiert**: kein Konto, kein Schlüssel; Paket-Installation für Agenten gesperrt |
| Dauerhafter Limit-Store (Postgres-RPC, Advisory-Lock) | — | **geplant**, braucht Migration (Freigabe) |

**Abnahmekriterien:**

| Kriterium | Ergebnis |
|---|---|
| React-Projekt (Vite + React, mehrere Dateien, ein npm-Paket) startet und ist sichtbar | **Nur gegen Fake.** Test `startet ein Vite+React-Projekt …` (6 Dateien, `clsx`). Mit echter Laufzeit **nicht belegt**: kein Anbieterkonto. Offen auch: Vite-Host-Freigabe (`server.allowedHosts`) und HMR-WebSocket unter opaker Origin — nicht verifiziert. |
| Kostenlimit greift; parallele Starts umgehen es nicht | getestet (Fake): Tageslimit, Parallelstarts je Mandant, global, Tageslimit parallel, Fehlstart zählt. Gegenprobe: Mit einem eingebauten `await` zwischen Zählen und Eintragen schlagen genau die drei Paralleltests fehl. |
| Sandbox endet nach Zeitlimit und nach Schließen | getestet (Fake): harte Grenze trotz Heartbeats, Leerlauf-Stopp, `stop('closed')`; Panel ruft `stop` bei Unmount und `pagehide` (UI-Test nur in CI). |
| EU-Standort und AVV je Option | §2, mit Quellen; offene Punkte markiert. |
| Mandant A erreicht Sandbox/Vorschau von B nicht | getestet (Fake): status/heartbeat/write/stop fremder Sitzung → 404; fremdes oder geratenes Token → 404. Grenze: Wer eine Vorschau-URL kennt, kann sie öffnen (Capability-URL) — echter Adapter braucht Proxy-Auth. |
| Flag aus: Verhalten unverändert | Panel nur bei `sandboxPreview && pane === 'runtime'`; Reiterleiste ohne Flag identisch. Bestehende Tests: **nicht lokal ausgeführt** (siehe unten). |
| `npm run lint`, `npm test`, `npm run build` | ausgeführt, **alle abgebrochen** (keine Abhängigkeiten installiert): siehe Prüfprotokoll. |
| Lizenzhinweise | Kein fremder Code übernommen. bolt.diy-Hinweise bestehen (`docs/builder/BOLT_DIY_LICENSE.txt`). Muster „Server-Sandbox je Projekt“ nach open-lovable (MIT) nur konzeptionell, kein Code kopiert. |

**Prüfprotokoll (wörtlich, 22.11.2026, Container ohne `node_modules`):**

```
$ npm run lint
Error: Cannot find module '/home/user/RealSyncDynamics.AI/node_modules/typescript/lib/tsc.js'
$ npm test
sh: 1: vitest: not found
$ npm run build
✓ src/config/spaRoutes.generated.ts (556 Routen)
sh: 1: vite: not found
```

Ersatzprüfung (TEILWEISE): `test/app-builder/sandbox-preview.test.ts` mit Node 22 (Type-Stripping) und
einer minimalen `vitest`-Ersatzschicht ausgeführt → **16 passed, 0 failed**. `node --check` auf alle neuen
`.ts`-Dateien ohne Fehler. Nicht lokal geprüft: TypeScript-Typen, `sandbox-preview-ui.test.tsx`, bestehende
Suite, Build. **Maßgeblich ist die CI auf dem Head des Draft-PRs.**

---

## 5. Offene Entscheidungen für Dominik

1. **Anbieter**: Cloudflare (empfohlen) oder E2B-EU. Danach DPA-Prüfung und Eintrag ins Verarbeitungsverzeichnis.
2. **Konto und Budget**: Workers Paid ($5/Monat) bzw. E2B Pro ($150/Monat); monatliche Obergrenze.
3. **Kontingent je Tarif**: Sitzungen/Tag, Laufzeit, Gleichzeitigkeit — heute fest im Code (`PREVIEW_LIMITS`), keine Preisänderung.
4. **Vorschau-Domain**: eigene registrierbare Domain für Vorschauen (fremde Site).
5. **Migration** für den dauerhaften, atomaren Limit-Store (Muster `bot_usage_budget_hardening`).
6. **README-Widerspruch** (§1): Freeze-Text anpassen oder Route sperren.

## 6. Nächster Schritt

Nach Anbieterentscheidung und Konto: Adapter `cloudflare-sandbox` (Worker mit Sandbox-Binding,
`jurisdiction: "eu"`, Outbound nur `registry.npmjs.org`, Vorschau-Proxy mit Sitzungs-Token) gegen
`PreviewRuntime` bauen. Danach Store-Migration als Entwurf und ein Messlauf (Kaltstart, `npm install`-Dauer,
CPU-Anteil) zur Kostenkalibrierung.
