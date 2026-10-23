import { describe, expect, it } from 'vitest';
import {
  inferUseCaseCategory,
  runFirstAudit,
  suggestClassification,
  USE_CASE_EXAMPLES,
  type AuditAsset,
} from '../../../../src/features/governance/onboarding/firstAuditModel';

describe('Ersteinordnung nach EU AI Act', () => {
  it('Beispiele aus Schritt 1 erhalten eine nachvollziehbare Einstufung', () => {
    const tiers = Object.fromEntries(
      USE_CASE_EXAMPLES.map((e) => [e.label, suggestClassification(e.name, e.description).tier]),
    );
    expect(tiers).toEqual({
      'ChatGPT im Kundensupport': 'limited',
      'Interner KI-Assistent': 'limited',
      'Bewerber-Screening': 'high',
      'Website-Chatbot': 'limited',
      'WhatsApp-Service-Bot': 'limited',
    });
  });

  it('Hochrisiko sticht Chatbot: „Chatbot für Bewerber“ ist Annex III §4', () => {
    const s = suggestClassification('Recruiting-Chatbot', 'Führt Vorgespräche mit Bewerbern.');
    expect(s.tier).toBe('high');
    expect(s.articleRef).toBe('Annex III §4');
    expect(s.needsReview).toBe(false);
  });

  it('Emotionserkennung am Arbeitsplatz ist verboten, sonst transparenzpflichtig', () => {
    expect(inferUseCaseCategory('Emotionserkennung bei Mitarbeitenden im Callcenter')).toBe('emotion_recognition_work');
    expect(suggestClassification('Stimmungserkennung', 'Analysiert Kundenstimmung im Shop').tier).toBe('limited');
  });

  it('kein Treffer: konservativ „begrenzt“ mit Prüfhinweis, nie still „minimal“', () => {
    const s = suggestClassification('Projekt X', 'Optimiert Lagerbestände.');
    expect(s.category).toBeNull();
    expect(s.tier).toBe('limited');
    expect(s.needsReview).toBe(true);
  });
});

const FRESH: AuditAsset = {
  name: 'Website-Chatbot',
  intended_purpose: 'Beantwortet Kundenanfragen auf unserer Website.',
  owner_email: 'dsb@example.com',
  ai_act_class: 'limited',
  ai_system_type: null,
  deployment_model: null,
  data_residency: null,
};

describe('Erstes Audit', () => {
  it('frisch angelegtes System: fehlende Angaben und offenes Risiko statt „alles gut“', () => {
    const r = runFirstAudit(FRESH, { count: 0, latestAt: null });
    expect(r.score).toBe(43); // 3 von 7 Prüfpunkten
    expect(r.documentationComplete).toBe(false);
    expect(r.missing).toEqual(['Systemtyp', 'Betriebsmodell', 'Datenstandort']);
    expect(r.openRisks).toEqual(['Noch kein Nachweis zu diesem System']);
    expect(r.light).toBe('insufficient_data');
  });

  it('vollständig dokumentiert mit aktuellem Nachweis: 100 und grün', () => {
    const now = new Date('2026-10-18T12:00:00Z');
    const r = runFirstAudit(
      { ...FRESH, ai_system_type: 'bot', deployment_model: 'vendor_cloud', data_residency: 'eu' },
      { count: 2, latestAt: '2026-10-01T00:00:00Z' },
      now,
    );
    expect(r.score).toBe(100);
    expect(r.documentationComplete).toBe(true);
    expect(r.openRisks).toEqual([]);
    expect(r.light).toBe('green');
  });

  it('Hochrisiko ohne Nachweis wird als Risiko benannt', () => {
    const r = runFirstAudit({ ...FRESH, ai_act_class: 'high' }, { count: 0, latestAt: null });
    expect(r.openRisks).toEqual(['Hochrisiko ohne jeden Nachweis']);
    expect(r.light).toBe('red');
  });

  it('Nachweise nicht ladbar: kein geschönter Score', () => {
    expect(runFirstAudit(FRESH, null).score).toBeNull();
  });
});
