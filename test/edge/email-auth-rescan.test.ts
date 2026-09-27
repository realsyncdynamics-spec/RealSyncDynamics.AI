// @vitest-environment node
/**
 * email-auth-rescan — cron auth, DNS evaluation, auto-resolve of legacy /
 * scanner email_auth_finding events, findings dedupe and evidence chaining.
 *
 * handler.ts runs against an in-memory RescanRepo and a fake DNS resolver;
 * no Deno runtime, no network, no database.
 *
 * Fixture = the real live constellation of 2026-09-25 (read-only snapshot):
 * tenant e6b3c8dd with website assets 1838591e (realsyncdynamicsai.de) and
 * 83781774 (www.), websites row ac677771 (www.), seeded event e712035d
 * (email_auth_finding, legacy payload `dmarc: 'absent'`), DMARC now
 * p=quarantine, Hostinger DKIM hostingermail-a (active) / -b / -c (empty p=).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import {
  handleEmailAuthRescan,
  type HandlerDeps,
  type OpenFindingRow,
  type RescanRepo,
} from '../../supabase/functions/email-auth-rescan/handler';
import {
  EVENT_FINDING,
  EVENT_RESOLVED,
  SCANNER_VERSION,
  apexDomain,
  buildTargets,
  checkCronAuth,
  checkOfEvent,
  evaluateDmarc,
  evaluateSpf,
  normalizeHost,
  timingSafeEqual,
  toApex,
  type AssetRow,
  type CnameLookup,
  type DnsResolver,
  type EventRow,
  type TenantMode,
  type TxtLookup,
  type WebsiteRow,
} from '../../supabase/functions/email-auth-rescan/logic';
import { canonicalJson, evidenceContentHash } from '../../supabase/functions/_shared/evidence-hash';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const KEY = 'test-cron-website-rescan-key-0123456789';
const TENANT = 'e6b3c8dd-d91a-42ca-b12f-d77a1bfd59fc';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const ASSET_APEX = '1838591e-7e42-46b6-a371-19341e9f922c';
const ASSET_WWW = '83781774-bc6b-409d-84bd-fe85dfdfba1b';
const WEBSITE_WWW = 'ac677771-438d-40b7-bf9f-19f86ecffffc';
const SEEDED_EVENT = 'e712035d-0ea0-4d83-8a9a-ca071202910d';
const SEEDED_HASH = 'a996052b8c481af6514c9a600e9301a36badc3fb3136a22da742a98a76e8c710';
const MANUAL_HASH = '9ba200a766edf9a6a0f07a7a055c74c0fdd2d1c7d6d3455283d9e605e1e3c8c8';
const DOMAIN = 'realsyncdynamicsai.de';
const NOW = new Date('2026-09-26T01:30:00.000Z');

const DKIM_KEY = 'v=DKIM1;k=rsa;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAs+RijpkYCOFcf5HdHXcwSJJdaqCIf9jy';

function seededEvent(): EventRow {
  return {
    id: SEEDED_EVENT,
    asset_id: ASSET_APEX,
    event_type: EVENT_FINDING,
    payload: {
      spf: 'v=spf1 include:_spf.mail.hostinger.com ~all',
      dkim: 'not_detected_at_root',
      dmarc: 'absent',
      domain: DOMAIN,
      checked_at: '2026-06-28',
    },
    created_at: '2026-06-27T23:02:04.319787+00:00',
  };
}

function manualResolvedEvent(): EventRow {
  return {
    id: '33762763-3d6a-4482-b53d-662f15c0c7d9',
    asset_id: ASSET_APEX,
    event_type: EVENT_RESOLVED,
    payload: {
      resolves_event_id: SEEDED_EVENT,
      check: 'dmarc',
      domain: DOMAIN,
      previous_state: { dmarc: 'absent', checked_at: '2026-06-28' },
      current_state: { dmarc: 'present', policy: 'quarantine', pct: 100, adkim: 's', aspf: 's' },
      checked_at: '2026-09-25T21:04:48Z',
      evidence_id: '58bca6e1-010f-4a84-807f-41b727c80699',
      finding_id: null,
      scanner_version: 'manual-2026-09-25',
      source: 'manual_owner_approved',
    },
    created_at: '2026-09-25T21:05:00+00:00',
  };
}

type Zone = Record<string, TxtLookup>;

/** Healthy zone for DOMAIN (as observed live on 2026-09-25). */
function healthyZone(domain = DOMAIN): { txt: Zone; cname: Record<string, string> } {
  return {
    txt: {
      [domain]: { status: 'ok', records: ['v=spf1 include:_spf.mail.hostinger.com ~all'] },
      [`_dmarc.${domain}`]: {
        status: 'ok',
        records: ['v=DMARC1; p=quarantine; rua=mailto:dmarc@example.org; pct=100; adkim=s; aspf=s'],
      },
      // CNAME targets (the selector names themselves only have the CNAME)
      'hostingermail-a.dkim.mail.hostinger.com': { status: 'ok', records: [DKIM_KEY] },
      'hostingermail-b.dkim.mail.hostinger.com': { status: 'ok', records: ['v=DKIM1;p='] },
      'hostingermail-c.dkim.mail.hostinger.com': { status: 'ok', records: ['v=DKIM1;p='] },
    },
    cname: {
      [`hostingermail-a._domainkey.${domain}`]: 'hostingermail-a.dkim.mail.hostinger.com.',
      [`hostingermail-b._domainkey.${domain}`]: 'hostingermail-b.dkim.mail.hostinger.com.',
      [`hostingermail-c._domainkey.${domain}`]: 'hostingermail-c.dkim.mail.hostinger.com.',
    },
  };
}

