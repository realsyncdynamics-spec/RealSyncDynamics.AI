// Regel G1 für die Backend-Feststellung, geprüft am Quelltext und am Kern.
//
// ## Der Befund, den diese Datei festnagelt
//
// Der Publish-Gate-Handler las die Backend-Lage aus dem Request
// (`readBackendState(body.backend)`). Damit behauptete der Aufrufer eine der
// fünf Bedingungen, aus denen die Datenbank `publishable` erzeugt — auf zwei
// Wegen:
//
//   { "kind": "greenfield" }                        → preserve_all
//   { "kind": "transformation", comparison: {…} }   → preserve_all,
//                                                     wenn alle Listen leer
//
// Beides ohne jede Nachprüfung. Ein handgebauter Request hob damit die
// Backend-Sperre auf. Genau das schliesst G1 aus.
//
// ## Warum am Quelltext
//
// Dieselbe Bauart wie `publish-gate-ui.test.ts`: Ein Handler, der die
// Eingabe wieder entgegennimmt, verhält sich bei wohlwollenden Testdaten
// unauffällig. Der Unterschied steht im Code, also wird er dort geprüft.
// Die Edge Function selbst braucht Deno und eine Datenbank; was sich ohne
// beides prüfen lässt, ist die Herkunft der Feststellung.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  analyzeBlueprint,
  evaluatePublishGate,
  parseBrief,
  synthesizeBlueprint,
  type SiteBlueprint,
} from '../../packages/siteos-core/src/index';

const handlerSource = readFileSync(
  resolve(__dirname, '../../supabase/functions/siteos/handlers/publish-gate.ts'),
  'utf8',
);

const apiSource = readFileSync(
  resolve(__dirname, '../../src/features/siteos/siteOsApi.ts'),
  'utf8',
);

const claimViewSource = readFileSync(
  resolve(__dirname, '../../src/features/siteos/SiteOsClaimView.tsx'),
  'utf8',
);

describe('Backend-Feststellung — G1 am Quelltext', () => {
  it('der Handler liest die Backend-Lage nicht aus dem Body', () => {
    expect(handlerSource).not.toContain('body.backend');
    expect(handlerSource).not.toContain('readBackendState');
  });

  it('er leitet sie stattdessen aus origin_source ab', () => {
    expect(handlerSource).toContain('deriveBackendState');
    expect(handlerSource).toContain('origin_source');
    expect(handlerSource).toContain("deriveBackendState(row.origin_source)");
  });

  it('nur `ai-builder` gilt als greenfield', () => {
    // Die eine Tatsache, die der Server selbst festgehalten hat. `import`
    // bringt eine Vorgängerseite mit, `manual` sagt nichts über eine —
    // beide dürfen nicht durchrutschen.
    const fn = handlerSource.slice(handlerSource.indexOf('function deriveBackendState'));
    expect(fn).toContain("originSource === 'ai-builder'");
    expect(fn).toContain("kind: 'greenfield'");
    expect(fn).toContain("comparison: null");
  });

  it('das Frontend schickt keine Backend-Behauptung mehr mit', () => {
    // Die Client-Seite derselben Regel. Ein wiedereingeführtes Feld hier
    // wäre folgenlos, solange der Server es ignoriert — aber es wäre die
    // Einladung, den Server wieder darauf hören zu lassen.
    expect(apiSource).not.toContain('PublishBackendInput');
    expect(claimViewSource).not.toContain("kind: 'greenfield'");
  });
});

describe('Backend-Feststellung — Wirkung im Kern', () => {
  function blueprintFor(prompt: string): SiteBlueprint {
    return synthesizeBlueprint(parseBrief(prompt, 'de'), { source: 'ai-builder', model: null });
  }

  /** Bewertung mit ansonsten makellosem Zustand — nur die Backend-Lage variiert. */
  function evaluateWith(backend: Parameters<typeof evaluatePublishGate>[0]['backend']) {
    const blueprint = blueprintFor('Zahnarzt in Hamburg');
    return evaluatePublishGate({
      blueprint,
      findings: analyzeBlueprint(blueprint),
      artifactSha256: 'a'.repeat(64),
      evidence: { snapshotWritten: true, custodyLinked: true },
      backend,
      approval: { grantedForArtifactSha256: null, grantedBy: null, reason: null },
      evaluationId: '00000000-0000-4000-8000-000000000000',
      evaluatedAt: '2026-08-22T21:00:00.000Z',
    });
  }

  it('eine Transformation ohne Vergleich sperrt', () => {
    // Das ist die Lage, die `deriveBackendState` für alles ausser
    // `ai-builder` erzeugt.
    const evaluation = evaluateWith({ kind: 'transformation', comparison: null });
    expect(evaluation.backend_preservation).toBe('unknown');
    expect(evaluation.status).toBe('blocked');
    expect(evaluation.publishable).toBe(false);
  });

  it('ein leerer Vergleich ergibt weiterhin preserve_all — deshalb darf er nicht vom Client kommen', () => {
    // Diese Zusicherung dokumentiert den zweiten Weg, der früher offenstand.
    // Der Kern verhält sich richtig; die Lücke lag darin, WER diesen Wert
    // liefern durfte. Ändert jemand den Kern hier, muss er auch die
    // Herkunftsprüfung oben neu bedenken.
    const evaluation = evaluateWith({
      kind: 'transformation',
      comparison: {
        lostFormTargets: [],
        lostPaymentPaths: [],
        lostBookingPaths: [],
        lostApiEndpoints: [],
        lostConsentCategories: [],
      },
    });
    expect(evaluation.backend_preservation).toBe('preserve_all');
  });

  it('greenfield ergibt preserve_all — die Feststellung muss deshalb belegt sein', () => {
    const evaluation = evaluateWith({ kind: 'greenfield' });
    expect(evaluation.backend_preservation).toBe('preserve_all');
  });

  it('ein verlorenes Formularziel sperrt', () => {
    const evaluation = evaluateWith({
      kind: 'transformation',
      comparison: {
        lostFormTargets: ['/kontakt'],
        lostPaymentPaths: [],
        lostBookingPaths: [],
        lostApiEndpoints: [],
        lostConsentCategories: [],
      },
    });
    expect(evaluation.backend_preservation).toBe('changed');
    expect(evaluation.publishable).toBe(false);
  });
});
