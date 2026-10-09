/**
 * Public product implementation status — single source of truth.
 *
 * Landing copy, roadmap section, nav badges, and CI claim hygiene read from
 * this registry. Flip `status` here → UI updates. Do not hardcode “live”
 * claims for preview / coming-soon items on the public landing.
 *
 * Measured against reachable routes + repo evidence (not marketing wish-lists).
 * See docs/product/implementation-status.md.
 */

export type ImplementationStatus = 'live' | 'preview' | 'coming-soon';

export type ImplementationGroup =
  | 'surface'
  | 'compliance'
  | 'runtime'
  | 'channels'
  | 'billing'
  | 'activation'
  | 'visual';

export interface ImplementationItem {
  id: string;
  name: string;
  status: ImplementationStatus;
  group: ImplementationGroup;
  /** Honest one-liner for landing / roadmap. */
  description: string;
  /** Public or app route if reachable today. */
  route?: string;
  /** Evidence: file, test, or PR reference. */
  evidence: readonly string[];
  /** Show on public #platform grid when live. */
  showOnPlatform?: boolean;
  /** Show on public #roadmap (defaults true for non-live). */
  showOnRoadmap?: boolean;
  /** Optional landing CTA label when live. */
  ctaLabel?: string;
}

/** Bump when statuses are re-measured. */
export const IMPLEMENTATION_MEASURED_AT = '2026-10-04';

