# Sentry Setup

No-op ohne `VITE_SENTRY_DSN`. Production-Init nur mit **`ingest.de.sentry.io`**.

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
| `beforeSend` | Query, Cookies, Header, E-Mail im Message-Text | DSGVO |

`tracePropagationTargets`: eigene Site + `*.supabase.co`. Kein Tunnel (bräuchte einen Worker-Proxy).

## Secrets

- `VITE_SENTRY_DSN` — `https://…@….ingest.de.sentry.io/…`
- optional `VITE_COMMIT_SHA` im Cloudflare-Pages-Build
- optional `VITE_SENTRY_TRACES_SAMPLE_RATE` (`0`–`1`)

Cloudflare Pages + GitHub Actions: Variable muss **Build-Zeit** gesetzt sein (Vite backt `import.meta.env`).

## Verify

```js
throw new Error('sentry-smoketest')
```

Issue innerhalb ~30s. US-DSN (`ingest.sentry.io` ohne `.de`) wird in Production verworfen.
