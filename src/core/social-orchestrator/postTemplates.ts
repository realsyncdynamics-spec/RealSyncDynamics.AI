// Per-channel, per-event-type templates for the social orchestrator.
//
// Templates are pure functions: SocialEvent → { body, hashtags }.
// They do not reach into the runtime, the network, or any global
// state. The PostGenerator chains template + policy + final wrap.
//
// Tone guidance per channel:
//   linkedin.enterprise — B2B, governance, audit-grade, EU-AI-Act-fluent.
//   linkedin.legal      — narrower DPO/legal-counsel framing, regulator-aware.
//   instagram.reel      — hook-led, visual cue, 1-2 short paragraphs.
//   tiktok.fast         — single-hook, conversational, no compliance jargon overload.
//   x.alert             — datapoint + one-line context, datadriven, terse.

import type { SocialEvent, SocialChannel } from './types';

interface TemplateOutput {
  /** Post body text. The PostGenerator may append a hashtag block. */
  body: string;
  /** Channel-specific hashtags (will be merged with event-level set). */
  hashtags: string[];
}

type TemplateFn = (event: SocialEvent) => TemplateOutput;

// ── Channel character budgets (informational; PostGenerator clips
//    only when exceeded) ────────────────────────────────────────────

export const CHANNEL_CHAR_BUDGET: Record<SocialChannel, number> = {
  'linkedin.enterprise': 2200,   // LinkedIn post hard cap is 3000; keep room for hashtags
  'linkedin.legal':      2200,
  'instagram.reel':       900,   // Reels caption practical limit
  'tiktok.fast':          280,   // TikTok caption short
  'x.alert':              260,   // X (Twitter) 280 minus margin for autolinks
  'wordpress.blog':      5000,   // WordPress post body (no hard limit)
  'ghost.blog':          5000,   // Ghost post body (no hard limit)
  'webhook.custom':      2000,   // Webhook payload (application-dependent)
  'email.newsletter':    3000,   // Email body (plain text or HTML)
};

// ── Tone hashtag overlays (added per channel) ──────────────────────

const CHANNEL_HASHTAGS: Record<SocialChannel, string[]> = {
  'linkedin.enterprise': ['#EnterpriseGovernance', '#B2BSaaS'],
  'linkedin.legal':      ['#DPO', '#LegalTech'],
  'instagram.reel':      ['#TechExplained', '#PrivacyTech'],
  'tiktok.fast':         ['#TechTok', '#PrivacyTech'],
  'x.alert':             ['#Runtime', '#GovernanceTech'],
  'wordpress.blog':      ['#GovernanceBlog', '#Compliance'],
  'ghost.blog':          ['#ComplianceBlog', '#Enterprise'],
  'webhook.custom':      ['#Integration', '#Automation'],
  'email.newsletter':    ['#Governance', '#Newsletter'],
};

// ── Templates per channel × event type ─────────────────────────────
//
// Layout: TEMPLATES[channel][eventType] = TemplateFn. A missing entry
// falls back to TEMPLATES[channel].__default which uses the
// SocialEvent.anonymizedSummary verbatim (so an unknown event type
// still produces a publishable post).

