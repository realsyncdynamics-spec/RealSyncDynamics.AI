// SiteOS Publish Gate — Transparenzprüfung nach Art. 50 EU AI Act.
//
// Vertrag und Ableitungsregel folgen `docs/architecture/target-architecture.md`
// §7 (normativ). Der Contract-Typ liegt hier im abhängigkeitsfreien Kern,
// damit SPA, Deno und Tests dieselbe Definition benutzen — genau so, wie es
// das Zieldokument vorsieht.
//
// Umfang dieses Moduls: die **Transparenz**-Seite des Gates. Sie liefert den
// Beitrag zu `policy_compliant`. Die übrigen Felder des Vertrags
// (`evidence_complete`, `backend_preservation`, `human_approval_required`)
// werden vom Aufrufer festgestellt — sie brauchen Datenbank- und
// Freigabekontext, den ein abhängigkeitsfreier Kern nicht hat.
//
// Warum die Verstöße hier NICHT als `RuntimeFinding` herausfallen:
// Befund-Codes und Scoring-Gewichte sind laut CLAUDE.md versionsrelevant.
// Ein Gate trifft eine Ja/Nein-Entscheidung und darf keine Score-Werte
// verschieben. Deshalb ein eigener, score-freier Verstoßtyp.

import { canonicalHash } from '../canonical.ts';
import { buildDeploymentArtifact, type DeploymentArtifact } from './artifact.ts';
import type { RenderOptions } from '../render/renderer.ts';
import type { SiteBlueprint } from '../types.ts';

// ─────────────────────────────────────────────────────────────────────
// Contract (target-architecture.md §7)
// ─────────────────────────────────────────────────────────────────────

export type PublishGateStatus = 'passed' | 'blocked' | 'pending';

/**
 * Erhaltung der backend-gebundenen Funktionen (Formularziele, Zahlungs- und
 * Buchungswege, Einwilligungen, Schnittstellen).
 *
 * `unknown` ist ein zulässiges Ergebnis — und blockiert (Regel G3). „Wir
 * wissen es nicht" ist kein Freigabegrund.
 */
export type BackendPreservation = 'preserve_all' | 'changed' | 'unknown';

export interface PublishGateContract {
  status: PublishGateStatus;
  evidence_complete: boolean;
  backend_preservation: BackendPreservation;
  policy_compliant: boolean;
  human_approval_required: boolean;
  /** Rein abgeleitet (Regel G4). Kein manuelles Überschreiben. */
  publishable: boolean;
  evaluated_at: string;
  /** Prüfpfad-Anker (Regel G5). Bindet die Bewertung an genau ein Artefakt. */
  evaluation_id: string;
  /** Artefakt-Hash, für den diese Bewertung gilt (Regel G6). */
  artifact_sha256: string;
  /** Begründung für die Anzeige. Das Frontend rendert sie, statt sie abzuleiten (Regel G2). */
  violations: PublishGateViolation[];
}

/**
 * Ein blockierender Transparenzverstoß.
 *
 * Bewusst kein `RuntimeFinding`: Gate-Verstöße gehen nicht in die Scores
 * ein und sind damit nicht an die versionierten Befund-Codes gebunden.
 */
export interface PublishGateViolation {
  code:
    | 'transparency.missing-disclosure-block'
    | 'transparency.undocumented-model'
    | 'transparency.disclosure-not-delivered'
    | 'transparency.marking-not-delivered';
  /** Rechtsnorm, auf die sich die Blockade stützt. */
  reference: string;
  message: string;
  /** Betroffener Seitenpfad, sofern lokalisierbar. */
  locator: string | null;
}

/**
 * Die einzige Ableitung von `publishable` (Regel G2 — zwei Ableitungswege
 * driften, und im Zweifel gewinnt der falsche).
 */
export function derivePublishable(
  contract: Omit<PublishGateContract, 'publishable'>,
): boolean {
  return (
    contract.status === 'passed' &&
    contract.evidence_complete === true &&
    contract.backend_preservation === 'preserve_all' &&
    contract.policy_compliant === true &&
    contract.human_approval_required === false
  );
}

// ─────────────────────────────────────────────────────────────────────
// Transparenzprüfung
// ─────────────────────────────────────────────────────────────────────

export interface TransparencyResult {
  /** Beitrag zu `policy_compliant` im Vertrag. */
  compliant: boolean;
  violations: PublishGateViolation[];
}

const ART_50 = 'Art. 50 EU AI Act';

/**
 * Prüft die Transparenzpflichten gegen Blueprint **und** Artefakt.
 *
 * Beide Ebenen sind nötig und keine ersetzt die andere: der Blueprint sagt,
 * was zugesagt wurde, das Artefakt, was tatsächlich ausgeliefert wird. Ein
 * Hinweisblock, der im Blueprint steht, aber nicht im HTML landet, erfüllt
 * Art. 50 nicht — für einen Prüfer existiert nur das Ausgelieferte.
 *
 * Ohne `artifact` wird nur die Blueprint-Ebene geprüft. Für eine
 * Publish-Entscheidung ist das zu wenig; `evaluatePublishGate` übergibt
 * deshalb immer das Artefakt.
 */
