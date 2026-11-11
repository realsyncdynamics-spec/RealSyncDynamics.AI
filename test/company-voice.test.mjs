import assert from 'node:assert/strict';
import test from 'node:test';
import { answerCompanyQuestion, curatedFacts, formatPriceEur, selectVoiceOutput } from '../company-voice/logic.js';

const facts = curatedFacts();
const answer = (question) => answerCompanyQuestion(question, facts, { publicBeta: false });

test('nennt den Inhaber und keinen erfundenen Preis', () => {
  const founder = answer('Wer ist der Inhaber?');
  assert.equal(founder.covered, true);
  assert.match(founder.text, /Dominik Steiner/);
  assert.match(founder.text, /Einzelunternehmen/);

  const price = answer('Kostet der Starter 49 Euro?');
  assert.match(price.text, new RegExp(formatPriceEur(79).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(price.text, /nicht in der Preisliste/);
  assert.doesNotMatch(price.text, /\b49\b/);
  assert.equal(price.text.includes('4013'), false);
});

test('akzeptiert den deutschen Tausenderpunkt eines Listenpreises', () => {
  const price = answer('Kostet Enterprise 1.498 € im Monat?');
  assert.match(price.text, /1\.498/);
  assert.equal(price.text.includes('nicht in der Preisliste'), false);
});

test('sagt bei einer offenen Frage ehrlich ab', () => {
  const missing = answer('Wie wird das Wetter in Tokio?');
  assert.equal(missing.covered, false);
  assert.match(missing.text, /nichts vor/);
  assert.equal(missing.text.includes('Tokio'), false);
  assert.equal(missing.link.href, '/kontakt');
});

test('erfindet keinen Webdesign-Preis und nennt keine Telefonnummer', () => {
  const design = answer('Was kostet das Webdesign?');
  assert.equal(design.text.includes('€'), false);
  assert.equal(design.link.label, 'Individuelles Webdesign anfragen');
  const phone = answer('Wie ist die Telefonnummer?');
  assert.equal(phone.covered, false);
  assert.doesNotMatch(phone.text, /\+?\d[\d\s/-]{6,}/);
});

test('lässt Straße und Telefon aus den Fakten', () => {
  const blob = facts.map((fact) => fact.text).join('\n');
  assert.equal(blob.includes('Schwarzburger'), false);
  assert.equal(blob.includes('4013'), false);
  assert.match(blob, /Neuhaus am Rennweg/);
  assert.match(blob, /13\.05\.2026/);
});

test('Stimme bleibt die Web Speech API', () => {
  assert.equal(selectVoiceOutput().engine, 'web-speech');
  assert.equal(selectVoiceOutput({ elevenLabsEnabled: true, elevenLabsAgentId: 'should-not-be-used' }).elevenLabs, 'not-bundled');
});
