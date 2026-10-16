/**
 * Betreiberpflichten nach Art. 26 KI-VO — eine Quelle für die Fachseite
 * (/ai-act-betreiberpflichten), den Selbstcheck (…/selbstcheck) und das
 * FAQPage-JSON-LD in src/config/seo.ts. Google verlangt, dass Schema-Inhalte
 * sichtbar auf der Seite stehen; deshalb lesen Seite und Schema dieselben
 * Einträge.
 *
 * Rechtsstand: VO (EU) 2024/1689 in der Fassung der VO (EU) 2026/1744
 * (Digital Omnibus, in Kraft seit 27.07.2026). Die LinkedIn-Serie
 * li-021 … li-032 (src/marketing/content/linkedin-posts.ts) folgt denselben
 * 12 Prüfpunkten in derselben Reihenfolge — bei Rechtsänderung beides
 * nachziehen.
 */

export const RECHTSSTAND = 'Oktober 2026';

export const SELBSTCHECK_PATH = '/ai-act-betreiberpflichten/selbstcheck';

export interface BetreiberPflicht {
  id: string;
  /** Fundstelle, z. B. „Art. 26 Abs. 1“. */
  norm: string;
  titel: string;
  /** Was die Norm verlangt — sachlich, ohne Produktbezug. */
  pflicht: string;
  /** Ja/Nein-Prüffrage für den Selbstcheck. */
  frage: string;
  /** Nächster Schritt, wenn die Prüffrage nicht mit „Ja“ beantwortet wird. */
  massnahme: string;
  /** Anknüpfungspunkt in der Plattform — nur wo es ihn gibt. */
  realsync?: string;
  /** Gilt nur für öffentliche Stellen; im Selbstcheck oft „trifft nicht zu“. */
  nurOeffentlich?: boolean;
}

