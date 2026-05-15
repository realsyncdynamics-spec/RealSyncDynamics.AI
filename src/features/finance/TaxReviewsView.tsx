import { useEffect, useState } from 'react';
import { Plus, MessageSquare, Send, ChevronRight } from 'lucide-react';
import { FinanceShell, useFinanceTenant } from './FinanceShell';
import { Loader } from './FinanceDashboard';
import { Modal } from './TaxDocumentsView';
import { TaxDisclaimer } from './TaxDisclaimer';
import {
  listReviews, createReview, transitionReview, listComments, postComment,
  type TaxAdvisorReview, type TaxAdvisorReviewComment,
} from './reviewApi';
import {
  STATUS_LABEL, SUBJECT_TYPE_LABEL, AUTHOR_LABEL_TEXT,
  REVIEW_DISCLAIMER, statusToneOf,
  allowedNextStatuses, isOpenReview, compareByPriority,
  type ReviewStatus, type ReviewSubjectType, type ReviewAuthorLabel,
} from './reviewWorkflow';
import { listExports, listTaxYears } from './api';
import type { TaxYear, TaxEvidenceExport } from './types';

export function TaxReviewsView() {
  return (
    <FinanceShell title="Reviews" subtitle="Steuerberater-Übergaben · Status-Tracking">
      <Inner />
    </FinanceShell>
  );
}

function Inner() {
  const { activeTenantId } = useFinanceTenant();
  const [reviews, setReviews] = useState<TaxAdvisorReview[] | null>(null);
  const [years, setYears] = useState<TaxYear[]>([]);
  const [exports, setExports] = useState<TaxEvidenceExport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const reload = () => {
    if (!activeTenantId) return;
    setError(null);
    Promise.all([
      listReviews(activeTenantId),
      listTaxYears(activeTenantId),
      listExports(activeTenantId),
    ])
      .then(([r, y, e]) => { setReviews(r); setYears(y); setExports(e); })
      .catch((err: Error) => setError(err.message));
  };
  useEffect(reload, [activeTenantId]);

  if (!activeTenantId) return <p className="text-sm text-titanium-400">Tenant fehlt.</p>;
  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (reviews === null) return <Loader />;

  const open = reviews.filter((r) => isOpenReview(r.status))
    .sort((a, b) => compareByPriority(a.status, b.status));
  const closed = reviews.filter((r) => !isOpenReview(r.status));

  return (
    <div className="space-y-6">
      <div className="bg-obsidian-900 border border-titanium-900 p-3">
        <TaxDisclaimer variant="compact" />
        <p className="text-[11px] text-titanium-400 leading-relaxed mt-2">
          {REVIEW_DISCLAIMER}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-titanium-400">{open.length} offen · {closed.length} abgeschlossen</p>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" /> Review anfragen
        </button>
      </div>

      <section>
        <h3 className="font-display font-bold text-sm text-titanium-50 mb-2">Offen</h3>
        {open.length === 0 ? (
          <p className="text-sm text-titanium-400 bg-obsidian-900 border border-titanium-900 p-4">
            Keine offenen Reviews.
          </p>
        ) : (
          <ul className="divide-y divide-titanium-900 bg-obsidian-900 border border-titanium-900">
            {open.map((r) => <ReviewRow key={r.id} review={r} onOpen={() => setDetailId(r.id)} />)}
          </ul>
        )}
      </section>

      {closed.length > 0 && (
        <section>
          <h3 className="font-display font-bold text-sm text-titanium-50 mb-2">Abgeschlossen</h3>
          <ul className="divide-y divide-titanium-900 bg-obsidian-900 border border-titanium-900">
            {closed.map((r) => <ReviewRow key={r.id} review={r} onOpen={() => setDetailId(r.id)} />)}
          </ul>
        </section>
      )}

      {creating && (
        <CreateReviewModal
          tenantId={activeTenantId}
          years={years}
          exports={exports}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); reload(); }}
        />
      )}

      {detailId && (
        <ReviewDetailModal
          tenantId={activeTenantId}
          reviewId={detailId}
          onClose={() => { setDetailId(null); reload(); }}
        />
      )}
    </div>
  );
}

