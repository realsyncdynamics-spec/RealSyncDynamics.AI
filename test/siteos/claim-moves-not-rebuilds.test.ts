// Das Akzeptanzkriterium der Übernahme, am Quelltext geprüft.
//
// „Wenn an irgendeiner Stelle ein neuer Build erzeugt wird, ist Project Claim
// funktional kaputt, selbst wenn UI und Datenbank formal funktionieren."
//
// Genau das lässt sich mit Testdaten **nicht** zeigen: Der Kern ist
// deterministisch, ein Nachbau liefert denselben Blueprint und damit
// denselben Hash. Der Unterschied wird erst sichtbar, wenn sich der Kern
// zwischen Vorschau und Anmeldung ändert — und dann ist es zu spät.
//
// Prüfbar ist nur die Bauform: Der Claim-Pfad darf die Bau- und
// Verfeinerungsfunktionen gar nicht erst aufrufen. Deshalb steht die
// Prüfung hier und nicht im Verhalten.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');

const handler = readFileSync(
  resolve(ROOT, 'supabase/functions/siteos/handlers/anonymous.ts'),
  'utf-8',
);
const claimView = readFileSync(
  resolve(ROOT, 'src/features/siteos/SiteOsClaimView.tsx'),
  'utf-8',
);
const session = readFileSync(
  resolve(ROOT, 'src/features/siteos/buildSession.ts'),
  'utf-8',
);

/** Der Rumpf von `handleClaim` — nur dort gilt das Verbot. */
function claimBody(): string {
  const start = handler.indexOf('export async function handleClaim');
  expect(start).toBeGreaterThan(-1);
  const next = handler.indexOf('\nexport ', start + 1);
  return handler.slice(start, next === -1 ? undefined : next);
}

describe('Claim verschiebt, statt neu zu bauen', () => {
  it('ruft im Claim-Pfad weder buildSiteFromPrompt noch refineBlueprint auf', () => {
    const body = claimBody();
    expect(body).not.toContain('buildSiteFromPrompt');
    expect(body).not.toContain('refineBlueprint');
  });

  it('übernimmt Blueprint und Hash unverändert aus der Sitzung', () => {
    const body = claimBody();
    // Der Hash wird NICHT neu berechnet — er wird mitgenommen. Eine
    // Neuberechnung wäre für sich harmlos, aber sie verdeckte, dass der
    // Blueprint aus einer anderen Quelle stammen könnte.
    expect(body).toContain('content_sha256: session.row.content_sha256');
    expect(body).not.toContain('await canonicalHash');
  });

  it('schreibt den Hash der Vorschau in den Prüfpfad', () => {
    // Der einzige Beleg, der später noch nachvollziehbar ist.
    expect(claimBody()).toMatch(/content_sha256: session\.row\.content_sha256/);
  });

  it('überträgt aus dem Browser nur die Sitzungskennung', () => {
    expect(claimView).toContain('claimAnonBuild({ tenant_id: activeTenantId, session_id: session.id })');
    // Die frühere Fassung schickte Prompt und Anweisungsfolge zum Nachspielen.
    expect(claimView).not.toContain('refinements');
    expect(claimView).not.toContain('refinementList');
  });

  it('ist idempotent — ein zweiter Aufruf legt keine zweite Website an', () => {
    const body = claimBody();
    expect(body).toContain('already_claimed');
    // Der Wettlauf zweier gleichzeitiger Übernahmen wird über die Bedingung
    // aufgelöst, nicht über die Hoffnung, dass er nicht eintritt.
    expect(body).toContain(".is('claimed_at', null)");
  });

  it('übernimmt einen abgelaufenen Entwurf nicht stillschweigend', () => {
    expect(claimBody()).toContain('isExpired');
  });
});

describe('Vorschau zeigt den Serverstand', () => {
  it('liest die Sitzung beim Wiederaufnehmen, statt sie zu rekonstruieren', () => {
    expect(session).toContain('getAnonSession');
    expect(session).toMatch(/export async function resumeBuild/);
  });

  it('speichert keinen Blueprint im Browser', () => {
    // Ein lokaler Blueprint wäre eine zweite Wahrheit über denselben
    // Gegenstand — und die, die der Nutzer bearbeiten kann.
    const stored = /export interface StoredSession \{([\s\S]*?)\}/.exec(session)?.[1] ?? '';
    expect(stored).not.toContain('blueprint');
    expect(stored).not.toContain('findings');
  });

  it('benennt den Rückfall, statt ihn zu verschweigen', () => {
    expect(session).toContain("mode: BuildMode");
    expect(claimView).toContain("'local_only'");
  });
});