function fakeDns(zone: { txt: Zone; cname: Record<string, string> }, throwFor: Record<string, Error> = {}) {
  const queried: string[] = [];
  const dns: DnsResolver = {
    async txt(name) {
      queried.push(`TXT ${name}`);
      if (throwFor[name]) throw throwFor[name];
      return zone.txt[name] ?? { status: 'nodata' };
    },
    async cname(name): Promise<CnameLookup> {
      queried.push(`CNAME ${name}`);
      const t = zone.cname[name];
      return t ? { status: 'ok', targets: [t] } : { status: 'nodata' };
    },
  };
  return { dns, queried };
}

interface Store {
  assets: AssetRow[];
  websites: WebsiteRow[];
  events: Array<EventRow & { tenant_id: string; [k: string]: unknown }>;
  evidence: Array<Record<string, unknown> & { tenant_id: string; content_hash: string | null }>;
  findings: Array<Record<string, unknown> & { id: string; tenant_id: string; status: string; dedupe_key: string | null }>;
  calls: string[];
}

function baseStore(): Store {
  return {
    assets: [
      { id: ASSET_APEX, tenant_id: TENANT, system_url: 'https://realsyncdynamicsai.de', name: 'realsyncdynamicsai.de' },
      { id: ASSET_WWW, tenant_id: TENANT, system_url: 'https://www.realsyncdynamicsai.de', name: 'www.realsyncdynamicsai.de' },
    ],
    websites: [{ id: WEBSITE_WWW, tenant_id: TENANT, domain: 'www.realsyncdynamicsai.de', governance_asset_id: ASSET_WWW }],
    events: [{ ...seededEvent(), tenant_id: TENANT }],
    evidence: [{ id: 'e8d9b511-6136-4729-bd76-60e54661d7c7', tenant_id: TENANT, content_hash: SEEDED_HASH }],
    findings: [],
    calls: [],
  };
}

function memRepo(s: Store): RescanRepo {
  const log = (c: string) => s.calls.push(c);
  return {
    async listWebsiteAssets() { log('listWebsiteAssets'); return s.assets; },
    async listWebsites() { log('listWebsites'); return s.websites; },
    async listEmailAuthEvents(t) {
      log('listEmailAuthEvents');
      return s.events.filter((e) => e.tenant_id === t && (e.event_type === EVENT_FINDING || e.event_type === EVENT_RESOLVED))
        .map(({ id, asset_id, event_type, payload, created_at }) => ({ id, asset_id, event_type, payload, created_at }));
    },
    async listOpenEmailAuthFindings(t) {
      log('listOpenEmailAuthFindings');
      return s.findings
        .filter((f) => f.tenant_id === t && ['open', 'acknowledged'].includes(f.status) && f.dedupe_key?.startsWith('email_auth.'))
        .map((f) => ({ ...f }) as unknown as OpenFindingRow);
    },
    async latestEvidenceHash(t) {
      log('latestEvidenceHash');
      const rows = s.evidence.filter((e) => e.tenant_id === t && e.content_hash);
      return rows.length ? rows[rows.length - 1].content_hash : null;
    },
    async insertEvidence(row) {
      log('insertEvidence');
      s.evidence.push(row as Store['evidence'][number]);
      return { id: row.id as string };
    },
    async insertEvent(row) {
      log('insertEvent');
      s.events.push(row as Store['events'][number]);
      return { id: row.id as string };
    },
    async insertFinding(row) {
      log('insertFinding');
      const dup = s.findings.find((f) => f.tenant_id === row.tenant_id && f.dedupe_key === row.dedupe_key
        && ['open', 'acknowledged'].includes(f.status));
      if (dup) return 'conflict';
      s.findings.push({ ...(row as Store['findings'][number]) });
      return { id: row.id as string };
    },
    async updateOpenFinding(id, patch) {
      log('updateOpenFinding');
      const f = s.findings.find((x) => x.id === id && ['open', 'acknowledged'].includes(x.status));
      if (f) Object.assign(f, patch);
    },
    async resolveFinding(id, at) {
      log('resolveFinding');
      const f = s.findings.find((x) => x.id === id && ['open', 'acknowledged'].includes(x.status));
      if (f) Object.assign(f, { status: 'resolved', resolved_at: at });
    },
  };
}

