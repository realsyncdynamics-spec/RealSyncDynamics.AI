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
      provider: 'ollama',
      model: 'llama3.1:8b',
      profile: 'quality-local',
      output,
      usage: { input_tokens: 12, output_tokens: 8 },
      trace_id: 't-1',
      latency_ms: 42,
    }),
  };
}

const base: GatewayRequest = { prompt: 'Was verlangt Art. 30 DSGVO?', provider: 'local' };

describe('processAIGatewayRequest — Routing ueber die Edge-Function', () => {
  it('leitet local auf das quality-local-Profil und reicht die echte Ausgabe durch', async () => {
    const client = okClient();
    const res = await processAIGatewayRequest(base, { client });

    expect(client.generate).toHaveBeenCalledTimes(1);
    expect(client.generate.mock.calls[0]![0]).toMatchObject({
      model_profile: 'quality-local',
      task_type: 'chat',
      input: base.prompt,
    });
    expect(res.success).toBe(true);
    expect(res.modelOutput).toBe('echte Modellantwort');
    expect(res.tokensUsed).toBe(20);
  });

  it('meldet den Provider, der tatsaechlich geantwortet hat — nicht den angefragten', async () => {
    const res = await processAIGatewayRequest(base, { client: okClient() });
    expect(res.provider).toBe('ollama');
    expect(res.model).toBe('llama3.1:8b');
  });

  // Kern der Regression: kein Platzhaltertext, kein `success: true`.
  // Seit 26.09. hat das Gateway keine Cloud-Kette: auch openai wird abgelehnt,
  // statt still auf ein lokales Modell umgebogen zu werden.
  it.each(['claude', 'gemini', 'openai'] as const)(
    'lehnt %s ehrlich ab, statt eine Antwort zu erfinden',
    async (provider) => {
      const client = okClient();
      const res = await processAIGatewayRequest({ ...base, provider }, { client });

      expect(res.success).toBe(false);
      expect(res.modelOutput).toBeUndefined();
      expect(res.error).toContain(provider);
      expect(res.error).toContain('Lokales Modell (EU)');
      // Kein Netzwerkaufruf: das Gateway kennt diese Provider nicht.
      expect(client.generate).not.toHaveBeenCalled();
    },
  );

  it('fragt nie das abgeschaltete cloud-fallback-Profil an', async () => {
    for (const provider of ['local', 'openai', 'claude', 'gemini'] as const) {
      const client = okClient();
      await processAIGatewayRequest({ ...base, provider }, { client });
      for (const call of client.generate.mock.calls) {
        expect(call[0].model_profile).not.toBe('cloud-fallback');
      }
    }
  });

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
