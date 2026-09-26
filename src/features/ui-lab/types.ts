export type TokenScope = 'light' | 'dark' | 'shared';
export type BindingKind = 'var' | 'utility' | 'selector' | 'override';
export type ImpactStatus = 'ok' | 'legacy' | 'override' | 'unmapped' | 'blocked';
export type ImpactRisk = 'low' | 'medium' | 'high';

export type TokenValues = Record<string, string>;

export type Draft = Record<TokenScope, TokenValues>;

export function emptyDraft(): Draft {
  return { light: {}, dark: {}, shared: {} };
}

export type TokenDef = {
  key: string;
  scope: TokenScope;
  targetBlock: '@theme' | ':root' | '.dark' | '.dashboard-context';
  group: 'density' | 'type' | 'radius' | 'color';
  baseline: string;
};

export type Binding = {
  token: string;
  file: string;
  symbol: string;
  kind: BindingKind;
  notes?: string;
};

export type Surface = {
  id: string;
  route: string;
  fixture: string;
  tokens: string[];
};

export type Constraint = {
  token: string;
  id: string;
  /** Return a blocked reason or null if the value is allowed. */
  check: (value: string) => string | null;
};

export type ImpactCard = {
  token: string;
  from: string;
  to: string;
  scope: TokenScope;
  targetBlock: TokenDef['targetBlock'];
  surfaces: string[];
  bindings: Binding[];
  sisters: string[];
  forbiddenHits: string[];
  status: ImpactStatus;
  risk: ImpactRisk;
  reasons: string[];
};
