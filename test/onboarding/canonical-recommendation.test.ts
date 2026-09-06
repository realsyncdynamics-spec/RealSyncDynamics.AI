/**
 * Kanonische Empfehlung — Befund → Modul → Angebot.
 *
 * Der teuerste Fehler dieser Schicht wäre ein Modulvorschlag, den kein
 * Befund trägt: Der Kunde bekäme ein Angebot, das mit seiner Website nichts
 * zu tun hat. Die Fälle unten prüfen deshalb beides — dass ein Befund das
 * passende Modul **erzeugt** und dass ein fehlender Befund es **nicht**
 * erzeugt.
 */
import { describe, expect, it } from 'vitest';
import {
  BOOKABLE_MODULES,
  bookableModuleById,
  planRank,
  type BookableModuleId,
} from '@/shared/pricing';
import type { GovernanceProfile, ScanFinding, Sector } from '../../src/core/onboarding/types';
import {
  classifyAllFindings,
  groupFindingsByDimension,
  scoreDimensionCriticality,
} from '../../src/core/onboarding/findingClassifier';
import {
  recommendForProfile,
  type CanonicalRecommendation,
} from '../../src/core/onboarding/canonicalRecommendation';
import type { OnboardingChoiceId } from '@/shared/onboarding';

/**
 * Profil wie in `useGovernanceOnboarding()` — dieselben Bausteine, damit der
 * Test gegen die tatsächliche Klassifikation läuft und nicht gegen eine
 * nachgebaute.
 */
function profileFrom(findings: ScanFinding[], sector: Sector = 'generic'): GovernanceProfile {
  const classified = classifyAllFindings(findings);
  const grouped = groupFindingsByDimension(classified);
  const dimensions = Array.from(grouped.keys()).map((dim) => {
    const score = scoreDimensionCriticality(classified, dim);
    return {
      dimension: dim,
      criticalityScore: score,
      needsAddressing: grouped.get(dim)!.some((f) => f.urgency !== 'eventual'),
      recommendedPlan: (score >= 70 ? 'agency' : score >= 40 ? 'growth' : 'starter') as GovernanceProfile['dimensions'][number]['recommendedPlan'],
    };
  });
  const riskLevel = classified.some((f) => f.original.severity === 'critical')
    ? 'critical'
    : classified.some((f) => f.original.severity === 'high')
      ? 'high'
      : 'medium';
  return {
    scanId: 'audit-1',
    domain: 'beispiel.de',
    sector,
    riskLevel,
    findings: classified,
    answers: [],
    dimensions,
  };
}

function finding(over: Partial<ScanFinding> & Pick<ScanFinding, 'id'>): ScanFinding {
  return {
    severity: 'high',
    title: over.id,
    detail: '',
    ...over,
  } as ScanFinding;
}

function moduleIds(rec: CanonicalRecommendation): BookableModuleId[] {
  return rec.recommendedModules.map((m) => m.id);
}

function recommend(findings: ScanFinding[], needs: OnboardingChoiceId[] = []): CanonicalRecommendation {
  return recommendForProfile(profileFrom(findings), needs);
}

// ── A/B/C: Scan → klassifizierte Befunde → Empfehlung ──────────────────────

describe('Scan → Empfehlung', () => {
  it('erzeugt aus Befunden eine Empfehlung mit Plan, Modulen und Begründung', () => {
    const rec = recommend([
      finding({ id: 'tracker_no_consent', severity: 'critical', title: 'Tracking ohne Einwilligung' }),
    ]);
    expect(rec.recommendedPlan).toBeTruthy();
    expect(rec.recommendedModules.length).toBeGreaterThan(0);
    expect(rec.reasoning).not.toBe('');
  });

  it('führt Governance Core auch ohne begründenden Einzelbefund — es ist das Fundament', () => {
    const rec = recommend([finding({ id: 'no_og_tags', severity: 'info', title: 'Open Graph fehlt' })]);
    expect(moduleIds(rec)).toContain('governance_core');
    const core = rec.recommendedModules.find((m) => m.id === 'governance_core')!;
    expect(core.problem).toMatch(/Fundament|Befund/);
  });
});

