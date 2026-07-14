// Security Signals — Deno-Port von Normalizer + Risk-Mapping-Engine.
// ---------------------------------------------------------------------------
// Dieser Helfer spiegelt die kanonische Logik aus:
//   - src/lib/securitySignals/normalizeSecuritySignal.ts
//   - src/lib/securitySignals/mapSignalToGovernance.ts
// Reine Funktionen ohne Seiteneffekte. Bei Änderungen BEIDE Stellen anpassen.
// (Edge Functions laufen unter Deno, das Frontend unter Vite/TS — daher die
//  bewusste Spiegelung, analog zu policyEngine.ts.)

export type SecurityProvider = 'blacklens' | 'cloudflare' | 'github' | 'siem' | 'generic';
export type SignalSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type RiskLevel = SignalSeverity;
export type TaskPriority = 'high' | 'medium' | 'low';

export interface NormalizedSecuritySignal {
  provider: SecurityProvider;
  externalId: string;
  eventType: string;
  severity: SignalSeverity;
  title: string;
  description: string;
  assetRef: string;
  rawPayload: Record<string, unknown>;
  normalizedPayload: Record<string, unknown>;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
}

export interface ControlMapping { framework: string; controlRef: string; reason: string }
export interface RecommendedTask { type: string; title: string; priority: TaskPriority; status: 'open' }
export interface EvidenceItem { type: string; title: string; description: string }
export interface GovernanceMapping {
  riskLevel: RiskLevel;
  frameworks: string[];
  controls: ControlMapping[];
  recommendedTasks: RecommendedTask[];
  evidenceItems: EvidenceItem[];
}

type Json = Record<string, unknown>;

const KNOWN_PROVIDERS: SecurityProvider[] = ['blacklens', 'cloudflare', 'github', 'siem', 'generic'];

/* ═══ Normalizer ═════════════════════════════════════════════════ */

export function normalizeSecuritySignal(input: unknown, providerHint?: string): NormalizedSecuritySignal {
  const raw: Json = isObject(input) ? input : { value: input };
  const provider = resolveProvider(providerHint, raw);

  const base: NormalizedSecuritySignal = (() => {
    switch (provider) {
      case 'blacklens':  return fromBlacklens(raw);
      case 'cloudflare': return fromCloudflare(raw);
      case 'github':     return fromGithub(raw);
      case 'siem':       return fromGeneric(raw, 'siem');
      default:           return fromGeneric(raw, 'generic');
    }
  })();

  base.normalizedPayload = {
    provider: base.provider,
    external_id: base.externalId,
    event_type: base.eventType,
    severity: base.severity,
    asset_ref: base.assetRef,
    first_seen_at: base.firstSeenAt,
    last_seen_at: base.lastSeenAt,
  };
  base.rawPayload = raw;
  return base;
}

function fromBlacklens(p: Json): NormalizedSecuritySignal {
  return {
    provider: 'blacklens',
    externalId: str(pick(p, 'finding_id', 'id', 'external_id', 'uuid')) || hashlessId('bl', p),
    eventType: str(pick(p, 'event_type', 'type', 'category', 'class')) || 'attack_surface_finding',
    severity: mapSeverity(pick(p, 'severity', 'risk', 'priority', 'risk_level')),
    title: str(pick(p, 'title', 'name', 'finding', 'summary')) || 'blacklens finding',
    description: str(pick(p, 'description', 'details', 'detail', 'message')) || '',
    assetRef: str(pick(p, 'asset', 'domain', 'host', 'ip', 'url', 'target')) || '',
    rawPayload: p,
    normalizedPayload: {},
    firstSeenAt: dateOrNull(pick(p, 'first_seen', 'created_at', 'first_seen_at', 'detected_at')),
    lastSeenAt: dateOrNull(pick(p, 'last_seen', 'updated_at', 'last_seen_at', 'seen_at')),
  };
}

