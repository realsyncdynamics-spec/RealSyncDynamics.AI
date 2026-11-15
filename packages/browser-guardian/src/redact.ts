// Reduktion für Nachweise. Kein Klartext von Eingaben, gelesenen Inhalten
// oder Bildern im Protokoll; keine kurzen Hashes von Eingaben (per
// Wörterbuch rückrechenbar) — nur Länge und Klasse.

import { classifyText } from './classify.ts';
import { sha256Hex } from './crypto.ts';
import type { BrowserAction } from './types.ts';

function redactUrl(raw: string): Record<string, unknown> {
  try {
    const url = new URL(raw);
    const pathClass = classifyText(decodeURIComponent(url.pathname)).data_class;
    return {
      origin: url.origin,
      path: pathClass === 'public' ? url.pathname : `[redacted:${pathClass}]`,
      query_keys: [...new Set(url.searchParams.keys())].sort(),
      has_fragment: url.hash.length > 0,
    };
  } catch {
    return { invalid_url: true, length: raw.length };
  }
}

export function redactAction(action: unknown): Record<string, unknown> {
  if (!action || typeof action !== 'object') return { type: 'invalid' };
  const a = action as Record<string, unknown>;
  const type = typeof a.type === 'string' ? a.type.slice(0, 40) : 'invalid';
  switch (type) {
    case 'navigate':
      return { type, url: typeof a.url === 'string' ? redactUrl(a.url) : null };
    case 'type': {
      const text = typeof a.text === 'string' ? a.text : '';
      return { type, selector: a.selector, text: { length: text.length, data_class: classifyText(text).data_class } };
    }
    case 'select':
      return { type, selector: a.selector, value: '[redacted]' };
    case 'click':
    case 'extract':
      return { type, selector: a.selector ?? null };
    case 'scroll':
      return { type, direction: a.direction, amount: a.amount ?? null };
    case 'wait':
      return { type, milliseconds: a.milliseconds };
    case 'screenshot':
      return { type };
    default:
      // Unbekannte Aktion: nur den Typ festhalten, keine Felder übernehmen.
      return { type, unknown: true };
  }
}

export interface DriverResult {
  ok: boolean;
  url: string | null;
  title?: string;
  text?: string;
  screenshot_png?: Uint8Array;
  error?: string;
  blocked_requests?: number;
}

export async function redactResult(result: DriverResult): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {
    ok: result.ok,
    url: result.url ? redactUrl(result.url) : null,
    title_length: result.title?.length ?? 0,
    error: result.error ?? null,
    blocked_requests: result.blocked_requests ?? 0,
  };
  if (typeof result.text === 'string') {
    const c = classifyText(result.text);
    out.text = { length: result.text.length, data_class: c.data_class, findings: c.findings };
  }
  if (result.screenshot_png) {
    out.screenshot = { bytes: result.screenshot_png.byteLength, sha256: await sha256Hex(result.screenshot_png), persisted: false };
  }
  return out;
}