export const BETREIBER_PFLICHTEN: BetreiberPflicht[] = [
  {
    id: 'betriebsanleitung',
    norm: 'Art. 26 Abs. 1',
    titel: 'Verwendung gemäß Betriebsanleitung',
    pflicht:
      'Das System wird so eingesetzt, wie es die Betriebsanleitung des Anbieters vorsieht. Dafür trifft der Betreiber geeignete technische und organisatorische Maßnahmen.',
    frage:
      'Liegt für jedes eingesetzte Hochrisiko-KI-System die Betriebsanleitung des Anbieters vor, und haben Sie Maßnahmen festgelegt, die den bestimmungsgemäßen Einsatz sicherstellen?',
    massnahme:
      'Betriebsanleitungen beim Anbieter anfordern, je System ablegen und die zulässigen Einsatzzwecke intern verbindlich festschreiben.',
    realsync: 'KI-Inventar: System, Anbieter, Zweckbestimmung und Unterlagen an einer Stelle.',
  },
  {
    id: 'aufsicht',
    norm: 'Art. 26 Abs. 2',
    titel: 'Menschliche Aufsicht mit Befugnis',
    pflicht:
      'Die menschliche Aufsicht liegt bei natürlichen Personen mit der nötigen Kompetenz, Schulung und Befugnis. Der Betreiber gibt ihnen die erforderliche Unterstützung.',
    frage:
      'Ist für jedes System festgelegt, wer die Aufsicht führt, und darf diese Person Ergebnisse übersteuern oder den Einsatz stoppen?',
    massnahme:
      'Aufsichtspersonen je System benennen, ihre Befugnisse (übersteuern, stoppen) schriftlich festlegen und die Schulung nachweisen.',
    realsync: 'Freigaben und Rollen: Wer entschieden hat, steht je Vorgang im Prüfpfad.',
  },
  {
    id: 'eingabedaten',
    norm: 'Art. 26 Abs. 4',
    titel: 'Relevante und repräsentative Eingabedaten',
    pflicht:
      'Soweit der Betreiber die Eingabedaten kontrolliert, sorgt er dafür, dass sie für den Zweck relevant und ausreichend repräsentativ sind.',
    frage:
      'Prüfen Sie die Daten, die Sie in das System geben, regelmäßig auf Relevanz und Repräsentativität für den Einsatzzweck?',
    massnahme:
      'Datenquellen je System dokumentieren und eine regelmäßige Prüfung auf Lücken und Verzerrungen festlegen.',
  },
  {
    id: 'ueberwachung',
    norm: 'Art. 26 Abs. 5',
    titel: 'Laufende Überwachung im Betrieb',
    pflicht:
      'Der Betreiber überwacht den Betrieb anhand der Betriebsanleitung und informiert bei Bedarf den Anbieter, damit dieser seiner Beobachtungspflicht nach Art. 72 nachkommen kann.',
    frage:
      'Gibt es für jedes System eine festgelegte Routine, mit der Sie den laufenden Betrieb überwachen und Auffälligkeiten an den Anbieter melden?',
    massnahme: 'Kennzahlen, Prüfrhythmus und Meldeweg zum Anbieter je System festlegen.',
    realsync: 'Prüfpfad über jeden Modellaufruf als Datengrundlage der Überwachung.',
  },
  {
    id: 'risiko-aussetzen',
    norm: 'Art. 26 Abs. 5',
    titel: 'Bei Risiko: melden und aussetzen',
    pflicht:
      'Gibt es Grund zur Annahme, dass der bestimmungsgemäße Einsatz ein Risiko im Sinne von Art. 79 Abs. 1 birgt, informiert der Betreiber unverzüglich Anbieter oder Händler und die Marktüberwachungsbehörde und setzt die Nutzung aus.',
    frage:
      'Ist geregelt, wer die Nutzung eines Systems bei einem erkannten Risiko sofort aussetzen darf und wer Anbieter und Behörde informiert?',
    massnahme:
      'Eine Stopp-Befugnis, einen Ersatzprozess und den Meldeweg einschließlich der zuständigen Marktüberwachungsbehörde festlegen.',
  },
  {
    id: 'vorfaelle',
    norm: 'Art. 26 Abs. 5',
    titel: 'Schwerwiegende Vorfälle melden',
    pflicht:
      'Erkennt der Betreiber einen schwerwiegenden Vorfall, informiert er unverzüglich zuerst den Anbieter und danach Einführer oder Händler sowie die zuständige Marktüberwachungsbehörde.',
    frage:
      'Ist die Meldekette für schwerwiegende Vorfälle (zuerst Anbieter, dann Einführer oder Händler und Behörde) dokumentiert und den Verantwortlichen bekannt?',
    massnahme: 'Meldekette mit Kontakten in den Notfallplan aufnehmen und einmal durchspielen.',
    realsync: 'Vorfallverwaltung: Meldeschritte mit Zeitpunkt erfassen und nachweisen.',
  },
  {
    id: 'protokolle',
    norm: 'Art. 26 Abs. 6',
    titel: 'Protokolle mindestens sechs Monate aufbewahren',
    pflicht:
      'Automatisch erzeugte Protokolle, die unter der Kontrolle des Betreibers stehen, werden mindestens sechs Monate aufbewahrt, sofern anderes Recht nichts anderes vorsieht.',
    frage:
      'Werden die Protokolle Ihrer Hochrisiko-Systeme, soweit Sie sie kontrollieren, nachweislich mindestens sechs Monate aufbewahrt?',
    massnahme:
      'Klären, welche Protokolle beim Anbieter und welche bei Ihnen liegen, und eine Aufbewahrungsfrist von mindestens sechs Monaten festlegen.',
    realsync: 'Prüfpfad und Evidence Vault: Modellaufrufe protokolliert und als Nachweis exportierbar.',
  },
  {
    id: 'arbeitsplatz',
    norm: 'Art. 26 Abs. 7',
    titel: 'Beschäftigte und Arbeitnehmervertretung informieren',
    pflicht:
      'Bevor ein Hochrisiko-System am Arbeitsplatz in Betrieb geht, informieren Arbeitgeber die Arbeitnehmervertretung und die betroffenen Beschäftigten.',
    frage:
      'Werden Betriebsrat und betroffene Beschäftigte vor dem Einsatz eines Hochrisiko-Systems am Arbeitsplatz informiert?',
    massnahme:
      'Die Information vor Inbetriebnahme fest in den Einführungsprozess aufnehmen und in Deutschland zusätzlich die Mitbestimmungsrechte nach dem BetrVG prüfen.',
  },
  {
    id: 'registrierung',
    norm: 'Art. 26 Abs. 8',
    titel: 'Registrierung (öffentliche Stellen)',
    pflicht:
      'Behörden und Einrichtungen der Union, die als Betreiber auftreten, erfüllen die Registrierungspflichten nach Art. 49. Ist das System nicht in der EU-Datenbank registriert, setzen sie es nicht ein und informieren Anbieter oder Händler.',
    frage:
      'Nur für öffentliche Stellen: Ist jedes eingesetzte Hochrisiko-System vor der Nutzung in der EU-Datenbank registriert?',
    massnahme:
      'Registrierungsstatus je System prüfen, in Vergabeunterlagen festschreiben und Systeme ohne Eintrag bis zur Klärung nicht einsetzen.',
    nurOeffentlich: true,
  },
  {
    id: 'dsfa',
    norm: 'Art. 26 Abs. 9',
    titel: 'Datenschutz-Folgenabschätzung mit Anbieterinformationen',
    pflicht:
      'Betreiber nutzen die Informationen des Anbieters nach Art. 13, um ihre Pflicht zur Datenschutz-Folgenabschätzung nach Art. 35 DSGVO zu erfüllen, soweit eine solche erforderlich ist.',
    frage:
      'Haben Sie geprüft, ob eine DSFA erforderlich ist, und fließen die Anbieterinformationen nach Art. 13 KI-VO in diese DSFA ein?',
    massnahme:
      'DSFA-Pflicht je System prüfen und die Anbieterdokumentation als Grundlage in die DSFA aufnehmen.',
    realsync: 'DSFA-Bereich in der Plattform.',
  },
  {
    id: 'betroffene',
    norm: 'Art. 26 Abs. 11',
    titel: 'Betroffene Personen informieren',
    pflicht:
      'Wer ein Hochrisiko-System nach Anhang III einsetzt, um Entscheidungen über natürliche Personen zu treffen oder dabei zu unterstützen, informiert diese Personen darüber. Zusätzlich gilt das Recht auf Erläuterung nach Art. 86.',
    frage:
      'Werden Personen, über die ein Hochrisiko-System mitentscheidet (z. B. Bewerbende oder Kreditantragstellende), über diesen Einsatz informiert?',
    massnahme:
      'Informationstexte für jede betroffene Gruppe erstellen und dort einbinden, wo die Menschen mit Ihnen in Kontakt sind: Bewerbungsportal, Antrag, Bescheid.',
  },
  {
    id: 'rollencheck',
    norm: 'Art. 25 Abs. 1',
    titel: 'Rollencheck: Bleiben Sie Betreiber?',
    pflicht:
      'Zum Anbieter wird, wer ein Hochrisiko-System unter eigenem Namen oder eigener Marke in Verkehr bringt oder in Betrieb nimmt, es wesentlich verändert oder ein anderes KI-System so umwidmet, dass es hochriskant wird. Dann gelten zusätzlich die Anbieterpflichten nach Art. 16.',
    frage:
      'Haben Sie für jedes System geprüft und dokumentiert, dass Sie es weder unter eigener Marke anbieten noch wesentlich verändert oder für einen hochriskanten Zweck umgewidmet haben?',
    massnahme:
      'Für jedes System festhalten, warum Sie Betreiber bleiben. Bei Feinabstimmung, eigenem Branding oder neuem Einsatzzweck die Rolle rechtlich prüfen lassen.',
    realsync: 'KI-Inventar und AI-Act-Klassifikator: Einsatzzweck und Risikoklasse je System dokumentieren.',
  },
];

