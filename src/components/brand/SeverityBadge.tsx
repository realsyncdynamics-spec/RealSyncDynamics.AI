import { cx } from './cx';

/**
 * Schweregrad-Badge (hoch / mittel / niedrig), Optik wie die Befund-Zeilen der
 * Landing-v4-Workspace-Vorschau. Styling über `.cc-severity--*`
 * (src/styles/command-center.css).
 */
export type Severity = 'hoch' | 'mittel' | 'niedrig';
export type SeverityLang = 'de' | 'en';

export const SEVERITY_LABELS: Record<SeverityLang, Record<Severity, string>> = {
  de: { hoch: 'Hoch', mittel: 'Mittel', niedrig: 'Niedrig' },
  en: { hoch: 'High', mittel: 'Medium', niedrig: 'Low' },
};

export function SeverityBadge({
  severity,
  lang = 'de',
  label,
  className,
}: {
  severity: Severity;
  /** Sprache des Standard-Labels (Standard: de). */
  lang?: SeverityLang;
  /** Optionaler eigener Text; überschreibt das Standard-Label. */
  label?: string;
  className?: string;
}) {
  return (
    <span
      data-severity={severity}
      className={cx('cc-severity', `cc-severity--${severity}`, className)}
    >
      {label ?? SEVERITY_LABELS[lang][severity]}
    </span>
  );
}
