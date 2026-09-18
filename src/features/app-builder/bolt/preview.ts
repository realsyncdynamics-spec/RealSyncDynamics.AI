/**
 * Preview from the in-memory file tree.
 *
 * Isolation and CSP come from `src/lib/preview-sandbox.ts` — one source
 * with SandboxedPreviewFrame. This file only inlines local CSS/JS into
 * index.html. No network, no same-origin, no WebContainer.
 */

import type { FileRecord } from './types';
import {
  withPreviewCsp,
  type PreviewIsolation,
} from '../../../lib/preview-sandbox';

export { sandboxTokens, withPreviewCsp, type PreviewIsolation } from '../../../lib/preview-sandbox';

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
    const names = uniqueNames(f.path);
    for (const name of names) {
      const esc = escapeReg(name);
      if (f.path.endsWith('.css')) {
        out = out.replace(
          new RegExp(`<link[^>]+href=["'](?:\\./)?${esc}["'][^>]*>`, 'gi'),
          `<style>${f.content}</style>`,
        );
      }
      if (f.path.endsWith('.js')) {
        out = out.replace(
          new RegExp(`<script([^>]*?)\\ssrc=["'](?:\\./)?${esc}["']([^>]*)>\\s*</script>`, 'gi'),
          `<script$1$2>${f.content}</script>`,
        );
      }
    }
  }
  return out;
}

function uniqueNames(path: string): string[] {
  const base = path.split('/').pop() ?? path;
  return [...new Set([path, path.replace(/^\.\//, ''), base])];
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&' + 'amp;';
      case '<':
        return '&' + 'lt;';
      case '>':
        return '&' + 'gt;';
      case '"':
        return '&' + 'quot;';
      default:
        return '&#39;';
    }
  });
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