// ── D/E/F: Befund → konkretes Modul ───────────────────────────────────────

describe('Befund → Modul', () => {
  it('Website-Befund, den ein Neubau behebt → ai_frontend', () => {
    const rec = recommend([
      finding({ id: 'no_imprint_link', severity: 'critical', title: 'Kein Impressum verlinkt' }),
    ]);
    const frontend = rec.recommendedModules.find((m) => m.id === 'ai_frontend');
    expect(frontend).toBeDefined();
    expect(frontend!.evidence).toContain('no_imprint_link');
    expect(frontend!.source).toBe('scan');
    expect(rec.implementationTrack).toBe('modernize_frontend');
  });

  it('DSGVO-Befund → governance_core', () => {
    const rec = recommend([
      finding({
        id: 'cookies_pre_consent',
        severity: 'high',
        title: 'Cookie banner fehlt',
        detail: 'tracking without consent',
      }),
    ]);
    const core = rec.recommendedModules.find((m) => m.id === 'governance_core')!;
    expect(core.evidence).toContain('cookies_pre_consent');
  });

  it('KI-Befund → advanced_ai_governance', () => {
    const rec = recommend([
      finding({
        id: 'rule:AI_ACT_HIGH_RISK',
        severity: 'critical',
        title: 'AI Act Einstufung fehlt',
        detail: 'high risk ai classification missing',
      }),
    ]);
    expect(moduleIds(rec)).toContain('advanced_ai_governance');
  });

  it('erkannter ungeregelter Chat → website_chat als geregelter Ersatz', () => {
    const rec = recommend([
      finding({
        id: 'rule:AI_ACT_LIMITED_RISK_CHATBOT',
        severity: 'low',
        title: 'Chat ohne Art.-50-Hinweis',
      }),
    ]);
    const chat = rec.recommendedModules.find((m) => m.id === 'website_chat');
    expect(chat).toBeDefined();
    expect(chat!.source).toBe('scan');
  });

  it('empfiehlt keinen Kanal, den kein Befund und keine Antwort trägt', () => {
    const rec = recommend([finding({ id: 'no_hsts', severity: 'medium', title: 'HSTS fehlt' })]);
    expect(moduleIds(rec)).not.toContain('whatsapp_bot');
    expect(moduleIds(rec)).not.toContain('voice_bot');
    expect(moduleIds(rec)).not.toContain('booking');
  });

  it('nimmt fetch_failed nicht als Argument für einen Neubau — es ist eine Abbruchbedingung', () => {
    const rec = recommend([finding({ id: 'fetch_failed', severity: 'high', title: 'Seite nicht ladbar' })]);
    expect(moduleIds(rec)).not.toContain('ai_frontend');
  });
});

// ── Q&A ergänzt, ersetzt nicht ────────────────────────────────────────────

describe('Q&A ergänzt die Befunde', () => {
  it('fügt Kanäle hinzu, die kein Scan erkennen kann', () => {
    const rec = recommend([finding({ id: 'no_hsts', severity: 'medium', title: 'HSTS fehlt' })], [
      'channel_whatsapp',
      'domains_1',
      'role_solo',
    ]);
    const whatsapp = rec.recommendedModules.find((m) => m.id === 'whatsapp_bot');
    expect(whatsapp).toBeDefined();
    expect(whatsapp!.source).toBe('answers');
  });

  it('verdrängt keinen Modulvorschlag, den der Scan bereits begründet hat', () => {
    const withoutAnswers = recommend([
      finding({ id: 'no_privacy_link', severity: 'critical', title: 'Keine Datenschutzerklärung verlinkt' }),
    ]);
    const withAnswers = recommend(
      [finding({ id: 'no_privacy_link', severity: 'critical', title: 'Keine Datenschutzerklärung verlinkt' })],
      ['keep_frontend', 'channel_none', 'domains_1', 'role_solo'],
    );
    for (const id of moduleIds(withoutAnswers)) {
      expect(moduleIds(withAnswers)).toContain(id);
    }
    const frontend = withAnswers.recommendedModules.find((m) => m.id === 'ai_frontend')!;
    expect(frontend.source).toBe('scan');
  });

  it('hebt den Plan an, senkt ihn aber nie', () => {
    const base = recommend([finding({ id: 'no_hsts', severity: 'medium', title: 'HSTS fehlt' })]);
    const raised = recommend([finding({ id: 'no_hsts', severity: 'medium', title: 'HSTS fehlt' })], [
      'role_enterprise',
    ]);
    expect(planRank(raised.recommendedPlan)).toBeGreaterThanOrEqual(planRank(base.recommendedPlan));
  });
});

