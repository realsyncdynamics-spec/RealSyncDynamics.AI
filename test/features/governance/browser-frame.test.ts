import { describe, expect, it } from 'vitest';
import { browserFrameFromResult } from '../../../src/features/governance/browser/browserFrame';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+9WZkAAAAASUVORK5CYII=';

describe('governed agent browser frame (explicit screenshot only)', () => {
  it('shows a successful last screenshot as an in-memory image', () => {
    expect(browserFrameFromResult({
      results: [{ type: 'screenshot', ok: true, url: 'https://example.org/', title: 'Test', screenshot_base64: png }],
    })).toEqual({ src: `data:image/png;base64,${png}`, url: 'https://example.org/', title: 'Test' });
  });

  it('does not accept a failed or non-screenshot executor result', () => {
    expect(browserFrameFromResult({ results: [{ type: 'screenshot', ok: false, screenshot_base64: png }] })).toBeNull();
    expect(browserFrameFromResult({ results: [{ type: 'navigate', ok: true, screenshot_base64: png }] })).toBeNull();
    expect(browserFrameFromResult({ results: [{ type: 'screenshot', ok: true, screenshot_base64: png }, { type: 'navigate', ok: true }] })).toBeNull();
  });

  it('rejects invalid or oversized data and unknown payloads', () => {
    expect(browserFrameFromResult(null)).toBeNull();
    expect(browserFrameFromResult({ results: [] })).toBeNull();
    expect(browserFrameFromResult({ results: [{ type: 'screenshot', ok: true, screenshot_base64: '<svg onload=alert(1)>' }] })).toBeNull();
    expect(browserFrameFromResult({ results: [{ type: 'screenshot', ok: true, screenshot_base64: png + 'A'.repeat(8_000_000) }] })).toBeNull();
  });

  it('does not promote untrusted page URL protocols as safe links', () => {
    const frame = browserFrameFromResult({
      results: [{ type: 'screenshot', ok: true, url: 'javascript:alert(1)', title: 'T', screenshot_base64: png }],
    });
    expect(frame?.url).toBeNull();
  });
});
