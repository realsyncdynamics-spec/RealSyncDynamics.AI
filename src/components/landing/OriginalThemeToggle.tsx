import { Moon, Sun } from 'lucide-react';
import type { LandingMode } from './landing-mode';
import { MODE_ACCENT, MODE_LINE, MODE_MUTED } from './landing-mode';

export function OriginalThemeToggle({
  mode,
  onChange,
}: {
  mode: Exclude<LandingMode, 'cyan'>;
  onChange: (next: Exclude<LandingMode, 'cyan'>) => void;
}) {
  const light = mode === 'light';

  return (
    <button
      type="button"
      aria-label={light ? 'Dunkles Design aktivieren' : 'Helles Design aktivieren'}
      aria-pressed={light}
      onClick={() => onChange(light ? 'gold' : 'light')}
      className="relative inline-flex h-10 w-[76px] shrink-0 items-center rounded-full border p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsd-accent,#d6ad68)]"
      style={{ borderColor: MODE_LINE, color: MODE_MUTED }}
    >
      <span
        aria-hidden="true"
        className="absolute grid h-8 w-8 place-items-center rounded-full transition-all duration-200"
        style={{
          left: light ? 4 : 40,
          backgroundColor: MODE_ACCENT,
          color: '#0a0a0b',
          boxShadow: '0 0 20px rgba(214,173,104,.22)',
        }}
      >
        {light ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </span>
      <Sun className="ml-1.5 h-4 w-4" aria-hidden="true" />
      <Moon className="ml-auto mr-1.5 h-4 w-4" aria-hidden="true" />
    </button>
  );
}
