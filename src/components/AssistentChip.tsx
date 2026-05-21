import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mic, X } from 'lucide-react';

// AssistentChip — persistent floating entry to the AI Runtime.
//
// Phase 1 (Hostinger Pattern, second-cycle):
//   - Position: BOTTOM-CENTER, fixed, respects iOS safe-area-inset-bottom.
//   - Look: schwarzer Mic-Circle (obsidian-900) + "Assistent"-Label,
//     glassmorphism (backdrop-blur + leichter Border).
//   - Click: oeffnet ein LEICHTGEWICHTIGES Placeholder-Sheet — kein echter
//     Chat, kein AgentWidget-Mount, kein sendChatAnon-Call. Nur statischer
//     Text "AI Runtime wird initialisiert" + CTA-Link auf /audit.
//   - Routes: auto-hide auf /dashboard, /governance/*, /checkout/*.
//   - Hero-CTA-Coexistence: wenn ein [data-hero-cta] sichtbar ist, blendet
//     sich der Chip aus (Intersection Observer).
//
// Wieso "AI Runtime wird initialisiert" statt "Hi, wie kann ich helfen?":
//   - Das System-Feeling: "etwas laeuft bereits", kein Support-Widget
//   - Keine falschen Erwartungen — der echte anon-Chat-Pfad ist durch den
//     Security-Gate-PR geblockt, bis das Audit-Logging + die durable
//     Rate-Limit-Persistenz drin sind
//   - Klares CTA fuer den naechsten Schritt: /audit

const HIDDEN_PREFIXES = ['/dashboard', '/checkout', '/audit'];

function shouldHide(pathname: string): boolean {
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  if (pathname !== '/governance' && pathname.startsWith('/governance/')) return true;
  return false;
}

export function AssistentChip() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Observe [data-hero-cta] visibility — hide chip while hero CTA is on screen
  // to avoid attention-competition.
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

  // Escape closes the modal; focus moves into the dialog when it opens.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    queueMicrotask(() => dialogRef.current?.focus());
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (shouldHide(pathname)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Assistent öffnen"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-hidden={heroVisible ? true : undefined}
        tabIndex={heroVisible ? -1 : 0}
        className={`fixed left-1/2 -translate-x-1/2 z-40 inline-flex items-center gap-2 pl-2 pr-4 py-1.5 bg-obsidian-950/85 text-titanium-50 rounded-full shadow-2xl border border-titanium-800 backdrop-blur-md hover:border-titanium-600 hover:scale-[1.03] hover:shadow-[0_12px_40px_-10px_rgba(168,85,247,0.35)] transition-all duration-200 motion-reduce:transition-none motion-reduce:hover:scale-100 ${
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
          <Mic className="h-4 w-4 text-titanium-100" />
        </span>
        <span className="text-sm font-medium tracking-tight">Assistent</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-obsidian-950/60 backdrop-blur-sm motion-reduce:backdrop-blur-none"
          onClick={() => setOpen(false)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Assistent — AI Runtime"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:w-[420px] bg-obsidian-900 border border-titanium-800 shadow-2xl p-5 sm:p-6 m-0 sm:m-4 rounded-t-2xl sm:rounded-2xl"
            style={{
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)',
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Schließen"
              className="absolute right-3 top-3 p-1.5 text-titanium-400 hover:text-titanium-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <span className="inline-flex w-10 h-10 items-center justify-center rounded-full bg-obsidian-950 ring-1 ring-titanium-700">
                <Mic className="h-5 w-5 text-titanium-100" />
              </span>
              <div>
                <p className="font-display text-base font-semibold text-titanium-50 leading-tight">
                  Assistent
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-titanium-500 mt-0.5">
                  AI Runtime · Public Mode
                </p>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-titanium-200 mb-2">
              AI Runtime wird initialisiert.
            </p>
            <p className="text-[12px] leading-relaxed text-titanium-400 mb-5">
              Der öffentliche Assistent-Mode ist gerade in Vorbereitung (Audit-Logging,
              Rate-Limit, Read-only-Tools). Bis dahin starten Sie direkt mit einem
              kostenlosen DSGVO-Scan.
            </p>

            <div className="flex flex-col gap-2">
              <Link
                to="/audit?source=assistant-chip"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-400 text-obsidian-950 font-semibold text-sm rounded-md hover:bg-cyan-300 transition-colors"
              >
                Audit starten
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[12px] text-titanium-500 hover:text-titanium-300 transition-colors py-1"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
