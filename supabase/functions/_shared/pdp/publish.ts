/**
 * Veröffentlichung → Entscheidungsanfrage (P2-3, SiteOS Publish Gate als PEP).
 *
 * WARUM DIESES MODUL EXISTIERT — derselbe Grund wie bei `toolcall.ts`:
 * Es soll genau EINE Stelle geben, die übersetzt, wie eine Veröffentlichung
 * in eine Policy-Anfrage wird (Fragmentierungs-Befund §1.4 des Plans). Läge
 * die Abbildung im Handler, entstünde bei der zweiten Publish-Strecke
 * (Domain, Deployment) unweigerlich eine zweite, leicht abweichende.
 *
 * ## Die Injektionsgrenze (K6) — hier schärfer als beim Agenten
 *
 * Ein Blueprint besteht überwiegend aus Text, den jemand anderes geschrieben
 * hat: aus dem Prompt eines Nutzers oder aus einer **gescannten fremden
 * Website**. Ginge dieser Text in die Entscheidungsgrundlage, könnte der
 * Betreiber der gescannten Seite die Bewertung seiner eigenen Übernahme
 * beeinflussen — durch nichts weiter als einen Satz auf seiner Startseite.
 *
 * Den Prozess verlassen deshalb ausschließlich **strukturierte Tatsachen aus
 * geschlossenem Vokabular**: Slug, Branche, Herkunftsart, Seitenzahl,
 * Befund-Codes, Rechtsgrundlagen, Consent-Kategorien, Artefakt-Hash. Niemals
 * Überschriften, Fließtext, Meta-Beschreibungen, Firmennamen oder
 * Befund-Titel.
 *
 * `slug` ist die eine Ausnahme mit freiem Ursprung — er wird gebraucht,
 * damit eine Regel eine einzelne Site adressieren kann, und er ist durch die
 * Slug-Bildung auf `[a-z0-9-]` beschränkt. Ein Satz passt da nicht hinein.
 *
 * Rein und importfrei bis auf die Typen — läuft in Deno und Vitest.
 */

import type { DecisionRequest, DecisionResult, PdpDecision } from './core.ts';

/** Kanal, unter dem Publish-Entscheidungen im Prüfpfad erscheinen. */
export const PUBLISH_CHANNEL = 'siteos_publish';

/** Verb der Aktion. Entspricht dem `publish` aus DecisionRequest.action.verb. */
export const PUBLISH_VERB = 'publish';

export interface PublishDecisionInput {
  /** Blueprint-Kennung — adressierbar in Regeln, keine Inhaltsquelle. */
  blueprint_id: string;
  /** Slug der Site; auf `[a-z0-9-]` beschränkt (siehe Kopfkommentar). */
  slug: string;
  /** Branchenschlüssel aus geschlossenem Vokabular. */
  industry: string;
  /** `ai-builder` | `manual` | `import` — die Herkunftsart, nicht der Prompt. */
  origin_source: string;
  /** Modell-ID, falls generativ erzeugt (Art. 50 EU AI Act). */
  origin_model: string | null;
  /** Hash des Auslieferungsbündels — der Gegenstand der Entscheidung (G6). */
  artifact_sha256: string;
  /** Anzahl Seiten. Eine Zahl, kein Inhalt. */
  page_count: number;
  /** Befund-CODES aus geschlossenem Vokabular — nie die Titel. */
  finding_codes: string[];
  /** Höchste aufgetretene Schwere. */
  severity_max: string | null;
  dpia_required: boolean;
  special_categories: boolean;
  legal_bases: string[];
  consent_categories: string[];
  /** Principal, der veröffentlichen will — für Rollen- und Org-Regeln. */
  user_id: string;
}

/**
 * Baut die Entscheidungsanfrage. Alles, was nicht in `PublishDecisionInput`
 * steht, existiert für den PDP nicht — die Struktur IST die Grenze.
 */
