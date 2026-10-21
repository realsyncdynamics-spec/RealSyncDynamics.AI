/**
 * Lead-Kontext zwischen Governance-Scan und Pilot-Registrierung.
 *
 * Der Besucher hat Domain und E-Mail im Scan schon eingegeben. Auf dem Weg
 * Bericht → /pricing → /checkout → /welcome soll er sie nicht ein zweites
 * Mal tippen müssen. Übergeben wird **nicht** über die Adresszeile (URLs
 * landen in Logs, Verläufen und Referrern), sondern im `sessionStorage`:
 *
 * - nur dieser Tab, endet mit dem Tab — kein `localStorage` (vgl.
 *   `pendingAudit.ts`: dort bewusst nur die Kennung, weil sie Neustarts
 *   überdauern muss; dieser Kontext muss das nicht);
 * - nur, was der Besucher selbst gerade eingegeben hat;
 * - verfällt nach zwei Stunden und wird nach der Anmeldung gelöscht.
 *
 * Die Datenquelle bleibt der Server (`sales_leads`). Dies ist nur Vorbelegung
 * eines Formularfelds.
 */

const KEY = 'rsd_lead_context';
const TTL_MS = 2 * 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@|]+@[^\s@|]+\.[^\s@|]{2,}$/;
const HOST_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}[a-z0-9]$/;

export interface LeadContext {
  email: string;
  domain: string;
}

/**
 * Eingabe „https://www.Muster.de/kontakt?x=1“ → „muster.de“.
 * Gibt `null` zurück, wenn daraus keine plausible öffentliche Domain wird
 * (IP-Adressen, `localhost`, einzelne Labels, Leerzeichen …). Die
 * verbindliche Prüfung macht der Server; diese hier erspart nur den Umweg.
 */
export function normalizeDomainInput(raw: string): string | null {
  let s = raw.trim().toLowerCase();
  if (!s || /\s/.test(s)) return null;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  s = s.split(/[/?#]/)[0] ?? '';
  s = s.replace(/^[^@]*@/, ''); // Zugangsdaten in der URL
  s = s.replace(/:\d+$/, '');
  s = s.replace(/\.$/, '').replace(/^www\./, '');
  if (s.length < 4 || s.length > 253) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return null;
  return HOST_RE.test(s) ? s : null;
}

export function isValidLeadEmail(raw: string): boolean {
  const s = raw.trim();
  return s.length >= 6 && s.length <= 254 && EMAIL_RE.test(s);
}

export function rememberLeadContext(ctx: LeadContext): void {
  const email = ctx.email.trim().toLowerCase();
  const domain = normalizeDomainInput(ctx.domain);
  if (!isValidLeadEmail(email) || !domain) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ email, domain, ts: Date.now() }));
  } catch { /* privater Modus — Vorbelegung ist Komfort, kein Muss */ }
}

export function readLeadContext(now: number = Date.now()): LeadContext | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { email?: unknown; domain?: unknown; ts?: unknown };
    if (typeof v.ts !== 'number' || now - v.ts > TTL_MS || now < v.ts) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    if (typeof v.email !== 'string' || !isValidLeadEmail(v.email)) return null;
    if (typeof v.domain !== 'string' || normalizeDomainInput(v.domain) !== v.domain) return null;
    return { email: v.email, domain: v.domain };
  } catch {
    return null;
  }
}

export function clearLeadContext(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* nichts zu tun */ }
}
