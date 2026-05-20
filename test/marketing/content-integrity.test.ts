import { describe, expect, it } from 'vitest';
import { LINKEDIN_POSTS }    from '../../src/marketing/content/linkedin-posts';
import { COLD_EMAILS }       from '../../src/marketing/content/email-sequences';
import { YOUTUBE_SHORTS }    from '../../src/marketing/content/youtube-shorts';
import { SEO_LANDING_IDEAS } from '../../src/marketing/landing/seo-keywords';
import { GOVERNANCE_RUNTIME_LAUNCH } from '../../src/marketing/campaigns/governance-runtime-launch';
import { CTA_TARGETS } from '../../src/marketing/types';

/**
 * Vertraegliche Pflichten aus campaigns/governance-runtime-launch.ts:
 * Diese Tests sind ein Linter fuer Marketing-Copy. Sie schuetzen die
 * Marke davor, dass spaeter jemand „garantiert" oder „Bußgeld droht"
 * in einen Post schreibt.
 */

const FORBIDDEN_PHRASES = [
  'garantiert dsgvo',
  '100 % rechtssicher',
  '100% rechtssicher',
  'bußgeld droht',
  'rechtsgarantie',
  'vollautomatisch rechtlich',
];

function lower(s: string): string {
  return s.toLowerCase();
}

describe('Promotion-Engine Content-Integrity', () => {
  it('Kampagnen-Volumen erfuellt Direktiv-Vorgaben', () => {
    expect(LINKEDIN_POSTS.length).toBeGreaterThanOrEqual(20);
    expect(COLD_EMAILS.length).toBeGreaterThanOrEqual(10);
    expect(YOUTUBE_SHORTS.length).toBeGreaterThanOrEqual(10);
    expect(SEO_LANDING_IDEAS.length).toBeGreaterThanOrEqual(20);
  });

  it('jeder LinkedIn-Post hat einen Hook, Body und CTA aus CTA_TARGETS', () => {
    for (const post of LINKEDIN_POSTS) {
      expect(post.hook.length, post.id).toBeGreaterThan(0);
      expect(post.body.length, post.id).toBeGreaterThan(0);
      expect(CTA_TARGETS[post.cta], `${post.id} unbekannte CTA-Key`).toBeDefined();
    }
  });

  it('jeder LinkedIn-Post hat mindestens einen Hashtag', () => {
    for (const post of LINKEDIN_POSTS) {
      expect(post.hashtags.length, post.id).toBeGreaterThan(0);
    }
  });

  it('jeder Cold-Email-Template hat Subject und Body', () => {
    for (const mail of COLD_EMAILS) {
      expect(mail.subject.length, mail.id).toBeGreaterThan(0);
      expect(mail.body.length, mail.id).toBeGreaterThan(0);
    }
  });

  it('jedes YouTube-Short hat Hook + Proof + Outro + ScreenAction', () => {
    for (const short of YOUTUBE_SHORTS) {
      expect(short.hook.length, short.id).toBeGreaterThan(0);
      expect(short.proof.length, short.id).toBeGreaterThanOrEqual(2);
      expect(short.outro.length, short.id).toBeGreaterThan(0);
      expect(short.screenAction.length, short.id).toBeGreaterThan(0);
      expect(short.targetDurationSeconds).toBeGreaterThanOrEqual(20);
      expect(short.targetDurationSeconds).toBeLessThanOrEqual(75);
    }
  });

  it('jede SEO-Landing-Idee hat Keyword, URL und mind. 2 Long-Tails', () => {
    for (const idea of SEO_LANDING_IDEAS) {
      expect(idea.primaryKeyword.length, idea.id).toBeGreaterThan(0);
      expect(idea.targetUrl.startsWith('/'), idea.id).toBe(true);
      expect(idea.longTailVariants.length, idea.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('alle Asset-IDs sind eindeutig (kein Copy-Paste-Drift)', () => {
    const ids = [
      ...LINKEDIN_POSTS.map((p) => p.id),
      ...COLD_EMAILS.map((m) => m.id),
      ...YOUTUBE_SHORTS.map((s) => s.id),
      ...SEO_LANDING_IDEAS.map((s) => s.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('kein Asset enthaelt verbotene Marketing-Phrasen (Guardrails)', () => {
    const corpus: { id: string; text: string }[] = [];
    for (const post of LINKEDIN_POSTS) {
      corpus.push({ id: post.id, text: `${post.hook}\n${post.body}` });
    }
    for (const mail of COLD_EMAILS) {
      corpus.push({ id: mail.id, text: `${mail.subject}\n${mail.body}` });
    }
    for (const short of YOUTUBE_SHORTS) {
      corpus.push({ id: short.id, text: `${short.hook}\n${short.proof.join('\n')}\n${short.outro}` });
    }
    for (const item of corpus) {
      const text = lower(item.text);
      for (const phrase of FORBIDDEN_PHRASES) {
        expect(text.includes(phrase), `${item.id} enthaelt "${phrase}"`).toBe(false);
      }
    }
  });

  it('CTA_TARGETS deckt mindestens free_audit, partners, pricing, docs_evidence ab', () => {
    expect(CTA_TARGETS.free_audit.href).toBe('/audit');
    expect(CTA_TARGETS.partners).toBeDefined();
    expect(CTA_TARGETS.pricing.href).toBe('/pricing');
    expect(CTA_TARGETS.docs_evidence).toBeDefined();
  });

  it('Kampagne hat 4 messbare Ziele entsprechend Direktiv', () => {
    expect(GOVERNANCE_RUNTIME_LAUNCH.goals.length).toBeGreaterThanOrEqual(4);
    const targets = GOVERNANCE_RUNTIME_LAUNCH.goals.map((g) => g.target);
    expect(targets).toContain(1000); // Free Audits
    expect(targets).toContain(100);  // Trials
    expect(targets).toContain(20);   // Zahlende
    expect(targets).toContain(3);    // Partner
  });

  it('Kampagne dokumentiert Guardrails (mindestens 5)', () => {
    expect(GOVERNANCE_RUNTIME_LAUNCH.guardrails.length).toBeGreaterThanOrEqual(5);
  });
});
