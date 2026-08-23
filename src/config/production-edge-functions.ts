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
 * Im Repository liegen 177 Function-Verzeichnisse, in Produktion laufen 103.
 * Die Differenz ist **nicht** erklärt.
 *
 * ## Was mit der Obergrenze war — und was davon noch gilt
 *
 * Bis zum 2026-08-19 galt hier: Free-Plan, hartes Limit 100, belegt 100,
 * jeder weitere Deploy scheitert mit `HTTP 402: Max number of functions
 * reached for project`. Das 402 war echt und der Zählstand von exakt 100 auch.
 *
 * Am selben Tag ist der Router `siteos` als **einhundertunderste** Function
 * ohne Fehler durchgelaufen (Deploy-Lauf 32277074625, `Deployed Functions on
 * project: siteos`), anschließend über HTTP nachgewiesen. Damit ist die
 * Obergrenze von 100 als *aktuelle* Schranke widerlegt — wo sie heute liegt,
 * ist unbekannt und ausdrücklich nicht gemessen.
 *
 * Für die verbleibenden 74 heißt das: „kann nicht deployt werden" ist keine
 * belegte Aussage mehr. Wer sie braucht, probiert einen Deploy — das ist
 * billiger als jede Herleitung. Siehe `docs/runbooks/edge-function-kontingent.md`.
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

/**
 * Der höchste Stand, der nachweislich gleichzeitig deployt war.
 *
 * Bewusst kein „Plan-Limit": Diese Zahl ist eine Beobachtung, keine Schranke.
 * Sie darf steigen, sobald jemand einen höheren Stand misst — und sie ist
 * kein Argument dafür, dass ein weiterer Deploy scheitern wird.
 */
export const EDGE_FUNCTIONS_OBSERVED_MAX = 103;

/** Datum der letzten Messung gegen das Live-Projekt. */
export const PRODUCTION_EDGE_FUNCTIONS_MEASURED_AT = '2026-08-19T20:18Z';

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
  'create-trial-subscription',
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
  'save-company-profile',
  'scheduler',
  'scheduler-dispatch',
  'security-signal-ingest',
  'shopify-callback',
  'shopify-install',
  'shopify-scan',
  'shopify-webhooks',
  'siteos',
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
  //
  // Was hier am 2026-08-19 wegfiel — die Reihenfolge ist die des Nachweises,
  // nicht die des Deploys, und der Unterschied ist der Punkt:
  //
  //   16:45  `siteos` — Router seit 16:39 deployt, alle vier Pfade über HTTP
  //          geprüft. Der Verfügbarkeitshinweis verschwand von selbst.
  //   20:18  `save-company-profile`, `create-trial-subscription` — seit 19:38
  //          deployt, beide antworten aus dem Handler (401 bzw. 400), nicht
  //          mit dem Plattform-404. Die Registrierung läuft bis zum Ende durch.
  //
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
  // Neu in diesem PR angelegt, noch nicht ausgerollt. Der Aufrufer
  // (`scansApi.ts::addWebsiteForTenant`) ersetzt ein clientseitiges INSERT,
  // das RLS ohnehin ablehnte — der Pfad ist also nicht schlechter als vorher,
  // sondern meldet den Grund jetzt verständlich. Eintrag entfernen, sobald
  // `deploy.yml` gelaufen ist; der Test „meldet Einträge in UNBACKED_CALLERS,
  // die inzwischen deployt sind" erinnert daran.
  { slug: 'tenant-website-register', surface: 'features/governance — Domain hinterlegen', publicPath: false },
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
