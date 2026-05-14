import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AudioLines, X, Search, FileText, MessageCircleQuestion } from 'lucide-react';

const HIDDEN_PREFIXES = [
  '/dashboard',
  '/governance',
  '/checkout',
  '/audit',
];

function shouldHide(pathname: string): boolean {
  return HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function AssistentChip() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (shouldHide(pathname)) return null;

  return (
    <>
      {open && (
        <button
          aria-label="Schließen"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-obsidian-950/40 backdrop-blur-[2px]"
        />
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Assistent-Schnellzugriff"
          className="fixed left-1/2 -translate-x-1/2 bottom-24 z-40 w-[min(360px,calc(100vw-2rem))] bg-obsidian-950 border border-titanium-800 shadow-2xl rounded-2xl overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-titanium-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-obsidian-950">
                <AudioLines className="h-3.5 w-3.5" />
              </span>
              <div>
                <div className="text-sm font-semibold text-titanium-50 leading-none">Assistent</div>
                <div className="mt-0.5 text-[10px] text-titanium-400">Schnellzugriff · EU-gehostet</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Schließen"
              className="text-titanium-400 hover:text-titanium-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="py-1">
            <QuickItem
              to="/audit?source=chip-scan"
              icon={<Search className="h-4 w-4 text-cyan-300" />}
              label="Website scannen"
              hint="Free Audit · 30 Sekunden"
              onClick={() => setOpen(false)}
            />
            <QuickItem
              to="/audit?source=chip-question"
              icon={<MessageCircleQuestion className="h-4 w-4 text-violet-300" />}
              label="Compliance-Frage stellen"
              hint="Zur KI-Chat-Vorschau"
              onClick={() => setOpen(false)}
            />
            <QuickItem
              to="/pricing?source=chip-pricing"
              icon={<FileText className="h-4 w-4 text-titanium-300" />}
              label="Preise & Pläne"
              hint="Free, Starter, Growth, Agency, Enterprise"
              onClick={() => setOpen(false)}
            />
          </nav>

          <div className="px-4 py-2.5 bg-obsidian-900 border-t border-titanium-900 text-[10px] text-titanium-500">
            <kbd className="px-1 py-0.5 bg-obsidian-950 border border-titanium-800 rounded text-titanium-300 font-mono text-[9px]">Esc</kbd>
            <span className="ml-2">schließen</span>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Assistent öffnen"
        className="fixed left-1/2 -translate-x-1/2 bottom-4 z-40 inline-flex items-center gap-2 pl-4 pr-2 py-2 bg-obsidian-950 text-titanium-50 rounded-full shadow-2xl border border-titanium-800 hover:border-titanium-600 transition-colors"
        style={{ boxShadow: '0 10px 40px -10px rgba(0,0,0,0.6), 0 0 0 1px rgba(168,85,247,0.1)' }}
      >
        <span className="text-sm font-medium tracking-tight">Assistent</span>
        <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-black">
          <AudioLines className="h-3.5 w-3.5 text-white" />
        </span>
      </button>
    </>
  );
}

function QuickItem({
  to,
  icon,
  label,
  hint,
  onClick,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 hover:bg-obsidian-900 transition-colors"
    >
      <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-obsidian-900 border border-titanium-800">
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-titanium-50">{label}</span>
        <span className="block text-[11px] text-titanium-400 truncate">{hint}</span>
      </span>
    </Link>
  );
}
