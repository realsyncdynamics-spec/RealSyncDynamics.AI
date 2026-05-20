import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

// AssistentChip — persistent floating entry to the AI assistant.
//
// Phase 1 (Hostinger Pattern, Fix):
//   - Reiner Link auf /audit?source=assistant-chip — kein Modal, kein
//     onClick-Handler, kein AgentWidget-Embed.
//   - Position: BOTTOM-CENTER (left-1/2 -translate-x-1/2).
//   - Look: schwarzer Mic-/Sparkle-Circle (Sparkle-Icon im obsidian-900-
//     Kreis) + "Assistent"-Label.
//   - Routes: persistent ueber alle public Routes; blendet sich aus auf
//     auth-gated Surfaces (/dashboard, /governance/*) und auf den Routen,
//     die einen eigenen Eingangstrichter haben (/audit, /checkout).
//   - Hero-CTA-Coexistence: wenn ein [data-hero-cta] sichtbar ist,
//     blendet sich der Chip aus (Intersection Observer), damit er nicht
//     mit dem Primary-CTA konkurriert.
//
// Hintergrund — warum kein AgentWidget mehr:
//   Der vorherige Phase-1-Commit (#368) hat AgentWidget mode="anon" mit
//   dem Chip-Click verbunden. Das war zu frueh: anon-AgentWidget gehoert
//   in Phase 2 mit eigenem Rate-Limit + Audit-Logging. In Phase 1 ist
//   der Chip ein reiner Navigations-Hint auf den Audit-Funnel.

const HIDDEN_PREFIXES = [
  '/dashboard',
  '/checkout',
  '/audit',
];

function shouldHide(pathname: string): boolean {
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  // /governance is the public OS surface — chip shows there.
  // /governance/* (admin, keys, webhooks, mappings, events, assets, ...)
  // is the auth-gated tenant dashboard which already mounts its own
  // scoped AgentWidget — chip hides to avoid two competing assistant
  // entries on the same page.
  if (pathname !== '/governance' && pathname.startsWith('/governance/')) return true;
  return false;
}

export function AssistentChip() {
  const { pathname } = useLocation();
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
    <Link
      to="/audit?source=assistant-chip"
      aria-label="Assistent öffnen"
      aria-hidden={heroVisible ? true : undefined}
      tabIndex={heroVisible ? -1 : 0}
      // safe-area-inset-bottom: respect iOS home-indicator. Tailwind
      // `pb-[env(safe-area-inset-bottom)]` not used to keep the button
      // height fixed; instead we pad the wrapper.
      className={`fixed left-1/2 -translate-x-1/2 z-40 inline-flex items-center gap-2 pl-2 pr-4 py-1.5 bg-obsidian-950 text-titanium-50 rounded-full shadow-2xl border border-titanium-800 hover:border-titanium-600 transition-all duration-200 motion-reduce:transition-none ${
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
    </Link>
  );
}
