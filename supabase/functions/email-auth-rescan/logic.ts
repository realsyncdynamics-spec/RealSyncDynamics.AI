// Pure, side-effect-free logic for email-auth-rescan — vitest-importable.
// No Deno / jsr imports. DNS, clock, DB and entitlements are injected by
// handler.ts / index.ts.
//
// What lives here:
//   - constant-time bearer compare (cron auth)
//   - domain normalisation (scheme/path/port strip, lowercase, apex)
//   - SPF / DMARC / DKIM evaluation of raw TXT answers
//   - dedupe keys, legacy-event pairing, resolve payload builder
//   - evidence snapshot/metadata (hash convention: _shared/evidence-hash.ts)

import { EVIDENCE_HASH_METHOD, evidenceContentHash } from '../_shared/evidence-hash.ts';

export const SCANNER_VERSION = 'email-auth-rescan/1.0.0';
export const DETECTOR = 'email-auth-rescan';
export const EVIDENCE_TITLE = 'DNS TXT Snapshot (SPF/DMARC/DKIM)';
export const EVENT_FINDING = 'email_auth_finding';
export const EVENT_RESOLVED = 'email_auth_resolved';
export const EVENT_SOURCE = 'website_scanner';
/** Hard cap of domains per run (cron runs daily; keeps the run < 60s). */
export const MAX_DOMAINS_PER_RUN = 50;
export const DNS_TIMEOUT_MS = 4_000;

/**
 * DKIM selectors probed at `<selector>._domainkey.<domain>`. DKIM selectors
 * are not discoverable via DNS, so this list is a best effort: common
 * defaults of Google Workspace, Microsoft 365, Hostinger, Mailchimp/Mandrill,
 * generic MTAs. A miss is `not_found` (informational), never a hard finding.
 *
 * Hostinger publishes hostingermail-a/-b/-c as CNAMEs to
 * *.dkim.mail.hostinger.com; -a carries the active RSA key, -b/-c an empty
 * `p=` (revoked / standby). CNAMEs are followed; an empty `p=` counts as a
 * revoked key, not as present.
 */
export const DKIM_SELECTORS: readonly string[] = [
  'default', 'google', 'selector1', 'selector2', 'k1', 'k2', 's1', 's2',
  'mail', 'dkim', 'hostingermail1', 'hostingermail2',
  'hostingermail-a', 'hostingermail-b', 'hostingermail-c',
];

/** Recorded in metadata.snapshot.resolvers. */
export const RESOLVER_LABEL = 'supabase-edge-runtime:Deno.resolveDns';

export type CheckName = 'spf' | 'dmarc' | 'dkim';
export const CHECKS: readonly CheckName[] = ['spf', 'dmarc', 'dkim'];

// ─── Auth ────────────────────────────────────────────────────────────────────

/**
 * Constant-time string compare (length leak only). Used for the cron bearer:
 * `authHeader` vs `Bearer ${CRON_KEY}`. Never compares against service_role.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

export type CronAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 500; code: string; message: string };

/**
 * Fail-closed cron auth. Missing secret → 500 (misconfiguration, refuse to
 * run); missing/wrong bearer → 401 ("cron only").
 */
export function checkCronAuth(cronKey: string | undefined | null, authHeader: string | null): CronAuthResult {
  const CRON_KEY = (cronKey ?? '').trim();
  if (!CRON_KEY) {
    return { ok: false, status: 500, code: 'CRON_KEY_MISSING', message: 'CRON_WEBSITE_RESCAN_KEY not configured' };
  }
  const header = authHeader ?? '';
  if (!header.startsWith('Bearer ') || !timingSafeEqual(header, `Bearer ${CRON_KEY}`)) {
    return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'cron only' };
  }
  return { ok: true };
}

// ─── Domains ─────────────────────────────────────────────────────────────────

/** Two-label public suffixes where the registrable domain has 3 labels. */
const MULTI_LABEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'ltd.uk', 'plc.uk',
  'com.au', 'net.au', 'org.au', 'co.at', 'or.at', 'gv.at', 'ac.at',
  'co.nz', 'org.nz', 'co.jp', 'ne.jp', 'or.jp', 'co.za', 'com.br', 'com.tr',
  'com.mx', 'com.cn', 'com.hk', 'com.sg', 'co.in', 'co.il', 'com.pl', 'com.es',
]);

