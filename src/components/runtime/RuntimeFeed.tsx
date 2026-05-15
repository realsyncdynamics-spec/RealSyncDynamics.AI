import { useEffect, useRef } from 'react';

// RuntimeFeed — vertical scrollable container for a stream of events.
// Auto-scrolls to the latest item on every child mutation. Children are
// rendered as `role="list"` so screen readers grok the stream semantics.

export interface RuntimeFeedProps {
  /** Max height. Default 320 px on small screens, fluid on lg. */
  maxHeight?: number | string;
  /** Auto-scroll to bottom on mutation. Default true. */
  autoScroll?: boolean;
  /** Padding for the body. */
  padding?: 'sm' | 'md';
  className?: string;
  children: React.ReactNode;
}

export function RuntimeFeed({
  maxHeight = 320,
  autoScroll = true,
  padding = 'sm',
  className,
  children,
}: RuntimeFeedProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoScroll) return;
    const el = ref.current;
    if (!el) return;
    // Defer to next frame so newly mounted children are measured.
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  });

  const padCls = padding === 'md' ? 'p-4' : 'p-3';
  const style = typeof maxHeight === 'number' ? { maxHeight: `${maxHeight}px` } : { maxHeight };

  return (
    <div
      ref={ref}
      role="list"
      aria-live="polite"
      style={style}
      className={[
        'overflow-y-auto bg-obsidian-950',
        padCls,
        className ?? '',
      ].join(' ')}
    >
      {children}
    </div>
  );
}
