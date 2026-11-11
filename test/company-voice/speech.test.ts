import { describe, expect, it } from 'vitest';
import { selectVoiceOutput } from '../../src/lib/company-voice/speech';

describe('Stimme', () => {
  it('bleibt auf der Web Speech API, auch wenn der ElevenLabs-Schalter gesetzt ist', () => {
    expect(selectVoiceOutput().engine).toBe('web-speech');
    expect(selectVoiceOutput().elevenLabs).toBe('disabled');
    const forced = selectVoiceOutput({ elevenLabsEnabled: true, elevenLabsAgentId: 'agent-should-not-be-used' });
    expect(forced.engine).toBe('web-speech');
    expect(forced.elevenLabs).toBe('not-bundled');
  });
});
