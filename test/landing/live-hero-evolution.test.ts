import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HERO_HEADLINE_LINES,
  HERO_HEADLINE_TEST_SUBSTRING,
  HERO_OPERATING_LOOP,
} from '@/src/components/governance-frontend/hero-content';

const landing = readFileSync(resolve(__dirname, '../../src/pages/MainLanding.tsx'), 'utf8');

describe('Landing evolves the live hero — does not replace it', () => {
  it('keeps the production H1 (Das Governance OS)', () => {
    expect(HERO_HEADLINE_TEST_SUBSTRING).toBe('Das Governance OS');
    expect(HERO_HEADLINE_LINES.join(' ')).toMatch(/Das Governance OS/);
    expect(HERO_HEADLINE_LINES.join(' ')).toMatch(/EU AI Act/);
    expect(landing).toContain('HERO_HEADLINE');
  });

  it('does not swap the live German claim for an English rewrite', () => {
    expect(landing).not.toMatch(/AI Governance, Running in Real Time/);
    expect(landing).not.toMatch(/Explore the Governance OS/);
  });

  it('hosts the interactive sphere on the current MainLanding', () => {
    expect(landing).toContain('GovernanceSphereHost');
    expect(HERO_OPERATING_LOOP).toMatch(/Detect/);
  });
});
