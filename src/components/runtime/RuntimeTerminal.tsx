import { RuntimeCard } from './RuntimeCard';
import { RuntimeFeed } from './RuntimeFeed';
import type { RuntimeStatus } from './RuntimeStatusPill';

// RuntimeTerminal — opinionated composite of RuntimeCard + RuntimeFeed
// styled like a developer terminal. macOS-traffic-light header, mono
// font throughout, optional status pill + counter footer.

export interface RuntimeTerminalProps {
  /** Header title, e.g. "runtime.log". */
  title?: string;
  /** Right-side status pill in the header. */
  status?: RuntimeStatus;
  /** Pill label (defaults to status). */
  statusLabel?: string;
  /** Max height of the feed area. */
  feedMaxHeight?: number;
  /** Auto-scroll to bottom on mutation. */
  autoScroll?: boolean;
  /** Footer slot. Common pattern: "X / Y events · chain sealed". */
  footer?: React.ReactNode;
  /** Show macOS traffic light dots. Default true. */
  trafficLights?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function RuntimeTerminal({
  title = 'runtime.log',
  status,
  statusLabel,
  feedMaxHeight = 320,
  autoScroll = true,
  footer,
  trafficLights = true,
  className,
  children,
}: RuntimeTerminalProps) {
  return (
    <RuntimeCard
      title={title}
      status={status}
      statusLabel={statusLabel}
      trafficLights={trafficLights}
      padding="none"
      className={className}
      reveal={false}
    >
      <RuntimeFeed maxHeight={feedMaxHeight} autoScroll={autoScroll}>
        {children}
      </RuntimeFeed>
      {footer && (
        <div className="px-3 py-2 border-t border-titanium-900 bg-obsidian-900 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
          {footer}
        </div>
      )}
    </RuntimeCard>
  );
}
