import { useState } from 'react';
import { Check, X, Copy, Send, AlertTriangle } from 'lucide-react';
import type { QueueEntry } from './api';
import { CHANNEL_LABEL } from './api';
import { StatusBadge } from './StatusBadge';

interface Props {
  entry: QueueEntry;
  onApprove?: (queueId: string) => Promise<void> | void;
  onReject?:  (queueId: string) => Promise<void> | void;
  onPublish?: (queueId: string) => Promise<void> | void;
}

export function SocialPostCard({ entry, onApprove, onReject, onPublish }: Props) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const post = entry.post;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(post.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard not available */ }
  };

  const wrap = (fn?: (id: string) => Promise<void> | void) => async () => {
    if (!fn) return;
    setBusy(true);
    try { await fn(entry.id); } finally { setBusy(false); }
  };

  return (
    <div className="border border-titanium-800 bg-obsidian-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-titanium-900 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-titanium-200">
            {CHANNEL_LABEL[post.channel]}
          </span>
          <StatusBadge status={entry.status} />
        </div>
        <div className="flex items-center gap-2 text-[10px] text-titanium-500">
          <span>{post.charCount} chars</span>
          <span>·</span>
          <span>{new Date(entry.enqueuedAt).toLocaleTimeString('de-DE')}</span>
        </div>
      </div>

      {/* Body */}
      <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed text-titanium-100">
        {post.body}
      </pre>

      {/* Hashtags */}
      {post.hashtags.length > 0 ? (
        <div className="flex flex-wrap gap-1 border-t border-titanium-900 px-4 py-2">
          {post.hashtags.map(h => (
            <span key={h} className="border border-titanium-800 bg-obsidian-900 px-1.5 py-0.5 text-[10px] text-titanium-300">
              {h}
            </span>
          ))}
        </div>
      ) : null}

      {/* Block reasons */}
      {post.blockReasons && post.blockReasons.length > 0 ? (
        <div className="flex items-start gap-2 border-t border-rose-500/40 bg-rose-500/5 px-4 py-2 text-[11px] text-rose-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <div>
            {post.blockReasons.map(r => <div key={r} className="font-mono">{r}</div>)}
          </div>
        </div>
      ) : null}

      {/* Reviewer info */}
      {entry.reviewer ? (
        <div className="border-t border-titanium-900 px-4 py-2 text-[11px] text-titanium-400">
          Reviewer: <span className="font-mono text-titanium-200">{entry.reviewer}</span>
          {entry.decidedAt ? <> · {new Date(entry.decidedAt).toLocaleString('de-DE')}</> : null}
        </div>
      ) : null}

      {entry.publishedAt ? (
        <div className="border-t border-titanium-900 px-4 py-2 text-[11px] text-emerald-300">
          Gepostet {new Date(entry.publishedAt).toLocaleString('de-DE')}
          {entry.publishResult?.externalId ? (
            <> · ID <span className="font-mono">{entry.publishResult.externalId}</span></>
          ) : null}
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 border-t border-titanium-900 px-4 py-2">
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 border border-titanium-800 bg-obsidian-900 px-2.5 py-1 text-xs text-titanium-200 hover:bg-titanium-900 hover:text-titanium-50"
        >
          {copied ? <><Check className="h-3.5 w-3.5 text-emerald-400" /> Kopiert</> : <><Copy className="h-3.5 w-3.5" /> Kopieren</>}
        </button>

        {entry.status === 'pending' ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={wrap(onReject)}
              className="inline-flex items-center gap-1.5 border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" /> Ablehnen
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={wrap(onApprove)}
              className="inline-flex items-center gap-1.5 border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Freigeben
            </button>
          </>
        ) : null}

        {(entry.status === 'approved' || entry.status === 'auto') && onPublish ? (
          <button
            type="button"
            disabled={busy}
            onClick={wrap(onPublish)}
            className="inline-flex items-center gap-1.5 border border-security-500/40 bg-security-500/10 px-2.5 py-1 text-xs text-security-200 hover:bg-security-500/20 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" /> Posten (mock)
          </button>
        ) : null}
      </div>
    </div>
  );
}
