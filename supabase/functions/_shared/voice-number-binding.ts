// Rufnummer → Bot → Tenant für eingehende Anrufe.
//
// Einzige Quelle für den Tenant eines Anrufs ist `voice_number_bindings`
// (Migration 20260927143000_voice_runtime_foundation.sql): die angerufene
// Nummer, serverseitig aufgelöst. Niemals Query-Parameter, Body-Felder oder
// Provider-Payload — die kontrolliert der Aufrufer.
//
// Ohne Supabase-Import, damit normalizeE164 in Vitest prüfbar bleibt.

export type TelephonyProvider = 'telnyx' | 'twilio' | 'sip' | 'test';

export interface VoiceNumberBinding {
  id: string;
  tenant_id: string;
  bot_id: string;
}

/** E.164 wie in der CHECK-Bedingung der Tabelle; alles andere → null. */
export function normalizeE164(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const compact = raw.replace(/[\s\-().]/g, '');
  return /^\+[1-9][0-9]{6,14}$/.test(compact) ? compact : null;
}

interface BindingQuery {
  from(table: string): {
    select(cols: string): {
      eq(col: string, val: string): any;
    };
  };
}

/** Aktive Bindung der angerufenen Nummer beim Provider — oder null (fail-closed). */
export async function resolveVoiceNumberBinding(
  admin: BindingQuery,
  calledNumber: unknown,
  provider: TelephonyProvider,
): Promise<VoiceNumberBinding | null> {
  const e164 = normalizeE164(calledNumber);
  if (!e164) return null;
  const { data, error } = await admin
    .from('voice_number_bindings')
    .select('id, tenant_id, bot_id')
    .eq('phone_number_e164', e164)
    .eq('telephony_provider', provider)
    .eq('status', 'active')
    .maybeSingle();
  if (error) {
    console.error(JSON.stringify({ level: 'error', scope: 'voice_number_binding_lookup', error: error.message }));
    return null;
  }
  return (data as VoiceNumberBinding | null) ?? null;
}
