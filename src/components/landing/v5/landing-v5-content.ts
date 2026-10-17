/**
 * Landing v5 — Texte (DE + EN).
 *
 * Regeln: nur Live-Funktionen (src/product/implementation-status.ts) als
 * verfügbar beschreiben, alles andere als „Bald verfügbar“/Preview.
 * Keine erfundenen Kennzahlen, SLAs oder Zertifikate. TDDDG statt TTDSG.
 * H1 und Primär-CTA kommen unverändert aus i18n (`v4Hero*`).
 */
import type { Lang } from '../../../i18n/handoff';

type Copy = {
  lede: string;
  note: string;
  scanPlaceholder: string;
  scanLabel: string;
  scanButton: string;
  enterprise: string;
  loopKicker: string;
  loopTitleA: string;
  loopTitleEm: string;
  loopIntro: string;
  loop: ReadonlyArray<readonly [kicker: string, title: string, text: string, benefit: string]>;
  rmKicker: string;
  rmTitleA: string;
  rmTitleEm: string;
  rmIntro: string;
  rmLive: string;
  rmPreview: string;
  rmNext: string;
  rmMore: string;
};

export const V5_COPY: Record<Lang, Copy> = {
  de: {
    lede:
      'Geben Sie Ihre Website-Adresse ein. Wir zeigen Ihnen, welche Cookies, Tracker und KI-Dienste dort laufen, ' +
      'welche Datenschutzrisiken daraus entstehen und was Sie konkret ändern sollten — verständlich erklärt und kostenlos.',
    note: 'Kostenlos · ohne Konto · keine Kreditkarte erforderlich',
    scanPlaceholder: 'ihre-website.de',
    scanLabel: 'Website-Adresse für den kostenlosen Check',
    scanButton: 'Website prüfen',
    enterprise: 'Enterprise anfragen',
    loopKicker: 'So funktioniert es',
    loopTitleA: 'Vier Schritte,',
    loopTitleEm: 'klar erklärt.',
    loopIntro:
      'Von der ersten Prüfung bis zum vorlegbaren Nachweis: Sie sehen jederzeit, wo Sie stehen und was als Nächstes zu tun ist.',
    loop: [
      [
        '01 · PRÜFEN',
        'Website scannen',
        'Wir rufen Ihre Website auf und erfassen, welche Cookies gesetzt, welche Tracker geladen und welche KI-Dienste eingebunden werden.',
        'Sie wissen, was auf Ihrer Seite tatsächlich passiert — nicht nur, was in der Datenschutzerklärung steht.',
      ],
      [
        '02 · VERSTEHEN',
        'Risiken einordnen',
        'Jeder Befund wird der passenden Regel zugeordnet (DSGVO, TDDDG, EU AI Act) und nach Dringlichkeit sortiert.',
        'Sie erkennen sofort, was wichtig ist und warum — ohne juristisches Vorwissen.',
      ],
      [
        '03 · HANDELN',
        'Gezielt beheben',
        'Zu jedem Befund erhalten Sie einen konkreten Hinweis, was zu ändern ist, zum Beispiel eine fehlende Einwilligung vor dem Laden eines Trackers.',
        'Sie oder Ihre Agentur können direkt loslegen, statt erst lange zu recherchieren.',
      ],
      [
        '04 · NACHWEISEN',
        'Sauber dokumentieren',
        'Prüfungen und Maßnahmen werden mit Datum festgehalten und lassen sich als Nachweis exportieren.',
        'Bei Rückfragen von Kunden, Datenschutzbeauftragten oder Prüfern haben Sie die Unterlagen griffbereit.',
      ],
    ],
    rmKicker: 'Roadmap · ehrlicher Stand',
    rmTitleA: 'Was heute verfügbar ist —',
    rmTitleEm: 'und was als Nächstes kommt.',
    rmIntro:
      '„Live“ können Sie heute nutzen. „Preview“ ist bereits testbar, kann sich aber noch ändern. „Bald verfügbar“ ist geplant und noch nicht nutzbar.',
    rmLive: 'Live',
    rmPreview: 'Preview',
    rmNext: 'Bald verfügbar',
    rmMore: 'Vollständige Roadmap ansehen →',
  },
  en: {
    lede:
      'Enter your website address. We show you which cookies, trackers and AI services run on it, ' +
      'which privacy risks they create and what you should change — explained in plain language, free of charge.',
    note: 'Free · no account · no credit card required',
    scanPlaceholder: 'your-website.com',
    scanLabel: 'Website address for the free check',
    scanButton: 'Check website',
    enterprise: 'Enterprise inquiry',
    loopKicker: 'How it works',
    loopTitleA: 'Four steps,',
    loopTitleEm: 'clearly explained.',
    loopIntro:
      'From the first check to evidence you can hand over: you always see where you stand and what to do next.',
    loop: [
      [
        '01 · CHECK',
        'Scan your website',
        'We load your website and record which cookies are set, which trackers load and which AI services are embedded.',
        'You know what actually happens on your site — not just what your privacy policy says.',
      ],
      [
        '02 · UNDERSTAND',
        'Classify risks',
        'Each finding is mapped to the relevant rule (GDPR, TDDDG, EU AI Act) and sorted by urgency.',
        'You see right away what matters and why — no legal background needed.',
      ],
      [
        '03 · ACT',
        'Fix what matters',
        'Every finding comes with a concrete recommendation, for example a missing consent before a tracker loads.',
        'You or your agency can start right away instead of researching first.',
      ],
      [
        '04 · DOCUMENT',
        'Keep clean records',
        'Checks and measures are recorded with a date and can be exported as evidence.',
        'When customers, data protection officers or auditors ask, your records are ready.',
      ],
    ],
    rmKicker: 'Roadmap · honest status',
    rmTitleA: 'What is available today —',
    rmTitleEm: 'and what comes next.',
    rmIntro:
      '“Live” you can use today. “Preview” is testable but may still change. “Coming soon” is planned and not yet usable.',
    rmLive: 'Live',
    rmPreview: 'Preview',
    rmNext: 'Coming soon',
    rmMore: 'View full roadmap →',
  },
};
