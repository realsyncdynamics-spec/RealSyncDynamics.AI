# Runbook — Sentry Error Tracking

**Status:** GitHub Secret erforderlich  
**Referenz:** docs/runbooks/p0-2-migration-reconciliation.md (Punkt: "Danach noch offen")

No-op ohne `VITE_SENTRY_DSN`. Production-Init nur mit **`ingest.de.sentry.io`** (EU-Endpoint, DSGVO).

---

## Schnelleinstieg: GitHub Secret setzen

**Blocker aktuell:** Das Secret `VITE_SENTRY_DSN` ist nicht in GitHub Actions eingetragen.

1. GitHub: https://github.com/realsyncdynamics-spec/realsyncdynamics.ai/settings/secrets/actions
2. **New repository secret**
3. Name: `VITE_SENTRY_DSN`
4. Value: `https://<key>@<id>.ingest.de.sentry.io/<project>`
5. **Add secret**

Beim nächsten Push auf `main` wird die Sentry-Integration aktiv.

---

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

## Secrets & Workflow

Alle Secrets via GitHub Actions (`VITE_*` landen in `.github/workflows/deploy-cloudflare-pages.yml` Zeile 150):

- `VITE_SENTRY_DSN` — `https://…@….ingest.de.sentry.io/…` (muss gesetzt sein!)
- optional `VITE_COMMIT_SHA` im Cloudflare-Pages-Build (für Release-Tagging)
- optional `VITE_SENTRY_TRACES_SAMPLE_RATE` (`0.0`–`1.0`, default: 0.08 in Prod)

**Wichtig:** Variable muss zur **Build-Zeit** verfügbar sein (Vite backt `import.meta.env` in den Output).

## Verifizierung

```js
// Browser Console auf realsyncdynamicsai.de:
Sentry  // sollte defined sein
window.__SENTRY__  // globale Sentry-Objektreferenz

// Test-Error auslösen:
throw new Error('sentry-smoketest')
```

Issue sollte innerhalb ~30s in Sentry Dashboard erscheinen.

**⚠️ US-DSN verworfen:** DSN `ingest.sentry.io` (ohne `.de`) wird in Production nicht initialisiert (siehe `src/lib/sentry.ts` `isEuSentryDsn()`).
