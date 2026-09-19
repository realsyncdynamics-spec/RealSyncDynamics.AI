import { Suspense, type ReactNode } from 'react';

export type SuspenseVariant = 'page' | 'panel' | 'inline';

type Props = {
  children: ReactNode;
  /** Screen-reader / visible label. Default: "Lade …" */
  label?: string;
  variant?: SuspenseVariant;
};

const PAGE_CLASS =
  'min-h-screen flex items-center justify-center bg-obsidian-950 text-titanium-400 text-sm';
const PANEL_CLASS =
  'grid min-h-[40vh] place-items-center bg-obsidian-950 text-titanium-400 text-sm';
const INLINE_CLASS = 'text-titanium-500 text-xs';

export function SuspenseFallback({
  label = 'Lade …',
  variant = 'page',
}: {
  label?: string;
  variant?: SuspenseVariant;
}) {
  const cls = variant === 'panel' ? PANEL_CLASS : variant === 'inline' ? INLINE_CLASS : PAGE_CLASS;
  return (
    <div className={cls} role="status" aria-live="polite" data-suspense-fallback={variant}>
      {label}
    </div>
  );
}

/**
 * Eine Grenze für React.lazy-Routen und schwere Widgets.
 * App.tsx wrappt `Routes` bereits in Suspense — diese Komponente ist der
 * benannte Ersatz für das lokale `LazyFallback` und für verschachtelte Gates.
 */
export function SuspenseBoundary({
  children,
  label = 'Lade …',
  variant = 'page',
}: Props) {
  return (
    <Suspense fallback={<SuspenseFallback label={label} variant={variant} />}>
      {children}
    </Suspense>
  );
}
