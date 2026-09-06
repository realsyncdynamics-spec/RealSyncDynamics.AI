/**
 * Microsoft-365-Ereignis → Entscheidung (P2-2, nachgelagerter PEP).
 *
 * WARUM DIESES MODUL ANDERS IST ALS DIE ANDEREN VIER
 *
 * Gateway (P0-4), Agent (P1-5), Publish Gate (P2-3), CI/CD (P2-4) und Bots
 * (P2-5) liegen alle **vor** der Handlung. Dieser hier liegt dahinter. Das
 * Ereignis ist geschehen, bevor wir davon erfahren: Die Datei ist geteilt, die
 * Anmeldung ist erfolgt, die Berechtigung ist vergeben.
 *
 * Daraus folgt die zentrale Regel dieses Moduls: **`block` und
 * `require_approval` sind hier nicht einloesbar.** Ein PDP, der sie
 * entscheidet, hat inhaltlich recht — nur kann diese Klasse es nicht
 * ausfuehren. Statt das zu verschweigen (dann saehe eine nicht durchsetzbare
 * Regel wie eine nicht vorhandene aus) wird es festgehalten: Das Verdikt wird
 * auf `react` herabgestuft und `verdict_downgraded_from` nennt, was eigentlich
 * gegolten haette.
 *
 * Das ist dieselbe Ehrlichkeitsregel wie bei der abgeleiteten Klasse in P2-1,
 * nur zur Laufzeit: Der Auftrag untersagt, eine Kontrolle so aussehen zu
 * lassen, als wuerde sie funktionieren, wenn sie es technisch nicht kann.
 * `shared/enforcement-classes.ts` sagt fuer C ausdruecklich
 * `verdikte: ['log_only', 'warn', 'react']` — dieses Modul haelt sich daran
 * und wird von der Datenbank per CHECK daran gehalten.
 *
 * ## Die Injektionsgrenze (K6)
 *
 * Ein Graph-Prueferereignis besteht groesstenteils aus Text, den Menschen im
 * Fremdsystem gesetzt haben: Dateinamen, Anzeigenamen, Gruppennamen,
 * Fehlerbeschreibungen. Ginge er in die Entscheidungsgrundlage, koennte jeder
 * Mitarbeitende — und jeder externe Gast — die Bewertung des eigenen Vorgangs
 * beeinflussen, indem er eine Datei passend benennt.
 *
 * Den Prozess verlassen deshalb nur Merkmale:
 *
 *   - `activity_kind` aus einer **festen Liste**, nie der Rohtext von
 *     Microsoft. Unbekanntes wird `other`, nicht durchgereicht.
 *   - `result` als Aufzaehlung (success/failure/unknown)
 *   - ein Pseudonym des Handelnden (SHA-256 des UPN) und die abgeleitete
 *     Frage, ob er ausserhalb der Hauptdomaene steht
 *   - Signal**namen** und Trefferzahlen aus `detectSignals`
 *   - Zaehler
 *
 * Kein Anzeigename, kein Dateiname, kein Freitext.
 *
 * EU AI Act Art. 12 (Aufzeichnung), Art. 13 (Transparenz ueber die
 * Faehigkeiten), Art. 14 (menschliche Aufsicht). DSGVO Art. 5 Abs. 1 lit. c
 * (Datenminimierung), Art. 30 (Verzeichnis der Verarbeitungstaetigkeiten).
 */

import type { DecisionRequest, PdpDecision } from './core.ts';
import { classifyFromSignals, detectSignals } from './classify.ts';
import { decide, logShadowComparison } from './decide.ts';

/** Kanalname im Pruefpfad und im Shadow-Protokoll. */
export const M365_CHANNEL = 'm365-audit';

/** Verb der Aktion — „festgestellt", nicht „ausgefuehrt". */
export const M365_VERB = 'observe';

/**
 * Was in Klasse C ueberhaupt gelten kann.
 *
 * Zwillingsliste zu `ENFORCEMENT_CLASSES.C.verdikte` in
 * `shared/enforcement-classes.ts` und zum CHECK
 * `m365_audit_events_class_c_honest`. `test/governance/pdp-m365event.test.ts`
 * haelt die drei Stellen zusammen.
 */
