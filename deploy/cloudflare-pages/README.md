# Cloudflare Pages Deploy

Ersetzt Vercel. Automatisches Deploy bei jedem `git push` auf `main`.

## Einmalig im Cloudflare-Dashboard einrichten

### 1. Pages-Projekt anlegen

1. Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Repository: `realsyncdynamics-spec/RealSyncDynamics.AI`
3. Branch: `main`

### 2. Build-Einstellungen

| Feld | Wert |
|---|---|
| Framework preset | `None` (manuell) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | *(leer lassen)* |
| Node.js version | `20` |

### 3. Env Vars (Settings → Environment Variables → Production)

| Variable | Wo holen |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `VITE_STRIPE_PRICE_STARTER` | Stripe → Products → Starter → Price ID |
| `VITE_STRIPE_PRICE_GROWTH` | Stripe → Products → Growth → Price ID |
| `VITE_STRIPE_PRICE_AGENCY` | Stripe → Products → Agency → Price ID |
| `VITE_SENTRY_DSN` | Sentry → Project Settings → DSN *(optional)* |

### 4. Custom Domain

Settings → Custom Domains → **Add domain** → `realsyncdynamicsai.de`

Cloudflare setzt den DNS-Record automatisch (da Domain bereits in Cloudflare).

---

## Was automatisch passiert

- `public/_redirects` → SPA-Fallback (alle Routen → `index.html`)
- `public/_headers` → Security-Headers (HSTS, X-Frame-Options, etc.)
- `wrangler.toml` → Build-Output-Dir-Konfiguration

## Stripe Webhook

Der Stripe-Webhook zeigt auf die Supabase Edge Function — bleibt unverändert:
`https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/stripe-webhook`

## Lokaler Test

```bash
npm run build
npx wrangler pages dev dist --port 3001
```
