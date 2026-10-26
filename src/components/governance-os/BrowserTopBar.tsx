import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, Menu, X, FileCheck2, FileBarChart2, Search, LogOut, ShieldCheck, Globe, UserRound } from 'lucide-react';
import { useSupabaseAuth } from '../../features/supabase/SupabaseAuthContext';
import { LangToggle } from '../handoff/LangToggle';
import { useLang } from '../../i18n/useLang';
import { initialsFromEmail } from '../../features/governance/handoff/enforcementModel';
import { OS_FOCUS_RING } from './osChrome';
import { APP_HEADER_HEIGHT } from './app-theme';
import { SHELL_TITLES, activeShellNav } from './shellNav';
import type { ShellPanelId } from './shellPanels';
import '../../styles/governance-os-app.css';

interface BrowserTopBarProps {
  mobileMenuOpen: boolean;
  onToggleMobile: () => void;
  /** Offenes Panel rechts oder null — es ist immer höchstens eines offen. */
  openPanel: ShellPanelId | null;
  onTogglePanel: (id: ShellPanelId) => void;
  onOpenCommandCenter: () => void;
}

/**
 * Kopfzeile der App — Design System „RealSync Dashboard“, Komponente TopBar.
 *
 * Links Titel und Untertitel des Bereichs. Rechts: Command Center (⌘K),
 * „Audit starten“ und die Schalter für **Assistent** und **Browser-OS-Agent**
 * (je ein Panel rechts, `aria-expanded`, ein zweiter Klick schließt).
 * Landing, Preise, Sprache, Region und Abmelden liegen im Profilmenü, damit
 * rechts oben Platz für die beiden Panels bleibt. Die Adresszeile der
 * eingebetteten Ansicht wohnt jetzt im Browser-OS-Agent-Panel.
 *
 * „RUNTIME LIVE" aus dem Entwurf fehlt bewusst: Es gibt keinen Laufzeit-
 * Status, der diese Aussage deckt.
 */
export function BrowserTopBar({
  mobileMenuOpen,
  onToggleMobile,
  openPanel,
  onTogglePanel,
  onOpenCommandCenter,
}: BrowserTopBarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useLang();
  const titles = SHELL_TITLES[activeShellNav(pathname) ?? 'app'];

  const panels: { id: ShellPanelId; label: string; Icon: typeof Sparkles }[] = [
    { id: 'assistant', label: t('shellAssistant'), Icon: Sparkles },
    { id: 'browser', label: t('shellBrowserAgent'), Icon: Globe },
  ];

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

      <div className="flex-1" />

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
        {panels.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTogglePanel(id)}
            className={`rs-chip-sm${openPanel === id ? ' rs-chip-sm--active' : ''}`}
            aria-label={label}
            aria-expanded={openPanel === id}
            aria-controls={openPanel === id ? `shell-panel-${id}` : undefined}
            data-testid={`shell-toggle-${id}`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden md:inline" aria-hidden="true">{label}</span>
          </button>
        ))}
        <ProfileMenu />
      </div>
    </header>
  );
}

/**
 * Profilmenü am Avatar: Landing, Preise, Sprache, Region, Abmelden.
 * Schließt mit Escape, Klick außerhalb und nach einer Wahl.
 */
function ProfileMenu() {
  const { logout, isAuthenticated, user } = useSupabaseAuth();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const initials = initialsFromEmail(user?.email ?? null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function handleSignOut() {
    await logout();
    // Full navigation clears in-memory tenant/entitlement state.
    window.location.href = '/';
  }

  return (
    <div className="rs-profile" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="rs-profile__btn"
        aria-label={user?.email ? `${t('shellProfileMenu')}: ${user.email}` : t('shellProfileMenu')}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        data-testid="shell-profile-toggle"
      >
        {initials ? (
          <span className="rs-avatar" data-testid="shell-avatar" aria-hidden="true">{initials}</span>
        ) : (
          <UserRound className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
      {open && (
        <div id={menuId} className="rs-profile__menu" data-testid="shell-profile-menu">
          {user?.email && <p className="rs-profile__email">{user.email}</p>}
          <Link to="/" className="rs-profile__item" onClick={() => setOpen(false)}>{t('shellLanding')}</Link>
          <Link to="/pricing" className="rs-profile__item" onClick={() => setOpen(false)}>{t('shellPricing')}</Link>
          <div className="rs-profile__row">
            <LangToggle />
            <span className="rs-region">{t('shellRegion')}</span>
          </div>
          {isAuthenticated && (
            <button type="button" className="rs-profile__item" onClick={() => void handleSignOut()}>
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              {t('shellLogout')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