export interface FaqEintrag {
  q: string;
  a: string;
}

export const BETREIBER_FAQ: FaqEintrag[] = [
  {
    q: 'Ab wann gelten die Betreiberpflichten nach Art. 26?',
    a: 'Für Hochrisiko-Systeme nach Anhang III, etwa in Personalauswahl, Bildung oder Kreditwürdigkeitsprüfung, ab dem 2. Dezember 2027. Für KI in regulierten Produkten nach Anhang I ab dem 2. August 2028. Die ursprünglichen Termine im August 2026 und 2027 hat der Digital Omnibus, Verordnung (EU) 2026/1744, verschoben. Bereits heute gelten die Pflicht zur Förderung der KI-Kompetenz (Art. 4) und die meisten Transparenzpflichten (Art. 50).',
  },
  {
    q: 'Bin ich Betreiber, wenn ich KI nur über eine API oder als SaaS nutze?',
    a: 'Ja. Betreiber ist nach Art. 3 Nr. 4, wer ein KI-System in eigener Verantwortung verwendet, ausgenommen die rein persönliche, nicht berufliche Nutzung. Ob Sie das System selbst betreiben oder einkaufen, spielt keine Rolle. Die Pflichten aus Art. 26 gelten allerdings nur für Hochrisiko-Systeme.',
  },
  {
    q: 'Wann werde ich vom Betreiber zum Anbieter?',
    a: 'Nach Art. 25 Abs. 1 in drei Fällen: wenn Sie ein Hochrisiko-System unter eigenem Namen oder eigener Marke in Verkehr bringen oder in Betrieb nehmen, wenn Sie es wesentlich verändern oder wenn Sie ein anderes KI-System, auch ein KI-Modell mit allgemeinem Verwendungszweck, so umwidmen, dass es hochriskant wird. Dann gelten zusätzlich die Anbieterpflichten nach Art. 16.',
  },
  {
    q: 'Brauche ich zusätzlich eine Grundrechte-Folgenabschätzung?',
    a: 'Nach Art. 27 dann, wenn Sie eine Einrichtung des öffentlichen Rechts sind, als private Einrichtung öffentliche Dienste erbringen oder Hochrisiko-Systeme zur Kreditwürdigkeitsprüfung oder zur Risikobewertung und Preisbildung bei Lebens- und Krankenversicherungen einsetzen. Sie ergänzt eine Datenschutz-Folgenabschätzung, ersetzt sie aber nicht.',
  },
  {
    q: 'Was gilt für Banken und Versicherungen?',
    a: 'Finanzinstitute, die bereits Governance-Anforderungen aus dem Finanzaufsichtsrecht unterliegen, erfüllen die Überwachungspflicht nach Art. 26 Abs. 5, indem sie diese internen Regeln einhalten. Ihre Protokolle führen sie als Teil der aufsichtsrechtlichen Dokumentation (Abs. 6).',
  },
  {
    q: 'Welche Bußgelder sieht der AI Act für Betreiber vor?',
    a: 'Verstöße gegen Betreiberpflichten können nach Art. 99 Abs. 4 mit bis zu 15 Mio. € oder 3 % des weltweiten Jahresumsatzes geahndet werden, je nachdem, welcher Betrag höher ist. Für KMU gilt nach Art. 99 Abs. 6 der jeweils niedrigere Betrag.',
  },
];
