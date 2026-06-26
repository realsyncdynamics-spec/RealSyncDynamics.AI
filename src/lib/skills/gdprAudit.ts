// GDPR-Audit Skill — pure Helper fuer technische DSGVO-Website-Heuristik.
// KEINE Rechtsberatung, keine externen Calls (Scan/Persistenz liegen in der
// Edge Function gdpr-audit bzw. im Runtime-Executor). Hier nur Klassifikation
// und Audit-Plan-Struktur.

export type AuditSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface FindingClassification {
  category: string;
  severity: AuditSeverity;
  remediation: string;
}

export interface AuditPlanStep {
  id: string;
  title: string;
  reference: string;
}

export interface WebsiteAuditPlan {
  url: string;
  steps: AuditPlanStep[];
  disclaimer: string;
}

const DISCLAIMER =
  'Technische Heuristik, keine Rechtsberatung. Befunde sind vor rechtsverbindlicher ' +
  'Bewertung durch qualifizierte Fachleute (DSB/Fachjurist) zu pruefen.';

// Bekannte DSGVO-/TTDSG-Website-Befundkategorien → Schweregrad + Remediation.
const FINDINGS: Record<string, { severity: AuditSeverity; remediation: string }> = {
  tracker_before_consent:      { severity: 'critical', remediation: 'Tracker erst nach aktiver Einwilligung laden (Consent-Gating, type="text/plain" data-consent).' },
  session_recording_no_consent:{ severity: 'critical', remediation: 'Session-Recording (z.B. Hotjar) nur mit vorheriger Einwilligung aktivieren.' },
  missing_privacy_policy:      { severity: 'critical', remediation: 'Datenschutzerklaerung nach Art. 13/14 DSGVO bereitstellen und verlinken.' },
  no_consent_banner:           { severity: 'high',     remediation: 'DSGVO-/TTDSG-konformes Consent-Banner mit echtem "Ablehnen" einbinden.' },
  analytics_no_consent:        { severity: 'high',     remediation: 'Analytics (z.B. Google Analytics) hinter Consent legen oder auf einwilligungsfreie Loesung umstellen.' },
  social_pixel_no_consent:     { severity: 'high',     remediation: 'Marketing-Pixel (Meta/LinkedIn/TikTok) nur nach Einwilligung laden.' },
  missing_imprint:             { severity: 'high',     remediation: 'Impressum nach §5 DDG/TMG ergaenzen und erreichbar machen.' },
  insecure_transport:          { severity: 'high',     remediation: 'TLS erzwingen (HTTPS-Redirect, HSTS), unverschluesselte Uebertragung beenden.' },
  third_party_fonts:           { severity: 'medium',   remediation: 'Google Fonts u. a. selbst hosten statt per Hotlink (Schrems-/IP-Uebermittlung vermeiden).' },
  external_media_embed:        { severity: 'medium',   remediation: 'Externe Einbettungen (YouTube/Maps) mit 2-Klick-/Consent-Loesung kapseln.' },
  weak_security_headers:       { severity: 'low',      remediation: 'Security-Header ergaenzen (CSP, X-Frame-Options, Referrer-Policy).' },
  cookie_long_lifetime:        { severity: 'low',      remediation: 'Cookie-Laufzeiten auf ein verhaeltnismaessiges Mass begrenzen und dokumentieren.' },
};

/**
 * Klassifiziert eine bekannte Befundkategorie. Unbekannte Kategorien werden
 * konservativ als `info` mit Hinweis auf manuelle Pruefung zurueckgegeben.
 */
export function classifyAuditFinding(category: string): FindingClassification {
  const key = category.trim().toLowerCase();
  const hit = FINDINGS[key];
  if (!hit) {
    return {
      category: key,
      severity: 'info',
      remediation: 'Unbekannte Kategorie — manuell pruefen und ggf. klassifizieren.',
    };
  }
  return { category: key, severity: hit.severity, remediation: hit.remediation };
}

/** Reihenfolge fuer Schweregrad-Sortierung (kritischste zuerst). */
export const SEVERITY_ORDER: AuditSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

/**
 * Baut den geordneten Pruefplan eines DSGVO-Website-Audits. Validiert die URL
 * (http/https), erzeugt keine Netzwerk-Calls.
 */
export function buildWebsiteAuditPlan(url: string): WebsiteAuditPlan {
  const trimmed = url.trim();
  if (!/^https?:\/\/.+/i.test(trimmed)) {
    throw new Error('url must be an absolute http(s) URL');
  }
  const steps: AuditPlanStep[] = [
    { id: 'consent-timing',   title: 'Consent-Timing: welche Requests/Tracker laden VOR Einwilligung?', reference: 'TTDSG §25 / Art. 6 DSGVO' },
    { id: 'consent-banner',   title: 'Consent-Banner: vorhanden, mit echtem "Ablehnen", kein Dark-Pattern?', reference: 'EDSA-Leitlinien 03/2022' },
    { id: 'trackers',         title: 'Tracker- & Pixel-Inventar (Analytics, Marketing, Session-Recording).', reference: 'Art. 30 DSGVO' },
    { id: 'third-party',      title: 'Drittlandtransfers: Fonts/CDN/Embeds, US-Dienste, Schrems-II.', reference: 'Art. 44 ff. DSGVO' },
    { id: 'mandatory-pages',  title: 'Pflichtseiten: Datenschutzerklaerung + Impressum vorhanden/verlinkt.', reference: 'Art. 13/14 DSGVO · §5 DDG' },
    { id: 'security-headers', title: 'Transport & Security-Header (HTTPS/HSTS, CSP, X-Frame-Options).', reference: 'Art. 32 DSGVO' },
  ];
  return { url: trimmed, steps, disclaimer: DISCLAIMER };
}
