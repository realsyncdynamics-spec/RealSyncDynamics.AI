import { Logo } from "@/components/brand/logo";
import { AppLink } from "@/components/ui/app-link";
import { brand, footerColumns } from "@/data/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-panel">
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 lg:px-12">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <div className="xl:col-span-1">
            <Logo />
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{brand.productOf}</p>
            <p className="mt-4 max-w-[16rem] text-sm leading-relaxed text-muted">{brand.tagline}</p>
          </div>
          {footerColumns.map((col) => (
            <div key={col.title}>
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">{col.title}</p>
              <ul className="space-y-2">
                {col.items.map((it) => (
                  <li key={it.href + it.label}>
                    <AppLink to={it.href} className="text-sm text-muted hover:text-fg">
                      {it.label}
                    </AppLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-border pt-6 text-xs text-subtle md:flex-row md:items-center md:justify-between">
          <p>
            {brand.product} · {brand.company} · {brand.domain}
          </p>
          <p>Beispieldaten und Architekturansichten sind als Demo gekennzeichnet. Keine unbelegten Zertifikate.</p>
        </div>
      </div>
    </footer>
  );
}
