import { useLang } from '../../i18n/useLang';
import '../../styles/governance-os-handoff.css';

/** DE/EN-Umschalter (JetBrains Mono 11px, Border #1F2B48). DE ist Vorgabe. */
export function LangToggle({ className = '' }: { className?: string }) {
  const { lang, toggleLang, t } = useLang();
  // Aktive Sprache zuerst, Zielsprache nach dem Pfeil — sonst wirkt der
  // Schalter immer wie „DE → EN", obwohl EN bereits aktiv ist.
  const current = lang === 'de' ? 'DE' : 'EN';
  const next = lang === 'de' ? 'EN' : 'DE';
  return (
    <button
      type="button"
      className={`rs-lang ${className}`}
      onClick={toggleLang}
      aria-label={`${t('langSwitch')}: ${next}`}
      data-testid="lang-toggle"
      data-lang={lang}
    >
      <span className="rs-lang__on">{current}</span>
      <span aria-hidden="true">→</span>
      <span>{next}</span>
    </button>
  );
}
