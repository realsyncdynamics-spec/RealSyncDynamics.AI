/**
 * Platform Intelligence Agent Policies
 *
 * Defines what the autonomous agent system can and cannot do.
 * Central source of truth for agent autonomy rules.
 */

export const AGENT_POLICIES = {
  // Schedule: When agents run
  schedule: {
    dailyRun: '0 6 * * *', // 06:00 UTC daily
    onPushToMain: true,     // Also run immediately after push
    maxConcurrentAgents: 3,
  },

  // Autonomy: What agents can do without approval
  autonomy: {
    // Auto-apply changes (no PR required)
    autoApply: {
      textUpdates: true,       // Fix typos, improve copy
      uiLabels: true,          // Button text, headings
      comments: true,          // Code comments
      documentation: true,     // README, markdown
      routingDocs: true,       // Route documentation
    },

    // Auto-merge PRs (if tests pass)
    autoMergeCandidates: {
      enabled: true,
      requireTests: true,
      requireReview: false,
      onlyForAuthor: 'platform-intelligence-agent',
    },
  },

  // Restrictions: What always needs approval
  restrictions: {
    neverAuto: [
      'stripe-*',              // Any Stripe price/product changes
      'database-migration',    // Schema changes
      'auth-policy',           // RLS policy changes
      'production-deploy',     // Deployments
      'service-key-*',         // Secret/key changes
      'payment-logic',         // Billing logic
      'security-*',            // Security patches to review
    ],
  },

  // Notifications: Where reports go
  notifications: {
    slack: {
      enabled: true,
      channel: '#platform-evolution',
      events: ['daily-summary', 'critical-finding', 'pr-created'],
    },
    github: {
      enabled: true,
      labels: ['platform-intelligence', 'auto-generated'],
      assignees: [],  // Can be filled by team
    },
    email: {
      enabled: false,
      recipients: [],
    },
  },

  // Scope: What parts of the platform to analyze
  scope: {
    repositories: [
      'realsyncdynamics-spec/realsyncdynamics.ai',
    ],
    directories: [
      'src/pages/',           // Public pages
      'src/features/',        // Protected features
      'src/components/',      // Shared components
      'src/config/',          // Configuration
      'src/enterprise-os/',   // Workspace layouts
      'supabase/functions/',  // Edge functions
      'supabase/migrations/', // Database
    ],
    excludeDirs: [
      'node_modules/',
      'dist/',
      '.next/',
      'coverage/',
    ],
  },

  // Analysis: What to check
  analysis: {
    routingQuality: {
      enabled: true,
      checkOrphanPages: true,
      checkDeadLinks: true,
      checkDuplicateFunctionality: true,
    },
    uxOptimization: {
      enabled: true,
      checkColorContrast: true,
      checkButtonLabels: true,
      checkNavigationClarity: true,
    },
    customerJourney: {
      enabled: true,
      checkSignupFlow: true,
      checkOnboardingSteps: true,
      checkCheckoutPath: true,
      maxStepsToGoal: 7,
    },
    dashboardEvolution: {
      enabled: true,
      enforceFirstDashboard: true, // New features dashboard-first
      checkModuleOrganization: true,
      checkFeatureDiscoverability: true,
    },
    stripeAlignment: {
      enabled: true,
      syncPrices: true,
      syncFeatures: true,
      validateCheckout: true,
    },
  },

  // Thresholds: When to escalate
  thresholds: {
    priorityHigh: 5,        // Number of issues before flagging as high-priority
    performanceWarning: 2000, // ms load time
    conversionLoss: 0.05,   // 5% drop triggers alert
    typeErrorCount: 10,
    lintErrorCount: 20,
  },

  // Integration: Where to write issues
  integrations: {
    github: {
      createIssues: true,
      createPRs: true,
      prTemplate: 'platform-intelligence',
    },
    sentry: {
      enabled: false,
      trackIssues: false,
    },
  },

  // Verbosity: How detailed reports should be
  reporting: {
    summaryLevel: 'detailed', // 'brief' | 'normal' | 'detailed'
    includeMetrics: true,
    includeRecommendations: true,
    maxIssuesPerReport: 15,
  },
};

/**
 * Sub-agent configuration
 * Each agent has specific responsibilities and analysis focus
 */
export const SUB_AGENTS = {
  'ux-optimization': {
    name: 'UX Optimization Agent',
    description: 'Optimizes colors, buttons, text, and user guidance',
    enabled: true,
    priority: 'high',
    focus: [
      'button-labels',
      'color-contrast',
      'navigation-clarity',
      'form-validation',
      'error-messages',
    ],
  },

  'customer-journey': {
    name: 'Customer Journey Agent',
    description: 'Maps and optimizes end-to-end customer flows',
    enabled: true,
    priority: 'critical',
    focus: [
      'signup-flow',
      'onboarding-steps',
      'checkout-path',
      'feature-discovery',
      'success-metrics',
    ],
  },

  'dashboard-evolution': {
    name: 'Dashboard Evolution Agent',
    description: 'Ensures new features integrate into central dashboard',
    enabled: true,
    priority: 'high',
    focus: [
      'feature-placement',
      'module-organization',
      'discoverability',
      'workspace-coherence',
    ],
  },

  'routing-quality': {
    name: 'Routing Quality Agent',
    description: 'Audits routes, links, and navigation structure',
    enabled: true,
    priority: 'medium',
    focus: [
      'orphan-pages',
      'dead-links',
      'route-conflicts',
      'navigation-consistency',
      'redirect-chains',
    ],
  },

  'stripe-business': {
    name: 'Stripe Business Agent',
    description: 'Ensures pricing, features, and billing alignment',
    enabled: true,
    priority: 'critical',
    focus: [
      'price-accuracy',
      'feature-mapping',
      'checkout-sync',
      'subscription-logic',
      'billing-compliance',
    ],
  },
};

/**
 * Issue severity levels and escalation rules
 */
export const SEVERITY_LEVELS = {
  critical: {
    slackThread: true,
    requiresApproval: true,
    autoMerge: false,
    escalateToOnCall: true,
  },
  high: {
    slackThread: true,
    requiresApproval: true,
    autoMerge: false,
    escalateToOnCall: false,
  },
  medium: {
    slackThread: false,
    requiresApproval: false,
    autoMerge: true,
    escalateToOnCall: false,
  },
  low: {
    slackThread: false,
    requiresApproval: false,
    autoMerge: true,
    escalateToOnCall: false,
  },
};
