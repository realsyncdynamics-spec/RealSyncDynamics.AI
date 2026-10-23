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

/**
 * Liefert den Commit, gegen den package.json verglichen werden muss.
 *
 * Wichtig ist die Konsistenz mit changedFiles(): dort bestimmt ein
 * Drei-Punkt-Diff (`${baseRef}...HEAD`) die Dateiliste, also gegen den
 * gemeinsamen Vorfahren. Liest man die Vergleichsbasis stattdessen von der
 * Spitze von baseRef, werden Feldaenderungen, die inzwischen auf baseRef
 * passiert sind, faelschlich diesem Branch zugeschrieben — genau der
 * Fehlalarm, den diese Datei abstellen soll.
 *
 * Laesst sich kein Merge-Base bestimmen (flacher Klon ohne gemeinsamen
 * Vorfahren, unverwandte Historien), faellt die Funktion auf baseRef zurueck:
 * das warnt im Zweifel zu viel statt echten Lockfile-Drift durchzulassen.
 */
export function comparisonBaseRef(git, baseRef) {
  try {
    const mergeBase = git(`merge-base ${baseRef} HEAD`);
    if (mergeBase) return mergeBase;
  } catch {
    // kein gemeinsamer Vorfahre ermittelbar — konservativ auf baseRef zurueck
  }
  return baseRef;
}
