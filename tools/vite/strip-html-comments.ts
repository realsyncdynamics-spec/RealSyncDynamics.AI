import type { Plugin } from 'vite';

/**
 * UX-008 — Entwickler-Kommentare (CSP-, Favicon-, Hotfix-Notizen …) aus dem
 * ausgelieferten HTML entfernen. Bedingte IE-Kommentare (`<!--[if …]>`) und
 * Inhalte von <script>/<style> bleiben unberuehrt.
 */
export function stripHtmlComments(html: string): string {
  const parts = html.split(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>)/gi);
  return parts
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part
            .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
            .replace(/^[ \t]*\r?\n/gm, (m, offset, str) => (str[offset - 1] === '\n' ? '' : m)),
    )
    .join('');
}

export function stripHtmlCommentsPlugin(): Plugin {
  return {
    name: 'rsd:strip-html-comments',
    apply: 'build',
    transformIndexHtml: { order: 'post', handler: (html) => stripHtmlComments(html) },
  };
}
