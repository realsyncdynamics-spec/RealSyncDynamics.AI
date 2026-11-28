// AP-0.8 – Tests für den normalisierten Claim-Abgleich. Aufruf: npm run test:claims-gate
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findClaim, isException, normalizeClaim } from './claim-match.mjs';

const hit = (line, phrase) => Boolean(findClaim(line, phrase));

test('Schreibvarianten werden erkannt', () => {
  assert.ok(hit('DSGVO- und EU AI Act-konform.', 'EU-AI-Act-konform'));
  assert.ok(hit("title: 'AI Act Compliant',", 'AI Act compliant'));
  assert.ok(hit('AI-Act-konforme Risk-Assessments', 'AI-Act-konform'));
  assert.ok(hit('EU‑Hosting · DSGVO‑konform', 'DSGVO-konform')); // geschützte Bindestriche
  assert.ok(hit('GDPR-compliant data flows', 'GDPR compliant'));
  assert.ok(hit('100&nbsp;% DSGVO', '100 % DSGVO'));
});

test('Beugung ja, Wortverlängerung nein', () => {
  assert.ok(hit('DSGVO-konforme KI-Plattform', 'DSGVO-konform'));
  assert.ok(!hit('Preis: 100% EUR-Rabatt', '100% EU'));
  assert.ok(!hit('nonkonform DSGVO', 'DSGVO-konform'));
});

test('Linke Wortgrenze', () => {
  assert.ok(!hit('XEU AI Act konform', 'EU AI Act konform'));
});

test('Verneinung im selben Satz, höchstens sechs Wörter davor', () => {
  assert.ok(!hit('Das ist nicht automatisch DSGVO-konform.', 'DSGVO-konform'));
  assert.ok(!hit('Kein Tool ist per se DSGVO-konform.', 'DSGVO-konform'));
  assert.ok(hit('Nicht teuer. Und DSGVO-konform.', 'DSGVO-konform'), 'Verneinung im Vorsatz zählt nicht');
  assert.ok(hit('nicht a b c d e f g DSGVO-konform', 'DSGVO-konform'), 'mehr als sechs Wörter Abstand');
});

test('Fragen sind keine Zusicherung, Antworten schon', () => {
  assert.ok(!hit('Ist das DSGVO-konform?', 'DSGVO-konform'));
  assert.ok(!hit('Ab wann muss ich AI-Act-konform sein?', 'AI-Act-konform'));
  assert.ok(hit('Ja, wir sind DSGVO-konform. Fragen?', 'DSGVO-konform'));
});

test('Ausnahmen nur für exakte Datei und Text', () => {
  const ex = [{ file: 'src/pages/A.tsx', text: 'Webdesigner sagt, alles ist DSGVO-konform' }];
  assert.ok(isException('src/pages/A.tsx', 'Unser Webdesigner sagt, alles ist DSGVO‑konform.', ex));
  assert.ok(!isException('src/pages/B.tsx', 'Unser Webdesigner sagt, alles ist DSGVO-konform.', ex));
  assert.ok(!isException('src/pages/A.tsx', 'Wir sind DSGVO-konform.', ex));
});

test('Normalisierung', () => {
  assert.equal(normalizeClaim('  EU–AI_Act Konform '), 'eu ai act konform');
});
