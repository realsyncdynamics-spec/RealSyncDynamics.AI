# Sentry Setup — M1 Pilot

Sentry-Integration ist im Code bereits vorbereitet (`src/lib/sentry.ts`). Sie ist
**no-op**, solange `VITE_SENTRY_DSN` nicht gesetzt ist — das bedeutet die App
funktioniert auch ohne Sentry, ein vergessenes Setup verursacht keinen Crash.

## Was die Integration tut

- **Error-Capture** für JavaScript-Errors und unhandled Promise-Rejections
- **Trace-Sampling** auf 10 % (für Performance-Monitoring)
- **PII-Schutz**:
  - `sendDefaultPii: false` — IP-Adressen werden NICHT erfasst
  - `beforeSend`-Hook strippt User-Email aus Error-Kontext, lässt nur User-ID übrig
  - Replay-Sampling auf 0 % (UI-Recordings deaktiviert bis explizites Consent-Toggle existiert)

## Setup (~5 Minuten)

1. **Sentry-Projekt anlegen** auf [sentry.io](https://sentry.io)
   - Plattform: `React`
   - Name: `realsyncdynamics-ai-frontend`
   - Free-Tier: 5k Errors/Monat reicht für M1-Pilot
   - **Region: EU** (DSGVO — bei Account-Anlage wählbar; nachträglicher Wechsel erfordert neuen Account)

2. **DSN kopieren** aus dem Projekt-Settings → Client Keys (DSN)
   - Format: `https://<key>@<id>.ingest.de.sentry.io/<project-id>` (DE-Region) oder `…ingest.us.sentry.io/…` (US — vermeiden)

3. **GitHub-Secret setzen**: Repository → Settings → Secrets and variables → Actions → New repository secret
   - Name: `VITE_SENTRY_DSN`
   - Value: die DSN aus Schritt 2

4. **Im Deploy-Workflow weiterreichen** — `.github/workflows/deploy-frontend.yml` baut bereits mit `VITE_*`-Variablen aus dem Workflow-Env. Falls noch nicht da, ergänzen:
   ```yaml
   - run: npm run build
     env:
       VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
       VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
       VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
   ```

5. **Deploy auslösen**: `gh workflow run deploy-frontend.yml` oder einen kosmetischen Commit pushen.

6. **Verifikation** — Sentry-Issue erzeugen:
   - Browser DevTools-Console öffnen auf der Live-Site
   - `throw new Error('sentry-smoketest')` ausführen
   - Innerhalb von ~30 Sekunden im Sentry-Dashboard unter „Issues" sichtbar

## Lokales Testing (optional)

```bash
echo 'VITE_SENTRY_DSN=https://...' >> .env.local
npm run dev
# Console: throw new Error('local-smoketest')
```

## Was als nächstes

- **Alert-Rules** in Sentry definieren (z.B. „mehr als 10 Errors derselben
  Issue-Gruppe in 5 Minuten" → Slack/Email-Notification)
- **Release-Tracking** via `@sentry/vite-plugin` und Source-Maps-Upload —
  Folge-Schritt sobald Deploy-Frequenz das rechtfertigt
- **Performance-Sampling** auf 100 % erhöhen, sobald Quota es zulässt
