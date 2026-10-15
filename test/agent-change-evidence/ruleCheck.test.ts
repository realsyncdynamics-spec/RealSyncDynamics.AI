import { describe, expect, it } from 'vitest';
import { ruleCheck } from '../../supabase/functions/_shared/agentChangeEvidence/ruleCheck';

describe('agentChangeEvidence / ruleCheck', () => {
  it('returns info and empty classes for harmless paths', () => {
    const r = ruleCheck({ paths: ['src/pages/LandingV2.tsx', 'README.md'] });
    expect(r.classes).toEqual([]);
    expect(r.risk_level).toBe('info');
  });

  it('flags .env files as env / high', () => {
    const r = ruleCheck({ paths: ['apps/api/.env', 'config/.env.local'] });
    expect(r.classes).toContain('env');
    expect(r.risk_level).toBe('high');
  });

  it('flags secrets and credentials paths as high', () => {
    const r = ruleCheck({
      paths: ['ops/secrets/prod.yaml', 'certs/server.pem', '.aws/credentials'],
    });
    expect(r.classes).toEqual(expect.arrayContaining(['secrets', 'credentials']));
    expect(r.risk_level).toBe('high');
  });

  it('flags tracking filenames as low', () => {
    const r = ruleCheck({ paths: ['public/gtag-loader.js', 'vendor/hotjar-snippet.ts'] });
    expect(r.classes).toContain('tracking');
    expect(r.risk_level).toBe('low');
  });

  it('flags migration / RLS / policy files as medium', () => {
    const r = ruleCheck({
      paths: [
        'supabase/migrations/20261006120000_agent_change_evidence.sql',
        'db/policies/tenant_rls.sql',
      ],
    });
    expect(r.classes).toContain('policy_files');
    expect(r.risk_level).toBe('medium');
  });

  it('matches in-memory content for model providers without persisting values', () => {
    const r = ruleCheck({
      paths: ['src/lib/ai.ts'],
      contents: ['const url = "https://api.openai.com/v1/chat/completions";'],
    });
    expect(r.classes).toContain('model_providers');
    expect(r.risk_level).toBe('medium');
  });

  it('matches tracking and third-party script URLs in content', () => {
    const r = ruleCheck({
      paths: ['index.html'],
      contents: [
        'src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"',
        'script src="https://cdn.example.com/widget.js"',
      ],
    });
    expect(r.classes).toEqual(expect.arrayContaining(['tracking', 'third_party_scripts']));
  });

  it('escalates to the highest class risk', () => {
    const r = ruleCheck({
      paths: ['.env', 'supabase/migrations/x.sql', 'public/gtag.js'],
    });
    expect(r.risk_level).toBe('high');
    expect(r.classes).toEqual(expect.arrayContaining(['env', 'policy_files', 'tracking']));
  });

  it('never returns secret material — only class names', () => {
    const secretLine = 'AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
    const r = ruleCheck({ paths: ['deploy.sh'], contents: [secretLine] });
    expect(r.classes).toContain('secrets');
    const serialized = JSON.stringify(r);
    expect(serialized).not.toContain('wJalrXUtnFEMI');
    expect(serialized).not.toContain('AWS_SECRET_ACCESS_KEY=');
  });
});
