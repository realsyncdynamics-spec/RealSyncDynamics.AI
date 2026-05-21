import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles, ArrowRight, X } from 'lucide-react';

// AssistentChip — persistent floating entry to the AI assistant.
//
// Phase 1 (Hostinger Pattern, Spec v2):
//   - Bottom-center floating chip auf allen public Routes.
//   - Klick öffnet ein leichtgewichtiges in-component Sheet (kein Radix,
//     kein Modal-Framework) mit Placeholder-Text "AI Runtime wird
//     initialisiert" und CTA "Audit starten" → /audit.
//   - Auto-hide auf /dashboard, /governance/* (nicht /governance selbst),
//     /checkout/*, /audit (eigener Funnel).
//   - Hero-CTA-Coexistence: solange ein [data-hero-cta] sichtbar ist,
//     blendet sich der Chip aus, damit er nicht mit dem Primary-CTA
//     konkurriert.
//
// Bewusst kein echter Chat in Phase 1:
//   Der frühere AgentWidget-Embed (PR #368) war zu früh — anon-Chat
//   braucht erst Rate-Limit + Audit-Logging (Phase 2). Das Sheet hier
//   ist reines UX-Signal "die Runtime ist da", nicht funktional.

const HIDDEN_PREFIXES = ['/dashboard', '/checkout', '/audit'];

function shouldHide(pathname: string): boolean {
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  // /governance ist die public OS-Surface — Chip sichtbar.
  // /governance/* ist auth-gated mit eigenem AgentWidget — Chip versteckt.
  if (pathname !== '/governance' && pathname.startsWith('/governance/')) return true;
  return false;
}

export function AssistentChip() {
  const { pathname } = useLocation();
  const [heroVisible, setHeroVisible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const targets = Array.from(document.querySelectorAll('[data-hero-cta]'));
    if (targets.length === 0) {
      setHeroVisible(false);
      return;
    }
    const visible = new Set<Element>();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target);
          else visible.delete(e.target);
        }
        setHeroVisible(visible.size > 0);
      },
      { threshold: 0.15 },
    );
    for (const t of targets) obs.observe(t);
    return () => obs.disconnect();
  }, [pathname]);

  // Esc schließt das Sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Route-Wechsel → Sheet zu.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (shouldHide(pathname)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Assistent öffnen"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-hidden={heroVisible ? true : undefined}
        tabIndex={heroVisible ? -1 : 0}
        className={`fixed left-1/2 -translate-x-1/2 z-40 inline-flex items-center gap-2 pl-2 pr-4 py-1.5 bg-obsidian-950 text-titanium-50 rounded-full shadow-2xl border border-titanium-800 hover:border-titanium-600 hover:-translate-y-0.5 transition-all duration-200 motion-reduce:transition-none ${
          heroVisible
            ? 'opacity-0 translate-y-2 pointer-events-none'
            : 'opacity-100 translate-y-0'
        }`}
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          boxShadow: '0 10px 40px -10px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-obsidian-900 ring-1 ring-titanium-700">
          <Sparkles className="h-4 w-4 text-titanium-100" />
        </span>
        <span className="text-sm font-medium tracking-tight">Assistent</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="assistent-sheet-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        >
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-obsidian-950/70 backdrop-blur-sm"
          />
          <div
            className="relative w-full sm:max-w-md mx-0 sm:mx-4 bg-obsidian-900 border border-titanium-800 shadow-2xl"
            style={{
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              boxShadow: '0 24px 80px -20px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04)',
            }}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-obsidian-950 ring-1 ring-titanium-700">
                  <Sparkles className="h-4 w-4 text-violet-300" />
                </span>
                <span
                  id="assistent-sheet-title"
                  className="text-sm font-semibold tracking-tight text-titanium-50"
                >
                  Assistent
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Schließen"
                className="inline-flex h-8 w-8 items-center justify-center text-titanium-400 hover:text-titanium-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 pb-5">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500 mb-3">
                <span className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-violet-400 opacity-75 animate-ping" />
                  <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-violet-400" />
                </span>
                ai runtime · initialisiert
              </div>
              <p className="text-titanium-200 text-base leading-relaxed">
                AI Runtime wird initialisiert. Für die volle Konversation
                starte einen Audit-Scan — die Runtime übernimmt ab dort.
              </p>

              <Link
                to="/audit?source=assistant-sheet"
                onClick={() => setOpen(false)}
                className="group mt-5 inline-flex w-full items-center justify-between gap-2 px-4 py-3 bg-cyan-400 text-obsidian-950 hover:bg-cyan-300 font-semibold text-sm tracking-tight transition-colors"
              >
                Audit starten
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
