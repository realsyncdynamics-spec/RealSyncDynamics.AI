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
 * **Seit dem 2026-08-22 deckt sich beides**: 177 Verzeichnisse im Repository,
 * 177 Functions in Produktion, keine Abweichung in beide Richtungen.
 *
 * ## Die Geschichte der Obergrenze — und wie sie endete
 *
 * Bis zum 2026-08-19 galt hier: Free-Plan, hartes Limit 100, belegt 100,
 * jeder weitere Deploy scheitert mit `HTTP 402: Max number of functions
 * reached for project`. Das 402 war echt und der Zählstand von exakt 100 auch.
 *
 * Dann ging `siteos` als einhundertunderste Function durch, und der Stand
 * kletterte auf 103. Diese Datei schloss daraus: Die Grenze liegt nicht mehr
 * bei 100, wo sie liegt, ist unbekannt. Die verbleibenden 74 galten als
 * ungeklärt.
 *
 * Am 2026-08-22 hat der Deploy-Lauf nach dem Merge von #1117 **alle 177**
 * ausgerollt — darunter `cloudflare-deployer` und `website-domain-manager`,
 * die diese Datei zuvor als nicht erreichbar führte. Es gab keine Obergrenze
 * mehr zu umgehen; es fehlte nur ein Lauf.
 *
 * Die Lehre steht schon im nächsten Absatz und hat sich zum zweiten Mal
 * bestätigt: **messen, nicht herleiten**. Die 100 waren eine Beobachtung, die
 * zur Schranke erklärt wurde; die 103 ebenso.
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
 *
 * Zweimal wurde sie hier fälschlich als Grenze gelesen (100, dann 103).
 * Beide Male lag der nächste Stand darüber.
 */
export const EDGE_FUNCTIONS_OBSERVED_MAX = 177;

/** Datum der letzten Messung gegen das Live-Projekt. */
export const PRODUCTION_EDGE_FUNCTIONS_MEASURED_AT = '2026-08-22T22:46Z';

/**
 * Die in Produktion aktiven Function-Slugs — alphabetisch, damit ein Diff
 * einer Neumessung lesbar bleibt.
 */
