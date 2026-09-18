import type { FileRecord } from './types';

export interface Diagnostic {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

const PAIRED = ['div', 'section', 'main', 'ul', 'ol', 'table', 'form', 'article', 'header', 'footer', 'nav'];

export function diagnoseFiles(files: FileRecord[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  const hasIndex = files.some((f) => f.path === 'index.html' || f.path.endsWith('/index.html'));
  if (files.length > 0 && !hasIndex) {
    out.push({
      path: 'index.html',
      message: 'Kein index.html — die Vorschau fällt auf die Rohansicht zurück.',
      severity: 'warning',
    });
  }

  for (const f of files) {
    if (!f.content.trim()) {
      out.push({ path: f.path, message: 'Datei ist leer.', severity: 'warning' });
    }
    if (f.path.endsWith('.html')) {
      for (const tag of PAIRED) {
        const open = (f.content.match(new RegExp(`<${tag}\\b`, 'gi')) ?? []).length;
        const close = (f.content.match(new RegExp(`</${tag}>`, 'gi')) ?? []).length;
        if (open !== close) {
          out.push({
            path: f.path,
            message: `<${tag}> unausgeglichen (${open} auf, ${close} zu).`,
            severity: 'error',
          });
        }
      }
    }
    if (/\.(js|ts|tsx)$/.test(f.path)) {
      const opens = (f.content.match(/\{/g) ?? []).length;
      const closes = (f.content.match(/\}/g) ?? []).length;
      if (opens !== closes) {
        out.push({
          path: f.path,
          message: `Geschweifte Klammern unausgeglichen (${opens} / ${closes}).`,
          severity: 'error',
        });
      }
    }
  }
  return out;
}
