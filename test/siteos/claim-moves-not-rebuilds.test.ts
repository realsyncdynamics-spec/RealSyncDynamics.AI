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
const studio = readFileSync(
  resolve(ROOT, 'src/unified-entry/pages/BuildStudioPage.tsx'),
  'utf-8',
);
const api = readFileSync(
  resolve(ROOT, 'src/features/siteos/siteOsApi.ts'),
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
    // Der gespeicherte Hash wird mitgenommen, nicht ersetzt: Was in den
    // Mandanten wandert, trägt denselben Nachweis wie die Vorschau.
    expect(body).toContain('content_sha256: session.row.content_sha256');
    // Und es wird nichts erzeugt, aus dem sich ein anderer Hash ergäbe.
    expect(body).not.toContain('synthesizeBlueprint');
    expect(body).not.toContain('parseBrief');
  });

  it('rechnet den gespeicherten Hash vor der Übernahme nach', () => {
    // Frühere Fassung dieser Datei verbot `await canonicalHash` im
    // Claim-Rumpf — als Stellvertreter für „baut nicht neu". Der
    // Stellvertreter war zu grob: Hashen ist nicht Bauen. Ohne die
    // Nachrechnung wurden Blueprint und Hash nebeneinander kopiert, ohne
    // dass je geprüft wurde, ob sie zusammengehören — die Zusage „genau
    // diese Fassung" war damit unbelegt.
    //
    // Was „baut nicht neu" wirklich heisst, prüft der Test darüber und der
    // erste in dieser Datei: keine Synthese, keine Verfeinerung.
    const body = claimBody();
    expect(body).toContain('const verifiedSha = await canonicalHash(blueprint)');
    expect(body).toContain("verifiedSha !== session.row.content_sha256");
    expect(body).toContain('DRAFT_CORRUPT');
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

// Der Rückfall wurde bisher nur dort benannt, wo es zu spät ist.
//
// `SiteOsClaimView` kennt `local_only` und sagt es sauber — aber die Ansicht
// liegt hinter `/welcome`. Wer im Rückfall auf „Website übernehmen" klickt,
// legt erst ein Konto an und erfährt danach, dass es nichts zu übernehmen
// gibt. `buildSession.ts` verlangt ausdrücklich das Gegenteil: Der Zustand
// „steht in `mode` und wird in der Oberfläche gesagt, statt beim Klick auf
// ‚Übernehmen' als Fehler aufzutauchen."
//
// Geprüft wird wieder die Bauform, nicht das Verhalten: Ob der Hinweis
// erscheint, hängt an einer Serverantwort, die im Test nicht existiert.
describe('Das Studio sagt den Rückfall vor der Registrierung', () => {
  /** Der Kasten, der den Speicherort behauptet. */
  function storageNote(): string {
    const start = studio.indexOf('bg-obsidian-900 p-4 text-[11px] leading-5 text-titanium-400');
    expect(start).toBeGreaterThan(-1);
    return studio.slice(start, studio.indexOf('</div>', start));
  }

  it('leitet die Übernehmbarkeit aus dem Modus der Sitzung ab', () => {
    expect(studio).toContain("state.session.mode === 'server'");
  });

  it('sperrt „Website übernehmen", solange der Entwurf nur lokal liegt', () => {
    // Ohne diese Sperre führt der Weg über eine Kontoerstellung ins Leere.
    expect(studio).toContain('disabled={!claimable}');
    const cta = studio.slice(studio.indexOf("navigate('/app/siteos/claim')"));
    expect(cta.slice(0, cta.indexOf('</button>'))).toContain('disabled:opacity-40');
  });

  it('behauptet den Speicherort nicht unbedingt, sondern je Modus', () => {
    // Im Servermodus liegt der Entwurf in `siteos_anonymous_builds`. Ein
    // fester Satz „liegt nur in diesem Browser" wäre dort eine falsche
    // Angabe über den Verbleib von Kundendaten.
    const note = storageNote();
    expect(note).toContain('claimable ?');
    expect(note).toContain('serverseitig gespeichert');
    expect(note).toContain('nur in diesem Browser');
  });
});

// Ablauf ist ein eigener Zustand, kein Fehler.
//
// Die anonyme Sitzung lebt sieben Tage (`siteos_anonymous_builds.expires_at`);
// danach antwortet der Server mit `410 GONE` — beim Verfeinern, beim Lesen und
// beim Claim. Fehlt dafür ein eigener Fall, fällt der 410 auf `error` durch,
// und der Besucher liest die Rohmeldung der Client-Bibliothek statt zu
// erfahren, dass seine Frist um ist.
describe('Abgelaufene Entwürfe werden als Ablauf behandelt', () => {
  it('übersetzt 410 in einen eigenen Fall statt in einen generischen Fehler', () => {
    expect(api).toContain('status === 410');
    expect(api).toMatch(/kind: 'gone'/);
    expect(api).toMatch(/case 'gone':/);
  });

  it('wirft die tote Kennung beim Wiederaufnehmen weg', () => {
    // Ohne `gone` in dieser Bedingung bliebe die Kennung einer abgelaufenen
    // Sitzung für immer im Browser, und jede Wiederaufnahme fragte den Server
    // erneut nach einem Entwurf, den es nicht mehr gibt.
    const clause = /if \(result\.kind === 'not_found'[^)]*\) clear\(\);/.exec(session)?.[0] ?? '';
    expect(clause, 'Abbruchbedingung von resumeBuild nicht gefunden').not.toBe('');
    expect(clause).toContain("'gone'");
  });

  it('nennt Frist und Übernahme-Zustand in der Vorschau', () => {
    // Beides kommt vom Server und stand bisher ungenutzt im Zustand.
    expect(studio).toContain('state?.expiresAt');
    expect(studio).toContain('state.claimed');
  });
});
