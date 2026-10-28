import { lazy, Suspense } from 'react';
import { Globe, X } from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { useLang } from '../../i18n/useLang';
import { OS_FOCUS_RING } from './osChrome';

// Erst beim Aufklappen laden — die Runtime ist groß und auf den meisten
// Seiten nicht nötig.
const BrowserRuntimePanel = lazy(() =>
  import('../../features/governance/dashboard/BrowserRuntimePanel').then((m) => ({ default: m.BrowserRuntimePanel })),
);

/**
 * Browser-Agent zum Ausklappen rechts oben (Schalter in BrowserTopBar).
 *
 * Zeigt dieselbe RealSync Browser Runtime wie die Detailansicht der Übersicht
 * (BrowserRuntimePanel: Executor-Status, Governed Action Composer, Freigaben)
 * — kein zweiter Agent, nur ein schneller Zugang von jeder /app-Seite.
 */
export function BrowserAgentDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Mandant erst im geöffneten Zustand lesen: Die Shell rendert den Drawer
  // immer mit, auch dort, wo (noch) kein TenantProvider darüber liegt.
  if (!open) return null;
  return <BrowserAgentDrawerPanel onClose={onClose} />;
}

function BrowserAgentDrawerPanel({ onClose }: { onClose: () => void }) {
  const { activeTenantId } = useTenant();
  const { t } = useLang();
  return (
    <aside id="browser-agent-drawer" className="rs-browser-drawer" aria-label={t('browserAgentTitle')} data-testid="browser-agent-drawer">
      <div className="rs-browser-drawer__head">
        <Globe className="h-4 w-4" aria-hidden="true" />
        <span>{t('browserAgentTitle')}</span>
        <button
          type="button"
          onClick={onClose}
          className={`rs-apphead__icon-btn ml-auto ${OS_FOCUS_RING}`}
          aria-label={t('browserAgentClose')}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="rs-browser-drawer__body">
        <Suspense fallback={null}>
          <BrowserRuntimePanel activeTenantId={activeTenantId ?? null} />
        </Suspense>
      </div>
    </aside>
  );
}
