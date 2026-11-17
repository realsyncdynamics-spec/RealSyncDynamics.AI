// inbox-form-submit — Datenzugriff (service_role). Nur hier wird supabase-js
// berührt; handler.ts kennt ausschliesslich das Interface `InboxRepo`.
//
// Seit dem Codex-Review (14.11.2026, P2) läuft die gesamte Annahme in EINER
// Datenbanktransaktion: RPC public.inbox_form_submit_intake (Migration
// 20261114100100_inbox_handoff.sql, Abschnitt 7). Auflösung, Duplikatprüfung,
// Kontingente und die drei Inserts sind damit atomar; eine Konversation ist
// erst sichtbar, wenn sie vollständig ist. Kein Zählen-dann-Einfügen und
// keine Kompensation mehr im Handler.

export type SubmitStatus = 'received' | 'duplicate' | 'rate_limited' | 'not_found';

export interface SubmitArgs {
  site_ref: string;
  nonce: string;
  ip_hash: string;
  anliegen: string;
  kontakt_name: string | null;
  kontakt_telefon: string | null;
  kontakt_email: string | null;
  terminwunsch: string | null;
  contact_label: string;
  ip_limit: number;
  site_limit: number;
}

export type SubmitResult =
  | { status: 'received' | 'duplicate'; conversation_id: string }
  | { status: 'rate_limited' | 'not_found' };

export interface InboxRepo {
  /** Atomare Annahme; wirft nur bei technischem Fehler (→ 500 im Handler). */
  submit(args: SubmitArgs): Promise<SubmitResult>;
}

// Minimaler Typ für den Supabase-Client, damit repo.ts ohne jsr-Import bleibt
// und vitest die Datei laden kann. index.ts übergibt den echten Client.
// deno-lint-ignore no-explicit-any
export type AdminClient = any;

export function createSupabaseRepo(admin: AdminClient): InboxRepo {
  return {
    async submit(a) {
      const { data, error } = await admin.rpc('inbox_form_submit_intake', {
        p_site_ref: a.site_ref,
        p_nonce: a.nonce,
        p_ip_hash: a.ip_hash,
        p_anliegen: a.anliegen,
        p_kontakt_name: a.kontakt_name,
        p_kontakt_telefon: a.kontakt_telefon,
        p_kontakt_email: a.kontakt_email,
        p_terminwunsch: a.terminwunsch,
        p_contact_label: a.contact_label,
        p_ip_limit: a.ip_limit,
        p_site_limit: a.site_limit,
      });
      if (error) throw new Error(`inbox_form_submit_intake: ${error.message}`);
      const row = Array.isArray(data) ? data[0] : data;
      const status = row?.status as SubmitStatus | undefined;
      if ((status === 'received' || status === 'duplicate') && row?.conversation_id) {
        return { status, conversation_id: String(row.conversation_id) };
      }
      if (status === 'rate_limited' || status === 'not_found') return { status };
      throw new Error(`inbox_form_submit_intake: unexpected result ${JSON.stringify(row ?? null)}`);
    },
  };
}
