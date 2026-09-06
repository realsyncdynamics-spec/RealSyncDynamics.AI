#!/usr/bin/env node
// Migrations-Kollisions-Guard.
//
// Verhindert die Wiederholung eines Musters, das in CLAUDE.md §5 zweimal
// dokumentiert ist und am 2026-09-06 in drei weiteren offenen PRs zugleich
// vorlag: Zwei Aenderungen sind je fuer sich richtig, kollidieren aber
// miteinander, sobald beide auf `main` liegen.
//
//   2026-08-24  PR #1131 und #1124 vergaben beide 20260826000000. Der Deploy
//               nach dem zweiten Merge scheiterte mit 42710.
//   2026-09-06  #1202 ↔ #1219 auf 20260905000000, #1121 ↔ #1214 auf
//               20260904000400, #1121 zusaetzlich gegen main auf 20260904000300.
//               Dazu #1202 ↔ #1207: platform_operators, agent_roles und agents
//               dreifach doppelt, mit unvereinbaren Spalten.
//
// WARUM DAS BISHER NIEMAND SAH — und warum dieser Guard anders laufen muss als
// die uebrigen: Jeder PR-Baum ist fuer sich widerspruchsfrei. Ein Test ueber
// `supabase/migrations/` des eigenen Baums (so wie test/db/migration-versions)
// findet die Doppelung nicht, weil sie dort nicht existiert. Sie entsteht erst
// im Merge. Auch GitHubs `mergeable_state` sieht sie nicht: Zwei Dateien mit
// verschiedenen Namen sind kein Textkonflikt. Deshalb prueft dieser Guard
// gegen ZWEI Referenzen ausserhalb des eigenen Baums — den aktuellen Stand der
// Basis und die uebrigen offenen PRs.
//
// Geprueft wird:
//   1) Eigener Baum: jede Version genau einmal.                 (immer)
//   2) Gegen die Basis: keine Version, die dort schon vergeben ist.   (immer)
//   3) Gegen die Basis: kein CREATE TABLE auf einen Namen, den die Basis
//      bereits anlegt. Das ist der `org_units`-Fall aus #1202: CREATE TABLE
//      IF NOT EXISTS faellt still durch, und erst der folgende Index oder die
//      folgende Policy bricht — mit einer Fehlermeldung, die nicht mehr nach
//      Doppelung klingt ("column \"key\" does not exist").          (immer)
//   4) Gegen die uebrigen offenen PRs: dieselben Pruefungen 2) und 3).
//      Braucht GITHUB_TOKEN; ohne Token wird der Teil uebersprungen.
//
// Abgrenzung zu scripts/check-migration-drift.mjs: Jenes vergleicht Repo gegen
// Produktions-Ledger (ist eine Migration angekommen?). Dieses vergleicht Repo
// gegen Repo (kollidieren zwei Aenderungen?). Verschiedene Achsen, beide noetig.
//
// UEBERSPRINGEN IST NICHT BESTEHEN: Laeuft 4) mangels Token nicht, sagt der
// Guard das ausdruecklich und nennt die Pruefung als NICHT GELAUFEN. Ein
// stiller Skip haette denselben Wert wie das leere pdp_shadow_log aus §5 —
// er sieht aus wie "keine Befunde".
//
// Exit: 0 = keine blockierende Kollision · 1 = Kollision · 2 = Fehlbedienung.
//
// Nutzung:
//   npm run check:migration-collisions
//   BASE_REF=origin/main npm run check:migration-collisions
//   GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo npm run check:migration-collisions

import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = 'supabase/migrations';

// Die allererste Migration stammt aus der Zeit vor der Namenskonvention und
// traegt bewusst keinen Zeitstempel. Sie ist die einzige Ausnahme; alles
// andere muss dem Muster folgen, sonst greift die Versionsableitung daneben.
const LEGACY_FILES = new Set(['00001_initial_schema.sql']);

