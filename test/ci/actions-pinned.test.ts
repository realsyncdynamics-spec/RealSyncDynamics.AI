/**
 * Actions in Workflows müssen auf einen vollständigen Commit-SHA gepinnt sein.
 *
 * ## Warum das ein Test ist und keine Konvention
 *
 * Das Repository erzwingt die Regel serverseitig. Ein Verstoß bricht den Lauf
 * in „Set up job" ab — **bevor ein Schritt startet**:
 *
 *   The action actions/github-script@v7 is not allowed in
 *   realsyncdynamics-spec/RealSyncDynamics.AI because all actions must be
 *   pinned to a full-length commit SHA.
 *
 * Das ist der teuerste Fehlertyp für einen Workflow: Er scheitert vollständig,
 * ohne eine einzige Zeile des eigenen Skripts auszuführen, und die
 * Fehlermeldung steht im Runner-Protokoll statt im Diff.
 *
 * `drift-alert.yml` hat es getroffen. Der Workflow wurde am 2026-08-30
 * angelegt, um rote Drift-Guards als Issue zuzustellen — und ist seit dem
 * ersten Lauf an dieser Sperre gescheitert. Am 2026-09-01 gemessen: rot auf
 * `310ab0ed` und auf jedem weiteren Push. Ausgerechnet die Zustellung von
 * Befunden litt damit an dem Fehler, den sie sichtbar machen soll: ein roter
 * Lauf, den niemand sieht.
 *
 * Ein Test im Repo fängt das im PR ab, wo es zwei Zeichen kostet, statt in
 * Produktion, wo es tagelang unbemerkt bleibt.
 *
 * ## Bekannte Ausnahme
 *
 * `docker-deploy.yml` führt zwölf ungepinnte Verweise über sieben Actions
 * (`docker/*`, `slackapi/*`, `actions/setup-node`, `actions/checkout`). Der
 * Workflow läuft ausschließlich auf `workflow_dispatch` und ist damit heute
 * nicht rot — er wäre es beim ersten manuellen Start. Das getrennt zu
 * behandeln ist Absicht: Es sind sieben SHA-Recherchen, kein Einzeiler, und
 * der Docker-Pfad ist nicht der Produktionsweg (Cloudflare Pages ist es).
 * Der Eintrag hier ist die Erinnerung daran, nicht der Freibrief.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WORKFLOWS = resolve(__dirname, '../../.github/workflows');

/**
 * Workflows, deren Verweise noch nicht gepinnt sind — mit Grund.
 *
 * Ein Eintrag hier ist eine Entscheidung, kein Freibrief: Wird die Datei
 * gepinnt, schlägt der Test ebenfalls fehl und der Eintrag gehört entfernt.
 */
const KNOWN_UNPINNED: Readonly<Record<string, string>> = {
  'docker-deploy.yml':
    'Zwölf Verweise über sieben Actions; nur workflow_dispatch, daher heute nicht rot. Eigener Schritt.',
};

interface Ref {
  file: string;
  line: number;
  uses: string;
}

function actionRefs(): Ref[] {
  const refs: Ref[] = [];
  for (const file of readdirSync(WORKFLOWS)) {
    if (!/\.ya?ml$/.test(file)) continue;
    const lines = readFileSync(join(WORKFLOWS, file), 'utf8').split('\n');
    lines.forEach((raw, i) => {
      // Kommentarzeilen zählen nicht — dort steht die Begründung, oft samt
      // der alten `@v7`-Schreibweise als Zitat.
      if (/^\s*#/.test(raw)) return;
      const match = /^\s*(?:-\s*)?uses:\s*([^\s#]+)/.exec(raw);
      if (!match) return;
      const uses = match[1];
      if (uses.startsWith('./') || uses.startsWith('docker://')) return; // lokal
      refs.push({ file, line: i + 1, uses });
    });
  }
  return refs;
}

const REFS = actionRefs();
const isPinned = (uses: string) => /@[0-9a-f]{40}$/.test(uses);

describe('Actions sind auf einen Commit-SHA gepinnt', () => {
  it('findet überhaupt Verweise (Scanner nicht kaputt)', () => {
    // Ohne diese Zusicherung wäre ein defekter Scanner ein grüner Test.
    expect(REFS.length).toBeGreaterThan(20);
  });

  it('hat keinen ungepinnten Verweis außerhalb der bekannten Ausnahme', () => {
    const offenders = REFS.filter(
      (r) => !isPinned(r.uses) && !(r.file in KNOWN_UNPINNED)
    ).map((r) => `${r.file}:${r.line}  ${r.uses}`);

    expect(
      offenders.sort(),
      'Das Repository verlangt vollständige Commit-SHAs. Ein Tag wie `@v4` ' +
        'lässt den Lauf in „Set up job" abbrechen, bevor ein Schritt startet. ' +
        'SHA per `git ls-remote https://github.com/<owner>/<repo> <tag>` ' +
        'auflösen und als `@<sha> # <tag>` eintragen.'
    ).toEqual([]);
  });

  it('meldet Ausnahmen, die inzwischen gepinnt sind', () => {
    const resolved = Object.keys(KNOWN_UNPINNED).filter((file) =>
      REFS.filter((r) => r.file === file).every((r) => isPinned(r.uses))
    );

    expect(
      resolved.sort(),
      'Diese Datei ist inzwischen vollständig gepinnt — Eintrag aus ' +
        'KNOWN_UNPINNED entfernen, sonst beschreibt die Liste einen Zustand, ' +
        'den es nicht mehr gibt.'
    ).toEqual([]);
  });

  it('begründet jede Ausnahme', () => {
    for (const [file, reason] of Object.entries(KNOWN_UNPINNED)) {
      expect(REFS.some((r) => r.file === file), `${file} hat keine Verweise mehr`).toBe(true);
      expect(reason.length, `${file}: Begründung zu knapp`).toBeGreaterThan(20);
    }
  });
});

describe('Drift Alert kann laufen', () => {
  const driftAlert = REFS.filter((r) => r.file === 'drift-alert.yml');

  it('nutzt github-script gepinnt', () => {
    // Genau dieser Verweis hat den Workflow seit dem 2026-08-30 wirkungslos
    // gemacht. Der Test hält den Fall fest, nicht nur die Regel.
    const script = driftAlert.find((r) => r.uses.startsWith('actions/github-script@'));
    expect(script, 'drift-alert.yml nutzt github-script nicht mehr').toBeDefined();
    expect(isPinned(script!.uses)).toBe(true);
  });
});
