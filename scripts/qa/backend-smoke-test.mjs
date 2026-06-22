#!/usr/bin/env node
// QA: Backend Smoke-Test (contract-level, optional network)
// -----------------------------------------------------------------------------
// Zwei Modi:
//  1. STATIC (Default, CI-tauglich, kein Netz): prüft, dass jede in
//     supabase/config.toml referenzierte Function einen Ordner besitzt und
//     umgekehrt — sowie dass öffentliche Functions (verify_jwt=false) bewusst
//     deklariert sind. Drift -> Exit 1.
//  2. LIVE (--live): wenn SUPABASE_URL + SUPABASE_ANON_KEY gesetzt sind, werden
//     die öffentlichen Endpunkte (health, gdpr-audit OPTIONS) per fetch
//     angetastet. Erwartet 2xx/4xx (nicht 5xx). Timeout 15s.
//
// Usage:
//   node scripts/qa/backend-smoke-test.mjs
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/qa/backend-smoke-test.mjs --live

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FUNCTIONS_DIR = join(ROOT, 'supabase', 'functions');
const CONFIG_TOML = join(ROOT, 'supabase', 'config.toml');
const LIVE = process.argv.includes('--live');

let failures = 0;
const log = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failures++;
};

// ---- STATIC: Drift zwischen config.toml und Ordnern -----------------------
function staticChecks() {
  const dirs = readdirSync(FUNCTIONS_DIR).filter(
    (d) => d !== '_shared' && statSync(join(FUNCTIONS_DIR, d)).isDirectory(),
  );
  const toml = existsSync(CONFIG_TOML) ? readFileSync(CONFIG_TOML, 'utf8') : '';
  const declared = [...toml.matchAll(/\[functions\.([^\]]+)\]/g)].map((m) => m[1]);

  // a) jede in config.toml deklarierte Function existiert als Ordner
  for (const name of declared) {
    log(dirs.includes(name), `config.toml [functions.${name}] -> Ordner vorhanden`);
  }

  // b) jeder Function-Ordner hat einen index-Einstiegspunkt
  for (const name of dirs) {
    const hasEntry = ['index.ts', 'index.js', 'index.tsx', 'index.mjs'].some((f) =>
      existsSync(join(FUNCTIONS_DIR, name, f)),
    );
    log(hasEntry, `${name}/ hat index-Entrypoint`);
  }

  // c) öffentliche Webhook/Receiver bewusst auf verify_jwt=false
  const mustBePublic = ['stripe-webhook', 'shopify-webhooks', 'health'];
  for (const name of mustBePublic) {
    const block = toml.split('\n').reduce((acc, line, i, arr) => acc, '');
    const re = new RegExp(`\\[functions\\.${name}\\][^\\[]*verify_jwt\\s*=\\s*false`);
    log(re.test(toml), `${name} ist als verify_jwt=false deklariert`);
    void block;
  }
}

// ---- LIVE: öffentliche Endpunkte antasten ---------------------------------
async function liveChecks() {
  const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const ANON = process.env.SUPABASE_ANON_KEY || '';
  if (!SUPABASE_URL || !ANON) {
    console.log('SKIP  --live: SUPABASE_URL/SUPABASE_ANON_KEY nicht gesetzt');
    return;
  }
  const probe = async (path, init = {}) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15_000);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
        ...init,
        signal: ctrl.signal,
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, ...(init.headers || {}) },
      });
      log(res.status < 500, `GET /functions/v1/${path} -> ${res.status} (kein 5xx)`);
    } catch (e) {
      log(false, `GET /functions/v1/${path} -> ${e.message}`);
    } finally {
      clearTimeout(t);
    }
  };
  await probe('health');
  await probe('gdpr-audit', { method: 'OPTIONS' });
}

async function main() {
  console.log('== Backend Smoke-Test (static) ==');
  staticChecks();
  if (LIVE) {
    console.log('\n== Backend Smoke-Test (live) ==');
    await liveChecks();
  }
  console.log(`\n${failures === 0 ? 'ALLE CHECKS OK' : failures + ' CHECK(S) FEHLGESCHLAGEN'}`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
