import type { ProductLandingContent } from '../types';

export const OPTIMIZER_CONTENT: ProductLandingContent = {
  slug: 'optimizer',
  seoTitle: 'Claude Code Optimizer – Website prüfen und gezielt verbessern',
  seoDescription:
    'Der Optimizer prüft Ihre Website auf Sicherheit, Einwilligung, Impressum und Datenschutz, erklärt jeden Befund und zeigt, was zuerst zu tun ist.',
  eyebrow: '03 · BUILD',
  statusId: 'gdpr-audit-module',
  headline: 'Ihre Website.',
  headlineSub: 'Gezielt verbessert.',
  lead: 'Der Optimizer prüft Ihre Website auf Sicherheit, Einwilligung, Impressum und Datenschutz, erklärt jeden Befund und zeigt, was zuerst zu tun ist.',
  primaryCta: { label: 'Website prüfen', to: '/claude-code-optimizer' },
  secondaryCta: { label: 'Pakete vergleichen', to: '/pricing' },
  hint: 'Kostenlos · ohne Konto',
  example: {
    title: 'Ergebnis',
    rows: [
      'Bewertung von 0 bis 100',
      'Tracker ohne sichtbares Consent-Banner',
      'Kein Impressum-Link gefunden',
      'Content-Security-Policy fehlt',
    ],
    caption: 'Aufbau eines Ergebnisses – Beispiel mit echten Prüfpunkten',
  },
  sections: [
    {
      id: 'stufen',
      eyebrow: 'Drei Stufen',
      title: 'Scannen. Beheben. Überwachen.',
      kind: 'cards',
      cards: [
        {
          title: 'Scannen',
          text: 'Die Website wird abgerufen und in mehreren Bereichen geprüft – kostenlos und ohne Konto.',
          statusId: 'free-audit',
        },
        {
          title: 'Beheben',
          text: 'Jeder Befund kommt mit Dringlichkeit, Erklärung und Rechtsbezug.',
          statusId: 'gdpr-audit-module',
        },
        {
          title: 'Überwachen',
          text: 'Neue Risiken automatisch erkennen.',
          statusId: 'continuous-domain-monitoring',
        },
      ],
    },
    {
      id: 'pruefpunkte',
      eyebrow: 'Prüfpunkte',
      title: 'Was der Check auswertet.',
      kind: 'cards',
      cards: [
        { title: 'Sicherheit', text: 'Zum Beispiel: keine HTTPS-Verschlüsselung, Mixed Content, HSTS-Header fehlt, Content-Security-Policy fehlt.' },
        { title: 'Einwilligung und Tracking', text: 'Zum Beispiel: Tracker ohne sichtbares Consent-Banner.' },
        { title: 'Impressum', text: 'Zum Beispiel: kein Impressum-Link gefunden.' },
        { title: 'Datenschutzerklärung', text: 'Zum Beispiel: kein Datenschutz-Link gefunden.' },
        { title: 'Sichtbarkeit', text: 'Zum Beispiel: keine Open-Graph-Tags.' },
      ],
    },
    {
      id: 'grenzen',
      eyebrow: 'Klare Grenzen',
      title: 'Was der Check kann – und was nicht.',
      kind: 'list',
      list: [
        'Der Optimizer liest nur. Er ändert nichts an Ihrer Website.',
        'Geprüft wird der ausgelieferte Code. Seiten, die erst im Browser aufgebaut werden, prüft er nur teilweise – das steht dann im Ergebnis.',
        'Ohne Konto bis zu 5 Prüfungen pro Stunde.',
        'Das Ergebnis ist eine technische Prüfung, keine Rechtsberatung.',
      ],
    },
  ],
  planIntro: 'Vom kostenlosen Scan zum Bericht.',
  planRows: [
    { label: 'Scan mit Bewertung', value: () => true },
    { label: 'Audit-Export', value: (plan) => plan.permissions.auditExport },
    { label: 'White-Label-Berichte', value: (plan) => plan.permissions.whiteLabelReports },
  ],
  faq: [
    {
      question: 'Ändert der Optimizer meine Website?',
      answer: 'Nein. Er ruft Ihre Website ab und wertet sie aus. Änderungen nehmen Sie selbst vor.',
    },
    {
      question: 'Warum heißt er Code Optimizer?',
      answer: 'Er prüft den Code, den Ihre Website ausliefert – Header, eingebundene Skripte, Links.',
    },
    {
      question: 'Ist das Ergebnis rechtsverbindlich?',
      answer: 'Nein. Es zeigt technische Befunde mit Bezug zur Rechtsgrundlage, ersetzt aber keine Rechtsberatung.',
    },
  ],
  closing: {
    title: 'Wie steht Ihre Website da?',
    text: 'Kostenlos und ohne Konto.',
  },
};
