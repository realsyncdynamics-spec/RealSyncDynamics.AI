import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { AssistentQuickChatModal } from './AssistentQuickChatModal';

// AssistentChip — persistent floating entry to the AI assistant.
// Bottom-center on every public page. Opens AssistentQuickChatModal,
// which talks to the ai-gateway Edge Function directly (PR #233 + #240)
// with client-side rate-limit + abuse guards. The chip is the single
// public-facing surface for ad-hoc "ask the AI a quick question" — the
// full audit flow with URL + email collection still lives on /audit.
//
// Hide-while-hero-CTA-visible: on short mobile viewports the centered
// chip was overlapping the hero's "Run Scan" CTA (cyan submit button
// at the bottom of the URL form). When any element with [data-hero-cta]
// is in the viewport, the chip hides so it doesn't compete with — or
// physically cover — the primary conversion mechanism. Once the user
// scrolls past the hero, the chip fades back in.

const HIDDEN_PREFIXES = [
  '/dashboard',
  '/checkout',
  '/audit',
];

function shouldHide(pathname: string): boolean {
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  // /governance is the public OS surface — chip shows there.
  // /governance/* (admin, keys, webhooks, mappings, events, assets, …)
  // is the auth-gated tenant dashboard which already mounts its own
  // scoped AgentWidget — chip hides to avoid two competing assistant
  // entries on the same page.
  if (pathname !== '/governance' && pathname.startsWith('/governance/')) return true;
  return false;
}

export function AssistentChip() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);

  // Observe any [data-hero-cta] elements. While at least one is in
  // the viewport, hide the chip. The observer is re-created on path
  // change so it picks up the per-route hero (Landing, AuditLanding
  // don't both have one; the absence of [data-hero-cta] means the
  // chip is always visible).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const targets = Array.from(document.querySelectorAll('[data-hero-cta]'));
    if (targets.length === 0) {
      setHeroVisible(false);
      return;
    }
    const visible = new Set<Element>();
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target);
        else visible.delete(e.target);
      }
      setHeroVisible(visible.size > 0);
    }, { threshold: 0.15 });
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
        aria-hidden={heroVisible ? true : undefined}
        tabIndex={heroVisible ? -1 : 0}
        className={`fixed left-1/2 -translate-x-1/2 bottom-4 z-40 inline-flex items-center gap-2 pl-4 pr-2 py-2 bg-obsidian-950 text-titanium-50 rounded-full shadow-2xl border border-amber-500/40 hover:border-amber-400/80 transition-all duration-200 motion-reduce:transition-none ${
          heroVisible
            ? 'opacity-0 translate-y-2 pointer-events-none'
            : 'opacity-100 translate-y-0'
        }`}
        style={{ boxShadow: '0 10px 40px -10px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,158,11,0.18)' }}
      >
        <span className="text-sm font-medium tracking-tight">Assistent</span>
        <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-amber-400 text-obsidian-950">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
      </button>
      <AssistentQuickChatModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
