/**
 * Entscheidet, ob eine package.json-Aenderung typischerweise eine neue
 * package-lock.json erfordert.
 *
 * Reine Projektmetadaten oder npm-Scripts sind lockfile-neutral. Relevant sind
 * Felder, die npm in den Root-Eintrag des Lockfiles spiegelt oder die den
 * aufgeloesten Abhaengigkeitsgraphen beeinflussen.
 */
export const PACKAGE_LOCK_RELEVANT_FIELDS = [
  'name',
  'version',
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
  'peerDependenciesMeta',
  'bundleDependencies',
  'bundledDependencies',
  'workspaces',
  'overrides',
  'bin',
  'engines',
  'os',
  'cpu',
  'license',
];

function sameValue(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function lockfileRelevantPackageChanges(before, after) {
  return PACKAGE_LOCK_RELEVANT_FIELDS.filter(
    (field) => !sameValue(before?.[field], after?.[field]),
  );
}
