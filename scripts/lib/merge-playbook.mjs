/**
 * Shared merge-conflict playbooks and hot-file registry.
 * Used by merge-hygiene.mjs, sync-with-main.mjs, and CI comments.
 */

export const HOT_FILES = [
  'src/App.tsx',
  'index.html',
  'CLAUDE.md',
  'shared/pricing.ts',
  'src/config/pricing.ts',
  'src/index.css',
  'tailwind.config.ts',
  'package.json',
  'package-lock.json',
  'src/features/governance/dashboard/FreeTierDashboard.tsx',
];

export const HOT_GLOBS = [
  /^supabase\/migrations\//,
  /^src\/pages\/MainLanding\.tsx$/,
];

export const COMMENT_MARKER = '<!-- merge-hygiene -->';

export function classifyPath(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.startsWith('supabase/migrations/') && normalized.endsWith('.sql')) {
    return 'migration';
  }
  if (normalized.endsWith('package-lock.json') || normalized.endsWith('pnpm-lock.yaml')) {
    return 'lockfile';
  }
  if (normalized === 'package.json') return 'package-json';
  if (normalized === 'src/App.tsx') return 'routes';
  if (normalized === 'shared/pricing.ts' || normalized === 'src/config/pricing.ts') {
    return 'pricing';
  }
  if (normalized === 'src/pages/MainLanding.tsx' || normalized === 'src/index.css') {
    return 'design-lock';
  }
  if (normalized === 'CLAUDE.md') return 'claude';
  if (HOT_FILES.includes(normalized) || HOT_GLOBS.some((re) => re.test(normalized))) {
    return 'hot';
  }
  return 'code';
}

export function isHotPath(filePath) {
  const kind = classifyPath(filePath);
  return kind !== 'code';
}

export function playbookFor(kind) {
  switch (kind) {
    case 'migration':
      return [
        'Migration: Datei auf `main` nie editieren. Neue Datei behalten, Timestamp anheben:',
        '  npm run migrate:rename -- supabase/migrations/<kollision>.sql',
        'Danach lokal `supabase db reset` (oder der CI-Job `db`).',
      ].join('\n');
    case 'lockfile':
      return [
        'Lockfile: Konfliktmarker nicht von Hand mischen.',
        '  git checkout --ours package-lock.json     # rebase: ours = main',
        '  npm install',
        '  git add package-lock.json',
      ].join('\n');
    case 'package-json':
      return [
        'package.json: beide Dependency-Änderungen behalten, Versionen bewusst wählen.',
        'Danach Lockfile neu erzeugen: `npm install` und `package-lock.json` committen.',
      ].join('\n');
    case 'routes':
      return [
        'src/App.tsx: beide neuen Routes behalten. Imports nicht droppen.',
        'Keine bestehende öffentliche Route umbiegen. Design-Freeze gilt nicht für neue Routes.',
      ].join('\n');
    case 'pricing':
      return [
        'Preisquelle ist nur `shared/pricing.ts`. Nach dem Resolve:',
        '  npm run sync:pricing && npm run check:pricing',
        'Niemals `src/config/pricing.ts` als zweite Wahrheit mergen.',
      ].join('\n');
    case 'design-lock':
      return [
        'Design-Lock (CLAUDE.md §10): Layout/Tokens nicht „mitlösen“.',
        'Nur eigene inhaltliche Hunks behalten. Optik-Änderungen brauchen Freigabe.',
      ].join('\n');
    case 'claude':
      return [
        'CLAUDE.md beschreibt den Ist-Zustand. Nach dem Merge den Endstand schreiben,',
        'nicht zwei historische Zwischenstände zusammenkleben.',
      ].join('\n');
    case 'hot':
      return 'Hot-File: beide Seiten lesen, Intention mergen, nicht „Accept Incoming“ blind klicken.';
    default:
      return 'Konflikt in der Datei lösen, `git add <datei>`, dann `git rebase --continue`.';
  }
}

export function formatPlaybooks(files) {
  const byKind = new Map();
  for (const file of files) {
    const kind = classifyPath(file);
    if (!byKind.has(kind)) byKind.set(kind, []);
    byKind.get(kind).push(file);
  }
  const lines = [];
  for (const [kind, list] of byKind) {
    lines.push(`### ${kind}`);
    for (const file of list) lines.push(`- \`${file}\``);
    lines.push('');
    lines.push('```');
    lines.push(playbookFor(kind));
    lines.push('```');
    lines.push('');
  }
  return lines.join('\n');
}