let uuidCounter = 0;
function deps(s: Store, dns: DnsResolver, over: Partial<HandlerDeps> = {}, modes: Record<string, TenantMode> = {}): HandlerDeps {
  return {
    cronKey: KEY,
    repo: memRepo(s),
    dns,
    planMode: async (t) => modes[t] ?? 'resolve_only',
    now: () => NOW,
    uuid: () => {
      uuidCounter++;
      return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, '0')}`;
    },
    ...over,
  };
}

function post(auth: string | null = `Bearer ${KEY}`, body: unknown = { trigger: 'cron' }, method = 'POST'): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (auth !== null) headers.Authorization = auth;
  return new Request('http://localhost/functions/v1/email-auth-rescan', {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
}

const resolvedEvents = (s: Store) => s.events.filter((e) => e.event_type === EVENT_RESOLVED);
const findingEvents = (s: Store) => s.events.filter((e) => e.event_type === EVENT_FINDING);

// ─── Auth ────────────────────────────────────────────────────────────────────

describe('cron auth (fail-closed, dedicated key)', () => {
  it('no Authorization → 401 "cron only", no DB and no DNS access', async () => {
    const s = baseStore();
    const { dns, queried } = fakeDns(healthyZone());
    const res = await handleEmailAuthRescan(post(null), deps(s, dns));
    expect(res.status).toBe(401);
    expect(JSON.stringify(await res.json())).toContain('cron only');
    expect(s.calls).toEqual([]);
    expect(queried).toEqual([]);
  });

  it('wrong bearer, prefix/suffix variants and non-Bearer schemes → 401', async () => {
    for (const h of [`Bearer ${KEY}x`, `Bearer ${KEY.slice(0, -1)}`, `bearer ${KEY}`, KEY, `Basic ${KEY}`, 'Bearer ']) {
      const s = baseStore();
      const { dns } = fakeDns(healthyZone());
      const res = await handleEmailAuthRescan(post(h), deps(s, dns));
      expect(res.status, h).toBe(401);
      expect(s.calls).toEqual([]);
    }
  });

  it('service_role-looking JWT is not accepted as cron credential', async () => {
    const s = baseStore();
    const { dns } = fakeDns(healthyZone());
    const res = await handleEmailAuthRescan(post('Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.sig'), deps(s, dns));
    expect(res.status).toBe(401);
  });

  it('missing CRON_WEBSITE_RESCAN_KEY → 500, refuses to run even with any bearer', async () => {
    for (const cronKey of [undefined, '', '   ']) {
      const s = baseStore();
      const { dns, queried } = fakeDns(healthyZone());
      const res = await handleEmailAuthRescan(post('Bearer '), deps(s, dns, { cronKey }));
      expect(res.status).toBe(500);
      expect(s.calls).toEqual([]);
      expect(queried).toEqual([]);
    }
  });

  it('GET → 405; OPTIONS → preflight', async () => {
    const s = baseStore();
    const { dns } = fakeDns(healthyZone());
    expect((await handleEmailAuthRescan(post(`Bearer ${KEY}`, null, 'GET'), deps(s, dns))).status).toBe(405);
    const opt = await handleEmailAuthRescan(new Request('http://x', { method: 'OPTIONS' }), deps(s, dns));
    expect(opt.status).toBe(200);
  });

  it('checkCronAuth / timingSafeEqual semantics', () => {
    expect(checkCronAuth(KEY, `Bearer ${KEY}`)).toEqual({ ok: true });
    expect(checkCronAuth('', `Bearer `)).toMatchObject({ ok: false, status: 500 });
    expect(checkCronAuth(KEY, null)).toMatchObject({ ok: false, status: 401 });
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('', '')).toBe(true);
  });
});

// ─── Auto-resolve of the seeded / legacy event ───────────────────────────────

describe('auto-resolve legacy email_auth_finding (e712035d-style)', () => {
  it('DMARC now p=quarantine → exactly one email_auth_resolved in the documented format', async () => {
    const s = baseStore();
    const { dns } = fakeDns(healthyZone());
    const res = await handleEmailAuthRescan(post(), deps(s, dns));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.domains_checked).toBe(1);

    const resolved = resolvedEvents(s);
    expect(resolved).toHaveLength(1);
    const ev = resolved[0];
    expect(ev).toMatchObject({
      tenant_id: TENANT,
      asset_id: ASSET_APEX,
      event_type: 'email_auth_resolved',
      event_source: 'website_scanner',
      risk_level: 'info',
      policy_action: 'log',
    });
    const p = ev.payload as Record<string, unknown>;
    expect(Object.keys(p).sort()).toEqual([
      'check', 'checked_at', 'current_state', 'domain', 'evidence_id', 'finding_id',
      'previous_state', 'resolves_event_id', 'scanner_version', 'source',
    ]);
    expect(p).toMatchObject({
      resolves_event_id: SEEDED_EVENT,
      check: 'dmarc',
      domain: DOMAIN,
      finding_id: null,
      scanner_version: SCANNER_VERSION,
      source: 'scanner',
      checked_at: '2026-09-26T01:30:00Z',
    });
    expect(p.previous_state).toMatchObject({ dmarc: 'absent' });
    expect(p.current_state).toMatchObject({ dmarc: 'present', policy: 'quarantine', pct: 100, adkim: 's', aspf: 's' });
    // evidence_id points at the snapshot written in the same run
    const evidence = s.evidence[s.evidence.length - 1];
    expect(p.evidence_id).toBe(evidence.id);
    // resolve_only tenant: nothing new is opened
    expect(findingEvents(s)).toHaveLength(1);
    expect(s.findings).toHaveLength(0);
  });

  it('idempotent: a second run creates no duplicate resolved event (and no extra evidence)', async () => {
    const s = baseStore();
    const { dns } = fakeDns(healthyZone());
    await handleEmailAuthRescan(post(), deps(s, dns));
    const evidenceAfterFirst = s.evidence.length;
    const res2 = await handleEmailAuthRescan(post(), deps(s, dns));
    expect(res2.status).toBe(200);
    expect(resolvedEvents(s)).toHaveLength(1);
    expect(s.evidence.length).toBe(evidenceAfterFirst);
  });

  it('idempotent in full mode too: second run adds evidence but no second resolve', async () => {
    const s = baseStore();
    const { dns } = fakeDns(healthyZone());
    await handleEmailAuthRescan(post(), deps(s, dns, {}, { [TENANT]: 'full' }));
    await handleEmailAuthRescan(post(), deps(s, dns, {}, { [TENANT]: 'full' }));
    expect(resolvedEvents(s)).toHaveLength(1);
    expect(s.evidence.length).toBe(3); // seeded + one snapshot per run
  });

  it('already resolved by the manual owner-approved entry (33762763) → no duplicate, nothing written', async () => {
    const s = baseStore();
    s.events.push({ ...manualResolvedEvent(), tenant_id: TENANT });
    s.evidence.push({ id: '58bca6e1-010f-4a84-807f-41b727c80699', tenant_id: TENANT, content_hash: MANUAL_HASH });
    const { dns, queried } = fakeDns(healthyZone());
    const res = await handleEmailAuthRescan(post(), deps(s, dns));
    expect(res.status).toBe(200);
    expect(resolvedEvents(s)).toHaveLength(1);
    expect(resolvedEvents(s)[0].id).toBe('33762763-3d6a-4482-b53d-662f15c0c7d9');
    expect(s.calls.filter((c) => c.startsWith('insert'))).toEqual([]);
    // resolve_only tenant with nothing open is not even looked up in DNS
    expect(queried).toEqual([]);
    expect((await res.json()).skipped_plan).toBe(1);
  });

  it('manual resolve + full mode: DNS is checked, evidence chains onto the manual hash, still no duplicate', async () => {
    const s = baseStore();
    s.events.push({ ...manualResolvedEvent(), tenant_id: TENANT });
    s.evidence.push({ id: '58bca6e1-010f-4a84-807f-41b727c80699', tenant_id: TENANT, content_hash: MANUAL_HASH });
    const { dns } = fakeDns(healthyZone());
    await handleEmailAuthRescan(post(), deps(s, dns, {}, { [TENANT]: 'full' }));
    expect(resolvedEvents(s)).toHaveLength(1);
    const ev = s.evidence[s.evidence.length - 1];
    expect(ev.previous_hash).toBe(MANUAL_HASH);
  });

  it('DNS error (SERVFAIL / timeout) resolves nothing and opens nothing', async () => {
    for (const err of [Object.assign(new Error('SERVFAIL'), { name: 'Error' }), Object.assign(new Error('timed out'), { name: 'TimedOut' })]) {
      const s = baseStore();
      const { dns } = fakeDns(healthyZone(), { [`_dmarc.${DOMAIN}`]: err });
      const res = await handleEmailAuthRescan(post(), deps(s, dns, {}, { [TENANT]: 'full' }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.results[0].dmarc).toBe('error');
      expect(resolvedEvents(s)).toHaveLength(0);
      expect(s.findings.filter((f) => f.dedupe_key?.startsWith('email_auth.dmarc'))).toHaveLength(0);
    }
  });

  it('a resolver returning status=error (not thrown) is treated the same', async () => {
    const s = baseStore();
    const zone = healthyZone();
    zone.txt[`_dmarc.${DOMAIN}`] = { status: 'error', message: 'SERVFAIL' };
    const { dns } = fakeDns(zone);
    await handleEmailAuthRescan(post(), deps(s, dns));
    expect(resolvedEvents(s)).toHaveLength(0);
    expect(s.calls).not.toContain('insertEvidence');
  });

  it('DMARC still missing (NXDOMAIN) → legacy event stays open, no resolve', async () => {
    const s = baseStore();
    const zone = healthyZone();
    delete zone.txt[`_dmarc.${DOMAIN}`];
    const { dns } = fakeDns(zone, { [`_dmarc.${DOMAIN}`]: Object.assign(new Error('no record'), { name: 'NotFound' }) });
    await handleEmailAuthRescan(post(), deps(s, dns));
    expect(resolvedEvents(s)).toHaveLength(0);
  });

  it('matches by payload domain even when the asset differs, but not a foreign domain on the same asset', async () => {
    const s = baseStore();
    s.events = [
      { ...seededEvent(), tenant_id: TENANT, id: 'aaaaaaaa-0000-4000-8000-000000000001', asset_id: null },
      { ...seededEvent(), tenant_id: TENANT, id: 'aaaaaaaa-0000-4000-8000-000000000002', payload: { ...seededEvent().payload, domain: 'other-domain.de' } },
    ];
    const { dns } = fakeDns(healthyZone());
    await handleEmailAuthRescan(post(), deps(s, dns));
    const ids = resolvedEvents(s).map((e) => (e.payload as Record<string, unknown>).resolves_event_id);
    expect(ids).toEqual(['aaaaaaaa-0000-4000-8000-000000000001']);
  });
});

// ─── Findings lifecycle (full mode) ──────────────────────────────────────────

describe('findings: create on p=none, dedupe upsert, auto-resolve', () => {
  function nonePolicyZone() {
    const zone = healthyZone();
    zone.txt[`_dmarc.${DOMAIN}`] = { status: 'ok', records: ['v=DMARC1; p=none; rua=mailto:x@example.org'] };
    return zone;
  }
  function freshStore() {
    const s = baseStore();
    s.events = []; // no legacy event: a genuinely new problem
    return s;
  }

  it('p=none creates one finding + one email_auth_finding with check/domain', async () => {
    const s = freshStore();
    const { dns } = fakeDns(nonePolicyZone());
    const res = await handleEmailAuthRescan(post(), deps(s, dns, {}, { [TENANT]: 'full' }));
    expect(res.status).toBe(200);
    expect(s.findings).toHaveLength(1);
    const f = s.findings[0];
    expect(f).toMatchObject({
      tenant_id: TENANT,
      asset_id: ASSET_APEX,
      website_id: WEBSITE_WWW,
      category: 'security',
      severity: 'low',
      status: 'open',
      detector: 'email-auth-rescan',
      dedupe_key: `email_auth.dmarc:${DOMAIN}`,
    });
    expect(f.evidence_id).toBe(s.evidence[s.evidence.length - 1].id);
    const evs = findingEvents(s);
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ event_source: 'website_scanner', policy_action: 'warn', risk_level: 'low', asset_id: ASSET_APEX });
    expect(evs[0].payload).toMatchObject({
      check: 'dmarc', domain: DOMAIN, finding_id: f.id, source: 'scanner', scanner_version: SCANNER_VERSION,
    });
    expect((evs[0].payload as Record<string, unknown>).current_state).toMatchObject({ policy: 'none' });
    // SPF ~all and DKIM hostingermail-a are fine → no findings for them
    expect(s.findings.some((x) => x.dedupe_key?.includes('spf') || x.dedupe_key?.includes('dkim'))).toBe(false);
  });

  it('dedupe: second run with the same problem updates the open finding, no new row, no new event', async () => {
    const s = freshStore();
    const { dns } = fakeDns(nonePolicyZone());
    await handleEmailAuthRescan(post(), deps(s, dns, {}, { [TENANT]: 'full' }));
    const firstEvidence = s.findings[0].evidence_id;
    const res = await handleEmailAuthRescan(post(), deps(s, dns, {}, { [TENANT]: 'full' }));
    const body = await res.json();
    expect(s.findings).toHaveLength(1);
    expect(findingEvents(s)).toHaveLength(1);
    expect(body.results[0].findings_updated).toBe(1);
    expect(s.findings[0].evidence_id).not.toBe(firstEvidence);
  });

  it('insert conflict on the partial unique index is tolerated (concurrent run)', async () => {
    const s = freshStore();
    s.findings.push({ id: 'ffffffff-0000-4000-8000-000000000001', tenant_id: TENANT, status: 'open', dedupe_key: `email_auth.dmarc:${DOMAIN}` });
    const repo = memRepo(s);
    // Hide the existing row from the listing to force the insert path.
    repo.listOpenEmailAuthFindings = async () => [];
    const { dns } = fakeDns(nonePolicyZone());
    const res = await handleEmailAuthRescan(post(), deps(s, dns, { repo }, { [TENANT]: 'full' }));
    expect(res.status).toBe(200);
    expect(s.findings).toHaveLength(1);
    expect(findingEvents(s)).toHaveLength(0);
  });

  it('fix published → finding resolved with resolved_at, resolved event pairs with the scanner event', async () => {
    const s = freshStore();
    await handleEmailAuthRescan(post(), deps(s, fakeDns(nonePolicyZone()).dns, {}, { [TENANT]: 'full' }));
    const scannerEvent = findingEvents(s)[0];
    await handleEmailAuthRescan(post(), deps(s, fakeDns(healthyZone()).dns, {}, { [TENANT]: 'full' }));
    expect(s.findings[0]).toMatchObject({ status: 'resolved', resolved_at: NOW.toISOString() });
    const resolved = resolvedEvents(s);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].payload).toMatchObject({
      resolves_event_id: scannerEvent.id, check: 'dmarc', finding_id: s.findings[0].id,
    });
    expect((resolved[0].payload as Record<string, unknown>).previous_state).toMatchObject({ policy: 'none' });
    // third run: nothing left to resolve
    await handleEmailAuthRescan(post(), deps(s, fakeDns(healthyZone()).dns, {}, { [TENANT]: 'full' }));
    expect(resolvedEvents(s)).toHaveLength(1);
  });

  it('resolve_only tenant never opens findings, even with a problem', async () => {
    const s = freshStore();
    const { dns, queried } = fakeDns(nonePolicyZone());
    await handleEmailAuthRescan(post(), deps(s, dns));
    expect(s.findings).toHaveLength(0);
    expect(findingEvents(s)).toHaveLength(0);
    expect(queried).toEqual([]);
  });

  it('SPF +all → high finding; missing SPF → medium', async () => {
    const s = freshStore();
    const zone = healthyZone();
    zone.txt[DOMAIN] = { status: 'ok', records: ['v=spf1 +all'] };
    await handleEmailAuthRescan(post(), deps(s, fakeDns(zone).dns, {}, { [TENANT]: 'full' }));
    expect(s.findings.find((f) => f.dedupe_key === `email_auth.spf:${DOMAIN}`)).toMatchObject({ severity: 'high' });
  });
});

// ─── Evidence chaining ───────────────────────────────────────────────────────

describe('evidence: DNS snapshot chained onto the tenant\'s latest hash', () => {
  it('first link uses the runtime latest hash; content_hash = sha256(JCS(metadata.snapshot))', async () => {
    const s = baseStore();
    const { dns } = fakeDns(healthyZone());
    await handleEmailAuthRescan(post(), deps(s, dns));
    const ev = s.evidence[s.evidence.length - 1] as Record<string, unknown>;
    expect(ev.previous_hash).toBe(SEEDED_HASH);
    expect(ev).toMatchObject({ evidence_type: 'json', title: 'DNS TXT Snapshot (SPF/DMARC/DKIM)', asset_id: ASSET_APEX, event_id: null });
    const md = ev.metadata as Record<string, unknown>;
    expect(md.hash_method).toBe('sha256_hex(utf8(RFC8785_JCS(metadata.snapshot)))');
    const snap = md.snapshot as Record<string, unknown>;
    expect(snap).toMatchObject({
      tenant_id: TENANT, asset_id: ASSET_APEX, event_id: null, evidence_id: ev.id,
      domain: DOMAIN, previous_hash: SEEDED_HASH,
    });
    expect(ev.content_hash).toBe(await evidenceContentHash(snap));
    // JSON round trip (jsonb) does not change the hash
    expect(await evidenceContentHash(JSON.parse(JSON.stringify(snap)))).toBe(ev.content_hash);
    expect(canonicalJson(snap)).not.toMatch(/\s"/);
    expect(md.resolves_event_ids).toEqual([SEEDED_EVENT]);
  });

  it('several domains of one tenant in one run form a chain (no fork)', async () => {
    const s = baseStore();
    s.assets.push({ id: '44444444-4444-4444-8444-444444444444', tenant_id: TENANT, system_url: 'https://shop.example-two.de/path', name: 'x' });
    const zone = healthyZone();
    Object.assign(zone.txt, healthyZone('example-two.de').txt);
    const { dns } = fakeDns(zone);
    await handleEmailAuthRescan(post(), deps(s, dns, {}, { [TENANT]: 'full' }));
    const links = s.evidence.slice(1);
    expect(links).toHaveLength(2);
    expect(links[0].previous_hash).toBe(SEEDED_HASH);
    expect(links[1].previous_hash).toBe(links[0].content_hash);
    expect((links[1].metadata as Record<string, Record<string, unknown>>).snapshot.previous_hash).toBe(links[0].content_hash);
  });

  it('tenant without any evidence starts the chain with previous_hash null', async () => {
    const s = baseStore();
    s.evidence = [];
    await handleEmailAuthRescan(post(), deps(s, fakeDns(healthyZone()).dns));
    expect(s.evidence[0].previous_hash).toBeNull();
  });
});

// ─── DKIM ────────────────────────────────────────────────────────────────────

describe('DKIM selectors (Hostinger CNAMEs, empty p= = revoked)', () => {
  it('follows CNAMEs; -a counts as present, -b/-c with empty p= as revoked', async () => {
    const s = baseStore();
    s.events = [];
    const { dns } = fakeDns(healthyZone());
    await handleEmailAuthRescan(post(), deps(s, dns, {}, { [TENANT]: 'full' }));
    const md = s.evidence[1].metadata as Record<string, unknown>;
    expect(md.dkim_status).toBe('pass');
    expect(md.dkim_selectors_found).toEqual(['hostingermail-a']);
    expect(md.dkim_selectors_empty_key).toEqual(['hostingermail-b', 'hostingermail-c']);
    const dkim = ((md.snapshot as Record<string, unknown>).records as Record<string, Record<string, unknown>>).dkim;
    expect(dkim['hostingermail-a']).toEqual({ cname: 'hostingermail-a.dkim.mail.hostinger.com.', txt: [DKIM_KEY] });
    expect(dkim['hostingermail-b']).toEqual({ cname: 'hostingermail-b.dkim.mail.hostinger.com.', txt: ['v=DKIM1;p='] });
    expect(dkim.default).toBeNull();
  });

  it('only empty keys / no selector → not_found, informational: no DKIM finding', async () => {
    const s = baseStore();
    s.events = [];
    const zone = healthyZone();
    zone.txt['hostingermail-a.dkim.mail.hostinger.com'] = { status: 'ok', records: ['v=DKIM1;p='] };
    await handleEmailAuthRescan(post(), deps(s, fakeDns(zone).dns, {}, { [TENANT]: 'full' }));
    const md = s.evidence[1].metadata as Record<string, unknown>;
    expect(md.dkim_status).toBe('not_found');
    expect(s.findings.some((f) => f.dedupe_key?.startsWith('email_auth.dkim'))).toBe(false);
  });
});

// ─── Targets, cap, isolation ─────────────────────────────────────────────────

describe('targets, cap and per-domain isolation', () => {
  it('normalises hosts and dedupes apex + www + websites row into one target', () => {
    const targets = buildTargets(baseStore().assets, baseStore().websites);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      tenant_id: TENANT, domain: DOMAIN, primary_asset_id: ASSET_APEX, website_ids: [WEBSITE_WWW],
    });
    expect(targets[0].asset_ids.sort()).toEqual([ASSET_APEX, ASSET_WWW].sort());
  });

  it('normalizeHost / apexDomain / toApex edge cases', () => {
    expect(normalizeHost('HTTPS://User@WWW.Example.DE:8443/a?b#c')).toBe('www.example.de');
    expect(normalizeHost('example.de.')).toBe('example.de');
    expect(normalizeHost('http://127.0.0.1')).toBeNull();
    expect(normalizeHost('localhost')).toBeNull();
    expect(normalizeHost('not a host')).toBeNull();
    expect(apexDomain('a.b.shop.example.co.uk')).toBe('example.co.uk');
    expect(toApex('https://www.realsyncdynamicsai.de/impressum')).toBe(DOMAIN);
    expect(toApex('co.uk')).toBeNull();
  });

  it('cap: at most maxDomains, domains with open items first', async () => {
    const s = baseStore();
    for (let i = 0; i < 5; i++) {
      s.assets.push({ id: `5555555${i}-5555-4555-8555-555555555555`, tenant_id: TENANT_B, system_url: `https://www.site${i}-example.org`, name: null });
    }
    // tenant e6b3 (sorted after 2222…) has the open legacy event → must come first
    const res = await handleEmailAuthRescan(post(), deps(s, fakeDns(healthyZone()).dns, { maxDomains: 2 }, { [TENANT_B]: 'full' }));
    const body = await res.json();
    expect(body.domains_checked).toBe(2);
    expect(body.truncated).toBe(4);
    expect(body.results[0].domain).toBe(DOMAIN);
    expect(resolvedEvents(s)).toHaveLength(1);
  });

  it('an error on one domain does not stop the others', async () => {
    const s = baseStore();
    s.assets.push({ id: '66666666-6666-4666-8666-666666666666', tenant_id: TENANT_B, system_url: 'https://broken.example', name: null });
    const repo = memRepo(s);
    const orig = repo.insertEvidence;
    repo.insertEvidence = async (row) => {
      if (row.tenant_id === TENANT_B) throw new Error('boom');
      return orig(row);
    };
    const res = await handleEmailAuthRescan(post(), deps(s, fakeDns(healthyZone()).dns, { repo }, { [TENANT_B]: 'full' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.results.find((r: { domain: string }) => r.domain === 'broken.example').error).toBe('boom');
    expect(resolvedEvents(s)).toHaveLength(1);
  });

  it('plan lookup failure degrades to resolve_only (never opens findings)', async () => {
    const s = baseStore();
    s.events = [];
    const zone = healthyZone();
    zone.txt[`_dmarc.${DOMAIN}`] = { status: 'ok', records: ['v=DMARC1; p=none'] };
    await handleEmailAuthRescan(post(), deps(s, fakeDns(zone).dns, { planMode: async () => { throw new Error('rpc down'); } }));
    expect(s.findings).toHaveLength(0);
  });

  it('dry_run writes nothing', async () => {
    const s = baseStore();
    const res = await handleEmailAuthRescan(post(`Bearer ${KEY}`, { dry_run: true }), deps(s, fakeDns(healthyZone()).dns));
    const body = await res.json();
    expect(body.dry_run).toBe(true);
    expect(body.results[0].events_resolved).toBe(1);
    expect(s.calls.filter((c) => c.startsWith('insert') || c.startsWith('resolve') || c.startsWith('update'))).toEqual([]);
  });
});