function ReviewRow({ review, onOpen }: { review: TaxAdvisorReview; onOpen: () => void }) {
  return (
    <li>
      <button onClick={onOpen} className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-obsidian-950">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-titanium-100">{review.title}</span>
            <StatusBadge status={review.status} />
          </div>
          <div className="text-[11px] text-titanium-500 font-mono">
            {SUBJECT_TYPE_LABEL[review.subject_type]}
            {review.assigned_to_name && ` · ${review.assigned_to_name}`}
            {' · erstellt '}{new Date(review.created_at).toLocaleDateString('de-DE')}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-titanium-500 shrink-0" />
      </button>
    </li>
  );
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  const tone = statusToneOf(status);
  const cls =
    tone === 'success'   ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
    : tone === 'warning' ? 'bg-amber-950/40 border-amber-800 text-amber-300'
    : tone === 'attention' ? 'bg-cyan-950/40 border-cyan-800 text-cyan-300'
    : 'border-titanium-800 text-titanium-300';
  return (
    <span className={`text-[10px] uppercase tracking-wider border px-1.5 py-0.5 ${cls}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function CreateReviewModal({
  tenantId, years, exports, onClose, onCreated,
}: {
  tenantId: string;
  years: TaxYear[];
  exports: TaxEvidenceExport[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const readyExports = exports.filter((e) => e.status === 'ready' || e.status === 'downloaded');
  // Default to whichever subject type has a usable option, so the
  // initial subjectId can never be a tax-year UUID while subject_type
  // is still on 'tax_evidence_export' (and vice versa).
  const initialType: ReviewSubjectType = readyExports.length > 0
    ? 'tax_evidence_export'
    : years.length > 0 ? 'tax_year' : 'tax_evidence_export';
  const initialSubjectId = initialType === 'tax_evidence_export'
    ? (readyExports[0]?.id ?? '')
    : initialType === 'tax_year' ? (years[0]?.id ?? '') : '';
  const [subjectType, setSubjectType] = useState<ReviewSubjectType>(initialType);
  const [subjectId, setSubjectId] = useState<string>(initialSubjectId);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [advisorName, setAdvisorName] = useState('');
  const [advisorEmail, setAdvisorEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      await createReview(tenantId, {
        subject_type: subjectType,
        subject_id:   subjectId,
        title:        title.trim() || autoTitle(subjectType, subjectId, exports, years),
        notes:        notes.trim() || undefined,
        assigned_to_name:  advisorName.trim() || undefined,
        assigned_to_email: advisorEmail.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Anlegen');
      setSubmitting(false);
    }
  }

  const input = 'w-full bg-obsidian-950 border border-titanium-800 text-titanium-100 px-2 py-1.5 text-sm rounded-none focus:border-emerald-500 outline-none';
  const subjectOptions = subjectType === 'tax_evidence_export'
    ? readyExports.map((ex) => ({ id: ex.id, label: `${ex.export_path ?? ex.id.slice(0, 8)} (${new Date(ex.created_at).toLocaleDateString('de-DE')})` }))
    : years.map((y) => ({ id: y.id, label: `Jahresordner ${y.year}` }));

  return (
    <Modal title="Review-Anfrage anlegen" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs">
            <span className="block text-titanium-400 mb-1">Gegenstand</span>
            <select
              value={subjectType}
              onChange={(e) => {
                const t = e.target.value as ReviewSubjectType;
                setSubjectType(t);
                setSubjectId(t === 'tax_evidence_export' ? (readyExports[0]?.id ?? '') : (years[0]?.id ?? ''));
              }}
              className={input}
            >
              <option value="tax_evidence_export">Exportpaket</option>
              <option value="tax_year">Jahresordner</option>
              <option value="annual_financials">Jahresabschluss-Entwurf</option>
            </select>
          </label>
          <label className="block text-xs">
            <span className="block text-titanium-400 mb-1">Auswahl</span>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={input}>
              {subjectOptions.length === 0 && <option value="">— keine verfügbar —</option>}
              {subjectOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-xs">
          <span className="block text-titanium-400 mb-1">Titel (optional, wird sonst automatisch erzeugt)</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={input} placeholder="Review Steuer 2026 — Exportpaket" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs">
            <span className="block text-titanium-400 mb-1">Steuerberater / Kanzlei</span>
            <input value={advisorName} onChange={(e) => setAdvisorName(e.target.value)} className={input} placeholder="Müller & Partner StB" />
          </label>
          <label className="block text-xs">
            <span className="block text-titanium-400 mb-1">E-Mail (zur Kontaktaufnahme)</span>
            <input type="email" value={advisorEmail} onChange={(e) => setAdvisorEmail(e.target.value)} className={input} placeholder="kanzlei@example.de" />
          </label>
        </div>
        <label className="block text-xs">
          <span className="block text-titanium-400 mb-1">Kontext / Notizen</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={input} placeholder="Worauf soll der Steuerberater achten?" />
        </label>
        <p className="text-[11px] text-titanium-500 leading-relaxed">
          {REVIEW_DISCLAIMER} Der Versand des Pakets an den Steuerberater erfolgt
          out-of-band (Download-URL aus „Exporte" + Mail/Datenraum).
        </p>
        {error && <p className="text-xs text-red-300">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-titanium-300 hover:text-titanium-100">Abbrechen</button>
          <button
            type="submit"
            disabled={submitting || !subjectId || subjectOptions.length === 0}
            className="px-3 py-1.5 bg-emerald-500 text-obsidian-950 text-xs font-semibold rounded-none hover:bg-emerald-400 disabled:opacity-50"
          >
            {submitting ? 'Lege an …' : 'Review anlegen'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function autoTitle(
  subjectType: ReviewSubjectType, subjectId: string,
  exports: TaxEvidenceExport[], years: TaxYear[],
): string {
  if (subjectType === 'tax_evidence_export') {
    const ex = exports.find((e) => e.id === subjectId);
    return `Review Exportpaket ${ex?.id.slice(0, 8) ?? ''}`.trim();
  }
  if (subjectType === 'tax_year') {
    const y = years.find((yr) => yr.id === subjectId);
    return `Review Jahresordner ${y?.year ?? ''}`.trim();
  }
  return 'Review Jahresabschluss-Entwurf';
}

function ReviewDetailModal({
  tenantId, reviewId, onClose,
}: {
  tenantId: string;
  reviewId: string;
  onClose: () => void;
}) {
  const [review, setReview] = useState<TaxAdvisorReview | null>(null);
  const [comments, setComments] = useState<TaxAdvisorReviewComment[]>([]);
  const [body, setBody] = useState('');
  const [authorLabel, setAuthorLabel] = useState<ReviewAuthorLabel>('owner');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = () => {
    Promise.all([
      listReviews(tenantId, { subjectId: undefined }).then((rs) => rs.find((r) => r.id === reviewId) ?? null),
      listComments(reviewId),
    ])
      .then(([r, c]) => { setReview(r); setComments(c); })
      .catch((err: Error) => setError(err.message));
  };
  useEffect(reload, [tenantId, reviewId]);

  async function send() {
    if (!body.trim()) return;
    setBusy(true); setError(null);
    try {
      await postComment(tenantId, reviewId, { author_label: authorLabel, body });
      setBody('');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Senden fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(next: ReviewStatus) {
    setBusy(true); setError(null);
    try {
      await transitionReview(tenantId, reviewId, next);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Statuswechsel fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  if (!review) {
    return (
      <Modal title="Review" onClose={onClose}>
        {error ? <p className="text-xs text-red-300">{error}</p> : <Loader />}
      </Modal>
    );
  }

  const nextOptions = allowedNextStatuses(review.status);
  const input = 'w-full bg-obsidian-950 border border-titanium-800 text-titanium-100 px-2 py-1.5 text-sm rounded-none focus:border-emerald-500 outline-none';

  return (
    <Modal title={review.title} onClose={onClose}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        <header className="text-xs space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={review.status} />
            <span className="text-titanium-400">{SUBJECT_TYPE_LABEL[review.subject_type]}</span>
            {review.assigned_to_name && <span className="text-titanium-500">· {review.assigned_to_name}</span>}
          </div>
          {review.notes && (
            <p className="text-titanium-400 leading-relaxed bg-obsidian-950 border border-titanium-900 p-2 mt-2 whitespace-pre-wrap">{review.notes}</p>
          )}
        </header>

        <section className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-titanium-500 flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> Thread ({comments.length})
          </div>
          {comments.length === 0 ? (
            <p className="text-xs text-titanium-500 italic">Noch keine Kommentare.</p>
          ) : (
            <ul className="space-y-2">
              {comments.map((c) => <CommentRow key={c.id} c={c} />)}
            </ul>
          )}
        </section>

        <section className="space-y-2 border-t border-titanium-900 pt-3">
          <div className="grid grid-cols-3 gap-2">
            <select value={authorLabel} onChange={(e) => setAuthorLabel(e.target.value as ReviewAuthorLabel)} className={input}>
              <option value="owner">Geschäftsführung</option>
              <option value="steuerberater">Steuerberater (transkribiert)</option>
            </select>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              className={`${input} col-span-2 resize-none`}
              placeholder="Kommentar / Transkript des Steuerberaters …"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-titanium-500">
              Steuerberater-Aussagen werden manuell transkribiert. Original-Korrespondenz bleibt beim Steuerberater.
            </p>
            <button
              type="button"
              onClick={send}
              disabled={busy || !body.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-obsidian-950 text-xs font-semibold rounded-none hover:bg-emerald-400 disabled:opacity-50"
            >
              <Send className="h-3 w-3" /> Senden
            </button>
          </div>
        </section>

        {nextOptions.length > 0 && (
          <section className="space-y-2 border-t border-titanium-900 pt-3">
            <div className="text-[11px] uppercase tracking-wider text-titanium-500">Status ändern</div>
            <div className="flex flex-wrap gap-2">
              {nextOptions.map((next) => (
                <button
                  key={next}
                  onClick={() => changeStatus(next)}
                  disabled={busy}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] border border-titanium-700 text-titanium-200 hover:border-titanium-500 hover:text-titanium-50 rounded-none disabled:opacity-50"
                >
                  → {STATUS_LABEL[next]}
                </button>
              ))}
            </div>
          </section>
        )}

        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>
    </Modal>
  );
}

function CommentRow({ c }: { c: TaxAdvisorReviewComment }) {
  const isSystem = c.author_label === 'system';
  const tone =
    c.author_label === 'steuerberater' ? 'border-cyan-800 bg-cyan-950/20 text-cyan-100'
    : c.author_label === 'owner'        ? 'border-titanium-800 bg-obsidian-900 text-titanium-100'
    : 'border-titanium-900 bg-obsidian-950 text-titanium-500 italic';
  return (
    <li className={`px-3 py-2 border text-xs ${tone}`}>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider opacity-70 mb-1">
        <span>{AUTHOR_LABEL_TEXT[c.author_label]}</span>
        <span>{new Date(c.created_at).toLocaleString('de-DE')}</span>
      </div>
      <p className={isSystem ? '' : 'whitespace-pre-wrap'}>{c.body}</p>
    </li>
  );
}
