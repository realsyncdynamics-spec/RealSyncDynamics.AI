// ElevenLabs Conversational AI — nur die zwei Aufrufe, die die Bereitstellung
// braucht. Deno-frei (nur fetch), damit der Client in Vitest prüfbar bleibt.
//
//   POST  /v1/convai/agents/{template_id}/duplicate   { name } → { agent_id }
//   PATCH /v1/convai/agents/{agent_id}                { name, tags, platform_settings }
//
// Basis-URL: EU-Datenresidenz per Default. Abweichung nur bewusst über
// ELEVENLABS_API_BASE (z. B. wenn der Workspace nicht EU-residiert ist).

import type { AgentPlatformSettings } from '../_shared/voice-agent-provisioning.ts';
import type { AgentPatch, VoiceProviderClient } from './handler.ts';

export const ELEVENLABS_EU_BASE = 'https://api.eu.residency.elevenlabs.io';
const TIMEOUT_MS = 15_000;

export class ElevenLabsError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export function createElevenLabsClient(
  apiKey: string,
  base: string = ELEVENLABS_EU_BASE,
  fetchImpl: FetchLike = fetch,
): VoiceProviderClient {
  const root = base.replace(/\/+$/, '');

  async function call(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown): Promise<unknown> {
    const res = await fetchImpl(`${root}${path}`, {
      method,
      headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text();
    if (!res.ok) {
      // Nur Status + gekürzte Antwort; der Request (mit Key) wird nie geloggt.
      throw new ElevenLabsError(`elevenlabs ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`, res.status);
    }
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      throw new ElevenLabsError(`elevenlabs ${method} ${path}: invalid JSON`, res.status);
    }
  }

  return {
    async duplicateAgent(templateAgentId, name) {
      const data = await call('POST', `/v1/convai/agents/${encodeURIComponent(templateAgentId)}/duplicate`, { name });
      const agentId = (data as { agent_id?: unknown }).agent_id;
      if (typeof agentId !== 'string' || !agentId) {
        throw new ElevenLabsError('elevenlabs duplicate: response without agent_id', 502);
      }
      return agentId;
    },
    async getAgentSettings(agentId) {
      const data = await call('GET', `/v1/convai/agents/${encodeURIComponent(agentId)}`);
      const settings = (data as { platform_settings?: unknown }).platform_settings;
      return (settings && typeof settings === 'object' ? settings : {}) as AgentPlatformSettings;
    },
    async updateAgent(agentId, patch: AgentPatch) {
      await call('PATCH', `/v1/convai/agents/${encodeURIComponent(agentId)}`, patch);
    },
  };
}
