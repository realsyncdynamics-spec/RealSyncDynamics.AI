import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHANNEL_TOOLS } from '../../src/components/landing/LandingChannelTools';

const root = resolve(__dirname, '../..');
const app = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');
const cards = readFileSync(resolve(root, 'src/components/landing/LandingChannelTools.tsx'), 'utf8');
const optimizer = readFileSync(resolve(root, 'src/pages/claude-code-optimizer/OptimizerOverview.tsx'), 'utf8');

describe('Four product entries on public landing', () => {
  it('uses exactly four unique product cards and canonical destinations', () => {
    expect(CHANNEL_TOOLS.map((x) => [x.title, x.href])).toEqual([
      ['KI-Bots', '/chatbot/start'],
      ['App Builder', '/build'],
      ['Governance OS', '/app/dashboard'],
      ['Claude Code Optimizer', '/claude-code-optimizer'],
    ]);
  });

  it('all four routes exist in the application router', () => {
    for (const product of CHANNEL_TOOLS) {
      expect(app, product.title).toContain(`path="${product.href}"`);
    }
  });

  it('keeps protected governance workspace behind AppGate', () => {
    expect(app).toMatch(/path="\/app\/dashboard"[^>]*<AppGate>/);
  });

  it('does not silently redirect preview products to the waitlist', () => {
    expect(cards).toContain('to={href}');
    expect(cards).not.toContain("to={live ? href : '/warteliste'}");
    expect(cards).toContain('STATUS_LABEL[status]');
  });

  it('never represents a real Claude Code shell as already available', () => {
    expect(optimizer).toContain('Entwicklungs-Terminal');
    expect(optimizer).toContain('In Vorbereitung');
    expect(optimizer).toContain('Es werden hier keine Befehle ausgeführt.');
    expect(optimizer).not.toContain('executeCommand(');
  });
});
