import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

export interface RuntimeSidebarItem {
  to:       string;
  label:    string;
  icon?:    ReactNode;
  /** Optionaler kleiner Zahlen-Hinweis am rechten Rand (z. B. „7"). */
  count?:   number | string;
  /** Wenn true, wird der Link als externer Punkt (in Vorbereitung) markiert. */
  pending?: boolean;
}

export interface RuntimeSidebarProps {
  /** Gruppentitel oben. */
  title?:   string;
  items:    RuntimeSidebarItem[];
}

export function RuntimeSidebar({ title, items }: RuntimeSidebarProps) {
  const location = useLocation();
  return (
    <aside className="border-r border-titanium-800 bg-obsidian-950 px-2 py-4 sm:px-3">
      {title ? (
        <p className="px-2 pb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-titanium-500">
          {title}
        </p>
      ) : null}
      <nav>
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active = location.pathname === item.to;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={`flex items-center justify-between gap-2 border border-transparent px-2 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
                    active
                      ? 'border-ai-cyan-500/40 bg-ai-cyan-900/20 text-ai-cyan-200'
                      : 'text-titanium-300 hover:border-titanium-700 hover:bg-obsidian-900 hover:text-titanium-100'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    {item.icon ? <span className="text-titanium-400">{item.icon}</span> : null}
                    {item.label}
                  </span>
                  {item.count !== undefined ? (
                    <span className="font-mono text-[10px] text-titanium-500">{item.count}</span>
                  ) : null}
                  {item.pending ? (
                    <span className="font-mono text-[10px] text-amber-300">vorb.</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
