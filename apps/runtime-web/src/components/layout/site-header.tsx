import { useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { brand, nav, type MegaColumn } from "@/data/site";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpen(null);
    setMobile(false);
  }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(null);
        setMobile(false);
      }
    }
    function onClick(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  return (
    <header ref={barRef} className="sticky top-0 z-50 border-b border-border bg-bg/85 backdrop-blur-md">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg"
      >
        Zum Inhalt
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5 md:h-[4.25rem] md:px-8 lg:px-12">
        <Logo />
        <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Hauptnavigation">
          {nav.map((item) => (
            <div
              key={item.label}
              className="relative"
              onMouseEnter={() => item.mega && setOpen(item.label)}
              onMouseLeave={() => setOpen((v) => (v === item.label ? null : v))}
            >
              <AppLink
                to={item.href}
                className={cn(
                  "inline-flex h-10 items-center px-3 text-[13px] text-muted transition-colors duration-150 hover:text-fg",
                  (pathname === item.href || pathname.startsWith(item.href + "/")) && "text-fg",
                )}
              >
                {item.label}
              </AppLink>
            </div>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <Button variant="ghost" size="sm" asChild>
            <AppLink to="/signin">Anmelden</AppLink>
          </Button>
          <Button variant="primary" size="sm" asChild>
            <AppLink to="/pricing">Richtpreise</AppLink>
          </Button>
        </div>
        <button
          type="button"
          className="ml-auto inline-flex size-11 items-center justify-center rounded-sm text-fg lg:hidden"
          aria-label={mobile ? "Menü schließen" : "Menü öffnen"}
          aria-expanded={mobile}
          onClick={() => setMobile((v) => !v)}
        >
          {mobile ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {nav.map((item) =>
        item.mega ? (
          <MegaPanel
            key={item.label}
            columns={item.mega}
            open={open === item.label}
            onClose={() => setOpen(null)}
          />
        ) : null,
      )}

      {mobile ? <MobileNav onClose={() => setMobile(false)} /> : null}
    </header>
  );
}

function MegaPanel({
  columns,
  open,
  onClose,
}: {
  columns: MegaColumn[];
  open: boolean;
  onClose: () => void;
}) {
  const id = useId();
  if (!open) return null;
  return (
    <div
      id={id}
      className="absolute inset-x-0 top-full hidden border-b border-border bg-surface lg:block"
      onMouseLeave={onClose}
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-8 py-10 lg:grid-cols-3 lg:px-12">
        {columns.map((col) => (
          <div key={col.title}>
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">{col.title}</p>
            <ul className="space-y-1">
              {col.items.map((it) => (
                <li key={it.href + it.label}>
                  <AppLink to={it.href} className="block rounded-md px-2 py-2 hover:bg-elevated" onClick={onClose}>
                    <span className="block text-sm text-fg">{it.label}</span>
                    {it.description ? (
                      <span className="mt-0.5 block text-xs leading-snug text-muted">{it.description}</span>
                    ) : null}
                  </AppLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileNav({ onClose }: { onClose: () => void }) {
  return (
    <div className="border-t border-border bg-surface lg:hidden">
      <p className="px-5 pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">{brand.productOf}</p>
      <nav className="mx-auto flex max-h-[80dvh] max-w-6xl flex-col gap-1 overflow-y-auto px-5 py-4">
        {nav.map((item) => (
          <div key={item.label} className="py-1">
            <AppLink to={item.href} className="block py-3 text-sm text-fg" onClick={onClose}>
              {item.label}
            </AppLink>
            {item.mega
              ? item.mega.flatMap((c) => c.items).map((it) => (
                  <AppLink
                    key={it.href + it.label}
                    to={it.href}
                    className="block py-2 pl-4 text-sm text-muted"
                    onClick={onClose}
                  >
                    {it.label}
                  </AppLink>
                ))
              : null}
          </div>
        ))}
        <div className="mt-4 flex flex-col gap-2 pb-4">
          <Button variant="outline" asChild>
            <AppLink to="/signin" onClick={onClose}>
              Anmelden
            </AppLink>
          </Button>
          <Button asChild>
            <AppLink to="/pricing" onClick={onClose}>
              Richtpreise ansehen
            </AppLink>
          </Button>
        </div>
      </nav>
    </div>
  );
}