// ── G: Preise aus der SSoT ────────────────────────────────────────────────

describe('Preise', () => {
  it('übernimmt Betrag, Preismodell und Verbrauchshinweis unverändert aus shared/pricing.ts', () => {
    const rec = recommend([
      finding({ id: 'tracker_no_consent', severity: 'critical', title: 'Tracking ohne Einwilligung' }),
    ]);
    for (const entry of rec.recommendedModules) {
      const source = bookableModuleById(entry.id)!;
      expect(entry.priceEur).toBe(source.priceEur);
      expect(entry.priceModel).toBe(source.priceModel);
      expect(entry.usageNote).toBe(source.usageNote);
      expect(entry.name).toBe(source.name);
    }
  });

  it('rechnet die Monatsbasis nicht selbst, sondern über die SSoT-Summenfunktion', () => {
    const rec = recommend([
      finding({ id: 'tracker_no_consent', severity: 'critical', title: 'Tracking ohne Einwilligung' }),
    ]);
    const expected = rec.recommendedModules
      .filter((m) => m.priceModel !== 'per_unit')
      .reduce((sum, m) => sum + m.priceEur, 0);
    expect(rec.estimatedValue.monthlyBaseEur).toBe(expected);
  });
});

// ── Ehrlichkeit über den Kaufweg ──────────────────────────────────────────

describe('Kaufweg', () => {
  it('weist ai_frontend als noch nicht buchbar aus, nennt aber den Weg zum Builder', () => {
    const rec = recommend([
      finding({ id: 'no_imprint_link', severity: 'critical', title: 'Kein Impressum verlinkt' }),
    ]);
    const frontend = rec.recommendedModules.find((m) => m.id === 'ai_frontend')!;
    // `unlocks: []` — kein Plan schaltet Entitlement-Keys frei, also kein Kauf.
    expect(frontend.purchase).toBe('coming_soon');
    expect(frontend.unlockedByPlan).toBeNull();
    // Bauen und Ansehen geht trotzdem: der Builder ist erreichbar.
    expect(frontend.entryRoute).toBe('/build');
  });

  it('nennt für jedes buchbare Modul einen wählbaren Plan', () => {
    const rec = recommend(
      [finding({ id: 'tracker_no_consent', severity: 'critical', title: 'Tracking ohne Einwilligung' })],
      ['channel_web', 'channel_whatsapp', 'channel_voice', 'fw_iso'],
    );
    for (const entry of rec.recommendedModules) {
      if (entry.purchase !== 'bookable') continue;
      expect(entry.unlockedByPlan).not.toBeNull();
    }
  });

  it('erfindet keine Route für ein Modul ohne Oberfläche', () => {
    // `booking` hat laut Capability-Matrix ein Backend, aber keine App-Route.
    const known = BOOKABLE_MODULES.map((m) => m.id);
    expect(known).toContain('booking');
    const rec = recommend([
      finding({ id: 'tracker_no_consent', severity: 'critical', title: 'Tracking ohne Einwilligung' }),
    ]);
    expect(moduleIds(rec)).not.toContain('booking');
  });
});

// ── Massnahmen ohne Verkauf ───────────────────────────────────────────────

describe('Massnahmen', () => {
  it('nennt sofort zu behebende Befunde als Massnahme, nicht als Modul', () => {
    const rec = recommend([
      finding({ id: 'tracker_no_consent', severity: 'critical', title: 'Tracking ohne Einwilligung' }),
    ]);
    expect(rec.recommendedActions.some((a) => a.urgency === 'immediate')).toBe(true);
  });
});
