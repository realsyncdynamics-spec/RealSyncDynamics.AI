/**
 * Browser entry into the existing RealSync AI Gateway.
 * Never holds provider keys. Tenant comes from the verified session context,
 * never from the URL.
 */
import { processAIGatewayRequest, processAIGatewayStream } from '../../core/ai-gateway/gateway';
import { BUILDER_SYSTEM_PROMPT } from './bolt/system-prompt';
import { formatContextPack, packProjectContext, type ContextFile } from './bolt/context-pack';
import type { Diagnostic } from './bolt/diagnostics';

const BUILDER_TIMEOUT_MS = 90_000;
const BUILDER_MAX_TOKENS = 4096;

export function packBuilderPrompt(args: {
  prompt: string;
  files: ContextFile[];
  repair?: string;
  diagnostics?: Diagnostic[];
  lastChange?: string;
  riskClass?: string;
}): string {
  const pack = packProjectContext({
    prompt: args.prompt,
    files: args.files,
    diagnostics: args.diagnostics,
    lastChange: args.lastChange,
    riskClass: args.riskClass,
  });
  return formatContextPack(pack, args.prompt, args.repair);
}

export async function generateViaRealSyncGateway(args: {
  prompt: string;
  tenantId: string;
  files: { path: string; content: string }[];
  repair?: string;
  diagnostics?: Diagnostic[];
  lastChange?: string;
  riskClass?: string;
}): Promise<{ ok: true; text: string; model?: string } | { ok: false; error: string }> {
  if (!args.tenantId) {
    return { ok: false, error: 'Kein verifizierter Mandant.' };
  }
  const packed = packBuilderPrompt(args);

  const res = await processAIGatewayRequest({
    prompt: packed,
    provider: 'openai',
    systemPrompt: BUILDER_SYSTEM_PROMPT,
    feature: 'app_builder_code',
    tenantId: args.tenantId,
    timeoutMs: BUILDER_TIMEOUT_MS,
    maxTokens: BUILDER_MAX_TOKENS,
  });
  if (!res.success || !res.modelOutput) {
    return { ok: false, error: res.error ?? 'Gateway ohne Ausgabe' };
  }
  return { ok: true, text: res.modelOutput, model: res.model };
}

export async function generateViaRealSyncGatewayStream(
  args: {
    prompt: string;
    tenantId: string;
    files: { path: string; content: string }[];
    repair?: string;
    diagnostics?: Diagnostic[];
    lastChange?: string;
    riskClass?: string;
  },
  onDelta: (full: string) => void,
  signal?: AbortSignal,
): Promise<{ ok: true; text: string; model?: string } | { ok: false; error: string; aborted?: boolean }> {
  if (signal?.aborted) {
    return { ok: false, error: 'Abgebrochen. Es wurde nichts geschrieben.', aborted: true };
  }
  if (!args.tenantId) {
    return { ok: false, error: 'Kein verifizierter Mandant.' };
  }
  const packed = packBuilderPrompt(args);
  const res = await processAIGatewayStream(
    {
      prompt: packed,
      provider: 'openai',
      systemPrompt: BUILDER_SYSTEM_PROMPT,
      feature: 'app_builder_code',
      tenantId: args.tenantId,
      timeoutMs: BUILDER_TIMEOUT_MS,
      maxTokens: BUILDER_MAX_TOKENS,
    },
    (full) => {
      if (!signal?.aborted) onDelta(full);
    },
  );
  if (signal?.aborted) {
    return { ok: false, error: 'Abgebrochen. Es wurde nichts geschrieben.', aborted: true };
  }
  if (!res.success || !res.modelOutput) {
    return { ok: false, error: res.error ?? 'Gateway ohne Ausgabe' };
  }
  return { ok: true, text: res.modelOutput, model: res.model };
}
