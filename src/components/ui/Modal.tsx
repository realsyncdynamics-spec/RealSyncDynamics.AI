import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Modal — Hero-only-Pivot Overlay-Container.
 *
 * Klickbares Overlay auf die ganze Seite, das beliebige Inhalte hosten
 * kann. Drei Verhalten:
 *   - Escape-Key schließt
 *   - Klick auf den Backdrop (außerhalb der Karte) schließt
 *   - Body-Scroll wird gelockt während offen, damit der Content auf der
 *     Hero-only-Seite hinten nicht versehentlich gescrollt wird
 *
 * Bewusst KEINE Library-Dependency — pure React-State, Portal-frei
 * (rendert via fixed positioning), keine framer-motion in Phase 1.
 */
type Props = {
  /** Visibility — controlled by parent state */
  open: boolean;
  /** Callback when the user requests close (escape, backdrop, X-button) */
  onClose: () => void;
  /** Modal title shown in the header */
  title: string;
  /** Optional secondary line below the title (eyebrow) */
  eyebrow?: string;
  /** Modal body */
  children: React.ReactNode;
  /** Optional max-width override. Default 'max-w-3xl' */
  size?: 'sm' | 'md' | 'lg' | 'xl';
};

const SIZE: Record<NonNullable<Props['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

export function Modal({ open, onClose, title, eyebrow, children, size = 'lg' }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Body scroll lock while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Auto-focus the dialog so screen-readers + keyboards see it as the active
  // landmark. We don't trap focus rigorously yet — children are link/button-
  // light so tab order stays sensible. Add a real trap (focus-lock) when the
  // first modal carries form inputs.
  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-8"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      {/* Card */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full ${SIZE[size]} max-h-[88vh] overflow-y-auto bg-obsidian-950 border border-silver-700 rounded-none shadow-2xl outline-none`}
      >
        <header className="sticky top-0 z-10 bg-obsidian-950 border-b border-silver-700 px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold-400 mb-1">
                {eyebrow}
              </div>
            )}
            <h2 id="modal-title" className="font-display font-bold text-titanium-50 text-xl tracking-tight">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="shrink-0 p-1.5 text-silver-400 hover:text-titanium-50 hover:bg-obsidian-900 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="px-6 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}
