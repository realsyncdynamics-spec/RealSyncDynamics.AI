/**
 * GET /csrf — setzt Double-Submit-Cookie auf der SPA-Origin.
 * Nicht HttpOnly: der Client kopiert den Wert nach x-csrf-token.
 */
import { csrfSetCookie, mintCsrfToken } from '../src/lib/csrf';

export async function onRequestGet(): Promise<Response> {
  const token = mintCsrfToken();
  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'set-cookie': csrfSetCookie(token),
    },
  });
}