// Eine Kollision darf beabsichtigt sein — `20260906000000_reconcile_audit_evidence`
// legt `audit_evidence` an, obwohl die Basis das auch tut, und genau das ist
// ihr Zweck (Ledger-Wirklichkeits-Bruch aus CLAUDE.md §3). Solche Faelle
// tragen den Vermerk in der Migration selbst, nicht in einer Liste hier:
//
//   -- collision-check: allow-existing-table audit_evidence — Grund …
//
// Der Vermerk steht damit dort, wo er beim Lesen der Migration auffaellt, und
// altert mit ihr statt in einer zentralen Datei zurueckzubleiben.
const ALLOW_MARKER = /--\s*collision-check:\s*allow-existing-table\s+([a-z0-9_]+)/gi;

// ─── SQL-Vorverarbeitung ────────────────────────────────────────────────────
//
// Kommentare MUESSEN vor dem Parsen weg. In 20260904010000_platform_operators
// steht der Satz "`CREATE TABLE IF NOT EXISTS` fiel still durch" als Kommentar
// — eine naive Suche zaehlt ihn als Tabelle namens "if" mit. Genau dieser
// Fehlgriff ist bei der Handmessung passiert, die zu diesem Guard gefuehrt hat.
export function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ');
}

/** Tabellennamen, die dieses SQL anlegt — ohne Schema-Praefix, klein. */
export function tablesCreatedBy(sql) {
  const clean = stripSqlComments(sql);
  const re = /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?public"?\.)?"?([a-z0-9_]+)"?/gi;
  const found = new Set();
  for (const m of clean.matchAll(re)) found.add(m[1].toLowerCase());
  return found;
}

/** Tabellennamen, fuer die diese Migration eine Doppelung ausdruecklich erlaubt. */
export function allowedExistingTables(sql) {
  const found = new Set();
  for (const m of sql.matchAll(ALLOW_MARKER)) found.add(m[1].toLowerCase());
  return found;
}

/**
 * Version aus dem Dateinamen; null fuer die Legacy-Ausnahme oder Unfug.
 *
 * 8 bis 14 Stellen, nicht starr 14: `20260510_ai_governance_core.sql` liegt
 * mit acht Stellen auf main und ist gueltig. Der Vergleich laeuft ueber die
 * Ziffernfolge als Zeichenkette — eine achtstellige Version kann mit keiner
 * vierzehnstelligen zusammenfallen, die Pruefung bleibt also exakt.
 */
export function versionOf(filename) {
  if (LEGACY_FILES.has(filename)) return null;
  const m = /^(\d{8,14})_[a-z0-9_]+\.sql$/i.exec(filename);
  return m ? m[1] : null;
}

// ─── Git-Zugriff (nur lesend) ───────────────────────────────────────────────

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function gitOk(args) {
  try { git(args); return true; } catch { return false; }
}

