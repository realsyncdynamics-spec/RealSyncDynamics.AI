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
export const IMPLEMENTATION_MEASURED_AT = '2026-09-12';

export const IMPLEMENTATION_ITEMS: readonly ImplementationItem[] = [
  {
    id: 'public-landing',
    name: 'Public Landing',
    status: 'live',
    group: 'surface',
    description:
      'Dominik Dark/Gold Hero (AI Governance, Running in Real Time) — cream copy on photoreal Earth backdrop; scan → /audit; Starter/Growth/Agency pricing. No Sphere HUD.',
    route: '/',
    evidence: [
      'src/pages/MainLanding.tsx',
      'src/components/governance-frontend/hero-content.ts',
      'src/components/landing/HeroEarthBackdrop.tsx',
      'test/landing/platform-capabilities.test.ts',
    ],
    showOnRoadmap: false,
  },
  {
    id: 'design-landing-ledger',
    name: 'Evidence Ledger Landing (Design)',
    status: 'preview',
    group: 'visual',
    description:
      'Alternatives Design-Chrome (Steel/Ice/Blue) unter /design/ledger — Preview, ersetzt nicht Live-/.',
    route: '/design/ledger',
    evidence: ['src/pages/design/DesignLedgerLanding.tsx', 'src/App.tsx'],
    showOnRoadmap: true,
  },
  {
    id: 'design-landing-tribunal',
    name: 'Tribunal Landing (Design)',
    status: 'preview',
    group: 'visual',
    description:
      'Alternatives Paper-OS-Design (Ink/Burgundy) unter /design/tribunal — Preview, ersetzt nicht Live-/.',
    route: '/design/tribunal',
    evidence: ['src/pages/design/DesignTribunalLanding.tsx', 'src/App.tsx'],
    showOnRoadmap: true,
  },
  {
    id: 'welcome',
    name: 'Welcome / Login',
    status: 'live',
    group: 'surface',
    description:
      'OTP/OAuth unter /welcome — ?next= Resume nach Login (auch getSession); Post-Checkout-Wizard nur mit session=.',
    route: '/welcome',
    evidence: [
      'src/pages/Welcome.tsx',
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
      'ComplianceStatusDashboard unter /app/dashboard — Dark/Gold Chrome, Agent OS Intent, ehrliche Empty States.',
    route: '/app/dashboard',
    evidence: [
      'src/features/governance/dashboard/ComplianceStatusDashboard.tsx',
      'src/features/governance/agent-os/AgentOsPanel.tsx',
      'src/components/governance-os/BrowserTopBar.tsx',
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
    description: 'KI-Systeme nach Risikoklasse einordnen und als Inventar führen.',
    route: '/ai-act-governance',
    evidence: ['src/config/platform-capabilities.ts#ai-act'],
    showOnPlatform: true,
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
      'Public `/` full-bleed HeroEarthBackdrop (8K day+night scenery, pointer-events-none) — Earth behind Dominik copy, no Sphere widget, no continent HUD.',
    route: '/',
    evidence: [
      'src/components/landing/HeroEarthBackdrop.tsx',
      'src/components/landing/HeroEarthBackdropScene.tsx',
      'src/pages/MainLanding.tsx',
      'src/components/visual/earthTextures.ts',
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
    evidence: ['shared/pricing.ts', 'src/components/landing/LandingPricingSection.tsx'],
    showOnRoadmap: false,
  },
  {
    id: 'enterprise-inquiry',
    name: 'Enterprise-Anfrage',
    status: 'live',
    group: 'billing',
    description: 'Enterprise per Anfrage (/contact-sales) — kein Self-Service-Checkout.',
    route: '/contact-sales',
    evidence: ['src/components/landing/EnterpriseAccessSection.tsx'],
    showOnRoadmap: false,
  },
  {
    id: 'web-builder',
    name: 'DSGVO Web App Builder',
    status: 'preview',
    group: 'channels',
    description:
      'SiteOS Builder unter /build mit Governance-OS-Chrome — Publish/Domain und Governance-Tiefe bleiben Preview.',
    route: '/build',
    evidence: [
      'src/unified-entry/pages/BuildStudioPage.tsx',
      'packages/siteos-core',
      'src/config/public-nav.ts',
    ],
    showOnRoadmap: true,
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
    status: 'preview',
    group: 'billing',
    description:
      'Checkout-Seiten + stripe-checkout/webhook/portal verdrahtet; E2E production-ready erst nach Vault-Secrets (STRIPE_*, Webhook).',
    route: '/checkout/starter',
    evidence: [
      'src/features/billing/CheckoutPage.tsx',
      'supabase/functions/stripe-checkout',
      'test/billing/checkoutPage.test.tsx',
      'PR #1327',
    ],
    showOnRoadmap: true,
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
      'Dark/Gold/Cream Chrome für /app + /build, ehrliche StatusBar, Agent-OS Intent-Row und Mesh Preview/Coming-Soon — erreichbar.',
    route: '/app/dashboard',
    evidence: [
      'src/components/governance-os/osChrome.ts',
      'src/components/governance-os/BrowserTopBar.tsx',
      'src/components/governance-os/GovernanceStatusBar.tsx',
      'src/features/governance/agent-os/AgentOsPanel.tsx',
      'src/unified-entry/pages/BuildStudioPage.tsx',
    ],
    showOnRoadmap: false,
  },
  {
    id: 'governance-sphere-interactive',
    name: 'Interactive Governance Sphere',
    status: 'preview',
    group: 'visual',
    description:
      'GovernanceSphereHost (DEMO/SIMULATED-HUD, orbit Earth) exists as component — not mounted on public `/` (Earth backdrop scenery instead).',
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
    description:       'Framework-Reifegrade im Command Center als Roadmap markiert.',
    evidence: ['src/features/governance/dashboard/ComplianceStatusDashboard.tsx'],
    showOnRoadmap: true,
  },
  {
    id: 'agent-os-command-center',
    name: 'RealSync Agent OS™ — Command Center Slice',
    status: 'preview',
    group: 'runtime',
    description:
      'Intent „Was möchtest du erledigen?“ auf /app — Compliance 10-Artefakt-Session via realsync-os Kernel. Kein zweites Dashboard.',
    route: '/app/dashboard',
    evidence: [
      'docs/product/realsync-agent-os.md',
      'src/features/governance/agent-os/AgentOsPanel.tsx',
      'src/core/realsync-os/complianceArtifacts.ts',
      'test/core/realsync-os/agent-os-slice.test.ts',
    ],
    showOnRoadmap: true,
  },
  {
    id: 'agent-os-mesh-compliance',
    name: 'Agent OS — Compliance Specialist',
    status: 'preview',
    group: 'runtime',
    description:
      'Einziger Mesh-Agent mit Preview-Lauf; SiteOS evaluate_governance wenn gebunden. Production bleibt approval-pflichtig.',
    route: '/app/dashboard',
    evidence: ['src/core/realsync-os/agentMesh.ts', 'src/core/realsync-os/planner.ts'],
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
      'Read-only Integrity Panel (Pricing/Entitlements). Dominik approved — kein Auto-Merge von PRs.',
    route: '/app/dashboard',
    evidence: [
      'src/features/governance/agent-os/AgentOsPanel.tsx',
      'src/core/billing/useEntitlements.ts',
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
