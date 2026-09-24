/**
 * Maskiert eine E-Mail für öffentliche / teilbare Oberflächen.
 * Beispiel: steinerdominik1982@gmail.com → s***@gmail.com
 */
export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return '***';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}
