// media-studio — Deno-Verdrahtung. Logik und Gates: handler.ts (vitest-getestet).
//
// Edge-Secrets (alle serverseitig, nie im Browser-Bundle):
//   MEDIA_STUDIO_ENABLED        'true' schaltet frei; alles andere = aus (Default aus)
//   MEDIA_STUDIO_SIGNING_SECRET ≥ 32 Zeichen, bindet Job-Tokens und Assets an den Mandanten
//   GEMINI_API_KEY              Google Gemini API (AI Studio)
//   HIGGSFIELD_API_KEY_ID / HIGGSFIELD_API_KEY_SECRET
//   MEDIA_GOOGLE_IMAGE_MODEL, MEDIA_GOOGLE_VIDEO_MODEL,
//   MEDIA_HIGGSFIELD_IMAGE_MODEL, MEDIA_HIGGSFIELD_VIDEO_MODEL   optionale Modell-Overrides
//
// Wirkt erst nach `supabase functions deploy media-studio` (Deploy-Freigabe nötig).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildCorsHeaders } from '../_shared/gateway.ts';
import { requireAuthAndTenant } from '../_shared/auth.ts';
import { gateFeature } from '../_shared/entitlements.ts';
import { requireVerifiedAiResidency } from '../_shared/residencyGuard.ts';
import { recordAiCallEvidence } from '../_shared/aiGateway/callEvidence.ts';
import type { WindowState } from '../_shared/aiGateway/rateLimit.ts';
import { MEDIA_MODELS } from '../_shared/mediaStudio/catalog.ts';
import { createMediaStudioHandler, type Residency } from './handler.ts';

const MINUTE_WINDOWS = new Map<string, WindowState>();
const HOUR_WINDOWS = new Map<string, WindowState>();

// deno-lint-ignore no-explicit-any
let admin: any | null = null;
// deno-lint-ignore no-explicit-any
function getAdmin(): any {
  if (admin) return admin;
  const url = Deno.env.get('SUPABASE_URL');
  const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !srk) throw new Error('admin client not configured');
  admin = createClient(url, srk, { auth: { persistSession: false } });
  return admin;
}

Deno.serve(
  createMediaStudioHandler({
    cors: buildCorsHeaders('POST, OPTIONS'),
    enabled: () => (Deno.env.get('MEDIA_STUDIO_ENABLED') ?? '').toLowerCase() === 'true',
    authenticate: async (req, clientTenantId) => {
      const auth = await requireAuthAndTenant(req, typeof clientTenantId === 'string' ? clientTenantId : null);
      if (auth instanceof Response) return auth;
      return { userId: auth.user.id, tenantId: auth.tenantId };
    },
    hasEntitlement: async (tenantId) => {
      try {
        await gateFeature(getAdmin(), tenantId, 'siteos.builder');
        return true;
      } catch {
        return false;
      }
    },
    resolveResidency: async (tenantId, userId): Promise<Residency> => {
      const result = await getAdmin().rpc('resolve_ai_residency', { p_tenant_id: tenantId, p_user_id: userId });
      return requireVerifiedAiResidency(result);
    },
    providerConfig: () => ({
      googleApiKey: Deno.env.get('GEMINI_API_KEY') ?? undefined,
      higgsfieldKeyId: Deno.env.get('HIGGSFIELD_API_KEY_ID') ?? undefined,
      higgsfieldKeySecret: Deno.env.get('HIGGSFIELD_API_KEY_SECRET') ?? undefined,
      modelOverrides: Object.fromEntries(MEDIA_MODELS.map((m) => [m.envModel, Deno.env.get(m.envModel) ?? undefined])),
    }),
    signingSecret: () => Deno.env.get('MEDIA_STUDIO_SIGNING_SECRET') ?? undefined,
    fetch: (input, init) => fetch(input, init),
    recordEvidence: (row) => recordAiCallEvidence(getAdmin(), row),
    now: () => Date.now(),
    requestId: () => crypto.randomUUID(),
    minuteWindows: MINUTE_WINDOWS,
    hourWindows: HOUR_WINDOWS,
    log: (entry) => console.log(JSON.stringify(entry)),
  }),
);