function fromCloudflare(p: Json): NormalizedSecuritySignal {
  const action = str(pick(p, 'action', 'rulesetAction'));
  return {
    provider: 'cloudflare',
    externalId: str(pick(p, 'ray_id', 'rayId', 'id', 'event_id', 'ruleId')) || hashlessId('cf', p),
    eventType: str(pick(p, 'event_type', 'kind', 'source', 'datasetId')) || 'cloudflare_security_event',
    severity: mapSeverity(pick(p, 'severity', 'action', 'level')),
    title: str(pick(p, 'title', 'description', 'ruleMessage', 'message'))
      || (action ? `Cloudflare ${action}` : 'Cloudflare security event'),
    description: str(pick(p, 'description', 'ruleMessage', 'message', 'details')) || '',
    assetRef: str(pick(p, 'host', 'clientRequestHTTPHost', 'zone', 'zoneName', 'source', 'clientIP')) || '',
    rawPayload: p,
    normalizedPayload: {},
    firstSeenAt: dateOrNull(pick(p, 'datetime', 'timestamp', 'occurred_at', 'first_seen')),
    lastSeenAt: dateOrNull(pick(p, 'datetime', 'timestamp', 'occurred_at', 'last_seen')),
  };
}

function fromGithub(p: Json): NormalizedSecuritySignal {
  const alert = isObject(p.alert) ? (p.alert as Json) : p;
  const rule = isObject(alert.rule) ? (alert.rule as Json) : {};
  const repo = isObject(p.repository) ? (p.repository as Json) : {};
  const externalId = str(pick(alert, 'number', 'id', 'external_id')) || str(pick(p, 'id')) || hashlessId('gh', p);
  return {
    provider: 'github',
    externalId: `${externalId}`,
    eventType: str(pick(p, 'event_type', 'action') ?? pick(alert, 'tool', 'kind')) || 'github_security_alert',
    severity: mapSeverity(pick(rule, 'security_severity_level', 'severity') ?? pick(alert, 'severity')),
    title: str(pick(rule, 'description', 'name') ?? pick(alert, 'summary', 'title')) || 'GitHub security alert',
    description: str(pick(rule, 'full_description', 'description') ?? pick(alert, 'description')) || '',
    assetRef: str(pick(repo, 'full_name', 'html_url', 'name')) || str(pick(p, 'repository_full_name', 'repo')) || '',
    rawPayload: p,
    normalizedPayload: {},
    firstSeenAt: dateOrNull(pick(alert, 'created_at', 'first_seen') ?? pick(p, 'created_at')),
    lastSeenAt: dateOrNull(pick(alert, 'updated_at', 'last_seen') ?? pick(p, 'updated_at')),
  };
}

function fromGeneric(p: Json, provider: SecurityProvider): NormalizedSecuritySignal {
  return {
    provider,
    externalId: str(pick(p, 'external_id', 'id', 'finding_id', 'event_id', 'uuid')) || hashlessId(provider.slice(0, 2), p),
    eventType: str(pick(p, 'event_type', 'type', 'category', 'class', 'kind')) || `${provider}_signal`,
    severity: mapSeverity(pick(p, 'severity', 'risk', 'priority', 'level', 'risk_level')),
    title: str(pick(p, 'title', 'name', 'summary', 'message')) || `${provider} signal`,
    description: str(pick(p, 'description', 'details', 'detail', 'message')) || '',
    assetRef: str(pick(p, 'asset', 'asset_ref', 'domain', 'host', 'ip', 'url', 'resource', 'target')) || '',
    rawPayload: p,
    normalizedPayload: {},
    firstSeenAt: dateOrNull(pick(p, 'first_seen', 'first_seen_at', 'created_at', 'detected_at', 'timestamp')),
    lastSeenAt: dateOrNull(pick(p, 'last_seen', 'last_seen_at', 'updated_at', 'seen_at', 'timestamp')),
  };
}

