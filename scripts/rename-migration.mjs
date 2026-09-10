#!/usr/bin/env node
/**
 * Hebt den Timestamp einer neuen Migration an, ohne den Inhalt zu ändern.
 *
 *   npm run migrate:rename -- supabase/migrations/20260501120000_foo.sql
 */

import { existsSync, renameSync } from 'node:fs';
import path from 'node:path';

const input = process.argv[2];
if (!input) {
  console.error('Usage: npm run migrate:rename -- supabase/migrations/<file>.sql');
  process.exit(1);
}

const abs = path.resolve(input);
if (!existsSync(abs)) {
  console.error(`Datei fehlt: ${input}`);
  process.exit(1);
}

const base = path.basename(abs);
const match = base.match(/^\d{14}_(.+)$/);
if (!match) {
  console.error(`Kein Migrations-Filename: ${base}`);
  process.exit(1);
}

const stamp = new Date()
  .toISOString()
  .replace(/[-:TZ.]/g, '')
  .slice(0, 14);
const dest = path.join(path.dirname(abs), `${stamp}_${match[1]}`);
if (existsSync(dest)) {
  console.error(`Ziel existiert schon: ${dest}`);
  process.exit(1);
}

renameSync(abs, dest);
console.log(`${base} → ${path.basename(dest)}`);
console.log('Als Rename committen, danach supabase db reset bzw. CI-Job db.');
