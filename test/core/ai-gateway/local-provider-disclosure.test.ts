import { describe, it, expect } from 'vitest';
import { processorsFor, governanceMeta } from '../../../src/core/ai-gateway/governanceRouterCatalog';

// R-Ollama: die Art.-50-Offenlegung (processors) muss den real bedienenden
// lokalen Provider nennen. Default bleibt LM Studio (Verhalten unverändert);
// mit Ollama-Label wird Ollama genannt.
describe('local-provider disclosure (Art. 50)', () => {
  it('defaults to LM Studio when no label is passed (unchanged behaviour)', () => {
    const p = processorsFor(false, 'eu_local');
    expect(p.join(' ')).toMatch(/LM Studio/);
    expect(p.join(' ')).not.toMatch(/Ollama/);
  });

  it('names Ollama when the Ollama label is supplied (eu_local)', () => {
    const p = processorsFor(false, 'eu_local', 'EU-lokale Inferenz (Ollama)');
    expect(p.join(' ')).toMatch(/Ollama/);
    expect(p.join(' ')).not.toMatch(/LM Studio/);
    // eu_local darf keine Cloud-Verarbeiter offenlegen
    expect(p.join(' ')).not.toMatch(/Anthropic|OpenAI/);
  });

  it('carries the local label into the cloud-fallback disclosure too', () => {
    const p = processorsFor(true, 'cloud', 'EU-lokale Inferenz (Ollama)');
    expect(p.join(' ')).toMatch(/Ollama/);
    expect(p.join(' ')).toMatch(/Anthropic/);
    expect(p.join(' ')).toMatch(/OpenAI/);
  });

  it('governanceMeta forwards the localLabel to processors', () => {
    const meta = governanceMeta({
      residency: 'eu_local',
      stage: 'studio',
      allowCloud: false,
      pdpMode: 'shadow',
      pdpDecision: null,
      localLabel: 'EU-lokale Inferenz (Ollama)',
    });
    expect(meta.processors.join(' ')).toMatch(/Ollama/);
  });
});