export function evaluateTransparency(
  blueprint: SiteBlueprint,
  artifact?: DeploymentArtifact,
): TransparencyResult {
  const violations: PublishGateViolation[] = [];

  // Art. 50 Abs. 2: Der Nachweis der Herkunft ist ohne Modellangabe
  // unvollständig — dann lässt sich nicht belegen, was den Inhalt erzeugt hat.
  if (blueprint.origin.source === 'ai-builder' && !blueprint.origin.model) {
    violations.push({
      code: 'transparency.undocumented-model',
      reference: ART_50,
      message: 'Generativ erzeugter Blueprint ohne dokumentiertes Modell (origin.model).',
      locator: null,
    });
  }

  const filesByPath = new Map(artifact?.files.map((f) => [f.path, f.content]) ?? []);

  for (const page of blueprint.pages) {
    if (!page.blocks.some((block) => block.aiGenerated)) continue;

    if (!page.blocks.some((block) => block.kind === 'ai-disclosure')) {
      violations.push({
        code: 'transparency.missing-disclosure-block',
        reference: ART_50,
        message: 'Seite enthält generierte Inhalte, aber keinen Block „ai-disclosure".',
        locator: page.path,
      });
      // Der Blueprint sagt bereits Nein — die Artefaktprüfung würde nur
      // denselben Mangel ein zweites Mal melden.
      continue;
    }

    if (!artifact) continue;

    const html = filesByPath.get(filePathFor(page.path));
    if (html === undefined) {
      violations.push({
        code: 'transparency.disclosure-not-delivered',
        reference: ART_50,
        message: 'Seite mit generierten Inhalten fehlt im Auslieferungsbündel.',
        locator: page.path,
      });
      continue;
    }

    if (!html.includes('data-ai-disclosure')) {
      violations.push({
        code: 'transparency.disclosure-not-delivered',
        reference: ART_50,
        message: 'Hinweisblock ist im ausgelieferten HTML nicht auffindbar.',
        locator: page.path,
      });
    }

    // Art. 50 Abs. 2 verlangt ein maschinenlesbares Format. Der sichtbare
    // Hinweis allein genügt dafür nicht.
    if (!html.includes('data-ai-generated="true"')) {
      violations.push({
        code: 'transparency.marking-not-delivered',
        reference: `${ART_50} Abs. 2`,
        message: 'Generierter Inhalt ist im ausgelieferten HTML nicht maschinenlesbar gekennzeichnet.',
        locator: page.path,
      });
    }
  }

  return { compliant: violations.length === 0, violations };
}

/** Spiegelt `filePathForRoute` aus artifact.ts — bewusst ohne Import-Zyklus-Risiko. */
function filePathFor(route: string): string {
  const normalized = route.startsWith('/') ? route : `/${route}`;
  if (normalized === '/') return '/index.html';
  return `${normalized.replace(/\/+$/, '')}/index.html`;
}

// ─────────────────────────────────────────────────────────────────────
// Gate-Auswertung
// ─────────────────────────────────────────────────────────────────────

export interface PublishGateInput {
  /**
   * Vollständigkeit der Nachweiskette. Stellt der Aufrufer fest (Evidence
   * Vault), nicht dieser Kern.
   */
  evidenceComplete: boolean;
  /**
   * Erhaltung der backend-gebundenen Funktionen. Default `unknown` — und
   * damit blockierend (Regel G3). Wer nicht geprüft hat, veröffentlicht nicht.
   */
  backendPreservation?: BackendPreservation;
  /** Liegt eine erforderliche menschliche Freigabe noch aus? */
  humanApprovalRequired: boolean;
  /** Zeitpunkt der Bewertung, ISO-8601. */
  evaluatedAt: string;
}

/**
 * Wertet das Gate für genau einen Artefakt-Stand aus.
 *
 * `evaluation_id` wird aus Artefakt-Hash und Zeitpunkt abgeleitet: die
 * Bewertung ist damit an genau ein Artefakt gebunden (Regel G6). Ändert
 * sich eine Datei, ändert sich `artifact_sha256` — und eine alte Bewertung
 * passt nicht mehr zum neuen Inhalt.
 */
export async function evaluatePublishGate(
  blueprint: SiteBlueprint,
  artifact: DeploymentArtifact,
  input: PublishGateInput,
): Promise<PublishGateContract> {
  const transparency = evaluateTransparency(blueprint, artifact);
  const backendPreservation = input.backendPreservation ?? 'unknown';

  const status: PublishGateStatus = transparency.compliant
    ? (input.humanApprovalRequired ? 'pending' : 'passed')
    : 'blocked';

  const base: Omit<PublishGateContract, 'publishable'> = {
    status,
    evidence_complete: input.evidenceComplete,
    backend_preservation: backendPreservation,
    policy_compliant: transparency.compliant,
    human_approval_required: input.humanApprovalRequired,
    evaluated_at: input.evaluatedAt,
    evaluation_id: await canonicalHash({
      artifact: artifact.artifactSha256,
      blueprint: artifact.blueprintSha256,
      at: input.evaluatedAt,
    }),
    artifact_sha256: artifact.artifactSha256,
    violations: transparency.violations,
  };

  return { ...base, publishable: derivePublishable(base) };
}

export interface PreparedPublish {
  artifact: DeploymentArtifact;
  contract: PublishGateContract;
}

/**
 * Einziger vorgesehener Einstieg in einen Publish-Pfad: baut das Artefakt
 * und bewertet es in einem Schritt.
 *
 * Der Zuschnitt ist Absicht. Wäre das Bauen frei aufrufbar und das Gate ein
 * zweiter, optionaler Schritt, entstünde genau der Weg, den §7 ausschließt:
 * ein Artefakt ohne zugehörige Bewertung. Hier ist die Bewertung nicht
 * umgehbar, und sie gehört zum ausgegebenen Artefakt-Hash.
 */
export async function preparePublish(
  blueprint: SiteBlueprint,
  input: PublishGateInput,
  renderOptions: RenderOptions = {},
): Promise<PreparedPublish> {
  const artifact = await buildDeploymentArtifact(blueprint, renderOptions);
  return { artifact, contract: await evaluatePublishGate(blueprint, artifact, input) };
}
