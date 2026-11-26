/**
 * Affiliate-Click-Tracking.
 *
 * Wenn ?ref=<code> in der URL steht: speichern in localStorage (90 Tage).
 * Audit + Sales-Lead-Submissions reichen den Code als referral_code mit.
 */

const STORAGE_KEY = 'rsd-affiliate-ref';
const TTL_MS = 90 * 24 * 60 * 60 * 1000;
const CODE_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;

function isValidCode(code: unknown): code is string {
  return typeof code === 'string' && CODE_PATTERN.test(code);
}

export function captureAffiliateRef(): void {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('ref') ?? params.get('via');
    if (isValidCode(code)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        code,
        captured_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + TTL_MS).toISOString(),
      }));
    }
  } catch { /* localStorage unavailable */ }
}

export function getAffiliateRef(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const entry = (parsed && typeof parsed === 'object') ? parsed as Record<string, unknown> : null;
    const expiresAt = typeof entry?.expires_at === 'string'
      ? new Date(entry.expires_at).getTime()
      : Number.NaN;
    // Fail-closed: ohne gültiges Ablaufdatum oder gültigen Code gilt der Eintrag als abgelaufen.
    if (!entry || !Number.isFinite(expiresAt) || expiresAt < Date.now() || !isValidCode(entry.code)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return entry.code;
  } catch {
    return null;
  }
}

export function clearAffiliateRef(): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
