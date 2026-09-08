import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const susi = readFileSync(resolve(__dirname, '../../src/features/agents/CallAgentSusiPage.tsx'), 'utf8');

describe('Telefon-Assistent ist kein Stub', () => {
  it('legt einen echten Voice-Bot an statt auf PR4 zu verweisen', () => {
    expect(susi).not.toMatch(/Coming in PR4/i);
    expect(susi).not.toMatch(/ElevenLabs/);
    expect(susi).toContain("applyBotGoal('phone_reception'");
    expect(susi).toContain('createBot');
    expect(susi).toContain('/app/bots/${created.id}');
  });
});
