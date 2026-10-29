import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripHtmlComments } from '../../tools/vite/strip-html-comments';

describe('UX-008 strip developer HTML comments', () => {
  it('removes every developer comment from index.html', () => {
    const src = readFileSync(join(__dirname, '..', '..', 'index.html'), 'utf8');
    expect(src).toContain('<!--');
    const out = stripHtmlComments(src);
    expect(out).not.toContain('<!--');
    expect(out).toContain('<div id="root"');
  });

  it('keeps script/style content and conditional comments', () => {
    const html = '<!-- dev note -->\n<script>var a="<!-- x -->";</script><!--[if IE]>x<![endif]-->';
    const out = stripHtmlComments(html);
    expect(out).not.toContain('dev note');
    expect(out).toContain('var a="<!-- x -->"');
    expect(out).toContain('<!--[if IE]>');
  });
});
