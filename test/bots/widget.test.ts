/**
 * Einbettungsschnipsel und Laufzeit-Skript des Website-Widgets.
 *
 * Everlast gewinnt, weil nach der Anlage ein Stück HTML auf die Seite kommt.
 * Der Schnipsel muss Art. 50 tragen, ohne dass JavaScript läuft — sonst sieht
 * ein Scan denselben Bot, den unsere eigene Oberfläche ausliefert, als
 * unausgewiesenen Chat.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { botWidgetEmbedHtml, botWidgetSrc } from '../../src/features/bots/widgetSnippet';

const TENANT = '11111111-1111-1111-1111-111111111111';
const BOT = '22222222-2222-2222-2222-222222222222';

function snippet(overrides: Partial<Parameters<typeof botWidgetEmbedHtml>[0]> = {}) {
  return botWidgetEmbedHtml({
    tenantId: TENANT,
    botId: BOT,
    endpointBase: 'https://example.supabase.co/functions/v1',
    widgetSrc: 'https://app.example/bot-widget.js',
    greeting: 'Guten Tag',
    ...overrides,
  });
}

describe('botWidgetEmbedHtml', () => {
  it('trägt das Erkennungssignal und den Transparenzhinweis statisch', () => {
    const html = snippet();

    expect(html).toContain('data-rsd-bot');
    expect(html).toContain('data-ai-disclosure');
    expect(html).toMatch(/Dieser Chat wird von einem KI-System beantwortet/);
    expect(html).toContain(`data-tenant="${TENANT}"`);
    expect(html).toContain(`data-bot="${BOT}"`);
    expect(html).toContain('data-endpoint="https://example.supabase.co/functions/v1/bot-chat"');
    expect(html).toContain('data-greeting="Guten Tag"');
    expect(html).toContain('src="https://app.example/bot-widget.js"');
  });

  it('lässt Anführungszeichen und Tags in Attributen nicht ausbrechen', () => {
    const html = snippet({
      greeting: 'Hallo "Welt" <script>alert(1)</script>',
      endpointBase: 'https://x.example/functions/v1/"onclick="',
    });

    expect(html).not.toContain('Hallo "Welt"');
    expect(html).toContain('Hallo &quot;Welt&quot;');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toMatch(/data-greeting="[^"]*<script/i);
    expect(html).toContain('onclick=&quot;');
  });

  it('lässt die Begrüßung weg, wenn sie leer ist', () => {
    expect(snippet({ greeting: '   ' })).not.toContain('data-greeting');
    expect(snippet({ greeting: null })).not.toContain('data-greeting');
  });
});

describe('botWidgetSrc', () => {
  it('zeigt auf das statische Skript der eigenen Origin', () => {
    expect(botWidgetSrc('https://app.example/')).toBe('https://app.example/bot-widget.js');
  });
});

describe('public/bot-widget.js', () => {
  const source = readFileSync(resolve(__dirname, '../../public/bot-widget.js'), 'utf8');

  it('schreibt Nachrichten über textContent, nicht innerHTML', () => {
    expect(source).toContain('row.textContent = text');
    expect(source).toContain("document.querySelector('[data-rsd-bot]')");
    // innerHTML nur für das statische Panel-Gerüst, nicht für Nutzereingaben.
    expect(source.match(/innerHTML/g)?.length).toBe(1);
  });

  it('legt sessionStorage erst nach der ersten Nachricht an', () => {
    const submitAt = source.indexOf("form.addEventListener('submit'");
    const storageAt = source.indexOf('sessionStorage.setItem');

    expect(submitAt).toBeGreaterThan(0);
    expect(storageAt).toBeGreaterThan(submitAt);
  });

  it('darf nicht ein Jahr immutable gecacht werden', () => {
    const headers = readFileSync(resolve(__dirname, '../../public/_headers'), 'utf8');
    const block = /\/bot-widget\.js\n  Cache-Control:([^\n]+)/.exec(headers);
    expect(block?.[1]).toMatch(/must-revalidate/);
    expect(block?.[1]).not.toMatch(/immutable/);
  });
});

describe('Builder-Verdrahtung', () => {
  it('BotBuilderView zeigt das Schnipsel, SiteOS-Vorschauen injizieren es nicht', () => {
    const builder = readFileSync(resolve(__dirname, '../../src/features/bots/BotBuilderView.tsx'), 'utf8');
    expect(builder).toContain('botWidgetEmbedHtml');
    expect(builder).toContain('Widget einbetten');

    const studio = readFileSync(resolve(__dirname, '../../src/unified-entry/pages/BuildStudioPage.tsx'), 'utf8');
    const preview = readFileSync(resolve(__dirname, '../../src/unified-entry/pages/PreviewSelectionPage.tsx'), 'utf8');
    expect(studio).not.toContain('bot-widget.js');
    expect(preview).not.toContain('bot-widget.js');
  });
});
