/**
 * Ratsche: Keine neue Seite darf still in die Sitemap rutschen, ohne eigene
 * Meta-Daten zu haben.
 *
 * ## Der Befund
 *
 * `<SEOHead />` hängt props-los und global in `src/App.tsx`. Fehlt ein Pfad in
 * `SEO_CONFIG`, liefert `getSeoForPath` `DEFAULT_SEO` zurück — kein Fehler,
 * keine Warnung, die Seite rendert normal. Genau deshalb konnte die Lücke über
 * Monate wachsen: Stand heute fallen **38 von 117 Sitemap-URLs** auf
 * `DEFAULT_SEO` zurück.
 *
 * ## Warum eine Ratsche und keine 38 Einträge
 *
 * Die 38 Texte auf einmal nachzuziehen ist eine redaktionelle Entscheidung —
 * sie gehört nicht in einen Test und nicht in einen technischen PR. Was hier
 * gesichert wird, ist die Richtung: Die Liste darf schrumpfen, nie wachsen.
 * Der Namespace `/flow` ist nicht betroffen, er wird seit `isFlowPath`
 * fail-closed auf `noindex` gesetzt (siehe `test/seo/flow-namespace-noindex`).
 *
 * ## Zwei Schweregrade, gemessen
 *
 * Die 38 zerfallen in zwei Gruppen, und der Unterschied ist erheblich:
 *
 * - **22 ohne jeden Mechanismus** — diese Seiten liefern tatsächlich den
 *   generischen Title und die generische Description aus `DEFAULT_SEO`. Für
 *   Suchmaschinen sind sie 22 Dubletten derselben Seite.
 * - **16 mit `usePageMeta`** — diese setzen Title und Description imperativ
 *   selbst (teils über `src/pages/content/ContentPageLayout.tsx`). Der Hook
 *   gewinnt, weil `<SEOHead />` in `App.tsx` vor `<RoutesWithTracking />`
 *   steht und sein Effect zuerst läuft. Sichtbar fehlen hier nur `canonical`
 *   und JSON-LD, die der Hook nicht setzt — nicht der Text.
 *
 * Beide Listen stehen unten als Daten. Ihre Vereinigung muss exakt dem
 * entsprechen, was der echte Resolver heute zurückgibt; damit können die
 * Listen nicht unbemerkt von der Wirklichkeit abdriften.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEO, getSeoForPath } from '../../src/config/seo';

const root = resolve(__dirname, '../..');

/** Alle Pfade aus der Sitemap — die Liste, die Suchmaschinen tatsächlich bekommen. */
const sitemapPaths = [
  ...readFileSync(resolve(root, 'public/sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g),
].map((match) => new URL(match[1]).pathname);

/**
 * Liefern den generischen Text aus `DEFAULT_SEO` aus: echte Dubletten.
 * Diese Liste abzuarbeiten ist redaktionelle Arbeit, ein Pfad nach dem anderen.
 */
const OHNE_EIGENE_META = [
  '/about',
  '/ai-act-klassifikator',
  '/ai-act-workflows',
  '/api',
  '/api-docs',
  '/avv-generator',
  '/bait-compliance',
  '/branchen',
  '/changelog',
  '/cookie-compliance',
  '/cookie-consent-sdk',
  '/datenpanne-meldung',
  '/datenschutz-generator',
  '/dokumente-bundle',
  '/enterprise-konfigurator',
  '/eu-ai-act-check',
  '/marisk-audit',
  '/release-notes',
  '/status',
  '/tom-generator',
  '/ueber-uns',
  '/vvt-wizard',
];

/**
 * Setzen Title und Description über `usePageMeta` selbst. Der ausgelieferte
 * Text stimmt; es fehlen `canonical` und JSON-LD aus `SEO_CONFIG`.
 */
const NUR_HOOK_META = [
  '/agent-governance',
  '/ai-act-governance',
  '/automations',
  '/deployment-governance',
  '/docs',
  '/docs/governance',
  '/evidence',
  '/evidence-vault',
  '/google-analytics-consent',
  '/governance-graph',
  '/governance-runtime',
  '/integrations/shopify',
  '/pilot-readiness',
  '/policy-engine',
  '/pre-consent-tracking',
  '/trust',
];

/** Der Stand, auf den die Ratsche heute einrastet. */
const BEKANNTE_LUECKE = [...OHNE_EIGENE_META, ...NUR_HOOK_META];

/** Was der echte Resolver heute als „kein eigener Eintrag" zurückgibt. */
const ohneEintrag = sitemapPaths.filter((path) => getSeoForPath(path) === DEFAULT_SEO);

describe('Sitemap-SEO-Abdeckung — die Lücke darf nur kleiner werden', () => {
  it('liest eine nicht-leere Sitemap', () => {
    expect(sitemapPaths.length).toBeGreaterThan(100);
  });

  it('führt keinen Pfad doppelt', () => {
    expect([...new Set(sitemapPaths)]).toHaveLength(sitemapPaths.length);
  });

  it('lässt keine neue Seite ohne eigene Meta-Daten in die Sitemap', () => {
    const neu = ohneEintrag.filter((path) => !BEKANNTE_LUECKE.includes(path));
    expect(
      neu,
      'Diese Sitemap-Pfade haben keinen Eintrag in SEO_CONFIG und liefern ' +
        'darum Title und Description aus DEFAULT_SEO. Entweder einen Eintrag ' +
        'ergänzen oder den Pfad aus der Sitemap nehmen.',
    ).toEqual([]);
  });

  it('hält die beiden Schweregrad-Listen an der Wirklichkeit', () => {
    const erledigt = BEKANNTE_LUECKE.filter((path) => !ohneEintrag.includes(path));
    expect(
      erledigt,
      'Diese Pfade haben inzwischen einen eigenen SEO_CONFIG-Eintrag (oder ' +
        'stehen nicht mehr in der Sitemap). Aus der Liste oben streichen — ' +
        'die Ratsche rastet dann eine Stufe tiefer ein.',
    ).toEqual([]);
  });

  it('führt keinen Pfad in beiden Schweregrad-Listen', () => {
    const doppelt = OHNE_EIGENE_META.filter((path) => NUR_HOOK_META.includes(path));
    expect(doppelt).toEqual([]);
  });

  it('nimmt den fail-closed abgedeckten /flow-Namespace nicht in die Lücke auf', () => {
    expect(BEKANNTE_LUECKE.filter((path) => path.startsWith('/flow'))).toEqual([]);
  });
});