export type M365Verdict = 'log_only' | 'warn' | 'react';

/**
 * Betriebsart, gelesen aus `M365_PDP_ENFORCEMENT`.
 *
 * ## Was `enforce` hier bedeutet — und was nicht
 *
 * In den Klassen A und B heisst `enforce`: die Handlung wird angehalten. Hier
 * kann nichts angehalten werden. `enforce` heisst deshalb: **die Reaktion wird
 * tatsaechlich ausgeloest** — es entsteht ein Vorgang, der jemanden erreicht.
 * In `shadow` wird gerechnet und protokolliert, aber niemand wird geweckt.
 *
 * Diese Bedeutung ausdruecklich hinzuschreiben ist noetig, weil derselbe
 * Schaltername sonst dasselbe Versprechen zu geben scheint wie beim Gateway.
 * Genau diese stille Gleichsetzung ist die Scheinimplementierung, die der
 * Auftrag untersagt.
 *
 * Vorgabe `shadow`, wie bei allen anderen: Ein Merge aendert kein
 * Produktionsverhalten.
 */
export type M365PepMode = 'off' | 'shadow' | 'enforce';

export function readM365PepMode(): M365PepMode {
  const raw = (Deno.env.get('M365_PDP_ENFORCEMENT') ?? 'shadow').toLowerCase();
  return raw === 'off' || raw === 'enforce' ? raw : 'shadow';
}

/**
 * Normalisierte Taetigkeiten.
 *
 * Bewusst grob und bewusst endlich: Diese Liste ist die Grenze zwischen
 * fremdem Text und eigener Entscheidungsgrundlage. Sie waechst nur durch
 * bewusste Ergaenzung, nie durch Durchreichen.
 */
export const M365_ACTIVITY_KINDS = [
  'sign_in',
  'sign_in_failed',
  'user_created',
  'user_deleted',
  'role_assigned',
  'permission_granted',
  'application_consent',
  'group_membership_changed',
  'sharing_link_created',
  'external_user_invited',
  'policy_changed',
  'other',
] as const;
export type M365ActivityKind = typeof M365_ACTIVITY_KINDS[number];

/**
 * Rohtext → feste Taetigkeit.
 *
 * Die Zuordnung arbeitet auf kleingeschriebenen Teilzeichenketten der von
 * Microsoft gelieferten Bezeichnung. Das ist eine **Erkennung**, keine
 * Uebernahme: Was nicht passt, wird `other` — nie der Rohwert.
 */
export function normalizeActivity(
  raw: string | null | undefined,
  category?: string | null,
): M365ActivityKind {
  const t = `${category ?? ''} ${raw ?? ''}`.toLowerCase();
  if (t.includes('consent to application') || t.includes('application consent')) return 'application_consent';
  if (t.includes('add delegated permission') || t.includes('add app role assignment')
      || t.includes('grant permission')) return 'permission_granted';
  if (t.includes('add member to role') || t.includes('role assignment')) return 'role_assigned';
  if (t.includes('invite external user') || t.includes('invite guest')
      || t.includes('redeem external user invitation')) return 'external_user_invited';
  if (t.includes('sharing') || t.includes('anonymous link') || t.includes('sharinglink')) return 'sharing_link_created';
  if (t.includes('add member to group') || t.includes('remove member from group')) return 'group_membership_changed';
  if (t.includes('add user')) return 'user_created';
  if (t.includes('delete user')) return 'user_deleted';
  if (t.includes('policy')) return 'policy_changed';
  if (t.includes('sign-in') || t.includes('sign in') || t.includes('signin')) return 'sign_in';
  return 'other';
}

/** Das normalisierte Ereignis — alles, was den Prozess verlassen darf. */
export interface M365EventFacts {
  tenant_id: string;
  connection_id: string;
  graph_id: string;
  stream: 'directory_audits' | 'sign_ins';
  occurred_at: string;
  activity_kind: M365ActivityKind;
  result: 'success' | 'failure' | 'unknown';
  /** SHA-256 des UPN — Pseudonym, kein Klartext. */
  actor_ref: string | null;
  actor_external: boolean;
  target_count: number;
  /**
   * Der freie Text des Ereignisses (Anzeigenamen, Dateinamen). Wird
   * **ausschliesslich lokal** auf Signale geprueft und verlaesst diese
   * Funktion nicht — dieselbe Konstruktion wie `message` beim Bot-PEP.
   */
  raw_text: string;
}

