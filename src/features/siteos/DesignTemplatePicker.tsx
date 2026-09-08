import type { SiteDesignTemplate } from '../../../packages/siteos-core/src/render/templates';
import { SITE_DESIGN_TEMPLATES } from '../../../packages/siteos-core/src/render/templates';

/**
 * Vorlagenwahl mit Farbkarten. Die Karten sind das, was Framer/Webflow
 * zuerst zeigen — ohne sie ist die Liste nur Text, und 8K sieht aus wie
 * jeder andere Eintrag.
 */
export function DesignTemplatePicker({
  selected,
  onSelect,
  tone = 'dark',
}: {
  selected: SiteDesignTemplate;
  onSelect: (id: SiteDesignTemplate) => void;
  tone?: 'dark' | 'light';
}) {
  const selectedBorder = tone === 'dark'
    ? 'border-petrol-600 bg-petrol-950/40 text-titanium-50'
    : 'border-cyan-400/40 bg-cyan-50 text-cyan-800';
  const idleBorder = tone === 'dark'
    ? 'border-titanium-800 text-titanium-400 hover:border-titanium-600'
    : 'border-black/[.07] text-black/70 hover:border-black/20';
  const desc = tone === 'dark' ? 'text-titanium-500' : 'text-black/45';
  const badge = tone === 'dark' ? 'text-petrol-400' : 'text-cyan-700';

  return (
    <div className="space-y-2">
      {SITE_DESIGN_TEMPLATES.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${selected === item.id ? selectedBorder : idleBorder}`}
        >
          <span className="flex items-center gap-2">
            <span className="flex h-5 w-8 shrink-0 overflow-hidden border border-black/10" aria-hidden>
              <span className="h-full w-1/2" style={{ background: item.surface }} />
              <span className="h-full w-1/2" style={{ background: item.accent }} />
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold">{item.label}</span>
            {item.tag === '8K' && (
              <span className={`font-mono text-[9px] uppercase tracking-wider ${badge}`}>8K</span>
            )}
          </span>
          <span className={`mt-1 block text-[10px] leading-4 ${desc}`}>{item.description}</span>
        </button>
      ))}
    </div>
  );
}