const HOST_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Normalise a URL or bare host to a lowercase hostname: strips scheme,
 * credentials, path, query, port and a trailing dot. Returns null for
 * IPs, localhost, single-label names and garbage.
 */
export function normalizeHost(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = String(input).trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  s = s.replace(/^[^@/]*@/, '');
  s = s.split(/[/?#]/)[0];
  s = s.replace(/:\d+$/, '');
  s = s.replace(/\.$/, '');
  if (!s || IPV4_RE.test(s) || s.includes(':')) return null;
  if (!HOST_RE.test(s)) return null;
  if (s === 'localhost' || s.endsWith('.localhost') || s.endsWith('.local')) return null;
  return s;
}

/**
 * Registrable ("apex") domain — SPF/DMARC are checked there, because
 * `www.example.de` never sends mail and DMARC falls back to the
 * organisational domain anyway. Heuristic: last two labels, or last three
 * for a small list of two-label public suffixes (no full PSL in the edge
 * runtime; unknown multi-label suffixes degrade to the suffix itself and are
 * skipped by the `isCheckableApex` guard below).
 */
export function apexDomain(host: string): string {
  const labels = host.split('.');
  if (labels.length <= 2) return host;
  const lastTwo = labels.slice(-2).join('.');
  if (MULTI_LABEL_SUFFIXES.has(lastTwo)) return labels.slice(-3).join('.');
  return lastTwo;
}

export function isCheckableApex(apex: string): boolean {
  return !MULTI_LABEL_SUFFIXES.has(apex) && apex.includes('.');
}

export function toApex(input: string | null | undefined): string | null {
  const host = normalizeHost(input);
  if (!host) return null;
  const apex = apexDomain(host);
  return isCheckableApex(apex) ? apex : null;
}

// ─── DNS answer shape ────────────────────────────────────────────────────────

/**
 * Result of one TXT lookup, as produced by the injected resolver:
 *   ok     — answer with records (each record = its joined character-strings)
 *   nodata — authoritative "no such record" (NXDOMAIN / NODATA)
 *   error  — SERVFAIL, timeout, refused, anything else: UNKNOWN state.
 *            An `error` never resolves anything and never creates a finding.
 */
export type TxtLookup =
  | { status: 'ok'; records: string[] }
  | { status: 'nodata' }
  | { status: 'error'; message: string };

export type CnameLookup =
  | { status: 'ok'; targets: string[] }
  | { status: 'nodata' }
  | { status: 'error'; message: string };

export interface DnsResolver {
  txt(name: string): Promise<TxtLookup>;
  cname(name: string): Promise<CnameLookup>;
}

/**
 * Classify a thrown resolver error. Deno raises `Deno.errors.NotFound`
 * (name 'NotFound') for NXDOMAIN / no records; everything else is unknown.
 */
export function classifyDnsError(e: unknown): TxtLookup {
  const name = (e as { name?: string } | null)?.name ?? '';
  const message = (e as { message?: string } | null)?.message ?? String(e);
  if (name === 'NotFound') return { status: 'nodata' };
  return { status: 'error', message: `${name || 'Error'}: ${message}`.slice(0, 300) };
}

/** Deno returns TXT as string[][] (character-strings); join per record. */
export function joinTxt(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => (Array.isArray(r) ? r.join('') : String(r)));
}

// ─── Check evaluation ────────────────────────────────────────────────────────

export type CheckStatus = 'pass' | 'fail' | 'not_found' | 'error';

export interface SpfState {
  status: CheckStatus;
  present: boolean;
  record: string | null;
  all_qualifier: string | null;
  issues: string[];
  error?: string;
}

export interface DmarcState {
  status: CheckStatus;
  present: boolean;
  record: string | null;
  policy: string | null;
  subdomain_policy: string | null;
  pct: number | null;
  adkim: string | null;
  aspf: string | null;
  rua: string | null;
  issues: string[];
  error?: string;
}

export interface DkimState {
  /** pass = at least one selector with a non-empty key; not_found = none of
   *  the probed selectors answered (informational only); error = lookup
   *  errors and no selector found. */
  status: CheckStatus;
  selectors_found: string[];
  /** Selector exists (TXT with v=DKIM1) but `p=` is empty: revoked key. */
  selectors_empty_key: string[];
  selectors_probed: string[];
  errors: string[];
}

/** Raw per-selector observation, stored verbatim in the evidence snapshot. */
export type DkimRecord = { cname: string | null; txt: string[] } | null;

export interface DkimLookup {
  selector: string;
  /** Combined status: error if TXT (after CNAME follow) errored. */
  lookup: TxtLookup;
  cname: string | null;
}

export interface RawRecords {
  apex_txt: string[];
  dmarc_txt: string[];
  dkim: Record<string, DkimRecord>;
}

export interface DomainCheckResult {
  domain: string;
  checked_at: string;
  spf: SpfState;
  dmarc: DmarcState;
  dkim: DkimState;
  records: RawRecords;
}

export function evaluateSpf(l: TxtLookup): SpfState {
  const base: SpfState = { status: 'fail', present: false, record: null, all_qualifier: null, issues: [] };
  if (l.status === 'error') return { ...base, status: 'error', error: l.message, issues: [] };
  const spf = l.status === 'ok' ? l.records.filter((r) => /^v=spf1(\s|$)/i.test(r.trim())) : [];
  if (spf.length === 0) return { ...base, issues: ['missing'] };
  if (spf.length > 1) {
    return { ...base, present: true, record: spf.join(' | '), issues: ['multiple_records'] };
  }
  const record = spf[0].trim();
  const allMatch = /(?:^|\s)([+\-~?]?)all(?:\s|$)/i.exec(record);
  const qualifier = allMatch ? (allMatch[1] || '+') : null;
  const issues: string[] = [];
  if (qualifier === '+') issues.push('plus_all');
  return {
    status: issues.length ? 'fail' : 'pass',
    present: true,
    record,
    all_qualifier: qualifier,
    issues,
  };
}

function dmarcTags(record: string): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const part of record.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    tags[part.slice(0, idx).trim().toLowerCase()] = part.slice(idx + 1).trim();
  }
  return tags;
}

