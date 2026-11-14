/**
 * GET /api/company-voice/live (WebSocket)
 *
 * Live-Stimme der Landing-Demo über xAI Grok Realtime.
 * Aus, solange nicht beide gesetzt sind (Cloudflare Pages, verschlüsselt):
 *   COMPANY_VOICE_GROK_ENABLED=true
 *   XAI_API_KEY=…            (nie loggen, nie als VITE_*)
 * Optional: COMPANY_VOICE_GROK_MODEL (Default grok-voice-latest),
 *           COMPANY_VOICE_GROK_VOICE (Default eve).
 * Grenzen und Protokoll: src/lib/company-voice/grok-relay.ts
 */
import { handleCompanyVoiceLiveRequest } from '../../../src/lib/company-voice/grok-relay';
import type { CompanyVoiceEnv } from '../../../src/lib/company-voice/types';

export function onRequest(context: { request: Request; env?: CompanyVoiceEnv }): Promise<Response> {
  return handleCompanyVoiceLiveRequest(context.request, context.env ?? {});
}
