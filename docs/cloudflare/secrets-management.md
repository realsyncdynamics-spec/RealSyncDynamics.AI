# Cloudflare Secrets Management Guide

**Status**: Active | **Last Updated**: 2026-07-23

## Overview

This guide explains how to manage sensitive credentials for RealSyncDynamics.AI across three deployment contexts:

1. **Development**: `.env.local` (gitignored)
2. **GitHub Actions CI**: GitHub Actions Secrets
3. **Production**: Cloudflare Secrets Vault (for Workers)

---

## Secrets Classification

### Public Configuration (Not Secret)
- `SUPABASE_URL` — Public Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Public anon key (frontend access)
- `LOG_LEVEL` — Logging verbosity
- `RATE_LIMIT_*` — Rate limiting thresholds

### Sensitive Secrets (Vault Only)
- `SUPABASE_SERVICE_ROLE_KEY` — Full DB access, backend only
- `ANTHROPIC_API_KEY` — Claude API key
- `STRIPE_SECRET_KEY` — Payment API key
- `RESEND_API_KEY` — Email service key
- `OPENAI_API_KEY` — OpenAI fallback (optional)

### Environment-Specific

| Secret | Dev | GitHub Actions | Cloudflare Vault |
|--------|-----|-----------------|------------------|
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` | Secret | ✅ |
| `ANTHROPIC_API_KEY` | `.env.local` | Secret | ✅ |
| `STRIPE_SECRET_KEY` | Test key | Test secret | ✅ Live key |
| `RESEND_API_KEY` | Test key | Test secret | ✅ Live key |

---

## Development Setup

### 1. Create `.env.local` (gitignored)

```bash
# .env.local (NEVER COMMIT)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # Never use in frontend
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_test_...
RESEND_API_KEY=re_test_...
VITE_SENTRY_DSN=https://...@sentry.io/...
```

### 2. Load in Supabase Local Development

```bash
# Load env vars into local Supabase stack
supabase start  # Reads from .env.local automatically
```

### 3. Test Locally

```bash
npm run dev  # Vite picks up VITE_* vars for frontend
# Backend (Supabase functions) read from .env.local for other secrets
```

---

## GitHub Actions Secrets

### 1. Set Repository Secrets

Go to **Repository → Settings → Secrets and variables → Actions**

Add these secrets:

```
SUPABASE_URL                    → https://your-project.supabase.co
VITE_SUPABASE_URL               → https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY          → eyJhbGc...
VITE_SENTRY_DSN                 → https://...@sentry.io/...
VITE_STRIPE_PRICE_STARTER       → price_1234...
VITE_STRIPE_PRICE_GROWTH        → price_5678...
VITE_STRIPE_PRICE_AGENCY        → price_9012...
VITE_STRIPE_PRICE_STARTER_YEARLY → price_7890...
VITE_STRIPE_PRICE_GROWTH_YEARLY  → price_2345...
VITE_STRIPE_PRICE_AGENCY_YEARLY  → price_6789...

CLOUDFLARE_API_TOKEN            → (for Pages deploy)
CLOUDFLARE_ACCOUNT_ID           → (for Pages deploy)
```

### 2. Workflow Integration

In `.github/workflows/deploy-cloudflare-pages.yml`:

```yaml
env:
  VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
  VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

**Note**: Service role keys and API keys for backend stay in Supabase Edge Functions environment (not GitHub Actions).

---

## Cloudflare Secrets Vault (Production)

### 1. Store Secrets in Cloudflare Dashboard

```bash
# Via CLI:
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
# → Prompts for value, stores encrypted in Cloudflare Vault

wrangler secret put ANTHROPIC_API_KEY --env production
wrangler secret put STRIPE_SECRET_KEY --env production
wrangler secret put RESEND_API_KEY --env production
```

### 2. Store Multiple Secrets at Once

