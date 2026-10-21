/**
 * Bestätigungs-Mail (Double-Opt-in) für Follow-up-E-Mails nach dem Scan.
 *
 * Die Checkbox im Scan ist die Einwilligung; wirksam für werbliche Mails wird
 * sie erst mit dem Klick auf den Link (UWG § 7, BGH I ZR 218/07). Bestätigt
 * wird über die bestehende Seite /newsletter/confirm (`kind=followup`), weil
 * das Projekt keine weitere Edge Function aufnehmen kann.
 *
 * Deno-frei bis auf `fetch`, damit Vitest den Text prüfen kann.
 */

export const FOLLOWUP_DOI_SUBJECT = 'Bitte bestätigen: Follow-up-E-Mails zu Ihrem Governance-Scan';

export function followupConfirmUrl(siteUrl: string, token: string): string {
  const base = siteUrl.replace(/\/+$/, '');
  return `${base}/newsletter/confirm?token=${encodeURIComponent(token)}&kind=followup`;
}

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderFollowupDoiEmail(email: string, confirmUrl: string): string {
  return `<!doctype html>
<html lang="de"><body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding:24px 8px;">
  <tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;">
      <tr><td style="padding:32px 32px 24px;border-bottom:1px solid #e4e4e7;">
        <div style="font-size:11px;color:#71717a;letter-spacing:0.2em;text-transform:uppercase;font-weight:700;">RealSyncDynamics.AI</div>
        <h1 style="margin:8px 0 4px;font-size:22px;">Follow-up-E-Mails bestätigen</h1>
      </td></tr>
      <tr><td style="padding:24px 32px;">
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Guten Tag,</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">beim kostenlosen Governance-Scan wurde für ${escapeHtml(email)} angegeben, dass gelegentliche Follow-up-E-Mails mit Informationen zu den Ergebnissen und Angeboten gewünscht sind. Wenn das von Ihnen kam, bestätigen Sie es bitte:</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${escapeHtml(confirmUrl)}" style="display:inline-block;padding:14px 32px;background:#0052FF;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">Follow-up-E-Mails bestätigen</a>
        </div>
        <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#52525b;">Falls der Button nicht funktioniert, kopieren Sie diesen Link:<br><span style="word-break:break-all;color:#0052FF;">${escapeHtml(confirmUrl)}</span></p>
        <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#52525b;">Ohne Bestätigung senden wir keine Follow-up-E-Mails. Ihren Scan-Bericht erhalten Sie unabhängig davon. Der Link gilt 30 Tage. Die Einwilligung können Sie jederzeit widerrufen, jede Follow-up-E-Mail enthält dafür einen Abmeldelink.</p>
      </td></tr>
      <tr><td style="padding:24px 32px;border-top:1px solid #e4e4e7;font-size:11px;color:#71717a;line-height:1.6;">
        <p style="margin:0 0 6px;">Diese E-Mail ist Teil des Double-Opt-in-Verfahrens nach § 7 UWG.</p>
        <p style="margin:0;">RealSync Dynamics · EU-Hosting (Frankfurt) · <a href="https://realsyncdynamicsai.de/legal/privacy" style="color:#0052FF;">Datenschutz</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

/** Versand über Resend. Wirft nie; ein Fehler kostet nur die Bestätigungs-Mail. */
export async function sendFollowupDoi(opts: {
  apiKey: string;
  from: string;
  to: string;
  confirmUrl: string;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const f = opts.fetchImpl ?? fetch;
  try {
    const resp = await f('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: opts.from,
        to: [opts.to],
        subject: FOLLOWUP_DOI_SUBJECT,
        html: renderFollowupDoiEmail(opts.to, opts.confirmUrl),
        tags: [{ name: 'category', value: 'followup_doi' }],
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) console.error('gdpr-audit: followup DOI mail failed', { status: resp.status });
    return resp.ok;
  } catch (e) {
    console.error('gdpr-audit: followup DOI mail threw', { message: (e as Error)?.message });
    return false;
  }
}
