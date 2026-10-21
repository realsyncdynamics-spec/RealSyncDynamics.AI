import { getSupabase } from '../../lib/supabase';

export type AssistantPurpose = 'general' | 'web' | 'governance' | 'compliance' | 'automation';
export type AssistantDataClass = 'unknown' | 'public' | 'internal' | 'personal' | 'special_category';
export type AssistantSelection = 'auto' | 'eu_precise';

export interface GovernedAssistantAnswer {
  ok: true;
  output: string;
  route: 'eu_private';
  provider: 'lm_studio' | 'ollama';
  profile: 'fast-local' | 'quality-local';
  model: string | null;
  trace_id: string;
}

/**
 * Calls the authenticated Edge PEP. No provider, model ID, LLM key, tool
 * command or arbitrary target endpoint can be supplied by this client.
 * Routing and authorization are decided again on the server.
 */
export async function askGovernedAssistant(args: {
  tenantId: string;
  message: string;
  purpose: AssistantPurpose;
  dataClass: AssistantDataClass;
  selection: AssistantSelection;
}): Promise<GovernedAssistantAnswer> {
  const { data, error } = await getSupabase().functions.invoke('governed-assistant', {
    body: {
      tenant_id: args.tenantId,
      message: args.message,
      purpose: args.purpose,
      data_class: args.dataClass,
      selection: args.selection,
    },
  });
  if (error) {
    // Show only reviewed, stable policy messages; never echo arbitrary upstream
    // error text or private provider details from an Edge response.
    const codes: Record<string, string> = {
      POTENTIAL_PERSONAL_DATA: 'Mögliche personenbezogene Daten erkannt. Anfrage wurde vor der KI-Übertragung blockiert.',
      DATA_CLASS_REVIEW_REQUIRED: 'Datenklasse noch ungeklärt. Anfrage wurde blockiert.',
      LEGAL_BASIS_REQUIRED: 'Vor Verarbeitung personenbezogener Daten sind Rechtsgrundlage und Freigabe erforderlich.',
      TENANT_POLICY_CONFLICT: 'Die Mandantenrichtlinie erlaubt derzeit keinen sicheren Modellpfad.',
      RUNTIME_NOT_VERIFIED: 'Der EU-KI-Ausführungsort ist noch nicht bestätigt.',
      AUDIT_UNAVAILABLE: 'Die erforderliche Audit-Protokollierung ist nicht verfügbar.',
      FORBIDDEN: 'Für diese Anfrage fehlen Mandantenberechtigungen.',
      UNAUTHORIZED: 'Bitte erneut anmelden.',
    };
    let code: string | null = null;
    try {
      const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
      const payload = await context?.json?.() as { error?: { code?: string } } | undefined;
      code = typeof payload?.error?.code === 'string' ? payload.error.code : null;
    } catch { /* Non-JSON Edge failure — keep a generic safe message. */ }
    throw new Error((code && codes[code]) || 'Richtlinienprüfung oder EU-KI derzeit nicht verfügbar. Es wurden keine Aktionen ausgeführt.');
  }
  if (!data || data.ok !== true || data.route !== 'eu_private'
      || (data.provider !== 'lm_studio' && data.provider !== 'ollama')
      || typeof data.output !== 'string') {
    throw new Error('Die KI-Antwort konnte nicht verifiziert werden.');
  }
  return data as GovernedAssistantAnswer;
}
