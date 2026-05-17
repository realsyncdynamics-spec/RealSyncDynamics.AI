import type { QueueEntry } from './api';

const TONE: Record<QueueEntry['status'], string> = {
  pending:   'border-amber-500/40   bg-amber-500/10   text-amber-200',
  approved:  'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  rejected:  'border-rose-500/40    bg-rose-500/10    text-rose-200',
  auto:      'border-security-500/40 bg-security-500/10 text-security-200',
  published: 'border-titanium-700   bg-titanium-900    text-titanium-200',
  failed:    'border-rose-500/40    bg-rose-500/10    text-rose-200',
};

const LABEL: Record<QueueEntry['status'], string> = {
  pending:   'Review',
  approved:  'Freigegeben',
  rejected:  'Abgelehnt',
  auto:      'Auto',
  published: 'Gepostet',
  failed:    'Fehler',
};

export function StatusBadge({ status }: { status: QueueEntry['status'] }) {
  return (
    <span className={`inline-block border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TONE[status]}`}>
      {LABEL[status]}
    </span>
  );
}

export function BlockedBadge() {
  return (
    <span className="inline-block border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-200">
      Blockiert
    </span>
  );
}
