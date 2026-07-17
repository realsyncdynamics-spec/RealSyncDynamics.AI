import { describe, expect, it } from 'vitest';
import {
  EMPTY_SEVERITIES,
  buildRecommendations,
  gradeFromScore,
  monitoringSignal,
  privacyAutopilot,
  securityStatus,
  translateFindingToRecommendation,
  trustSignal,
  visibilitySignal,
  websiteHealth,
} from '../../src/features/smb/lib/businessSignals';
import {
  SMB_ALL_CLEAR_RECOMMENDATIONS,
  SMB_GENERIC_RECOMMENDATION,
  SMB_INDUSTRY_PACKS,
  SMB_MAX_RECOMMENDATIONS,
  SMB_TILES,
} from '../../src/config/smb-experience';

describe('gradeFromScore', () => {
  it('bewertet Schwellen korrekt (80/55)', () => {
    expect(gradeFromScore(100)).toBe('gut');
    expect(gradeFromScore(80)).toBe('gut');
    expect(gradeFromScore(79)).toBe('okay');
    expect(gradeFromScore(55)).toBe('okay');
    expect(gradeFromScore(54)).toBe('handeln');
    expect(gradeFromScore(0)).toBe('handeln');
  });
});

describe('websiteHealth', () => {
  it('zeigt ohne Audit-Score keinen erfundenen Wert', () => {
    const signal = websiteHealth({ auditScore: null, severities: EMPTY_SEVERITIES });
    expect(signal.value).toBeUndefined();
    expect(signal.grade).toBe('okay');
  });

  it('übernimmt den Audit-Score ohne Warnungen unverändert', () => {
    const signal = websiteHealth({ auditScore: 90, severities: EMPTY_SEVERITIES });
    expect(signal.value).toBe(90);
    expect(signal.grade).toBe('gut');
    expect(signal.headline).toBe('Alles in Ordnung');
  });

  it('zieht Malus für kritische und hohe Warnungen ab, bleibt in [0, 100]', () => {
    const signal = websiteHealth({
      auditScore: 90,
      severities: { critical: 2, high: 2, medium: 0, low: 0 },
    });
    // 90 - 2*15 - 2*5 = 50
    expect(signal.value).toBe(50);
    expect(signal.grade).toBe('handeln');

    const floored = websiteHealth({
      auditScore: 10,
      severities: { critical: 5, high: 0, medium: 0, low: 0 },
    });
    expect(floored.value).toBe(0);
  });
});

describe('securityStatus', () => {
  it('meldet bei kritischen Events "handeln"', () => {
    const signal = securityStatus({ critical: 1, high: 0, medium: 0, low: 0 });
    expect(signal.grade).toBe('handeln');
  });

  it('meldet bei hohen bzw. gehäuften mittleren Events "okay"', () => {
    expect(securityStatus({ critical: 0, high: 1, medium: 0, low: 0 }).grade).toBe('okay');
    expect(securityStatus({ critical: 0, high: 0, medium: 3, low: 0 }).grade).toBe('okay');
  });

  it('meldet ohne ernste Events "gut"', () => {
    const signal = securityStatus({ critical: 0, high: 0, medium: 2, low: 10 });
    expect(signal.grade).toBe('gut');
    expect(signal.value).toBe(0);
  });
});

describe('Zähler-Signale', () => {
  it('privacyAutopilot nennt die Anzahl erledigter Aufgaben', () => {
    expect(privacyAutopilot(0).grade).toBe('okay');
    const active = privacyAutopilot(7);
    expect(active.grade).toBe('gut');
    expect(active.headline).toContain('7');
  });

  it('trustSignal nennt die Anzahl gesammelter Nachweise', () => {
    expect(trustSignal(0).grade).toBe('okay');
    expect(trustSignal(12).headline).toContain('12');
  });

  it('monitoringSignal unterscheidet aktiv/inaktiv', () => {
    expect(monitoringSignal(0).grade).toBe('okay');
    const active = monitoringSignal(46);
    expect(active.grade).toBe('gut');
    expect(active.detail).toContain('46');
  });

  it('visibilitySignal nutzt die Score-Schwellen', () => {
    expect(visibilitySignal(null).value).toBeUndefined();
    expect(visibilitySignal(85).grade).toBe('gut');
    expect(visibilitySignal(40).grade).toBe('handeln');
  });
});

describe('translateFindingToRecommendation', () => {
  it('übersetzt technische Befunde in Alltagssprache ohne Fachbegriffe', () => {
    const rec = translateFindingToRecommendation('consent.violation.pre_consent_tracking');
    expect(rec).toContain('Zustimmung');
    // Sprachregel: keine technischen Begriffe auf der Oberfläche.
    expect(rec).not.toMatch(/DSGVO|AI Act|Consent|Policy|Audit/);
  });

  it('matcht case-insensitive per Teilstring', () => {
    expect(translateFindingToRecommendation('Cookie-Banner fehlt')).toContain('Cookie-Hinweis');
    expect(translateFindingToRecommendation('SSL_CERT_EXPIRING')).toContain('sichere Verbindung');
  });

  it('fällt bei unbekannten Befunden auf die generische Empfehlung zurück', () => {
    expect(translateFindingToRecommendation('xyz.unbekannt')).toBe(SMB_GENERIC_RECOMMENDATION);
  });
});

describe('buildRecommendations', () => {
  it('dedupliziert und begrenzt auf das Maximum', () => {
    const recs = buildRecommendations([
      'cookie_banner missing',
      'cookie consent missing', // gleiche Übersetzung wie oben → dedupliziert
      'ssl expired',
      'seo meta description',
      'performance slow lcp',
    ]);
    expect(recs.length).toBe(SMB_MAX_RECOMMENDATIONS);
    expect(new Set(recs).size).toBe(recs.length);
  });

  it('füllt ohne Befunde mit positiven Hinweisen auf', () => {
    const recs = buildRecommendations([]);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.length).toBeLessThanOrEqual(SMB_MAX_RECOMMENDATIONS);
    expect(recs).toContain(SMB_ALL_CLEAR_RECOMMENDATIONS[0]);
  });

  it('bevorzugt Branchen-Tipps beim Auffüllen, wenn die Branche bekannt ist', () => {
    const tattoo = SMB_INDUSTRY_PACKS.find((p) => p.id === 'tattoo')!;
    const recs = buildRecommendations([], 'tattoo');
    expect(recs).toContain(tattoo.extraRecommendations[0]);
  });
});

describe('SMB-Konfiguration', () => {
  it('hält das Kachel-Limit ein (max. 8, min. 5)', () => {
    expect(SMB_TILES.length).toBeGreaterThanOrEqual(5);
    expect(SMB_TILES.length).toBeLessThanOrEqual(8);
  });

  it('verwendet keine technischen Begriffe in Titeln und Erklärungen', () => {
    const forbidden = /DSGVO|AI Act|Evidence Vault|Runtime|Policy|Audit Trail|Prüfpfad|Compliance/i;
    for (const tile of SMB_TILES) {
      expect(tile.title).not.toMatch(forbidden);
      expect(tile.explanation).not.toMatch(forbidden);
    }
  });
});
