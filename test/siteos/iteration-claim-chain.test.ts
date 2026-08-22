import { describe, expect, it } from 'vitest';

import {
  applyEdit,
  canonicalHash,
  parseBrief,
  parseEditIntent,
  renderSite,
  synthesizeBlueprint,
  type EditOp,
  type SiteBlueprint,
} from '../../packages/siteos-core/src/index';

/**
 * Das Akzeptanzkriterium, wörtlich:
 *
 *   Besucher beschreibt → Build erzeugt → Preview erscheint → Besucher
 *   verändert → Preview aktualisiert sich → Besucher meldet sich an →
 *   Projekt wird geclaimt → **exakt dieselbe Version bleibt erhalten**.
 *
 *   „Wenn an irgendeiner Stelle ein neuer Build erzeugt wird, ist Project
 *   Claim funktional kaputt, selbst wenn UI und Datenbank formal
 *   funktionieren."
 *
 * Diese Datei prüft genau diesen Satz — nicht die Edge Functions (die
 * brauchen Deno und ein Netz), sondern das, worauf sie sich stützen: dass
 * die Änderung eine Abbildung des Vorhandenen ist und keine Neuerzeugung,
 * und dass die Kette über den Datenbank-Umlauf hält.
 */

function build(prompt: string): SiteBlueprint {
  return synthesizeBlueprint(parseBrief(prompt, 'de'), { source: 'ai-builder', model: null });
}

/** Was ein JSONB-Umlauf mit dem Wert macht: serialisieren, zurücklesen. */
function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Eine Sitzung: bauen, mehrfach ändern, jede Fassung durch die Datenbank. */
async function session(prompt: string, instructions: string[]) {
  let blueprint = roundTrip(build(prompt));
  let hash = await canonicalHash(blueprint);
  const chain: { revision: number; hash: string; prev: string | null; op: string }[] = [
    { revision: 0, hash, prev: null, op: 'create' },
  ];

  for (const instruction of instructions) {
    const intent = parseEditIntent(instruction);
    expect(intent, `nicht erkannt: ${instruction}`).not.toBeNull();

    const result = applyEdit(blueprint, intent as EditOp);
    expect(result.changed, `wirkungslos: ${instruction}`).toBe(true);

    const prev = hash;
    // Der Umlauf durch JSONB gehört dazu: In der Function wird geschrieben
    // und beim nächsten Aufruf wieder gelesen.
    blueprint = roundTrip(result.blueprint);
    hash = await canonicalHash(blueprint);
    chain.push({ revision: chain.length, hash, prev, op: (intent as EditOp).op });
  }

  return { blueprint, hash, chain };
}

describe('Iteration bricht die Übernahme nicht', () => {
  it('die übernommene Fassung ist die zuletzt gesehene', async () => {
    const { blueprint, hash } = await session('Zahnarzt in Hamburg', [
      'mach den Hero grösser',
      'mach die Akzentfarbe grün',
      'Überschrift: Zahnmedizin am Hafen',
    ]);

    // Der Claim-Handler kopiert den gespeicherten Blueprint und rechnet den
    // Hash nach. Genau das wird hier nachgestellt.
    const claimed = roundTrip(blueprint);
    expect(await canonicalHash(claimed)).toBe(hash);
    expect(claimed).toEqual(blueprint);
  });

  it('eine Neuerzeugung aus demselben Prompt ergäbe etwas anderes', async () => {
    // Der eigentliche Beweis: Würde an irgendeiner Stelle neu gebaut, käme
    // nicht dasselbe heraus. Dieser Test schlägt fehl, sobald jemand die
    // Iteration auf `synthesizeBlueprint` umstellt.
    const prompt = 'Zahnarzt in Hamburg';
    const { hash } = await session(prompt, ['mach den Hero grösser']);
    const rebuilt = await canonicalHash(build(prompt));
    expect(hash).not.toBe(rebuilt);
  });

  it('die Kette ist lückenlos und jede Fassung verweist auf ihren Vorgänger', async () => {
    const { chain } = await session('Rechtsanwalt in München', [
      'mach den Hero grösser',
      'mach die Seite heller',
      'mach die Ecken runder',
      'Entferne die Team-Sektion',
    ]);

    expect(chain).toHaveLength(5);
    expect(chain[0].prev).toBeNull();
    for (let i = 1; i < chain.length; i++) {
      expect(chain[i].revision).toBe(i);
      // Die Bedingung, die auch die Datenbank prüft.
      expect(chain[i].prev).toBe(chain[i - 1].hash);
    }
    // Kein Hash doppelt: jede Fassung ist wirklich eine andere.
    expect(new Set(chain.map((c) => c.hash)).size).toBe(chain.length);
  });

  it('die Vorschau ändert sich mit — sonst wäre die Fassung unsichtbar', async () => {
    const first = build('Zahnarzt in Hamburg');
    const second = applyEdit(first, { op: 'hero.emphasis', value: 'large' }).blueprint;

    const htmlOf = (bp: SiteBlueprint) => renderSite(bp, {}).find((p) => p.path === '/')!.html;
    expect(htmlOf(second)).not.toBe(htmlOf(first));
    expect(htmlOf(second)).toContain('data-emphasis="large"');
  });

  it('hält auch über viele Fassungen', async () => {
    // Abwechselnd hin und her: Der Hash muss jedes Mal dem Zustand folgen,
    // nicht der Zahl der Aufrufe.
    const instructions: string[] = [];
    for (let i = 0; i < 6; i++) {
      instructions.push(i % 2 === 0 ? 'mach den Hero grösser' : 'den Titelbereich kleiner');
    }
    const { chain, blueprint, hash } = await session('Steuerberatung in Köln', instructions);

    expect(chain).toHaveLength(7);
    expect(await canonicalHash(roundTrip(blueprint))).toBe(hash);
    // „grösser" und „kleiner" im Wechsel ⇒ nur zwei verschiedene Zustände
    // nach der ersten Änderung. Die Kette darf sie trotzdem alle führen.
    expect(new Set(chain.slice(1).map((c) => c.hash)).size).toBe(2);
  });

  it('trägt die Herkunft unverändert durch die Kette', async () => {
    // Art. 50 EU AI Act: Die Änderung ist deterministisch. Würde hier ein
    // Modell eingetragen, behauptete die übernommene Site eine
    // KI-Beteiligung, die es nicht gab.
    // Nicht „blau": Das ist der Standardakzent, die Anweisung waere ein
    // NO_CHANGE — richtig abgewiesen, aber hier nicht das Thema.
    const { blueprint } = await session('Handwerksbetrieb in Bremen', [
      'mach die Akzentfarbe grün',
      'mach den Hero grösser',
    ]);
    expect(blueprint.origin.model).toBeNull();
    expect(blueprint.origin.source).toBe('ai-builder');
  });
});
