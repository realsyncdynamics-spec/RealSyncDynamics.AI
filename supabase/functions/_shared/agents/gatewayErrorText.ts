// Fehlertext eines ai-gateway-Aufrufs fuer Runner-Reports und Function-Logs.
// Eigenes Modul ohne Deno-/jsr-Importe, damit vitest und tsc es direkt laden.
/**
 * Fehlertext für den Runner-Report (landet in agent-os-runner → errors[]):
 * HTTP-Status + stabiler Gateway-Code + gekürzte Meldung. Keine Prompts.
 */
export async function describeGatewayError(resp: Response): Promise<string> {
  const txt = await resp.text().catch(() => '');
  let code = '';
  let message = '';
  try {
    const j = JSON.parse(txt) as { error?: { code?: string; message?: string } };
    code = j.error?.code ?? '';
    message = j.error?.message ?? '';
  } catch {
    message = txt;
  }
  const short = message.replace(/\s+/g, ' ').trim().slice(0, 200);
  return `ai-gateway ${resp.status}${code ? ` ${code}` : ''}${short ? `: ${short}` : ''}`;
}
