import { Globe, X } from 'lucide-react';
import { StatusBadge } from '../brand';
import { useLang } from '../../i18n/useLang';
import { GovernanceAddressBar } from './GovernanceAddressBar';
import { APP_SIDE_PANEL_WIDTH } from './app-theme';
import '../../styles/governance-os-app.css';

interface BrowserAgentPanelProps {
  onClose: () => void;
  onLoadUrl: (url: string) => void;
  activeUrl?: string;
}

/**
 * Browser-OS-Agent — Panel rechts (Design System „RealSync Dashboard“,
 * SidePanel). Heute: Adresszeile der eingebetteten Ansicht („Vorschau“) und
 * Audit-Start per Enter — dieselbe Funktion, die vorher in der Kopfzeile lag.
 *
 * Ehrlich gekennzeichnet: Das automatische Bedienen von Websites mit
 * Schritt-Protokoll ist „In Arbeit“. Bis es läuft, zeigt das Panel keine
 * Beispielschritte, sondern einen Leerzustand. Aktionen mit Außenwirkung
 * brauchen später eine sichtbare Freigabe — das steht schon jetzt im Kopf
 * der Schrittliste.
 */
export function BrowserAgentPanel({ onClose, onLoadUrl, activeUrl }: BrowserAgentPanelProps) {
  const { t } = useLang();
  const title = t('shellBrowserAgent');
  return (
    <aside
      id="shell-panel-browser"
      aria-label={title}
      className="rs-sidepanel"
      style={{ width: APP_SIDE_PANEL_WIDTH }}
      data-testid="browser-agent-panel"
    >
      <div className="rs-sidepanel__head">
        <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
        <h2 className="rs-sidepanel__title">{title}</h2>
        <StatusBadge status="in-arbeit" />
        <button type="button" className="rs-apphead__icon-btn rs-sidepanel__close" onClick={onClose} aria-label={t('shellPanelClose')}>
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="rs-sidepanel__body">
        <p className="rs-sidepanel__text">
          Öffnen Sie eine Website in der eingebetteten Ansicht oder starten Sie mit Enter ein Audit.
          Das automatische Bedienen mit Schritt-Protokoll ist in Arbeit.
        </p>
        {/* Eigene Zeile: die Adresszeile wächst per flex-1 in die Breite. */}
        <div className="flex">
          <GovernanceAddressBar onLoadUrl={onLoadUrl} activeUrl={activeUrl} />
        </div>
        <section className="cc-panel" aria-label="Agent-Schritte">
          <div className="cc-panel__head">
            Agent-Schritte<span className="cc-panel__meta">Freigabe nötig</span>
          </div>
          <p className="cc-panel__empty">
            Noch keine Agent-Schritte. Aktionen mit Außenwirkung laufen erst nach Ihrer sichtbaren Freigabe.
          </p>
        </section>
      </div>
    </aside>
  );
}
