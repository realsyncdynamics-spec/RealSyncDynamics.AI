#!/usr/bin/env node
// Pre-deploy lint — pure-Node deploy-infra validator.
//
// Runs in CI on PRs that touch deploy infrastructure. Catches the
// silent-regression classes that bit us historically:
//
//   1. dead `[functions.X]` config entries (function deleted but
//      the verify_jwt=false stanza forgotten — see PR #250 cleanup)
//   2. live function with NO per-function config entry, so its
//      verify_jwt default cannot be confirmed at deploy time
//   3. migration timestamps non-monotonic (a developer-branch
//      migration leaking back into main with an earlier stamp)
//   4. migration filenames not matching the YYYYMMDDHHMMSS_*.sql
//      convention (deploy.yml's order depends on sort)
//   5. `verify_jwt = true` re-asserted explicitly for a function
//      that's in the default-true set (noise; doesn't fail, warns)
//   6. agent contracts under src/runtime/agents/ that fail the
//      spec validator (when ajv is available — soft check)
//
// Exits 0 = clean, 1 = errors found, 2 = misconfiguration.
//
// Usage:
//   node scripts/pre-deploy-lint.mjs              # full suite
//   node scripts/pre-deploy-lint.mjs --json       # JSON output
//   node scripts/pre-deploy-lint.mjs --warn-only  # downgrade errors to warnings

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __root = join(dirname(fileURLToPath(import.meta.url)), '..');
const JSON_OUT  = process.argv.includes('--json');
const WARN_ONLY = process.argv.includes('--warn-only');

// ── Issue accumulator ─────────────────────────────────────────────

const issues = [];
const push = (severity, check, message, file = null) =>
  issues.push({ severity, check, message, file });

// ── 1+2+2b. Cross-check supabase/config.toml ↔ supabase/functions/ ─

