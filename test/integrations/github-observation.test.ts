// GitHub-Beobachtung — Zielarchitektur §9.
//
// Der Kern dieser Prüfung ist nicht, dass die Abbildung „funktioniert",
// sondern dass sie **nicht rät**. Die gefährliche Ausgabe dieser Funktion ist
// nicht ein falscher Befund, sondern ein fehlender: „keine Befunde" liest sich
// als Entwarnung, auch wenn niemand nachgesehen hat.

import { describe, expect, it } from 'vitest';
import {
  GITHUB_DETECTOR,
  deriveGitHubFindings,
  isConclusive,
  issueBodyFor,
  issueTitleFor,
  undeterminedFields,
  type GitHubRepoObservation,
} from '../../supabase/functions/_shared/github-observation';

/** Alles festgestellt, alles in Ordnung — der einzige Fall ohne Befund. */
function cleanRepo(): GitHubRepoObservation {
  return {
    owner: 'realsyncdynamics-spec',
    repo: 'RealSyncDynamics.AI',
    isPrivate: true,
    archived: false,
    defaultBranch: 'main',
    defaultBranchProtected: true,
    vulnerabilityAlertsEnabled: true,
    secretScanningEnabled: true,
    hasSecurityPolicy: true,
    hasLicense: true,
    observedAt: '2026-09-05T10:00:00.000Z',
  };
}

/** Nichts festgestellt — der Fall, in dem Schweigen kein Ergebnis ist. */
function blindRepo(): GitHubRepoObservation {
  return {
    owner: 'acme', repo: 'app',
    isPrivate: null, archived: null, defaultBranch: null,
    defaultBranchProtected: null, vulnerabilityAlertsEnabled: null,
    secretScanningEnabled: null, hasSecurityPolicy: null, hasLicense: null,
    observedAt: '2026-09-05T10:00:00.000Z',
  };
}

describe('null heißt „nicht feststellbar", nicht „nein"', () => {
  it('erzeugt aus einer blinden Beobachtung keinen einzigen Befund', () => {
    // Der wichtigste Test der Datei. Ein Token ohne admin:repo bekommt auf
    // die Branch-Protection einen 403. Daraus „ungeschützt" zu schließen
    // wäre ein erfundener Befund gegen ein fremdes Unternehmen.
    expect(deriveGitHubFindings(blindRepo())).toEqual([]);
  });

  it('meldet dieselbe blinde Beobachtung aber als nicht belastbar', () => {
    const obs = blindRepo();
    expect(isConclusive(obs)).toBe(false);
    expect(undeterminedFields(obs)).toHaveLength(7);
  });

  it('unterscheidet „geprüft und sauber" von „nicht geprüft"', () => {
    // Beide liefern eine leere Befundliste — und genau deshalb muss die
    // Unterscheidung woanders stehen.
    expect(deriveGitHubFindings(cleanRepo())).toEqual([]);
    expect(deriveGitHubFindings(blindRepo())).toEqual([]);

    expect(isConclusive(cleanRepo())).toBe(true);
    expect(isConclusive(blindRepo())).toBe(false);
  });

  it('verlangt für ein belastbares Ergebnis die drei sicherheitsrelevanten Felder', () => {
    for (const field of [
      'defaultBranchProtected',
      'vulnerabilityAlertsEnabled',
      'secretScanningEnabled',
    ] as const) {
      const obs = { ...cleanRepo(), [field]: null };
      expect(isConclusive(obs), `${field} fehlt ⇒ nicht belastbar`).toBe(false);
    }
  });

  it('lässt Lizenz und Sicherheitsrichtlinie das Ergebnis nicht unbelastbar machen', () => {
    // Sie fehlen häufig und sind kein Sicherheitsbefund — ihre
    // Nichtfeststellbarkeit darf den ganzen Lauf nicht entwerten.
    const obs = { ...cleanRepo(), hasLicense: null, hasSecurityPolicy: null };
    expect(isConclusive(obs)).toBe(true);
    expect(undeterminedFields(obs)).toEqual(['security_policy', 'license']);
  });
});

