// Findings-Priorisierung für Multi-Website-Governance
// (P1.5 in docs/pilot/technical-tasks.md)
//
// Pure, deterministisch, ohne Seiteneffekte. Regel-Tabelle ist explizit
// und exportiert, damit Tests und UI dieselbe Wahrheit nutzen.

export type FindingCategory =
  | 'pre_consent_tracking'
  | 'unknown_vendor'
  | 'missing_required'
  | 'ai_widget'
  | 'uncategorized_cookie';

export type FindingSeverity = 'low' | 'medium' | 'high' | 'critical';

/** Welcher Pflichtelement-Typ fehlt — relevant für `missing_required`. */
export type RequiredKind = 'imprint' | 'privacy_policy' | 'unknown';

/** Cookie-Lebensdauer — relevant für `uncategorized_cookie`. */
export type CookieScope = 'session' | 'persistent';

export interface FindingInput {
  category: FindingCategory;
  /** Wurde der Tracker/Request/Skript VOR dem Consent-Klick gefeuert? */
  preConsent?: boolean;
  /** Vendor-Domain in known_vendors.json gelistet? */
  vendorKnown?: boolean;
  /** Pflichtelement-Typ bei `missing_required`. */
  requiredKind?: RequiredKind;
  /** AI-/Chat-Widget mit dokumentierter CMP-/Privacy-Konfiguration? */
  widgetDocumented?: boolean;
  /** Cookie-Scope bei `uncategorized_cookie`. */
  cookieScope?: CookieScope;
  /** Cookie kommt von Drittpartei (cross-domain) bei `uncategorized_cookie`? */
  cookieThirdParty?: boolean;
}

const ORDER: Record<FindingSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function compareSeverity(a: FindingSeverity, b: FindingSeverity): number {
  return ORDER[b] - ORDER[a]; // critical first
}

/**
 * Severity-Regeln. Reihenfolge der Bedingungen ist signifikant — die
 * erste passende Regel gewinnt. Falls keine Regel matcht, fällt die
 * Funktion auf `'medium'` zurück (defensiv — sollte nie passieren).
 */
export function computeFindingSeverity(input: FindingInput): FindingSeverity {
  switch (input.category) {
    case 'pre_consent_tracking':
      // Pre-Consent-Tracking ist per Definition ein DSGVO-Verstoß.
      return 'critical';

    case 'unknown_vendor':
      // Unbekannter Vendor, der VOR Consent feuert → kritisch.
      // Sonst dokumentationspflichtig, aber nicht sofort blockierend.
      return input.preConsent ? 'critical' : 'high';

    case 'missing_required':
      // Fehlende Datenschutzerklärung ist kritisch (DSGVO Art. 13/14
      // Pflichtinformation). Fehlendes Impressum ist hart (§ 5 TMG /
      // § 18 MStV), aber kein DSGVO-Verstoß.
      if (input.requiredKind === 'privacy_policy') return 'critical';
      return 'high'; // imprint + unknown

    case 'ai_widget':
      // Dokumentiertes Widget mit erkannter CMP-Verdrahtung → low.
      // Pre-Consent-Aktivierung → high.
      // Sonst medium (Inventarisierungs-/Vendor-AVV-Bedarf).
      if (input.widgetDocumented) return 'low';
      if (input.preConsent) return 'high';
      return 'medium';

    case 'uncategorized_cookie':
      // Persistente Third-Party-Cookies ohne Kategorisierung → medium.
      // Session-Cookies oder First-Party → low.
      if (input.cookieScope === 'persistent' && input.cookieThirdParty) {
        return 'medium';
      }
      return 'low';

    default: {
      // Exhaustiveness-Check: TypeScript meldet, wenn ein neuer Wert
      // hinzukommt, ohne dass er hier behandelt wurde.
      const _exhaustive: never = input.category;
      void _exhaustive;
      return 'medium';
    }
  }
}

/**
 * Sortiert Findings absteigend nach Severity. Bei Gleichstand wird
 * die ursprüngliche Reihenfolge beibehalten (stable sort).
 */
export function sortFindingsBySeverity<T extends { severity: FindingSeverity }>(
  findings: readonly T[],
): T[] {
  return [...findings].sort((a, b) => compareSeverity(a.severity, b.severity));
}
