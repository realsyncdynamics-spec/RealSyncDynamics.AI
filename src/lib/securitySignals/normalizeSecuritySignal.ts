// Security Signal Normalizer
// ---------------------------------------------------------------------------
// Wandelt beliebige Provider-Payloads (blacklens.io, Cloudflare, GitHub, SIEM,
// generic) in ein einheitliches `NormalizedSecuritySignal`-Schema um. Reine
// Funktion ohne Seiteneffekte — wird sowohl im Frontend als auch (gespiegelt
// als Deno-Port unter supabase/functions/_shared/securitySignals.ts) im
// Edge-Layer verwendet. Bei Änderungen BEIDE Stellen anpassen.
//
// Designprinzip: maximal nachsichtig bei der Feld-Erkennung ("flexibles
// Mapping"), strikt beim Output. Unbekannte Felder bleiben in `rawPayload`
// erhalten; ein verdichtetes `normalizedPayload` enthält die erkannten Felder.

export type SecurityProvider = 'blacklens' | 'cloudflare' | 'github' | 'siem' | 'generic';

export type SignalSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

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

type Json = Record<string, unknown>;

const KNOWN_PROVIDERS: SecurityProvider[] = ['blacklens', 'cloudflare', 'github', 'siem', 'generic'];

/** Normalisiert einen Provider-Payload. `provider` ist optional und wird sonst
 *  aus dem Payload erraten. */
