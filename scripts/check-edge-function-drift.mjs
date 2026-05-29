#!/usr/bin/env node
// Edge-Function-Drift-Guard.
//
// Verhindert die Wiederholung des Vorfalls vom 2026-05-28
// (docs/runtime/SYSTEMCHECK-2026-05-28.md): manuell deployte Edge Functions,
// die NICHT im Repo liegen und mit verify_jwt=false offen im Netz standen
// (u. a. vault-key-setter, das einen Master-Token im Klartext auslieferte).
//
// Prueft zwei Dinge:
//   1) Repo-seitig (immer): jede in supabase/config.toml als verify_jwt=false
//      deklarierte Funktion muss als Verzeichnis supabase/functions/<slug>
//      existieren (faengt veraltete/vertippte Config-Eintraege ab).
//   2) Prod-seitig (nur mit SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_ID):
//      Liste der live deployten Functions via Management-API ziehen und gegen
//      das Repo diffen:
//        - ORPHAN: deployt, aber kein Repo-Verzeichnis  → FEHLER
//          (Ausnahme: in scripts/edge-function-drift-allowlist.json gelistet =
//           bekannter Altbestand, der noch aufgeraeumt werden muss → WARNUNG)
//        - UNDECLARED_NO_JWT: live verify_jwt=false, im Repo vorhanden, aber in
//          config.toml NICHT als verify_jwt=false deklariert → FEHLER
//
// Ohne Token laeuft nur Check (1); der Prod-Teil wird sauber uebersprungen
// (Exit 0), damit Forks/PRs ohne Secrets nicht rot werden.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FUNCTIONS_DIR = join(ROOT, 'supabase', 'functions');
const CONFIG_TOML = join(ROOT, 'supabase', 'config.toml');
const ALLOWLIST = join(ROOT, 'scripts', 'edge-function-drift-allowlist.json');

const errors = [];
const warnings = [];

// --- Repo-Funktionen (Verzeichnisse mit index.ts, ohne _shared) -------------
function repoFunctions() {
  if (!existsSync(FUNCTIONS_DIR)) return new Set();
  return new Set(
    readdirSync(FUNCTIONS_DIR).filter((name) => {
      if (name.startsWith('_')) return false;
      const p = join(FUNCTIONS_DIR, name);
      return statSync(p).isDirectory() && existsSync(join(p, 'index.ts'));
    }),
  );
}

// --- config.toml: welche Slugs sind verify_jwt=false deklariert? ------------
function declaredNoJwt() {
  const out = new Set();
  if (!existsSync(CONFIG_TOML)) return out;
  const lines = readFileSync(CONFIG_TOML, 'utf8').split('\n');
  let current = null;
  for (const raw of lines) {
    const line = raw.trim();
    const header = line.match(/^\[functions\.([A-Za-z0-9_-]+)\]/);
    if (header) { current = header[1]; continue; }
    if (line.startsWith('[')) { current = null; continue; }
    if (current && /^verify_jwt\s*=\s*false\b/.test(line)) out.add(current);
  }
  return out;
}

function loadAllowlist() {
  if (!existsSync(ALLOWLIST)) return new Set();
  try {
    const json = JSON.parse(readFileSync(ALLOWLIST, 'utf8'));
    return new Set(json.allow ?? []);
  } catch (e) {
    errors.push(`Allowlist nicht lesbar (${ALLOWLIST}): ${e.message}`);
    return new Set();
  }
}

async function deployedFunctions() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_ID;
  if (!token || !ref) return null; // Prod-Check uebersprungen
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/functions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    errors.push(`Management-API ${res.status}: ${await res.text()}`);
    return null;
  }
  return await res.json(); // [{ slug, verify_jwt, ... }]
}

// --- Main -------------------------------------------------------------------
const repo = repoFunctions();
const declaredOff = declaredNoJwt();
const allow = loadAllowlist();

// Check (1): config.toml verify_jwt=false → Repo-Verzeichnis muss existieren.
// Bekannter Altbestand (Allowlist) → nur Warnung, sonst Fehler.
for (const slug of declaredOff) {
  if (!repo.has(slug)) {
    const msg = `config.toml deklariert [functions.${slug}] verify_jwt=false, aber supabase/functions/${slug}/ fehlt.`;
    if (allow.has(slug)) warnings.push(`${msg} (allowlisted — Config-Eintrag bereinigen, wenn die Funktion geloescht wird)`);
    else errors.push(msg);
  }
}

// Check (2): Prod-Drift
const deployed = await deployedFunctions();
if (deployed === null) {
  console.log('ℹ️  Prod-Drift-Check uebersprungen (kein SUPABASE_ACCESS_TOKEN/PROJECT_ID).');
} else {
  for (const fn of deployed) {
    const slug = fn.slug ?? fn.name;
    const inRepo = repo.has(slug);
    if (!inRepo) {
      if (allow.has(slug)) {
        warnings.push(`ORPHAN (allowlisted, bitte aufraeumen): "${slug}" ist live, aber nicht im Repo.`);
      } else {
        errors.push(`ORPHAN: "${slug}" ist live deployt, aber NICHT im Repo und NICHT allowlisted. ` +
          `Quelle ins Repo committen oder loeschen: supabase functions delete ${slug}.`);
      }
    } else if (fn.verify_jwt === false && !declaredOff.has(slug)) {
      errors.push(`UNDECLARED_NO_JWT: "${slug}" laeuft live mit verify_jwt=false, ` +
        `ist aber in config.toml nicht so deklariert. Eintrag ergaenzen oder Funktion absichern.`);
    }
  }
  console.log(`✓ ${deployed.length} live Functions geprueft, ${repo.size} im Repo, ${allow.size} allowlisted.`);
}

for (const w of warnings) console.warn(`⚠️  ${w}`);
if (errors.length) {
  console.error('\n❌ Edge-Function-Drift-Guard FEHLER:');
  for (const e of errors) console.error(`   - ${e}`);
  process.exit(1);
}
console.log('✅ Kein blockierender Edge-Function-Drift.');