```bash
# Create a JSON file with secrets (NEVER commit this)
cat > secrets.json << 'EOF'
{
  "SUPABASE_SERVICE_ROLE_KEY": "eyJhbGc...",
  "ANTHROPIC_API_KEY": "sk-ant-...",
  "STRIPE_SECRET_KEY": "sk_live_...",
  "RESEND_API_KEY": "re_..."
}
EOF

# Bulk deploy (non-interactive, safe for CI)
wrangler secret:bulk put secrets.json --env production

# Clean up
rm secrets.json
```

### 3. Access Secrets in Workers Code

```typescript
// worker.ts
export default {
  async fetch(request: Request, env: Env) {
    // Static vars (non-secret):
    const logLevel = env.LOG_LEVEL;  // "info"
    
    // Secrets (encrypted at rest, decrypted at runtime):
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const anthropicKey = env.ANTHROPIC_API_KEY;
    
    // Return response
    return new Response(`Configured for ${logLevel}`);
  }
};
```

### 4. Environment Type Definition

```typescript
// worker-env.d.ts
interface Env {
  // Static vars
  ENVIRONMENT: string;
  LOG_LEVEL: string;
  RATE_LIMIT_WINDOW_MS: string;
  RATE_LIMIT_MAX_REQUESTS: string;
  
  // Secrets (undefined in development, populated in production)
  SUPABASE_SERVICE_ROLE_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  
  // KV Namespaces
  POLICY_CACHE: KVNamespace;
  RATE_LIMIT_STATE: KVNamespace;
  
  // R2 Buckets
  EVIDENCE_VAULT: R2Bucket;
}
```

---

## Secret Rotation

### 1. Rotate API Key (Anthropic, Stripe, etc.)

1. Generate new key in service provider dashboard
2. Store new key in Cloudflare:
   ```bash
   wrangler secret put ANTHROPIC_API_KEY --env production
   ```
3. Old key continues to work until removed from provider
4. Remove old key from provider after confirming no errors in logs

### 2. Rotate Database Password (Supabase)

1. Change password in Supabase → Database → Settings
2. Update `SUPABASE_SERVICE_ROLE_KEY` (if token-based) or connection string
3. Re-deploy functions:
   ```bash
   supabase functions deploy --project-id <proj-id>
   ```

### 3. Monitor Secret Expiry

Set calendar reminders for rotating long-lived secrets (quarterly for production):
- Stripe API keys (regenerate annually)
- Anthropic API tokens (check expiration policy)
- Database passwords (change semi-annually)

---

## Troubleshooting

### Secret Not Available in Worker

**Symptom**: `env.ANTHROPIC_API_KEY` is undefined in Worker

**Solution**:
1. Verify secret is deployed:
   ```bash
   wrangler secret list --env production
   ```
2. Confirm Worker environment matches secret environment:
   ```bash
   # In wrangler.toml
   [env.production]
   ```
3. Redeploy Worker:
   ```bash
   wrangler deploy --env production
   ```

### Secret Leaks in Logs

**Immediate Action**:
1. Rotate the leaked secret immediately
2. Review Sentry logs for any exposed values
3. Check Cloudflare WAF logs for unauthorized access

**Prevention**:
- Never log env vars directly
- Redact API keys in error messages:
  ```typescript
  const masked = key.slice(0, 7) + '***' + key.slice(-4);
  console.log(`Using key: ${masked}`);
  ```

### Development vs Production Secret Mismatch

**Symptom**: Works locally but fails in production

**Causes**:
- Using test API key in `.env.local`, live key in Cloudflare
- Missing secret in Cloudflare Vault
- Typo in secret name

**Fix**:
```bash
# List all secrets in production
wrangler secret list --env production

# Compare with .env.local
grep -v '^#\|^$' .env.local | cut -d= -f1 | sort
```

---

## Security Best Practices

### ✅ DO

- ✅ Store secrets in Cloudflare Vault for production
- ✅ Use GitHub Actions Secrets for CI builds
- ✅ Rotate secrets quarterly
- ✅ Use separate keys for dev/test/production
- ✅ Log secret names, never values
- ✅ Audit secret access in Cloudflare dashboard

