import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSupabaseAuth } from '../features/supabase/SupabaseAuthContext';
import { usePageMeta } from '../lib/usePageMeta';
import { errorText, getCheck, listChecks, type ApiError, type SavedCheck } from '../features/needs-check/api';
import { AREA_LABEL, GOAL_LABEL, SECTION_LABEL, recommendationsFromIds } from '../features/needs-check/model';
import '../styles/needs-check.css';

/**
 * /check/ergebnisse        — eigene gespeicherte Ergebnisse
 * /check/ergebnisse/:id    — ein gespeichertes Ergebnis
 *
 * Lesen nur mit Anmeldung; welche Zeilen sichtbar sind, entscheidet RLS.
 */

type Load<T> = { s: 'loading' } | { s: 'ok'; data: T } | { s: 'error'; error: ApiError };

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

function SavedDetail({ check }: { check: SavedCheck }) {
  const recs = recommendationsFromIds(check.recommendationIds, check.answers);
  return (
    <section className="nc-card" aria-labelledby="nc-saved-h">
      <div className="nc-result-head">
        <h1 id="nc-saved-h" className="nc-h1">Gespeichertes Ergebnis</h1>
        <span className="nc-badge">{check.basis === 'answers_and_scan' ? 'Grundlage: Ihre Angaben + technische Prüfung' : 'Grundlage: Ihre Angaben'}</span>
      </div>
      <p className="nc-summary">
        {formatDate(check.createdAt)} · Ziel: {GOAL_LABEL[check.answers.goal]} · Bereich: {AREA_LABEL[check.answers.area]} · Website: {check.answers.hasWebsite ? (check.answers.websiteUrl ?? 'ja') : 'noch keine'}
      </p>
      <ol className="nc-recs">
        {recs.map((r, i) => (
          <li key={r.id} className="nc-rec">
            <span className="nc-rec-meta">{String(i + 1).padStart(2, '0')} · {SECTION_LABEL[r.section]}</span>
            <h2 className="nc-h2">{r.title}</h2>
            <p>{r.reason}</p>
            {r.status ? <p className="nc-status">{r.status}</p> : null}
            <Link to={r.cta.href} className={i === 0 ? 'nc-btn' : 'nc-btn nc-btn--ghost'}>{r.cta.label}</Link>
          </li>
        ))}
      </ol>
      {check.auditId ? <Link to={`/audit/result/${check.auditId}`} className="nc-link">Bericht der technischen Prüfung öffnen →</Link> : null}
      <div className="nc-actions">
        <Link to="/check/ergebnisse" className="nc-link">← Alle Ergebnisse</Link>
        <Link to="/check" className="nc-link">Neuen Check starten →</Link>
      </div>
    </section>
  );
}

export function NeedsCheckSavedPage() {
  const { id } = useParams<{ id?: string }>();
  usePageMeta({
    title: 'Gespeicherte Ergebnisse — Bedarfs-Check | RealSync Dynamics & AI',
    description: 'Ihre gespeicherten Ergebnisse des Bedarfs-Checks.',
    url: 'https://realsyncdynamicsai.de/check/ergebnisse',
  });
  const { user, isLoading: authLoading } = useSupabaseAuth();
  const [list, setList] = useState<Load<SavedCheck[]>>({ s: 'loading' });
  const [one, setOne] = useState<Load<SavedCheck>>({ s: 'loading' });

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    if (id) {
      setOne({ s: 'loading' });
      void getCheck(id).then((r) => { if (!cancelled) setOne(r.ok ? { s: 'ok', data: r.data } : { s: 'error', error: r.error }); });
    } else {
      setList({ s: 'loading' });
      void listChecks().then((r) => { if (!cancelled) setList(r.ok ? { s: 'ok', data: r.data } : { s: 'error', error: r.error }); });
    }
    return () => { cancelled = true; };
  }, [id, user, authLoading]);

  const next = id ? `/check/ergebnisse/${id}` : '/check/ergebnisse';

  return (
    <div className="nc">
      <header className="nc-top">
        <Link to="/" className="nc-brand">RealSync Dynamics &amp; AI</Link>
        <Link to="/check" className="nc-toplink">Neuer Check</Link>
      </header>
      <main className="nc-main" id="main">
        {authLoading ? <p role="status">Anmeldung wird geprüft …</p> : null}
        {!authLoading && !user ? (
          <section className="nc-card">
            <h1 className="nc-h1">Bitte anmelden</h1>
            <p>Gespeicherte Ergebnisse sehen Sie nach der Anmeldung.</p>
            <Link className="nc-btn" to={`/welcome?next=${encodeURIComponent(next)}`}>Anmelden</Link>
          </section>
        ) : null}

        {!authLoading && user && id ? (
          one.s === 'loading' ? <p role="status">Ergebnis wird geladen …</p>
            : one.s === 'error' ? (
              <section className="nc-card">
                <h1 className="nc-h1">Ergebnis nicht verfügbar</h1>
                <p role="alert" className="nc-error" data-testid="nc-saved-error">{errorText(one.error)}</p>
                <Link to="/check/ergebnisse" className="nc-link">← Alle Ergebnisse</Link>
              </section>
            ) : <SavedDetail check={one.data} />
        ) : null}

        {!authLoading && user && !id ? (
          <section className="nc-card" aria-labelledby="nc-list-h">
            <h1 id="nc-list-h" className="nc-h1">Gespeicherte Ergebnisse</h1>
            {list.s === 'loading' ? <p role="status">Ergebnisse werden geladen …</p> : null}
            {list.s === 'error' ? <p role="alert" className="nc-error">{errorText(list.error)}</p> : null}
            {list.s === 'ok' && list.data.length === 0 ? (
              <p data-testid="nc-empty">Noch keine gespeicherten Ergebnisse. <Link to="/check" className="nc-link">Jetzt den Check machen →</Link></p>
            ) : null}
            {list.s === 'ok' && list.data.length > 0 ? (
              <ul className="nc-list">
                {list.data.map((c) => (
                  <li key={c.id}>
                    <Link to={`/check/ergebnisse/${c.id}`} className="nc-list-item">
                      <strong>{GOAL_LABEL[c.answers.goal]}</strong>
                      <span>{AREA_LABEL[c.answers.area]} · {formatDate(c.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}