/**
 * Baut die Entscheidungsanfrage. Was hier nicht steht, existiert fuer den PDP
 * nicht — die Struktur IST die Grenze.
 */
export function m365EventToDecisionRequest(
  facts: M365EventFacts,
  signals: { signal: string; count: number }[],
  classification: { classification: string; confidence: number },
): DecisionRequest {
  return {
    contract: 'v1',
    tenant_id: facts.tenant_id,
    // Der Handelnde ist ein Konto im Fremdsystem, kein Principal dieses
    // Mandanten. Ihn als `user` auszugeben, wuerde Rollenregeln auf jemanden
    // anwenden, dessen Rollen wir gar nicht kennen. `service` beschreibt die
    // Anbindung, die das Ereignis meldet.
    principal: { type: 'service', id: facts.connection_id },
    action: {
      verb: M365_VERB,
      channel: M365_CHANNEL,
      event_type: facts.activity_kind,
      event_source: 'microsoft365',
    },
    data: {
      classification: classification.classification,
      classification_confidence: classification.confidence,
      signals: signals.map((s) => s.signal),
    },
    payload: {
      connection_id: facts.connection_id,
      stream: facts.stream,
      activity_kind: facts.activity_kind,
      result: facts.result,
      actor_external: facts.actor_external,
      target_count: facts.target_count,
      signal_counts: Object.fromEntries(signals.map((s) => [s.signal, s.count])),
    },
    context: { feature: 'microsoft365' },
  };
}

/**
 * Die Herabstufung — der Kern dieses Moduls.
 *
 * Ein blockierendes Verdikt wird zu `react`, und es wird festgehalten, dass es
 * eines war. Ein `allow` wird zu `log_only`: Es gab keinen Einwand, also gibt
 * es nichts zu melden — aber das Ereignis bleibt im Protokoll, sonst waere die
 * Anbindung kein Prueferpfad.
 */
export function toClassCVerdict(decision: PdpDecision): {
  verdict: M365Verdict;
  downgraded_from: 'block' | 'require_approval' | null;
} {
  switch (decision) {
    case 'block':
      return { verdict: 'react', downgraded_from: 'block' };
    case 'require_approval':
      // Eine Freigabe fuer etwas bereits Geschehenes gibt es nicht. Was bleibt
      // und sinnvoll ist: ein Mensch sieht es sich an.
      return { verdict: 'react', downgraded_from: 'require_approval' };
    case 'warn':
      return { verdict: 'warn', downgraded_from: null };
    case 'log_only':
    case 'allow':
    default:
      return { verdict: 'log_only', downgraded_from: null };
  }
}

/** Ergebnis fuer den Abholjob. */
export interface M365PepResult {
  mode: M365PepMode;
  /** Was hier tatsaechlich gilt. */
  verdict: M365Verdict;
  /** Was der PDP entschieden hat, wenn die Klasse es nicht hergab. */
  downgraded_from: 'block' | 'require_approval' | null;
  pdp_status: 'consulted' | 'not_enforcing' | 'unavailable';
  decision: PdpDecision | null;
  reasons: string[];
  matched_policy_ids: string[];
  signals: string[];
  classification: string | null;
  /**
   * Soll ein Vorgang entstehen? Nur in `enforce` — in `shadow` wird gerechnet
   * und protokolliert, aber niemand geweckt.
   */
  react: boolean;
}

/**
 * Der nachgelagerte Enforcement-Punkt. Einmal geschrieben, vom Abholjob je
 * Ereignis aufgerufen.
 *
 * ## Ausfallverhalten
 *
 * „Fail closed" gibt es hier nicht — es ist nichts zu schliessen. Faellt der
 * PDP aus, wird das Ereignis mit `pdp_status: 'unavailable'` und dem Verdikt
 * `warn` festgehalten. `log_only` waere die falsche Wahl: Es behauptete
 * „nichts festzustellen", obwohl niemand nachgesehen hat. Die Luecke sichtbar
 * zu machen ist die einzige Entsprechung zu fail-closed, die diese Klasse
 * hergibt.
 */