### ❌ DON'T

- ❌ Commit `.env.local` or any secrets file to git
- ❌ Expose secrets in error messages or logs
- ❌ Hardcode secrets in source code
- ❌ Share secrets via Slack, email, or unencrypted channels
- ❌ Reuse production secrets in development
- ❌ Grant access to production secrets to everyone

---

## Automated Rotation (Future)

```bash
# Planned: GitHub Action for quarterly secret rotation
# .github/workflows/rotate-secrets.yml (not yet implemented)

name: Rotate Production Secrets
on:
  schedule:
    - cron: '0 0 1 * *'  # First day of each month

jobs:
  rotate:
    runs-on: ubuntu-latest
    steps:
      - name: Rotate Anthropic API key
        run: |
          # 1. Generate new key via Anthropic API
          # 2. Deploy to Cloudflare Vault
          # 3. Verify in production
          # 4. Revoke old key
```

---

## References

- [Cloudflare Secrets Documentation](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

---

**Last Updated**: 2026-07-23  
**Owner**: RealSyncDynamics Engineering  
**Status**: Production Ready

---

## Grok-Live-Stimme der Landing-Demo einschalten

Stand 17.11.2026. Code: `src/lib/company-voice/grok-relay.ts`, `src/lib/company-voice/live-ledger.ts`,
Function `functions/api/company-voice/live.ts`. Status im Code: **gebaut, ausgeschaltet**.

### Was die Live-Stimme tut

- Die Demo „Fragen zum Unternehmen“ (`/#voice`) spricht per Mikrofon mit xAI Grok Realtime.
- Der Browser verbindet sich nur mit der eigenen Origin. Der `XAI_API_KEY` bleibt in der Function.
- Antworten nur aus der Fakten-Allowlist, keine Tools, höchstens drei Minuten je Gespräch.
- Ohne Live-Stimme bleibt die bisherige Web-Speech-Demo unverändert.

### Grenzen (Kostenbremse)

| Grenze | Wert | Wo | Wirkung |
|---|---|---|---|
| Dauer je Gespräch | 180 s | `MAX_SESSION_MS` | hart, je Gespräch |
| Audio je Gespräch | Echtzeit + 25 % | `MAX_CLIENT_AUDIO_CHARS` | hart, je Gespräch |
| Gespräche je IP | 3 in 10 min | `SESSION_LIMIT` | je Cloudflare-Instanz |
| Gleichzeitige Gespräche | 5 | `MAX_CONCURRENT` | je Cloudflare-Instanz |
| Gespräche je UTC-Tag | Default 30 (1–1000) | `COMPANY_VOICE_GROK_DAILY_SESSIONS`, KV | über alle Instanzen, Näherung |
| Ausgaben | im xAI-Konto | xAI Console | **die einzige harte Kostengrenze** |

Das Tageslimit liegt in Cloudflare KV. KV ist eventuell konsistent; bei gleichzeitigen Starts kann
das Limit leicht überschritten werden. Deshalb muss das Ausgabenlimit im xAI-Konto gesetzt sein.

### Prüfpfad

Je Gespräch entstehen zwei Logzeilen (`event: company_voice.live`, Phase `started` und `ended`)
und ein Eintrag im Tagesdatensatz `live:JJJJ-MM-TT` im KV (35 Tage lesbar):
Anzahl Gespräche, Summe Sekunden, Summe Audio-Sekunden, Endgründe.
Ablehnungen ab den Limits erzeugen eine Zeile mit Phase `rejected` und Code
(`BUSY`, `RATE_LIMIT`, `DAILY_LIMIT`, `LIMIT_UNAVAILABLE`).

Nicht gespeichert: IP-Adresse, Audio, Transkript, Key. Das deckt sich mit dem Hinweis im Widget
(„Diese Seite speichert kein Audio, kein Transkript“).

Tagesdatensatz lesen:

```bash
npx wrangler kv key get --binding=COMPANY_VOICE_LIVE_KV "live:2026-11-17" --remote
```

Logzeilen: Cloudflare Dashboard → Workers & Pages → Projekt → Functions → Logs (Echtzeit),
oder `npx wrangler pages deployment tail --project-name <projekt>`.

### Fail-closed

Die Live-Stimme ist aus (`503 LIVE_VOICE_DISABLED`, Widget bietet sie nicht an), solange eines fehlt:
`COMPANY_VOICE_GROK_ENABLED=true`, `XAI_API_KEY`, KV-Binding `COMPANY_VOICE_LIVE_KV`,
gültiges Tageslimit. Ist KV beim Start nicht lesbar oder schreibbar, gibt es kein Gespräch
(`503 LIMIT_UNAVAILABLE`).

### Einschalten — Reihenfolge

Jeder Schritt braucht die Freigabe des Inhabers. Agenten führen keinen davon selbst aus.

1. **Vorbedingungen (Recht und Konto)**
   - AVV/DPA mit xAI geprüft und abgeschlossen.
   - Datenschutzerklärung und Sub-Prozessoren-Liste um xAI ergänzt.
     Entwurf: Abschnitt „Entwurf Datenschutztext“ unten.
   - Ausgabenlimit im xAI-Konto gesetzt.
2. **Live-Domain klären.** Welches Cloudflare-Pages-Projekt `realsyncdynamicsai.de` ausliefert,
   ist offen (Stand 17.11.2026: Die Domain liefert für `/api/company-voice` nur HTML).
   Ohne diese Klärung wirkt keine der folgenden Einstellungen auf der Live-Domain.
3. **KV-Namespace anlegen**
   ```bash
   npx wrangler kv namespace create company-voice-live
   ```
   Die ausgegebene ID notieren.
4. **Binding eintragen.** Hat das Pages-Projekt eine `wrangler.toml`, gelten die Bindings aus der
   Datei, nicht aus dem Dashboard. Dann als eigener PR in `wrangler.toml`:
   ```toml
   [[kv_namespaces]]
   binding = "COMPANY_VOICE_LIVE_KV"
   id = "<ID aus Schritt 3>"
   ```
   Ohne `wrangler.toml`: Dashboard → Projekt → Settings → Bindings → KV namespace.
5. **Secret und Variablen (Production)**
   - `XAI_API_KEY` als verschlüsselte Variable (Secret). Nie als `VITE_*`.
   - Optional `COMPANY_VOICE_GROK_DAILY_SESSIONS` (Default 30).
   - Zuletzt `COMPANY_VOICE_GROK_ENABLED=true`.
6. **Neu deployen**, dann prüfen:
   ```bash
   curl -s https://realsyncdynamicsai.de/api/company-voice | jq .ai
   ```
   Erwartet: `"grok-realtime"`. Dann ein echtes Gespräch unter `/#voice` und den Tagesdatensatz lesen.

### Ausschalten

`COMPANY_VOICE_GROK_ENABLED` entfernen oder auf einen anderen Wert setzen und neu deployen.
Variablen wirken bei Pages erst nach einem Deploy. Sofort wirkt nur, den Key in der xAI Console
zu sperren: Dann scheitert jeder Verbindungsaufbau, und die Demo fällt auf die Web-Speech-Stimme
zurück.

### ENTWURF — Datenschutztext für die Grok-Live-Stimme (xAI)

> **Status: Entwurf, nicht veröffentlicht, keine Rechtsberatung.** Recht und Texte auf der Website
> ändern nur mit Freigabe des Inhabers. Stellen mit `[PRÜFEN]` vor Veröffentlichung klären,
> am besten mit Datenschutzberatung. Erst danach `src/features/legal/PrivacyPolicy.tsx` und
> `src/features/legal/SubProcessors.tsx` anpassen (eigener PR).

#### Was technisch passiert (Stand Code 17.11.2026)

Belegt im Code (`src/lib/company-voice/grok-relay.ts`, `live-ledger.ts`,
`src/components/landing/v6/CompanyVoiceWidget.tsx`):

- Das Mikrofon startet erst, nachdem die Person den Hinweis im Widget bestätigt hat.
- Die Spracheingabe geht als Audio-Stream über die Cloudflare Function an xAI Grok Realtime
  (`api.x.ai`). xAI erzeugt daraus Antwort-Audio und Untertitel.
- Ein Gespräch dauert höchstens drei Minuten.
- RealSyncDynamics.AI speichert kein Audio und kein Transkript. Gespeichert werden je UTC-Tag nur
  Anzahl, Dauer, Audio-Sekunden und Endgründe der Gespräche (Cloudflare KV, 35 Tage), dazu je
  Gespräch zwei Logzeilen ohne IP.
- Zur Missbrauchsbremse hält die Function die IP-Adresse nur im Arbeitsspeicher, für das
  Zeitfenster von zehn Minuten. Abgelaufene Einträge werden bei der nächsten Anfrage an diese
  Instanz verworfen, endet die Instanz, sind sie ohnehin weg. Kein Speichern auf Datenträger.

#### Textvorschlag für die Datenschutzerklärung (neuer Abschnitt)

**KI-Sprachassistent auf der Startseite (Live-Stimme)**

Auf unserer Startseite können Sie per Mikrofon Fragen zu unserem Unternehmen stellen. Wenn Sie die
Live-Stimme starten, übertragen wir Ihre Spracheingabe an xAI [PRÜFEN: genaue Firma und Anschrift
laut Vertrag], USA. xAI wandelt die Sprache in Text um, erzeugt eine Antwort und gibt sie als
Sprache zurück. Die Antworten stammen ausschließlich aus freigegebenen Informationen über unser
Unternehmen.

Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die Sie mit dem Start der
Live-Stimme erteilen. Sie können sie jederzeit widerrufen, indem Sie das Gespräch beenden; Sie
können stattdessen auch tippen.

Die Übermittlung in die USA stützen wir auf [PRÜFEN: Standardvertragsklauseln nach Art. 46 DSGVO
im Vertrag mit xAI, oder Angemessenheitsbeschluss (EU-US Data Privacy Framework), falls xAI
zertifiziert ist, oder ausdrückliche Einwilligung nach Art. 49 Abs. 1 lit. a DSGVO].
[PRÜFEN: ob und wie lange xAI Audio und Transkripte speichert oder für Training nutzt, laut
xAI-Bedingungen für die API.]

Wir selbst speichern weder Ihre Aufnahme noch das Transkript. Wir zählen nur, wie viele Gespräche
es pro Tag gab, wie lange sie dauerten und wie sie endeten, ohne Bezug zu Ihrer Person. Ihre
IP-Adresse halten wir nur kurz im Arbeitsspeicher (Zeitfenster zehn Minuten), um Missbrauch zu
begrenzen; sie wird nicht gespeichert.

Ein Gespräch endet nach höchstens drei Minuten.

#### Ergänzung Sub-Prozessoren-Liste

| Feld | Vorschlag |
|---|---|
| Name | [PRÜFEN: Vertragspartner, z. B. X.AI LLC] |
| Zweck | Sprachverarbeitung der Live-Stimme auf der Startseite (Spracherkennung, Antwort, Sprachausgabe) |
| Region | USA |
| Garantie | [PRÜFEN: SCCs / DPF / Art. 49] |
| AVV/DPA | [PRÜFEN: Link zum unterzeichneten DPA] |

In `PrivacyPolicy.tsx`, Abschnitt 5 („Wesentliche Empfänger“), xAI ergänzen.

#### Offene Punkte

1. Vertragspartner und DPA mit xAI (abgeschlossen? mit SCCs?).
2. Speicherdauer und Trainingsnutzung bei xAI für API-Audio.
3. Ob der Widget-Hinweis als Einwilligung ausreicht oder ein ausdrücklicher Bestätigungsschritt
   mit Verweis auf die Datenschutzerklärung nötig ist.
