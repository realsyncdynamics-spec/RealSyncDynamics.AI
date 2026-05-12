/**
 * Shared types fuer Request/Response/WebSocket-Frames.
 */

export interface ChatRequest {
  message: string;
  context?: Record<string, unknown>;
  /** Optionaler conversation_id fuer Multi-Turn-Tracking. */
  conversation_id?: string;
}

export interface ChatResponse {
  ok: true;
  answer: string;
  conversation_id?: string;
  tool_calls_made?: number;
  /** Nachgewiesen genutzte Token aus Sicht der OpenAI-Response. */
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface ApiError {
  ok: false;
  error: { code: string; message: string };
}

export type ChatResult = ChatResponse | ApiError;

// ─── WebSocket-Frames ────────────────────────────────────────────────────────

export interface WsAuthFrame {
  type: 'auth';
  token: string;
}

export interface WsUserMessageFrame {
  type: 'user_message';
  message: string;
  context?: Record<string, unknown>;
  conversation_id?: string;
}

export type WsClientFrame = WsAuthFrame | WsUserMessageFrame;

export interface WsConnectedFrame {
  type: 'connected';
  message: string;
}

export interface WsAuthOkFrame {
  type: 'auth_ok';
}

export interface WsStatusFrame {
  type: 'status';
  message: 'thinking' | 'tool_running' | 'streaming';
}

export interface WsAgentMessageFrame {
  type: 'agent_message';
  message: string;
  conversation_id?: string;
  tool_calls_made?: number;
}

export interface WsErrorFrame {
  type: 'error';
  code: string;
  message: string;
}

export type WsServerFrame =
  | WsConnectedFrame
  | WsAuthOkFrame
  | WsStatusFrame
  | WsAgentMessageFrame
  | WsErrorFrame;