function lintFunctionsConfig() {
  const configPath = join(__root, 'supabase/config.toml');
  if (!existsSync(configPath)) {
    push('error', 'config-toml', 'supabase/config.toml not found');
    return;
  }
  const toml = readFileSync(configPath, 'utf8');

  // Parse minimal: find every [functions.NAME] section and its body
  // until the next [section] header.
  const sections = [];
  const sectionRx = /^\[functions\.([a-z][a-z0-9_-]*)\]\s*$/gm;
  let match;
  while ((match = sectionRx.exec(toml)) !== null) {
    const name = match[1];
    const start = match.index + match[0].length;
    sectionRx.lastIndex = start;
    const nextHeaderIdx = toml.slice(start).search(/^\[/m);
    const body = nextHeaderIdx === -1 ? toml.slice(start) : toml.slice(start, start + nextHeaderIdx);
    sections.push({ name, body });
  }

  const declared = new Map();
  for (const s of sections) {
    const vjmatch = /verify_jwt\s*=\s*(true|false)/.exec(s.body);
    declared.set(s.name, {
      verify_jwt: vjmatch ? vjmatch[1] === 'true' : 'unset',
    });
  }

  const fnDir = join(__root, 'supabase/functions');
  if (!existsSync(fnDir)) {
    push('error', 'config-toml', 'supabase/functions/ not found');
    return;
  }
  const onDisk = readdirSync(fnDir)
    .filter(entry => {
      const full = join(fnDir, entry);
      if (!statSync(full).isDirectory()) return false;
      if (entry.startsWith('_')) return false;        // _shared
      return existsSync(join(full, 'index.ts'));
    });

  // Distinguish two failure shapes:
  //   a) NO function on disk + NO client refs = truly dead, ERROR
  //   b) NO function on disk + client refs    = missing-impl, WARN
  //      (something WILL break at runtime; but it's a real
  //       implementation gap, not a config-only cleanup)
  const srcRoot = join(__root, 'src');
  for (const [name] of declared) {
    if (onDisk.includes(name)) continue;
    const refs = referencesToFunction(srcRoot, name);
    if (refs.length === 0) {
      push('error', 'dead-config-entry',
        `[functions.${name}] in config.toml — no function on disk, no client references. Remove the stanza.`,
        'supabase/config.toml');
    } else {
      push('warn', 'missing-impl',
        `[functions.${name}] in config.toml — no function on disk but ${refs.length} client reference(s) found. Either implement or remove BOTH the config entry AND the client calls.`,
        'supabase/config.toml');
    }
  }

  // Check: live function with NO config entry.
  //
  // For MOST functions, missing config = default verify_jwt=true =
  // safe (info-only).
  //
  // For KNOWN-PUBLIC functions (webhooks, public free tools, the AI
  // gateway), missing config is a CRITICAL silent regression — the
  // function would re-default to JWT-gated auth, breaking webhook
  // receivers and public tools. Codex flagged this exact case in the
  // #301 review. Maintain REQUIRED_PUBLIC_FUNCTIONS alongside the
  // [functions.X] verify_jwt=false declarations in supabase/config.toml.
  for (const name of onDisk) {
    if (declared.has(name)) continue;
    if (REQUIRED_PUBLIC_FUNCTIONS.has(name)) {
      push('error', 'missing-required-public-config',
        `supabase/functions/${name}/ exists but [functions.${name}] is missing from config.toml — this function MUST have verify_jwt=false (webhook / public free tool / AI gateway / cron); without the stanza Supabase defaults to verify_jwt=true and external callers will be locked out.`,
        'supabase/config.toml');
    } else {
      push('info', 'no-config-entry',
        `supabase/functions/${name}/ has no per-function config entry (default verify_jwt=true assumed)`);
    }
  }
}

// Functions that MUST have `verify_jwt = false` in config.toml.
// Deleting the stanza of any of these — while the function dir
// remains on disk — silently breaks the function: Supabase would
// re-default to JWT-gated auth and external callers (Stripe,
// Shopify, browser anon) would be locked out.
//
// Keep this set in sync with the [functions.X] verify_jwt=false
// declarations in supabase/config.toml.
const REQUIRED_PUBLIC_FUNCTIONS = new Set([
  // External webhooks (no JWT possible).
  'stripe-webhook',
  'shopify-webhooks',
  'shopify-callback',
  'workflow-callback',
  'governance-ingest',
  'governance-webhooks',
  'newsletter-confirm',
  'checkout-website-rebuild',

  // Public free-tool surfaces (anonymous ingress).
  'gdpr-audit',
  'cookie-scan',
  'cookie-scan-deep',
  'audit-report-pdf',
  'sales-lead',
  'newsletter-subscribe',
  'track-pageview',
  'marketing-event',
  'telemetry-ai-event',
  'welcome-email',
  'shopify-install',
  'rebuild-website',
  'market-scanner',
  'ai-act-classify',

  // AI gateway — browser calls it directly with bundled anon key.
  'ai-gateway',

  // Cron-triggered (GitHub Actions / pg_cron call anonymously).
  'daily-digest',
  'audit-drip-cron',
  'audit-monitor-cron',
  'audit-recheck-weekly',
  'agent-os-runner',

  // Enterprise AI OS public surfaces.
  'enterprise-ai-os-discovery-intake',
  'enterprise-ai-os-discovery-pending',
  'enterprise-ai-os-agents-list',
  'enterprise-ai-os-agents-run',
  'enterprise-ai-os-evaluate',
  'enterprise-ai-os-feedback',
  'enterprise-ai-os-founding-access',
  'enterprise-ai-os-agent-runs-list',

  // Governance public surfaces.
  'governance-keys',
  'governance-resources',
  'governance-approvals',
  'governance-risk-score',
  'governance-dpias',

  // Telegram webhook — called by Telegram's servers without JWT.
  'telegram-webhook',
]);

// Walk src/ shallowly for grep-style references to "functions/v1/NAME"
// or `invoke('NAME'`. Avoids actually executing TS — pure string scan.
function referencesToFunction(srcRoot, name) {
  if (!existsSync(srcRoot)) return [];
  const haystack = [];
  walk(srcRoot, (full) => {
    if (!/\.(ts|tsx|js|jsx|mjs)$/.test(full)) return;
    haystack.push(full);
  });
  const patterns = [
    new RegExp(`functions/v1/${escapeForRx(name)}\\b`),
    new RegExp(`invoke\\(['"]${escapeForRx(name)}['"]`),
  ];
  const hits = [];
  for (const file of haystack) {
    const content = safeRead(file);
    if (!content) continue;
    if (patterns.some(rx => rx.test(content))) hits.push(file);
  }
  return hits;
}

function walk(dir, visit) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let s;
    try { s = statSync(full); } catch { continue; }
    if (s.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
      walk(full, visit);
    } else {
      visit(full);
    }
  }
}

function safeRead(path) {
  try { return readFileSync(path, 'utf8'); }
  catch { return null; }
}

