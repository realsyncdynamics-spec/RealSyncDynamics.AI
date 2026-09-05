// GitHub als beidseitige Integration — die Beobachtungsseite (Zielarchitektur §9).
//
// ## Warum diese Datei keine Netzaufrufe macht
//
// Der Handler holt die Rohdaten, diese Datei bewertet sie. Die Trennung ist
// nicht Geschmack: Ein Repository-Zustand wird zu **Governance-Befunden**, und
// eine Befund-Ableitung, die nur gegen ein echtes GitHub prüfbar ist, ist nicht
// prüfbar. Hier laufen deshalb reine Funktionen ohne `fetch` und ohne
// Deno-Importe — vitest kann sie direkt laden.
//
// ## Regel 1 aus §9, an einem Anbieter erfüllt
//
// „Jede Integration ist beidseitig: sie liefert Beobachtungen und akzeptiert
// Aktionen. Eine reine Datenabholung ohne Handlungsweg ist ein Datensilo."
//
// Diese Datei ist die Beobachtungshälfte. Die Aktionshälfte (Befund → Issue)
// liegt im Handler, weil sie schreibt.
//
// ## Regel 3 aus §9
//
// „Der Compliance-Zustand eines Fremdsystems wird bei uns geführt, abgeleitet
// aus Beobachtung und Nachweis. Fremdsysteme sind Quelle, nicht Urteil."
//
// Deshalb übernimmt nichts hier eine Bewertung von GitHub. GitHub liefert
// Tatsachen (ist der Branch geschützt? ist Secret Scanning an?); die Severity
// vergeben wir.

/**
 * Die Rohbeobachtung eines Repositories — genau die Felder, die der Handler
 * aus der GitHub-API holt, ohne Umdeutung.
 *
 * `null` heisst durchgängig **nicht feststellbar**, nicht „nein". Der
 * Unterschied ist wichtig: Ein Token ohne `admin:repo`-Recht bekommt auf die
 * Branch-Protection einen 403. Daraus „ungeschützt" zu schliessen wäre ein
 * erfundener Befund.
 */
export interface GitHubRepoObservation {
  owner: string;
  repo: string;
  /** `true` = öffentlich sichtbar. */
  isPrivate: boolean | null;
  archived: boolean | null;
  defaultBranch: string | null;
  /** Branch-Protection auf dem Standard-Branch. */
  defaultBranchProtected: boolean | null;
  /** Dependabot/Vulnerability Alerts aktiv. */
  vulnerabilityAlertsEnabled: boolean | null;
  /** GitHub Secret Scanning aktiv. */
  secretScanningEnabled: boolean | null;
  /** SECURITY.md vorhanden. */
  hasSecurityPolicy: boolean | null;
  hasLicense: boolean | null;
  /** Zeitpunkt der Beobachtung, ISO-8601. */
  observedAt: string;
}

export type GitHubFindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Kategorie in `public.findings`.
 *
 * Bewusst auf die Werte beschränkt, die `FindingCategory` in
 * `_shared/findings.ts` zulässt — `recordFinding` prüft dagegen, und der
 * DB-CHECK ebenfalls. Ein eigener Wert wie `repository` wäre an beiden
 * Stellen abgelehnt worden; die Kategorie beschreibt hier die **Art des
 * Mangels**, nicht die Herkunft. Woher der Befund kommt, sagt `detector`.
 */
export type GitHubFindingCategory = 'security' | 'documentation' | 'other';

/**
 * Ein Befund am Asset. Bewusst der Form von `public.findings` nachgebildet
 * (`category`, `severity`, `detector`, `title`) — der Handler schreibt ihn
 * dorthin, ohne die Felder unterwegs umzubenennen.
 */
