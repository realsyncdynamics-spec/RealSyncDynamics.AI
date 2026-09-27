import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PRODUCTION_SUPABASE_URL } from '../../src/lib/supabaseUrl';
import { previewCsp } from '../../src/lib/preview-sandbox';
import { htmlFromFiles } from '../../src/features/app-builder/bolt/preview';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function headerCsp(): string {
  const text = readFileSync(join(ROOT, 'public/_headers'), 'utf-8');
  const line = text.split('\n').find((l) => l.trim().startsWith('Content-Security-Policy:'));
  if (!line) throw new Error('public/_headers has no Content-Security-Policy');
  return line.replace(/^\s*Content-Security-Policy:\s*/, '').trim();
}

function metaCsp(): string {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf-8');
  const m = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
  if (!m) throw new Error('index.html has no CSP meta');
  return m[1];
}

function directive(csp: string, name: string): string {
  const parts = csp.split(';').map((p) => p.trim());
  const found = parts.find((p) => p.startsWith(`${name} `) || p === name);
  if (!found) throw new Error(`missing ${name} in ${csp}`);
  return found;
}

describe('SPA CSP (Pages + meta)', () => {
  const header = headerCsp();
  const meta = metaCsp();
  const project = new URL(PRODUCTION_SUPABASE_URL).host; // ebljyceifhnlzhjfyxup.supabase.co

  it('does not put supabase in default-src', () => {
    expect(directive(header, 'default-src')).not.toMatch(/supabase/i);
    expect(directive(meta, 'default-src')).not.toMatch(/supabase/i);
  });

  it('lists frame-src explicitly and does not allow arbitrary supabase frames', () => {
    expect(directive(header, 'frame-src')).toContain('https://js.stripe.com');
    expect(directive(header, 'frame-src')).not.toMatch(/\*\.supabase/);
    expect(directive(meta, 'frame-src')).toContain('https://js.stripe.com');
  });

  it('connects only to the production supabase project', () => {
    const connect = directive(header, 'connect-src');
    expect(connect).toContain(`https://${project}`);
    expect(connect).toContain(`wss://${project}`);
    expect(connect).not.toMatch(/\*\.supabase\.co/);
    expect(connect).not.toMatch(/\*\.supabase\.in/);
  });

  it('drops unsafe-inline from script-src (static Pages cannot mint nonces)', () => {
    expect(directive(header, 'script-src')).not.toMatch(/unsafe-inline/);
    expect(directive(header, 'script-src')).not.toMatch(/unsafe-eval/);
    expect(directive(meta, 'script-src')).not.toMatch(/unsafe-inline/);
  });

  it('keeps consent-gated tracker hosts so pixels.ts can load after opt-in', () => {
    expect(directive(header, 'script-src')).toContain('https://www.googletagmanager.com');
    expect(directive(header, 'script-src')).toContain('https://connect.facebook.net');
  });

  it('HTTP header carries frame-ancestors; meta does not (ignored by spec)', () => {
    expect(header).toContain("frame-ancestors 'self'");
    expect(meta).not.toMatch(/frame-ancestors/);
  });
});

describe('Bolt preview uses the canonical preview CSP', () => {
  it('htmlFromFiles injects previewCsp, including connect-src none', () => {
    const html = htmlFromFiles([
      { path: 'index.html', content: '<html><head></head><body>x</body></html>', sha256: 'a'.repeat(64), updatedAt: '', revision: 1 },
    ]);
    expect(html).toContain(previewCsp('static'));
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("frame-src 'none'");
    expect(html).toContain("object-src 'none'");
  });
});
