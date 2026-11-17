import { ALL_MODULES, POLICY_PACK_IDS } from '@/shared/pricing';
import type { Plan } from '@/shared/pricing';
import type { ProductLandingContent } from '../types';

/** Policy Packs eines Pakets, Namen aus der Modul-Liste in `shared/pricing.ts`. */
function policyPacks(plan: Plan): string | boolean {
  const names = POLICY_PACK_IDS.filter((id) => plan.modules.includes(id)).map(
    (id) => ALL_MODULES.find((m) => m.id === id)?.name ?? id,
  );
  return names.length > 0 ? names.join(', ') : false;
}

export const GOVERNANCE_OS_CONTENT: ProductLandingContent = {
  slug: 'governance-os',
  seoTitle: 'Governance OS – Regeln, Freigaben und Nachweise an einem Ort',
  seoDescription:
    'Das Governance OS prüft KI-Anfragen, Agent-Aktionen und Websites gegen Ihre Regeln, holt Freigaben ein und dokumentiert Entscheidungen im Prüfpfad.',
  eyebrow: '04 · GOVERN',
  statusId: 'app-shell',
  headline: 'Regeln, Freigaben, Nachweise.',
  headlineSub: 'An einem Ort.',
  lead: 'Das Governance OS prüft KI-Anfragen, Agent-Aktionen und Websites gegen Ihre Regeln, holt Freigaben ein, wo es nötig ist, und dokumentiert Entscheidungen im Prüfpfad.',
  primaryCta: { label: 'Kostenlosen Check starten', to: '/audit' },
  secondaryCta: { label: 'Anmelden und Governance OS öffnen', to: '/welcome?next=%2Fapp%2Fdashboard' },
  hint: 'Start mit dem kostenlosen Check',
  example: {
    title: 'Entscheidungspunkt',
    rows: [
      'Erlauben – Aktion läuft',
      'Warnen – läuft, mit Hinweis',
      'Freigabe verlangen – wartet auf einen Menschen',
      'Blockieren – wird verhindert',
      'Nur protokollieren – wird dokumentiert',
    ],
    caption: 'Die fünf Entscheidungen, die das System kennt',
  },
  sections: [
    {
      id: 'entscheidung',
      eyebrow: 'Entscheidungen',
      title: 'Jede Aktion bekommt ein Urteil.',
      kind: 'steps',
      cards: [
        { title: 'Aktion kommt an', text: 'Eine KI-Anfrage, eine Aktion eines Agenten oder ein Website-Scan.' },
        { title: 'Regeln greifen', text: 'Die Plattform prüft die Aktion gegen Ihre Regeln.' },
        { title: 'Urteil', text: 'Erlauben, warnen, Freigabe verlangen, blockieren oder nur protokollieren.' },
        { title: 'Prüfpfad', text: 'Warnungen, Freigaben und Blockaden werden mit Zeitpunkt und Begründung gespeichert.' },
      ],
    },
    {
      id: 'einstieg',
      eyebrow: 'Direkt ins Dashboard',
      title: 'DSGVO und EU AI Act im Governance OS.',
      intro:
        'Nach der Anmeldung landen Sie direkt im passenden Bereich des Dashboards.',
      kind: 'cards',
      cards: [
        {
          title: 'DSGVO',
          text: 'Verarbeitungsverzeichnis und Dokumente.',
          to: '/welcome?next=%2Fapp%2Fdocuments',
          toLabel: 'DSGVO-Bereich öffnen',
        },
        {
          title: 'EU AI Act',
          text: 'Register Ihrer KI-Systeme mit Einstufung.',
          statusId: 'ai-system-registry',
          to: '/welcome?next=%2Fapp%2Fai-systems',
          toLabel: 'KI-Register öffnen',
        },
        {
          title: 'Policy Packs',
          text: 'Die Regeln der Rahmenwerke, die Ihr Paket enthält.',
          statusId: 'policy-engine',
          to: '/welcome?next=%2Fapp%2Fpolicy-packs',
          toLabel: 'Policy Packs öffnen',
        },
        {
          title: 'Dashboard',
          text: 'Der Stand Ihrer Pflichten und offenen Punkte.',
          statusId: 'command-center',
          to: '/welcome?next=%2Fapp%2Fdashboard',
          toLabel: 'Dashboard öffnen',
        },
      ],
    },
    {
      id: 'module',
      eyebrow: 'Module',
      title: 'Was im Governance OS steckt.',
      kind: 'cards',
      cards: [
        { title: 'Regeln', text: 'Regeln definieren, versionieren und zur Laufzeit anwenden.', statusId: 'policy-engine' },
        { title: 'Nachweise', text: 'Logs, Freigaben und Prüfprotokolle, verkettet über Hash-Werte.', statusId: 'evidence-surfaces' },
        { title: 'Übersicht', text: 'Der Stand Ihrer Pflichten und offenen Punkte auf einen Blick.', statusId: 'command-center' },
        { title: 'KI-Register', text: 'Ein Register Ihrer KI-Systeme.', statusId: 'ai-system-registry' },
        { title: 'Agenten unter Aufsicht', text: 'Aktionen von KI-Agenten laufen durch dieselben Regeln.', statusId: 'agent-governance' },
        { title: 'Weitere Rahmenwerke', text: 'TISAX und DORA.', statusId: 'framework-tisax-dora' },
      ],
    },
    {
      id: 'grenzen',
      eyebrow: 'Klare Grenzen',
      title: 'Was das Governance OS nicht ersetzt.',
      kind: 'list',
      list: [
        'Es dokumentiert und steuert Ihre Regeln und Entscheidungen. Rechtsberatung und Zertifizierung ersetzt es nicht.',
        'Ob Sie konform sind, entscheiden Ihre Maßnahmen und gegebenenfalls Prüfer.',
        'Dauerhafte Überwachung ist noch nicht verfügbar.',
      ],
    },
  ],
  planIntro: 'Mit jedem Paket mehr Rahmenwerke.',
  planRows: [
    { label: 'Policy Packs', value: policyPacks },
    { label: 'Nachweisspeicher', value: (plan) => (plan.permissions.evidenceVault ? `${plan.limits.evidenceStorageGb} GB` : false) },
    { label: 'Risk Register', value: (plan) => plan.modules.includes('risk_register') },
    { label: 'Audit-Export', value: (plan) => plan.permissions.auditExport },
  ],
  faq: [
    {
      question: 'Für wen ist das Governance OS?',
      answer: 'Für Teams, die Regeln, Freigaben und Nachweise selbst steuern und gegenüber Prüfern belegen müssen.',
    },
    {
      question: 'Macht mich das konform?',
      answer: 'Es dokumentiert Ihre Regeln und Entscheidungen nachvollziehbar. Ob Sie konform sind, entscheiden Ihre Maßnahmen und gegebenenfalls Prüfer.',
    },
    {
      question: 'Womit fange ich an?',
      answer: 'Mit dem kostenlosen Check. Er zeigt, wo Ihr Betrieb steht.',
    },
  ],
  closing: {
    title: 'Nachweise statt Behauptungen.',
    text: 'Starten Sie mit dem kostenlosen Check.',
  },
};
