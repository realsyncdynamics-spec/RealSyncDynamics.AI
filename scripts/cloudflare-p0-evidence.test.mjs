import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROJECT, DOMAIN, deploymentSummary, projectSummary, domainSummary,
  dnsSummary, routeSummary, voiceDnsClassification, collectEvidence,
} from './cloudflare-p0-evidence.mjs';

const canonical = {
  id: 'deployment-1',
  environment: 'production',
  url: 'https://abc123.realsyncdynamics-ai.pages.dev',
  deployment_trigger: { metadata: { branch: 'main', commit_hash: 'abc123456789' } },
};
const project = { name: PROJECT, source: { config: { production_branch: 'main' } }, canonical_deployment: canonical };

test('production candidate requires a production canonical deployment on the expected branch', () => {
  const x = projectSummary(project);
  assert.equal(x.production_candidate, true);
  assert.equal(x.canonical.commit, 'abc123456789');
  assert.equal(x.canonical.pages_dev_host, 'abc123.realsyncdynamics-ai.pages.dev');
});

test('preview deployments cannot count as canonical production', () => {
  assert.equal(projectSummary({ ...project, canonical_deployment: { ...canonical, environment: 'preview' } }).production_candidate, false);
});

test('canonical deployment branch mismatch cannot pass', () => {
  assert.equal(projectSummary({ ...project, canonical_deployment: {
    ...canonical, deployment_trigger: { metadata: { branch: 'feature', commit_hash: 'abc123456789' } },
  } }).production_candidate, false);
});

test('a deployment with invalid URL never exports an arbitrary host', () => {
  assert.equal(deploymentSummary({ ...canonical, url: 'https://example.com' }).pages_dev_host, null);
});

test('missing www domain remains explicitly unconfirmed', () => {
  assert.deepEqual(domainSummary([{ name: DOMAIN, status: 'active' }]), [
    { name: DOMAIN, present: true, status: 'active' },
    { name: 'www.' + DOMAIN, present: false, status: null },
  ]);
});

test('DNS results must be exact-name filtered', () => {
  const entries = [
    { name: 'www.' + DOMAIN, type: 'CNAME', content: 'target.pages.dev', proxied: true },
    { name: 'other.' + DOMAIN, type: 'A', content: '127.0.0.1' },
  ];
  assert.deepEqual(dnsSummary(entries, 'www.' + DOMAIN), [
    { name: 'www.' + DOMAIN, type: 'CNAME', target: 'target.pages.dev', proxied: true },
  ]);
});

test('voice DNS-only CNAME to GitHub Pages is classified as external hosting', () => {
  assert.deepEqual(voiceDnsClassification([
    { name: 'voice.' + DOMAIN, type: 'CNAME', content: 'realsyncdynamics-spec.github.io', proxied: false },
  ]), {
    host: 'voice.' + DOMAIN,
    classification: 'GITHUB_PAGES_DNS_ONLY',
    cname_target: 'realsyncdynamics-spec.github.io',
    proxied: false,
  });
});

test('DNS-only CNAME to an unverified origin is not falsely labeled GitHub Pages', () => {
  assert.equal(voiceDnsClassification([
    { name: 'voice.' + DOMAIN, type: 'CNAME', content: 'elsewhere.example', proxied: false },
  ]).classification, 'DNS_ONLY_EXTERNAL_ORIGIN_UNVERIFIED');
});

test('proxied voice record is not classified as DNS-only', () => {
  assert.equal(voiceDnsClassification([
    { name: 'voice.' + DOMAIN, type: 'CNAME', content: 'realsyncdynamics-spec.github.io', proxied: true },
  ]).classification, 'CLOUDFLARE_PROXY_CANDIDATE');
});

test('missing voice DNS yields UNVERIFIED, not an outage assertion', () => {
  assert.equal(voiceDnsClassification([]).classification, 'UNVERIFIED');
});

test('Worker route candidates are listed but not automatically called collisions', () => {
  assert.deepEqual(routeSummary([
    { pattern: 'realsyncdynamicsai.de/*', script: 'some-worker' },
    { pattern: 'other.example/*', script: 'other' },
  ]), [{ pattern: 'realsyncdynamicsai.de/*', script: 'some-worker' }]);
});

test('collector only performs GETs, does not expose bearer token, and stays unapproved', async () => {
  const requested = [];
  const secret = 'secret-do-not-log';
  const fetchImpl = async (input, opts) => {
    const url = new URL(input);
    requested.push({ path: url.pathname, method: opts.method, host: url.host });
    const data = url.pathname.endsWith('/domains')
      ? [{ name: DOMAIN, status: 'active' }, { name: 'www.' + DOMAIN, status: 'active' }]
      : url.pathname.endsWith('/dns_records')
        ? [{ name: url.searchParams.get('name'), type: 'CNAME', content: 'realsyncdynamics-ai.pages.dev', proxied: true }]
        : url.pathname.endsWith('/workers/routes')
          ? []
          : url.pathname.endsWith('/pages/projects/' + PROJECT)
            ? project
            : [{ name: DOMAIN, id: 'zone123', status: 'active' }];
    return new Response(JSON.stringify({ success: true, result: data }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };
  const report = await collectEvidence({ accountId: 'a'.repeat(32), token: secret, fetchImpl });
  assert.equal(requested.length, 7);
  assert.equal(requested.every((r) => r.method === 'GET' && r.host === 'api.cloudflare.com'), true);
  assert.equal(report.project.production_candidate, true);
  assert.equal(report.domains.every((d) => d.present), true);
  assert.equal(report.voice_dns.host, 'voice.' + DOMAIN);
  assert.equal(report.voice_dns.classification, 'CLOUDFLARE_PROXY_CANDIDATE');
  assert.equal(report.assessment, 'NOT_PRODUCTION_APPROVED');
  assert.equal(report.missing.includes('HTTP_GET_HEAD_AND_API_ROUTES_NOT_CHECKED'), true);
  assert.equal(JSON.stringify(report).includes(secret), false);
});

test('missing Cloudflare credentials fail before any request', async () => {
  let invoked = false;
  await assert.rejects(() => collectEvidence({
    accountId: 'invalid', token: '', fetchImpl: async () => { invoked = true; },
  }), /MISSING_OR_INVALID/);
  assert.equal(invoked, false);
});

test('lack of DNS permission is reported as an evidence gap, not as DNS failure', async () => {
  const fetchImpl = async (input) => {
    const url = new URL(input);
    if (url.pathname.endsWith('/dns_records')) return new Response('{}', { status: 403 });
    const data = url.pathname.endsWith('/domains') ? [{ name: DOMAIN, status: 'active' }, { name: 'www.' + DOMAIN, status: 'active' }]
      : url.pathname.endsWith('/workers/routes') ? []
      : url.pathname.endsWith('/pages/projects/' + PROJECT) ? project
      : [{ name: DOMAIN, id: 'zone123', status: 'active' }];
    return new Response(JSON.stringify({ success: true, result: data }), { status: 200 });
  };
  const result = await collectEvidence({ accountId: 'a'.repeat(32), token: 'test-token', fetchImpl });
  assert.ok(result.missing.includes('DNS_READ_UNAVAILABLE:' + DOMAIN));
  assert.ok(result.missing.includes('DNS_READ_UNAVAILABLE:www.' + DOMAIN));
  assert.equal(result.assessment, 'NOT_PRODUCTION_APPROVED');
});
