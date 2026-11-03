import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), 'utf8');

describe('Public AI Act and pricing claims (EU 2026/1744)', () => {
  it('separates general AI Act application from Annex III / Annex I high-risk deadlines', () => {
    const landing = source('src/components/landing/v6/LandingV6View.tsx');
    expect(landing).toContain('02.08.2026');
    expect(landing).toContain('02.12.2027');
    expect(landing).toContain('02.08.2028');
    expect(landing).not.toContain('Transparenzpflichten und Hochrisiko-Systeme nach Anhang III.');
  });

  it('does not advertise the superseded high-risk countdown in FAQ or structured data', () => {
    const faq = source('src/pages/AiActFaq.tsx');
    const seo = source('src/config/seo.ts');
    expect(faq).toContain('2. Dezember 2027');
    expect(faq).toContain('2. August 2028');
    expect(seo).toContain('2. Dezember 2027');
    expect(faq).not.toContain('Die 87 Tage bis zum 2. August 2026');
    expect(seo).not.toContain('High-Risk-Systeme + Sanktionsregime: 2. August 2026');
  });

  it('keeps AI Act serious-incident duties distinct from GDPR notification duties', () => {
    const page = source('src/pages/content/AiActGovernancePage.tsx');
    expect(page).toContain('Art. 73 AI Act');
    expect(page).toContain('Art. 33 DSGVO');
    expect(page).toContain('Art. 6 Abs. 3');
    expect(page).not.toContain('AI-Act-Art.-62-Incident');
  });

  it('removes the discontinued EU ODR link', () => {
    expect(source('src/features/legal/Impressum.tsx'))
      .not.toContain('ec.europa.eu/consumers/odr/');
  });

  it('does not display Voice as fully live or promise calculated performance', () => {
    const bots = source('src/components/pricing/GovernanceBotsSection.tsx');
    const calculator = source('src/components/pricing/CostCalculator.tsx');
    expect(bots).toContain("isImplementationLive('voice-telephony')");
    expect(calculator).toContain('assumedTimeSavingsPercent');
    expect(calculator).not.toContain('websiteMultiplier');
    expect(calculator).not.toContain('efficiencyMap');
  });
});
