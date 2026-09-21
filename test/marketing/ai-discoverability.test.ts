/**
 * AI-Discoverability — `public/llms.txt` und die Crawler-Freigaben in
 * `public/robots.txt`.
 *
 * Hintergrund (2026-09-20): `/llms.txt` antwortete mit HTTP 200, lieferte aber
 * die SPA-`index.html` — der Cloudflare-Catch-all, keine Datei. Ein Agent, der
 * die Datei liest, bekam Markup statt Fakten. Die Datei existiert jetzt; dieser
 * Test haelt sie an die Quellen, aus denen ihre Aussagen stammen: Links nur
 * auf Seiten, die die Sitemap kennt, Preise nur aus `shared/pricing.ts`,
 * kein Wortlaut, den `check:landing-claims` auf den Seiten verbietet.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PLANS } from '../../shared/pricing';

const ROOT = resolve(__dirname, '../..');
const llms = readFileSync(resolve(ROOT, 'public/llms.txt'), 'utf8');
const robots = readFileSync(resolve(ROOT, 'public/robots.txt'), 'utf8');
const sitemap = readFileSync(resolve(ROOT, 'public/sitemap.xml'), 'utf8');

const SITE = 'https://realsyncdynamicsai.de';

/** Alle Pfade, auf die llms.txt verlinkt (Markdown-Links und nackte URLs). */
function verlinktePfade(text: string): string[] {
  const pfade = new Set<string>();
  for (const m of text.matchAll(/https:\/\/realsyncdynamicsai\.de(\/[^\s)`"]*)?/g)) {
    pfade.add(m[1] ?? '/');
  }
  return [...pfade];
}

describe('public/llms.txt', () => {
  it('beginnt mit dem Produktnamen als H1', () => {
    expect(llms.split('\n')[0]).toBe('# RealSyncDynamics.AI');
  });

  it('verlinkt nur Seiten, die die Sitemap kennt', () => {
    const bekannt = new Set(
      [...sitemap.matchAll(/<loc>https:\/\/realsyncdynamicsai\.de(\/[^<]*)?<\/loc>/g)].map(
        (m) => m[1] ?? '/',
      ),
    );
    for (const pfad of verlinktePfade(llms)) {
      if (pfad === '/sitemap.xml') continue;
      expect(bekannt.has(pfad), `${pfad} steht nicht in public/sitemap.xml`).toBe(true);
    }
    expect(verlinktePfade(llms).length).toBeGreaterThan(9);
  });

  it('nennt Preise nur so, wie shared/pricing.ts sie fuehrt', () => {
    const byId = new Map(PLANS.map((p) => [p.id, p]));
    for (const [id, label] of [
      ['starter', 'Starter'],
      ['growth', 'Growth'],
      ['agency', 'Agency'],
    ] as const) {
      const plan = byId.get(id);
      expect(plan, `Plan ${id} fehlt in PLANS`).toBeDefined();
      expect(plan!.priceOnRequest).not.toBe(true);
      expect(llms).toContain(`${label}: ${plan!.price.monthlyEur} €/Monat`);
    }
    const free = byId.get('free');
    expect(free?.price.monthlyEur).toBe(0);
    expect(llms).toContain('Free Audit: 0 €');

    // Enterprise: solange die SSoT `priceOnRequest` traegt, darf hier keine
    // Zahl stehen. Faellt das Feld (siehe #1487), muss dieser Test zusammen
    // mit der Datei nachgezogen werden — bewusst kein stilles Umschalten.
    const enterprise = byId.get('enterprise');
    expect(enterprise).toBeDefined();
    if (enterprise!.priceOnRequest) {
      expect(llms).toMatch(/Enterprise: Preis auf Anfrage/);
      expect(llms).not.toContain(String(enterprise!.price.monthlyEur));
      expect(llms).not.toContain('1.249');
    } else {
      expect(llms).toContain(`Enterprise: ab ${enterprise!.price.monthlyEur} €/Monat`);
    }
  });

  it('behauptet keine Vollstaendigkeit und keine Zertifizierung', () => {
    expect(llms).not.toMatch(/vollständig|vollstaendig|100 ?%/i);
    expect(llms).not.toMatch(/zertifiziert|certified|ISO 42001/i);
  });

  it('benennt die Auth-Flaechen als nicht oeffentlich', () => {
    expect(llms).toMatch(/`\/app`/);
    expect(llms).toMatch(/nicht öffentlich/);
  });
});

describe('public/robots.txt — KI-Crawler ausdruecklich freigegeben', () => {
  /** Liest je User-agent-Gruppe die erste Regelzeile. */
  function ersteRegel(agent: string): string | undefined {
    const zeilen = robots.split('\n').map((z: string) => z.trim());
    const i = zeilen.findIndex((z: string) => z.toLowerCase() === `user-agent: ${agent.toLowerCase()}`);
    if (i === -1) return undefined;
    return zeilen.slice(i + 1).find((z: string) => z && !z.startsWith('#'));
  }

  for (const agent of ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) {
    it(`${agent} hat eine eigene Gruppe mit Allow: /`, () => {
      expect(ersteRegel(agent), `${agent}: keine eigene Gruppe`).toBe('Allow: /');
    });
  }

  it('verweist weiterhin auf die Sitemap', () => {
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });
});
