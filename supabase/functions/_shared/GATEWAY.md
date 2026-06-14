# Gateway-Helfer (`_shared/gateway.ts`)

Gemeinsame CORS-/Response-Bausteine fuer Edge Functions. Ersetzt die bisher
~70x kopierte `corsHeaders`-Konstante + manuelles OPTIONS-/JSON-Handling.

## Migration einer bestehenden Function

```diff
- const corsHeaders = {
-   'Access-Control-Allow-Origin': '*',
-   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
-   'Access-Control-Allow-Methods': 'POST, OPTIONS',
- };
+ import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

  Deno.serve(async (req) => {
-   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
+   const preflight = handleOptions(req, corsHeaders);
+   if (preflight) return preflight;
    ...
  });
```

- Nur `GET`/`OPTIONS`-Endpoints (z.B. `health`): `buildCorsHeaders('GET, OPTIONS')`
  statt der `POST`-Default-`corsHeaders`.
- Lokale `json()`/`jsonError()`-Helfer koennen entfernt werden, sofern das
  Error-Format bereits `{ ok: false, error: { code, message } }` ist
  (Standard in den meisten Functions).

## Status

Migriert als Referenz: `health`, `gdpr-audit`. Weitere Functions werden
inkrementell beim naechsten Touch umgestellt — kein Big-Bang-Refactor, da
jede Function einzeln deploybar/testbar bleiben soll.
