/**
 * GET /api/company-voice/live (WebSocket)
 *
 * Live-Stimme der Landing-Demo über xAI Grok Realtime.
 * Aus, solange nicht alles gesetzt ist (Cloudflare Pages, Production):
 *   COMPANY_VOICE_GROK_ENABLED=true
 *   XAI_API_KEY=…              (verschlüsselt; nie loggen, nie als VITE_*)
 *   COMPANY_VOICE_LIVE_KV      (KV-Binding für Tageslimit und Prüfpfad)
 * Optional: COMPANY_VOICE_GROK_DAILY_SESSIONS (Default 30),
 *           COMPANY_VOICE_GROK_MODEL (Default grok-voice-latest),
 *           COMPANY_VOICE_GROK_VOICE (Default eve).
 * Einschalten: docs/cloudflare/secrets-management.md (Abschnitt Grok-Live-Stimme)
 * Grenzen und Protokoll: src/lib/company-voice/grok-relay.ts
 */
import { handleCompanyVoiceLiveRequest } from '../../../src/lib/company-voice/grok-relay';
import type { CompanyVoiceEnv } from '../../../src/lib/company-voice/types';

export function onRequest(context: {
  request: Request;
  env?: CompanyVoiceEnv;
  waitUntil?: (promise: Promise<unknown>) => void;
}): Promise<Response> {
  const waitUntil = context.waitUntil?.bind(context);
  return handleCompanyVoiceLiveRequest(context.request, context.env ?? {}, waitUntil ? { waitUntil } : {});
}
