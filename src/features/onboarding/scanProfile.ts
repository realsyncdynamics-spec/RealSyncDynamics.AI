// Scan-Profil — Brücke zwischen Free Audit (vor Registrierung) und
// Setup-Assistent (direkt nach Registrierung).
//
// Gestuftes Onboarding: Was der Besucher im Scan schon beantwortet hat,
// fragt das Setup nicht noch einmal ab, sondern schlägt es nur vor.
// Bewusst localStorage und nicht tenant-scoped: Vor der Registrierung gibt es
// noch keinen Tenant. Keine E-Mail hier — die geht nur an `gdpr-audit`.

export type ScanRole = 'self' | 'team' | 'agency' | 'enterprise';
export type ScanResidency = 'local' | 'eu_cloud' | 'hybrid';

export interface ScanProfile {
  company: string;
  domain: string;
  frameworks: string[];
  systems: string[];
  role: ScanRole | null;
  residency: ScanResidency | null;
  savedAt: number;
}

const KEY = 'realsync.scanProfile';
// Nach 30 Tagen gilt das Profil als veraltet und wird nicht mehr vorgeschlagen.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function saveScanProfile(profile: Omit<ScanProfile, 'savedAt'>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...profile, savedAt: Date.now() }));
  } catch {
    /* localStorage nicht verfügbar → Setup fragt normal ab */
  }
}

export function loadScanProfile(now = Date.now()): ScanProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<ScanProfile>;
    if (typeof p.savedAt !== 'number' || now - p.savedAt > MAX_AGE_MS) return null;
    return {
      company: typeof p.company === 'string' ? p.company : '',
      domain: typeof p.domain === 'string' ? p.domain : '',
      frameworks: Array.isArray(p.frameworks) ? p.frameworks.filter((x) => typeof x === 'string') : [],
      systems: Array.isArray(p.systems) ? p.systems.filter((x) => typeof x === 'string') : [],
      role: isRole(p.role) ? p.role : null,
      residency: isResidency(p.residency) ? p.residency : null,
      savedAt: p.savedAt,
    };
  } catch {
    return null;
  }
}

export function clearScanProfile(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

function isRole(v: unknown): v is ScanRole {
  return v === 'self' || v === 'team' || v === 'agency' || v === 'enterprise';
}

function isResidency(v: unknown): v is ScanResidency {
  return v === 'local' || v === 'eu_cloud' || v === 'hybrid';
}
