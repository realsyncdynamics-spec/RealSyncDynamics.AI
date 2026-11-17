/**
 * P0: Safe deployment scope for Supabase Edge Functions.
 * Emits function slugs to stdout, never calls Supabase or changes production.
 * Blocks uncertain dependencies, config changes, new function slots and large
 * blasts instead of attempting an automatic deploy of every function.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_MAX = 12;

function listSourceFiles(dir) {
  const files = [];
  function visit(current) {
    for (const item of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, item.name);
      if (item.isDirectory()) visit(full);
      else if (item.isFile() && /\.(?:ts|tsx|js|mjs)$/.test(item.name)) files.push(full);
    }
  }
  if (existsSync(dir)) visit(dir);
  return files;
}

function relativeImports(source) {
  const matches = new Set();
  const patterns = [
    /\bfrom\s*['"](\.[^'"\n]+)['"]/g,
    /\bimport\s*['"](\.[^'"\n]+)['"]/g,
    /\bimport\s*\(\s*['"](\.[^'"\n]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"](\.[^'"\n]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) matches.add(match[1]);
  }
  return matches;
}

function dependencyGraph(files) {
  const known = new Set(files);
  const consumers = new Map();
  for (const file of files) {
    for (const spec of relativeImports(readFileSync(file, 'utf8'))) {
      const path = resolve(dirname(file), spec);
      const candidates = extname(path)
        ? [path]
        : [path, path + '.ts', path + '.tsx', path + '.js', path + '.mjs', join(path, 'index.ts')];
      const dependency = candidates.find((x) => known.has(x));
      if (!dependency) continue;
      if (!consumers.has(dependency)) consumers.set(dependency, new Set());
      consumers.get(dependency).add(file);
    }
  }
  return consumers;
}

function functionSlug(file, dir) {
  const parts = relative(dir, file).split(sep);
  if (parts.length < 2 || parts[0].startsWith('_') || parts[0] === '..') return null;
  return parts[0];
}

/**
 * @param {{root:string,changes:Array<{status:string,path:string}>,maxAuto?:number}} options
 * @returns {string[]} selected existing function slugs
 */
export function planEdgeDeploy({ root, changes, maxAuto = DEFAULT_MAX }) {
  const base = resolve(root);
  const dir = join(base, 'supabase', 'functions');
  const selected = new Set();
  const shared = [];
  const candidates = changes
    .map((x) => ({ status: x.status, path: x.path.replace(/\\/g, '/') }))
    .filter((x) => x.path.startsWith('supabase/functions/') || x.path === 'supabase/config.toml');

  if (candidates.some((x) => x.path === 'supabase/config.toml')) {
    throw new Error('supabase/config.toml changed: verify_jwt and webhook auth require an individually reviewed deployment plan');
  }

  const consumers = dependencyGraph(listSourceFiles(dir));
  for (const change of candidates) {
    const abs = resolve(base, change.path);
    if (!abs.startsWith(dir + sep)) throw new Error('Invalid deploy path: ' + change.path);
    const rel = relative(dir, abs);
    if (rel.startsWith('_shared' + sep)) {
      if (/\.(?:ts|tsx|js|mjs)$/.test(abs)) shared.push(abs);
      continue;
    }
    const slug = functionSlug(abs, dir);
    if (!slug) continue;
    if (change.status === 'D' || !existsSync(join(dir, slug, 'index.ts'))) {
      throw new Error('Function ' + slug + ' was removed or has no index.ts: manual retire/dependency review required');
    }
    if (change.status === 'A' && rel === slug + sep + 'index.ts') {
      throw new Error('New function ' + slug + ' requires an approved production slot and explicit deployment');
    }
    selected.add(slug);
  }

  for (const file of shared) {
    const visited = new Set([file]);
    const queue = [file];
    let found = 0;
    while (queue.length) {
      const cur = queue.shift();
      for (const parent of consumers.get(cur) ?? []) {
        if (visited.has(parent)) continue;
        visited.add(parent);
        queue.push(parent);
        found++;
        const slug = functionSlug(parent, dir);
        if (slug) {
          if (!existsSync(join(dir, slug, 'index.ts'))) {
            throw new Error('Dependent function ' + slug + ' lacks index.ts');
          }
          selected.add(slug);
        }
      }
    }
    if (!found) {
      throw new Error('Cannot determine importers of ' + relative(base, file) + '; manual dependency review required');
    }
  }

  if (selected.size > maxAuto) {
    throw new Error('Affected scope contains ' + selected.size + ' functions, limit ' + maxAuto + ': manual batched deployment and rollback plan required');
  }
  return [...selected].sort();
}

export function parseGitNameStatus(output) {
  return output.trim().split('\n').filter(Boolean).map((line) => {
    const match = /^([AMD])\t(.+)$/.exec(line);
    if (!match) throw new Error('Unsupported git change status: ' + line);
    return { status: match[1], path: match[2] };
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4) throw new Error('Usage: node scripts/ops/plan-edge-deploy.mjs BASE_REF HEAD_REF');
    const [from, to] = process.argv.slice(2);
    const diff = execFileSync('git', [
      'diff', '--name-status', '--no-renames', from, to, '--',
      'supabase/functions', 'supabase/config.toml',
    ], { cwd: process.cwd(), encoding: 'utf8' });
    const selected = planEdgeDeploy({ root: process.cwd(), changes: parseGitNameStatus(diff) });
    process.stderr.write('[edge-deploy] selected ' + selected.length + ' function(s); no mass redeploy\n');
    if (selected.length) process.stdout.write(selected.join('\n') + '\n');
  } catch (err) {
    process.stderr.write('[edge-deploy] BLOCKED: ' + (err instanceof Error ? err.message : String(err)) + '\n');
    process.exitCode = 1;
  }
}