const TEMPLATES: Record<SocialChannel, Record<string, TemplateFn>> = {
  'linkedin.enterprise': {
    'tracker.detected': () => ({
      body:
        'Realtime-Governance statt einmaliger Checkliste: Unsere Runtime hat neue Tracking-Aktivität erkannt, klassifiziert und revisionsfähig dokumentiert. Genau hier beginnt moderne DSGVO-Operationalisierung.',
      hashtags: ['#TrackerDetection', '#ContinuousCompliance'],
    }),
    'ai.endpoint.detected': () => ({
      body:
        'Ein neuer AI-Endpoint wurde im Tenant-Scope erkannt und gegen den Annex-III-Use-Case-Katalog des EU AI Act geprüft. Indikator-basierte Vorklassifikation, Audit-Trail im Evidence Store, optional zur Steuerprüfung freigegeben.',
      hashtags: ['#AIAct', '#AIGovernance'],
    }),
    'consent.missing': () => ({
      body:
        'Datenverarbeitung ohne dokumentierten Consent ist kein Detail — sie ist der häufigste Befund in unseren Audits. Unsere Runtime erkennt das Muster früh und versiegelt es im Evidence Stream, bevor es zum Bußgeld-Indikator wird.',
      hashtags: ['#Consent', '#TDDDG'],
    }),
    'high_risk.classified': () => ({
      body:
        'High-Risk-Klassifikation in der Governance-Runtime ausgelöst. Der Befund wird durch einen menschlichen Reviewer bestätigt, die Entscheidung wandert in die Audit-Chain. Genau dieses Zusammenspiel macht AI-Act-Konformität betreibbar.',
      hashtags: ['#AIAct', '#HumanInTheLoop'],
    }),
    'evidence.anchor.created': () => ({
      body:
        'Jedes governance-relevante Ereignis bekommt bei uns einen kryptographischen Anker in der Evidence Chain. Hash-verkettet, append-only, replay-fähig — die technische Voraussetzung für Audit-Verteidigbarkeit Jahre später.',
      hashtags: ['#EvidenceChain', '#AuditReadiness'],
    }),
    'policy.violation.detected': () => ({
      body:
        'Eine Policy-Verletzung wurde in Echtzeit erkannt, im Evidence Store verankert und der zuständigen Rolle zur Überprüfung zugespielt. Compliance-as-Code, nicht Compliance-as-PDF.',
      hashtags: ['#PolicyEngine', '#GovernanceRuntime'],
    }),
    'audit.bundle.generated': () => ({
      body:
        'Ein Audit-Bundle ist fertig: alle relevanten Evidence-Anker, die zugehörigen Policy-Versionen und der Replay-Index, gebündelt in einem Übergabe-fähigen Paket. Übergabe an Reviewer oder externe Prüfer in einem Schritt.',
      hashtags: ['#AuditBundle', '#AuditReadiness'],
    }),
    'privacy.delta.generated': () => ({
      body:
        'Privacy-Delta für die letzten 30 Tage liegt vor: was hat sich geändert, was ist neu, was wurde gerechtfertigt entfernt. Veränderung ist normal — unklare Veränderung ist das Risiko.',
      hashtags: ['#PrivacyOps', '#ChangeManagement'],
    }),
    'runtime.replay.completed': () => ({
      body:
        'Runtime-Replay abgeschlossen: ein historisches Governance-Event wurde reproduziert und identisch verifiziert. Ohne diesen Schritt bleibt jeder Audit-Trail eine Behauptung.',
      hashtags: ['#Reproducibility', '#Audit'],
    }),
    __default: (e) => ({
      body: e.anonymizedSummary,
      hashtags: [],
    }),
  },

  'linkedin.legal': {
    'tracker.detected': () => ({
      body:
        'Hinweis aus der Praxis: Tracking-Aktivität verändert sich kontinuierlich. Eine einmalige Datenschutz-Folgenabschätzung deckt diese Veränderung nicht ab. Continuous Detection + Evidence Anchoring schließt diese Lücke prüfbar — relevant für DSGVO Art. 5 Abs. 2 (Rechenschaftspflicht).',
      hashtags: ['#DSGVO', '#TDDDG'],
    }),
    'ai.endpoint.detected': () => ({
      body:
        'Aus DPO-Perspektive: ein neu erkannter AI-Endpoint im Verarbeitungspfad ist potenziell ein Hochrisiko-System nach Annex III der Verordnung 2024/1689 (EU AI Act). Indikator, kein Urteil — die Klassifikation bleibt prüfpflichtig.',
      hashtags: ['#AIAct', '#DPO'],
    }),
    'consent.missing': () => ({
      body:
        'Fehlender Consent-Nachweis ist im Audit-Verfahren regelmäßig der erste Befund. Ein versiegelter Negativ-Nachweis hilft sowohl in der Aufsichts-Korrespondenz als auch in der Verteidigung gegen einen Auskunftsanspruch nach DSGVO Art. 15.',
      hashtags: ['#Consent', '#DPO'],
    }),
    'high_risk.classified': () => ({
      body:
        'Eine Klassifikation als hochriskant ist nach EU AI Act Art. 9 mit dokumentierten Risikomanagement-Schritten zu hinterlegen. Unsere Runtime führt diese Schritte und reicht sie zur Reviewer-Bestätigung ein.',
      hashtags: ['#AIAct', '#RiskManagement'],
    }),
    'evidence.anchor.created': () => ({
      body:
        'Manipulationssichere Beweisführung ist die Grundlage für jede regulatorische Verteidigung. Hash-verkettete Evidence-Anker erfüllen das auch ohne Spezial-Tooling auf Behörden-Seite.',
      hashtags: ['#Evidence', '#Audit'],
    }),
    'policy.violation.detected': () => ({
      body:
        'Erkannte Abweichung von einer hinterlegten Policy. Bevor eine rechtliche Bewertung erfolgt, ist der technische Befund versiegelt — exakt der Anker, den eine spätere Bewertung braucht.',
      hashtags: ['#PolicyEngine', '#DPO'],
    }),
    'audit.bundle.generated': () => ({
      body:
        'Audit-Bundle bereit: technischer Beleg, Policy-Versionierung und Replay-Anweisung in einem Paket. Übergabefähig an Aufsicht, externe Prüfung oder die eigene Rechtsabteilung.',
      hashtags: ['#AuditBundle', '#DPO'],
    }),
    __default: (e) => ({
      body: e.anonymizedSummary,
      hashtags: [],
    }),
  },

  'instagram.reel': {
    'tracker.detected': () => ({
      body:
        'Deine Website kann in Sekunden neue Tracker laden — ohne dass du es merkst. Genau dafür läuft RealSync als Compliance-Runtime im Hintergrund. 👉 Erkennen, klassifizieren, dokumentieren.',
      hashtags: ['#PrivacyTech', '#Tech'],
    }),
    'ai.endpoint.detected': () => ({
      body:
        'Ein neuer AI-Endpoint im Stack? Unsere Runtime checkt sofort, ob das ein "potenzielles Hochrisiko-System" nach EU AI Act sein könnte. Hinweis, kein Urteil — aber sichtbar.',
      hashtags: ['#AIAct', '#PrivacyTech'],
    }),
    'consent.missing': () => ({
      body:
        'Wenn Tracking ohne Consent läuft, merkt das oft niemand — bis das erste Bußgeld kommt. Wir setzen einen prüfbaren Negativ-Nachweis, sobald die Lücke entsteht.',
      hashtags: ['#Consent', '#PrivacyTech'],
    }),
    'high_risk.classified': () => ({
      body:
        'High-Risk-Klassifikation bedeutet: ein Mensch sieht es sich an, bevor irgendetwas passiert. Genau so soll AI-Compliance funktionieren — nicht "die KI hat entschieden".',
      hashtags: ['#AIAct', '#HumanInTheLoop'],
    }),
    'evidence.anchor.created': () => ({
      body:
        'Jedes wichtige Compliance-Ereignis kriegt bei uns einen kryptographischen Fingerprint. Heißt: in 5 Jahren noch nachweisbar, was wann passiert ist.',
      hashtags: ['#TechExplained', '#Audit'],
    }),
    __default: (e) => ({
      body: shortHook(e.anonymizedSummary),
      hashtags: [],
    }),
  },

  'tiktok.fast': {
    'tracker.detected': () => ({
      body:
        'Ein Tracker auf deiner Site, den keiner kennt? Unsere Runtime fängt das in Echtzeit. Compliance, aber live.',
      hashtags: ['#TechTok', '#Privacy'],
    }),
    'ai.endpoint.detected': () => ({
      body:
        'Neue AI-Endpoint im Stack? Wir checken sofort gegen den EU AI Act. Hinweis: kein Urteil, aber sichtbar.',
      hashtags: ['#AIAct', '#TechTok'],
    }),
    'consent.missing': () => ({
      body:
        'Wenn Consent fehlt, sieht das oft niemand. Wir machen es sichtbar — bevor es teuer wird.',
      hashtags: ['#Privacy', '#TechTok'],
    }),
    'high_risk.classified': () => ({
      body:
        'High-Risk-Klassifikation? Erst Mensch, dann Maschine. So sollte AI-Governance immer aussehen.',
      hashtags: ['#AIAct', '#TechTok'],
    }),
    'evidence.anchor.created': () => ({
      body:
        'Compliance-Ereignis kriegt einen kryptographischen Fingerprint. Auch in 5 Jahren noch nachweisbar.',
      hashtags: ['#TechTok', '#Audit'],
    }),
    __default: (e) => ({
      body: shortHook(e.anonymizedSummary),
      hashtags: [],
    }),
  },

  'x.alert': {
    'tracker.detected': () => ({
      body:
        'Runtime Alert: Neuer Tracker erkannt, klassifiziert und als Governance Event dokumentiert.',
      hashtags: [],
    }),
    'ai.endpoint.detected': () => ({
      body:
        'Runtime Alert: AI-Endpoint detektiert, gegen Annex-III-Use-Case-Katalog (EU AI Act) geprüft.',
      hashtags: ['#AIAct'],
    }),
    'consent.missing': () => ({
      body:
        'Runtime Alert: Verarbeitung ohne dokumentierten Consent erkannt; Befund im Evidence Stream versiegelt.',
      hashtags: ['#Consent'],
    }),
    'high_risk.classified': () => ({
      body:
        'Runtime Alert: High-Risk-Klassifikation. Reviewer notifiziert, Befund in Audit-Chain.',
      hashtags: ['#AIAct'],
    }),
    'evidence.anchor.created': () => ({
      body:
        'Runtime: neuer Evidence-Anker, hash-verkettet, in der Audit-Chain.',
      hashtags: [],
    }),
    'policy.violation.detected': () => ({
      body:
        'Runtime Alert: Policy-Verletzung erkannt, im Evidence Store verankert.',
      hashtags: ['#Governance'],
    }),
    __default: (e) => ({
      body: shortHook(e.anonymizedSummary),
      hashtags: [],
    }),
  },

  'wordpress.blog': {
    __default: (e) => ({
      body: e.anonymizedSummary,
      hashtags: [],
    }),
  },

  'ghost.blog': {
    __default: (e) => ({
      body: e.anonymizedSummary,
      hashtags: [],
    }),
  },

  'webhook.custom': {
    __default: (e) => ({
      body: e.anonymizedSummary,
      hashtags: [],
    }),
  },

  'email.newsletter': {
    __default: (e) => ({
      body: e.anonymizedSummary,
      hashtags: [],
    }),
  },
};

// ── Public surface ─────────────────────────────────────────────────

export function renderTemplate(channel: SocialChannel, event: SocialEvent): TemplateOutput {
  const channelMap = TEMPLATES[channel];
  const fn = channelMap[event.type] ?? channelMap.__default;
  const out = fn(event);

  // Merge channel-overlay hashtags + event-base hashtags + template-specific.
  const allHashtags = dedupeHashtags([
    ...out.hashtags,
    ...(CHANNEL_HASHTAGS[channel] ?? []),
    ...event.hashtags,
  ]);

  return {
    body: out.body,
    hashtags: allHashtags,
  };
}

// ── Helpers ────────────────────────────────────────────────────────

function shortHook(text: string): string {
  // Strip trailing punctuation, keep to a hook-length string.
  const trimmed = text.replace(/[.!?]+\s*$/, '').trim();
  if (trimmed.length <= 180) return trimmed + '.';
  return trimmed.slice(0, 177).trim() + '…';
}

function dedupeHashtags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}
