/**
 * Provenance — C2PA-Manifest-Definition (Phase 3 · P3.0).
 *
 * Übersetzt die interne Custody-Kette eines Assets in eine **C2PA-Manifest-
 * Definition** — die deklarative Eingabe, die ein C2PA-Builder (Phase 3.1:
 * `c2pa-node` im Evidence-Runtime-Service) anschließend als COSE_Sign1-Manifest
 * signiert und in Medien einbettet (JUMBF) bzw. als Sidecar ablegt.
 *
 * ABGRENZUNG (bewusst):
 *   - P3.0 (hier): reine, deterministische Konstruktion der Definition. KEINE
 *     Signatur, KEIN JUMBF, KEIN Medien-Handling, keine native Abhängigkeit.
 *     Voll testbar.
 *   - P3.1 (Service): COSE_Sign1 + X.509 (Test-Zertifikat B1, später Trust-List
 *     B3) + Einbettung. Braucht `c2pa-node`; wird erst mit verifizierbarer
 *     Umgebung gebaut, nicht spekulativ.
 *
 * Das C2PA-Manifest ist ADDITIV zum internen Ed25519-Modell (Entscheidung E):
 * es ersetzt den Prüfpfad nicht, sondern ist die portable, standardkonforme
 * Ausgabe daneben. Die custom-Assertion `com.realsyncdynamics.provenance`
 * verknüpft beide, indem sie den latest_hash der internen Kette einbindet.
 *
 * Hinweis: Das exakte Definitions-/Assertions-Schema ist zum Zeitpunkt von P3.1
 * gegen die dann gepinnte `c2pa-node`-Version zu verifizieren. Diese Datei ist
 * die interne Abbildung, kein Ersatz für deren Schema-Validierung.
 */

export type CustodyAction = 'registered' | 'updated' | 'licensed' | 'audited';

/** C1 (Start-Scope): nur Bilder. Weitere Formate ab P3.3. */
export const C2PA_SUPPORTED_FORMATS = ['image/jpeg', 'image/png'] as const;
export type SupportedFormat = (typeof C2PA_SUPPORTED_FORMATS)[number];

export function isSupportedFormat(format: string): format is SupportedFormat {
  return (C2PA_SUPPORTED_FORMATS as readonly string[]).includes(format);
}

/**
 * Abbildung interner Custody-Aktionen auf C2PA-Action-Labels. Nur die eindeutig
 * standardkonformen werden auf `c2pa.*` gelegt; für die übrigen wird bewusst ein
 * eigener Namespace verwendet, statt Standard-Vokabular zu überdehnen.
 */
export function mapAction(action: CustodyAction): string {
  switch (action) {
    case 'registered': return 'c2pa.created';
    case 'updated': return 'c2pa.edited';
    case 'licensed': return 'com.realsyncdynamics.licensed';
    case 'audited': return 'com.realsyncdynamics.audited';
  }
}

export interface CustodyEventInput {
  seq: number;
  action: CustodyAction;
  actor: string;
  event_ts: string;
}

export interface C2paBuildInput {
  assetRef: string;
  /** Medien-Typ des Assets, z.B. 'image/jpeg'. */
  format: string;
  title?: string;
  contentSha256: string;
  /** Kopf der internen Custody-Kette (event_hash des jüngsten Events). */
  latestHash: string;
  events: CustodyEventInput[];
  signatureAlg?: 'ed25519' | 'hmac-sha256' | null;
  keyId?: string | null;
  /** Version für claim_generator_info; Default stabil. */
  claimGeneratorVersion?: string;
}

export interface C2paAction {
  action: string;
  when: string;
  softwareAgent: string;
}

export interface C2paAssertion {
  label: string;
  // deno-lint-ignore no-explicit-any
  data: Record<string, unknown>;
}

export interface C2paManifestDefinition {
  claim_generator: string;
  claim_generator_info: Array<{ name: string; version: string }>;
  title: string;
  format: string;
  assertions: C2paAssertion[];
}

const GENERATOR_NAME = 'RealSyncDynamics.AI';
const SOFTWARE_AGENT = 'RealSyncDynamics.AI Provenance';

/**
 * Baut die C2PA-Manifest-Definition aus der internen Kette. Deterministisch:
 * gleiche Eingabe ⇒ gleiche Definition (Events werden nach seq sortiert).
 */
export function buildC2paManifestDefinition(input: C2paBuildInput): C2paManifestDefinition {
  const version = input.claimGeneratorVersion ?? '1.0';
  const sorted = [...input.events].sort((a, b) => a.seq - b.seq);

  const actions: C2paAction[] = sorted.map((ev) => ({
    action: mapAction(ev.action),
    when: ev.event_ts,
    softwareAgent: SOFTWARE_AGENT,
  }));

  const assertions: C2paAssertion[] = [
    { label: 'c2pa.actions', data: { actions } },
    {
      // Verknüpft das C2PA-Manifest mit dem internen Ed25519-Prüfpfad.
      label: 'com.realsyncdynamics.provenance',
      data: {
        asset_ref: input.assetRef,
        content_sha256: input.contentSha256.trim().toLowerCase(),
        latest_hash: input.latestHash.trim().toLowerCase(),
        chain_length: sorted.length,
        signature_alg: input.signatureAlg ?? null,
        key_id: input.keyId ?? null,
      },
    },
  ];

  return {
    claim_generator: `${GENERATOR_NAME}/${version}`,
    claim_generator_info: [{ name: GENERATOR_NAME, version }],
    title: input.title?.trim() || input.assetRef,
    format: input.format,
    assertions,
  };
}
