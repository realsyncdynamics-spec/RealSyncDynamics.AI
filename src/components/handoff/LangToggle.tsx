import { useLang } from '../../i18n/useLang';
import '../../styles/governance-os-handoff.css';

/** DE/EN-Umschalter (JetBrains Mono 11px, Border #1F2B48). DE ist Vorgabe. */
export function LangToggle({ className = '' }: { className?: string }) {
  const { lang, toggleLang, t } = useLang();
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
      <span className={lang === 'de' ? 'rs-lang__on' : undefined}>DE</span>
      <span aria-hidden="true">→</span>
      <span className={lang === 'en' ? 'rs-lang__on' : undefined}>EN</span>
    </button>
  );
}
