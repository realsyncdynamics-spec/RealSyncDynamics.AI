import type { Binding, Constraint, Surface, TokenDef } from './types';

export const SOURCE_FILES = {
  theme: 'src/index.css',
  context: 'src/styles/context-themes.css',
  density: 'src/features/governance/dashboard/command-center-density.css',
} as const;

export const FORBIDDEN_PATHS = [
  'src/pages/MainLanding.tsx',
  'src/styles/enterprise-hero.css',
  'src/features/siteos',
  'src/features/dashboard/components/ScoreCard.tsx',
  'src/features/workspace/WorkspaceHome.tsx',
] as const;

export const KPI_SISTERS = [
  'governance-score',
  'risk-index',
  'evidence-health',
  'audit-readiness',
] as const;

export const TOKENS: TokenDef[] = [
  {
    key: '--dash-title-size',
    scope: 'shared',
    targetBlock: '.dashboard-context',
    group: 'type',
    baseline: '22px',
  },
  {
    key: '--dash-title-size-sm',
    scope: 'shared',
    targetBlock: '.dashboard-context',
    group: 'type',
    baseline: '28px',
  },
  {
    key: '--dash-kpi-min-height',
    scope: 'shared',
    targetBlock: '.dashboard-context',
    group: 'density',
    baseline: '120px',
  },
  {
    key: '--context-radius-card',
    scope: 'shared',
    targetBlock: '.dashboard-context',
    group: 'radius',
    baseline: '0',
  },
];

export const BINDINGS: Binding[] = [
  {
    token: '--dash-title-size',
    file: SOURCE_FILES.density,
    symbol: '[data-testid="compliance-status-dashboard"] h1',
    kind: 'selector',
    notes: 'Legacy overlay. Must keep var() until h1 consumes the token directly.',
  },
  {
    token: '--dash-title-size-sm',
    file: SOURCE_FILES.density,
    symbol: '@media (min-width: 640px) h1',
    kind: 'selector',
  },
  {
    token: '--dash-kpi-min-height',
    file: SOURCE_FILES.density,
    symbol: KPI_SISTERS.join(', '),
    kind: 'selector',
    notes: 'Four KPI cards must stay equal height.',
  },
  {
    token: '--context-radius-card',
    file: SOURCE_FILES.context,
    symbol: '.dashboard-context',
    kind: 'var',
    notes: 'Hard-Edge Industrial lock. Values other than 0 are blocked.',
  },
];

export const SURFACES: Surface[] = [
  {
    id: 'command-center',
    route: '/app/dashboard',
    fixture: 'ComplianceStatusDashboard/fixtures',
    tokens: [
      '--dash-title-size',
      '--dash-title-size-sm',
      '--dash-kpi-min-height',
      '--context-radius-card',
    ],
  },
];

export const CONSTRAINTS: Constraint[] = [
  {
    token: '--context-radius-card',
    id: 'industrial-radius-lock',
    check: (value) => {
      const n = Number.parseFloat(value);
      return n === 0 ? null : 'Hard-Edge Industrial: --context-radius-card must stay 0';
    },
  },
  {
    token: '--dash-kpi-min-height',
    id: 'kpi-height-range',
    check: (value) => {
      const n = Number.parseFloat(value);
      if (!Number.isFinite(n)) return 'KPI min-height must be a length';
      if (n < 96 || n > 180) return 'KPI min-height out of 96–180px band';
      return null;
    },
  },
];

export function tokenDef(key: string): TokenDef | undefined {
  return TOKENS.find((item) => item.key === key);
}

export function bindingsFor(token: string): Binding[] {
  return BINDINGS.filter((item) => item.token === token);
}

export function surfacesFor(token: string): Surface[] {
  return SURFACES.filter((item) => item.tokens.includes(token));
}
