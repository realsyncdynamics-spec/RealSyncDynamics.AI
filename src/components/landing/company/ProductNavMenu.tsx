import { forwardRef, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { COMPANY_PRODUCTS, type CompanyProductId } from './companyProducts';

export interface ProductNavMenuProps {
  /** Aktiver Nav-Punkt (Scroll-Position). */
  active: boolean;
  /** Produkt des aktiven Abschnitts → Unterstrich in dessen Farbe; sonst neutral. */
  activeProduct: CompanyProductId | null;
  /** Governance: sanft zum Abschnitt #p-os scrollen (wie die Hero-Tafel). */
  onGo: (e: ReactMouseEvent<HTMLAnchorElement>, id: string) => void;
}

/**
 * Hauptnavigation „Produkte“ als Disclosure-Menü (Button + Liste echter Links).
 * Die Einträge sind teil- und kopierbar: `#p-os`, `#voice-agent`, `#sites`.
 * Voice/Builder navigieren per Router auf den Hash; CompanyLanding öffnet daraus
 * den Dialog – so funktionieren Direktaufruf und Browser-Zurück/Vorwärts gleich.
 * Esc schließt und gibt den Fokus an den Button zurück; Klick außerhalb und
 * Tab aus dem Menü heraus schließen ebenfalls. Der Unterstrich sitzt am Label
 * (`.navdd-lbl`), damit er im Flex-Button nicht unter das ▾ läuft.
 */
export const ProductNavMenu = forwardRef<HTMLButtonElement, ProductNavMenuProps>(function ProductNavMenu(
  { active, activeProduct, onGo },
  buttonRef,
) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerButton = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const close = (focusButton: boolean) => {
    setOpen(false);
    if (focusButton) innerButton.current?.focus();
  };

  return (
    <div
      className="navdd"
      ref={wrapRef}
      data-product={activeProduct ?? undefined}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          close(true);
        }
      }}
      onBlur={(e) => {
        if (open && !wrapRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={(el) => {
          innerButton.current = el;
          if (typeof buttonRef === 'function') buttonRef(el);
          else if (buttonRef) buttonRef.current = el;
        }}
        type="button"
        className={`navlink navdd-btn${active ? ' on' : ''}`}
        aria-expanded={open}
        aria-controls="nav-produkte-menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="navdd-lbl">Produkte</span>
        <span className="caret" aria-hidden="true">
          ▾
        </span>
      </button>
      <ul id="nav-produkte-menu" className="navdd-menu" hidden={!open}>
        {COMPANY_PRODUCTS.map((p) => {
          const current = activeProduct === p.id ? 'location' : undefined;
          const inner = (
            <>
              <i className="pdot" aria-hidden="true" />
              <span>{p.name}</span>
              <small>{p.colorName}</small>
            </>
          );
          return (
            <li key={p.id} data-product={p.id}>
              {p.id === 'governance' ? (
                <a
                  href={`#${p.anchor}`}
                  aria-current={current}
                  onClick={(e) => {
                    close(false);
                    onGo(e, p.anchor);
                  }}
                >
                  {inner}
                </a>
              ) : (
                <Link to={{ hash: `#${p.anchor}` }} aria-current={current} onClick={() => close(false)}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
});
