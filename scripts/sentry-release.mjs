#!/usr/bin/env node

/**
 * Sentry Release Management
 *
 * Creates a Sentry release and links commits/deployments.
 * Usage:
 *   node scripts/sentry-release.mjs create <version>
 *   node scripts/sentry-release.mjs finalize <version>
 *   node scripts/sentry-release.mjs list
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const SENTRY_ORG = process.env.SENTRY_ORG || 'realsyncdynamics';
const SENTRY_PROJECT = process.env.SENTRY_PROJECT || 'realsyncdynamics';
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;

if (!SENTRY_AUTH_TOKEN) {
  console.error('❌ SENTRY_AUTH_TOKEN environment variable not set');
  process.exit(1);
}

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' }).trim();
  } catch (err) {
    console.error(`❌ Command failed: ${cmd}`);
    console.error(err.message);
    process.exit(1);
  }
}

async function createRelease(version) {
  console.log(`\n📦 Creating Sentry release: ${version}`);

  // 1. Create release
  console.log('  → Creating release in Sentry...');
  run(`sentry-cli releases create "${version}" \
    --org "${SENTRY_ORG}" \
    --project "${SENTRY_PROJECT}" \
    --auth-token "${SENTRY_AUTH_TOKEN}"`);

  // 2. Set commits
  console.log('  → Linking commits...');
  run(`sentry-cli releases set-commits "${version}" \
    --auto \
    --org "${SENTRY_ORG}" \
    --project "${SENTRY_PROJECT}" \
    --auth-token "${SENTRY_AUTH_TOKEN}"`);

  // 3. Create deployment
  console.log('  → Recording deployment...');
  const environment = process.env.ENVIRONMENT || 'production';
  const timestamp = new Date().toISOString();

  run(`sentry-cli releases deploys "${version}" new \
    --env "${environment}" \
    --started "${timestamp}" \
    --org "${SENTRY_ORG}" \
    --project "${SENTRY_PROJECT}" \
    --auth-token "${SENTRY_AUTH_TOKEN}"`);

  console.log(`✅ Release ${version} created and committed`);
}

async function finalizeRelease(version) {
  console.log(`\n✔️  Finalizing Sentry release: ${version}`);

  // Mark deployment as complete
  run(`sentry-cli releases deploys "${version}" \
    --org "${SENTRY_ORG}" \
    --project "${SENTRY_PROJECT}" \
    --auth-token "${SENTRY_AUTH_TOKEN}"`);

  console.log(`✅ Release ${version} finalized`);
}

async function listReleases() {
  console.log(`\n📋 Sentry releases for ${SENTRY_ORG}/${SENTRY_PROJECT}:\n`);

  const output = run(`sentry-cli releases list \
    --org "${SENTRY_ORG}" \
    --project "${SENTRY_PROJECT}" \
    --auth-token "${SENTRY_AUTH_TOKEN}"`);

  console.log(output);
}

// Main
const command = process.argv[2];
const arg = process.argv[3];

try {
  switch (command) {
    case 'create':
      if (!arg) {
        console.error('Usage: node sentry-release.mjs create <version>');
        process.exit(1);
      }
      await createRelease(arg);
      break;

    case 'finalize':
      if (!arg) {
        console.error('Usage: node sentry-release.mjs finalize <version>');
        process.exit(1);
      }
      await finalizeRelease(arg);
      break;

    case 'list':
      await listReleases();
      break;

    default:
      console.error(`
Usage:
  node scripts/sentry-release.mjs create <version>   Create release
  node scripts/sentry-release.mjs finalize <version> Finalize deployment
  node scripts/sentry-release.mjs list                List releases

Environment Variables:
  SENTRY_AUTH_TOKEN  (required)
  SENTRY_ORG        (default: realsyncdynamics)
  SENTRY_PROJECT    (default: realsyncdynamics)
  ENVIRONMENT       (default: production)
`);
      process.exit(1);
  }
} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
}
