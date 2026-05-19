/**
 * YouTube-Shorts-Skripte fuer die Kampagne "Was Ihre Website wirklich tut".
 *
 * Format: 30–60 Sekunden vertikal. Drei Beats pro Short:
 *   HOOK   (0–3 s)   — Behauptung oder Frage
 *   PROOF  (4–45 s)  — sichtbarer Beweis am Screen (echter Scan, echtes Finding)
 *   OUTRO  (46–60 s) — was tun + CTA
 *
 * Regeln:
 *   - Echter Scan, echtes Finding. Keine Stock-Footage.
 *   - Captions vorbereitet (Default-Mute auf Mobile)
 *   - CTA: „Kostenlosen Check starten" + URL im Pin-Comment + Bio-Link
 *   - Kein Bußgeld-Wording, kein „rechtssicher"
 */

import type { ContentAsset } from '../types';

export interface YoutubeShort extends ContentAsset {
  channel: 'youtube_shorts';
  title: string;
  /** 30..60 — wir produzieren ueberwiegend 45 s. */
  targetDurationSeconds: number;
  hook: string;
  /** Geordnete Beats; jede Zeile ist eine Caption-Zeile. */
  proof: string[];
  outro: string;
  /** Konkreter Screen-Treatment-Hinweis fuer Editor. */
  screenAction: string;
}

