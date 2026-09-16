/**
 * Preview from the in-memory file tree.
 *
 * Uses the same isolation idea as RealSync `SandboxedPreviewFrame`:
 * srcDoc + sandbox tokens. No network, no same-origin. Interactive JS
 * is opt-in and still sandboxed.
 */

import type { FileRecord } from './types';

export type PreviewIsolation = 'static' | 'interactive';

export function sandboxTokens(isolation: PreviewIsolation): string {
  return isolation === 'interactive'
    ? 'allow-scripts allow-forms'
    : '';
}

export function withPreviewCsp(html: string, isolation: PreviewIsolation): string {
  const js = isolation === 'interactive' ? '' : " script-src 'none';";
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline';${js} base-uri 'none'; form-action 'none';">`;
  if (/<head[\s>]/i.test(html)) return html.replace(/<head([^>]*)>/i, `<head$1>${csp}`);
  return `<!doctype html><html><head>${csp}<meta charset="utf-8"></head><body>${html}</body></html>`;
}

export function htmlFromFiles(files: FileRecord[], isolation: PreviewIsolation = 'static'): string {
  const index = files.find((f) => f.path === 'index.html' || f.path.endsWith('/index.html'));
  if (index) return withPreviewCsp(inlineLocal(index.content, files), isolation);

  const css = files.filter((f) => f.path.endsWith('.css')).map((f) => f.content).join('\n');
  const js = isolation === 'interactive'
    ? files.filter((f) => f.path.endsWith('.js')).map((f) => f.content).join('\n')
    : '';
  const md = files.find((f) => f.path.endsWith('.md'));
  const body = md
    ? `<pre>${escapeHtml(md.content)}</pre>`
    : `<pre>${escapeHtml(files.map((f) => `// ${f.path}\n${f.content}`).join('\n\n'))}</pre>`;

  return withPreviewCsp(
    `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}${
      js ? `<script>${js}</script>` : ''
    }</body></html>`,
    isolation,
  );
}

function inlineLocal(html: string, files: FileRecord[]): string {
  let out = html;
  for (const f of files) {
    if (f.path.endsWith('.css')) {
      out = out.replace(
        new RegExp(`<link[^>]+href=["']${escapeReg(f.path)}["'][^>]*>`, 'i'),
        `<style>${f.content}</style>`,
      );
    }
  }
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
