import type { NeonMode } from '../../hooks/useNeonMode';
import '../../styles/neon-theme.css';

/** Umschalter Hell (weiß) / Dunkel für das Neon-Design. */
export function NeonModeToggle({ mode, onToggle, className }: { mode: NeonMode; onToggle: () => void; className?: string }) {
  const light = mode === 'light';
  return (
    <button
      type="button"
      className={`rs-neon-toggle${className ? ` ${className}` : ''}`}
      onClick={onToggle}
      aria-pressed={light}
      aria-label={light ? 'Dunkles Design einschalten' : 'Helles Design einschalten'}
      data-mode={mode}
      data-testid="neon-mode-toggle"
    >
      <span className="rs-neon-toggle__knob" aria-hidden="true" />
      <span className="rs-neon-toggle__label">{light ? 'Hell' : 'Dunkel'}</span>
    </button>
  );
}
