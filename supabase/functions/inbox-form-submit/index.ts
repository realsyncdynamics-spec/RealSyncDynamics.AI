// inbox-form-submit — öffentliches Kontaktformular einer veröffentlichten
// SiteOS-Seite → Posteingang des zugeordneten Empfangsassistenten (PR C,
// Schritt 3). Siehe Migrationen 20261114100000_site_inbox_bindings.sql und
// 20261114100100_inbox_handoff.sql.
//
// Auth: keine (verify_jwt = false in supabase/config.toml). Der einzige
// Schlüssel ist die serverseitig erzeugte `site_ref`; Auflösung fail-closed
// über public.resolve_site_inbox (nur service_role). Kein KI-Aufruf.
//
// Secrets: INBOX_FORM_HASH_SALT (HMAC für IP-Hash). Fehlt es, antwortet die
// Function 503 und schreibt nichts — die Function ist damit bis zur
// bewussten Inbetriebnahme aus. Nicht in src/config/production-edge-functions.ts
// (nicht deployt, kein Frontend-Aufrufer).
//
// Logik: handler.ts / logic.ts / repo.ts, getestet in test/edge/inbox-form-submit.test.ts.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonError } from '../_shared/gateway.ts';
import { handleInboxFormSubmit } from './handler.ts';
import { createSupabaseRepo } from './repo.ts';

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const hashSalt = Deno.env.get('INBOX_FORM_HASH_SALT') ?? '';
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return jsonError(500, 'INTERNAL', 'server not configured');
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    return await handleInboxFormSubmit(req, { repo: createSupabaseRepo(admin), hashSalt });
  } catch (e) {
    console.error('[inbox-form-submit]', e instanceof Error ? e.message : String(e));
    return jsonError(500, 'INTERNAL', 'unexpected error');
  }
});
