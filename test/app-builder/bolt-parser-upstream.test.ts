/**
 * Ported from stackblitz-labs/bolt.diy `app/lib/runtime/message-parser.spec.ts` (MIT,
 * Copyright (c) 2024 StackBlitz, Inc. and bolt.diy contributors).
 *
 * Adapted to the RealSync rewrite: our parser returns ParseEvent[] instead of
 * firing callbacks, and is fed the cumulative message (as upstream useMessageParser does).
 * Upstream cases that hold back partial tag prefixes ("Foo bar <bol" → "Foo bar ")
 * are covered by `holds back partial artifact prefix` below.
 */
import { describe, expect, it } from 'vitest';
import { StreamingMessageParser } from '../../src/features/app-builder/bolt/message-parser';
import type { ParseEvent } from '../../src/features/app-builder/bolt/types';

interface Expected {
  output: string;
  callbacks?: { onArtifactOpen?: number; onArtifactClose?: number; onActionOpen?: number; onActionClose?: number };
}

function feed(input: string | string[]): { output: string; events: ParseEvent[] } {
  const chunks = Array.isArray(input) ? input : input.split('');
  const parser = new StreamingMessageParser();
  let acc = '';
  const events: ParseEvent[] = [];
  for (const c of chunks) {
    acc += c;
    events.push(...parser.parse('message_1', acc));
  }
  const output = events.filter((e) => e.kind === 'text').map((e) => (e as { text: string }).text).join('');
  return { output, events };
}

function runTest(input: string | string[], expected: Expected | string) {
  const exp = typeof expected === 'string' ? { output: expected } : expected;
  const { output, events } = feed(input);
  expect(output).toBe(exp.output);
  if (exp.callbacks) {
    const count = (k: ParseEvent['kind']) => events.filter((e) => e.kind === k).length;
    expect({
      onArtifactOpen: count('artifact-open'),
      onArtifactClose: count('artifact-close'),
      onActionOpen: count('action-open'),
      onActionClose: count('action-close'),
    }).toEqual({ onArtifactOpen: 0, onArtifactClose: 0, onActionOpen: 0, onActionClose: 0, ...exp.callbacks });
  }
}

describe('StreamingMessageParser (upstream parity)', () => {
  it('should pass through normal text', () => runTest('Hello, world!', 'Hello, world!'));
  it('should allow normal HTML tags', () =>
    runTest('Hello <strong>world</strong>!', 'Hello <strong>world</strong>!'));

  describe('no artifacts', () => {
    it.each<[string | string[], string]>([
      ['Foo bar', 'Foo bar'],
      ['Foo bar <p', 'Foo bar <p'],
      [['Foo bar <', 's', 'p', 'an>some text</span>'], 'Foo bar <span>some text</span>'],
    ])('chunks (%#)', (input, expected) => runTest(input, expected));
  });

  describe('invalid or incomplete artifacts', () => {
    it.each<[string | string[], string]>([
      ['Foo bar <ba', 'Foo bar <ba'],
      ['Foo bar <bolta', 'Foo bar <bolta'],
      ['Foo bar <boltArtifacs></boltArtifact>', 'Foo bar <boltArtifacs></boltArtifact>'],
      ['Before <oltArtfiact>foo</boltArtifact> After', 'Before <oltArtfiact>foo</boltArtifact> After'],
      ['Before <boltArtifactt>foo</boltArtifact> After', 'Before <boltArtifactt>foo</boltArtifact> After'],
    ])('chunks (%#)', (input, expected) => runTest(input, expected));
  });

  describe('valid artifacts without actions', () => {
    const cb = { onArtifactOpen: 1, onArtifactClose: 1 };
    it.each<[string | string[], Expected]>([
      ['Some text before <boltArtifact title="Some title" id="artifact_1">foo bar</boltArtifact> Some more text', { output: 'Some text before  Some more text', callbacks: cb }],
      [['Some text before <boltArti', 'fact', ' title="Some title" id="artifact_1" type="bundled" >foo</boltArtifact> Some more text'], { output: 'Some text before  Some more text', callbacks: cb }],
      [['Some text before <boltArti', 'fac', 't title="Some title" id="artifact_1"', ' ', '>', 'foo</boltArtifact> Some more text'], { output: 'Some text before  Some more text', callbacks: cb }],
      [['Some text before <boltArti', 'fact', ' title="Some title" id="artifact_1"', ' >fo', 'o</boltArtifact> Some more text'], { output: 'Some text before  Some more text', callbacks: cb }],
      [['Some text before <boltArti', 'fact tit', 'le="Some ', 'title" id="artifact_1">fo', 'o', '<', '/boltArtifact> Some more text'], { output: 'Some text before  Some more text', callbacks: cb }],
      [['Some text before <boltArti', 'fact title="Some title" id="artif', 'act_1">fo', 'o<', '/boltArtifact> Some more text'], { output: 'Some text before  Some more text', callbacks: cb }],
      ['Before <boltArtifact title="Some title" id="artifact_1">foo</boltArtifact> After', { output: 'Before  After', callbacks: cb }],
    ])('chunks (%#)', (input, expected) => runTest(input, expected));
  });

  describe('valid artifacts with actions', () => {
    it.each<[string, Expected]>([
      ['Before <boltArtifact title="Some title" id="artifact_1"><boltAction type="shell">npm install</boltAction></boltArtifact> After', { output: 'Before  After', callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 1, onActionClose: 1 } }],
      ['Before <boltArtifact title="Some title" id="artifact_1"><boltAction type="shell">npm install</boltAction><boltAction type="file" filePath="index.js">some content</boltAction></boltArtifact> After', { output: 'Before  After', callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 2, onActionClose: 2 } }],
    ])('chunks (%#)', (input, expected) => runTest(input, expected));
  });

  describe('malformed actions', () => {
    const input = '<boltArtifact id="artifact_1" title="t"><boltAction type="file">content</boltAction></boltArtifact>';
    it('does not throw when a file action omits filePath (streamed)', () => {
      expect(() => feed(input)).not.toThrow();
    });
    it('keeps a pathless file action instead of dropping its content', () => {
      const closed = new StreamingMessageParser().parse('m', input).find((e) => e.kind === 'action-close');
      expect(closed && closed.kind === 'action-close' && closed.parsed.action.content).toContain('content');
    });
  });

  it('holds back partial artifact prefix so the UI never flashes "<bolt"', () => {
    for (const s of ['Foo bar <', 'Foo bar <b', 'Foo bar <bol', 'Foo bar <bolt', 'Foo bar <boltA']) {
      expect(new StreamingMessageParser().parse('m', s).filter((e) => e.kind === 'text').map((e) => (e as { text: string }).text).join('')).toBe('Foo bar ');
    }
  });
});
