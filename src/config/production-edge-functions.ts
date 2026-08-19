/**
 * Welche Edge Functions in Produktion tatsächlich laufen.
 *
 * ## Warum diese Datei existiert
 *
 * Ein Button, der eine Function aufruft, die nicht deployt ist, sieht im Code
 * fertig aus und liefert dem Nutzer ein 404. Das ist der teuerste Fehlertyp
 * dieses Repos: Er ist in keinem Build, keinem Lint und keinem Typecheck
 * sichtbar, weil Vite und `tsc` nur Strings sehen.
 *
 * Der Grund ist strukturell, nicht schlampig: Die Organisation läuft auf dem
 * Supabase-Free-Plan mit **hartem Limit von 100 Functions**. Belegt sind 100.
 * Jeder weitere Deploy scheitert mit `HTTP 402: Max number of functions
 * reached for project`. Im Repository liegen ~180 Functions — die Differenz
 * ist nicht „noch nicht deployt", sondern „kann derzeit nicht deployt werden".
 * Siehe `docs/runbooks/edge-function-kontingent.md`.
 *
 * Solange das so ist, muss die Oberfläche wissen, was sie erreichen kann.
 *
 * ## Wie diese Liste entsteht
 *
 * Messung gegen das Live-Projekt (`RealSyncDynamicsLive`, eu-central-1) über
 * `supabase functions list` bzw. die Management-API. **Nicht** aus dem
 * Repository ableiten — die Existenz eines Verzeichnisses unter
 * `supabase/functions/` sagt nichts über Produktion aus.
 *
 * Bei jeder Neumessung: Liste ersetzen, `MEASURED_AT` mitziehen,
 * `UNBACKED_CALLERS` durchsehen (siehe dort).
 */

/** Hartes Limit des aktuellen Supabase-Plans. Mehr geht nur im Tausch. */
export const EDGE_FUNCTION_PLAN_LIMIT = 100;

/** Datum der letzten Messung gegen das Live-Projekt. */
export const PRODUCTION_EDGE_FUNCTIONS_MEASURED_AT = '2026-08-19';

/**
 * Die in Produktion aktiven Function-Slugs — alphabetisch, damit ein Diff
 * einer Neumessung lesbar bleibt.
 */
export const PRODUCTION_EDGE_FUNCTIONS: readonly string[] = [
  'add-auditor',
  'agent-os-runner',
  'ai-act-classify',
  'ai-act-risk-inventory',
  'ai-gateway',
  'ai-invoke',
  'api-audit',
  'audit-drip-cron',
  'audit-monitor-cron',
  'audit-recheck-weekly',
  'audit-report-email',
  'audit-report-pdf',
  'automation-callback',
  'automation-trigger',
  'browser-action-log',
  'business-metrics-cron',
  'ceo-brief-pdf',
  'checkout-website-rebuild',
  'classify-document',
  'cookie-scan',
  'cookie-scan-deep',
  'daily-digest',
  'enterprise-ai-os-agent-runs-list',
  'enterprise-ai-os-agents-list',
  'enterprise-ai-os-agents-run',
  'enterprise-ai-os-discovery-intake',
  'enterprise-ai-os-discovery-pending',
  'enterprise-ai-os-evaluate',
  'enterprise-ai-os-feedback',
  'enterprise-ai-os-founding-access',
  'evidence-export',
  'evidence-vault',
  'evidence-vault-export',
  'gdpr-audit',
  'gdpr-delete',
  'gdpr-export',
  'generate-document',
  'governance-agent',
  'governance-agents-list',
  'governance-analytics-export',
  'governance-approvals',
  'governance-connectors',
  'governance-dpias',
  'governance-dsr',
  'governance-erasure-sweeper',
  'governance-incidents',
  'governance-ingest',
  'governance-keys',
  'governance-memory',
  'governance-monitoring-scheduler',
  'governance-remediate',
  'governance-resources',
  'governance-risk-score',
  'governance-vendors',
  'governance-webhooks',
  'health',
  'iso42001-control-detail',
  'iso42001-controls-library',
  'iso42001-evidence-vault',
  'iso42001-gap-analysis',
  'kodee',
  'kodee-advise',
  'kodee-diagnose',
  'kodee-onboard',
  'legal-retrieve',
  'market-scanner',
  'marketing-event',
  'memory-decay-worker',
  'mfa-recovery-redeem',
  'newsletter-confirm',
  'newsletter-subscribe',
  'policy-packs',
  'provenance',
  'rebuild-website',
  'remediation-agent',
  'sales-lead',
  'scheduler',
  'scheduler-dispatch',
  'security-signal-ingest',
  'shopify-callback',
  'shopify-install',
  'shopify-scan',
  'shopify-webhooks',
  'stripe-checkout',
  'stripe-checkout-verify',
  'stripe-meter-sync',
  'stripe-portal',
  'stripe-webhook',
  'sub-processor-notify',
  'telegram-channels',
  'telegram-webhook',
  'telemetry-ai-event',
  'tenant-audit',
  'tenant-invite',
  'tenant-members',
  'track-pageview',
  'usage-increment',
  'welcome-email',
  'workflow-callback',
  'workflow-trigger',
];