function escapeForRx(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── 3+4. Migration filename + ordering ────────────────────────────
//
// Filenames historically use HH=24/26/30 as a sort-index hack to wedge
// new migrations between existing ones without renaming. Since
// `supabase db push` sorts the filename string lexicographically,
// any 14-digit sequence works — we DON'T parse the timestamp as a
// real Date. We only enforce:
//   - filename is 14 digits + underscore + snake_case + .sql, OR
//     listed in LEGACY_FILENAME_ALLOWLIST (bootstrap files that
//     existed before this convention)
//   - lexicographic sort is strictly monotonic across siblings.

const LEGACY_FILENAME_ALLOWLIST = new Set([
  // Bootstrap files predating the YYYYMMDDHHMMSS convention.
  '00001_initial_schema.sql',
  '20260510_ai_governance_core.sql',
]);

// Migrations that knowingly share a timestamp with a predecessor. These
// duplicate 20260624000000 stamps were deliberately re-introduced (hotfix
// f7e8164) because the migrations were already applied; renaming them would
// desync the Supabase migration history. They are functionally independent
// (no inter-dependency on apply order), so the order check downgrades them
// from error to info instead of blocking deploys.
const DUPLICATE_STAMP_ALLOWLIST = new Set([
  '20260624000000_automation_skills_runs.sql',
  '20260624000000_governance_os_runtime.sql',
  '20260624000000_stripe_live_price_ids.sql',
]);

function lintMigrations() {
  const migDir = join(__root, 'supabase/migrations');
  if (!existsSync(migDir)) {
    push('error', 'migrations', 'supabase/migrations/ not found');
    return;
  }
  const files = readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();

  const RX = /^(\d{14})_[a-z0-9_]+\.sql$/;
  const stamps = [];

  for (const f of files) {
    if (LEGACY_FILENAME_ALLOWLIST.has(f)) {
      push('info', 'migration-name-legacy',
        `${f} is on the legacy-filename allowlist; new migrations must use YYYYMMDDHHMMSS_<snake_case>.sql`);
      continue;
    }
    const m = RX.exec(f);
    if (!m) {
      push('error', 'migration-name',
        `migration filename does not match YYYYMMDDHHMMSS_<snake_case>.sql`,
        `supabase/migrations/${f}`);
      continue;
    }
    stamps.push({ stamp: m[1], file: f });
  }

  // Sequential monotonic check (stamps must be strictly increasing)
  for (let i = 1; i < stamps.length; i++) {
    const a = stamps[i - 1];
    const b = stamps[i];
    if (b.stamp <= a.stamp) {
      const severity = DUPLICATE_STAMP_ALLOWLIST.has(b.file) ? 'info' : 'error';
      push(severity, 'migration-order',
        `migration ${b.file} stamp ${b.stamp} is not strictly greater than predecessor ${a.file} (${a.stamp})`
        + (severity === 'info' ? ' — allowlisted known duplicate' : ''),
        `supabase/migrations/${b.file}`);
    }
  }
}

// ── 5. Noisy `verify_jwt = true` (the default already) ────────────

function lintNoisyVerifyJwtTrue() {
  // Soft check: re-stating the default is harmless but adds noise.
  // We surface as info — won't fail CI.
  const configPath = join(__root, 'supabase/config.toml');
  if (!existsSync(configPath)) return;
  const toml = readFileSync(configPath, 'utf8');
  const noisyRx = /\[functions\.([a-z][a-z0-9_-]*)\][^\[]*verify_jwt\s*=\s*true/g;
  let m;
  while ((m = noisyRx.exec(toml)) !== null) {
    push('info', 'noisy-verify-jwt-true',
      `[functions.${m[1]}] explicitly sets verify_jwt=true — this is the default, the entry is no-op noise`,
      'supabase/config.toml');
  }
}

// ── 6. Agent contracts (soft — only if validator + ajv present) ───

async function lintAgentContracts() {
  const agentDir = join(__root, 'src/runtime/agents');
  if (!existsSync(agentDir)) return;          // no agents yet — fine
  const validatorPath = join(__root, 'src/runtime/validator.ts');
  if (!existsSync(validatorPath)) return;     // PR #295 not merged yet — skip

  // We CANNOT dynamic-import the .ts validator from .mjs without tsx.
  // Defer the actual schema validation to a follow-up workflow step
  // that uses `npx tsx scripts/validate-agent-manifest.mjs --all`.
  // Here we just enforce naming + existence.
  const files = readdirSync(agentDir).filter(f => /\.contract\.(ts|js|json)$/.test(f));
  for (const f of files) {
    if (!/^[a-z][a-z0-9-]+\.contract\.(ts|js|json)$/.test(f)) {
      push('warn', 'agent-naming',
        `agent contract filename should be kebab-case: ${f}`,
        `src/runtime/agents/${f}`);
    }
  }
  if (files.length === 0) {
    push('info', 'no-agent-contracts',
      'src/runtime/agents/ exists but contains no *.contract.* files');
  }
}

// ── Run ────────────────────────────────────────────────────────────

await Promise.resolve(lintFunctionsConfig());
await Promise.resolve(lintMigrations());
await Promise.resolve(lintNoisyVerifyJwtTrue());
await lintAgentContracts();

// ── Output ─────────────────────────────────────────────────────────

if (JSON_OUT) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    issues,
    summary: {
      total: issues.length,
      errors:   issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warn').length,
      info:     issues.filter(i => i.severity === 'info').length,
    },
  }, null, 2));
} else {
  if (issues.length === 0) {
    console.log('✓ pre-deploy-lint: clean');
  } else {
    const errs  = issues.filter(i => i.severity === 'error');
    const warns = issues.filter(i => i.severity === 'warn');
    const info  = issues.filter(i => i.severity === 'info');
    console.log(`\npre-deploy-lint: ${errs.length} errors · ${warns.length} warnings · ${info.length} info\n`);
    for (const i of errs)  console.log(`✗ [${i.check}] ${i.file ? i.file + ': ' : ''}${i.message}`);
    for (const i of warns) console.log(`⚠ [${i.check}] ${i.file ? i.file + ': ' : ''}${i.message}`);
    for (const i of info)  console.log(`· [${i.check}] ${i.file ? i.file + ': ' : ''}${i.message}`);
  }
}

const errorCount = issues.filter(i => i.severity === 'error').length;
const exitCode = errorCount > 0 && !WARN_ONLY ? 1 : 0;
process.exit(exitCode);