export function resolveProvider(hint: string | undefined, payload: Json): SecurityProvider {
  const h = (hint ?? str(pick(payload, 'provider', 'source', 'vendor'))).toLowerCase();
  if (KNOWN_PROVIDERS.includes(h as SecurityProvider)) return h as SecurityProvider;
  if (h.includes('blacklens') || h.includes('black-lens')) return 'blacklens';
  if (h.includes('cloudflare') || h.includes('cf')) return 'cloudflare';
  if (h.includes('github') || h.includes('gh')) return 'github';
  if (h.includes('siem') || h.includes('splunk') || h.includes('sentinel') || h.includes('elastic')) return 'siem';
  if ('ray_id' in payload || 'rayId' in payload || 'clientRequestHTTPHost' in payload) return 'cloudflare';
  if (isObject(payload.alert) || isObject(payload.repository)) return 'github';
  if ('finding_id' in payload) return 'blacklens';
  return 'generic';
}

export function mapSeverity(value: unknown): SignalSeverity {
  if (typeof value === 'number') {
    // Zwei gängige Skalen: 0..1 (Anteil) und 0..10 (CVSS). Werte ≤ 1 als
    // Anteil interpretieren, sonst als CVSS-artigen Score.
    if (value <= 1) {
      if (value >= 0.9) return 'critical';
      if (value >= 0.7) return 'high';
      if (value >= 0.4) return 'medium';
      if (value > 0) return 'low';
      return 'info';
    }
    if (value >= 9) return 'critical';
    if (value >= 7) return 'high';
    if (value >= 4) return 'medium';
    return 'low';
  }
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return 'info';
  if (['critical', 'crit', 'sev1', 'p1', 'block', 'emergency', 'fatal'].includes(s)) return 'critical';
  if (['high', 'sev2', 'p2', 'error', 'important', 'warn_high'].includes(s)) return 'high';
  if (['medium', 'moderate', 'sev3', 'p3', 'warning', 'warn'].includes(s)) return 'medium';
  if (['low', 'minor', 'sev4', 'p4', 'notice', 'info_low'].includes(s)) return 'low';
  if (['info', 'informational', 'none', 'log', 'allow', 'debug'].includes(s)) return 'info';
  return 'medium';
}

/* ═══ Risk-Mapping-Engine ════════════════════════════════════════ */

const SEVERITY_TO_RISK: Record<SignalSeverity, RiskLevel> = {
  critical: 'critical', high: 'high', medium: 'medium', low: 'low', info: 'info',
};

const PII_HINTS = [
  'pii', 'personal_data', 'personenbezogen', 'personal data', 'customer_data',
  'customer data', 'kundendaten', 'gdpr', 'dsgvo', 'email', 'e-mail',
  'phone', 'ssn', 'passport', 'address', 'name', 'birthdate', 'dob',
  'credit_card', 'creditcard', 'iban', 'health', 'gesundheit', 'biometric',
];
const WEB_HINTS = ['http', 'https', 'www', 'domain', 'web', 'api', 'host', 'url', 'admin', 'login', 'port', 'tls', 'ssl'];