describe('Befunde aus festgestellten Tatsachen', () => {
  it('meldet einen ungeschützten Standard-Branch mit dessen Namen', () => {
    const findings = deriveGitHubFindings({ ...cleanRepo(), defaultBranchProtected: false });
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe('github.no-branch-protection');
    expect(findings[0].severity).toBe('high');
    expect(findings[0].title).toContain('main');
  });

  it('meldet abgeschaltete Sicherheitsfunktionen je einzeln', () => {
    const findings = deriveGitHubFindings({
      ...cleanRepo(),
      vulnerabilityAlertsEnabled: false,
      secretScanningEnabled: false,
    });
    expect(findings.map((f) => f.code).sort()).toEqual([
      'github.secret-scanning-disabled',
      'github.vulnerability-alerts-disabled',
    ]);
    expect(findings.every((f) => f.severity === 'high')).toBe(true);
  });

  it('führt fehlende Lizenz als geringfügig, fehlende Sicherheitsrichtlinie als mittel', () => {
    const findings = deriveGitHubFindings({
      ...cleanRepo(), hasLicense: false, hasSecurityPolicy: false,
    });
    const byCode = Object.fromEntries(findings.map((f) => [f.code, f.severity]));
    expect(byCode['github.no-license']).toBe('low');
    expect(byCode['github.no-security-policy']).toBe('medium');
  });

  it('führt „öffentlich" und „archiviert" als Hinweis, nicht als Mangel', () => {
    const findings = deriveGitHubFindings({
      ...cleanRepo(), isPrivate: false, archived: true,
    });
    expect(findings.map((f) => f.code).sort()).toEqual([
      'github.archived',
      'github.public-repository',
    ]);
    expect(findings.every((f) => f.severity === 'info')).toBe(true);
  });

  it('belegt jeden Sicherheitsbefund mit einer Norm', () => {
    const findings = deriveGitHubFindings({
      ...cleanRepo(),
      defaultBranchProtected: false,
      vulnerabilityAlertsEnabled: false,
      secretScanningEnabled: false,
      hasSecurityPolicy: false,
    });
    for (const f of findings) {
      expect(f.reference, `${f.code} ohne Bezug`).toBeTruthy();
    }
  });
});

describe('Reihenfolge ist reproduzierbar', () => {
  it('sortiert nach Schwere, bei Gleichstand nach Code', () => {
    const broken: GitHubRepoObservation = {
      ...cleanRepo(),
      isPrivate: false,
      defaultBranchProtected: false,
      vulnerabilityAlertsEnabled: false,
      secretScanningEnabled: false,
      hasSecurityPolicy: false,
      hasLicense: false,
    };
    const codes = deriveGitHubFindings(broken).map((f) => f.code);

    // high (3, alphabetisch) → medium → low → info
    expect(codes).toEqual([
      'github.no-branch-protection',
      'github.secret-scanning-disabled',
      'github.vulnerability-alerts-disabled',
      'github.no-security-policy',
      'github.no-license',
      'github.public-repository',
    ]);
  });

  it('hängt nicht von der Feldreihenfolge des Eingabeobjekts ab', () => {
    const a: GitHubRepoObservation = { ...cleanRepo(), hasLicense: false, defaultBranchProtected: false };
    const b: GitHubRepoObservation = { ...cleanRepo(), defaultBranchProtected: false, hasLicense: false };
    expect(deriveGitHubFindings(a)).toEqual(deriveGitHubFindings(b));
  });
});

