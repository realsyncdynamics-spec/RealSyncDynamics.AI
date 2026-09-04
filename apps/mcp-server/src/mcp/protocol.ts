/**
 * MCP-Protokoll (JSON-RPC 2.0) — die Teilmenge, die ein reiner Werkzeug-Server
 * braucht: Handshake, Werkzeugliste, Werkzeugaufruf.
 *
 * Bewusst ohne `@modelcontextprotocol/sdk`: das SDK zieht 17 transitive
 * Abhängigkeiten mit, darunter zod (laut CLAUDE.md nicht ohne Absprache
 * einzuführen) und Express 5 neben dem hier verwendeten Fastify. Der benötigte
 * Ausschnitt des Protokolls ist klein genug, um ihn abhängigkeitsfrei zu
 * halten — wie die übrigen Pakete dieses Repos.
 *
 * Umgesetzt ist die Anfrage/Antwort-Hälfte über HTTP POST. Server-initiierte
 * Nachrichten (SSE-Stream, Fortschritts-Benachrichtigungen, Sampling) fehlen —
 * ein rein lesender Server hat nichts von sich aus zu senden.
 */

/** Protokollfassung, die dieser Server spricht. */
export const PROTOCOL_VERSION = '2025-06-18';

/** Ältere Fassungen, mit denen der Handshake ebenfalls zustande kommt. */
const SUPPORTED_VERSIONS = new Set([PROTOCOL_VERSION, '2025-03-26', '2024-11-05']);

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  /** Fehlt bei Benachrichtigungen — dann erwartet der Client keine Antwort. */
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

/** Fehlercodes nach JSON-RPC 2.0. */
export const RpcCode = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export interface McpToolDefinition {
  name: string;
  description: string;
  /** JSON Schema der Argumente. */
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** Scope, den ein Key für dieses Werkzeug tragen muss. */
  scope: string;
}

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export type ToolInvoker = (
  name: string,
  args: Record<string, unknown>,
) => Promise<McpToolResult>;

export interface HandlerContext {
  tools: McpToolDefinition[];
  invoke: ToolInvoker;
  /** Scopes des verwendeten API-Keys. */
  scopes: string[];
  serverName: string;
  serverVersion: string;
}

export function rpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } };
}

function rpcResult(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

/** Grobprüfung, ob ein Objekt als JSON-RPC-Nachricht durchgeht. */
export function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.jsonrpc === '2.0' && typeof v.method === 'string';
}

/**
 * Verarbeitet eine einzelne JSON-RPC-Nachricht.
 *
 * Gibt `null` zurück, wenn es sich um eine Benachrichtigung handelt (keine
 * `id`) — darauf antwortet der Server nicht, der Aufrufer schickt dann 202.
 */
export async function handleMessage(
  message: JsonRpcRequest,
  ctx: HandlerContext,
): Promise<JsonRpcResponse | null> {
  const isNotification = message.id === undefined;
  const id = message.id ?? null;

  switch (message.method) {
    case 'initialize': {
      const requested = String(message.params?.protocolVersion ?? '');
      // Kennt der Client eine Fassung, die wir sprechen, wird sie bestätigt;
      // sonst nennen wir unsere und der Client entscheidet, ob er mitgeht.
      const agreed = SUPPORTED_VERSIONS.has(requested) ? requested : PROTOCOL_VERSION;
      return rpcResult(id, {
        protocolVersion: agreed,
        // Nur Werkzeuge. Weder Ressourcen noch Prompts noch Sampling —
        // was hier nicht steht, darf der Client nicht anfragen.
        capabilities: { tools: {} },
        serverInfo: { name: ctx.serverName, version: ctx.serverVersion },
      });
    }

    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null;

    case 'ping':
      return isNotification ? null : rpcResult(id, {});

    case 'tools/list': {
      // Werkzeuge, für die der Key keinen Scope hat, werden gar nicht erst
      // angeboten: ein Modell soll nichts vorgeschlagen bekommen, was
      // anschliessend mit 403 endet.
      const visible = ctx.tools
        .filter((t) => ctx.scopes.includes(t.scope))
        .map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
      return rpcResult(id, { tools: visible });
    }

    case 'tools/call': {
      const name = String(message.params?.name ?? '');
      const args = (message.params?.arguments ?? {}) as Record<string, unknown>;

      const tool = ctx.tools.find((t) => t.name === name);
      if (!tool) {
        return rpcError(id, RpcCode.INVALID_PARAMS, `Unbekanntes Werkzeug: ${name}`);
      }
      if (!ctx.scopes.includes(tool.scope)) {
        // Fehlender Scope ist ein Ergebnis des Aufrufs, kein Protokollfehler —
        // so kann das Modell die Begründung sehen und dem Nutzer nennen.
        return rpcResult(id, {
          content: [
            {
              type: 'text',
              text: `Dieser Key hat den Scope "${tool.scope}" nicht und darf ${name} nicht aufrufen.`,
            },
          ],
          isError: true,
        } satisfies McpToolResult);
      }

      try {
        return rpcResult(id, await ctx.invoke(name, args));
      } catch (err) {
        // Fehler bei der Ausführung gehören ins Ergebnis, nicht in die
        // JSON-RPC-Fehlerhülle: der Client soll sie dem Modell zeigen können.
        return rpcResult(id, {
          content: [{ type: 'text', text: (err as Error)?.message ?? 'Unbekannter Fehler' }],
          isError: true,
        } satisfies McpToolResult);
      }
    }

    default:
      if (isNotification) return null;
      return rpcError(id, RpcCode.METHOD_NOT_FOUND, `Unbekannte Methode: ${message.method}`);
  }
}
