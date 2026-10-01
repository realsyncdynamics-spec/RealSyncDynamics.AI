# browser-run-executor — Governed Browser Executor auf Cloudflare Browser Run

Ersetzt den Executor-Container (`deploy/playwright-scanner`, Hostinger-VPS läuft
am **04.10.2026** aus) als Host für die Governed Browser Runtime. Gleicher
HTTP-Vertrag, gleicher Aktions-/Sicherheitskern (`deploy/playwright-scanner/session-core.ts`)
— die Edge Function `browser-execute` bleibt unverändert und spricht ihn über
`PLAYWRIGHT_SCANNER_URL` / `PLAYWRIGHT_SCANNER_KEY`.

**Status: gebaut und mit Fakes getestet, NICHT deployt, nicht gegen echtes
Browser Run gelaufen.** Kein Deploy-Workflow — Inbetriebnahme nur nach GO.

## Aufbau

| Teil | Datei | Aufgabe |
|---|---|---|
| Worker | `src/router.ts` | Auth (`SCANNER_API_KEY`, konstante Zeit, auch `/health`), Health aus `limits()`, Weiterleitung an das Durable Object |
| Durable Object | `src/session-object.ts` | 1 Session = 1 Objekt (Name = `executor_session_id`, **EU-Jurisdiktion**) = 1 Browser, Kontext, Seite |
| Kern | `deploy/playwright-scanner/session-core.ts` | Aktionen, `expected_url` → `PAGE_CHANGED`, Landeprüfung, nur Fehlercodes |
| Netz | `deploy/playwright-scanner/netguard.ts` | Route-/WebSocket-Guard, DNS über DoH (`cloudflare-dns.com`) |
| Einstieg | `src/index.ts` | einzige Stelle mit `@cloudflare/playwright` und echten Bindungen |

Endpunkte: `GET /health`, `POST /session/open|frame|close`, `POST /execute`.
`/scan/*` gibt es hier nicht (`501 SCAN_NOT_SUPPORTED_ON_THIS_RUNTIME`).

Lebensdauer: Alarm alle 10 s; Leerlauf 15 min, Höchstalter 60 min (wie
`browser-execute`). Browser Run schließt nach höchstens 10 min ohne Befehl —
ein Lebenszeichen alle 4 min hält den Browser, ohne die Leerlauf-Frist zu
verlängern. Geht das Objekt verloren, wird die Session **nie still neu
angelegt**: `SESSION_NOT_FOUND`, der verwaiste Browser wird geschlossen.

## Unterschiede zum Node-Executor (ehrlich)

- **Kein Egress-Proxy möglich:** Browser Run lässt keinen Proxy vor dem Browser
  zu. HTTP-Redirect-Hops sieht der Route-Guard nicht (Playwright-Grenze) — die
  **Landeprüfung** setzt eine so erreichte Seite auf `about:blank`, bevor Bild,
  Text oder DOM den Executor verlassen. Die Anfrage selbst hat das Ziel dann
  erreicht; im Cloudflare-Netz gibt es kein Kunden-LAN und keinen
  Metadaten-Dienst des Hosts, das Restrisiko ist dokumentiert.
- **Keine Downloads** (`acceptDownloads: false`, Capability fehlt).
- **Datenstandort:** Das Durable Object läuft in der EU-Jurisdiktion. Browser
  Run selbst ist „global by default“ (startet nahe am Aufrufer) — **keine
  vertragliche EU-Standortgarantie für den Browser**. Vor Produktivbetrieb
  DSGVO-seitig bewerten (AVV/DPA Cloudflare, Verzeichnis der Verarbeitungen).
- `require_session` muss ausdrücklich `false` sein, damit `/execute` eine
  Session anlegt (browser-execute sendet immer `true`).

## Inbetriebnahme (nur nach GO)

Voraussetzungen: Cloudflare-Konto mit **Workers Paid** (Browser Run: 10
gleichzeitige Browser und 10 Browser-Stunden/Monat inklusive, darüber
$2 je zusätzlichem gleichzeitigem Browser im Monatsmittel und $0,09 je
Browser-Stunde; Durable Objects nach Nutzung).

```bash
cd workers/browser-run-executor
npm install
npx wrangler login
npx wrangler secret put SCANNER_API_KEY      # starker Zufallswert, z. B. openssl rand -hex 32
npx wrangler deploy --dry-run --outdir dist  # Bundle prüfen
npx wrangler deploy                          # erst nach GO
```

Danach in Supabase (Edge-Function-Secrets):

```bash
supabase secrets set PLAYWRIGHT_SCANNER_URL=https://browser-run-executor.<konto>.workers.dev
supabase secrets set PLAYWRIGHT_SCANNER_KEY=<derselbe Wert wie SCANNER_API_KEY>
supabase secrets set BROWSER_EXECUTOR_ID=cf-browser-run
```

Smoke-Test (Reihenfolge): `browser-execute` `op: health` → `ready` mit
`runtime: cloudflare-browser-run` → `capabilities` → `session_create` →
`navigate` → `click` (409 `APPROVAL_REQUIRED`) → Freigabe → Ausführen →
`browser_executions` und Evidence-Kette prüfen → `session_close`.

## Tests

- `test/workers/browser-run-executor.test.ts` — Worker und Durable Object mit
  Fakes, inkl. Edge-Client gegen den Router (gleicher Vertrag).
- `test/executor/executor-chromium.test.ts` — derselbe Kern gegen echtes Chromium.