export function mapSignalToGovernance(signal: NormalizedSecuritySignal): GovernanceMapping {
  const riskLevel = SEVERITY_TO_RISK[signal.severity] ?? 'info';
  const frameworks = new Set<string>();
  const controls: ControlMapping[] = [];
  const tasks: RecommendedTask[] = [];
  const evidence: EvidenceItem[] = [];

  const isHighRisk = signal.severity === 'critical' || signal.severity === 'high';
  const haystack = buildHaystack(signal);
  const isWeb = WEB_HINTS.some((h) => haystack.includes(h)) || looksLikeUrlOrHost(signal.assetRef);
  const hasPii = PII_HINTS.some((h) => haystack.includes(h));

  if (isHighRisk) {
    addControl(controls, frameworks, 'GDPR', 'Art. 32',
      'Hohe/kritische Severity erfordert angemessene technische Sicherheitsmaßnahmen (Art. 32 DSGVO).');
    addControl(controls, frameworks, 'NIS2', 'Security Measures',
      'Hohe/kritische Severity fällt unter NIS2-Risikomanagement-/Sicherheitsmaßnahmen.');
    addControl(controls, frameworks, 'ISO_27001', 'A.8',
      'Technologische Maßnahme (ISO 27001:2022 Annex A.8) betroffen.');
    tasks.push({ type: 'risk_review', title: `Risk Review: ${signal.title}`, priority: 'high', status: 'open' });
    evidence.push({
      type: 'json', title: 'Security Signal Snapshot',
      description: `Snapshot des ${signal.provider}-Findings "${signal.title}" (Severity ${signal.severity}).`,
    });
  }

  if (isWeb) {
    addControl(controls, frameworks, 'ISO_27001', 'A.8.16',
      'Web-/API-Asset betroffen — Monitoring der Angriffsfläche (ISO 27001 A.8.16).');
    addControl(controls, frameworks, 'NIS2', 'Attack Surface Management',
      'Öffentlich erreichbares Web-/API-Asset — Attack-Surface-Control.');
    if (!tasks.some((t) => t.type === 'attack_surface_review')) {
      tasks.push({
        type: 'attack_surface_review',
        title: `Attack-Surface prüfen: ${signal.assetRef || signal.title}`,
        priority: isHighRisk ? 'high' : 'medium', status: 'open',
      });
    }
  }

  if (hasPii) {
    addControl(controls, frameworks, 'GDPR', 'Art. 33/34',
      'Hinweis auf personenbezogene Daten — DSGVO-Incident-/Breach-Review (Art. 33/34) erforderlich.');
    tasks.push({ type: 'dpo_review', title: 'DPO Review Required: möglicher Personenbezug', priority: 'high', status: 'open' });
    evidence.push({
      type: 'json', title: 'PII Assessment',
      description: 'Payload enthält Hinweise auf personenbezogene Daten — DSGVO-Bewertung dokumentieren.',
    });
  }

  if (controls.length === 0) {
    addControl(controls, frameworks, 'ISO_27001', 'A.5.7',
      'Informationssignal ohne erhöhtes Risiko — Threat-Intelligence-Erfassung (ISO 27001 A.5.7).');
    tasks.push({ type: 'triage', title: `Triage: ${signal.title}`, priority: 'low', status: 'open' });
  }

  return {
    riskLevel,
    frameworks: Array.from(frameworks),
    controls,
    recommendedTasks: tasks,
    evidenceItems: evidence,
  };
}

/* ═══ Helfer ═════════════════════════════════════════════════════ */

function addControl(controls: ControlMapping[], frameworks: Set<string>, framework: string, controlRef: string, reason: string): void {
  frameworks.add(framework);
  if (!controls.some((c) => c.framework === framework && c.controlRef === controlRef)) {
    controls.push({ framework, controlRef, reason });
  }
}

function buildHaystack(signal: NormalizedSecuritySignal): string {
  let raw = '';
  try { raw = JSON.stringify(signal.rawPayload ?? {}); } catch { raw = ''; }
  return [signal.title, signal.description, signal.assetRef, signal.eventType, raw].join(' ').toLowerCase();
}

function looksLikeUrlOrHost(assetRef: string): boolean {
  if (!assetRef) return false;
  const a = assetRef.toLowerCase();
  return a.startsWith('http://') || a.startsWith('https://') || /\.[a-z]{2,}(\/|:|$)/.test(a);
}

function pick(obj: Json, ...keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

function str(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

function dateOrNull(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') {
    const ms = v < 1e12 ? v * 1000 : v;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function isObject(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function hashlessId(prefix: string, p: Json): string {
  const json = stableStringify(p);
  let h = 0;
  for (let i = 0; i < json.length; i++) h = (h * 31 + json.charCodeAt(i)) | 0;
  return `${prefix}-${(h >>> 0).toString(36)}`;
}

function stableStringify(obj: unknown): string {
  if (!isObject(obj)) return JSON.stringify(obj);
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}
