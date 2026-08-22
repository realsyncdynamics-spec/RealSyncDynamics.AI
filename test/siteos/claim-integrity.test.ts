import { describe, expect, it } from 'vitest';

import {
  canonicalHash,
  parseBrief,
  synthesizeBlueprint,
  type SiteBlueprint,
} from '../../packages/siteos-core/src/index';

/**
 * Das Akzeptanzkriterium der Übernahme lautet: Was der Besucher vor dem
 * Anmelden gesehen hat, muss er danach unverändert sehen. Der Handler
 * erzeugt deshalb nichts neu, sondern kopiert den gespeicherten Blueprint
 * und rechnet dessen Hash nach.
 *
 * Genau darin liegt ein Risiko, das sich nicht im Handler zeigt: Der
 * Blueprint macht einen Umlauf durch JSONB. Wäre die Kanonisierung dabei
 * nicht stabil, schlüge **jede** Übernahme an der Unversehrtheitsprüfung
 * fehl — und zwar erst in Produktion.
 */

function build(prompt: string): SiteBlueprint {
  return synthesizeBlueprint(parseBrief(prompt, 'de'), { source: 'ai-builder', model: null });
}

/** Was ein JSONB-Umlauf mit dem Wert macht: serialisieren, zurücklesen. */
function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('Unversehrtheit über den Datenbank-Umlauf', () => {
  it('hält den Hash über einen JSON-Umlauf stabil', async () => {
    const blueprint = build('Architekturbüro in Hamburg, minimalistisch');
    const before = await canonicalHash(blueprint);
    const after = await canonicalHash(roundTrip(blueprint));
    expect(after).toBe(before);
  });

  it('hält ihn auch über mehrere Umläufe stabil', async () => {
    // Entwurf anlegen, lesen, übernehmen, wieder lesen — mehr als einer.
    const blueprint = build('Zahnarztpraxis mit Terminbuchung');
    const before = await canonicalHash(blueprint);
    let value = blueprint;
    for (let i = 0; i < 3; i++) value = roundTrip(value);
    expect(await canonicalHash(value)).toBe(before);
  });

  it('ist unabhängig von der Schlüsselreihenfolge', async () => {
    // JSONB in PostgreSQL bewahrt die Reihenfolge der Schlüssel NICHT. Eine
    // Kanonisierung, die davon abhinge, wäre nach dem ersten Lesen wertlos.
    const blueprint = build('Kanzlei für Arbeitsrecht');
    const shuffled = Object.fromEntries(
      Object.entries(roundTrip(blueprint)).reverse(),
    ) as unknown as SiteBlueprint;
    expect(await canonicalHash(shuffled)).toBe(await canonicalHash(blueprint));
  });

  it('erkennt eine tatsächliche Veränderung', async () => {
    // Die Prüfung wäre wertlos, wenn sie nur immer „gleich" sagte.
    const blueprint = build('Bäckerei mit drei Filialen');
    const before = await canonicalHash(blueprint);
    const tampered = { ...roundTrip(blueprint), name: `${blueprint.name} GmbH` };
    expect(await canonicalHash(tampered)).not.toBe(before);
  });

  it('erkennt eine Veränderung tief in der Struktur', async () => {
    const blueprint = build('Fotostudio für Portraits');
    const before = await canonicalHash(blueprint);
    const tampered = roundTrip(blueprint);
    tampered.seo = { ...tampered.seo, defaultDescription: 'etwas anderes' };
    expect(await canonicalHash(tampered)).not.toBe(before);
  });
});

describe('Keine Neugenerierung', () => {
  it('erzeugt aus derselben Beschreibung denselben Blueprint', async () => {
    // Der Handler kopiert statt neu zu bauen. Diese Eigenschaft ist trotzdem
    // wichtig: Ohne sie wäre nicht einmal feststellbar, ob eine Abweichung
    // vom Kopieren oder vom Erzeugen kommt.
    const a = build('Tischlerei mit Möbelbau');
    const b = build('Tischlerei mit Möbelbau');
    expect(await canonicalHash(a)).toBe(await canonicalHash(b));
  });

  it('erzeugt aus einer anderen Beschreibung einen anderen Blueprint', async () => {
    const a = build('Tischlerei mit Möbelbau');
    const b = build('Tierarztpraxis mit Notdienst');
    expect(await canonicalHash(a)).not.toBe(await canonicalHash(b));
  });

  it('behauptet keine generative KI, wo keine war', async () => {
    // Art. 50 EU AI Act: deterministisch erzeugt heisst origin.model = null.
    expect(build('Irgendein Betrieb').origin.model).toBeNull();
  });
});
