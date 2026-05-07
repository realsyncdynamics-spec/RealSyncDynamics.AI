/**
 * Auth-Redirect-URL-Helper für Magic-Link-Flows.
 *
 * Magic-Link-Bug: bei `emailRedirectTo: window.location.href` landet
 * der Link auf localhost:3000 wenn der User von Dev-Server aus signt.
 * Klick aus E-Mail → tot.
 *
 * Fix-Strategie:
 *  - Production-Build (import.meta.env.PROD): hardcoded Apex-Domain
 *  - Dev-Build mit VITE_PUBLIC_SITE_URL: explizite Override-URL
 *  - Dev-Build ohne Override: window.location.origin (kein href!)
 *
 * `window.location.origin` ist bewusst statt `href` gewählt: vermeidet
 * dass Query-Strings/Hashes in den Magic-Link-Redirect rutschen.
 */

const APEX_DOMAIN = 'https://realsyncdynamicsai.de';

export function getAuthRedirectUrl(path = '/'): string {
  // Production-Build: immer Apex-Domain. window.location wird ignoriert
  // damit selbst wenn jemand iframe/preview-mode hat, der Link richtig geht.
  if (typeof import.meta !== 'undefined' && import.meta.env?.PROD) {
    return `${APEX_DOMAIN}${path}`;
  }

  // Explicit dev-override
  const envSite = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_PUBLIC_SITE_URL as string | undefined)) || '';
  if (envSite) {
    return `${envSite.replace(/\/$/, '')}${path}`;
  }

  // Dev-Default: aktuelle origin (egal welcher Port)
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }

  // Fallback (z. B. SSR-Test-Run)
  return `${APEX_DOMAIN}${path}`;
}
