import { motion, useReducedMotion } from 'motion/react';
import { ShieldCheck } from 'lucide-react';

// RuntimeEvidenceCard — single evidence-chain item.
// Mono everywhere, sealed/pending status, truncated hash with a copy
// affordance (copy itself is handled by the consumer if needed).

export type EvidenceStatus = 'sealed' | 'pending' | 'rejected';

export interface RuntimeEvidenceCardProps {
  /** Full hash, e.g. "sha256:9f2c…b81e3a". Will be truncated for display. */
  hash: string;
  /** Timestamp, ISO or "T+02s" runtime-relative. */
  ts: string;
  /** Kind label, e.g. "anchor", "audit-bundle". */
  kind: string;
  /** Optional target / subject. */
  target?: string;
  /** Sealed (default) / pending / rejected. */
  status?: EvidenceStatus;
  className?: string;
}

const STATUS_CLASS: Record<EvidenceStatus, { dot: string; text: string }> = {
  sealed:   { dot: 'bg-emerald-400', text: 'text-emerald-400' },
  pending:  { dot: 'bg-amber-400',   text: 'text-amber-400' },
  rejected: { dot: 'bg-red-400',     text: 'text-red-400' },
};

function truncateHash(h: string): string {
  if (h.length <= 22) return h;
  return `${h.slice(0, 14)}…${h.slice(-6)}`;
}

export function RuntimeEvidenceCard({
  hash,
  ts,
  kind,
  target,
  status = 'sealed',
  className,
}: RuntimeEvidenceCardProps) {
  const reduce = useReducedMotion();
  const s = STATUS_CLASS[status];
  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.3 }}
      className={[
        'bg-obsidian-950 border border-titanium-900 p-3 flex items-center gap-3',
        className ?? '',
      ].join(' ')}
    >
      <span className="inline-flex w-7 h-7 items-center justify-center bg-obsidian-900 border border-titanium-800 text-emerald-300 shrink-0">
        <ShieldCheck className="h-3.5 w-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
          <span>{kind}</span>
          {target && <span className="text-titanium-600">· {target}</span>}
        </div>
        <div className="font-mono text-[12px] text-titanium-100 truncate" title={hash}>
          {truncateHash(hash)}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono text-[10px] text-titanium-500 tabular-nums">{ts}</div>
        <div className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider ${s.text} mt-0.5`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${s.dot}`} />
          {status}
        </div>
      </div>
    </motion.article>
  );
}
