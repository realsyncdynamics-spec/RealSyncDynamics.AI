/**
 * Strikte Env-Validierung mit Fail-Fast in Produktion.
 *
 * In NODE_ENV=production muss AGENT_RUNTIME_API_TOKEN gesetzt sein —
 * sonst bricht der Boot ab, bevor der HTTP-Listener startet.
 * Damit wird verhindert, dass der Gateway versehentlich offen ist.
 */

export interface Env {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  apiToken: string | null;
  ollamaUrl: string;
  openclawUrl: string;
  n8nUrl: string;
}

function parsePort(raw: string | undefined): number {
  const value = raw ? Number.parseInt(raw, 10) : 8787;
  if (!Number.isFinite(value) || value < 1 || value > 65535) {
    throw new Error(`Invalid PORT value: ${raw}`);
  }
  return value;
}

export function loadEnv(): Env {
  const nodeEnv = (process.env.NODE_ENV ?? 'development') as Env['nodeEnv'];
  const port = parsePort(process.env.PORT);
  const apiToken = process.env.AGENT_RUNTIME_API_TOKEN?.trim() || null;

  if (nodeEnv === 'production' && !apiToken) {
    // Fail-Fast: ein produktiver Boot ohne Bearer-Token wäre eine
    // offene Tür. Wir bringen den Prozess hier hart zum Stoppen.
    throw new Error(
      'AGENT_RUNTIME_API_TOKEN must be set in production. Refusing to start.',
    );
  }

  return {
    nodeEnv,
    port,
    apiToken,
    ollamaUrl: process.env.OLLAMA_URL ?? 'http://ollama:11434',
    openclawUrl: process.env.OPENCLAW_URL ?? 'http://openclaw:3000',
    n8nUrl: process.env.N8N_URL ?? 'http://n8n:5678',
  };
}
