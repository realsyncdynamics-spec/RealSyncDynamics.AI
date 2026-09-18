/** Registered token graph for the Command Center. Not a repo-wide scanner. */

export type BindingKind = 'var' | 'selector' | 'override' | 'constraint';
export type ImpactRisk = 'low' | 'medium' | 'high' | 'blocked';
export type TokenScope = 'shared';

export interface TokenBinding {
  file: string;
  symbol: string;
  kind: BindingKind;
  testIds?: readonly string[];
}

export interface TokenSurface {
  route: string;
  layout: string;
}

export interface DashboardToken {
  key: string;
  scope: TokenScope;
  target: string;
  defaultValue: string;
  unit?: 'px';
  min?: number;
  max?: number;
  bindings: readonly TokenBinding[];
  surfaces: readonly TokenSurface[];
  sisters?: readonly string[];
  forbidden: readonly string[];
  constraints: readonly string[];
}

export const FORBIDDEN_PATHS = [
  'src/pages/MainLanding.tsx',
  'src/features/siteos',
  'src/components/landing',
] as const;

export const KPI_TEST_IDS = [
  'governance-score',
  'risk-index',
  'evidence-health',
  'audit-readiness',
] as const;

const COMMAND_CENTER: TokenSurface = {
  route: '/app/dashboard',
  layout: 'ComplianceStatusDashboard',
};

export const DASHBOARD_TOKENS: readonly DashboardToken[] = [
  {
    key: '--dash-kpi-min-height',
    scope: 'shared',
    target: '[data-testid="compliance-status-dashboard"]',
    defaultValue: '120px',
    unit: 'px',
    min: 96,
    max: 160,
    bindings: [
      {
        file: 'src/styles/dashboard-tokens.css',
        symbol: '.dash-kpi-card',
        kind: 'var',
        testIds: KPI_TEST_IDS,
      },
      {
        file: 'src/features/governance/dashboard/ComplianceStatusDashboard.tsx',
        symbol: 'ScoreCard / RiskCard / EvidenceCard / ReadinessCard',
        kind: 'var',
        testIds: KPI_TEST_IDS,
      },
    ],
    surfaces: [COMMAND_CENTER],
    sisters: KPI_TEST_IDS,
    forbidden: FORBIDDEN_PATHS,
    constraints: ['four-kpi-equal-height', 'does-not-change-score-value'],
  },
  {
    key: '--dash-title-size',
    scope: 'shared',
    target: '[data-testid="compliance-status-dashboard"]',
    defaultValue: '22px',
    unit: 'px',
    min: 18,
    max: 28,
    bindings: [
      {
        file: 'src/styles/dashboard-tokens.css',
        symbol: 'h1.dash-command-title',
        kind: 'var',
      },
      {
        file: 'src/features/governance/dashboard/ComplianceStatusDashboard.tsx',
        symbol: 'h1.dash-command-title',
        kind: 'var',
      },
    ],
    surfaces: [COMMAND_CENTER],
    forbidden: FORBIDDEN_PATHS,
    constraints: ['not-landing-hero'],
  },
  {
    key: '--dash-title-size-sm',
    scope: 'shared',
    target: '[data-testid="compliance-status-dashboard"]',
    defaultValue: '28px',
    unit: 'px',
    min: 22,
    max: 36,
    bindings: [
      {
        file: 'src/styles/dashboard-tokens.css',
        symbol: 'h1.dash-command-title @media (min-width: 640px)',
        kind: 'var',
      },
    ],
    surfaces: [COMMAND_CENTER],
    sisters: ['--dash-title-size'],
    forbidden: FORBIDDEN_PATHS,
    constraints: ['not-landing-hero'],
  },
  {
    key: '--dash-radius',
    scope: 'shared',
    target: '[data-testid="compliance-status-dashboard"]',
    defaultValue: '0px',
    unit: 'px',
    min: 0,
    max: 0,
    bindings: [
      {
        file: 'src/styles/dashboard-tokens.css',
        symbol: 'industrial lock',
        kind: 'constraint',
      },
    ],
    surfaces: [COMMAND_CENTER],
    forbidden: FORBIDDEN_PATHS,
    constraints: ['hard-edge-zero-radius'],
  },
];

export function tokenByKey(key: string): DashboardToken | undefined {
  return DASHBOARD_TOKENS.find((token) => token.key === key);
}
