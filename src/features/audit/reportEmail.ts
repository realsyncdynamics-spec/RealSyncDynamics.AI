/** Browser-side transport status for the audit report email.
 * A 2xx response is not proof of inbox delivery. Never expose recipient data.
 */
export type ReportEmailStatus = 'accepted' | 'already_sent' | 'not_sent' | 'failed';

type Reply = { ok?: boolean; skipped?: string; sent_id?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function requestAuditReportEmail(
  baseUrl: string,
  auditId: string,
  send: typeof fetch = fetch,
): Promise<ReportEmailStatus> {
  if (!baseUrl.startsWith('https://') || !UUID.test(auditId)) return 'failed';
  try {
    const resp = await send(`${baseUrl.replace(/\/$/, '')}/functions/v1/audit-report-email?id=${encodeURIComponent(auditId)}`, {
      method: 'GET',
    });
    if (!resp.ok) return 'failed';
    const payload = await resp.json() as Reply;
    if (!payload.ok) return 'failed';
    if (payload.skipped === 'already_sent') return 'already_sent';
    if (payload.skipped) return 'not_sent';
    return typeof payload.sent_id === 'string' && payload.sent_id.length > 0 ? 'accepted' : 'failed';
  } catch {
    return 'failed';
  }
}

export const reportEmailMessage: Record<ReportEmailStatus, string> = {
  accepted: 'Der E-Mail-Anbieter hat den Versandauftrag angenommen. Die Zustellung ins Postfach ist noch nicht bestätigt.',
  already_sent: 'Der Bericht wurde laut Versandprotokoll bereits versendet. Bitte prüfen Sie auch Ihren Spam-Ordner.',
  not_sent: 'Der Bericht konnte derzeit nicht per E-Mail versendet werden. Das Prüfergebnis bleibt hier sichtbar.',
  failed: 'Der E-Mail-Versand konnte nicht bestätigt werden. Das Prüfergebnis bleibt hier sichtbar.',
};
