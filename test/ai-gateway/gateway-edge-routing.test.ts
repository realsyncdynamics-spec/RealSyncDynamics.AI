// Der Browser-Einstieg ins AI-Gateway darf niemals eine Antwort erfinden.
//
// Hintergrund: Bis zur Umstellung lieferte `processAIGatewayRequest` fuer
// die Provider `openai` und `claude` fest verdrahtete Platzhaltertexte mit
// `success: true` zurueck. In der Oberflaeche war das von einer echten
// Modellantwort nicht zu unterscheiden — auf einer Seite, die
// Compliance-Auskuenfte gibt. Diese Tests halten fest, dass jede Antwort
// entweder vom Gateway stammt oder als Fehler erkennbar ist.

import { describe, it, expect, vi } from 'vitest';
import {
  processAIGatewayRequest,
  type GatewayRequest,
} from '../../src/core/ai-gateway/gateway';
import { AiGatewayEdgeError } from '../../src/core/ai-gateway/edgeClient';

function okClient(output = 'echte Modellantwort') {
  return {
    generate: vi.fn().mockResolvedValue({
      provider: 'openai',
      model: 'gpt-4.1-mini',
      profile: 'cloud-fallback',
      output,
      usage: { input_tokens: 12, output_tokens: 8 },
      trace_id: 't-1',
      latency_ms: 42,
    }),
  };
}

const base: GatewayRequest = { prompt: 'Was verlangt Art. 30 DSGVO?', provider: 'openai' };

describe('processAIGatewayRequest — Routing ueber die Edge-Function', () => {
  it('leitet openai auf das cloud-fallback-Profil und reicht die echte Ausgabe durch', async () => {
    const client = okClient();
    const res = await processAIGatewayRequest(base, { client });

    expect(client.generate).toHaveBeenCalledTimes(1);
    expect(client.generate.mock.calls[0]![0]).toMatchObject({
      model_profile: 'cloud-fallback',
      task_type: 'chat',
      input: base.prompt,
    });
    expect(res.success).toBe(true);
    expect(res.modelOutput).toBe('echte Modellantwort');
    expect(res.tokensUsed).toBe(20);
  });

  it('meldet den Provider, der tatsaechlich geantwortet hat — nicht den angefragten', async () => {
    const res = await processAIGatewayRequest(base, { client: okClient() });
    expect(res.provider).toBe('openai');
    expect(res.model).toBe('gpt-4.1-mini');
  });

  // Kern der Regression: kein Platzhaltertext, kein `success: true`.
  it.each(['claude', 'gemini'] as const)(
    'lehnt %s ehrlich ab, statt eine Antwort zu erfinden',
    async (provider) => {
      const client = okClient();
      const res = await processAIGatewayRequest({ ...base, provider }, { client });

      expect(res.success).toBe(false);
      expect(res.modelOutput).toBeUndefined();
      expect(res.error).toContain(provider);
      // Kein Netzwerkaufruf: das Gateway kennt diese Provider nicht.
      expect(client.generate).not.toHaveBeenCalled();
    },
  );

  it('faltet den Seitenkontext sichtbar in die Eingabe', async () => {
    const client = okClient();
    await processAIGatewayRequest(
      { ...base, context: 'Cookie-Banner ohne Ablehnen-Schaltflaeche' },
      { client },
    );
    const sent = client.generate.mock.calls[0]![0].input as string;
    expect(sent).toContain('Cookie-Banner ohne Ablehnen-Schaltflaeche');
    expect(sent).toContain(base.prompt);
  });

  it('reicht Feature-Name und Mandant fuer die Gateway-Telemetrie durch', async () => {
    const client = okClient();
    await processAIGatewayRequest(
      { ...base, feature: 'kodee_chat', tenantId: 'tenant-42' },
      { client },
    );
    expect(client.generate.mock.calls[0]![0]).toMatchObject({
      feature: 'kodee_chat',
      tenant_id: 'tenant-42',
    });
  });

  it('gibt einen Gateway-Fehler mit Code zurueck, statt ihn zu verschlucken', async () => {
    const client = {
      generate: vi.fn().mockRejectedValue(
        new AiGatewayEdgeError(503, 'PROVIDER_NOT_CONFIGURED', 'kein Schluessel gesetzt'),
      ),
    };
    const res = await processAIGatewayRequest(base, { client });
    expect(res.success).toBe(false);
    expect(res.error).toContain('PROVIDER_NOT_CONFIGURED');
    expect(res.modelOutput).toBeUndefined();
  });

  it('faengt auch Netzwerkfehler ab, ohne zu werfen', async () => {
    const client = { generate: vi.fn().mockRejectedValue(new Error('offline')) };
    const res = await processAIGatewayRequest(base, { client });
    expect(res).toEqual({ success: false, error: 'offline' });
  });
});