export async function evaluateM365Event(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  facts: M365EventFacts,
): Promise<M365PepResult> {
  const mode = readM365PepMode();

  const hits = detectSignals(facts.raw_text);
  const signalNames = hits.map((h) => h.signal);

  if (mode === 'off') {
    // Nicht gefragt heisst nicht gefragt. `log_only` mit
    // `pdp_status: 'not_enforcing'` sagt genau das — es behauptet keine
    // Pruefung, die nicht stattgefunden hat.
    return {
      mode, verdict: 'log_only', downgraded_from: null, pdp_status: 'not_enforcing',
      decision: null, reasons: ['Richtlinienpruefung fuer diesen Kanal ist abgeschaltet (M365_PDP_ENFORCEMENT=off).'],
      matched_policy_ids: [], signals: signalNames, classification: null, react: false,
    };
  }

  const classification = classifyFromSignals(hits);
  const request = m365EventToDecisionRequest(facts, hits, classification);

  let decision: PdpDecision;
  let reasons: string[];
  let matchedIds: string[];
  let snapshotVersion: string;

  try {
    const result = await decide(admin, request);
    decision = result.decision;
    reasons = result.reasons.map((r) => r.text_de);
    matchedIds = result.matched_policy_ids;
    snapshotVersion = result.snapshot_version;
  } catch (e) {
    const detail = (e as Error)?.message ?? String(e);
    console.error(JSON.stringify({
      level: 'error', scope: 'm365_pdp_unavailable',
      tenant_id: facts.tenant_id, connection_id: facts.connection_id, error: detail,
    }));
    return {
      mode,
      verdict: 'warn',
      downgraded_from: null,
      pdp_status: 'unavailable',
      decision: null,
      reasons: [
        `Richtlinienpruefung nicht erreichbar: ${detail}`,
        'Das Ereignis ist festgehalten, aber nicht bewertet.',
      ],
      matched_policy_ids: [],
      signals: signalNames,
      classification: classification.classification,
      // Ein Ausfall ist eine Betriebsstoerung, kein Regelverstoss. Er gehoert
      // sichtbar gemacht, aber er soll keinen Vorgang gegen den Kunden
      // eroeffnen.
      react: false,
    };
  }

  const { verdict, downgraded_from } = toClassCVerdict(decision);

  if (mode === 'shadow') {
    // Bewusst OHNE stillen `.catch()`: `logShadowComparison` faengt seine
    // Fehler selbst. Ein zusaetzlicher Fang hat in P2-3 dazu gefuehrt, dass
    // der Beobachtungsbetrieb gar nichts sammelte (Plan §10).
    await logShadowComparison(admin, {
      tenant_id: facts.tenant_id,
      source: M365_CHANNEL,
      // Vor P2-2 hat auf diesem Kanal keine Engine entschieden.
      legacy_status: null,
      v2_status: decision,
      snapshot_version: snapshotVersion,
      detail: {
        connection_id: facts.connection_id,
        stream: facts.stream,
        activity_kind: facts.activity_kind,
        matched_policy_ids: matchedIds,
        signals: signalNames,
        // Was in `enforce` geschehen waere — die eigentliche Frage des
        // Beobachtungsbetriebs.
        would_react: verdict === 'react',
        would_downgrade_from: downgraded_from,
      },
    });
  }

  const downgradeNote = downgraded_from
    ? [
      `Die Richtlinie entschied „${downgraded_from}". Microsoft 365 ist nachgelagert `
      + '(Klasse C) — die Handlung war bereits geschehen und konnte nicht verhindert '
      + 'werden. Es bleibt die Reaktion.',
    ]
    : [];

  return {
    mode,
    verdict,
    downgraded_from,
    pdp_status: 'consulted',
    decision,
    reasons: [...reasons, ...downgradeNote],
    matched_policy_ids: matchedIds,
    signals: signalNames,
    classification: classification.classification,
    react: mode === 'enforce' && verdict === 'react',
  };
}