const PRODUCTION_SET = new Set(PRODUCTION_EDGE_FUNCTIONS);

/** Läuft dieser Slug in Produktion? Basis jeder Verfügbarkeitsanzeige. */
export function isEdgeFunctionInProduction(slug: string): boolean {
  return PRODUCTION_SET.has(slug);
}

/**
 * Was das Frontend aufruft, ohne dass es in Produktion existiert.
 *
 * Diese Liste ist bewusst **fest eingetragen und nicht berechnet**: Ein neuer
 * Eintrag entsteht nur, wenn jemand einen Knopf an eine Function hängt, die
 * es nicht gibt — und dann soll die CI rot werden, nicht die Liste wachsen.
 *
 * `test/backend/edge-function-contract.test.ts` prüft beide Richtungen:
 * kein unbekannter unbelegter Aufruf, und kein Eintrag hier, der inzwischen
 * deployt ist. Beides bricht den Test — der zweite Fall ist der schöne.
 */
export interface UnbackedCaller {
  /** Function-Slug, den das Frontend aufruft. */
  slug: string;
  /** Wo im UI das hängt — für den, der es abstellt. */
  surface: string;
  /** Erreichbar ohne Login? Öffentliche Sackgassen wiegen schwerer. */
  publicPath: boolean;
}