export function publishToDecisionRequest(
  tenantId: string,
  input: PublishDecisionInput,
): DecisionRequest {
  return {
    contract: 'v1',
    tenant_id: tenantId,
    principal: { type: 'user', id: input.user_id },
    action: {
      verb: PUBLISH_VERB,
      channel: PUBLISH_CHANNEL,
      event_type: 'publish',
      event_source: 'siteos',
    },
    asset: {
      id: input.blueprint_id,
      asset_type: 'website',
      // `data_types` speist Regeln über die Art der verarbeiteten Daten.
      // Rechtsgrundlagen und Consent-Kategorien sind beides geschlossene
      // Vokabulare aus der Blueprint-Analyse.
      data_types: [...input.legal_bases, ...input.consent_categories],
      vendor: input.origin_model,
    },
    data: {
      // Besondere Kategorien (Art. 9 DSGVO) sind die einzige Einstufung, die
      // sich aus dem Blueprint zwingend ergibt. Sonst bleibt das Feld frei —
      // der Klassifikations-PIP darf es füllen, dieser Aufrufer nicht raten.
      ...(input.special_categories ? { classification: 'special_category' } : {}),
      data_types: input.legal_bases,
      risk_level: input.severity_max ?? undefined,
    },
    // Speist den generischen Bedingungs-Fallback: Eine governance_policy mit
    // { origin_source: 'import' } oder { dpia_required: true } trifft damit.
    payload: {
      blueprint_id: input.blueprint_id,
      slug: input.slug,
      industry: input.industry,
      origin_source: input.origin_source,
      artifact_sha256: input.artifact_sha256,
      page_count: input.page_count,
      finding_codes: input.finding_codes,
      dpia_required: input.dpia_required,
      special_categories: input.special_categories,
      ...(input.origin_model ? { origin_model: input.origin_model } : {}),
    },
    context: { feature: 'siteos.publish' },
  };
}

/**
 * Form, in der das Ergebnis in den reinen Kern geht.
 *
 * Bewusst strukturgleich zu `PolicyEngineState` aus
 * `packages/siteos-core/src/publish/gate.ts`, aber **nicht** von dort
 * importiert: Der Kern ist abhängigkeitsfrei und darf nichts aus
 * `supabase/functions/` kennen, und umgekehrt soll der PDP nicht an SiteOS
 * hängen. Die beiden Typen werden von
 * `test/siteos/publish-gate-pdp.test.ts` gegeneinander gehalten — dieselbe
 * Absicherung wie bei der SQL-Parität in RFC-003.
 */
export type PublishPolicyState =
  | {
      kind: 'evaluated';
      decision: PdpDecision;
      reasons: { policy_id: string; action: PdpDecision; text_de: string }[];
      matchedPolicyIds: string[];
      snapshotVersion: string;
    }
  | { kind: 'unavailable'; reason: string };

/** Übersetzt das PDP-Ergebnis in die Eingabe des Gates. */
export function decisionResultToPolicyState(result: DecisionResult): PublishPolicyState {
  return {
    kind: 'evaluated',
    decision: result.decision,
    reasons: result.reasons.map((r) => ({
      policy_id: r.policy_id,
      action: r.action,
      text_de: r.text_de,
    })),
    matchedPolicyIds: result.matched_policy_ids,
    snapshotVersion: result.snapshot_version,
  };
}

/**
 * Ausfall des PDP.
 *
 * **Bewusste Abweichung vom allgemeinen Ausfallverhalten (E2).** Der Plan
 * empfiehlt als Grundregel „durchlassen und laut alarmieren"; hier gilt das
 * Gegenteil, und zwar nicht aus Vorsicht, sondern weil §7 G3 es wörtlich
 * verlangt: „fehlende Antwort, Zeitüberschreitung ⇒ nicht veröffentlichbar".
 *
 * Der Unterschied hat einen Grund. Ein durchgelassener Gateway-Aufruf ist
 * ein Vorgang, den man nachträglich bewerten kann. Eine Veröffentlichung ist
 * nach außen gerichtet und nicht zurückholbar — sobald sie ausgeliefert ist,
 * hat sie jemand gesehen.
 */
export function policyUnavailable(reason: string): PublishPolicyState {
  return { kind: 'unavailable', reason };
}
