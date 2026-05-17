#!/usr/bin/env node
// Validate an agent manifest against the runtime spec suite.
//
// Usage:
//   node scripts/validate-agent-manifest.mjs <path-to-manifest.json>
//   node scripts/validate-agent-manifest.mjs <path-to-manifest.ts>  (compiled via tsx if needed)
//   node scripts/validate-agent-manifest.mjs --all
//     → validates every agent contract under src/runtime/agents/*.contract.{ts,js,json}
//
// Exits 0 on success, 1 on any validation error.

import { readFileSync, existsSync } from 'fs';
import { resolve, basename } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Use tsx to import the validator (TS) from a .mjs script.
const VALIDATOR_URL = pathToFileURL(resolve(fileURLToPath(import.meta.url), '../../src/runtime/validator.ts'));

async function loadValidator() {
  // Spawn a tsx child since plain Node cannot import .ts files.
  // We import via dynamic loader if tsx is the runner; otherwise re-exec.
  try {
    return await import(VALIDATOR_URL.href);
  } catch {
    console.error('This script must be invoked under tsx, e.g.:');
    console.error('  npx tsx scripts/validate-agent-manifest.mjs <path>');
    process.exit(2);
  }
}

async function loadManifest(path) {
  const abs = resolve(path);
  if (!existsSync(abs)) throw new Error(`no such file: ${abs}`);
  if (abs.endsWith('.json')) {
    return JSON.parse(readFileSync(abs, 'utf8'));
  }
  // .ts / .js / .mjs — let dynamic import handle it
  const mod = await import(pathToFileURL(abs).href);
  // Heuristic: take the default export, or the first exported object.
  const candidate =
    mod.default ??
    Object.values(mod).find(v => v && typeof v === 'object' && 'agent' in v);
  if (!candidate) throw new Error(`no manifest exported from ${path}`);
  return candidate;
}

function printResult(name, result) {
  if (result.valid) {
    console.log(`✓ ${name}: valid`);
    return true;
  }
  console.log(`✗ ${name}: ${result.errors.length} error(s)`);
  for (const e of result.errors) {
    console.log(`    ${e.path || '/'}: ${e.message} [${e.keyword}]`);
  }
  return false;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('Usage: validate-agent-manifest.mjs <path> [<path> ...]');
    console.log('       validate-agent-manifest.mjs --all');
    process.exit(args.length === 0 ? 1 : 0);
  }

  const { validateAgentContractFull } = await loadValidator();

  let allPaths = args;
  if (args.includes('--all')) {
    // Glob src/runtime/agents/*.contract.{ts,js,json}
    const { globSync } = await import('glob').catch(() => ({ globSync: null }));
    if (!globSync) {
      console.error('--all requires glob: npm install --save-dev glob');
      process.exit(2);
    }
    allPaths = globSync('src/runtime/agents/*.contract.{ts,js,json}');
    if (allPaths.length === 0) {
      console.error('--all: no matches under src/runtime/agents/');
      process.exit(1);
    }
  }

  let allOk = true;
  for (const path of allPaths) {
    try {
      const manifest = await loadManifest(path);
      const result = validateAgentContractFull(manifest);
      const ok = printResult(basename(path), result);
      if (!ok) allOk = false;
    } catch (err) {
      console.log(`✗ ${basename(path)}: load failed — ${err.message}`);
      allOk = false;
    }
  }

  process.exit(allOk ? 0 : 1);
}

main();
