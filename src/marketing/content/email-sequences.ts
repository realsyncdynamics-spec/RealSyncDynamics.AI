/**
 * Cold-Email-Templates fuer Partner-Outreach (DSBs + Agenturen).
 *
 * Regeln:
 *   - Erste Mail: VALUE first, nie Pitch first. Idealerweise 1 konkretes
 *     Finding aus der Website des Empfaengers.
 *   - Zweite Mail: Pilot-Angebot, klar terminiert.
 *   - Dritte Mail: kurzer Reminder, nie pushy.
 *   - Kein Bußgeld-Drohwording, kein „rechtssicher", kein „garantiert".
 *   - CTA: immer auf /partners oder /audit, abhaengig vom Sequenz-Schritt.
 */

import type { ContentAsset } from '../types';

export interface ColdEmail extends ContentAsset {
  channel: 'cold_email';
  /** Beziehung zur Sequenz, falls Multi-Step. 0 = standalone. */
  sequenceStep: number;
  /** Verschickt X Tage nach vorigem Schritt. */
  sendOffsetDays: number;
  subject: string;
  body: string;
  /** Platzhalter, die der Versender ersetzen muss. */
  placeholders: string[];
}

const SIGNATURE = `--
RealSync Dynamics
Schwarzburger Str. 31, 98724 Neuhaus am Rennweg
support@realsyncdynamicsai.de · realsyncdynamicsai.de`;

