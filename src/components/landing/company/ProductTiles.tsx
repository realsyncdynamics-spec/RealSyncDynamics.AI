import { useCallback, useRef, useState } from 'react';
import { COMPANY_PRODUCTS, type CompanyProduct } from './companyProducts';
import { ProductModal } from './ProductModal';

/** Produkt-Tafeln; Klick öffnet das Modal, Schließen gibt den Fokus an die Tafel zurück. */
export function ProductTiles({ products = COMPANY_PRODUCTS }: { products?: readonly CompanyProduct[] }) {
  const [open, setOpen] = useState<CompanyProduct | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    setOpen(null);
    // Nach dem Unmount des Dialogs fokussieren.
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  return (
    <section id="produkte" aria-labelledby="produkte-title" className="mx-auto max-w-6xl px-4 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-titanium-400">Produkte</p>
      <h2 id="produkte-title" className="mt-2 font-display text-3xl font-bold text-titanium-50">
        Funktionen entdecken
      </h2>
      <ul className="mt-8 grid gap-4 md:grid-cols-3">
        {products.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              data-testid={`product-tile-${p.id}`}
              aria-haspopup="dialog"
              onClick={(e) => {
                triggerRef.current = e.currentTarget;
                setOpen(p);
              }}
              className="flex h-full w-full flex-col items-start gap-3 rounded-none border border-obsidian-600 bg-obsidian-900 p-6 text-left hover:border-security-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-security-400 motion-safe:transition-colors"
            >
              <span className="font-mono text-xs uppercase tracking-widest text-titanium-400">{p.statusLabel}</span>
              <span className="font-display text-lg font-semibold text-titanium-50">{p.name}</span>
              <span className="text-sm text-titanium-300">{p.tabs[0]?.pages[0]?.body}</span>
            </button>
          </li>
        ))}
      </ul>
      {open && <ProductModal product={open} onClose={close} />}
    </section>
  );
}
