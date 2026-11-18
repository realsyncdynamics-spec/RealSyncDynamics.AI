import { describe, expect, it } from 'vitest';
import { microphoneAllowed, selectVoiceOutput } from '../../src/lib/company-voice/speech';

describe('Stimme', () => {
  it('bleibt auf der Web Speech API, auch wenn der ElevenLabs-Schalter gesetzt ist', () => {
    expect(selectVoiceOutput().engine).toBe('web-speech');
    expect(selectVoiceOutput().elevenLabs).toBe('disabled');
    const forced = selectVoiceOutput({ elevenLabsEnabled: true, elevenLabsAgentId: 'agent-should-not-be-used' });
    expect(forced.engine).toBe('web-speech');
    expect(forced.elevenLabs).toBe('not-bundled');
  });

  it('erkennt eine gesperrte Mikrofon-Policy', () => {
    const open = { permissionsPolicy: { allowsFeature: () => true } } as unknown as Document;
    const closed = { featurePolicy: { allowsFeature: () => false } } as unknown as Document;
    expect(microphoneAllowed(open)).toBe(true);
    expect(microphoneAllowed(closed)).toBe(false);
    expect(microphoneAllowed({} as Document)).toBe(true);
  });
});
