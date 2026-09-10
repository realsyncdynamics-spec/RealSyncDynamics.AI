/**
 * Wächter: RealSync Runtime als Produkt im Firmen-Ökosystem.
 *
 * Die Root-SPA bleibt das Governance OS (Scan, Stripe, Self-Service).
 * `/runtime` ist die Product Surface. Richtpreise (ab 4.900 €) dürfen
 * nicht auf dem Self-Service-Pricing landen, CTAs bleiben innerhalb
 * von `runtimeVocab`, Demo-Telemetrie bleibt als Demo gekennzeichnet.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CTA } from '@/src/content/runtimeVocab';
import {
  RUNTIME_PRODUCT,
  RUNTIME_SKU_DISCLAIMER,
  RUNTIME_SKUS,
  RUNTIME_SURFACES,
} from '@/src/content/runtimeProduct';
import { PLATFORM_CAPABILITIES } from '@/src/config/platform-capabilities';

const ROOT = resolve(__dirname, '../..');

function read(rel: string) {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

describe('RealSync Runtime — Product Surface', () => {
  it('SKU-Richtpreise sind als nicht bindend gekennzeichnet', () => {
    expect(RUNTIME_SKUS.length).toBe(3);
    for (const sku of RUNTIME_SKUS) {
      expect(sku.note.toLowerCase()).toMatch(/richtpreis|anfrage|architektur-review/);
    }
    expect(RUNTIME_SKU_DISCLAIMER.toLowerCase()).toContain('richtpreis');
    expect(RUNTIME_SKU_DISCLAIMER.toLowerCase()).toContain('kein self-service');
  });

  it('Richtpreis 4.900 € steht nicht auf dem Self-Service-Pricing', () => {
    const forbidden = [
      'src/content/pricingContent.ts',
      'src/config/pricing.ts',
    ];
    for (const rel of forbidden) {
      const source = read(rel);
      expect(source, `${rel} darf den Runtime-Richtpreis nicht führen.`).not.toMatch(/4[.]900|4900/);
    }
  });

  it('RuntimePage liest Produktcopy und erlaubte CTAs', () => {
    const page = read('src/pages/RuntimePage.tsx');
    expect(page).toContain('runtimeProduct');
    expect(page).toContain('CTA.enterprise');
    expect(page).toContain('CTA.startAudit');
    expect(page).toContain('<h1');
    expect(page).toContain('RUNTIME_PRODUCT.enterpriseHref');
    expect(RUNTIME_PRODUCT.enterpriseHref).toContain('/contact-sales?intent=runtime');
    expect(RUNTIME_SURFACES.every((s) => s.to !== '/governance')).toBe(true);
    expect(RUNTIME_SURFACES.some((s) => s.to === '/governance-runtime')).toBe(true);
    expect(page).not.toMatch(/to="\/governance"/);
  });

  it('Demo-Telemetrie bleibt als Demo gekennzeichnet', () => {
    const page = read('src/pages/RuntimePage.tsx');
    expect(page).toContain('RUNTIME_PRODUCT.demoLabel');
    expect(RUNTIME_PRODUCT.demoLabel.toLowerCase()).toMatch(/demo/);
    expect(RUNTIME_PRODUCT.notSafetyCritical.toLowerCase()).toMatch(/sicherheitszertifizierte/);
  });

  it('AiOperatingSystemSection hat kein Seiten-h1 mehr', () => {
    const section = read('src/components/governance/AiOperatingSystemSection.tsx');
    expect(section).not.toMatch(/<h1[\s>]/);
    expect(section).toMatch(/<h2[\s>]/);
  });

  it('Startseite ergänzt Runtime als Produkt, ohne den Scan-Trichter zu ersetzen', () => {
    const landing = read('src/pages/MainLanding.tsx');
    expect(landing).toContain('RuntimeProductBand');
    expect(landing).toContain('to="/runtime"');
    expect(landing).toContain('/audit?domain=${encodeURIComponent(value)}');
    expect(landing).toContain('LandingChannelTools');
  });

  it('RuntimeProductBand nutzt vorhandene Landing-Tokens und CTA.enterprise', () => {
    const band = read('src/components/landing/RuntimeProductBand.tsx');
    expect(band).toContain('landing-theme');
    expect(band).toContain('CTA.enterprise');
    expect(band).toContain("to=\"/runtime\"");
    expect(band).not.toMatch(/4[.]900|4900/);
  });

  it('Governance-Runtime-Capability führt auf /runtime', () => {
    const cap = PLATFORM_CAPABILITIES.find((c) => c.id === 'governance-runtime');
    expect(cap?.learnMorePath).toBe('/runtime');
    expect(read('src/App.tsx')).toContain('path="/runtime"');
  });

  it('Navbar-Produktziel bleibt /runtime', () => {
    const nav = read('src/components/Navbar.tsx');
    expect(nav).toMatch(/label:\s*'Produkt'[\s\S]*?to:\s*'\/runtime'/);
  });

  it('Explore-CTA kommt aus runtimeVocab', () => {
    expect(CTA.exploreRuntime).toBe('Runtime erkunden');
    expect(RUNTIME_PRODUCT.exploreCta).toBe(CTA.exploreRuntime);
  });

  it('Product-Band-Datei und Content-Quelle existieren', () => {
    expect(existsSync(resolve(ROOT, 'src/components/landing/RuntimeProductBand.tsx'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'src/content/runtimeProduct.ts'))).toBe(true);
  });
});
