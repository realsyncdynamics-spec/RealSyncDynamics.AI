import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import type { CompanyProduct } from './companyProducts';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ProductModalProps {
  product: CompanyProduct;
  onClose: () => void;
}

/**
 * Produkt-Modal: 3 Tabs, Seiten-Pager.
 * Tastatur: Esc schließt · ←/→ in der Tab-Leiste wechselt den Tab, sonst die Seite.
 * Fokus-Trap im Dialog; beim Schließen springt der Fokus zum Auslöser zurück
 * (der Aufrufer merkt sich den Auslöser, siehe ProductTiles).
 */
export function ProductModal({ product, onClose }: ProductModalProps) {
  const [tabIndex, setTabIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const titleId = useId();
  const panelId = useId();

  const tab = product.tabs[tabIndex];
  const pageCount = tab.pages.length;
  const page = tab.pages[Math.min(pageIndex, pageCount - 1)];

  const selectTab = useCallback(
    (next: number, focus = false) => {
      const count = product.tabs.length;
      const idx = (next + count) % count;
      setTabIndex(idx);
      setPageIndex(0);
      if (focus) tabRefs.current[idx]?.focus();
    },
    [product.tabs.length],
  );

  const goPage = useCallback(
    (delta: number) => setPageIndex((p) => Math.max(0, Math.min(pageCount - 1, p + delta))),
    [pageCount],
  );

  // Initialer Fokus + Scroll-Sperre
  useEffect(() => {
    tabRefs.current[0]?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Esc auf Dokument-Ebene: schließt auch, falls der Fokus den Dialog verlassen hat.
  useEffect(() => {
    function onDocKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onDocKey);
    return () => document.removeEventListener('keydown', onDocKey);
  }, [onClose]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Tab') {
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select')) return;
    e.preventDefault();
    const delta = e.key === 'ArrowRight' ? 1 : -1;
    if (target.getAttribute('role') === 'tab') selectTab(tabIndex + delta, true);
    else goPage(delta);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/80 px-4" onMouseDown={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="w-full max-w-2xl rounded-none border border-obsidian-600 bg-obsidian-900 text-titanium-100"
      >
        <div className="flex items-start justify-between gap-4 border-b border-obsidian-600 px-6 py-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-titanium-400">
              Status · {product.statusLabel}
            </p>
            <h2 id={titleId} className="mt-1 font-display text-xl font-bold text-titanium-50">
              {product.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dialog schließen"
            className="rounded-none border border-obsidian-600 px-3 py-1 font-mono text-xs text-titanium-200 hover:border-security-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-security-400"
          >
            ESC
          </button>
        </div>

        <div role="tablist" aria-label={`${product.name} – Bereiche`} className="flex border-b border-obsidian-600">
          {product.tabs.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${panelId}-tab-${t.id}`}
              aria-selected={i === tabIndex}
              aria-controls={panelId}
              tabIndex={i === tabIndex ? 0 : -1}
              onClick={() => selectTab(i)}
              className={`flex-1 rounded-none px-4 py-3 font-mono text-xs uppercase tracking-widest focus-visible:outline focus-visible:outline-2 focus-visible:outline-security-400 ${
                i === tabIndex ? 'border-b-2 border-security-400 text-titanium-50' : 'text-titanium-400 hover:text-titanium-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={`${panelId}-tab-${tab.id}`}
          tabIndex={0}
          className="min-h-[10rem] px-6 py-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-security-400"
        >
          <h3 className="font-display text-lg font-semibold text-titanium-50">{page.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-titanium-300">{page.body}</p>
          {tab.id === 'zugang' && product.route && (
            <Link
              to={product.route}
              className="mt-4 inline-block rounded-none border border-security-400 px-4 py-2 text-sm font-semibold text-titanium-50 hover:bg-security-400/10"
            >
              {product.ctaLabel}
            </Link>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-obsidian-600 px-6 py-3">
          <button
            type="button"
            onClick={() => goPage(-1)}
            aria-disabled={pageIndex === 0}
            aria-label="Vorherige Seite"
            className="rounded-none px-3 py-1 font-mono text-xs text-titanium-200 aria-disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-security-400"
          >
            ←
          </button>
          <span className="font-mono text-xs text-titanium-400" aria-live="polite">
            Seite {Math.min(pageIndex, pageCount - 1) + 1} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => goPage(1)}
            aria-disabled={pageIndex >= pageCount - 1}
            aria-label="Nächste Seite"
            className="rounded-none px-3 py-1 font-mono text-xs text-titanium-200 aria-disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-security-400"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
