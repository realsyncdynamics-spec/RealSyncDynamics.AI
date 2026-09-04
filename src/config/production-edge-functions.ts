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
 * ## Stand der Messung
 *
 * 2026-08-23 (nach Merge von PR #1131 und dem zugehörigen `deploy.yml`-Lauf),
 * Management-API gegen das Live-Projekt: 178 Function-Verzeichnisse im
 * Repository, **178 deployt — deckungsgleich in beide Richtungen** (weder
 * eine nicht deployte Function noch eine deployte ohne Verzeichnis). Das ist
 * ein Momentzustand, kein Naturgesetz: Der nächste Merge, der eine Function
 * hinzufügt, öffnet die Lücke wieder, bis `deploy.yml` gelaufen ist.
 *
 * Zur Geschichte der vermeintlichen 100er-Obergrenze (am 2026-08-19 durch den
 * Deploy von Function 101 widerlegt, Lücke bis 2026-08-22 vollständig
 * geschlossen): `docs/runbooks/edge-function-kontingent.md` und `CLAUDE.md` §5.
 * Die Lehre bleibt: messen, nicht herleiten.
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
export const EDGE_FUNCTIONS_OBSERVED_MAX = 181;

/** Datum der letzten Messung gegen das Live-Projekt. */
export const PRODUCTION_EDGE_FUNCTIONS_MEASURED_AT = '2026-09-04T07:31Z';

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
  'audit-claim',
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
  'onboarding-orchestrator',
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
  'subscription-addons',
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
  'whatsapp-webhook',
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
 *
 * Genau der schöne Fall trat mit der Neumessung vom 2026-08-23 ein: 19
 * Einträge (u. a. `website-domain-manager`, `bulk-scan`, das gesamte
 * SEO-Dashboard und die ISO-42001-Strecke) sind inzwischen deployt und
 * wurden hier entfernt. Übrig bleibt, was wirklich fehlt.
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
  // Öffentlich dokumentierte, aber nicht existierende API-Endpunkte.
  // ApiDocs kennzeichnet sie inzwischen — siehe src/pages/ApiDocs.tsx.
  { slug: 'audit', surface: '/api-docs — dokumentierter Endpunkt', publicPath: true },
  { slug: 'avv-generator', surface: '/api-docs — dokumentierter Endpunkt', publicPath: true },
  { slug: 'dsfa', surface: '/api-docs — dokumentierter Endpunkt', publicPath: true },
  { slug: 'sub-processors', surface: '/api-docs — dokumentierter Endpunkt', publicPath: true },

  // ── Im Repo, noch nicht deployt ────────────────────────────────────────
  //
  // Derzeit keiner. `audit-claim` stand hier bis zum 2026-09-01: Es hat
  // keinen Aufrufer mehr, weil die Übernahme auf allen Pfaden über die RPC
  // `claim_gdpr_audit` läuft (ein Schreibweg, canonical-funnel-decision.md).
  // Deployt ist es seit dem Lauf zu `66647c9` trotzdem — gemessen am
  // 2026-09-04, siehe die Produktionsliste oben. „Kein Aufrufer" und „nicht
  // deployt" sind zwei verschiedene Aussagen; hier gehört nur die zweite hin.

  // ── Hinter Login ───────────────────────────────────────────────────────
  // `api-quota` steht nur in src/features/api/API_DEVELOPER_GUIDE.md und wird
  // von keinem Code aufgerufen — deshalb kein Eintrag hier, aber ein offener
  // Punkt: Das Handbuch beschreibt einen Endpunkt, den es nicht gibt.
  // `subscription-addons` (AP6, Add-ons als Positionen des Stripe-Abos) ist
  // am 2026-09-04 als deployt gemessen worden und deshalb hier entfernt —
  // genau der Schritt, den der Test „meldet Einträge in UNBACKED_CALLERS,
  // die inzwischen deployt sind" erzwingen soll. Dass er nicht ausgelöst
  // hat, lag an seiner Eingabe: Er misst gegen PRODUCTION_EDGE_FUNCTIONS,
  // und diese Liste stand noch auf der Messung vom 2026-08-23.
  { slug: 'export-bulk-results', surface: 'features/bulk — Export', publicPath: false },
  { slug: 'iso42001-control-update', surface: 'features/governance — Control-Detail', publicPath: false },
  { slug: 'trigger-workflow', surface: 'features/workflows', publicPath: false },
  // Neu in diesem PR angelegt, noch nicht ausgerollt. Der Aufrufer
  // (`scansApi.ts::addWebsiteForTenant`) ersetzt ein clientseitiges INSERT,
  // das RLS ohnehin ablehnte — der Pfad ist also nicht schlechter als vorher,
  // sondern meldet den Grund jetzt verständlich. Eintrag entfernen, sobald
  // `deploy.yml` gelaufen ist; der Test „meldet Einträge in UNBACKED_CALLERS,
  // die inzwischen deployt sind" erinnert daran.
  //
  // Die drei `website-*`-Einträge, die hier bis zum 2026-08-23 standen, hat
  // `main` entfernt — sie sind seit der Neumessung (178, 20:57Z) deployt.
  { slug: 'tenant-website-register', surface: 'features/governance — Domain hinterlegen', publicPath: false },
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
