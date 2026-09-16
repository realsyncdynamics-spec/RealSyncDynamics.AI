/**
 * Browser entry into the existing RealSync AI Gateway.
 * Never holds provider keys. Tenant comes from the verified session context,
 * never from the URL.
 */
import { processAIGatewayRequest } from '../../core/ai-gateway/gateway';
import { BUILDER_SYSTEM_PROMPT } from './bolt/system-prompt';

export async function generateViaRealSyncGateway(args: {
  prompt: string;
  tenantId: string;
  files: { path: string; content: string }[];
  repair?: string;
}): Promise<{ ok: true; text: string; model?: string } | { ok: false; error: string }> {
  if (!args.tenantId) {
    return { ok: false, error: 'Kein verifizierter Mandant.' };
  }
  const fileCtx = args.files
    .slice(0, 16)
    .map((f) => `// FILE ${f.path}\n${f.content.slice(0, 6000)}`)
    .join('\n\n');
  const prompt = [
    args.repair ? `Korrekturauftrag:\n${args.repair}` : args.prompt,
    fileCtx ? `\n\nAktueller Projektstand:\n${fileCtx}` : '\n\n(leeres Projekt)',
  ].join('');

  const res = await processAIGatewayRequest({
    prompt: prompt.slice(0, 24_000),
    provider: 'openai',
    systemPrompt: BUILDER_SYSTEM_PROMPT,
    feature: 'app_builder_code',
    tenantId: args.tenantId,
  });
  if (!res.success || !res.modelOutput) {
    return { ok: false, error: res.error ?? 'Gateway ohne Ausgabe' };
  }
  return { ok: true, text: res.modelOutput, model: res.model };
}
