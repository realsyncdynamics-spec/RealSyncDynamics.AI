// Starter-Angebotsmail aus sales-lead — reine Logik ohne Deno-Abhängigkeiten,
// damit Vitest sie direkt prüfen kann (gleiches Muster wie
// gdpr-audit/marketing-consent.ts).
//
// Zwei Regeln:
//   1. Werbung nur mit ausdrücklicher Einwilligung: `marketing_consent === true`
//      im Request. Aus `source` wird keine Einwilligung mehr abgeleitet.
//   2. Alles, was der Client schickt (name, company), wird escaped, bevor es in
//      das HTML der Mail geht — sonst kann ein Dritter über den öffentlichen
//      Endpoint gebrandete Mails mit eigenen Links an beliebige Adressen senden.

export const STARTER_OFFER_SUBJECT = 'Ihr Starter-Angebot: 3 Monate gratis';

export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Nur ein echtes `true` zählt als Einwilligung — kein "true", kein 1. */
export function hasExplicitMarketingConsent(body: { marketing_consent?: unknown }): boolean {
  return body.marketing_consent === true;
}

export function shouldSendStarterOffer(input: {
  source?: unknown;
  intent: string | null;
  tier: string | null;
  marketing_consent?: unknown;
}): boolean {
  return (
    input.source === 'unified-entry' &&
    input.intent === 'starter_3_months_free' &&
    input.tier === 'starter' &&
    hasExplicitMarketingConsent(input)
  );
}

export function starterOfferHtml(name?: string | null, company?: string | null): string {
  const greeting = name ? `Hallo ${escapeHtml(name)},` : 'Hallo,';
  const companyLine = company
    ? `<p>für <strong>${escapeHtml(company)}</strong> haben wir bereits den Website-Scan vorbereitet.</p>`
    : '';

  return `
    <html><body style="margin:0;background:#030712;color:#e5e7eb;font-family:Arial,sans-serif;line-height:1.6">
      <div style="max-width:620px;margin:0 auto;padding:32px 24px">
        <div style="border:1px solid #164e63;border-radius:16px;padding:28px;background:#07111f">
          <p style="color:#22d3ee;font-size:12px;letter-spacing:2px;font-weight:700">REALSYNCDYNAMICS.AI</p>
          <h1 style="font-size:30px;line-height:1.15;margin:18px 0 12px;color:#fff">Ihr Starter-Angebot: 3 Monate gratis</h1>
          <p>${greeting}</p>
          ${companyLine}
          <p>Sie haben Ihre Website prüfen lassen. Als nächsten Schritt bieten wir Ihnen das <strong>Starter-Paket für 3 Monate kostenlos</strong> an.</p>
          <p>Damit können Sie die nächsten Schritte aus dem Scan umsetzen und RealSyncDynamics.AI im laufenden Betrieb kennenlernen.</p>
          <p style="margin:28px 0"><a href="https://realsyncdynamicsai.de/pricing?offer=starter-3-months-free&utm_source=website-builder&utm_medium=email" style="display:inline-block;background:#22d3ee;color:#030712;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:9px">Starter-Angebot ansehen</a></p>
          <p style="font-size:13px;color:#94a3b8">Wenn Sie diese E-Mails nicht mehr erhalten möchten, antworten Sie bitte auf diese Nachricht mit „Abmelden“.</p>
        </div>
        <p style="font-size:11px;color:#64748b;text-align:center;margin-top:18px">RealSync Dynamics.AI · EU-Hosting · DSGVO · EU AI Act</p>
      </div>
    </body></html>`;
}