export const YOUTUBE_SHORTS: YoutubeShort[] = [
  {
    id: 'yt-001-30sec-scan',
    channel: 'youtube_shorts',
    theme: 'real_finding',
    persona: ['kmu_geschaeftsfuehrung'],
    cta: 'free_audit',
    title: 'Website in 30 Sekunden geprüft',
    targetDurationSeconds: 40,
    hook: 'Was lädt deine Website, bevor jemand „Akzeptieren" klickt?',
    proof: [
      'Wir scannen eine Beispiel-Website.',
      'Result: 14 Requests vor Consent.',
      'Davon: 4 Google-Domains, 2 Meta, 1 LinkedIn, 7 Drittanbieter.',
      'Niemand hat das so geplant — aber so sieht die Realität aus.',
    ],
    outro:
      'Wenn du wissen willst, was deine Website tut: realsyncdynamicsai.de/audit. Free, ohne Account.',
    screenAction:
      'Browser links, Terminal mit RealSync-CLI rechts. Pre-Consent-Requests als Liste, Domains farblich nach Kategorie. Counter „14" gross am Ende.',
  },
  {
    id: 'yt-002-cookie-banner-dark-pattern',
    channel: 'youtube_shorts',
    theme: 'consent_timing',
    persona: ['kmu_geschaeftsfuehrung'],
    cta: 'free_audit',
    title: 'Der Reject-Button, der nicht da ist',
    targetDurationSeconds: 35,
    hook: 'Ein Cookie-Banner ohne sichtbaren Reject-Button.',
    proof: [
      'Akzeptieren — gross, grün, oben.',
      'Einstellungen — klein, grau, am Rand.',
      'Ablehnen — gar nicht. Verborgen in „Einstellungen".',
      'Wir behaupten nicht, dass das illegal ist. Wir zeigen nur, was technisch passiert.',
    ],
    outro:
      'Sichtbarkeit zuerst. Bewertung danach. realsyncdynamicsai.de/audit.',
    screenAction:
      'Banner-Screenshot mit Heatmap-Overlay: Accept-Button knallrot markiert, Reject-Button als zwei verschachtelte Menüs animiert hervorgehoben.',
  },
  {
    id: 'yt-003-drift-after-update',
    channel: 'youtube_shorts',
    theme: 'evidence_runtime',
    persona: ['agency_owner', 'developer'],
    cta: 'free_audit',
    title: 'Was nach einem Plugin-Update wirklich passiert',
    targetDurationSeconds: 45,
    hook: 'Du updatest ein Plugin. Drei Tage später läuft ein neuer Tracker.',
    proof: [
      'Tag 0: 12 Drittanbieter-Requests.',
      'Tag 3: 17 Drittanbieter-Requests.',
      'Differenz: 5 neue Endpoints, davon 2 mit Browser-Storage.',
      'Niemand hat das angeordnet — Plugin-Default-Konfiguration.',
    ],
    outro:
      'Drift-Detection ist keine Premium-Funktion. Es ist die einzige Form, in der Compliance ehrlich bleibt. realsyncdynamicsai.de/audit.',
    screenAction:
      'Diff-View zwischen Tag 0 und Tag 3, neue Zeilen grün, entfernte rot. Hash der Konfigurationen am unteren Rand.',
  },
  {
    id: 'yt-004-ai-act-betreiber',
    channel: 'youtube_shorts',
    theme: 'ai_act',
    persona: ['compliance_lead'],
    cta: 'free_audit',
    title: 'Du nutzt nur eine KI-API. Du bist trotzdem Betreiber.',
    targetDurationSeconds: 35,
    hook: '„Wir nutzen nur ChatGPT über die API." → Du bist Betreiber.',
    proof: [
      'Betreiber-Pflichten: Risiko-Klasse kennen.',
      'Menschliche Aufsicht sicherstellen.',
      'Einsatz dokumentieren.',
      'Betroffene Personen informieren, sofern erforderlich.',
    ],
    outro:
      'Was du brauchst, ist nicht „mehr Sorge". Was du brauchst, ist ein Inventar. realsyncdynamicsai.de/audit.',
    screenAction:
      'Vier Pflicht-Kacheln als Karussell, jede mit kurzem Bullet. Im Hintergrund Brand-Mark, monospaced Captions.',
  },
  {
    id: 'yt-005-evidence-vs-pdf',
    channel: 'youtube_shorts',
    theme: 'evidence_runtime',
    persona: ['compliance_lead', 'kanzlei'],
    cta: 'docs_evidence',
    title: 'PDF ist kein Nachweis. Es ist die Behauptung über einen Nachweis.',
    targetDurationSeconds: 45,
    hook: 'Bei einer Aufsichts-Anfrage zählen drei Dinge.',
    proof: [
      'Was war konfiguriert? — PDF kann das.',
      'Wer hat das gesehen? — PDF kann das nicht.',
      'Ist das manipulationssicher? — PDF kann das nicht.',
      'Eine Hash-Chain kann alle drei.',
    ],
    outro:
      'Evidence-Modell offen: realsyncdynamicsai.de/evidence.',
    screenAction:
      'PDF-Icon links, JSON+Hash-Chain rechts, Pfeil-Mapping welcher Output welche Frage beantwortet.',
  },
  {
    id: 'yt-006-agency-multi-tenant',
    channel: 'youtube_shorts',
    theme: 'partner_program',
    persona: ['agency_owner'],
    cta: 'partners',
    title: 'Agentur mit 12 Kundenseiten — und 12 separaten Compliance-Lagen',
    targetDurationSeconds: 40,
    hook: 'Eine Agentur. Zwölf Kundenseiten. Zwölf Compliance-Lagen.',
    proof: [
      'Jede mit eigenem Pre-Consent-Profil.',
      'Jede mit eigenem Plugin-Stack.',
      'Jede mit eigener Marketing-Tag-Pipeline.',
      'Manuelles Tracking = nicht skalierbar.',
    ],
    outro:
      'Multi-Tenant-Dashboard, White-Label, ein Reseller-Tier. realsyncdynamicsai.de/partners.',
    screenAction:
      'Grid mit 12 Mini-Dashboards, je ein Score-Score 0–100, Drift-Alert auf zwei davon rot pulsierend.',
  },
  {
    id: 'yt-007-real-finding-week',
    channel: 'youtube_shorts',
    theme: 'real_finding',
    persona: ['kmu_geschaeftsfuehrung'],
    cta: 'free_audit',
    title: 'Diese Woche: 27 Websites, 26 mit Tracker vor Consent',
    targetDurationSeconds: 30,
    hook: 'Diese Woche: 27 Websites gescannt.',
    proof: [
      '26 hatten mindestens 1 Tracker vor Consent.',
      '1 war sauber — eine kleine Kanzlei, eigene Schrift, kein GTM.',
      'Spitzenreiter: 41 Pre-Consent-Requests.',
      'Das ist kein Einzelfall. Das ist die Verteilung.',
    ],
    outro:
      'Schau dir an, wo deine Seite in der Verteilung liegt. realsyncdynamicsai.de/audit.',
    screenAction:
      'Histogramm 0–50 Pre-Consent-Requests, Spitze um 12, eigene Seite einblendbar.',
  },
  {
    id: 'yt-008-founder-anti-fear',
    channel: 'youtube_shorts',
    theme: 'founder_learning',
    persona: ['founder'],
    cta: 'free_audit',
    title: 'Wir verkaufen kein Bußgeld-Risiko',
    targetDurationSeconds: 30,
    hook: 'Wir verkaufen kein Bußgeld-Risiko. Das machen andere genug.',
    proof: [
      'Wir verkaufen Sichtbarkeit.',
      'Wir verkaufen Drift-Erkennung.',
      'Wir verkaufen Evidence.',
      'Den Rest entscheiden DSB, Geschäftsführung, ggf. Gericht.',
    ],
    outro:
      'realsyncdynamicsai.de/audit — schauen, was passiert. Mehr nicht.',
    screenAction:
      'Founder-Face-Cam, Captions im Industrial-Style, Brand-Mark als Watermark unten links.',
  },
  {
    id: 'yt-009-tag-manager-drift',
    channel: 'youtube_shorts',
    theme: 'real_finding',
    persona: ['developer'],
    cta: 'free_audit',
    title: 'GTM-Container: die häufigste Quelle stiller Drift',
    targetDurationSeconds: 40,
    hook: 'Wo Drift wirklich passiert? GTM-Container.',
    proof: [
      'Marketing schaltet einen Tag „kurz" frei.',
      'Sechs Wochen später: noch aktiv.',
      'Drift-Diff zeigt: neuer Pixel, neue Datenverbindung.',
      'Niemand lügt. Niemand erinnert sich.',
    ],
    outro:
      'Automatisierte Drift-Detection statt manuellem Audit. realsyncdynamicsai.de/audit.',
    screenAction:
      'GTM-UI links, Drift-Patch im Git-Diff-Style rechts, Highlight auf den neuen Pixel.',
  },
  {
    id: 'yt-010-call-to-action',
    channel: 'youtube_shorts',
    theme: 'real_finding',
    persona: ['kmu_geschaeftsfuehrung'],
    cta: 'free_audit',
    title: 'In 30 Sekunden weißt du, wie eure Website konfiguriert ist.',
    targetDurationSeconds: 30,
    hook: 'Kein Account. Kein Setup. Kein Sales-Call.',
    proof: [
      'URL einfügen.',
      'Scan startet.',
      'Score 0–100 und Top-3-Risiken.',
      'Mini-PDF als Bonus.',
    ],
    outro:
      'Nicht zu schauen ist die schlechteste Option. realsyncdynamicsai.de/audit.',
    screenAction:
      'Input-Feld mit Realdomain, Scan-Animation, Score-Anzeige am Ende mit Industrial-Border.',
  },
];
