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
    hashtags: ['#PreConsent', '#TTDSG', '#DSGVO', '#Compliance'],
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
];
