import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Mic } from 'lucide-react';
import { AgentWidget } from '../features/governance/AgentWidget/AgentWidget';

// AssistentChip — persistent floating entry to the AI Runtime.
//
// Hostinger-Pattern Phase 2: the chip now opens the real public anon
// AgentWidget (rate-limited, audit-logged, read-only tools) instead of
// the placeholder modal. The Security-Gate prerequisites are all in
// main: anon_chat_runs audit table (#393), tier-discipline-enforcement
// helper, subject_ref HMAC pipeline. The Edge Function side
// (governance-agent op:'chat_anon') is also already in main.
//
// Visual model unchanged from Phase 1:
//   - Position: BOTTOM-CENTER, fixed, respects iOS safe-area-inset-bottom.
//   - Look: schwarzer Mic-Circle + "Assistent"-Label, glassmorphism.
//   - Routes: auto-hide on /dashboard, /app/*, /checkout/* and
//     /audit — those surfaces already have their own assistant context
//     (tenant widget or audit-copilot panel).
//   - Hero-CTA-Coexistence: while a [data-hero-cta] is intersecting,
//     the chip fades out so it doesn't compete with the primary CTA.

const HIDDEN_PREFIXES = ['/dashboard', '/app', '/checkout', '/audit'];

function shouldHide(pathname: string): boolean {
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  // Legacy: hide on /governance/* subroutes (but not /governance itself) for backwards compatibility
  if (pathname !== '/governance' && pathname.startsWith('/governance/')) return true;
  return false;
}

export function AssistentChip() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);

  // Observe [data-hero-cta] visibility — hide chip while hero CTA is on
  // screen to avoid attention-competition.
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
        className={`fixed left-1/2 -translate-x-1/2 z-40 inline-flex items-center gap-2 pl-2 pr-4 py-1.5 rounded-full backdrop-blur-md transition-all duration-200 motion-reduce:transition-none motion-reduce:hover:scale-100 hover:scale-[1.03] ${
          heroVisible
            ? 'opacity-0 translate-y-2 pointer-events-none'
            : 'opacity-100 translate-y-0'
        } ${
          open ? 'opacity-0 pointer-events-none' : ''
        }`}
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          backgroundColor: 'rgba(10, 11, 14, 0.92)',
          color: '#e8ddc8',
          border: '1px solid rgba(228, 207, 162, 0.35)',
          boxShadow: '0 10px 40px -10px rgba(0,0,0,0.7), 0 0 0 1px rgba(228,207,162,0.06)',
        }}
      >
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-full"
          style={{
            backgroundColor: '#12141a',
            boxShadow: 'inset 0 0 0 1px rgba(228, 207, 162, 0.28)',
          }}
        >
          <Mic className="h-4 w-4" style={{ color: '#e4cfa2' }} />
        </span>
        <span className="text-sm font-medium tracking-tight" style={{ color: '#e8ddc8' }}>
          Assistent
        </span>
      </button>

      <AgentWidget mode="anon" open={open} onClose={() => setOpen(false)} />
    </>
  );
}