export function evaluateDmarc(l: TxtLookup): DmarcState {
  const base: DmarcState = {
    status: 'fail', present: false, record: null, policy: null, subdomain_policy: null,
    pct: null, adkim: null, aspf: null, rua: null, issues: [],
  };
  if (l.status === 'error') return { ...base, status: 'error', error: l.message };
  const recs = l.status === 'ok' ? l.records.filter((r) => /^v=DMARC1(\s*;|\s*$)/i.test(r.trim())) : [];
  if (recs.length === 0) return { ...base, issues: ['missing'] };
  if (recs.length > 1) return { ...base, present: true, record: recs.join(' | '), issues: ['multiple_records'] };
  const record = recs[0].trim();
  const t = dmarcTags(record);
  const policy = t.p ? t.p.toLowerCase() : null;
  const pctRaw = t.pct !== undefined ? Number(t.pct) : null;
  const state: DmarcState = {
    ...base,
    present: true,
    record,
    policy,
    subdomain_policy: t.sp ? t.sp.toLowerCase() : null,
    pct: pctRaw !== null && Number.isFinite(pctRaw) ? pctRaw : null,
    adkim: t.adkim ? t.adkim.toLowerCase() : null,
    aspf: t.aspf ? t.aspf.toLowerCase() : null,
    rua: t.rua ?? null,
  };
  const issues: string[] = [];
  if (!policy || !['none', 'quarantine', 'reject'].includes(policy)) issues.push('invalid_policy');
  else if (policy === 'none') issues.push('policy_none');
  return { ...state, status: issues.length ? 'fail' : 'pass', issues };
}

