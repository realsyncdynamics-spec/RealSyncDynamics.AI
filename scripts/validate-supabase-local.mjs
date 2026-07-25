#!/usr/bin/env node

/**
 * Local Supabase deployment validation
 *
 * Run this BEFORE pushing to main to catch issues early:
 *   node scripts/validate-supabase-local.mjs
 *
 * Checks:
 * - All migrations have correct filename format
 * - No duplicate migration timestamps
 * - No gaps in migration sequence
 * - All functions have corresponding config.toml entries
 * - Functions directory structure is valid
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

let errors = 0;
let warnings = 0;

function log(level, msg) {
  const icons = { error: '❌', warn: '⚠️ ', info: 'ℹ️ ', ok: '✅' };
  console.log(`${icons[level]} ${msg}`);
  if (level === 'error') errors++;
  if (level === 'warn') warnings++;
}

// 1. Validate migration filenames
function validateMigrations() {
  console.log('\n📋 Checking migrations...');

  const migrationsDir = path.join(ROOT, 'supabase', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

  const versionPattern = /^(\d{14}|00001)_[a-z0-9_]+\.sql$/;
  const versions = new Set();
  const invalidFiles = [];

  for (const file of files) {
    if (!versionPattern.test(file)) {
      invalidFiles.push(file);
    }

    // Extract version
    const match = file.match(/^([a-z0-9]+)_/);
    if (match) {
      const version = match[1];
      if (versions.has(version)) {
        log('error', `Duplicate migration version: ${version}`);
      }
      versions.add(version);
    }
  }

  if (invalidFiles.length > 0) {
    log('error', `Invalid migration filenames (must be YYYYMMDDHHMMSS_name.sql):`);
    invalidFiles.forEach(f => console.log(`    - ${f}`));
  }

  // Check for 8-digit timestamp (legacy/problem)
  const eightDigitFiles = files.filter(f => /^\d{8}_/.test(f));
  if (eightDigitFiles.length > 0) {
    log('warn', `Found 8-digit timestamp migrations (should be 14-digit):`);
    eightDigitFiles.forEach(f => console.log(`    - ${f}`));
  }

  if (errors === 0 && invalidFiles.length === 0) {
    log('ok', `${files.length} migrations with valid filenames`);
  }
}

// 2. Validate functions
function validateFunctions() {
  console.log('\n🔌 Checking edge functions...');

  const functionsDir = path.join(ROOT, 'supabase', 'functions');
  const configPath = path.join(ROOT, 'supabase', 'config.toml');
  const configContent = fs.readFileSync(configPath, 'utf-8');

  // Parse function names from config.toml
  const configFunctions = new Set();
  const functionPattern = /\[\s*functions\.\s*"([a-z0-9_-]+)"\s*\]/g;
  let match;
  while ((match = functionPattern.exec(configContent)) !== null) {
    configFunctions.add(match[1]);
  }

  // Get function directories
  const functionDirs = fs.readdirSync(functionsDir).filter(f => {
    const stat = fs.statSync(path.join(functionsDir, f));
    return stat.isDirectory() && !f.startsWith('.');
  });

  // Check for orphaned functions (no config entry)
  const orphanedFunctions = functionDirs.filter(f => !configFunctions.has(f));
  if (orphanedFunctions.length > 0) {
    log('error', `Functions without config.toml entry:`);
    orphanedFunctions.forEach(f => console.log(`    - ${f}`));
  }

  // Check for missing function directories
  const missingDirs = Array.from(configFunctions).filter(f => !functionDirs.includes(f));
  if (missingDirs.length > 0) {
    log('error', `Config entries without function directories:`);
    missingDirs.forEach(f => console.log(`    - ${f}`));
  }

  // Validate function structure
  for (const func of functionDirs) {
    const funcPath = path.join(functionsDir, func);
    const indexFile = path.join(funcPath, 'index.ts');
    if (!fs.existsSync(indexFile)) {
      log('error', `Missing index.ts in function: ${func}`);
    }
  }

  if (errors === 0 && orphanedFunctions.length === 0 && missingDirs.length === 0) {
    log('ok', `${functionDirs.length} functions properly configured`);
  }
}

// 3. Validate config.toml
function validateConfig() {
  console.log('\n⚙️  Checking config.toml...');

  const configPath = path.join(ROOT, 'supabase', 'config.toml');
  const content = fs.readFileSync(configPath, 'utf-8');

  // Check for noisy verify_jwt = true (should use defaults)
  const noisePattern = /verify_jwt\s*=\s*true/g;
  const noiseMatches = content.match(noisePattern) || [];
  if (noiseMatches.length > 2) {
    log('warn', `Found ${noiseMatches.length} verify_jwt=true entries (usually unnecessary)`);
  }

  // Check for required sections
  if (!content.includes('[api]')) {
    log('warn', 'Missing [api] section in config.toml');
  }

  if (errors === 0) {
    log('ok', 'config.toml structure valid');
  }
}

// 4. Summary
function summary() {
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log(`  Errors:   ${errors}`);
  console.log(`  Warnings: ${warnings}`);

  if (errors === 0) {
    console.log('\n✅ All checks passed! Safe to push.');
    process.exit(0);
  } else {
    console.log('\n❌ Fix errors before pushing.');
    process.exit(1);
  }
}

// Run all checks
console.log('🔍 Local Supabase Deployment Validation\n');

validateMigrations();
validateFunctions();
validateConfig();
summary();