/** Migrations-Dateinamen eines Git-Refs. */
export function migrationsAtRef(ref) {
  const out = git(['ls-tree', '--name-only', ref, `${MIGRATIONS_DIR}/`]);
  return out.split('\n').filter(Boolean).map((p) => p.replace(/^.*\//, ''));
}

function fileAtRef(ref, filename) {
  return git(['show', `${ref}:${MIGRATIONS_DIR}/${filename}`]);
}

/** Migrations-Dateinamen des Arbeitsbaums. */
function migrationsInWorkingTree() {
  return readdirSync(join(ROOT, MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql'));
}

// ─── Reine Vergleichslogik (testbar ohne Git und ohne Netz) ─────────────────

/**
 * @param {{file: string, version: string, tables: Set<string>, allowed: Set<string>}[]} ours
 * @param {{versions: Map<string,string>, tables: Map<string,string>}} theirs
 * @param {string} label   Woher `theirs` stammt — steht in der Meldung.
 */
export function collide(ours, theirs, label) {
  const findings = [];
  for (const m of ours) {
    const clash = theirs.versions.get(m.version);
    if (clash && clash !== m.file) {
      findings.push({
        kind: 'version',
        detail: `${m.file} belegt Version ${m.version} — ${label} hat dort bereits ${clash}.`,
      });
    }
    for (const t of m.tables) {
      if (!theirs.tables.has(t)) continue;
      if (m.allowed.has(t)) continue;
      findings.push({
        kind: 'table',
        detail: `${m.file} legt Tabelle "${t}" an — ${label} legt sie in ${theirs.tables.get(t)} bereits an.`,
      });
    }
  }
  return findings;
}

/** Doppelte Versionen innerhalb einer Dateiliste. */
export function duplicateVersions(files) {
  const seen = new Map();
  const dupes = [];
  for (const f of files) {
    const v = versionOf(f);
    if (!v) continue;
    if (seen.has(v)) dupes.push({ version: v, files: [seen.get(v), f] });
    else seen.set(v, f);
  }
  return dupes;
}

// ─── GitHub: die uebrigen offenen PRs ───────────────────────────────────────

async function openPullRequests(repo, token, selfNumber) {
  const headers = {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'user-agent': 'rsd-migration-collision-guard',
  };
  const res = await fetch(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=100`, { headers });
  if (!res.ok) throw new Error(`GitHub /pulls: HTTP ${res.status}`);
  const prs = await res.json();

  const out = [];
  for (const pr of prs) {
    if (pr.draft === undefined) continue;
    if (selfNumber && pr.number === Number(selfNumber)) continue;
    const fr = await fetch(`https://api.github.com/repos/${repo}/pulls/${pr.number}/files?per_page=100`, { headers });
    if (!fr.ok) throw new Error(`GitHub /pulls/${pr.number}/files: HTTP ${fr.status}`);
    const files = await fr.json();
    const migrations = files
      .filter((f) => f.filename.startsWith(`${MIGRATIONS_DIR}/`) && f.status !== 'removed')
      .map((f) => f.filename.replace(/^.*\//, ''));
    if (migrations.length) out.push({ number: pr.number, migrations });
  }
  return out;
}

// ─── Hauptlauf ──────────────────────────────────────────────────────────────

async function main() {
  const baseRef = process.env.BASE_REF || 'origin/main';
  const token = process.env.GITHUB_TOKEN || '';
  const repo = process.env.GITHUB_REPOSITORY || '';
  const selfNumber = process.env.PR_NUMBER || '';

  if (!gitOk(['rev-parse', '--verify', `${baseRef}^{commit}`])) {
    console.error(`❌ Basis-Ref "${baseRef}" nicht auffindbar. In CI vorher fetchen, ` +
      `oder BASE_REF setzen.`);
    process.exit(2);
  }

  const errors = [];
  const notRun = [];

  // ── (1) Eigener Baum ──
  const ourFiles = migrationsInWorkingTree();
  for (const d of duplicateVersions(ourFiles)) {
    errors.push(`Version ${d.version} doppelt im eigenen Baum: ${d.files.join(' und ')}.`);
  }

  // ── Was dieser Zweig gegenueber der Basis neu bringt ──
  const baseFiles = new Set(migrationsAtRef(baseRef));
  const brought = ourFiles.filter((f) => !baseFiles.has(f));

  // Namensmuster nur fuer das, was DIESER Zweig hinzufuegt. Ein Altbestand mit
  // abweichendem Namen ist nicht der Befund des naechsten PRs, der zufaellig
  // eine Migration mitbringt — sonst faerbt der Guard Fremde rot und wird
  // genau deshalb ignoriert.
  for (const f of brought) {
    if (LEGACY_FILES.has(f) || versionOf(f) !== null) continue;
    errors.push(`${f} folgt nicht dem Muster <version>_<beschreibung>.sql mit 8 bis 14 ` +
      `Stellen — ohne Version ist die Reihenfolge der Anwendung unbestimmt.`);
  }

  const added = brought.filter((f) => versionOf(f));

  if (added.length === 0) {
    console.log(`✅ Keine neuen Migrationen gegenueber ${baseRef} — nichts zu pruefen.`);
    process.exit(0);
  }

  const ours = added.map((file) => {
    const sql = fileAtRef('HEAD', file);
    return { file, version: versionOf(file), tables: tablesCreatedBy(sql), allowed: allowedExistingTables(sql) };
  });

  // ── (2) + (3) Gegen die Basis ──
  const baseIndex = { versions: new Map(), tables: new Map() };
  for (const f of baseFiles) {
    const v = versionOf(f);
    if (v && !baseIndex.versions.has(v)) baseIndex.versions.set(v, f);
    for (const t of tablesCreatedBy(fileAtRef(baseRef, f))) {
      if (!baseIndex.tables.has(t)) baseIndex.tables.set(t, f);
    }
  }
  for (const c of collide(ours, baseIndex, baseRef)) errors.push(c.detail);

  // ── (4) Gegen die uebrigen offenen PRs ──
  if (!token || !repo) {
    notRun.push('Abgleich gegen die uebrigen offenen PRs — GITHUB_TOKEN oder ' +
      'GITHUB_REPOSITORY fehlt. Die Kollision zwischen zwei PRs, die je fuer sich ' +
      'gruen sind, kann dieser Lauf NICHT ausschliessen.');
  } else {
    try {
      const siblings = await openPullRequests(repo, token, selfNumber);
      const sibIndex = { versions: new Map(), tables: new Map() };
      for (const pr of siblings) {
        for (const f of pr.migrations) {
          const v = versionOf(f);
          if (v && !sibIndex.versions.has(v)) sibIndex.versions.set(v, `#${pr.number}: ${f}`);
        }
      }
      // Nur Versionen, nicht Tabellen: Der Dateiinhalt fremder PRs waere ein
      // weiterer Satz Abfragen und damit ein Kontingentproblem. Die
      // Versionsdoppelung ist der Fall, der den Deploy sofort kippt; die
      // Objektdoppelung zwischen zwei PRs (#1202 ↔ #1207) faellt spaetestens
      // auf, sobald der erste gemergt ist und Pruefung (3) greift.
      for (const c of collide(ours, sibIndex, 'ein anderer offener PR')) errors.push(c.detail);
      console.log(`✓ ${siblings.length} weitere offene PRs mit Migrationen geprueft.`);
    } catch (e) {
      notRun.push(`Abgleich gegen die uebrigen offenen PRs ist FEHLGESCHLAGEN: ${e.message}. ` +
        `Das ist kein Freispruch — die Pruefung hat nicht stattgefunden.`);
    }
  }

  console.log(`✓ ${added.length} neue Migration(en) gegen ${baseRef} geprueft: ${added.join(', ')}`);

  // Befunde zustellen, nicht nur protokollieren (CLAUDE.md §5): Als
  // Actions-Annotation stehen sie in der PR-Oberflaeche, nicht nur im
  // Job-Log, das im Zweifel niemand oeffnet.
  const annotate = (level, title, msg) => {
    if (!process.env.GITHUB_ACTIONS) return;
    console.log(`::${level} title=${title}::${msg.replace(/\n/g, ' ')}`);
  };

  for (const n of notRun) {
    console.warn(`\n⚠️  NICHT GELAUFEN: ${n}`);
    annotate('warning', 'Migrations-Kollisionspruefung unvollstaendig', n);
  }

  if (errors.length) {
    console.error('\n❌ Migrations-Kollisions-Guard FEHLER:');
    for (const e of errors) {
      console.error(`   - ${e}`);
      annotate('error', 'Migrations-Kollision', e);
    }
    console.error('\nBehebung: neue Versionsnummer oberhalb des hoechsten Standes auf ' +
      `${baseRef} waehlen, bzw. die bestehende Tabelle additiv per ALTER TABLE ` +
      'erweitern statt sie ein zweites Mal anzulegen. Ist die Doppelung gewollt, ' +
      'traegt die Migration den Vermerk\n' +
      '   -- collision-check: allow-existing-table <name> — <Grund>');
    process.exit(1);
  }

  console.log('✅ Keine Migrations-Kollision.');
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(2); });
}
