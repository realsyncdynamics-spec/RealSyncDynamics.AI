/**
 * Leer- und Fehlerzustand des Governance-Scores — EINE Komponente für die
 * Score-Kachel (HandoffOverview) und die Governance-Score-Karte im Command
 * Center (ComplianceStatusView), damit beide identisch bleiben.
 *
 *   insufficient_data → „Noch nicht bewertbar“ + erster Schritt
 *   unreliable        → Fehlerzustand mit „Erneut laden“ (kein Leerzustand,
 *                       keine Ersatzzahl)
 *
 * Farben erben vom Kontext (currentColor / Token mit Fallback), weil die
 * Kachel im Handoff-Theme und die Karte im Titanium-Theme liegt.
 */
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, RotateCcw } from 'lucide-react';
import { useLang } from '../../../i18n/useLang';
import type { GovernanceScoreStatus, ScoreDataBasis } from './cockpitScore';

/** Erster Schritt bei leerem Inventar: echter Anlege-Pfad (governance-resources create_asset). */
export const SCORE_FIRST_STEP_ROUTE = '/app/onboarding';

export interface GovernanceScoreStateProps {
  status: Exclude<GovernanceScoreStatus, 'ok'>;
  basis?: ScoreDataBasis | null;
  /** Neu laden der Score-Quellen; ohne Callback lädt der Button die Seite neu. */
  onRetry?: () => void;
  testId?: string;
}

export function GovernanceScoreState({ status, basis, onRetry, testId = 'score-state' }: GovernanceScoreStateProps) {
  const { t } = useLang();

  if (status === 'unreliable') {
    return (
      <div role="alert" className="flex flex-col items-center gap-2 px-4 text-center" data-testid={`${testId}-error`}>
        <AlertTriangle className="h-5 w-5" style={{ color: 'var(--color-rs-danger, #f43f5e)' }} aria-hidden="true" />
        <p className="text-sm font-semibold">{t('scoreErrorTitle')}</p>
        <p className="text-xs opacity-75">{t('scoreErrorSub')}</p>
        <button
          type="button"
          // Ohne Callback (z. B. eigenständige Ansicht): Seite neu laden.
          onClick={onRetry ?? (() => window.location.reload())}
          data-testid={`${testId}-retry`}
          className="mt-1 inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-semibold"
          style={{ borderColor: 'currentColor' }}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> {t('scoreRetry')}
        </button>
      </div>
    );
  }

  const emptyInventory = basis != null && basis.aiSystems === 0 && basis.controlMappings === 0;
  return (
    <div className="flex flex-col items-center gap-2 px-4 text-center" data-testid={`${testId}-empty`}>
      <p className="text-sm font-semibold">{t('scoreNotRatable')}</p>
      <p className="text-xs opacity-75">
        {emptyInventory ? t('scoreNotRatableEmpty') : t('scoreNotRatableSnapshot')}
      </p>
      {emptyInventory && (
        <Link
          to={SCORE_FIRST_STEP_ROUTE}
          data-testid={`${testId}-first-step`}
          className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold underline underline-offset-2"
          style={{ color: 'var(--color-rs-cyan, #00B8D4)' }}
        >
          {t('scoreFirstStep')} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
