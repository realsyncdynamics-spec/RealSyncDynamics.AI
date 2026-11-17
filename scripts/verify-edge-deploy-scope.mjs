#!/usr/bin/env node
/** Fail closed when CI tries to create an unreviewed Edge Function. */
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function partitionByDeployment(requested, deployedRows) {
  if (!Array.isArray(requested) || !Array.isArray(deployedRows)) {
    throw new Error('Deploy scope and Management API result must be arrays.');
  }
  const deployed = new Set();
  for (const row of deployedRows) {
    const slug = row && (row.slug ?? row.name);
    if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/.test(slug)) {
      throw new Error('Management API returned an invalid function slug.');
    }
    deployed.add(slug);
  }
  const ready = [];
  const missing = [];
  for (const slug of new Set(requested)) {
    if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/.test(slug)) {
      throw new Error('Deploy scope contains an invalid function slug.');
    }
    (deployed.has(slug) ? ready : missing).push(slug);
  }
  return { ready, missing };
}

function summary(line) {
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + '\n');
  }
}

async function main() {
  const requested = process.argv.slice(2);
  if (!requested.length) return;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const project = process.env.SUPABASE_PROJECT_ID;
  if (!token || !project) {
    throw new Error('SUPABASE_ACCESS_TOKEN/PROJECT_ID missing: cannot verify live deploy scope.');
  }
  const url = 'https://api.supabase.com/v1/projects/' + encodeURIComponent(project) + '/functions';
  const response = await fetch(url, {
    headers: { Authorization: 'Bearer ' + token },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error('Management API returned HTTP ' + response.status + '; no deployment attempted.');
  }
  const remote = await response.json();
  const { ready, missing } = partitionByDeployment(requested, remote);
  console.log('Deploy preflight: ' + ready.length + ' existing; ' + missing.length + ' not deployed.');
  summary('### Edge Function deploy preflight');
  summary('- Already deployed and eligible for update: ' + ready.length);
  if (missing.length) {
    summary('- **Blocked new slugs (no creation attempted):** ' + missing.join(', '));
    summary('- Next step: review capacity and consolidate existing functions or approve capacity.');
    console.error('::error::New Edge Functions are NOT deployed: ' + missing.join(', ') + '. Project function.max_count was reached on 2026-11-16. Review capacity.');
    process.exitCode = 1;
  } else {
    summary('- No new slugs: proceeding with updates to existing Functions.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main().catch((error) => {
    console.error('::error::Edge deploy preflight failed closed: ' + error.message);
    summary('### Edge Function deploy preflight failed: live inventory unavailable');
    process.exitCode = 1;
  });
}
