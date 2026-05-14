import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AudioLines } from 'lucide-react';
import { AgentWidget } from '../features/governance/AgentWidget/AgentWidget';

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

  // Close on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (shouldHide(pathname)) return null;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <button
          aria-label="Schließen"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-obsidian-950/40 backdrop-blur-[2px]"
        />
      )}

      {/* KI chat panel (anon mode, controlled by this chip) */}
      <AgentWidget mode="anon" open={open} onClose={() => setOpen(false)} />

      {/* Trigger chip — always visible on public routes */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Assistent öffnen"
        className="fixed left-1/2 -translate-x-1/2 bottom-4 z-40 inline-flex items-center gap-2 pl-4 pr-2 py-2 bg-obsidian-950 text-titanium-50 rounded-full shadow-2xl border border-titanium-800 hover:border-titanium-600 transition-colors"
        style={{ boxShadow: '0 10px 40px -10px rgba(0,0,0,0.6), 0 0 0 1px rgba(168,85,247,0.1)' }}
      >
        <span className="text-sm font-medium tracking-tight">KI fragen</span>
        <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-black">
          <AudioLines className="h-3.5 w-3.5 text-white" />
        </span>
      </button>
    </>
  );
}
