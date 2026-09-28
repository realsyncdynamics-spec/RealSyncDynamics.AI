# Runbook — Sentry Error Tracking

No-op ohne `VITE_SENTRY_DSN`. Production-Init nur mit **`ingest.de.sentry.io`** (EU-Endpoint, DSGVO); US-DSN wird verworfen (`isEuSentryDsn()`).

## Aktivieren: GitHub Secret setzen

Code ist fertig, es fehlt nur das Secret (Build-Zeit — Vite backt `import.meta.env` ein):

1. Repo → Settings → Secrets and variables → Actions → **New repository secret**
2. Name `VITE_SENTRY_DSN`, Wert `https://<key>@<id>.ingest.de.sentry.io/<project>`
3. Nächster Deploy (`.github/workflows/deploy-cloudflare-pages.yml`) aktiviert Sentry.

Optional: `VITE_COMMIT_SHA` (Release-Tag), `VITE_SENTRY_TRACES_SAMPLE_RATE` (`0.0`–`1.0`).

## Konfiguration (`src/lib/sentry.ts`)

| Knob | Default Prod | Zweck |
|---|---|---|
| `sendDefaultPii` | false | keine IP |
| `tracesSampleRate` | 0.08 | INP/Navigation; Override `VITE_SENTRY_TRACES_SAMPLE_RATE` |
| `replays*` | 0 | kein Session-Replay ohne Consent |
| `allowUrls` | eigene Domain + localhost | Extension-Noise raus |
| `denyUrls` | chrome-ext, GTM, Meta | Third-Party |
| `ignoreErrors` | ChunkLoadError, NetworkError, ResizeObserver | Deploy- und Browser-Rauschen |
| `release` | `realsync-web@$VITE_COMMIT_SHA` | optional im Pages-Build setzen |
| `beforeSend` | Query, Cookies, Header, E-Mail im Message-Text | DSGVO-konform |

`tracePropagationTargets`: eigene Site + `*.supabase.co`. Kein Tunnel (bräuchte einen Worker-Proxy).

## Verifizieren

Browser-Console auf der Live-Site: `window.__SENTRY__` ist gesetzt; `setTimeout(() => { throw new Error('sentry-smoketest') })` erscheint nach ~30 s im Sentry-Projekt.