export interface GitHubFinding {
  /** Stabile Kennung, Präfix `github.` wie bei den SiteOS-Dimensionen. */
  code: string;
  category: GitHubFindingCategory;
  severity: GitHubFindingSeverity;
  title: string;
  /** Warum das ein Befund ist — in Produktsprache, nicht als API-Feldname. */
  detail: string;
  /** Norm oder Standard, auf den sich der Befund stützt. `null` wo keiner greift. */
  reference: string | null;
}

/** `findings.detector` — welche Teilkomponente den Befund erzeugt hat. */
export const GITHUB_DETECTOR = 'github-connector';

/**
 * Leitet Governance-Befunde aus einer Repository-Beobachtung ab.
 *
 * Deterministisch und sortiert: gleiche Beobachtung ⇒ gleiche Liste in
 * gleicher Reihenfolge. Sonst wäre ein Vergleich zweier Läufe („was hat sich
 * geändert?") vom Zufall abhängig.
 */
export function deriveGitHubFindings(obs: GitHubRepoObservation): GitHubFinding[] {
  const findings: GitHubFinding[] = [];

  // Ein archiviertes Repository ist kein Mangel, aber es erklärt, warum die
  // übrigen Befunde niemand mehr behebt. Es steht deshalb als Hinweis dabei.
  if (obs.archived === true) {
    findings.push({
      code: 'github.archived',
      category: 'other',
      severity: 'info',
      title: 'Repository ist archiviert',
      detail: 'Änderungen sind gesperrt. Befunde an diesem Asset lassen sich nicht mehr beheben, ohne es zu reaktivieren.',
      reference: null,
    });
  }

  if (obs.defaultBranchProtected === false) {
    findings.push({
      code: 'github.no-branch-protection',
      category: 'security',
      severity: 'high',
      title: `Standard-Branch "${obs.defaultBranch ?? 'unbekannt'}" ist ungeschützt`,
      detail: 'Ohne Branch-Protection kann ohne Review und ohne grüne Prüfung direkt auf den Auslieferungsstand geschrieben werden. Ein Vier-Augen-Prinzip ist damit nicht durchgesetzt, sondern nur vereinbart.',
      reference: 'ISO/IEC 27001:2022 A.8.32 (Change Management)',
    });
  }

  if (obs.vulnerabilityAlertsEnabled === false) {
    findings.push({
      code: 'github.vulnerability-alerts-disabled',
      category: 'security',
      severity: 'high',
      title: 'Sicherheitswarnungen zu Abhängigkeiten sind abgeschaltet',
      detail: 'Bekannte Schwachstellen in Abhängigkeiten werden nicht gemeldet. Der Betreiber erfährt von einer verwundbaren Bibliothek erst durch Dritte.',
      reference: 'ISO/IEC 27001:2022 A.8.8 (Technische Schwachstellen)',
    });
  }

  if (obs.secretScanningEnabled === false) {
    findings.push({
      code: 'github.secret-scanning-disabled',
      category: 'security',
      severity: 'high',
      title: 'Secret Scanning ist abgeschaltet',
      detail: 'Versehentlich eingecheckte Zugangsdaten werden nicht erkannt. Bei einem öffentlichen Repository ist ein solcher Fund sofort fremdverfügbar.',
      reference: 'ISO/IEC 27001:2022 A.5.17 (Authentifizierungsinformationen)',
    });
  }

  if (obs.hasSecurityPolicy === false) {
    findings.push({
      code: 'github.no-security-policy',
      category: 'documentation',
      severity: 'medium',
      title: 'Keine SECURITY.md hinterlegt',
      detail: 'Es gibt keinen benannten Weg, eine Schwachstelle zu melden. Ein Finder hat dann die Wahl zwischen Schweigen und Veröffentlichung.',
      reference: 'ISO/IEC 29147 (Vulnerability Disclosure)',
    });
  }

  if (obs.hasLicense === false) {
    findings.push({
      code: 'github.no-license',
      category: 'documentation',
      severity: 'low',
      title: 'Keine Lizenz hinterlegt',
      detail: 'Ohne Lizenzangabe ist die Nutzung durch Dritte rechtlich ungeklärt — auch innerhalb einer Unternehmensgruppe.',
      reference: null,
    });
  }

  // Öffentlich ist kein Fehler, sondern eine Tatsache mit Folgen: Sie
  // verschärft jeden anderen Befund. Deshalb nur ein Hinweis, aber einer,
  // der die Einordnung der übrigen Befunde trägt.
  if (obs.isPrivate === false) {
    findings.push({
      code: 'github.public-repository',
      category: 'security',
      severity: 'info',
      title: 'Repository ist öffentlich',
      detail: 'Inhalt und Verlauf sind für jeden lesbar. Ein Fund im Verlauf lässt sich nicht durch Löschen zurücknehmen.',
      reference: null,
    });
  }

  // Reproduzierbare Reihenfolge: erst nach Schwere, bei Gleichstand nach Code.
  return findings.sort((a, b) => {
    const bySeverity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    return bySeverity !== 0 ? bySeverity : a.code.localeCompare(b.code);
  });
}

