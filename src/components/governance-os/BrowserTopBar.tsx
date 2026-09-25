import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, Menu, X, FileCheck2, FileBarChart2, Search, LogOut, ShieldCheck } from 'lucide-react';
import { GovernanceAddressBar } from './GovernanceAddressBar';
import { useSupabaseAuth } from '../../features/supabase/SupabaseAuthContext';
import { LangToggle } from '../handoff/LangToggle';
import { useLang } from '../../i18n/useLang';
import { initialsFromEmail } from '../../features/governance/handoff/enforcementModel';
import { OS_FOCUS_RING } from './osChrome';
import { APP_HEADER_HEIGHT } from './app-theme';
import { SHELL_TITLES, activeShellNav } from './shellNav';
import '../../styles/governance-os-app.css';

interface BrowserTopBarProps {
  mobileMenuOpen: boolean;
  onToggleMobile: () => void;
  onOpenAssistant: () => void;
  onOpenCommandCenter: () => void;
  onLoadUrl: (url: string) => void;
  activeEmbedUrl?: string;
}

/**
 * Kopfzeile der App — Handoff v2 §5 (56px, Titel 15px Inter Tight + Sub 13px).
 *
 * Rechts: Command Center (⌘K), Landing · Preise, DE/EN, „EU · Frankfurt"
 * (Supabase-Region eu-central-1), Avatar mit Initialen des echten Nutzers.
 * „RUNTIME LIVE" aus dem Entwurf fehlt bewusst: Es gibt keinen Laufzeit-
 * Status, der diese Aussage deckt. „Login" entfällt, weil hier nur
 * angemeldete Nutzer landen — an seiner Stelle steht „Abmelden".
 */
export function BrowserTopBar({
  mobileMenuOpen,
  onToggleMobile,
  onOpenAssistant,
  onOpenCommandCenter,
  onLoadUrl,
  activeEmbedUrl,
}: BrowserTopBarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { logout, isAuthenticated, user } = useSupabaseAuth();
  const { t } = useLang();
  const titles = SHELL_TITLES[activeShellNav(pathname) ?? 'app'];
  const initials = initialsFromEmail(user?.email ?? null);

  async function handleSignOut() {
    await logout();
    // Full navigation clears in-memory tenant/entitlement state.
    window.location.href = '/';
  }

  return (
    <header className="rs-apphead rs-ui" style={{ minHeight: APP_HEADER_HEIGHT }}>
      {/* Mobile-Menü Toggle — system drawer entry */}
      <button
        type="button"
        onClick={onToggleMobile}
        className={`rs-apphead__icon-btn lg:hidden ${OS_FOCUS_RING}`}
        aria-label={mobileMenuOpen ? 'Systemmenü schließen' : 'Systemmenü öffnen'}
        aria-expanded={mobileMenuOpen}
        aria-controls={mobileMenuOpen ? 'governance-mobile-menu' : undefined}
      >
        {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Logo-Mark nur mobil — ab lg trägt die Seitenleiste die Marke. */}
      <Link to="/app/dashboard" className="rs-logo-mark lg:hidden" aria-label="Governance OS — Übersicht">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
      </Link>

      <div className="flex min-w-0 flex-col">
        <span className="rs-apphead__title">{t(titles.title)}</span>
        <span className="rs-apphead__sub hidden sm:block">{t(titles.sub)}</span>
      </div>

      {/* Address Bar — echte URLs öffnen die eingebettete Ansicht. */}
      <div className="hidden min-w-0 flex-1 justify-center xl:flex">
        <GovernanceAddressBar onLoadUrl={onLoadUrl} activeUrl={activeEmbedUrl} />
      </div>
      <div className="flex-1 xl:hidden" />

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenCommandCenter}
          className="rs-chip-sm hidden sm:inline-flex"
          aria-label="Command Center öffnen"
        >
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden lg:inline">{t('shellSearch')}</span>
          <kbd className="rs-kbd hidden md:inline">⌘K</kbd>
        </button>
        <button type="button" onClick={() => navigate('/audit')} className="rs-chip-sm rs-chip-sm--primary hidden md:inline-flex">
          {t('shellAudit')}
        </button>
        <button
          type="button"
          onClick={() => navigate('/app/evidence')}
          className="rs-apphead__icon-btn hidden md:inline-grid lg:hidden"
          aria-label={t('shellEvidence')}
          title={t('shellEvidence')}
        >
          <FileCheck2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => navigate('/app/reports')}
          className="rs-apphead__icon-btn hidden md:inline-grid lg:hidden"
          aria-label={t('shellReport')}
          title={t('shellReport')}
        >
          <FileBarChart2 className="h-4 w-4" />
        </button>
        <Link to="/" className="rs-chip-sm hidden 2xl:inline-flex">
          {t('shellLanding')}
        </Link>
        <Link to="/pricing" className="rs-chip-sm hidden 2xl:inline-flex">
          {t('shellPricing')}
        </Link>
        <span className="hidden sm:inline-flex">
          <LangToggle />
        </span>
        <span className="rs-region hidden lg:inline-flex">{t('shellRegion')}</span>
        <button type="button" onClick={onOpenAssistant} className="rs-chip-sm">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">{t('shellAssistant')}</span>
        </button>
        {isAuthenticated && (
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="rs-apphead__icon-btn"
            aria-label="Abmelden"
            title={t('shellLogout')}
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
        {initials && (
          <span className="rs-avatar" title={user?.email} aria-label={user?.email} data-testid="shell-avatar">
            {initials}
          </span>
        )}
      </div>
    </header>
  );
}
