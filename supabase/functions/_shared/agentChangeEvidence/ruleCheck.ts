// Agent Change Evidence — path/content rule check (no LLM).
//
// Deno-frei: vitest importiert denselben Code wie die Edge Function.
// Ausgabe nur Trefferklassen + Risikostufe — niemals Secret-Werte.

export type HitClass =
  | 'env'
  | 'secrets'
  | 'credentials'
  | 'tracking'
  | 'third_party_scripts'
  | 'model_providers'
  | 'policy_files';

export type RiskLevel = 'info' | 'low' | 'medium' | 'high';

export interface RuleCheckInput {
  /** Changed file paths (repo-relative). */
  paths: string[];
  /**
   * Optional changed-line content held only in memory for pattern matching.
   * Never persisted by callers.
   */
  contents?: string[];
}

export interface RuleCheckResult {
  classes: HitClass[];
  risk_level: RiskLevel;
}

const RISK_RANK: Record<RiskLevel, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
};

const CLASS_RISK: Record<HitClass, RiskLevel> = {
  env: 'high',
  secrets: 'high',
  credentials: 'high',
  tracking: 'low',
  third_party_scripts: 'low',
  model_providers: 'medium',
  policy_files: 'medium',
};

/** Basename / path patterns for sensitive files. */
const PATH_RULES: Array<{ cls: HitClass; re: RegExp }> = [
  { cls: 'env', re: /(^|\/)\.env(\.|$)/i },
  { cls: 'env', re: /\.env\.[^/]+$/i },
  { cls: 'secrets', re: /(^|\/)secrets?(\.|\/|$)/i },
  { cls: 'secrets', re: /\.(secret|secrets)$/i },
  { cls: 'credentials', re: /(credential|credentials|apikey|api[_-]?key)/i },
  { cls: 'credentials', re: /\.(pem|p12|pfx|key)$/i },
  { cls: 'credentials', re: /(^|\/)id_rsa([^/]*)$/i },
  { cls: 'credentials', re: /(^|\/)\.aws\/credentials$/i },
  { cls: 'tracking', re: /(gtag|googletagmanager|fbevents|hotjar)/i },
  { cls: 'policy_files', re: /(^|\/)supabase\/migrations\//i },
  { cls: 'policy_files', re: /(^|\/)migrations?\/.+\.sql$/i },
  { cls: 'policy_files', re: /(^|\/).*(rls|policy|policies).*\.(sql|ts|js)$/i },
  { cls: 'policy_files', re: /(permission|permissions).*\.(sql|ts|js|json)$/i },
];

/** Content patterns — only applied to in-memory line content, never stored. */
const CONTENT_RULES: Array<{ cls: HitClass; re: RegExp }> = [
  { cls: 'env', re: /\.env(\.|$|\s|"|')/i },
  { cls: 'secrets', re: /(aws_secret_access_key|private[_-]?key|client_secret)\s*[=:]/i },
  { cls: 'credentials', re: /(BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|AKIA[0-9A-Z]{16})/ },
  // Host patterns are protocol-anchored so a suffix/prefix host cannot spoof them (CodeQL js/regex/missing-regexp-anchor).
  {
    cls: 'tracking',
    re: /https?:\/\/(?:www\.)?googletagmanager\.com\/gtag(?:[/?#"'\s]|$)|https?:\/\/connect\.facebook\.net\/[^"'\s>]*fbevents|https?:\/\/static\.hotjar\.com(?:[/?#"'\s]|$)/i,
  },
  { cls: 'third_party_scripts', re: /https?:\/\/[^"'\s>]+\.js(?:\?[^"'\s>]*)?/i },
  {
    cls: 'model_providers',
    re: /https?:\/\/(?:api\.openai\.com|api\.anthropic\.com|api\.mistral\.ai|generativelanguage\.googleapis\.com|api\.cohere\.ai|api\.groq\.com|[^/"'\s>]+\.openai\.azure\.com)(?:[/?#"'\s]|$)/i,
  },
  { cls: 'policy_files', re: /\b(ENABLE ROW LEVEL SECURITY|CREATE POLICY|ALTER POLICY)\b/i },
];

function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_RANK[a] >= RISK_RANK[b] ? a : b;
}

/**
 * Pure rule check. Matches paths (and optional in-memory content) against
 * known sensitive classes. Returns only classes + aggregated risk_level.
 */
export function ruleCheck(input: RuleCheckInput): RuleCheckResult {
  const hits = new Set<HitClass>();

  for (const raw of input.paths) {
    const path = String(raw ?? '').trim();
    if (!path) continue;
    for (const rule of PATH_RULES) {
      if (rule.re.test(path)) hits.add(rule.cls);
    }
  }

  for (const raw of input.contents ?? []) {
    const line = String(raw ?? '');
    if (!line) continue;
    for (const rule of CONTENT_RULES) {
      if (rule.re.test(line)) hits.add(rule.cls);
    }
  }

  const classes = [...hits].sort() as HitClass[];
  let risk_level: RiskLevel = 'info';
  for (const cls of classes) {
    risk_level = maxRisk(risk_level, CLASS_RISK[cls]);
  }

  return { classes, risk_level };
}