describe('Aktionsseite — der Text, der bei GitHub landet', () => {
  it('stellt den Befundcode voran, damit ein zweiter Lauf sein Issue wiedererkennt', () => {
    const [finding] = deriveGitHubFindings({ ...cleanRepo(), defaultBranchProtected: false });
    expect(issueTitleFor(finding)).toMatch(/^\[github\.no-branch-protection\] /);
  });

  it('nennt Schwere, Asset und Bezug im Text', () => {
    const [finding] = deriveGitHubFindings({ ...cleanRepo(), secretScanningEnabled: false });
    const body = issueBodyFor(finding, 'acme/app');

    expect(body).toContain('**Schwere:** high');
    expect(body).toContain('**Asset:** acme/app');
    expect(body).toContain('ISO/IEC 27001');
  });

  it('kommt ohne Bezug aus, wenn der Befund keinen hat', () => {
    const [finding] = deriveGitHubFindings({ ...cleanRepo(), isPrivate: false });
    expect(finding.reference).toBeNull();
    expect(issueBodyFor(finding, 'acme/app')).not.toContain('**Bezug:**');
  });

  it('sagt im Text, dass das Urteil nicht bei GitHub liegt (§9 Regel 3)', () => {
    const [finding] = deriveGitHubFindings({ ...cleanRepo(), defaultBranchProtected: false });
    expect(issueBodyFor(finding, 'acme/app')).toContain('§9 Regel 3');
  });
});

describe('Anschluss an public.findings', () => {
  /**
   * Der zulässige Wertebereich aus `_shared/findings.ts`. Hier ausgeschrieben
   * statt importiert, weil ein Typ zur Laufzeit nicht existiert — und weil
   * diese Liste genau die Reibung erzeugt, die gewollt ist: Wer die Kategorie
   * eines Befunds ändert, muss beim Vertrag nachsehen.
   */
  const VALID_CATEGORIES = [
    'consent', 'tracker', 'ai_act', 'tom', 'dpa', 'accessibility',
    'security', 'transparency', 'data_quality', 'documentation', 'other',
  ];

  it('benennt den Detektor stabil', () => {
    // Geht unverändert in die Spalte `detector`. Eine Umbenennung verwaist
    // die Bestandsbefunde.
    expect(GITHUB_DETECTOR).toBe('github-connector');
  });

  it('vergibt nur Kategorien, die recordFinding annimmt', () => {
    // Der Fall, der diesen Test rechtfertigt: Ein naheliegendes
    // `category: "repository"` wäre von `recordFinding` UND vom DB-CHECK
    // abgelehnt worden — zur Laufzeit, in Produktion, nach dem Deploy.
    const all = deriveGitHubFindings({
      ...cleanRepo(),
      isPrivate: false, archived: true,
      defaultBranchProtected: false, vulnerabilityAlertsEnabled: false,
      secretScanningEnabled: false, hasSecurityPolicy: false, hasLicense: false,
    });
    expect(all.length).toBe(7);
    for (const f of all) {
      expect(VALID_CATEGORIES, `${f.code} hat unzulässige Kategorie`).toContain(f.category);
    }
  });

  it('ordnet Sicherheitsmängel security und fehlende Dokumente documentation zu', () => {
    const all = deriveGitHubFindings({
      ...cleanRepo(),
      defaultBranchProtected: false, secretScanningEnabled: false,
      hasSecurityPolicy: false, hasLicense: false,
    });
    const byCode = Object.fromEntries(all.map((f) => [f.code, f.category]));
    expect(byCode['github.no-branch-protection']).toBe('security');
    expect(byCode['github.secret-scanning-disabled']).toBe('security');
    expect(byCode['github.no-security-policy']).toBe('documentation');
    expect(byCode['github.no-license']).toBe('documentation');
  });

  it('trägt bei jedem Befund die Felder, die findings verlangt', () => {
    const findings = deriveGitHubFindings({
      ...cleanRepo(), defaultBranchProtected: false, hasLicense: false,
    });
    for (const f of findings) {
      expect(f.code).toMatch(/^github\./);
      expect(f.title.length).toBeGreaterThan(0);
      expect(f.detail.length).toBeGreaterThan(20);
      expect(['critical', 'high', 'medium', 'low', 'info']).toContain(f.severity);
    }
  });
});
