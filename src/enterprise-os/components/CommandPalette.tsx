import React, { useEffect, useMemo, useState } from 'react';
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react';

export interface CommandItem {
  id: string;
  label: string;
  group: string;
  shortcut?: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
}

export function CommandPalette({ open, onClose, items }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((item) => item.label.toLowerCase().includes(q) || item.group.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[activeIndex];
        if (item) {
          item.onSelect();
          onClose();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, filtered, activeIndex, onClose]);

  if (!open) return null;

  let lastGroup = '';

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-obsidian-950/80 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg border border-titanium-700 bg-obsidian-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-titanium-800 px-4 py-3">
          <Search className="h-4 w-4 text-titanium-500" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Befehl ausführen oder zu Seite springen…"
            className="flex-1 bg-transparent text-sm text-titanium-100 placeholder:text-titanium-600 focus:outline-none"
          />
          <kbd className="border border-titanium-700 px-1.5 py-0.5 font-mono text-[10px] text-titanium-500">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-titanium-500">Keine Treffer für „{query}"</p>
          )}
          {filtered.map((item, idx) => {
            const showGroup = item.group !== lastGroup;
            lastGroup = item.group;
            return (
              <React.Fragment key={item.id}>
                {showGroup && (
                  <p className="px-4 pb-1 pt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-600">
                    {item.group}
                  </p>
                )}
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => {
                    item.onSelect();
                    onClose();
                  }}
                  className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors ${
                    idx === activeIndex ? 'bg-security-500/10 text-titanium-50' : 'text-titanium-300 hover:bg-titanium-800/40'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.shortcut && (
                    <kbd className="font-mono text-[10px] text-titanium-500">{item.shortcut}</kbd>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-titanium-800 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-titanium-600">
          <span className="flex items-center gap-1"><ArrowUp className="h-3 w-3" /><ArrowDown className="h-3 w-3" /> Navigieren</span>
          <span className="flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> Auswählen</span>
        </div>
      </div>
    </div>
  );
}
