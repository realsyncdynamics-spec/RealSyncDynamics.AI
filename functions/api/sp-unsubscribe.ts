/**
 * /api/sp-unsubscribe — Abmeldung von Subprozessor-Änderungsmitteilungen (Issue #2282).
 * GET = Bestätigungsansicht ohne Zustandsänderung, POST = Abmeldung (Formular + RFC 8058 One-Click).
 * Logik: src/lib/emailUnsubscribe.ts
 */
import { UNSUBSCRIBE_LISTS, createRestUnsubscribeRpc, handleUnsubscribe } from '../../src/lib/emailUnsubscribe';
import { PRODUCTION_SUPABASE_ANON_KEY, PRODUCTION_SUPABASE_URL } from '../../src/lib/supabaseUrl';

export async function onRequest(context: { request: Request }): Promise<Response> {
  return handleUnsubscribe(
    context.request,
    UNSUBSCRIBE_LISTS.sp,
    createRestUnsubscribeRpc(PRODUCTION_SUPABASE_URL, PRODUCTION_SUPABASE_ANON_KEY),
  );
}