/** DKIM key TXT records at a selector (v=DKIM1 or a bare p= tag). */
export function dkimTxt(records: string[]): string[] {
  return records.filter((r) => /^\s*v=DKIM1/i.test(r) || /(^|;)\s*p=/.test(r));
}

/** True when the record carries a non-empty public key (`p=` not empty). */
export function dkimHasKey(record: string): boolean {
  const m = /(?:^|;)\s*p=([^;]*)/i.exec(record);
  return !!m && m[1].replace(/\s+/g, '').length > 0;
}

export function evaluateDkim(lookups: DkimLookup[]): DkimState {
  const found: string[] = [];
  const empty: string[] = [];
  const errors: string[] = [];
  for (const { selector, lookup } of lookups) {
    if (lookup.status === 'error') { errors.push(`${selector}: ${lookup.message}`); continue; }
    if (lookup.status !== 'ok') continue;
    const recs = dkimTxt(lookup.records);
    if (recs.some(dkimHasKey)) found.push(selector);
    else if (recs.length > 0) empty.push(selector);
  }
  const status: CheckStatus = found.length > 0 ? 'pass' : errors.length > 0 ? 'error' : 'not_found';
  return { status, selectors_found: found, selectors_empty_key: empty, selectors_probed: lookups.map((l) => l.selector), errors };
}

async function safeTxt(dns: DnsResolver, name: string): Promise<TxtLookup> {
  try { return await dns.txt(name); } catch (e) { return classifyDnsError(e); }
}

async function safeCname(dns: DnsResolver, name: string): Promise<CnameLookup> {
  try { return await dns.cname(name); } catch (e) { return classifyDnsError(e) as CnameLookup; }
}

/**
 * Look up one DKIM selector. The CNAME is resolved explicitly; if the TXT
 * query at the selector name does not already return the target's TXT (some
 * resolvers only return the CNAME), the TXT of the CNAME target is queried.
 * A CNAME lookup error alone does not make the selector `error` — only the
 * TXT result counts.
 */
export async function lookupDkimSelector(dns: DnsResolver, domain: string, selector: string): Promise<DkimLookup> {
  const name = `${selector}._domainkey.${domain}`;
  const [txt, cn] = await Promise.all([safeTxt(dns, name), safeCname(dns, name)]);
  const cname = cn.status === 'ok' && cn.targets.length > 0 ? cn.targets[0] : null;
  let lookup = txt;
  const hasDkim = txt.status === 'ok' && dkimTxt(txt.records).length > 0;
  if (!hasDkim && cname && txt.status !== 'error') {
    lookup = await safeTxt(dns, cname.replace(/\.$/, ''));
  }
  return { selector, lookup, cname };
}

/** Run all three checks for one apex domain. Lookups of one domain run in parallel. */
export async function checkDomain(domain: string, dns: DnsResolver, now: Date): Promise<DomainCheckResult> {
  const [apex, dmarc, ...dkim] = await Promise.all([
    safeTxt(dns, domain),
    safeTxt(dns, `_dmarc.${domain}`),
    ...DKIM_SELECTORS.map((s) => lookupDkimSelector(dns, domain, s)),
  ]);
  const dkimRecords: Record<string, DkimRecord> = {};
  for (const d of dkim) {
    const txt = d.lookup.status === 'ok' ? dkimTxt(d.lookup.records) : [];
    dkimRecords[d.selector] = (txt.length === 0 && !d.cname) ? null : { cname: d.cname, txt };
  }
  return {
    domain,
    checked_at: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    spf: evaluateSpf(apex),
    dmarc: evaluateDmarc(dmarc),
    dkim: evaluateDkim(dkim),
    records: {
      apex_txt: apex.status === 'ok' ? apex.records : [],
      dmarc_txt: dmarc.status === 'ok' ? dmarc.records : [],
      dkim: dkimRecords,
    },
  };
}