export function normalizeSecuritySignal(
  input: unknown,
  providerHint?: string,
): NormalizedSecuritySignal {
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

  // Verdichtetes normalizedPayload: nur die erkannten Kernfelder.
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

/* ── Provider-spezifische Mapper ─────────────────────────────────── */

function fromBlacklens(p: Json): NormalizedSecuritySignal {
  const externalId = str(pick(p, 'finding_id', 'id', 'external_id', 'uuid')) || hashlessId('bl', p);
  const severity = mapSeverity(pick(p, 'severity', 'risk', 'priority', 'risk_level'));
  const assetRef = str(pick(p, 'asset', 'domain', 'host', 'ip', 'url', 'target')) || '';
  const title = str(pick(p, 'title', 'name', 'finding', 'summary')) || 'blacklens finding';
  const description = str(pick(p, 'description', 'details', 'detail', 'message')) || '';
  const eventType = str(pick(p, 'event_type', 'type', 'category', 'class')) || 'attack_surface_finding';
  return {
    provider: 'blacklens',
    externalId,
    eventType,
    severity,
    title,
    description,
    assetRef,
    rawPayload: p,
    normalizedPayload: {},
    firstSeenAt: dateOrNull(pick(p, 'first_seen', 'created_at', 'first_seen_at', 'detected_at')),
    lastSeenAt: dateOrNull(pick(p, 'last_seen', 'updated_at', 'last_seen_at', 'seen_at')),
  };
}

function fromCloudflare(p: Json): NormalizedSecuritySignal {
  // Cloudflare Security Events / Firewall / WAF
  const externalId = str(pick(p, 'ray_id', 'rayId', 'id', 'event_id', 'ruleId')) || hashlessId('cf', p);
  const severity = mapSeverity(pick(p, 'severity', 'action', 'level'));
  const assetRef = str(pick(p, 'host', 'clientRequestHTTPHost', 'zone', 'zoneName', 'source', 'clientIP')) || '';
  const action = str(pick(p, 'action', 'rulesetAction'));
  const title = str(pick(p, 'title', 'description', 'ruleMessage', 'message'))
    || (action ? `Cloudflare ${action}` : 'Cloudflare security event');
  const description = str(pick(p, 'description', 'ruleMessage', 'message', 'details')) || '';
  const eventType = str(pick(p, 'event_type', 'kind', 'source', 'datasetId')) || 'cloudflare_security_event';
  return {
    provider: 'cloudflare',
    externalId,
    eventType,
    severity,
    title,
    description,
    assetRef,
    rawPayload: p,
    normalizedPayload: {},
    firstSeenAt: dateOrNull(pick(p, 'datetime', 'timestamp', 'occurred_at', 'first_seen')),
    lastSeenAt: dateOrNull(pick(p, 'datetime', 'timestamp', 'occurred_at', 'last_seen')),
  };
}

function fromGithub(p: Json): NormalizedSecuritySignal {
  // GitHub Code/Secret/Dependabot scanning alert webhook
  const alert = isObject(p.alert) ? (p.alert as Json) : p;
  const rule = isObject(alert.rule) ? (alert.rule as Json) : {};
  const repo = isObject(p.repository) ? (p.repository as Json) : {};
  const externalId = str(pick(alert, 'number', 'id', 'external_id'))
    || str(pick(p, 'id')) || hashlessId('gh', p);
  const severity = mapSeverity(
    pick(rule, 'security_severity_level', 'severity') ?? pick(alert, 'severity'),
  );
  const assetRef = str(pick(repo, 'full_name', 'html_url', 'name'))
    || str(pick(p, 'repository_full_name', 'repo')) || '';
  const title = str(pick(rule, 'description', 'name') ?? pick(alert, 'summary', 'title'))
    || 'GitHub security alert';
  const description = str(pick(rule, 'full_description', 'description') ?? pick(alert, 'description')) || '';
  const eventType = str(pick(p, 'event_type', 'action') ?? pick(alert, 'tool', 'kind'))
    || 'github_security_alert';
  return {
    provider: 'github',
    externalId: `${externalId}`,
    eventType,
    severity,
    title,
    description,
    assetRef,
    rawPayload: p,
    normalizedPayload: {},
    firstSeenAt: dateOrNull(pick(alert, 'created_at', 'first_seen') ?? pick(p, 'created_at')),
    lastSeenAt: dateOrNull(pick(alert, 'updated_at', 'last_seen') ?? pick(p, 'updated_at')),
  };
}

function fromGeneric(p: Json, provider: SecurityProvider): NormalizedSecuritySignal {
  const externalId = str(pick(p, 'external_id', 'id', 'finding_id', 'event_id', 'uuid'))
    || hashlessId(provider.slice(0, 2), p);
  const severity = mapSeverity(pick(p, 'severity', 'risk', 'priority', 'level', 'risk_level'));
  const assetRef = str(pick(p, 'asset', 'asset_ref', 'domain', 'host', 'ip', 'url', 'resource', 'target')) || '';
  const title = str(pick(p, 'title', 'name', 'summary', 'message')) || `${provider} signal`;
  const description = str(pick(p, 'description', 'details', 'detail', 'message')) || '';
  const eventType = str(pick(p, 'event_type', 'type', 'category', 'class', 'kind')) || `${provider}_signal`;
  return {
    provider,
    externalId,
    eventType,
    severity,
    title,
    description,
    assetRef,
    rawPayload: p,
    normalizedPayload: {},
    firstSeenAt: dateOrNull(pick(p, 'first_seen', 'first_seen_at', 'created_at', 'detected_at', 'timestamp')),
    lastSeenAt: dateOrNull(pick(p, 'last_seen', 'last_seen_at', 'updated_at', 'seen_at', 'timestamp')),
  };
}

/* ── Helfer ──────────────────────────────────────────────────────── */

export function resolveProvider(hint: string | undefined, payload: Json): SecurityProvider {
  const h = (hint ?? str(pick(payload, 'provider', 'source', 'vendor'))).toLowerCase();
  if (KNOWN_PROVIDERS.includes(h as SecurityProvider)) return h as SecurityProvider;
  if (h.includes('blacklens') || h.includes('black-lens')) return 'blacklens';
  if (h.includes('cloudflare') || h.includes('cf')) return 'cloudflare';
  if (h.includes('github') || h.includes('gh')) return 'github';
  if (h.includes('siem') || h.includes('splunk') || h.includes('sentinel') || h.includes('elastic')) return 'siem';
  // Heuristik anhand charakteristischer Felder.
  if ('ray_id' in payload || 'rayId' in payload || 'clientRequestHTTPHost' in payload) return 'cloudflare';
  if (isObject(payload.alert) || isObject(payload.repository)) return 'github';
  if ('finding_id' in payload) return 'blacklens';
  return 'generic';
}

/** Mappt heterogene Severity-/Risk-/Action-Werte auf das kanonische Schema. */
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
  // Fallback: unbekannte, aber nicht-leere Severity vorsichtig als medium werten.
  return 'medium';
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
    // Unix-Sekunden vs. Millisekunden heuristisch unterscheiden.
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

/** Deterministische, schlanke ID, falls der Provider keine liefert. Kein
 *  Crypto nötig — nur Stabilität über identische Payloads. */
function hashlessId(prefix: string, p: Json): string {
  const json = stableStringify(p);
  let h = 0;
  for (let i = 0; i < json.length; i++) {
    h = (h * 31 + json.charCodeAt(i)) | 0;
  }
  return `${prefix}-${(h >>> 0).toString(36)}`;
}

function stableStringify(obj: unknown): string {
  if (!isObject(obj)) return JSON.stringify(obj);
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}
