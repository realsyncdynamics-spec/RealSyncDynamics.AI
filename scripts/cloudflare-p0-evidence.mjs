#!/usr/bin/env node
/**
 * P0-A: Read-only Cloudflare Pages production-evidence inventory.
 * No DNS changes, no deployments, no KV writes, no secrets/body dumping.
 * Usage: CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... node scripts/cloudflare-p0-evidence.mjs
 */
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const PROJECT = 'realsyncdynamics-ai';
export const DOMAIN = 'realsyncdynamicsai.de';
const API = 'https://api.cloudflare.com/client/v4';

export function deploymentSummary(deployment) {
  if (!deployment || typeof deployment !== 'object') return null;
  const meta = deployment.deployment_trigger?.metadata ?? {};
  let host = null;
  try {
    const url = new URL(deployment.url);
    if (url.protocol === 'https:' && url.hostname.endsWith('.pages.dev')) host = url.hostname;
  } catch { /* missing/invalid deployment URL */ }
  return {
    id: typeof deployment.id === 'string' ? deployment.id : null,
    environment: deployment.environment ?? null,
    branch: meta.branch ?? null,
    commit: meta.commit_hash ?? null,
    created_on: deployment.created_on ?? null,
    pages_dev_host: host,
  };
}

export function projectSummary(p) {
  const production_branch = p?.source?.config?.production_branch ?? p?.production_branch ?? null;
  const canonical = deploymentSummary(p?.canonical_deployment);
  const production_candidate =
    canonical?.environment === 'production' &&
    typeof production_branch === 'string' &&
    canonical.branch === production_branch &&
    typeof canonical.commit === 'string';
  return {
    name: p?.name ?? null,
    production_branch,
    canonical,
    production_candidate: Boolean(production_candidate),
    note: 'Canonical metadata alone does not establish a custom-domain production response',
  };
}

export function domainSummary(entries) {
  return [DOMAIN, 'www.' + DOMAIN].map((name) => {
    const found = Array.isArray(entries) ? entries.find((d) => d.name === name) : null;
    return { name, present: Boolean(found), status: found?.status ?? null };
  });
}

export function dnsSummary(entries, name) {
  return (Array.isArray(entries) ? entries : [])
    .filter((d) => d.name === name)
    .map((d) => ({
      name: d.name,
      type: d.type ?? null,
      target: typeof d.content === 'string' ? d.content.slice(0, 200) : null,
      proxied: d.proxied === true,
    }));
}

export function routeSummary(entries) {
  return (Array.isArray(entries) ? entries : [])
    .filter((r) => typeof r.pattern === 'string' && r.pattern.includes(DOMAIN))
    .map((r) => ({ pattern: r.pattern, script: r.script ?? null }));
}

async function cloudflareGet(path, token, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetchImpl(API + path, {
      method: 'GET',
      redirect: 'error',
      headers: { authorization: 'Bearer ' + token, accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('CF_HTTP_' + response.status);
    const parsed = await response.json();
    if (parsed?.success !== true) throw new Error('CF_API_UNSUCCESSFUL');
    return { result: parsed.result, result_info: parsed.result_info ?? null };
  } finally {
    clearTimeout(timeout);
  }
}

export async function collectEvidence({ accountId, token, fetchImpl = fetch }) {
  const missing = [];
  if (!/^[0-9a-f]{32}$/i.test(accountId ?? '') || !token) {
    throw new Error('MISSING_OR_INVALID_CLOUDFLARE_CREDENTIALS');
  }
  const get = (path) => cloudflareGet(path, token, fetchImpl);
  const report = {
    captured_at: new Date().toISOString(),
    source: 'Cloudflare API read-only',
    project: null,
    domains: null,
    zone: null,
    dns: {},
    worker_routes: null,
    missing,
    assessment: 'NOT_PRODUCTION_APPROVED',
  };
  const path = '/accounts/' + accountId + '/pages/projects/' + PROJECT;
  try {
    const data = await get(path);
    report.project = projectSummary(data.result);
    if (!report.project.production_candidate) missing.push('CANONICAL_PRODUCTION_DEPLOYMENT_UNVERIFIED');
  } catch {
    missing.push('PAGES_PROJECT_READ_UNAVAILABLE');
  }
  try {
    const data = await get(path + '/domains');
    report.domains = domainSummary(data.result);
    if (report.domains.some((d) => !d.present || d.status !== 'active')) {
      missing.push('CUSTOM_DOMAINS_NOT_BOTH_CONFIRMED_ACTIVE');
    }
  } catch {
    missing.push('PAGES_CUSTOM_DOMAIN_READ_UNAVAILABLE');
  }
  let zoneId = null;
  try {
    const data = await get('/zones?name=' + encodeURIComponent(DOMAIN));
    const zone = (Array.isArray(data.result) ? data.result : []).find((z) => z.name === DOMAIN);
    if (zone) {
      zoneId = zone.id;
      report.zone = { name: DOMAIN, status: zone.status ?? null };
      if (zone.status !== 'active') missing.push('ZONE_NOT_ACTIVE');
    } else missing.push('ZONE_NOT_FOUND');
  } catch {
    missing.push('ZONE_READ_UNAVAILABLE');
  }
  if (zoneId) {
    for (const name of [DOMAIN, 'www.' + DOMAIN]) {
      try {
        const data = await get('/zones/' + zoneId + '/dns_records?name=' + encodeURIComponent(name) + '&per_page=100');
        report.dns[name] = dnsSummary(data.result, name);
        if (!report.dns[name].length) missing.push('DNS_RECORD_NOT_FOUND:' + name);
        if (data.result_info && data.result_info.total_pages > 1) missing.push('DNS_PAGINATION_INCOMPLETE:' + name);
      } catch {
        missing.push('DNS_READ_UNAVAILABLE:' + name);
      }
    }
    try {
      const data = await get('/zones/' + zoneId + '/workers/routes?per_page=100');
      report.worker_routes = routeSummary(data.result);
      if (data.result_info && data.result_info.total_pages > 1) missing.push('WORKER_ROUTE_PAGINATION_INCOMPLETE');
    } catch {
      missing.push('WORKER_ROUTE_READ_UNAVAILABLE');
    }
  }
  missing.push('HTTP_GET_HEAD_AND_API_ROUTES_NOT_CHECKED');
  missing.push('VOICE_RELEASE_GATES_NOT_CHECKED');
  return report;
}

async function main() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) {
    console.error('Cloudflare Account ID / read-only API token missing. No requests sent.');
    process.exitCode = 2;
    return;
  }
  try {
    const evidence = await collectEvidence({ accountId, token });
    console.log(JSON.stringify(evidence, null, 2));
    // Always 0 for successful inventory collection: NOT a production go-live gate.
  } catch {
    console.error('Cloudflare P0 evidence collection failed; no credentials printed.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