export const PRODUCTION_EDGE_FUNCTIONS: readonly string[] = [
  'add-auditor',
  'agent-os-runner',
  'agent-scheduler',
  'ai-act-auto-classify',
  'ai-act-classify',
  'ai-act-risk-inventory',
  'ai-gateway',
  'ai-invoke',
  'api-audit',
  'api-gateway',
  'api-webhook-deliver',
  'appointment-book',
  'audit-determinism-verify',
  'audit-drip-cron',
  'audit-monitor-cron',
  'audit-recheck-weekly',
  'audit-report-email',
  'audit-report-pdf',
  'auditor-engagement',
  'automation-callback',
  'automation-trigger',
  'automation-trigger-trial-webhook',
  'bot-chat',
  'bot-voice-webhook',
  'browser-action-log',
  'bulk-scan',
  'business-metrics-cron',
  'c2pa-manifest-generate',
  'calculate-seo-metrics',
  'ceo-brief-pdf',
  'certification-readiness',
  'checkout-siteos-project',
  'checkout-website-rebuild',
  'classify-document',
  'cloudflare-deployer',
  'compliance-alert-trigger',
  'compliance-remediation-execute',
  'cookie-scan',
  'cookie-scan-deep',
  'create-trial-subscription',
  'daily-digest',
  'dashboard-digest-generate',
  'dashboard-intelligence',
  'email-delivery-webhook',
  'email-notify-send',
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
  'export-audit',
  'gdpr-audit',
  'gdpr-delete',
  'gdpr-export',
  'generate-certification-report',
  'generate-compliance-report',
  'generate-document',
  'governance-agent',
  'governance-agents-list',
  'governance-analytics-aggregator',
  'governance-analytics-export',
  'governance-approvals',
  'governance-audit-report-gen',
  'governance-connectors',
  'governance-deadline-monitor',
  'governance-dpias',
  'governance-dsr',
  'governance-erasure-sweeper',
  'governance-evidence-handler',
  'governance-gap-analyzer',
  'governance-incidents',
  'governance-ingest',
  'governance-keys',
  'governance-memory',
  'governance-monitoring-scheduler',
  'governance-remediate',
  'governance-resources',
  'governance-risk-escalate',
  'governance-risk-score',
  'governance-score-calculator',
  'governance-vendors',
  'governance-webhooks',
  'governance-workflow-intake',
  'health',
  'hostinger-agent-brief',
  'invoice-email',
  'iso42001-control-detail',
  'iso42001-controls-library',
  'iso42001-evidence-vault',
  'iso42001-gap-analysis',
  'kodee',
  'kodee-advise',
  'kodee-diagnose',
  'kodee-onboard',
  'legal-embed',
  'legal-retrieve',
  'log-tool-run',
  'maintenance-schedule',
  'market-scanner',
  'marketing-event',
  'memory-confidence-trigger',
  'memory-decay-worker',
  'mfa-admin-reset',
  'mfa-recovery-redeem',
  'newsletter-confirm',
  'newsletter-subscribe',
  'nis2-deadline-calculator',
  'notify-terminal-event',
  'oauth2-apps',
  'oauth2-token',
  'optimize-analyze',
  'optimize-execute',
  'order-intake',
  'partner-provision-tenant',
  'pitch-deck-pdf',
  'plans',
  'policy-packs',
  'provenance',
  'rebuild-website',
  'remediation-agent',
  'remediation-workflow',
  'report-generator',
  'sales-lead',
  'save-company-profile',
  'schedule-data-syncs',
  'scheduler',
  'scheduler-dispatch',
  'security-signal-ingest',
  'seed-integrations',
  'seo-dashboard-data',
  'share-dashboard',
  'shopify-callback',
  'shopify-install',
  'shopify-scan',
  'shopify-webhooks',
  'siteos',
  'skills',
  'social-orchestrator-persistence',
  'social-publisher-worker',
  'stripe-checkout',
  'stripe-checkout-verify',
  'stripe-meter-sync',
  'stripe-oauth-callback',
  'stripe-portal',
  'stripe-token-meter-sync',
  'stripe-webhook',
  'sub-processor-notify',
  'sync-ga-metrics',
  'sync-stripe-metrics',
  'telegram-channels',
  'telegram-webhook',
  'telemetry-ai-event',
  'tenant-audit',
  'tenant-branding-get',
  'tenant-branding-update',
  'tenant-invite',
  'tenant-members',
  'track-pageview',
  'train-forecast-models',
  'update-member-role',
  'usage-increment',
  'webhook-deliver',
  'webhook-dispatcher',
  'webhook-retry-cron',
  'website-domain-manager',
  'website-maintenance-agent',
  'website-maintenance-daily-cron',
  'website-operations-agent',
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
  // Stand 2026-08-22: von 26 Einträgen sind 19 weggefallen, sieben bleiben.
  //
  // Der Deploy-Lauf nach dem Merge von #1117 hat alle 177 Functions des
  // Repositories ausgerollt. Damit ist jeder Aufruf belegt, für den es
  // überhaupt Code gibt.
  //
  // Die sieben hier sind ein anderer Fall — und ein schwererer: Für sie
  // existiert **kein Verzeichnis unter `supabase/functions/`**. Sie waren
  // nie „nicht deployt", sondern nie geschrieben. Ein Deploy hilft ihnen
  // nicht; sie brauchen entweder eine Implementierung oder das Abräumen
  // ihres Aufrufers.

  // ── Öffentlicher Trichter — wiegt am schwersten ────────────────────────
  //
  // Vier in `/api-docs` dokumentierte Endpunkte, die es nicht gibt. Eine
  // API-Dokumentation, die auf Nichts zeigt, ist keine Lücke im UI, sondern
  // eine Falschaussage nach außen: Wer danach integriert, baut gegen einen
  // Endpunkt, den niemand je geschrieben hat.
  { slug: 'audit', surface: '/api-docs — dokumentierter Endpunkt', publicPath: true },
  { slug: 'avv-generator', surface: '/api-docs — dokumentierter Endpunkt', publicPath: true },
  { slug: 'dsfa', surface: '/api-docs — dokumentierter Endpunkt', publicPath: true },
  { slug: 'sub-processors', surface: '/api-docs — dokumentierter Endpunkt', publicPath: true },

  // ── Hinter der Anmeldung ───────────────────────────────────────────────
  { slug: 'export-bulk-results', surface: 'features/bulk — Export', publicPath: false },
  { slug: 'iso42001-control-update', surface: 'features/governance — Control-Detail', publicPath: false },
  { slug: 'trigger-workflow', surface: 'features/workflows', publicPath: false },
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
