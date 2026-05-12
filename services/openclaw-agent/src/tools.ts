/**
 * Tool-Calling-Definitions fuer OpenClaw.
 *
 * Drei initiale Tools die fuer DSGVO-/AI-Act-Anfragen sinnvoll sind.
 * Ausfuehrung passiert lokal im Service (kein externer DB-Call in dieser
 * Iteration — Folge-PR verkabelt mit ai_systems / ai_evidence_events).
 */

import OpenAI from 'openai';

export const OPENCLAW_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'lookup_dsgvo_paragraph',
      description:
        'Liefert den Volltext und eine kurze Erklaerung zu einem DSGVO-Artikel oder TTDSG-Paragraph. Input ist die Norm-Bezeichnung (z.B. "DSGVO Art. 6", "TTDSG § 25").',
      parameters: {
        type: 'object',
        properties: {
          norm_reference: {
            type: 'string',
            description: 'z.B. "DSGVO Art. 6 Abs. 1 lit. a" oder "TTDSG § 25"',
          },
        },
        required: ['norm_reference'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'classify_ai_system_risk',
      description:
        'Klassifiziert ein beschriebenes AI-System nach EU-AI-Act in eine der 4 Risikoklassen (minimal / limited / high / prohibited). Input ist eine kurze Beschreibung des Systems + Use-Case.',
      parameters: {
        type: 'object',
        properties: {
          system_description: {
            type: 'string',
            description:
              'Was macht das AI-System? Welche Daten verarbeitet es? In welchem Kontext wird es eingesetzt?',
          },
        },
        required: ['system_description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_pre_consent_tracker',
      description:
        'Prueft ob ein bestimmter Tracker oder Drittanbieter-Service VOR Einwilligung geladen werden darf. Input ist der Vendor-Name und der Use-Case.',
      parameters: {
        type: 'object',
        properties: {
          vendor_name: {
            type: 'string',
            description: 'z.B. "Google Analytics", "Meta Pixel", "HubSpot"',
          },
          use_case: {
            type: 'string',
            description: 'Was wird damit gemacht? Z.B. "Marketing-Tracking", "Session-Recording"',
          },
        },
        required: ['vendor_name', 'use_case'],
      },
    },
  },
];

/**
 * Tool-Implementierung. Liefert strukturierte JSON-Strings die OpenAI als
 * tool-Antwort zurueckgegeben werden.
 *
 * In dieser Iteration: heuristische Antworten ohne externe DB-Calls.
 * Folge-PR ersetzt durch echte Lookups (Norm-Texte aus pre-loaded JSON,
 * AI-Act-Annex-III-Mapping aus public.ai_systems-Schema).
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case 'lookup_dsgvo_paragraph':
      return executeLookupDsgvo(args as { norm_reference: string });
    case 'classify_ai_system_risk':
      return executeClassifyAi(args as { system_description: string });
    case 'check_pre_consent_tracker':
      return executeCheckPreConsent(args as { vendor_name: string; use_case: string });
    default:
      return JSON.stringify({ error: `unknown tool: ${name}` });
  }
}

// ─── Tool-Implementations (Heuristik) ────────────────────────────────────────

function executeLookupDsgvo(args: { norm_reference: string }): string {
  const ref = args.norm_reference.toLowerCase();
  // Heuristic-Lookup. Folge-PR: pre-loaded JSON mit Volltext der wichtigsten
  // 30 Norm-Stellen.
  const knownNorms: Record<string, string> = {
    'dsgvo art. 6':
      'Rechtsgrundlagen fuer Verarbeitung personenbezogener Daten. 6 lit (a) Einwilligung, (b) Vertrag, (c) rechtliche Pflicht, (d) lebenswichtige Interessen, (e) oeffentliche Aufgabe, (f) berechtigtes Interesse.',
    'dsgvo art. 9':
      'Verarbeitung besonderer Kategorien personenbezogener Daten (Gesundheit, Religion, ethnische Herkunft etc). Grundsaetzlich verboten, Ausnahmen in Abs. 2 (z.B. ausdruckliche Einwilligung).',
    'dsgvo art. 13':
      'Informationspflichten bei Erhebung personenbezogener Daten direkt beim Betroffenen. Pflicht: Identitaet Verantwortlicher, Verarbeitungszwecke, Rechtsgrundlage, Empfaenger, Speicherdauer, Betroffenenrechte.',
    'dsgvo art. 32':
      'Sicherheit der Verarbeitung. Geeignete technische und organisatorische Massnahmen (TOM): Pseudonymisierung, Verschluesselung, Verfuegbarkeit, Wiederherstellung.',
    'dsgvo art. 35':
      'Datenschutz-Folgenabschaetzung (DSFA) bei voraussichtlich hohem Risiko. Pflicht bei systematischer Profilbildung, grossangelegter Verarbeitung sensibler Daten, oeffentlicher Ueberwachung.',
    'ttdsg § 25':
      'Speicherung und Zugriff auf Endgeraet-Informationen (Cookies etc.) nur mit Einwilligung. Ausnahmen: technisch notwendig oder ausdruecklich gewuenschter Telemediendienst.',
  };
  for (const [key, value] of Object.entries(knownNorms)) {
    if (ref.includes(key)) {
      return JSON.stringify({ norm: args.norm_reference, summary: value, source: 'pre_loaded_heuristic' });
    }
  }
  return JSON.stringify({
    norm: args.norm_reference,
    summary: 'Norm nicht in der Pre-Loaded-Liste. Bitte konkret im Norm-Text nachschlagen.',
    source: 'unknown',
  });
}

function executeClassifyAi(args: { system_description: string }): string {
  const desc = args.system_description.toLowerCase();
  // Heuristic-Klassifikation basierend auf Annex-III-Schluesselwoertern.
  const high_risk_keywords = [
    'recruiting', 'bewerb', 'kreditwuerd', 'bonitaet', 'medizin', 'diagnos',
    'strafverfolg', 'biometr', 'einstellung', 'kuendigung', 'performance review',
    'social scoring', 'schule', 'pruefung',
  ];
  const prohibited_keywords = [
    'social scoring oeffentlich', 'realtime biometrie oeffentlich', 'manipul',
    'subliminal',
  ];
  const limited_keywords = ['chatbot', 'deepfake', 'inhalt generier', 'voice'];

  for (const kw of prohibited_keywords) {
    if (desc.includes(kw)) {
      return JSON.stringify({
        ai_act_class: 'prohibited',
        reasoning: `Keyword '${kw}' deutet auf verbotene Praktik (Art. 5 AI Act). Bitte mit Anwalt verifizieren.`,
      });
    }
  }
  for (const kw of high_risk_keywords) {
    if (desc.includes(kw)) {
      return JSON.stringify({
        ai_act_class: 'high',
        reasoning: `Keyword '${kw}' deutet auf Annex-III-Hochrisiko-Anwendung. Pflichten: Risk-Management-System, Doku, Logging, Human-Oversight, CE-Kennzeichnung.`,
      });
    }
  }
  for (const kw of limited_keywords) {
    if (desc.includes(kw)) {
      return JSON.stringify({
        ai_act_class: 'limited',
        reasoning: `Keyword '${kw}' deutet auf Limited-Risk (Transparenzpflichten gem. Art. 50).`,
      });
    }
  }
  return JSON.stringify({
    ai_act_class: 'minimal',
    reasoning: 'Keine high-/limited-Risk-Keywords in Beschreibung gefunden. Wahrscheinlich Minimal-Risk (keine spezifischen Pflichten). Bitte trotzdem ggf. mit DSB pruefen.',
  });
}

function executeCheckPreConsent(args: { vendor_name: string; use_case: string }): string {
  const vendor = args.vendor_name.toLowerCase();
  const tracking_vendors = [
    'google analytics', 'meta pixel', 'facebook pixel', 'hubspot', 'hotjar',
    'tiktok', 'linkedin insight', 'google ads', 'fbq', 'gtag',
  ];
  if (tracking_vendors.some((v) => vendor.includes(v))) {
    return JSON.stringify({
      vendor: args.vendor_name,
      use_case: args.use_case,
      pre_consent_allowed: false,
      reasoning: 'Tracking-Vendor mit Cookie-Setzung / Drittland-Transfer. TTDSG § 25 verlangt Consent VOR Laden. Default = blockiert bis Klick.',
      mitigation: 'Script via type="text/plain" + data-consent="marketing" laden, erst nach Consent aktivieren.',
    });
  }
  // Functional / strikt-notwendige Cookies
  const allowed_categories = ['session', 'csrf', 'load-balancer', 'consent-management'];
  if (allowed_categories.some((cat) => args.use_case.toLowerCase().includes(cat))) {
    return JSON.stringify({
      vendor: args.vendor_name,
      use_case: args.use_case,
      pre_consent_allowed: true,
      reasoning: 'Strikt-notwendige Funktion (TTDSG § 25 Abs. 2 Ausnahme). Consent nicht erforderlich.',
    });
  }
  return JSON.stringify({
    vendor: args.vendor_name,
    use_case: args.use_case,
    pre_consent_allowed: 'unclear',
    reasoning: 'Vendor nicht in Standard-Tracking-Liste. Bitte konkrete Cookie-Setzung + Drittland-Status pruefen, dann entscheiden.',
  });
}