/** Compact per-check state used in event payloads (`previous_state` / `current_state`). */
export function stateOf(r: DomainCheckResult, check: CheckName): Record<string, unknown> {
  if (check === 'spf') {
    const s = r.spf;
    return {
      spf: s.status === 'error' ? 'unknown' : s.present ? 'present' : 'absent',
      status: s.status, present: s.present, record: s.record, all_qualifier: s.all_qualifier, issues: s.issues,
    };
  }
  if (check === 'dmarc') {
    const d = r.dmarc;
    return {
      dmarc: d.status === 'error' ? 'unknown' : d.present ? 'present' : 'absent',
      status: d.status, present: d.present, record: d.record, policy: d.policy,
      subdomain_policy: d.subdomain_policy, pct: d.pct, adkim: d.adkim, aspf: d.aspf, rua: d.rua, issues: d.issues,
    };
  }
  const k = r.dkim;
  return {
    status: k.status, selectors_found: k.selectors_found,
    selectors_empty_key: k.selectors_empty_key, selectors_probed: k.selectors_probed,
  };
}

/** Status of a check for the finding lifecycle. DKIM `not_found` is informational. */
export function lifecycleOf(r: DomainCheckResult, check: CheckName): 'problem' | 'ok' | 'unknown' | 'info' {
  const st = r[check].status;
  if (st === 'error') return 'unknown';
  if (st === 'pass') return 'ok';
  if (check === 'dkim') return 'info'; // not_found: never a hard finding
  return 'problem';
}

export function dedupeKey(check: CheckName, domain: string): string {
  return `email_auth.${check}:${domain}`;
}

export interface FindingSpec {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  risk_level: 'info' | 'low' | 'medium' | 'high' | 'critical';
  title: string;
  summary: string;
}

export function findingSpec(r: DomainCheckResult, check: 'spf' | 'dmarc'): FindingSpec {
  if (check === 'spf') {
    if (r.spf.issues.includes('plus_all')) {
      return {
        severity: 'high', risk_level: 'high',
        title: `SPF erlaubt jeden Absender (+all): ${r.domain}`,
        summary: `Der SPF-Eintrag von ${r.domain} endet auf "+all" und autorisiert damit jeden Server als Absender.`,
      };
    }
    if (r.spf.issues.includes('multiple_records')) {
      return {
        severity: 'medium', risk_level: 'medium',
        title: `Mehrere SPF-Einträge: ${r.domain}`,
        summary: `${r.domain} veröffentlicht mehrere v=spf1-Einträge (RFC 7208 permerror); SPF ist damit wirkungslos.`,
      };
    }
    return {
      severity: 'medium', risk_level: 'medium',
      title: `Fehlender SPF-Eintrag: ${r.domain}`,
      summary: `Für ${r.domain} ist kein SPF-Eintrag (v=spf1) veröffentlicht. Spoofing-/Zustellbarkeitsrisiko.`,
    };
  }
  if (r.dmarc.issues.includes('policy_none')) {
    return {
      severity: 'low', risk_level: 'low',
      title: `DMARC nur im Monitoring-Modus (p=none): ${r.domain}`,
      summary: `DMARC für ${r.domain} steht auf p=none — gefälschte Mails werden nicht abgewiesen.`,
    };
  }
  return {
    severity: 'medium', risk_level: 'medium',
    title: `Fehlende DMARC-Policy: ${r.domain}`,
    summary: `Unter _dmarc.${r.domain} ist keine gültige DMARC-Policy veröffentlicht. Spoofing-/Zustellbarkeitsrisiko.`,
  };
}

// ─── Event pairing ───────────────────────────────────────────────────────────

