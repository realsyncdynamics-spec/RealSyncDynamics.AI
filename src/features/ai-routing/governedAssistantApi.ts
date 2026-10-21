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
  if (error) throw new Error('Richtlinienprüfung oder EU-KI derzeit nicht verfügbar. Es wurden keine Aktionen ausgeführt.');
  if (!data || data.ok !== true || data.route !== 'eu_private'
      || (data.provider !== 'lm_studio' && data.provider !== 'ollama')
      || typeof data.output !== 'string') {
    throw new Error('Die KI-Antwort konnte nicht verifiziert werden.');
  }
  return data as GovernedAssistantAnswer;
}
