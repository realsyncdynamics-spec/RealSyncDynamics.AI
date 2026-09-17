import {
  DASHBOARD_TOKENS,
  tokenByKey,
  type DashboardToken,
  type ImpactRisk,
} from './impact-manifest';

export type Draft = Record<string, string>;

export interface TokenImpact {
  key: string;
  from: string;
  to: string;
  scope: DashboardToken['scope'];
  target: string;
  surfaces: DashboardToken['surfaces'];
  bindings: DashboardToken['bindings'];
  sisters: readonly string[];
  forbidden: readonly string[];
  constraints: readonly string[];
  risk: ImpactRisk;
  reasons: string[];
  mergeable: boolean;
}

export interface ImpactReport {
  changes: TokenImpact[];
  mergeable: boolean;
  blocked: string[];
}

function numericPx(value: string): number | null {
  const match = /^(-?\d+(?:\.\d+)?)px$/.exec(value.trim());
  return match ? Number(match[1]) : null;
}

function riskFor(token: DashboardToken, next: string): { risk: ImpactRisk; reasons: string[] } {
  const reasons: string[] = [];
  let risk: ImpactRisk = 'low';

  if (token.bindings.some((binding) => binding.kind === 'selector')) {
    reasons.push('selector binding still in command-center-density.css');
    risk = 'medium';
  }
  if (token.bindings.some((binding) => binding.kind === 'override')) {
    reasons.push('call-site utility may win or fight the token');
    risk = risk === 'low' ? 'medium' : risk;
  }
  if ((token.sisters?.length ?? 0) > 1) {
    reasons.push('sister surfaces must stay equal');
    if (risk === 'low') risk = 'medium';
  }

  const parsed = numericPx(next);
  if (token.unit === 'px' && parsed === null) {
    reasons.push('value is not px');
    return { risk: 'blocked', reasons };
  }
  if (parsed !== null && token.min !== undefined && parsed < token.min) {
    reasons.push(`below min ${token.min}px`);
    return { risk: 'blocked', reasons };
  }
  if (parsed !== null && token.max !== undefined && parsed > token.max) {
    reasons.push(`above max ${token.max}px`);
    return { risk: 'blocked', reasons };
  }
  if (token.constraints.includes('hard-edge-zero-radius') && next !== '0px') {
    reasons.push('Hard-Edge industrial lock: radius must stay 0px');
    return { risk: 'blocked', reasons };
  }

  return { risk, reasons };
}

export function analyzeImpact(draft: Draft): ImpactReport {
  const changes: TokenImpact[] = [];
  const blocked: string[] = [];

  for (const [key, value] of Object.entries(draft)) {
    const token = tokenByKey(key);
    if (!token) {
      changes.push({
        key,
        from: '',
        to: value,
        scope: 'shared',
        target: '',
        surfaces: [],
        bindings: [],
        sisters: [],
        forbidden: [],
        constraints: [],
        risk: 'blocked',
        reasons: ['unmapped token — not in registered graph'],
        mergeable: false,
      });
      blocked.push(key);
      continue;
    }
    if (value === token.defaultValue) continue;
    const { risk, reasons } = riskFor(token, value);
    changes.push({
      key,
      from: token.defaultValue,
      to: value,
      scope: token.scope,
      target: token.target,
      surfaces: token.surfaces,
      bindings: token.bindings,
      sisters: token.sisters ?? [],
      forbidden: token.forbidden,
      constraints: token.constraints,
      risk,
      reasons,
      mergeable: risk !== 'blocked',
    });
    if (risk === 'blocked') blocked.push(key);
  }

  return {
    changes,
    mergeable: blocked.length === 0,
    blocked,
  };
}

export function exportCss(draft: Draft): string {
  const report = analyzeImpact(draft);
  const mergeable = report.changes.filter((change) => change.mergeable && change.from !== change.to);
  if (mergeable.length === 0) {
    return '/* No mergeable changes to dashboard-tokens.css. */\n';
  }

  const lines = mergeable
    .slice()
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((change) => `  ${change.key}: ${change.to};`);

  return [
    '/* RealSync UI Lab — merge into src/styles/dashboard-tokens.css',
    '   Review Command Center only. Do not apply to landing or SiteOS.',
    `   Blocked: ${report.blocked.length ? report.blocked.join(', ') : 'none'}. */`,
    '',
    '[data-testid="compliance-status-dashboard"] {',
    ...lines,
    '}',
    '',
  ].join('\n');
}

export function catalogKeys(): string[] {
  return DASHBOARD_TOKENS.map((token) => token.key);
}