export const UNBACKED_CALLERS: readonly UnbackedCaller[] = [
  // ── Öffentlicher Trichter — wiegt am schwersten ────────────────────────
  {
    slug: 'save-company-profile',
    surface: '/unified-entry/onboarding — Schritt „Growth starten"',
    publicPath: true,
  },
  {
    slug: 'create-trial-subscription',
    surface: '/unified-entry/onboarding — Schritt „Growth starten"',
    publicPath: true,
  },
  {
    // Ein Eintrag für vier Endpunkte: Seit der Zusammenfassung zum Router
    // `siteos` (`/discover`, `/builder`, `/runtime-scan`, `/agents`) kostet
    // SiteOS **einen** Slot statt vier. Das ist der Unterschied zwischen
    // „braucht einen Tausch" und „braucht vier".
    //
    // Korrigiert am 2026-08-19: Der erste Eintrag nannte
    // `/unified-entry/preview`. Diese Route rendert `DashboardPreviewPage`,
    // nicht den Builder. Der echte öffentliche Aufrufer ist
    // `/handwerk-website` — über die Wiederausfuhr-Kette KmuWebsiteLanding →
    // WebsiteBuilderLanding → WebsiteTransformationFlow, weshalb weder die
    // Route noch der Dateiname im Router auftaucht.
    slug: 'siteos',
    surface: '/handwerk-website · /app/siteos/builder — Analyse, Blueprint, Scan, Agenten',
    publicPath: true,
  },
  // Öffentlich dokumentierte, aber nicht existierende API-Endpunkte.
  // ApiDocs kennzeichnet sie inzwischen — siehe src/pages/ApiDocs.tsx.
  { slug: 'audit', surface: '/api-docs — dokumentierter Endpunkt', publicPath: true },
  { slug: 'avv-generator', surface: '/api-docs — dokumentierter Endpunkt', publicPath: true },
  { slug: 'dsfa', surface: '/api-docs — dokumentierter Endpunkt', publicPath: true },
  { slug: 'sub-processors', surface: '/api-docs — dokumentierter Endpunkt', publicPath: true },

  // ── Hinter Login ───────────────────────────────────────────────────────
  // `api-quota` steht nur in src/features/api/API_DEVELOPER_GUIDE.md und wird
  // von keinem Code aufgerufen — deshalb kein Eintrag hier, aber ein offener
  // Punkt: Das Handbuch beschreibt einen Endpunkt, den es nicht gibt.
  { slug: 'auditor-engagement', surface: 'features/governance — Prüfer-Mandat', publicPath: false },
  { slug: 'bulk-scan', surface: 'features/bulk — Sammel-Scan', publicPath: false },
  { slug: 'export-bulk-results', surface: 'features/bulk — Export', publicPath: false },
  { slug: 'calculate-seo-metrics', surface: 'features/seo-marketing-dashboard', publicPath: false },
  { slug: 'seo-dashboard-data', surface: 'features/seo-marketing-dashboard', publicPath: false },
  { slug: 'share-dashboard', surface: 'features/seo-marketing-dashboard — Teilen', publicPath: false },
  { slug: 'train-forecast-models', surface: 'features/seo-marketing-dashboard — Prognose', publicPath: false },
  { slug: 'generate-compliance-report', surface: 'features/governance — Berichtsbau', publicPath: false },
  { slug: 'certification-readiness', surface: 'features/governance — ISO-42001-Reifegrad', publicPath: false },
  { slug: 'generate-certification-report', surface: 'features/governance — Zertifizierungsbericht', publicPath: false },
  { slug: 'iso42001-control-update', surface: 'features/governance — Control-Detail', publicPath: false },
  { slug: 'maintenance-schedule', surface: 'features/governance — ISO-42001-Wartung', publicPath: false },
  { slug: 'remediation-workflow', surface: 'features/governance — Behebungs-Workflow', publicPath: false },
  { slug: 'export-audit', surface: 'features/governance — Prüfpfad-Export', publicPath: false },
  { slug: 'update-member-role', surface: 'features/governance — Terminal-Zusammenarbeit', publicPath: false },
  { slug: 'log-tool-run', surface: 'governance-os — eingebetteter Browser', publicPath: false },
  { slug: 'social-orchestrator-persistence', surface: 'core/social-orchestrator', publicPath: false },
  { slug: 'tenant-branding-update', surface: 'features/settings — Branding', publicPath: false },
  { slug: 'trigger-workflow', surface: 'features/workflows', publicPath: false },
  { slug: 'website-domain-manager', surface: 'features/website-operations — Domains', publicPath: false },
  { slug: 'website-maintenance-agent', surface: 'features/website-operations — Wartung', publicPath: false },
  { slug: 'website-operations-agent', surface: 'features/website-operations — Website anlegen', publicPath: false },
];

const UNBACKED_SET = new Set(UNBACKED_CALLERS.map((c) => c.slug));

/**
 * Bekannt unbelegt? Bewusst getrennt von `!isEdgeFunctionInProduction()`:
 * „nicht in Produktion" ist eine Messung, „bekannt unbelegt" eine
 * Entscheidung, die jemand getroffen und hier hinterlegt hat.
 */
export function isKnownUnbacked(slug: string): boolean {
  return UNBACKED_SET.has(slug);
}