const SEVERITY_RANK: Readonly<Record<GitHubFindingSeverity, number>> = Object.freeze({
  critical: 4, high: 3, medium: 2, low: 1, info: 0,
});

/**
 * Felder, die nicht festgestellt werden konnten.
 *
 * §9 Regel 4 verlangt, dass ein Ausfall ein bekannter Zustand ist. Eine
 * Teil-Beobachtung ist der halbe Ausfall: Sie sieht aus wie ein Ergebnis,
 * deckt aber weniger ab. Wer sie erhält, soll sehen, was fehlt — sonst liest
 * er „keine Befunde" als „alles in Ordnung".
 */
export function undeterminedFields(obs: GitHubRepoObservation): string[] {
  const undetermined: string[] = [];
  if (obs.isPrivate === null) undetermined.push('visibility');
  if (obs.archived === null) undetermined.push('archived');
  if (obs.defaultBranchProtected === null) undetermined.push('branch_protection');
  if (obs.vulnerabilityAlertsEnabled === null) undetermined.push('vulnerability_alerts');
  if (obs.secretScanningEnabled === null) undetermined.push('secret_scanning');
  if (obs.hasSecurityPolicy === null) undetermined.push('security_policy');
  if (obs.hasLicense === null) undetermined.push('license');
  return undetermined;
}

/**
 * Ist die Beobachtung vollständig genug, um „keine Befunde" als Aussage zu
 * tragen?
 *
 * Fail-closed wie beim Publish Gate: Ohne die drei sicherheitsrelevanten
 * Felder ist ein leeres Ergebnis keine Entwarnung, sondern eine Lücke.
 */
export function isConclusive(obs: GitHubRepoObservation): boolean {
  return (
    obs.defaultBranchProtected !== null &&
    obs.vulnerabilityAlertsEnabled !== null &&
    obs.secretScanningEnabled !== null
  );
}

/**
 * Der Text, mit dem ein Befund als GitHub-Issue erscheint (Aktionsseite).
 *
 * Hier, weil der Titel Teil des Vertrags ist: Er beginnt mit dem Befundcode,
 * damit ein zweiter Lauf sein eigenes Issue wiedererkennt und keinen Stapel
 * Dubletten anlegt.
 */
export function issueTitleFor(finding: GitHubFinding): string {
  return `[${finding.code}] ${finding.title}`;
}

export function issueBodyFor(finding: GitHubFinding, assetLabel: string): string {
  const lines = [
    finding.detail,
    '',
    `**Schwere:** ${finding.severity}`,
    `**Asset:** ${assetLabel}`,
  ];
  if (finding.reference) lines.push(`**Bezug:** ${finding.reference}`);
  lines.push(
    '',
    '---',
    'Erzeugt von RealSyncDynamics.AI aus einer Beobachtung dieses Repositories.',
    'Der Compliance-Zustand wird in der Plattform geführt, nicht hier (§9 Regel 3).',
  );
  return lines.join('\n');
}
