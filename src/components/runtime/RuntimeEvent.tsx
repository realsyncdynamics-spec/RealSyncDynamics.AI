import { motion, useReducedMotion } from 'motion/react';

// RuntimeEvent — single line in a runtime log.
// Format: <ts>  <kind-short>  <kind-label> · <text>  → <target>
// Mono everywhere; the kind colour is the only visual differentiator.

export type RuntimeEventKind =
  | 'scan'
  | 'drift'
  | 'ai'
  | 'consent'
  | 'evidence'
  | 'incident'
  | 'agent';

export interface RuntimeEventProps {
  /** Time label, e.g. "T+02s" or "12:42:08". */
  ts: string;
  kind: RuntimeEventKind;
  /** Two-character short tag in the kind column, e.g. "SC". */
  short?: string;
  /** Main one-line message. */
  text: string;
  /** Optional target host / id. */
  target?: string;
  /** Fade-in slide on first render. Disabled via reduced-motion. */
  reveal?: boolean;
}

export const RUNTIME_EVENT_COLOR: Record<RuntimeEventKind, string> = {
  scan:     'text-cyan-300',
  drift:    'text-amber-300',
  ai:       'text-violet-300',
  consent:  'text-yellow-300',
  evidence: 'text-emerald-300',
  incident: 'text-red-300',
  agent:    'text-titanium-100',
};

const DEFAULT_SHORT: Record<RuntimeEventKind, string> = {
  scan: 'SC', drift: 'DR', ai: 'AI', consent: 'CN',
  evidence: 'EV', incident: 'IN', agent: 'AG',
};

export function RuntimeEvent({
  ts,
  kind,
  short,
  text,
  target,
  reveal = true,
}: RuntimeEventProps) {
  const reduce = useReducedMotion();
  const colour = RUNTIME_EVENT_COLOR[kind];
  const tag = short ?? DEFAULT_SHORT[kind];

  return (
    <motion.div
      initial={!reveal || reduce ? false : { opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-3 py-0.5 border-b border-titanium-900/40 last:border-b-0 font-mono text-[11px] leading-relaxed"
      role="listitem"
    >
      <span className="text-titanium-600 shrink-0 tabular-nums w-12">{ts}</span>
      <span className={`shrink-0 font-bold w-6 ${colour}`}>{tag}</span>
      <span className="text-titanium-200 min-w-0 flex-1">
        <span className={`mr-1 ${colour}`}>{kind}</span>
        · {text}
        {target && <span className="ml-1.5 text-titanium-500">→ {target}</span>}
      </span>
    </motion.div>
  );
}