export const IMPLEMENTATION_ITEMS: readonly ImplementationItem[] = [
  {
    id: 'public-landing',
    name: 'Public Landing',
    status: 'live',
    group: 'surface',
    description:
      'Landing v4 „Klassisch“ auf `/`: H1 „AI Compliance Operations OS for Europe“, Primär-CTA Free Audit (/audit), Sekundär-CTA Runtime ansehen (/governance-runtime); dunkler Hero mit three.js-Erde, darunter Classical-Bänder (Papier/Tinte/Gold) — Workspace-Vorschau, Tools, Plattform, Evidence, Preise, Roadmap, Enterprise.',
    route: '/',
    evidence: [
      'src/pages/LandingV4.tsx',
      'src/components/landing/v4/LandingV4Sections.tsx',
      'src/components/landing/v4/landing-v4-content.ts',
      'src/components/landing/v4/heroEarthScene.ts',
      'src/styles/landing-v4-classical.css',
      'src/App.tsx',
      'test/landing/landing-v4.test.tsx',
      'PR #1751',
    ],
    showOnRoadmap: false,
  },
  {
    id: 'design-landing-ledger',
    name: 'Evidence Ledger Landing (Design)',
    status: 'preview',
    group: 'visual',
    description:
      'DesignLedgerLanding.tsx existiert noch im Tree, aber /design/ledger leitet per Navigate auf `/` um — keine erreichbare Preview-Route, daher nicht auf dem öffentlichen Roadmap.',
    evidence: [
      'src/pages/design/DesignLedgerLanding.tsx',
      'src/App.tsx#/design/ledger→/',
    ],
    showOnRoadmap: false,
  },
  {
    id: 'design-landing-tribunal',
    name: 'Tribunal Landing (Design)',
    status: 'preview',
    group: 'visual',
    description:
      'DesignTribunalLanding.tsx existiert noch im Tree, aber /design/tribunal leitet per Navigate auf `/` um — keine erreichbare Preview-Route, daher nicht auf dem öffentlichen Roadmap.',
    evidence: [
      'src/pages/design/DesignTribunalLanding.tsx',
      'src/App.tsx#/design/tribunal→/',
    ],
    showOnRoadmap: false,
  },
  {
    id: 'welcome',
    name: 'Welcome / Login',
    status: 'live',
    group: 'surface',
    description:
      'OTP/OAuth unter /welcome — ?next= Resume nach Login (auch getSession); öffentliches /login (Magic-Link, Handoff v2) leitet Callbacks wieder nach /welcome; Post-Checkout-Wizard nur mit session=.',
    route: '/welcome',
    evidence: [
      'src/pages/Welcome.tsx',
      'src/pages/LoginPage.tsx',
      'src/App.tsx#/login',
      'src/lib/safeInternalPath.ts',
      'test/welcome/auth-resume-next.test.ts',
    ],
    showOnRoadmap: false,
  },
  {
    id: 'free-audit',
    name: 'Governance Scan',
    status: 'live',
    group: 'compliance',
    description: 'Kostenloser öffentlicher Website-Scan auf DSGVO-/Governance-Aspekte.',
    route: '/audit',
    evidence: ['src/pages/AuditLanding.tsx', 'test/landing/canonical-scan-entry.test.tsx'],
    showOnPlatform: true,
    ctaLabel: 'Free Audit starten',
  },
  {
    id: 'app-shell',
    name: 'Governance OS /app',
    status: 'live',
    group: 'runtime',
    description:
      'Authentifiziertes App-Shell: GovernanceBrowserShell gategt alle Shell-Routen via AppGate; Command Center unter /app/dashboard.',
    route: '/app',
    evidence: [
      'src/App.tsx',
      'src/components/governance-os/GovernanceBrowserShell.tsx',
      'src/features/auth/AppGate.tsx',
      'test/routing/app-shell-auth-gate.test.ts',
    ],
    showOnPlatform: true,
  },
  {
    id: 'command-center',
    name: 'Compliance Command Center',
    status: 'live',
    group: 'runtime',
    description:
      'CommandCenterDashboard unter /app/dashboard — HandoffOverview, BrowserRuntimePanel, ComplianceStatusView (Mandant/Lage/Jetzt), Bootstrap-Nächste-Schritte, Execute-Strip → /app/agents. Kein AgentOsPanel auf dieser Route.',
    route: '/app/dashboard',
    evidence: [
      'src/features/governance/dashboard/DashboardRouter.tsx',
      'src/features/governance/dashboard/CommandCenterDashboard.tsx',
      'src/features/governance/dashboard/ComplianceStatusDashboard.tsx#ComplianceStatusView',
      'src/features/governance/dashboard/workspaceBootstrapSteps.ts',
      'test/features/governance/dashboard/dashboard-command-center-surface.test.ts',
      'test/features/governance/dashboard/dashboard-router-source.test.ts',
    ],
    showOnPlatform: true,
  },
  {
    id: 'evidence-surfaces',
    name: 'Evidence / Nachweis-Export',
    status: 'live',
    group: 'compliance',
    description: 'Nachweisflächen unter /app/evidence und öffentliche Evidence-Seiten.',
    route: '/app/evidence',
    evidence: ['src/config/platform-capabilities.ts#evidence-export', 'src/config/platform-capabilities.ts#evidence-vault'],
    showOnPlatform: true,
  },
  {
    id: 'ai-act-classify',
    name: 'EU-AI-Act-Klassifizierung',
    status: 'live',
    group: 'compliance',
    description:
      'Öffentlicher Annex-III-Klassifikator unter /ai-act-klassifikator (Q&A + optionale LLM-Signalextraktion via Edge Function ai-act-classify). Kein Speichern ins Tenant-Inventar — siehe Preview ai-act-inventory-persist.',
    route: '/ai-act-klassifikator',
    evidence: [
      'src/pages/AiActClassifier.tsx',
      'src/App.tsx#/ai-act-klassifikator',
      'supabase/functions/ai-act-classify/index.ts',
      'src/lib/ai-act/signal-extraction.ts',
    ],
    showOnPlatform: true,
  },
  {
    id: 'ai-act-inventory-persist',
    name: 'EU-AI-Act-Inventar (Persistenz)',
    status: 'preview',
    group: 'compliance',
    description:
      'Klassifikation ins Register/Inventar speichern ist nicht freigeschaltet: ai_classification.limited steht in keinem Plan (kein Upgrade entsperrt; Lock-Copy nach #1743). UI-Button „In Tenant-Inventar speichern“ und ai-act-risk-inventory-Pfad existieren, Persistenz funktioniert noch nicht (fehlender Persist-Pfad / P1-2). Nicht live.',
    route: '/app/risk-inventory',
    evidence: [
      'src/pages/AiActClassifier.tsx#saveToInventory',
      'src/features/governance/aiActRiskInventoryApi.ts',
      'supabase/functions/ai-act-risk-inventory/index.ts',
      'src/core/billing/FeatureGate.tsx#ai_classification.limited',
      'src/components/governance-os/useNavLock.ts',
      'src/i18n/handoffApp.ts#classifyLocked',
      'PR #1743',
    ],
    showOnRoadmap: true,
  },
  {
    id: 'gdpr-audit-module',
    name: 'DSGVO- & Tracking-Audit',
    status: 'live',
    group: 'compliance',
    description: 'Cookie-/Tracker-Scan mit Bericht und wiederkehrender Nachprüfung.',
    route: '/audit',
    evidence: ['src/config/platform-capabilities.ts#gdpr-audit'],
    showOnPlatform: true,
  },
  {
    id: 'governance-runtime-core',
    name: 'Governance Runtime (Kernmodule)',
    status: 'live',
    group: 'runtime',
    description:
      'Risiko, Vorfälle, DSR, DSFA, Vendors und Freigaben — erreichbar im /app-Shell.',
    route: '/governance-runtime',
    evidence: ['src/config/platform-capabilities.ts#governance-runtime'],
    showOnPlatform: true,
  },
  {
    id: 'channel-bots',
    name: 'Bot-Laufzeit — Chat, WhatsApp, Telefon',
    status: 'preview',
    group: 'channels',
    description:
      'Start-Routen und Builder-UI erreichbar; volle Provider-Laufzeit noch Preview.',
    route: '/chatbot/start',
    evidence: [
      'src/pages/product-entry',
      'src/config/public-nav.ts',
      'src/features/governance bots views',
    ],
    showOnPlatform: false,
    showOnRoadmap: true,
  },
  {
    id: 'ai-gateway',
    name: 'AI Gateway',
    status: 'live',
    group: 'runtime',
    description: 'Kontrollierte Modellaufrufe mit Protokollierung und Kostenerfassung.',
    route: '/claude-code-optimizer',
    evidence: ['src/config/platform-capabilities.ts#ai-gateway'],
    showOnPlatform: true,
  },
  {
    id: 'automation-n8n',
    name: 'Automations / n8n Runtime',
    status: 'preview',
    group: 'runtime',
    description:
      'Skill-Katalog, automation-trigger und -callback existieren; Skills ohne Workflow-Bindung, Runtime-Host nicht erreichbar. Keine produktive Ausführung.',
    route: '/app/automations',
    evidence: [
      'supabase/functions/automation-trigger/index.ts',
      'supabase/functions/automation-callback/index.ts',
      'src/features/automations/AutomationSkillsView.tsx',
      'test/automations/skill-spalten.test.ts',
      'PR #1750',
    ],
    showOnRoadmap: true,
  },
  {
    id: 'policy-engine',
    name: 'Policy Engine',
    status: 'live',
    group: 'runtime',
    description: 'Governance-Regeln als ausführbare Kontrolllogik.',
    route: '/policy-engine',
    evidence: ['src/config/platform-capabilities.ts#policy-engine'],
    showOnPlatform: true,
  },
  {
    id: 'provenance',
    name: 'Herkunftsnachweis (C2PA)',
    status: 'live',
    group: 'compliance',
    description: 'Inhalte signieren und Herkunft überprüfbar machen.',
    evidence: ['src/config/platform-capabilities.ts#provenance'],
    showOnPlatform: true,
  },
  {
    id: 'hero-earth-scenery',
    name: 'Photoreal Earth Hero Backdrop',
    status: 'live',
    group: 'visual',
    description:
      'Live-Hero auf `/`: three.js-Szene (mountHeroEarth) hinter Landing-v4-Typografie — Blue-Marble/Night/Clouds/Normal/Specular, Sonne, Mond, Mars, ISS; lazy nach erstem Paint, kein WebGL unter navigator.webdriver.',
    route: '/',
    evidence: [
      'src/components/landing/v4/heroEarthScene.ts',
      'src/pages/LandingV4.tsx',
      'public/textures/hero-v4/',
      'test/landing/landing-v4.test.tsx',
      'PR #1751',
    ],
    showOnRoadmap: false,
  },
  {
    id: 'pricing-monthly',
    name: 'Monatspläne Starter / Growth / Agency',
    status: 'live',
    group: 'billing',
    description: 'Self-service Monatspreise €79 / €249 / €699 — Checkout-Routen vorhanden.',
    route: '/#pricing',
    evidence: [
      'shared/pricing.ts',
      'src/components/landing/v4/landing-v4-content.ts#PLANS',
      'src/components/landing/v4/LandingV4Sections.tsx#V4Pricing',
    ],
    showOnRoadmap: false,
  },
  {
    id: 'enterprise-inquiry',
    name: 'Enterprise-Anfrage',
    status: 'live',
    group: 'billing',
    description: 'Enterprise per Anfrage (/contact-sales) — kein Self-Service-Checkout.',
    route: '/contact-sales',
    evidence: [
      'src/components/landing/v4/LandingV4Sections.tsx#V4Enterprise',
      'src/pages/ContactSales.tsx',
    ],
    showOnRoadmap: false,
  },
  {
    id: 'web-builder',
    name: 'DSGVO Web App Builder',
    status: 'preview',
    group: 'channels',
    description:
      'Two-pane Studio unter /build (App Builder + Frontend Designer). Create/Claim plan-gated (limit.sites / siteos.builder); Publish-Berechtigung ab Starter, öffentliches Deploy/Domain bleibt Preview.',
    route: '/build',
    evidence: [
      'src/unified-entry/pages/BuildStudioPage.tsx',
      'src/features/siteos/builderEntitlements.ts',
      'src/features/siteos/BuilderUpgradePanel.tsx',
      'packages/siteos-core',
      'src/config/public-nav.ts',
      'shared/pricing.ts',
      'supabase/functions/siteos/site-entitlements.ts',
    ],
    showOnRoadmap: true,
  },
  {
    id: 'builder-entitlement-gate',
    name: 'Builder-Plan-Freischaltung',
    status: 'preview',
    group: 'billing',
    description:
      'Studio liest siteos.builder / siteos.publish / limit.sites via useEntitlements (Monetisierungs-PR). Publish bleibt Preview; kein Fake-Abo.',
    route: '/build',
    evidence: [
      'src/features/siteos/builderEntitlements.ts',
      'shared/pricing.ts',
      'test/siteos/builder-entitlements.test.ts',
    ],
    showOnRoadmap: true,
  },
  {
    id: 'frontend-modernize-wizard',
    name: 'Frontend Modernization Wizard',
    status: 'preview',
    group: 'channels',
    description:
      'FmtModernizeWizard unter /app/siteos/modernize (Enterprise+, Entitlement frontend.modernization) — AuthGate + Projekt/Source-Persistenz; kein vollständiger Self-Service-Ship, Greenfield bleibt /build.',
    route: '/app/siteos/modernize',
    evidence: [
      'src/features/siteos/fmt/FmtModernizeWizard.tsx',
      'src/features/siteos/fmt/fmtTypes.ts',
      'src/App.tsx#/app/siteos/modernize',
    ],
    showOnRoadmap: true,
  },
  {
    id: 'public-frontend-builder',
    name: 'Frontend Builder Landing',
    status: 'live',
    group: 'surface',
    description:
      'Öffentliche Landing /frontend-builder — Wizard-Funnel postet qualifizierte Anfragen an Edge Function sales-lead (kein Self-Service-Deploy).',
    route: '/frontend-builder',
    evidence: [
      'src/pages/frontend-builder/FrontendBuilderLanding.tsx',
      'src/pages/frontend-builder/builderSteps.ts',
      'src/App.tsx#/frontend-builder',
    ],
    showOnRoadmap: false,
  },
  {
    id: 'public-kontakt',
    name: 'Kontakt',
    status: 'live',
    group: 'surface',
    description: 'Öffentliche Kontaktfläche /kontakt → sales-lead Formular.',
    route: '/kontakt',
    evidence: ['src/pages/KontaktPage.tsx', 'src/pages/ContactSales.tsx'],
    showOnRoadmap: false,
  },
  {
    id: 'auth-logout',
    name: 'Check-out / Logout',
    status: 'live',
    group: 'surface',
    description: 'Echter Sign-out unter /logout, Rückkehr zur Startseite.',
    route: '/logout',
    evidence: ['src/pages/LogoutPage.tsx'],
    showOnRoadmap: false,
  },
  {
    id: 'tenant-custom-domain',
    name: 'Customer Domain ↔ Dashboard',
    status: 'preview',
    group: 'channels',
    description:
      'DomainManager auf /app/websites + website-domain-manager — Cloudflare-Provisioning noch Preview.',
    route: '/app/websites',
    evidence: [
      'src/features/website-operations/DomainManager.tsx',
      'src/features/website-operations/TenantCustomDomainPanel.tsx',
      'supabase/functions/website-domain-manager',
    ],
    showOnRoadmap: true,
  },
  {
    id: 'stripe-checkout-e2e',
    name: 'Stripe Checkout E2E',
    status: 'live',
    group: 'billing',
    description:
      'Checkout/Webhook/Portal verdrahtet; Vault Stripe-Secrets provisioniert; Self-Service monatlich für starter/growth/agency; Jahresabrechnung Coming Soon; Enterprise per Anfrage.',
    route: '/checkout/starter',
    evidence: [
      'src/features/billing/CheckoutPage.tsx',
      'supabase/functions/stripe-checkout',
      'supabase/functions/stripe-webhook',
      'supabase/functions/stripe-portal',
      'supabase/migrations/20260913000000_stripe_live_catalog_tax_inclusive_price_ids.sql',
      'test/billing/checkoutPage.test.tsx',
      'PR #1327',
    ],
    showOnRoadmap: false,
  },
  {
    id: 'governance-activation',
    name: 'Governance Activation',
    status: 'live',
    group: 'activation',
    description:
      'Org+Scope Activation unter /app/activation — Resume über /welcome?next= (getSession + SIGNED_IN).',
    route: '/app/activation',
    evidence: [
      'src/features/activation',
      'src/pages/Welcome.tsx',
      'src/components/landing/GovernanceActivationSection.tsx',
      'test/welcome/auth-resume-next.test.ts',
      'PR #1326',
    ],
    showOnRoadmap: false,
    showOnPlatform: true,
  },
  {
    id: 'activation-blueprint',
    name: 'Auto-Blueprint Engine',
    status: 'coming-soon',
    group: 'activation',
    description: 'Automatische Blueprint-Erzeugung in der Activation — noch Preview/Coming Soon.',
    route: '/app/activation',
    evidence: ['PR #1326'],
    showOnRoadmap: true,
  },
  {
    id: 'activation-doc-extract',
    name: 'Document Extraction',
    status: 'coming-soon',
    group: 'activation',
    description: 'Dokument-Extraktion und Mapping für Activation — Coming Soon.',
    route: '/app/activation',
    evidence: ['PR #1326'],
    showOnRoadmap: true,
  },
  {
    id: 'activation-expert-review',
    name: 'Expert Review',
    status: 'coming-soon',
    group: 'activation',
    description: 'Experten-Review-Warteschlange — Coming Soon.',
    route: '/app/activation',
    evidence: ['PR #1326'],
    showOnRoadmap: true,
  },
  {
    id: 'command-center-polish',
    name: 'Command Center Polish',
    status: 'live',
    group: 'runtime',
    description:
      'Dark/Gold/Cream Chrome für /app + /build, ehrliche StatusBar, CommandCenterDashboard mit ComplianceStatusView und BrowserRuntimePanel — erreichbar; Agent-OS-Mesh nicht auf /app/dashboard gemountet.',
    route: '/app/dashboard',
    evidence: [
      'src/components/governance-os/osChrome.ts',
      'src/components/governance-os/BrowserTopBar.tsx',
      'src/components/governance-os/GovernanceStatusBar.tsx',
      'src/features/governance/dashboard/CommandCenterDashboard.tsx',
      'src/unified-entry/pages/BuildStudioPage.tsx',
      'test/features/governance/dashboard/dashboard-command-center-surface.test.ts',
    ],
    showOnRoadmap: false,
  },
  {
    id: 'governance-sphere-interactive',
    name: 'Interactive Governance Sphere',
    status: 'preview',
    group: 'visual',
    description:
      'GovernanceSphereHost (DEMO/SIMULATED-HUD, orbit Earth) exists as component — not mounted on public `/` (Landing-v4 three.js Earth hero instead).',
    evidence: [
      'src/components/governance-frontend/GovernanceSphereHost.tsx',
      'test/landing/governance-sphere.test.ts',
    ],
    showOnRoadmap: true,
  },
  {
    id: 'pricing-yearly',
    name: 'Jahresabrechnung',
    status: 'coming-soon',
    group: 'billing',
    description: 'Yearly Prices sind in Stripe nicht verdrahtet (yearlyCheckoutUnavailable).',
    evidence: ['shared/pricing.ts'],
    showOnRoadmap: true,
  },
  {
    id: 'continuous-domain-monitoring',
    name: 'Dauerhafte Domain-Überwachung',
    status: 'coming-soon',
    group: 'compliance',
    description:
      'Post-Scan „Diese Domain überwachen“ — Cron/monitored_domains partiell; öffentlicher Funnel Coming Soon.',
    route: '/app/monitoring',
    evidence: [
      'src/components/audit/PostScanChoiceRow.tsx',
      'supabase/functions/audit-monitor-cron',
      'docs/product/scan-funnel.md',
    ],
    showOnRoadmap: true,
  },
  {
    id: 'post-scan-choice-row',
    name: 'Post-Scan Choice Row',
    status: 'live',
    group: 'surface',
    description:
      'Vier ehrliche Next Steps nach /audit (Monitor Coming Soon, Fix-Plan, Activation, Export Preview).',
    route: '/audit',
    evidence: [
      'src/components/audit/PostScanChoiceRow.tsx',
      'src/components/audit/Top3RisksPreview.tsx',
      'docs/product/scan-funnel.md',
    ],
    showOnRoadmap: false,
  },
  {
    id: 'agent-governance',
    name: 'Agent Governance',
    status: 'preview',
    group: 'runtime',
    description:
      'Action Request → Policy → Risk → Permission → Evidence — Hub live; Kernel-Slice Preview (#1331).',
    route: '/agent-governance',
    evidence: [
      'src/pages/content/AgentGovernancePage.tsx',
      'src/components/landing/LandingOsSpine.tsx',
      'PR #1331',
    ],
    showOnRoadmap: true,
  },
  {
    id: 'framework-tisax-dora',
    name: 'TISAX / DORA Frameworks',
    status: 'coming-soon',
    group: 'compliance',
    description:
      'Framework-Strip markiert TISAX/DORA als Roadmap ohne eigene Route — kein Fake-LIVE, kein Policy-Packs-Alias.',
    evidence: ['src/features/governance/dashboard/ComplianceStatusDashboard.tsx'],
    showOnRoadmap: true,
  },
  {
    id: 'agent-os-command-center',
    name: 'RealSync Agent OS™ — Command Center Slice',
    status: 'preview',
    group: 'runtime',
    description:
      'AgentOsPanel (Intent „Was möchtest du erledigen?“) und realsync-os Kernel-Slice existieren im Tree — nicht gemountet auf dem live /app/dashboard (CommandCenterDashboard mountet bewusst kein AgentOsPanel; Agents unter /app/agents).',
    evidence: [
      'docs/product/realsync-agent-os.md',
      'src/features/governance/agent-os/AgentOsPanel.tsx',
      'src/features/governance/dashboard/CommandCenterDashboard.tsx',
      'src/core/realsync-os/complianceArtifacts.ts',
      'test/core/realsync-os/agent-os-slice.test.ts',
      'test/features/governance/dashboard/dashboard-command-center-surface.test.ts',
    ],
    showOnRoadmap: true,
  },
  {
    id: 'agent-os-mesh-compliance',
    name: 'Agent OS — Compliance Specialist',
    status: 'preview',
    group: 'runtime',
    description:
      'Mesh-Agent-Code (Compliance Specialist) im Tree; Production bleibt approval-pflichtig. Nicht als Live-Panel auf /app/dashboard verdrahtet.',
    evidence: [
      'src/core/realsync-os/agentMesh.ts',
      'src/core/realsync-os/planner.ts',
      'test/features/governance/dashboard/dashboard-command-center-surface.test.ts',
    ],
    showOnRoadmap: true,
  },
  {
    id: 'agent-os-mesh-specialists',
    name: 'Agent OS — Specialist Mesh (non-compliance)',
    status: 'coming-soon',
    group: 'runtime',
    description:
      'Product, Marketing, Sales, Growth, QA, Pricing, Evidence, Security, DevOps, … — Roster sichtbar, nicht ausführbar.',
    evidence: ['src/core/realsync-os/agentMesh.ts', 'docs/product/realsync-agent-os.md'],
    showOnRoadmap: true,
  },
  {
    id: 'agent-os-chrome-side-panel',
    name: 'Agent OS — Chrome Side Panel',
    status: 'coming-soon',
    group: 'runtime',
    description: 'Analyze Page / GDPR / AI Act / Evidence — Spec only, keine Fake-Extension.',
    evidence: ['docs/product/realsync-agent-os.md'],
    showOnRoadmap: true,
  },
  {
    id: 'agent-os-hostinger-workers',
    name: 'Agent OS — Hostinger Worker Runtime',
    status: 'coming-soon',
    group: 'runtime',
    description: 'Zukünftige Worker-Runtime; Cloudflare Edge bleibt Deploy-Pfad.',
    evidence: ['docs/product/realsync-agent-os.md'],
    showOnRoadmap: true,
  },
  {
    id: 'agent-os-product-evolution',
    name: 'Agent OS — Product Evolution Integrity Loop',
    status: 'preview',
    group: 'runtime',
    description:
      'Read-only Integrity Panel (Pricing/Entitlements) lebt in AgentOsPanel — Panel ist nicht auf /app/dashboard gemountet; Dominik approved — kein Auto-Merge von PRs.',
    evidence: [
      'src/features/governance/agent-os/AgentOsPanel.tsx',
      'src/core/billing/useEntitlements.ts',
      'test/features/governance/dashboard/dashboard-command-center-surface.test.ts',
    ],
    showOnRoadmap: true,
  },
] as const;