// ─── Pure evaluation ─────────────────────────────────────────────────────────

describe('SPF / DMARC evaluation and legacy check inference', () => {
  it('SPF', () => {
    expect(evaluateSpf({ status: 'ok', records: ['v=spf1 include:_spf.mail.hostinger.com ~all'] })).toMatchObject({ status: 'pass', all_qualifier: '~' });
    expect(evaluateSpf({ status: 'ok', records: ['v=spf1 all'] })).toMatchObject({ status: 'fail', issues: ['plus_all'] });
    expect(evaluateSpf({ status: 'ok', records: ['google-site-verification=x'] })).toMatchObject({ status: 'fail', issues: ['missing'] });
    expect(evaluateSpf({ status: 'nodata' })).toMatchObject({ status: 'fail', issues: ['missing'] });
    expect(evaluateSpf({ status: 'ok', records: ['v=spf1 -all', 'v=spf1 ~all'] })).toMatchObject({ status: 'fail', issues: ['multiple_records'] });
    expect(evaluateSpf({ status: 'error', message: 'x' }).status).toBe('error');
  });

  it('DMARC', () => {
    expect(evaluateDmarc({ status: 'ok', records: ['v=DMARC1; p=reject; pct=50; sp=none'] }))
      .toMatchObject({ status: 'pass', policy: 'reject', pct: 50, subdomain_policy: 'none' });
    expect(evaluateDmarc({ status: 'ok', records: ['v=DMARC1; p=none'] })).toMatchObject({ status: 'fail', issues: ['policy_none'] });
    expect(evaluateDmarc({ status: 'ok', records: ['v=DMARC1; rua=mailto:x@y'] })).toMatchObject({ status: 'fail', issues: ['invalid_policy'] });
    expect(evaluateDmarc({ status: 'nodata' })).toMatchObject({ status: 'fail', issues: ['missing'] });
    expect(evaluateDmarc({ status: 'error', message: 'SERVFAIL' }).status).toBe('error');
  });

  it('legacy payload → check', () => {
    expect(checkOfEvent(seededEvent())).toBe('dmarc');
    expect(checkOfEvent({ ...seededEvent(), payload: { check: 'spf' } })).toBe('spf');
    expect(checkOfEvent({ ...seededEvent(), payload: { spf: 'absent', dmarc: 'v=DMARC1; p=reject' } })).toBe('spf');
    expect(checkOfEvent({ ...seededEvent(), payload: { dkim: 'not_detected_at_root' } })).toBeNull();
  });
});

// ─── Source contract (index.ts / config.toml) ────────────────────────────────

describe('source contract', () => {
  const index = readFileSync('supabase/functions/email-auth-rescan/index.ts', 'utf8');
  it('reads the dedicated secret and never compares the bearer against service_role', () => {
    expect(index).toContain("Deno.env.get('CRON_WEBSITE_RESCAN_KEY')");
    expect(index).toContain('cron_website_rescan_key');
    expect(index).not.toMatch(/Bearer \$\{(SERVICE_KEY|SERVICE_ROLE|SRK|SUPABASE_SERVICE_ROLE_KEY)\}/);
    expect(index.indexOf('checkCronAuth(')).toBeLessThan(index.indexOf('createClient('));
  });
  it('handler/logic stay vitest-importable (no Deno / jsr specifiers)', () => {
    for (const f of ['handler.ts', 'logic.ts', 'repo.ts']) {
      const src = readFileSync(`supabase/functions/email-auth-rescan/${f}`, 'utf8');
      expect(src, f).not.toMatch(/from 'jsr:|from 'npm:|\bDeno\.(env|serve|resolveDns)\(/);
    }
    expect(existsSync('supabase/functions/email-auth-rescan/index.ts')).toBe(true);
  });
});