export interface EventRow {
  id: string;
  asset_id: string | null;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

/** IDs of finding events already paired with an email_auth_resolved (any source: scanner or manual). */
export function resolvedEventIds(events: EventRow[]): Set<string> {
  const ids = new Set<string>();
  for (const e of events) {
    if (e.event_type !== EVENT_RESOLVED) continue;
    const ref = e.payload?.['resolves_event_id'];
    if (typeof ref === 'string' && ref) ids.add(ref.toLowerCase());
  }
  return ids;
}

/**
 * Which check does a finding event refer to? New events carry `payload.check`.
 * Legacy/seeded events (e.g. e712035d) only carry per-check fields such as
 * `dmarc: 'absent'`, `spf: '<record>'`, `dkim: 'not_detected_at_root'`; the
 * flagged one is inferred (DMARC before SPF, DKIM never).
 */
export function checkOfEvent(e: EventRow): CheckName | null {
  const p = e.payload ?? {};
  const explicit = p['check'];
  if (explicit === 'spf' || explicit === 'dmarc' || explicit === 'dkim') return explicit;
  const dmarc = typeof p['dmarc'] === 'string' ? (p['dmarc'] as string).toLowerCase() : null;
  if (dmarc && /absent|missing|none|not_detected|invalid/.test(dmarc)) return 'dmarc';
  const spf = typeof p['spf'] === 'string' ? (p['spf'] as string).toLowerCase() : null;
  if (spf !== null && (/absent|missing|not_detected/.test(spf) || (/(^|\s)\+?all(\s|$)/.test(spf) && !/[~\-?]all/.test(spf)))) {
    return 'spf';
  }
  return null;
}

/** Apex domain an event refers to, from `payload.domain` (normalised). */
export function domainOfEvent(e: EventRow): string | null {
  const d = e.payload?.['domain'];
  return typeof d === 'string' ? toApex(d) : null;
}

/**
 * Open (unpaired) finding events that belong to a target domain: matched by
 * asset_id OR by payload domain (apex-normalised).
 */
export function openFindingEventsFor(
  events: EventRow[],
  target: { domain: string; asset_ids: string[] },
): Array<{ event: EventRow; check: CheckName }> {
  const resolved = resolvedEventIds(events);
  const assets = new Set(target.asset_ids.map((a) => a.toLowerCase()));
  const out: Array<{ event: EventRow; check: CheckName }> = [];
  for (const e of events) {
    if (e.event_type !== EVENT_FINDING) continue;
    if (resolved.has(e.id.toLowerCase())) continue;
    const byAsset = e.asset_id ? assets.has(e.asset_id.toLowerCase()) : false;
    const evDomain = domainOfEvent(e);
    const byDomain = evDomain === target.domain;
    // An event whose payload names a DIFFERENT domain is not ours, even if
    // the asset matches (asset reuse across domains).
    if (!(byDomain || (byAsset && (evDomain === null || evDomain === target.domain)))) continue;
    const check = checkOfEvent(e);
    if (!check) continue;
    out.push({ event: e, check });
  }
  return out;
}

export interface ResolvedPayload {
  resolves_event_id: string;
  check: CheckName;
  domain: string;
  previous_state: Record<string, unknown>;
  current_state: Record<string, unknown>;
  checked_at: string;
  evidence_id: string;
  finding_id: string | null;
  scanner_version: string;
  source: 'scanner' | 'manual_owner_approved';
}

export function buildResolvedPayload(args: {
  event: EventRow;
  check: CheckName;
  result: DomainCheckResult;
  evidenceId: string;
  findingId: string | null;
}): ResolvedPayload {
  const p = args.event.payload ?? {};
  const prev = (p['state'] && typeof p['state'] === 'object')
    ? (p['state'] as Record<string, unknown>)
    : (p['current_state'] && typeof p['current_state'] === 'object')
      ? (p['current_state'] as Record<string, unknown>)
      : { ...p };
  return {
    resolves_event_id: args.event.id,
    check: args.check,
    domain: args.result.domain,
    previous_state: prev,
    current_state: stateOf(args.result, args.check),
    checked_at: args.result.checked_at,
    evidence_id: args.evidenceId,
    finding_id: args.findingId,
    scanner_version: SCANNER_VERSION,
    source: 'scanner',
  };
}

// ─── Evidence (hash convention: _shared/evidence-hash.ts) ────────────────────

export interface EvidenceSnapshot extends Record<string, unknown> {
  tenant_id: string;
  asset_id: string | null;
  event_id: string | null;
  evidence_id: string;
  domain: string;
  checked_at: string;
  previous_hash: string | null;
  resolvers: string[];
  records: RawRecords;
}

export function buildSnapshot(args: {
  tenantId: string;
  assetId: string | null;
  eventId: string | null;
  evidenceId: string;
  previousHash: string | null;
  result: DomainCheckResult;
}): EvidenceSnapshot {
  return {
    tenant_id: args.tenantId,
    asset_id: args.assetId,
    event_id: args.eventId,
    evidence_id: args.evidenceId,
    domain: args.result.domain,
    checked_at: args.result.checked_at,
    previous_hash: args.previousHash,
    resolvers: [RESOLVER_LABEL],
    records: args.result.records,
  };
}

/** metadata for the governance_evidence row — same shape as the manual row 58bca6e1, plus scanner fields. */
export function evidenceMetadata(r: DomainCheckResult, mode: TenantMode, snapshot: EvidenceSnapshot, resolves: string[]): Record<string, unknown> {
  return {
    source: 'dns_txt_lookup',
    scanner_version: SCANNER_VERSION,
    mode,
    domain: r.domain,
    checked_at: r.checked_at,
    spf_present: r.spf.present,
    spf_record: r.spf.record,
    spf_status: r.spf.status,
    dmarc_present: r.dmarc.present,
    dmarc_policy: r.dmarc.policy,
    dmarc_record: r.dmarc.record,
    dmarc_status: r.dmarc.status,
    dkim_status: r.dkim.status,
    dkim_selectors_checked: r.dkim.selectors_probed,
    dkim_selectors_found: r.dkim.selectors_found,
    dkim_selectors_empty_key: r.dkim.selectors_empty_key,
    lookup_errors: { spf: r.spf.error ?? null, dmarc: r.dmarc.error ?? null, dkim: r.dkim.errors },
    resolves_event_ids: resolves,
    hash_method: EVIDENCE_HASH_METHOD,
    snapshot,
  };
}

export { evidenceContentHash };

// ─── Targets ─────────────────────────────────────────────────────────────────

export type TenantMode = 'full' | 'resolve_only';

export interface AssetRow { id: string; tenant_id: string | null; system_url: string | null; name: string | null }
export interface WebsiteRow { id: string; tenant_id: string; domain: string | null; governance_asset_id: string | null }

export interface Target {
  tenant_id: string;
  domain: string;
  /** Preferred asset for new rows: the asset whose host equals the apex, else the first one. */
  primary_asset_id: string | null;
  asset_ids: string[];
  website_ids: string[];
}

/**
 * Build targets from website-type governance_assets (system_url, fallback
 * name) and websites rows. Dedupe per tenant + apex domain.
 */
export function buildTargets(assets: AssetRow[], websites: WebsiteRow[]): Target[] {
  const map = new Map<string, Target & { exactAsset: string | null }>();
  const get = (tenant: string, domain: string) => {
    const k = `${tenant}|${domain}`;
    let t = map.get(k);
    if (!t) {
      t = { tenant_id: tenant, domain, primary_asset_id: null, asset_ids: [], website_ids: [], exactAsset: null };
      map.set(k, t);
    }
    return t;
  };
  const sortedAssets = [...assets].sort((a, b) => a.id.localeCompare(b.id));
  for (const a of sortedAssets) {
    if (!a.tenant_id) continue;
    const host = normalizeHost(a.system_url) ?? normalizeHost(a.name);
    if (!host) continue;
    const apex = apexDomain(host);
    if (!isCheckableApex(apex)) continue;
    const t = get(a.tenant_id, apex);
    if (!t.asset_ids.includes(a.id)) t.asset_ids.push(a.id);
    if (host === apex && !t.exactAsset) t.exactAsset = a.id;
  }
  for (const w of [...websites].sort((a, b) => a.id.localeCompare(b.id))) {
    const apex = toApex(w.domain);
    if (!apex) continue;
    const t = get(w.tenant_id, apex);
    if (!t.website_ids.includes(w.id)) t.website_ids.push(w.id);
    if (w.governance_asset_id && !t.asset_ids.includes(w.governance_asset_id)) t.asset_ids.push(w.governance_asset_id);
  }
  return [...map.values()].map(({ exactAsset, ...t }) => ({
    ...t,
    primary_asset_id: exactAsset ?? t.asset_ids[0] ?? null,
  }));
}