export const COLD_EMAILS: ColdEmail[] = [
  // ── Sequenz: Externer DSB ─────────────────────────────────────────────
  {
    id: 'mail-dsb-ext-01-value',
    channel: 'cold_email',
    theme: 'real_finding',
    persona: ['dsb_external'],
    cta: 'partners',
    sequenceStep: 1,
    sendOffsetDays: 0,
    subject: 'Kurzbefund {{kanzlei_name}}: {{finding_count}} Tracker vor Consent',
    placeholders: ['{{vorname}}', '{{kanzlei_name}}', '{{domain}}', '{{finding_count}}', '{{top_finding}}'],
    body:
`Hallo {{vorname}},

ich habe heute morgen {{domain}} mit unserem Scanner gegen die Pre-Consent-Regeln laufen lassen.

Ergebnis: {{finding_count}} Tracker laden vor dem Einwilligungsklick. Top-Finding: {{top_finding}}.

Das ist nicht als Verkaufs-Mail gemeint. Eher als „falls dich interessiert, was deine eigene Website tut, hier ist ein technischer Snapshot." Anbei der detaillierte Trace als JSON.

Wenn die Frage „Wie sehen die Websites unserer Mandanten aus?" relevant ist, sag kurz Bescheid — ich habe ein paar Gedanken zu Multi-Mandanten-Monitoring, die du vielleicht spannend findest.

Beste Grüße
{{absender_name}}

${SIGNATURE}`,
  },
  {
    id: 'mail-dsb-ext-02-pilot',
    channel: 'cold_email',
    theme: 'partner_program',
    persona: ['dsb_external'],
    cta: 'partners',
    sequenceStep: 2,
    sendOffsetDays: 4,
    subject: 'Pilot-Idee: 10 Mandanten, 1 Dashboard, 90 Tage kostenlos',
    placeholders: ['{{vorname}}'],
    body:
`Hallo {{vorname}},

der Snapshot der letzten Mail war ein Einzelbild. Was DSBs typischerweise brauchen, ist der laufende Film.

Wir vergeben gerade 3 Partner-Pilot-Plätze für externe DSBs:

· Bis zu 10 Mandanten-Websites parallel im selben Dashboard
· Drift-Detection bei jeder GTM- oder Plugin-Änderung
· White-Label-Reports mit deinem Logo
· 90 Tage kostenlos, danach Reseller-Konditionen
· Wöchentliche Abstimmungen mit uns, was bei der Mandanten-Kommunikation funktioniert

Wenn das interessant klingt: 20-Minuten-Call reicht zum Sortieren. Wenn nicht — auch okay, dann hörst du nichts mehr von mir zum Thema.

Partner-Pilot: realsyncdynamicsai.de/partners

Beste Grüße
{{absender_name}}

${SIGNATURE}`,
  },
  {
    id: 'mail-dsb-ext-03-reminder',
    channel: 'cold_email',
    theme: 'partner_program',
    persona: ['dsb_external'],
    cta: 'partners',
    sequenceStep: 3,
    sendOffsetDays: 6,
    subject: 'Letzter Versuch: 2 Pilot-Plätze offen',
    placeholders: ['{{vorname}}'],
    body:
`Hallo {{vorname}},

kurzer Schluss-Stand und dann hörst du nichts mehr von uns:

Von den 3 Pilot-Plätzen sind aktuell noch 2 offen. Schließen wir Ende {{monat}}.

Falls du eingrenzen willst, ohne gleich auf einen Call zu gehen — die Pilot-Übersicht steht auf realsyncdynamicsai.de/partners (Scrollen, lesen, schweigen ist eine valide Antwort).

Danke für deine Zeit.

Beste Grüße
{{absender_name}}

${SIGNATURE}`,
  },
  // ── Sequenz: Web-Agentur ──────────────────────────────────────────────
  {
    id: 'mail-agency-01-value',
    channel: 'cold_email',
    theme: 'real_finding',
    persona: ['agency_owner'],
    cta: 'free_audit',
    sequenceStep: 1,
    sendOffsetDays: 0,
    subject: 'Snapshot 3 eurer Kundenseiten — und ein Problem, das ihr nicht baut',
    placeholders: ['{{vorname}}', '{{agentur_name}}', '{{kunde_1}}', '{{kunde_2}}', '{{kunde_3}}'],
    body:
`Hallo {{vorname}},

ich habe drei Seiten aus eurem Portfolio durch unseren Scanner gelassen:

· {{kunde_1}}
· {{kunde_2}}
· {{kunde_3}}

In allen drei Fällen sehen wir Tracker, die nach dem letzten Release dazugekommen sind — vermutlich über GTM oder Marketing-Tool-Updates, nicht über eure Hand.

Das ist genau das Problem, das wir versuchen sichtbar zu machen: Agenturen liefern saubere Releases, aber Marketing-Operations driften zwischen den Releases.

Falls relevant: Ich habe die drei Reports im Anhang. Reine Sichtbarkeit, keine Wertung.

Beste Grüße
{{absender_name}}

${SIGNATURE}`,
  },
  {
    id: 'mail-agency-02-pilot',
    channel: 'cold_email',
    theme: 'partner_program',
    persona: ['agency_owner'],
    cta: 'partners',
    sequenceStep: 2,
    sendOffsetDays: 5,
    subject: 'Wenn ihr 10 Kunden-Sites monitoren wolltet …',
    placeholders: ['{{vorname}}'],
    body:
`Hallo {{vorname}},

wenn das, was ich neulich an Findings gezeigt habe, in eurer Realität wiederkommt — wir haben ein Agency-Tier, das genau dafür gebaut ist:

· 10 Kunden-Sites im selben Dashboard
· White-Label-Reports mit eurem Logo
· API + Webhooks für CI/CD
· Drift-Alerts pro Kunde

Aktuell sammeln wir Pilot-Agenturen. Bedingung ist nur, dass wir alle 14 Tage 30 Minuten reden, was bei euren Kunden funktioniert und was nicht.

Falls interessant: realsyncdynamicsai.de/partners. Wenn nicht, ist auch fine — wir schicken dann keine weiteren Mails.

Beste Grüße
{{absender_name}}

${SIGNATURE}`,
  },
  // ── Single: Kanzlei ───────────────────────────────────────────────────
  {
    id: 'mail-kanzlei-01-standalone',
    channel: 'cold_email',
    theme: 'evidence_runtime',
    persona: ['kanzlei'],
    cta: 'docs_evidence',
    sequenceStep: 0,
    sendOffsetDays: 0,
    subject: 'Technische Evidence für DSGVO-/AI-Act-Sachverhalte',
    placeholders: ['{{vorname}}', '{{kanzlei_name}}'],
    body:
`Hallo {{vorname}},

bei DSGVO- oder AI-Act-Sachverhalten fehlt Kanzleien oft eines: technische Evidence im Moment der Tatsache. Screenshots reichen nicht; Logs sind selten ausreichend strukturiert.

Wir bauen eine Runtime, die genau dort einspringt:

· Snapshot mit Rule-ID, Zeitpunkt, Quelle und Hash
· Hash-Chain — spätere Manipulation würde sichtbar
· JSON-Export, signiert, fit für Beweisaufnahmen

Das Modell ist offen dokumentiert: realsyncdynamicsai.de/evidence

Falls das in eurer Mandantenarbeit gerade ein Thema ist — gerne ein 20-Minuten-Gespräch. Sonst ignoriert die Mail einfach, ich schreibe keine zweite.

Beste Grüße
{{absender_name}}

${SIGNATURE}`,
  },
  // ── Single: KMU-Geschäftsführung (warm-aware lead) ────────────────────
  {
    id: 'mail-kmu-01-followup-audit',
    channel: 'cold_email',
    theme: 'real_finding',
    persona: ['kmu_geschaeftsfuehrung'],
    cta: 'free_audit',
    sequenceStep: 0,
    sendOffsetDays: 0,
    subject: 'Eure Scan-Ergebnisse von {{datum}} — kurze Nachfrage',
    placeholders: ['{{vorname}}', '{{firma}}', '{{datum}}', '{{top_finding}}'],
    body:
`Hallo {{vorname}},

ihr habt am {{datum}} unseren Free-Audit für {{firma}} laufen lassen. Der Score lag bei {{score}}, das prägnanteste Finding war {{top_finding}}.

Drei Optionen, was jetzt passieren könnte:

1. Ihr fixt das intern. Kein Folge-Aufwand.
2. Ihr lasst es scannen — monatlich oder täglich, je nach Plan — damit ihr seht, wenn neue Tracker dazukommen.
3. Ihr fragt uns konkret, was die Top-3-Findings im Detail bedeuten.

Was wir ausdrücklich nicht tun: euch in einen Sales-Loop nehmen. Wenn 1 die richtige Antwort ist, sehen wir uns hier nicht wieder.

Falls 2 oder 3 — kurz antworten reicht.

Beste Grüße
{{absender_name}}

${SIGNATURE}`,
  },
  // ── Single: In-house DSB ──────────────────────────────────────────────
  {
    id: 'mail-dsb-int-01-standalone',
    channel: 'cold_email',
    theme: 'ai_act',
    persona: ['dsb_internal'],
    cta: 'free_audit',
    sequenceStep: 0,
    sendOffsetDays: 0,
    subject: 'Inventar KI-Systeme: Excel-Liste oder Runtime?',
    placeholders: ['{{vorname}}', '{{unternehmen}}'],
    body:
`Hallo {{vorname}},

die meisten DSBs, mit denen wir reden, halten ihr KI-System-Inventar als Excel-Liste oder Confluence-Seite. Das ist nicht falsch — aber spätestens, wenn die High-Risk-Pflichten des AI Act ab 2026 greifen, wird das anstrengend.

Was wir dazu beitragen können:

· Inventar als Runtime-Tabelle, nicht als statisches Dokument
· Jedes neue System wird erfasst, sobald es einen Endpoint aufruft
· Klassifikation, Datenflüsse, betroffene Personen — als Felder, nicht als Freitext
· Snapshot pro Stichtag, archivierbar für Audits

Wenn das hilfreich klingt für {{unternehmen}}: Free-Audit als Einstieg ist auf realsyncdynamicsai.de/audit (kein Account nötig).

Beste Grüße
{{absender_name}}

${SIGNATURE}`,
  },
  // ── Single: Compliance-Lead (mittelgroßes Unternehmen) ────────────────
  {
    id: 'mail-compliance-01-runtime',
    channel: 'cold_email',
    theme: 'evidence_runtime',
    persona: ['compliance_lead'],
    cta: 'contact_sales',
    sequenceStep: 0,
    sendOffsetDays: 0,
    subject: 'Compliance-Drift zwischen den jährlichen Audits',
    placeholders: ['{{vorname}}', '{{unternehmen}}'],
    body:
`Hallo {{vorname}},

bei {{unternehmen}} wird vermutlich einmal pro Jahr ein größerer Compliance-Audit gefahren. Das ist gut — und gleichzeitig das Hauptproblem.

Zwischen zwei Audits passiert:
· Neue Marketing-Pixel
· Neue SaaS-Anbieter, die ihr nicht beauftragt habt (Schatten-IT)
· Plugin-Updates, die Tracker reaktivieren
· KI-Endpunkte, die Teams „mal eben" anbinden

Wir adressieren das mit einer Runtime, die kontinuierlich misst und Drift bemerkt. Konkret im Mittelstand-Tier: Daily Scan, Drift-Alerts, Fix-Snippets, Evidence-Export.

Falls das ein Thema ist: 30 Minuten reichen, um zu sortieren, ob es in eure Stack-Realität passt.

Sales-Call: realsyncdynamicsai.de/contact-sales

Beste Grüße
{{absender_name}}

${SIGNATURE}`,
  },
  // ── Single: Steuerberater / Wirtschaftsprüfer (DSB-near) ──────────────
  {
    id: 'mail-stb-01-standalone',
    channel: 'cold_email',
    theme: 'partner_program',
    persona: ['kanzlei', 'dsb_external'],
    cta: 'partners',
    sequenceStep: 0,
    sendOffsetDays: 0,
    subject: 'Compliance-Toolset für Steuerberater mit DSB-Mandaten',
    placeholders: ['{{vorname}}', '{{kanzlei_name}}'],
    body:
`Hallo {{vorname}},

einige Steuerberater-Kanzleien übernehmen zunehmend DSB-Mandate — und stoßen bei der technischen Seite an die gleiche Wand: Wie misst man eine Mandanten-Website monatlich, ohne ständig einen IT-Dienstleister einzuspannen?

Genau diese Lücke ist unser Agency-Tier:
· 10 Mandanten parallel
· White-Label-Reports
· Monatlicher Drift-Bericht je Mandant
· API für eigene Integrationen (z. B. DATEV-Schnittstellen)

Wenn ihr DSB-Mandate bündelt, lohnt sich vielleicht ein Pilot-Gespräch.

Partner-Pilot: realsyncdynamicsai.de/partners

Beste Grüße
{{absender_name}}

${SIGNATURE}`,
  },
];
