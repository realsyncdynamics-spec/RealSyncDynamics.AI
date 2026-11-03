/**
 * PR C, Schritt 4: Kontaktformular einer veröffentlichten Seite → Posteingang.
 *
 * Geprüft
 *   R1  Ohne `inbox`-Option bleibt die Ausgabe byte-identisch (Hash-Stabilität
 *       bestehender Artefakte)
 *   R2  Mit Option: Formular trägt Endpunkt + site_ref, Honeypot-Feld
 *       `company_website`, Statuszeile, Skript genau einmal; kein tenant_id/bot_id
 *   R3  Skript nur auf Seiten mit Formular; Feldzuordnung und Einwilligung
 *   R4  Werte werden escaped (kein Attribut-Ausbruch über site_ref/endpoint)
 */
import { describe, expect, it } from 'vitest';
import {
  INBOX_HONEYPOT_FIELD,
  buildSiteFromPrompt,
  renderPage,
  renderSite,
  type SiteBlueprint,
} from '../../packages/siteos-core/src/index';

const INBOX = { siteRef: 'AbCdEfGhIjKlMnOpQrStUvWx', endpoint: 'https://x.supabase.co/functions/v1/inbox-form-submit' };

async function blueprint(): Promise<SiteBlueprint> {
  const { blueprint } = await buildSiteFromPrompt('Erstelle eine Website für einen Heizungsbauer in Erfurt.', {
    locale: 'de', model: null, createdAt: '2026-11-03T00:00:00.000Z',
  });
  return blueprint;
}

function formPages(bp: SiteBlueprint) {
  return bp.pages.filter((p) => p.blocks.some((b) => b.kind === 'contact-form' || b.kind === 'booking'));
}

describe('renderer inbox form', () => {
  it('R1: ohne Option byte-identisch zum bisherigen Stand', async () => {
    const bp = await blueprint();
    const a = renderSite(bp, { presentation: 'showcase' }).map((p) => p.html).join('\n');
    const b = renderSite(bp, { presentation: 'showcase', inbox: undefined }).map((p) => p.html).join('\n');
    expect(a).toBe(b);
    expect(a).not.toContain('data-inbox-endpoint');
    expect(a).not.toContain(INBOX_HONEYPOT_FIELD);
    expect(a).not.toContain('inbox-form-submit');
  });

  it('R2: mit Option Endpunkt, site_ref, Honeypot, Status und genau ein Skript', async () => {
    const bp = await blueprint();
    const pages = formPages(bp);
    expect(pages.length).toBeGreaterThan(0);
    const html = renderPage(bp, pages[0]!, { presentation: 'showcase', inbox: INBOX });
    expect(html).toContain(`data-inbox-endpoint="${INBOX.endpoint}"`);
    expect(html).toContain(`data-site-ref="${INBOX.siteRef}"`);
    expect(html).toContain(`name="${INBOX_HONEYPOT_FIELD}"`);
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('data-inbox-status');
    expect(html.match(/form\[data-inbox-endpoint\]/g)).toHaveLength(1);
    expect(html).not.toMatch(/tenant_id|bot_id/);
    // Das Skript liegt am Ende des Rumpfs, vor </body>.
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('</body>'));
    expect(html.indexOf('<script>')).toBeGreaterThan(html.indexOf('</form>'));
  });

  it('R3: Skript nur auf Formularseiten; Feldzuordnung, Einwilligung, Nonce', async () => {
    const bp = await blueprint();
    const rendered = renderSite(bp, { presentation: 'showcase', inbox: INBOX });
    const formPaths = new Set(formPages(bp).map((p) => p.path));
    for (const page of rendered) {
      const hasScript = page.html.includes('form[data-inbox-endpoint]');
      expect(hasScript, page.path).toBe(formPaths.has(page.path));
    }
    const script = rendered.find((p) => formPaths.has(p.path))!.html;
    for (const needle of [
      'kontakt_name:val(f,"name")', 'kontakt_email:val(f,"email")', 'kontakt_telefon:val(f,"phone")',
      'anliegen:val(f,"message")', 'terminwunsch:val(f,"slot")', 'einwilligung:consent?!!consent.checked:true',
      'crypto.randomUUID', 'ev.preventDefault()', `body["${INBOX_HONEYPOT_FIELD}"]`,
    ]) {
      expect(script, needle).toContain(needle);
    }
    // Keine Terminbestätigung versprochen.
    expect(script).not.toMatch(/Termin bestätigt|bestätigt/i);
  });

  it('R4: Attributwerte werden escaped', async () => {
    const bp = await blueprint();
    const page = formPages(bp)[0]!;
    const html = renderPage(bp, page, {
      inbox: { siteRef: '"><script>alert(1)</script>', endpoint: 'https://x/fn"onmouseover="x' },
    });
    expect(html).not.toContain('"><script>alert(1)</script>');
    expect(html).toContain('data-site-ref="&quot;&gt;&lt;script&gt;');
    expect(html).not.toContain('"onmouseover="');
  });
});
