/**
 * GET /api/company-voice
 *
 * Liefert nur die Allowlist öffentlicher Unternehmensinfos.
 * Staging-Lesen: SECOND_BRAIN_READ_ENABLED=true und SECOND_BRAIN_STAGING_URL
 * (https, Hostname enthält "staging"; localhost nur für Tests).
 * Production: beide Variablen leer lassen.
 * SECOND_BRAIN_AI_ENABLED bleibt ohne Wirkung (kein Modellaufruf).
 */
import { handleCompanyVoiceRequest } from '../../src/lib/company-voice/endpoint';
import type { CompanyVoiceEnv } from '../../src/lib/company-voice/types';

export function onRequest(context: { request: Request; env?: CompanyVoiceEnv }): Promise<Response> {
  return handleCompanyVoiceRequest(context.request, context.env ?? {});
}
