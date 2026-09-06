// Kontingent und Vorschau-Verdrahtung im anonymen Handler.
//
// Am Quelltext geprüft, aus demselben Grund wie in
// `claim-moves-not-rebuilds.test.ts`: Der Handler läuft nur unter Deno mit
// `service_role`; was hier zählt, ist die **Bauform** — welche Prüfung vor
// welcher Arbeit steht und woher ein Wert kommt. Das Verhalten der beiden
// beteiligten Teile ist getrennt geprüft: `anon-preview.test.ts` für den
// Schreibpfad, `siteos-preview-worker.test.ts` für die Ablage.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const handler = readFileSync(
  resolve(ROOT, 'supabase/functions/siteos/handlers/anonymous.ts'),
  'utf-8',
);

/** Rumpf einer benannten Funktion bis zum nächsten `export`/`function` auf Spalte 0. */
function body(name: string): string {
  const start = handler.indexOf(name);
  expect(start, name).toBeGreaterThan(-1);
  const next = handler.indexOf('\nexport ', start + 1);
  const nextFn = handler.indexOf('\nasync function ', start + 1);
  const end = [next, nextFn].filter((i) => i > -1).sort((a, b) => a - b)[0];
  return handler.slice(start, end === undefined ? undefined : end);
}

describe('Kontingent zählt in der Datenbank, nicht im Isolate', () => {
  const quota = body('async function checkBuildQuota');

  it('zählt über ip_hash und ein Zeitfenster', () => {
    expect(quota).toContain("from('siteos_anonymous_builds')");
    expect(quota).toContain(".eq('ip_hash', ipHash)");
    expect(quota).toContain(".gte('created_at', since)");
  });

  it('holt nur die Zahl, nicht die Zeilen', () => {
    // Sonst läse jede Prüfung die Blueprints der letzten 24 Stunden mit.
    expect(quota).toContain("count: 'exact'");
    expect(quota).toContain('head: true');
  });

  it('schliesst bei einem Lesefehler, statt durchzulassen', () => {
    // Ein Kontingent, das bei jedem Fehler alles erlaubt, ist keines.
    expect(quota).toMatch(/if \(error \|\| count === null/);
    expect(quota).toContain("status: 'unavailable'");
  });
});

describe('Das Kontingent steht vor der Arbeit', () => {
  const gate = body('async function openAnonGate');

  it('läuft erst nach Prüfpfad und Burst-Bremse', () => {
    const audit = gate.indexOf('reserveAnonAudit');
    const burst = gate.indexOf('checkAnonRateLimit');
    const quota = gate.indexOf('checkBuildQuota');
    expect(audit).toBeGreaterThan(-1);
    expect(burst).toBeGreaterThan(audit);
    expect(quota).toBeGreaterThan(burst);
  });

  it('gilt nur für neue Sitzungen, nicht für Verfeinerungen', () => {
    // Verfeinerungen sind je Sitzung durch MAX_VERSION begrenzt und legen
    // keine weitere Zeile an — ein zweites Kontingent darauf bestrafte das
    // Arbeiten am eigenen Entwurf.
    expect(gate).toContain("if (op === 'siteos_build_anon')");
  });

  it('trennt „erschöpft" von „nicht lesbar" in Code und Prüfpfad', () => {
    expect(gate).toContain('QUOTA_EXCEEDED');
    expect(gate).toContain('QUOTA_UNAVAILABLE');
    expect(gate).toMatch(/outcome: 'rate_limited', error_code: 'QUOTA_EXCEEDED'/);
    expect(gate).toMatch(/outcome: 'error', error_code: 'QUOTA_UNAVAILABLE'/);
  });
});

describe('Die Vorschau hängt an der Sitzung', () => {
  const store = body('async function storePreview');

  it('legt erst ab und vermerkt dann die Kennung', () => {
    // Andersherum stünde eine Kennung in der Datenbank, hinter der nichts
    // liegt — die Sitzung behauptete eine Adresse, die 404 antwortet.
    const publish = store.indexOf('publishPreview');
    const link = store.indexOf("update({ preview_id: previewId");
    expect(publish).toBeGreaterThan(-1);
    expect(link).toBeGreaterThan(publish);
  });

  it('nimmt die Restzeit der Sitzung als Lebensdauer', () => {
    expect(store).toContain('ttlUntil(expiresAt)');
  });

  it('behält die Kennung über Verfeinerungen hinweg', () => {
    // Ein geteilter Link darf nicht bei jeder Anweisung ungültig werden.
    expect(store).toContain('existingPreviewId ?? createPreviewId');
    const refine = body('export async function handleRefineAnon');
    expect(refine).toContain('session.row.preview_id');
  });

  it('lässt den Bau nicht an der Ablage scheitern', () => {
    // Der Entwurf ist gebaut und gespeichert, bevor die Vorschau entsteht.
    // Eine fehlgeschlagene Ablage nimmt ihm die Adresse, nicht die Existenz.
    expect(store).not.toContain('throw');
    expect(store).toContain("scope: 'siteos_anon_preview_unavailable'");
  });

  it('behauptet keine Adresse ohne konfigurierte Herkunft', () => {
    const describe = body('function describeExisting');
    expect(describe).toContain("status: 'not_configured'");
  });
});

describe('Die Übernahme nimmt die anonyme Vorschau zurück', () => {
  const claim = body('export async function handleClaim');

  it('löscht sie und leert die Spalte', () => {
    expect(claim).toContain('revokePreview(previewTarget(), revokedPreviewId)');
    expect(claim).toContain('update({ preview_id: null');
  });

  it('hält im Prüfpfad fest, welche es war und ob es gelang', () => {
    // Nach dem Nullen der Spalte wäre sonst nicht mehr belegbar, dass
    // überhaupt eine Vorschau im Netz stand.
    expect(claim).toContain('preview_id: revokedPreviewId');
    expect(claim).toContain('preview_revoked: previewRevoked');
  });

  it('macht die Übernahme nicht davon abhängig', () => {
    // Der Claim ist vollzogen; eine Ablage, die nicht antwortet, nimmt ihn
    // nicht zurück.
    const revokeAt = claim.indexOf('revokePreview');
    const insertAt = claim.indexOf("from('siteos_blueprints')");
    expect(insertAt).toBeGreaterThan(-1);
    expect(revokeAt).toBeGreaterThan(insertAt);
  });
});