export const LIVE_IMPLEMENTATION = IMPLEMENTATION_ITEMS.filter((i) => i.status === 'live');
export const PREVIEW_IMPLEMENTATION = IMPLEMENTATION_ITEMS.filter((i) => i.status === 'preview');
export const COMING_SOON_IMPLEMENTATION = IMPLEMENTATION_ITEMS.filter(
  (i) => i.status === 'coming-soon',
);

export const PLATFORM_LIVE_ITEMS = LIVE_IMPLEMENTATION.filter((i) => i.showOnPlatform);

export const ROADMAP_ITEMS = IMPLEMENTATION_ITEMS.filter(
  (i) => i.showOnRoadmap !== false && i.status !== 'live',
);

/** Live cards shown on public #roadmap (platform + scan + monthly pricing). */
export const ROADMAP_LIVE_ITEMS = LIVE_IMPLEMENTATION.filter(
  (i) => i.showOnPlatform || i.id === 'free-audit' || i.id === 'pricing-monthly',
);

/** Preview cards for public #roadmap (respects showOnRoadmap: false). */
export const ROADMAP_PREVIEW_ITEMS = PREVIEW_IMPLEMENTATION.filter(
  (i) => i.showOnRoadmap !== false,
);

/** Coming-soon cards for public #roadmap (respects showOnRoadmap: false). */
export const ROADMAP_COMING_SOON_ITEMS = COMING_SOON_IMPLEMENTATION.filter(
  (i) => i.showOnRoadmap !== false,
);

export function getImplementation(id: string): ImplementationItem | undefined {
  return IMPLEMENTATION_ITEMS.find((i) => i.id === id);
}

export function isImplementationLive(id: string): boolean {
  return getImplementation(id)?.status === 'live';
}

export const STATUS_LABEL: Record<ImplementationStatus, string> = {
  live: 'LIVE',
  preview: 'PREVIEW',
  'coming-soon': 'COMING SOON',
};

/**
 * Phrases that must not appear as unqualified live promises on the public
 * landing. CI greps these against landing surfaces.
 */
export const LANDING_FORBIDDEN_LIVE_CLAIMS = [
  'Vollständige KI-Governance',
  'vollständige KI-Governance',
  'voll funktionsfähig',
  'complete runtime',
  'Complete Runtime',
  'vollständig verfügbar',
  'vollständig produktionsbereit',
] as const;
