/**
 * Post-scan CHOICE row — four honest next steps after a public /audit result.
 *
 * Not a product mega-menu. Account only when the visitor wants to save, share,
 * or continuously monitor. Badges match src/product/implementation-status.ts.
 *
 * Spec: docs/product/scan-funnel.md
 */
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  ClipboardList,
  FileDown,
  Scale,
  Wrench,
} from 'lucide-react';

export type PostScanChoiceBadge = 'live' | 'preview' | 'coming-soon';

export interface PostScanChoice {
  id: string;
  title: string;
  description: string;
  to: string;
  badge: PostScanChoiceBadge;
  icon: typeof Activity;
  /** Optional router state for guided onboarding. */
  state?: unknown;
}

const BADGE_LABEL: Record<PostScanChoiceBadge, string> = {
  live: 'Live',
  preview: 'Preview',
  'coming-soon': 'Coming Soon',
};

export function buildPostScanChoices(input: {
  auditId: string;
  domain: string;
  score: number;
  severity: string;
  hasFindings: boolean;
  findings?: Array<{
    id: string;
    severity: string;
    title: string;
    detail: string;
    paragraph_ref?: string;
  }>;
}): PostScanChoice[] {
  const { auditId, domain, score, severity, hasFindings, findings = [] } = input;
  const monitorNext = encodeURIComponent('/app/monitoring');
  const activationNext = encodeURIComponent('/app/activation');
  const evidenceNext = encodeURIComponent('/app/evidence');

  const fixTo = hasFindings
    ? `/onboarding/${auditId}`
    : '/claude-code-optimizer';
  const fixState = hasFindings
    ? {
        findings,
        domain,
        score,
        severity,
        auditId,
      }
    : undefined;

  return [
    {
      id: 'monitor',
      title: 'Diese Domain überwachen',
      description:
        'Kontinuierliche Kontrolle — Drift und neue Risiken nach dem Snapshot.',
      to: `/welcome?next=${monitorNext}&source=post_scan_monitor&audit_id=${encodeURIComponent(auditId)}&domain=${encodeURIComponent(domain)}`,
      badge: 'coming-soon',
      icon: Activity,
    },
    {
      id: 'fix-plan',
      title: 'Fix-Plan mit Code-Empfehlungen erstellen',
      description: hasFindings
        ? 'Geführter Plan aus Ihren Befunden — Maßnahmen und Paket-Empfehlung.'
        : 'Code-Optimizer-Pfad (Preview), wenn der Scan keine Befunde liefert.',
      to: fixTo,
      badge: hasFindings ? 'live' : 'preview',
      icon: Wrench,
      state: fixState,
    },
    {
      id: 'activation',
      title: 'KI-Use-Cases und EU-AI-Act-Pflichten erfassen',
      description:
        'Guided Activation im Governance OS — Org + Scope, Self-Service Activation.',
      to: `/welcome?next=${activationNext}&source=post_scan_activation&audit_id=${encodeURIComponent(auditId)}`,
      badge: 'live',
      icon: Scale,
    },
    {
      id: 'export',
      title: 'Report für Kunde, DSB oder Auditor exportieren',
      description:
        'Teilen und Dokumente jetzt; vollständiges Evidence-Paket nach Login speichern.',
      to: `/welcome?next=${evidenceNext}&source=post_scan_export&audit_id=${encodeURIComponent(auditId)}`,
      badge: 'preview',
      icon: FileDown,
    },
  ];
}

export function PostScanChoiceRow({
  choices,
}: {
  choices: readonly PostScanChoice[];
}) {
  return (
    <section
      aria-label="Nächste Schritte nach dem Scan"
      className="border border-titanium-800 bg-obsidian-900"
    >
      <div className="flex items-center gap-2 border-b border-titanium-900 px-4 py-3">
        <ClipboardList className="h-4 w-4 text-[#e4cfa2]" />
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-[#e4cfa2]/80">
            Wahl · kein Produkt-Mega-Menü
          </p>
          <h2 className="font-display text-sm font-semibold text-titanium-50">
            Was wollen Sie als Nächstes tun?
          </h2>
        </div>
      </div>
      <ul className="grid divide-y divide-titanium-900 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4 lg:divide-y-0">
        {choices.map((choice) => {
          const Icon = choice.icon;
          return (
            <li key={choice.id} className="flex flex-col border-titanium-900 p-4 sm:border-0">
              <div className="mb-3 flex items-start justify-between gap-2">
                <Icon className="h-4 w-4 shrink-0 text-[#e4cfa2]" aria-hidden />
                <span className="font-mono text-[8px] uppercase tracking-[.14em] text-titanium-500">
                  {BADGE_LABEL[choice.badge]}
                </span>
              </div>
              <h3 className="font-display text-sm font-bold leading-snug text-titanium-50">
                {choice.title}
              </h3>
              <p className="mt-2 flex-1 text-[12px] leading-relaxed text-titanium-400">
                {choice.description}
              </p>
              <Link
                to={choice.to}
                state={choice.state}
                className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#e4cfa2] transition hover:text-[#f2eee6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4cfa2]/50"
              >
                Weiter <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-titanium-900 px-4 py-2 font-mono text-[9px] text-titanium-600">
        Konto nur zum Speichern, Teilen oder für Dauerüberwachung — der erste Scan-Ergebnisbericht
        bleibt ohne Login sichtbar.
      </p>
    </section>
  );
}
