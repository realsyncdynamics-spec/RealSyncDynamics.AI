/**
 * Explicit, transient snapshot of the SAME governed Playwright executor session.
 *
 * The iframe-based EmbeddedBrowserCanvas is a different client-side preview
 * and MUST NOT be represented as the agent's server-side Chromium frame.
 * Never persist the returned image in localStorage, telemetry or Evidence.
 */
export interface BrowserFrame {
  src: string;
  url: string | null;
  title: string | null;
}

const MAX_PNG_BASE64_CHARS = 8_000_000;

export function browserFrameFromResult(payload: unknown): BrowserFrame | null {
  if (!payload || typeof payload !== 'object') return null;
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results) || results.length === 0) return null;

  // A screenshot is useful only when the last command actually succeeded.
  const last: unknown = results[results.length - 1];
  if (!last || typeof last !== 'object') return null;
  const result = last as Record<string, unknown>;
  if (result.type !== 'screenshot' || result.ok !== true) return null;

  const screenshot = result.screenshot_base64;
  if (typeof screenshot !== 'string' ||
      screenshot.length < 24 ||
      screenshot.length > MAX_PNG_BASE64_CHARS ||
      screenshot.length % 4 !== 0 ||
      !screenshot.startsWith('iVBORw0KGgo') ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(screenshot)) {
    return null;
  }

  let url: string | null = null;
  if (typeof result.url === 'string') {
    try {
      const parsed = new URL(result.url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') url = parsed.toString();
    } catch { /* about:blank or malformed, never show as trusted URL */ }
  }

  return {
    src: `data:image/png;base64,${screenshot}`,
    url,
    title: typeof result.title === 'string' ? result.title.slice(0, 200) : null,
  };
}
