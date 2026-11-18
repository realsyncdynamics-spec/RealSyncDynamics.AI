/**
 * Gründerprofil „Bento“ (/design/profil): Vorschau, noIndex.
 * Vertrag: Produkte, Status und Ziele aus landingV3Data.ts, Firma aus config/company.ts,
 * keine unbelegten Aussagen aus dem Design-Entwurf.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProfileBento } from '../../src/pages/ProfileBento';
import { PRODUCTS, RECEPTIONIST } from '../../src/components/landing/v3/landingV3Data';
import { CI_FORBIDDEN_CTA } from '../../src/content/runtimeVocab';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('Gründerprofil — /design/profil', () => {
  it('ist nur Vorschau: eigene Route, noIndex, `/` bleibt Startseite v3', () => {
    const app = read('src/App.tsx');
    expect(app).toContain('<Route path="/design/profil" element={<ProfileBento />} />');
    expect(app).toContain('<Route path="/" element={<LandingV3 />} />');
    expect(read('src/config/seo.ts')).toMatch(/'\/design\/profil': \{[\s\S]*?noIndex: true/);
  });

  it('verlinkt Produkte auf echte Ziele', () => {
    render(<MemoryRouter><ProfileBento /></MemoryRouter>);
    const gov = PRODUCTS.find((p) => p.key === 'governance')!;
    const builder = PRODUCTS.find((p) => p.key === 'app-builder')!;
    expect(screen.getByTestId('profile-product-governance').getAttribute('href')).toContain(gov.href.split('?')[0]);
    expect(screen.getByTestId('profile-product-sites').getAttribute('href')).toContain(builder.href.split('?')[0]);
    expect(screen.getByTestId('profile-product-voice').getAttribute('href')).toContain(RECEPTIONIST.waitlistHref.split('?')[0]);
    expect(screen.getByTestId('profile-contact')).toHaveAttribute('href', '/kontakt');
  });

  it('Wegweiser ordnet Stichwörter zu und verlinkt das Produkt', () => {
    render(<MemoryRouter><ProfileBento /></MemoryRouter>);
    fireEvent.change(screen.getByTestId('profile-query'), { target: { value: 'Telefon-Assistent für meinen Betrieb' } });
    expect(screen.getByTestId('profile-node-voice')).toHaveTextContent('Passt');
    expect(screen.getByTestId('profile-open').getAttribute('href')).toContain('/warteliste');
  });

  it('übernimmt keine unbelegten Aussagen und keine verbotenen CTAs', () => {
    const src = read('src/pages/ProfileBento.tsx').replace(/\/\*\*[\s\S]*?\*\//, '');
    for (const claim of ['Daten in der EU', 'signierten Nachweis', 'Art. 50', 'instagram.com', 'linkedin.com', 'x.com/']) {
      expect(src).not.toContain(claim);
    }
    for (const phrase of CI_FORBIDDEN_CTA) expect(src).not.toContain(phrase);
  });
});
