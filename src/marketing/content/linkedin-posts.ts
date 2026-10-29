/**
 * LinkedIn-Posts fuer die Kampagne "Was Ihre Website wirklich tut".
 *
 * Konventionen (siehe campaigns/governance-runtime-launch.ts → guardrails):
 *   - Deutsch
 *   - Keine Bußgeld-Drohungen, keine 100%-Garantien
 *   - Evidence/Runtime-Positioning, nicht Vision-Talk
 *   - CTA immer am Ende: "Kostenlosen Check starten"
 *   - 1 Hashtag-Block am Ende, max 5 Tags
 *
 * Schema (siehe types.ts ContentAsset):
 *   - hook   = erster Satz, max 12 Worte (LinkedIn schneidet nach ~140 Zeichen ab)
 *   - body   = Hauptkoerper, max ~1300 Zeichen total
 *   - cta    = "Kostenlosen Check starten" auf /audit (siehe CTA_TARGETS)
 */

import type { ContentAsset } from '../types';

export interface LinkedInPost extends ContentAsset {
  channel: 'linkedin';
  hook: string;
  body: string;
  hashtags: string[];
}

export const LINKEDIN_POSTS: LinkedInPost[] = [
  {
    id: 'li-001-runtime-positioning',
    channel: 'linkedin',
    theme: 'evidence_runtime',
    persona: ['kmu_geschaeftsfuehrung', 'dsb_external'],
    cta: 'free_audit',
    hook: 'Die meisten Unternehmen wissen nicht, was ihre Website wirklich macht.',
    body:
`Nicht laut Datenschutzerklärung. Sondern technisch.

Welche Tracker laden vor Consent?
Welche Drittanbieter werden kontaktiert?
Welche KI-Endpunkte sind eingebunden?
Welche Nachweise existieren, wenn ein DSB oder Kunde fragt?

Genau dafür bauen wir RealSyncDynamics.AI:

Eine laufende Governance-Runtime für Websites und KI-Systeme.

Nicht nur Scan. Nicht nur PDF. Sondern technische Evidence:
Rule-ID · Zeitpunkt · Quelle · Hash · Risiko · Review-Status.

Der nächste Compliance-Wettbewerb wird nicht durch schönere Dokumente gewonnen — sondern durch Systeme, die beweisen können, was wirklich passiert.

Kostenlosen Check starten → realsyncdynamicsai.de/audit`,
    hashtags: ['#DSGVO', '#AIAct', '#Compliance', '#Governance', '#EU'],
  },
  {
    id: 'li-002-real-finding-pre-consent',
    channel: 'linkedin',
    theme: 'real_finding',
    persona: ['kmu_geschaeftsfuehrung', 'developer'],
    cta: 'free_audit',
    hook: 'Heute morgen: Website eines Mittelständlers gescannt. 14 Requests vor Consent.',
    body:
`14 Requests vor dem ersten Klick auf den Cookie-Banner.

Davon:
· 4× Google-Domains (Tag Manager, Fonts, Analytics-Beacon)
· 2× Meta Pixel
· 1× LinkedIn Insight Tag
· 7× Third-Party-Skripte (Schriften, Maps, Embed-Player)

Die Datenschutzerklärung sagt: „Wir setzen Cookies nur nach Einwilligung."
Die Realität sagt: Nope.

Das ist kein böser Wille. Das ist die Standardkonfiguration der meisten Page-Builder.

Was wir liefern:
Eine Liste mit Rule-ID, Quelle und Hash — direkt verwertbar für Dev oder Agentur.

Kein PDF-Theater. Technische Evidence.

Kostenlosen Check starten → realsyncdynamicsai.de/audit`,
    hashtags: ['#PreConsent', '#TDDDG', '#DSGVO', '#Compliance'],
  },
  {
    id: 'li-003-ai-act-gpai-deadline',
    channel: 'linkedin',
    theme: 'ai_act',
    persona: ['compliance_lead', 'dsb_internal'],
    cta: 'free_audit',
    hook: 'Die GPAI-Pflichten des AI Act sind seit 2025 aktiv. High-Risk folgt 2026.',
    body:
`Was das praktisch heißt:

Wer ein KI-System nutzt — auch nur über eine API — muss inventarisieren können, welche Daten in welches Modell fließen, mit welcher Risiko-Klasse das System läuft und welche Aktionen es ausführen darf.

Die meisten Inventare existieren heute als Excel-Liste, die nach drei Wochen veraltet ist.

RealSync trackt diese Inventare als laufende Runtime:
· Welche Endpunkte sind verbunden?
· Welche Datenfelder verlassen das Unternehmen?
· Welche Agentenaktionen sind erlaubt?
· Welcher Review hat zuletzt stattgefunden?

Kein 100 %-Rechtssicherheits-Versprechen. Aber die technische Grundlage, auf der ein DSB ehrlich arbeiten kann.

Kostenlosen Check starten → realsyncdynamicsai.de/audit`,
    hashtags: ['#AIAct', '#AIGovernance', '#Compliance', '#EU'],
  },
  {
    id: 'li-004-founder-learning-pricing',
    channel: 'linkedin',
    theme: 'founder_learning',
    persona: ['founder'],
    cta: 'free_audit',
    hook: 'Wir hatten Starter auf 49 €. Jetzt auf 79 €. Hier ist warum.',
    body:
`49 € wirkt wie ein Hobby-Tool. Wer Compliance ernst nimmt, vertraut keinem Hobby-Tool.

79 € liegt im DACH-Pflicht-Compliance-Sweet-Spot:
Cookiebot Premium ~110 €. Iubenda Plus ~280 €.

Dazwischen ist genug Platz für ein Werkzeug, das tatsächlich monatlich scannt, Drift erkennt und Evidence produziert.

Lesson: Wenn dein Preis Skepsis erzeugt, ist nicht der Preis das Problem. Sondern die Positionierung darüber.

Wir haben das gelernt — und die Pricing-Page entsprechend umgebaut.

Kostenlosen Check starten → realsyncdynamicsai.de/audit`,
    hashtags: ['#SaaS', '#Pricing', '#FounderLearning'],
  },
  {
    id: 'li-005-consent-banner-pattern',
    channel: 'linkedin',
    theme: 'consent_timing',
    persona: ['kmu_geschaeftsfuehrung', 'agency_owner'],
    cta: 'free_audit',
    hook: 'Cookie-Banner ohne sichtbaren Reject-Button sind kein Compliance-Detail.',
    body:
`Sie sind eines der konsistentesten Anzeichen dafür, dass eine Consent-Strategie unter Druck zerbricht.

Was wir in Scans sehen:
· „Akzeptieren" gross, gruen, oben
· „Einstellungen" klein, grau, am Rand
· „Ablehnen" gar nicht — nur in „Einstellungen" verborgen

Aus DSGVO-Sicht ist das ein Problem. Aus UX-Sicht auch.

Was wir nicht behaupten: Dass jedes Layout automatisch rechtswidrig ist. Das entscheidet niemand auf LinkedIn — sondern Aufsichtsbehörden und Gerichte.

Was wir liefern: Eine technische Erfassung, mit Screenshot und Hash, die ein DSB oder eine Kanzlei in eine bestehende Akte legen kann.

Kostenlosen Check starten → realsyncdynamicsai.de/audit`,
    hashtags: ['#ConsentManagement', '#DSGVO', '#UX', '#Compliance'],
  },
  {
    id: 'li-006-agent-governance',
    channel: 'linkedin',
    theme: 'agent_governance',
    persona: ['compliance_lead', 'developer'],
    cta: 'free_audit',
    hook: 'AI Agents inventarisieren ist die nächste Compliance-Disziplin.',
    body:
`Aktuelle Forschung (u. a. EU-Kommissionsstudien) macht klar:

Wenn ein Agent autonom auf Systeme, APIs oder Datenflüsse zugreift, müssen Unternehmen künftig erfassen können — externe Aktionen, verbundene Systeme, betroffene Personen, Datenflüsse, Eskalationspfade.

Excel-Listen reichen nicht, sobald die Agent-Population größer als „eins" ist.

Was RealSync dazu beiträgt:
· Inventar als Runtime-Tabelle, nicht als Word-Dokument
· Jede Agentenaktion bekommt eine Rule-ID
· Drift-Detection bei jeder Konfigurationsänderung

Kein magisches Compliance-Pflaster. Aber eine seriöse Datengrundlage.

Kostenlosen Check starten → realsyncdynamicsai.de/audit`,
    hashtags: ['#AIAgents', '#AIGovernance', '#AIAct', '#Compliance'],
  },
  {
    id: 'li-007-evidence-vs-pdf',
    channel: 'linkedin',
    theme: 'evidence_runtime',
    persona: ['dsb_external', 'kanzlei'],
    cta: 'free_audit',
    hook: 'Ein PDF ist kein Nachweis. Es ist eine Behauptung über einen Nachweis.',
    body:
`Bei einer Anfrage durch eine Aufsichtsbehörde oder einen Geschäftspartner zählen drei Dinge:

1. Was war zum Zeitpunkt X technisch konfiguriert?
2. Wer hat das gesehen / freigegeben?
3. Lässt sich das nachweisen — nicht nur behaupten?

PDF-Reports liefern Antwort 1 in einer Momentaufnahme. Sie liefern Antwort 2 nicht. Sie liefern Antwort 3 nicht.

Eine Evidence-Runtime liefert:
· Rule-ID + Zeitpunkt + Quelle + Hash (Antwort 1, jederzeit reproduzierbar)
· Review-Status + Reviewer (Antwort 2)
· Hash-Chain (Antwort 3)

Es geht nicht um schönere Dokumente. Es geht um nachweisbare Realität.

Kostenlosen Check starten → realsyncdynamicsai.de/audit`,
    hashtags: ['#Evidence', '#Compliance', '#Governance', '#DSGVO'],
  },
  {
    id: 'li-008-founder-learning-cold-truth',
    channel: 'linkedin',
    theme: 'founder_learning',
    persona: ['founder'],
    cta: 'free_audit',
    hook: 'Erste Kalt-Demo eines Web-Audits: das Unternehmen wusste von 0 der 12 Findings.',
    body:
`Nicht weil sie unprofessionell sind. Sondern weil niemand systematisch hingeschaut hat.

Eine Website ist heute eine Maschine aus 30+ Third-Party-Skripten. Niemand liest CSP-Header. Niemand prüft, ob ein neues Tag-Manager-Container-Update Tracker re-aktiviert. Niemand merkt, wenn ein Plugin-Update einen Pixel mitbringt.

Das ist keine Schande. Das ist der Default-Zustand des Mittelstandes.

Was wir gelernt haben:
Der Hauptverkauf ist nicht „Compliance". Der Hauptverkauf ist „Sichtbarkeit über deine eigene Infrastruktur".

Compliance ist die Begründung. Sichtbarkeit ist der Nutzen.

Kostenlosen Check starten → realsyncdynamicsai.de/audit`,
    hashtags: ['#FounderLearning', '#SaaS', '#Compliance'],
  },
  {
    id: 'li-009-monthly-vs-snapshot',
    channel: 'linkedin',
    theme: 'evidence_runtime',
    persona: ['agency_owner', 'dsb_external'],
    cta: 'free_audit',
    hook: 'Ein Compliance-Audit, das einmal pro Jahr passiert, ist ein Compliance-Audit aus dem letzten Jahr.',
    body:
`Was sich zwischen zwei Audits ändert:
· Ein Marketing-Team installiert einen neuen Pixel.
· Ein Plugin-Update lädt einen Tracker nach.
· Ein Dienstleister tauscht den Embed-Player.
· Ein A/B-Test schaltet ein Drittanbieter-Script.

Jedes dieser Events ist ein neues Finding. Niemand schreibt sie irgendwo auf. Sie passieren einfach.

Continuous Monitoring ist keine Premium-Funktion. Es ist die einzige Form, in der Compliance ehrlich bleibt.

Free Audit zeigt dir den Snapshot. Growth zeigt dir den Drift.

Kostenlosen Check starten → realsyncdynamicsai.de/audit`,
    hashtags: ['#ContinuousCompliance', '#DSGVO', '#Monitoring'],
  },
  {
    id: 'li-010-partner-pilot',
    channel: 'linkedin',
    theme: 'partner_program',
    persona: ['dsb_external', 'agency_owner'],
    cta: 'partners',
    hook: 'Wir suchen 3 externe DSBs für einen Pilot.',
    body:
`Was wir anbieten:
· 5–10 Mandanten-Websites, parallel im selben Dashboard
· Multi-Tenant-Übersicht mit Drift-Alerts pro Mandant
· White-Label-Reports mit eurem Logo
· 90 Tage kostenlose Test-Phase, danach Reseller-Konditionen

Was wir suchen:
· Externe DSBs mit ≥ 5 Mandaten
· Bereitschaft, technische Findings ehrlich an die Mandanten weiterzugeben
· Feedback, was bei der Mandanten-Kommunikation funktioniert

Wenn das passt — schreibt mir kurz, ich schicke den Pilot-Ablauf.

Partner-Pilot anfragen → realsyncdynamicsai.de/partners`,
    hashtags: ['#Datenschutzbeauftragte', '#Partner', '#Pilot'],
  },
  {
    id: 'li-011-ai-act-marktortprinzip',
    channel: 'linkedin',
    theme: 'ai_act',
    persona: ['kmu_geschaeftsfuehrung', 'compliance_lead'],
    cta: 'free_audit',
    hook: 'Auch ohne EU-Sitz: Der AI Act gilt für jedes KI-System, das in der EU Wirkung entfaltet.',
    body:
`Marktortprinzip. Wie bei der DSGVO.

Praktisch heißt das:
Ein US-SaaS, das in Deutschland HR-Entscheidungen vorbereitet, ist betroffen. Ein indischer Übersetzungsdienst, der EU-Kunden mit KI bedient, ist betroffen. Ein deutsches Unternehmen, das ein britisches Modell nutzt, ist als Betreiber verantwortlich.

Die Frage „aber das Modell ist doch nicht aus der EU" ist ungefähr genauso entlastend wie „aber unser Tracking-Anbieter sitzt in den USA".

Was es konkret braucht:
· Welches System? Welche Risiko-Klasse?
· Welche Daten gehen rein?
· Welche Entscheidungen kommen raus?
· Welche Aufsicht ist vorgesehen?

Diese Inventare bauen wir technisch ab.

Kostenlosen Check starten → realsyncdynamicsai.de/audit`,
    hashtags: ['#AIAct', '#Marktortprinzip', '#Compliance'],
  },
  {
    id: 'li-012-developer-evidence-api',
    channel: 'linkedin',
    theme: 'evidence_runtime',
    persona: ['developer'],
    cta: 'docs_evidence',
    hook: 'Compliance-Tools verlieren Entwickler meist im ersten Onboarding-Screen.',
    body:
`Lange Formulare. Word-Templates. Keine API.

Wir machen es umgekehrt:
· Audit als API-Aufruf
· Evidence als JSON mit Rule-ID, Hash, Quelle
· Webhook bei jedem neuen Finding
· Drift-Diff als git-diff-ähnliches Patch-Format

Compliance gehört nicht in die Folien des Managements. Sie gehört in CI/CD.

Wenn dir das vertraut klingt, schau dir das Evidence-Modell an — die Doku ist auf der Page direkt verlinkt.

Evidence-Modell lesen → realsyncdynamicsai.de/evidence`,
    hashtags: ['#Developer', '#API', '#DevOps', '#Compliance'],
  },
  {
    id: 'li-013-finding-week-1',
    channel: 'linkedin',
    theme: 'real_finding',
    persona: ['kmu_geschaeftsfuehrung'],
    cta: 'free_audit',
    hook: 'Diese Woche: 27 Websites gescannt. 26 hatten mindestens 1 Tracker vor Consent.',
    body:
`Der eine, der sauber war:
Eine kleine Anwaltskanzlei. Drei Seiten. Kein Tag-Manager. Keine Embeds. Eigene Schrift, lokal gehostet.

Der „Sieger" auf der anderen Seite:
Ein mittelständischer Shop mit 41 Pre-Consent-Requests. Davon 12× Marketing-Pixel, 6× A/B-Testing, 4× Recommendation-Engines.

Die spannende Erkenntnis:
Die meisten Unternehmen unterschätzen nicht, dass sie Tracker setzen. Sie unterschätzen die Anzahl der Tracker.

Was wir machen ist nicht „beweisen, dass das schlimm ist". Was wir machen ist „sichtbar machen, was tatsächlich passiert".

Den Rest entscheiden DSB, Geschäftsführung und ggf. die Aufsichtsbehörde.

Kostenlosen Check starten → realsyncdynamicsai.de/audit`,
    hashtags: ['#Findings', '#PreConsent', '#DSGVO'],
  },
  {
    id: 'li-014-agency-multi-tenant',
    channel: 'linkedin',
    theme: 'partner_program',
    persona: ['agency_owner'],
    cta: 'partners',
    hook: 'Eine Agentur betreut 12 Kundenseiten. Jede mit eigener Compliance-Lage.',
    body:
`Das Problem ist nicht der einzelne Audit. Das Problem ist die Wiederholung.

12× anrufen. 12× erklären. 12× das gleiche Tag-Manager-Anti-Pattern. 12× verlernen.

Was Agenturen brauchen ist nicht „noch ein Compliance-Tool", sondern ein Dashboard, das 12 Tenants nebeneinander zeigt, neue Drift-Findings hochzieht und White-Label-Reports erzeugt.

Genau das ist unser Agency-Tier.

Erste Anfragen kommen rein. Wir vergeben aktiv noch 3 weitere Pilotplätze für DACH-Agenturen.

Partner-Pilot anfragen → realsyncdynamicsai.de/partners`,
    hashtags: ['#Agency', '#MultiTenant', '#Compliance'],
  },
  {
    id: 'li-015-anti-fear-positioning',
    channel: 'linkedin',
    theme: 'founder_learning',
    persona: ['founder'],
    cta: 'free_audit',
    hook: 'Wir verkaufen kein Bußgeld-Risiko. Das tun andere genug.',
    body:
`Marketing über Angst funktioniert kurzfristig. Es macht aber den Markt schlechter.

Was wir lieber tun:
· Sichtbarkeit zeigen.
· Drift zeigen.
· Den Werkzeugkasten zeigen.
· Den Preis zeigen.
· Die Grenzen zeigen.

„Wir versprechen keine 100 %-Rechtssicherheit" steht ungelogen auf unserer Pricing-Page. Weil das niemand seriös versprechen kann, der sich auskennt.

Wer trotzdem mit uns arbeitet, weiß: kein Theater, kein Hype, keine Drohkulisse. Nur ein technisches Werkzeug, das ehrlich zeigt, was passiert.

Kostenlosen Check starten → realsyncdynamicsai.de/audit`,
    hashtags: ['#FounderLearning', '#Marketing', '#Trust'],
  },
  {
    id: 'li-016-tag-manager-drift',
    channel: 'linkedin',
    theme: 'real_finding',
    persona: ['kmu_geschaeftsfuehrung', 'developer'],
    cta: 'free_audit',
    hook: 'Tag-Manager-Container sind eine der häufigsten Quellen für stille Compliance-Drift.',
    body:
`Was wir sehen:
Ein Marketing-Mitarbeiter loggt sich in den GTM ein, schaltet einen Tag „kurz für die Kampagne" scharf, vergisst ihn.

Sechs Wochen später: Pixel lädt vor Consent, alle behaupten „wir haben da nichts geändert".

Niemand lügt. Niemand erinnert sich.

Was Drift-Detection liefert:
· Diff zwischen letzter und aktueller GTM-Konfiguration
· Liste neuer Third-Party-Endpunkte
· Risiko-Klassifikation pro Tag
· Alert per E-Mail oder Webhook

Keine Magie. Nur die Disziplin, jeden Tag hinzuschauen — automatisiert.

Kostenlosen Check starten → realsyncdynamicsai.de/audit`,
    hashtags: ['#GTM', '#Compliance', '#DriftDetection'],
  },
  {
    id: 'li-017-ai-act-betreiber-pflichten',
    channel: 'linkedin',
    theme: 'ai_act',
    persona: ['compliance_lead', 'dsb_internal'],
    cta: 'free_audit',
    hook: 'Du nutzt KI nur über eine API? Du bist trotzdem „Betreiber" im Sinne des AI Act.',
    body:
`Betreiberpflichten umfassen u. a.:
· Kenntnis der Risiko-Klasse des verwendeten Systems
· Sicherstellung einer angemessenen menschlichen Aufsicht
· Dokumentation, in welchen Prozessen das System eingesetzt wird
· Information der betroffenen Personen, sofern erforderlich

Das ist nicht „mit dem Anbieter klären". Das ist Hausaufgabe des Betreibers.

Was Unternehmen typischerweise nicht haben:
· eine vollständige Liste der eingesetzten KI-Systeme
· eine technische Erfassung der Endpunkte
· einen Review-Zyklus

Das ist exakt die Lücke, die wir technisch schließen.

Kostenlosen Check starten → realsyncdynamicsai.de/audit`,
    hashtags: ['#AIAct', '#Betreiber', '#AIGovernance'],
  },
  {
    id: 'li-018-evidence-vault-positioning',
    channel: 'linkedin',
    theme: 'evidence_runtime',
    persona: ['compliance_lead', 'kanzlei'],
    cta: 'docs_evidence',
    hook: 'Evidence Vault klingt nach Buzzword. Ist aber eine bewusste Architektur-Entscheidung.',
    body:
`Was wir konkret meinen:

Jeder Audit, jedes Finding, jede Review-Entscheidung wird in einer Hash-Chain abgelegt.

Drei Eigenschaften:
1. Unveränderlich — eine spätere Manipulation eines Findings würde die Hash-Chain brechen.
2. Reproduzierbar — jeder Eintrag enthält Quelle und Zeitpunkt.
3. Exportierbar — als JSON, signiert, für DSB oder Aufsicht.

Das ist kein Hexenwerk. Es ist die saubere Mindestlatte für Compliance-Datenhaltung.

Evidence-Modell lesen → realsyncdynamicsai.de/evidence`,
    hashtags: ['#EvidenceVault', '#Compliance', '#Architecture'],
  },
  {
    id: 'li-019-data-vs-narrative',
    channel: 'linkedin',
    theme: 'founder_learning',
    persona: ['founder', 'compliance_lead'],
    cta: 'free_audit',
    hook: 'Wir glauben Compliance-Narrativen weniger als Compliance-Daten.',
    body:
`Eine Datenschutzerklärung ist ein Narrativ. Sie beschreibt, was das Unternehmen sagt, dass es tut.

Ein Browser-Trace ist Daten. Er beschreibt, was die Website tatsächlich tut.

Beides hat Wert. Aber wenn beide widersprechen, gewinnt der Browser-Trace.

Genau in dieser Lücke arbeiten wir:
Nicht das schreiben, was die DSE will. Sondern messen, was die Realität liefert. Und beides nebeneinanderstellen.

Keine Diplomatie. Keine Schönfärberei. Daten.

Kostenlosen Check starten → realsyncdynamicsai.de/audit`,
    hashtags: ['#FounderLearning', '#DataDriven', '#Compliance'],
  },
  {
    id: 'li-020-call-to-action-week',
    channel: 'linkedin',
    theme: 'real_finding',
    persona: ['kmu_geschaeftsfuehrung'],
    cta: 'free_audit',
    hook: 'Diese Woche kannst du in 30 Sekunden wissen, wie eure Website konfiguriert ist.',
    body:
`Kein Account. Kein Setup. Kein Sales-Call.

URL einfügen. Scan läuft.

Output:
· Compliance-Score 0–100
· Top-3-Risiken
· Mini-PDF-Report
· Kein Verkauf danach, wenn du das nicht willst

Wir zeigen es, weil wir wollen, dass mehr Unternehmen sehen, was wir sehen. Der Rest folgt von selbst — oder eben nicht.

Beides ist okay. Aber nicht zu schauen, ist die schlechteste Option.

Kostenlosen Check starten → realsyncdynamicsai.de/audit`,
    hashtags: ['#FreeAudit', '#DSGVO', '#Compliance'],
  },
  // ─── Serie „Art. 26 in 12 Posts“ ─────────────────────────────────────────
  // Ein Post je Prüfpunkt, gleiche Reihenfolge wie BETREIBER_PFLICHTEN in
  // src/content/aiActBetreiberpflichten.ts; CTA führt in den Selbstcheck.
  // Fristen nach VO (EU) 2026/1744 (Digital Omnibus).
  {
    id: 'li-021-art26-betriebsanleitung',
    channel: 'linkedin',
    theme: 'ai_act',
    persona: ['compliance_lead', 'kmu_geschaeftsfuehrung'],
    cta: 'betreiber_selfcheck',
    hook: 'Art. 26 AI Act in 12 Posts. Teil 1: die Betriebsanleitung.',
    body:
`Wer Hochrisiko-KI einsetzt, ist „Betreiber“ und hat ab dem 2. Dezember 2027 eigene Pflichten aus Art. 26. Der Digital Omnibus hat die Frist verschoben, nicht gestrichen.

In dieser Serie nehmen wir jede Pflicht einzeln vor. Eine pro Post, mit einer Prüffrage zum Mitnehmen.

Teil 1/12 – Abs. 1: Verwendung gemäß Betriebsanleitung.

Klingt banal. In der Praxis heißt das:
· Die Betriebsanleitung des Anbieters liegt vor, für jedes System.
· Es ist festgelegt, wofür das System eingesetzt werden darf. Und wofür nicht.
· Technische und organisatorische Maßnahmen sorgen dafür, dass es so bleibt.

Prüffrage: Könnten Sie heute für jedes KI-System im Haus die Betriebsanleitung vorlegen?

Alle 12 Prüfpunkte als Selbstcheck, fünf Minuten, läuft im Browser:

Kostenlosen Selbstcheck starten → realsyncdynamicsai.de/ai-act-betreiberpflichten/selbstcheck`,
    hashtags: ['#AIAct', '#KIVerordnung', '#AIGovernance', '#Compliance'],
  },
  {
    id: 'li-022-art26-aufsicht',
    channel: 'linkedin',
    theme: 'ai_act',
    persona: ['compliance_lead', 'dsb_internal'],
    cta: 'betreiber_selfcheck',
    hook: 'Menschliche Aufsicht heißt nicht: Irgendwer schaut mal drüber.',
    body:
`Teil 2/12 – Art. 26 Abs. 2 AI Act.

Die Aufsicht über ein Hochrisiko-System muss bei Menschen liegen, die drei Dinge mitbringen:
· Kompetenz
· Schulung
· Befugnis

Der dritte Punkt fehlt am häufigsten. Wer die KI-Empfehlung nur abnicken darf, übt keine Aufsicht aus. Aufsicht heißt: übersteuern können. Und im Zweifel stoppen.

Dazu kommt: Der Betreiber muss diese Personen unterstützen, mit Zeit, Informationen und Rückendeckung.

Prüffrage: Steht für jedes System fest, wer es beaufsichtigt, und darf diese Person „Nein“ sagen?

Kostenlosen Selbstcheck starten → realsyncdynamicsai.de/ai-act-betreiberpflichten/selbstcheck`,
    hashtags: ['#AIAct', '#HumanOversight', '#AIGovernance'],
  },
  {
    id: 'li-023-art26-eingabedaten',
    channel: 'linkedin',
    theme: 'ai_act',
    persona: ['compliance_lead', 'developer'],
    cta: 'betreiber_selfcheck',
    hook: 'Ihre KI ist nur so gut wie das, was Sie hineingeben.',
    body:
`Teil 3/12 – Art. 26 Abs. 4 AI Act.

Soweit Sie die Eingabedaten kontrollieren, müssen sie für den Zweck relevant und ausreichend repräsentativ sein.

Beispiel Personalauswahl: Sieht das Screening-Tool nur Lebensläufe aus einer Region, einer Altersgruppe oder einem Karriereweg, liegt das Problem nicht beim Anbieter. Es liegt bei den Daten, die Sie einspeisen.

Was hilft:
· Datenquellen je System dokumentieren
· regelmäßig auf Lücken und Verzerrungen prüfen
· Änderungen an den Daten nachvollziehbar halten

Prüffrage: Wer im Haus ist dafür zuständig, die Eingabedaten Ihrer KI-Systeme zu prüfen?

Kostenlosen Selbstcheck starten → realsyncdynamicsai.de/ai-act-betreiberpflichten/selbstcheck`,
    hashtags: ['#AIAct', '#DataQuality', '#AIGovernance'],
  },
  {
    id: 'li-024-art26-ueberwachung',
    channel: 'linkedin',
    theme: 'ai_act',
    persona: ['compliance_lead', 'developer'],
    cta: 'betreiber_selfcheck',
    hook: 'Die Inbetriebnahme ist nicht das Ende der Prüfung, sondern der Anfang.',
    body:
`Teil 4/12 – Art. 26 Abs. 5 AI Act.

Betreiber müssen den Betrieb ihrer Hochrisiko-Systeme anhand der Betriebsanleitung überwachen. Und den Anbieter informieren, wenn etwas auffällt.

Überwachung braucht drei Dinge:
· Kennzahlen: Woran erkennen Sie, dass das System anders arbeitet als erwartet?
· Rhythmus: Wer schaut wann hin?
· Daten: Ohne Protokolle der Modellaufrufe gibt es nichts zu überwachen.

Beim dritten Punkt setzen wir an: Ein Prüfpfad über jeden Modellaufruf ist die Grundlage, auf der Überwachung überhaupt erst möglich wird.

Prüffrage: Woran würden Sie merken, dass Ihr KI-System seit drei Wochen schlechter entscheidet?

Kostenlosen Selbstcheck starten → realsyncdynamicsai.de/ai-act-betreiberpflichten/selbstcheck`,
    hashtags: ['#AIAct', '#Monitoring', '#AIGovernance'],
  },
  {
    id: 'li-025-art26-risiko-aussetzen',
    channel: 'linkedin',
    theme: 'ai_act',
    persona: ['kmu_geschaeftsfuehrung', 'compliance_lead'],
    cta: 'betreiber_selfcheck',
    hook: 'Wer darf in Ihrem Unternehmen eine KI abschalten?',
    body:
`Teil 5/12 – Art. 26 Abs. 5 AI Act.

Gibt es Grund zur Annahme, dass ein Hochrisiko-System trotz bestimmungsgemäßer Nutzung ein Risiko für Gesundheit, Sicherheit oder Grundrechte birgt, muss der Betreiber:
1. unverzüglich Anbieter oder Händler und die Marktüberwachungsbehörde informieren
2. die Nutzung aussetzen

Organisatorisch ist der zweite Schritt die eigentliche Hürde. Ein System anzuhalten, auf dem ein Prozess läuft, entscheidet niemand spontan. Das muss vorher geklärt sein:
· Wer hat die Befugnis?
· Was ist der Ersatzprozess?
· Wer informiert wen?

Prüffrage: Gibt es für Ihre KI-Systeme eine dokumentierte Stopp-Befugnis?

Kostenlosen Selbstcheck starten → realsyncdynamicsai.de/ai-act-betreiberpflichten/selbstcheck`,
    hashtags: ['#AIAct', '#RiskManagement', '#AIGovernance'],
  },
  {
    id: 'li-026-art26-vorfaelle',
    channel: 'linkedin',
    theme: 'ai_act',
    persona: ['compliance_lead', 'dsb_internal'],
    cta: 'betreiber_selfcheck',
    hook: 'Schwerwiegender KI-Vorfall: Wen rufen Sie zuerst an?',
    body:
`Teil 6/12 – Art. 26 Abs. 5 AI Act.

Die Antwort steht im Gesetz: zuerst den Anbieter. Danach Einführer oder Händler und die zuständige Marktüberwachungsbehörde. Und zwar unverzüglich.

Wer das erst im Ernstfall nachliest, verliert Zeit.

Was in den Notfallplan gehört:
· die Meldekette mit Ansprechpartnern beim Anbieter
· die zuständige Behörde
· wer intern meldet und wer dokumentiert
· Zeitpunkte für jeden Schritt

Prüffrage: Steht die Meldekette für KI-Vorfälle schon in Ihrem Notfallhandbuch?

Kostenlosen Selbstcheck starten → realsyncdynamicsai.de/ai-act-betreiberpflichten/selbstcheck`,
    hashtags: ['#AIAct', '#IncidentResponse', '#Compliance'],
  },
  {
    id: 'li-027-art26-protokolle',
    channel: 'linkedin',
    theme: 'ai_act',
    persona: ['compliance_lead', 'developer'],
    cta: 'betreiber_selfcheck',
    hook: 'Sechs Monate: So lange müssen KI-Protokolle mindestens aufbewahrt werden.',
    body:
`Teil 7/12 – Art. 26 Abs. 6 AI Act.

Betreiber müssen automatisch erzeugte Protokolle ihrer Hochrisiko-Systeme mindestens sechs Monate aufbewahren. Jedenfalls die, die unter ihrer Kontrolle stehen.

Der Nebensatz ist die eigentliche Frage: Welche Protokolle liegen bei Ihnen, welche beim Anbieter? Viele Unternehmen wissen es nicht. Und merken es erst, wenn jemand nachfragt.

Bei uns ist das der Kern des Produkts: Jeder Modellaufruf landet im Prüfpfad und lässt sich als Nachweis exportieren.

Prüffrage: Könnten Sie heute die Protokolle eines KI-Systems von vor fünf Monaten vorlegen?

Kostenlosen Selbstcheck starten → realsyncdynamicsai.de/ai-act-betreiberpflichten/selbstcheck`,
    hashtags: ['#AIAct', '#Logging', '#EvidenceVault'],
  },
  {
    id: 'li-028-art26-arbeitsplatz',
    channel: 'linkedin',
    theme: 'ai_act',
    persona: ['kmu_geschaeftsfuehrung', 'dsb_internal'],
    cta: 'betreiber_selfcheck',
    hook: 'KI am Arbeitsplatz? Erst der Betriebsrat, dann der Go-live.',
    body:
`Teil 8/12 – Art. 26 Abs. 7 AI Act.

Bevor ein Hochrisiko-System am Arbeitsplatz in Betrieb geht, müssen Arbeitnehmervertretung und betroffene Beschäftigte informiert werden.

Hochrisiko am Arbeitsplatz ist häufiger als gedacht. Anhang III nennt ausdrücklich KI für:
· Stellenausschreibungen und Bewerberauswahl
· Entscheidungen über Beförderung und Kündigung
· Aufgabenzuweisung nach Verhalten oder persönlichen Merkmalen
· Leistungs- und Verhaltensüberwachung

In Deutschland kommen die Mitbestimmungsrechte nach dem Betriebsverfassungsgesetz dazu.

Prüffrage: Ist die Information des Betriebsrats ein fester Schritt in Ihrem KI-Einführungsprozess?

Kostenlosen Selbstcheck starten → realsyncdynamicsai.de/ai-act-betreiberpflichten/selbstcheck`,
    hashtags: ['#AIAct', '#HRTech', '#Betriebsrat'],
  },
  {
    id: 'li-029-art26-registrierung',
    channel: 'linkedin',
    theme: 'ai_act',
    persona: ['compliance_lead'],
    cta: 'betreiber_selfcheck',
    hook: 'Für Behörden gilt: ohne Registrierung kein Einsatz.',
    body:
`Teil 9/12 – Art. 26 Abs. 8 AI Act.

Öffentliche Stellen, die Hochrisiko-KI einsetzen, haben eine doppelte Registrierungspflicht (Art. 49 Abs. 3):
· Der Anbieter muss das System in der EU-Datenbank registriert haben.
· Die Behörde registriert sich selbst und trägt ihre Nutzung des Systems ein. Vor dem Einsatz.

Ist das System nicht registriert, darf die Behörde es nicht verwenden. Sie muss dann den Anbieter oder Händler informieren.

Für Kommunen, Landes- und Bundesbehörden heißt das konkret:
· Registrierungsstatus des Systems vor jeder Beschaffung prüfen
· eigene Registrierung und Nutzung vor dem Go-live eintragen
· Bestandssysteme bis zum Stichtag nachziehen

Dazu kommt für öffentliche Stellen eine Grundrechte-Folgenabschätzung nach Art. 27.

Prüffrage: Ist geklärt, wer in Ihrer Behörde die Registrierung der eigenen KI-Nutzung übernimmt?

Kostenlosen Selbstcheck starten → realsyncdynamicsai.de/ai-act-betreiberpflichten/selbstcheck`,
    hashtags: ['#AIAct', '#PublicSector', '#Vergabe'],
  },
  {
    id: 'li-030-art26-dsfa',
    channel: 'linkedin',
    theme: 'ai_act',
    persona: ['dsb_internal', 'dsb_external'],
    cta: 'betreiber_selfcheck',
    hook: 'AI Act und DSGVO arbeiten zusammen. Art. 26 Abs. 9 zeigt, wie.',
    body:
`Teil 10/12 – Art. 26 Abs. 9 AI Act.

Der Anbieter eines Hochrisiko-Systems muss Ihnen Informationen liefern: Zweck, Leistungsgrenzen, Risiken, Anforderungen an die Eingabedaten (Art. 13).

Art. 26 Abs. 9 sagt: Nutzen Sie genau diese Informationen für Ihre Datenschutz-Folgenabschätzung nach Art. 35 DSGVO, soweit eine DSFA erforderlich ist.

Das ist eine gute Nachricht. Wer die Anbieterunterlagen sauber ablegt, hat einen großen Teil der DSFA-Grundlagen schon.

Der häufige Fehler: DSFA und KI-Dokumentation liegen in zwei Abteilungen, die nicht miteinander reden.

Prüffrage: Liegt die Anbieterdokumentation Ihrer KI-Systeme bei der DSFA oder in einem anderen Ordner?

Kostenlosen Selbstcheck starten → realsyncdynamicsai.de/ai-act-betreiberpflichten/selbstcheck`,
    hashtags: ['#AIAct', '#DSGVO', '#DSFA'],
  },
  {
    id: 'li-031-art26-betroffene',
    channel: 'linkedin',
    theme: 'ai_act',
    persona: ['kmu_geschaeftsfuehrung', 'dsb_internal'],
    cta: 'betreiber_selfcheck',
    hook: 'Wussten Sie, dass Sie Bewerbende informieren müssen, wenn KI mitentscheidet?',
    body:
`Teil 11/12 – Art. 26 Abs. 11 AI Act.

Wer ein Hochrisiko-System nach Anhang III einsetzt, um über Menschen zu entscheiden oder dabei zu unterstützen, muss diese Menschen darüber informieren.

Das betrifft zum Beispiel:
· Bewerbende, deren Unterlagen eine KI vorsortiert
· Kundinnen und Kunden, deren Kreditwürdigkeit eine KI bewertet
· Prüflinge, deren Leistungen eine KI beurteilt

Dazu kommt Art. 86: Betroffene können eine Erläuterung verlangen, welche Rolle die KI bei einer Entscheidung gespielt hat, die sie erheblich beeinträchtigt.

Diese Pflicht fehlt in vielen Zusammenfassungen. Im Bewerbungsportal sollte sie nicht fehlen.

Prüffrage: Steht in Ihrem Bewerbungsprozess, dass eine KI beteiligt ist?

Kostenlosen Selbstcheck starten → realsyncdynamicsai.de/ai-act-betreiberpflichten/selbstcheck`,
    hashtags: ['#AIAct', '#Recruiting', '#Transparenz'],
  },
  {
    id: 'li-032-art25-rollenwechsel',
    channel: 'linkedin',
    theme: 'ai_act',
    persona: ['founder', 'compliance_lead', 'developer'],
    cta: 'betreiber_selfcheck',
    hook: 'Vom Betreiber zum Anbieter, ohne es zu merken.',
    body:
`Teil 12/12 – Art. 25 AI Act.

Zum Schluss die Pflicht, die nicht in Art. 26 steht, aber alles verändert.

Sie werden selbst zum Anbieter eines Hochrisiko-Systems, wenn Sie:
1. es unter Ihrem Namen oder Ihrer Marke in Verkehr bringen oder in Betrieb nehmen
2. es wesentlich verändern
3. ein anderes KI-System so umwidmen, dass es hochriskant wird. Zum Beispiel einen allgemeinen Chatbot, der plötzlich Bewerbungen vorsortiert.

Dann gelten zusätzlich die Anbieterpflichten nach Art. 16: Risikomanagement, technische Dokumentation, Konformitätsbewertung, CE-Kennzeichnung.

Das passiert selten mit Absicht. Meist ist es ein Projekt, das „nur kurz“ erweitert wurde.

Prüffrage: Hat jemand dokumentiert, warum Sie bei jedem Ihrer KI-Systeme Betreiber bleiben?

Damit ist die Serie komplett. Alle 12 Prüfpunkte als Selbstcheck:

Kostenlosen Selbstcheck starten → realsyncdynamicsai.de/ai-act-betreiberpflichten/selbstcheck`,
    hashtags: ['#AIAct', '#KIVerordnung', '#AIGovernance', '#Compliance'],
  },
];
