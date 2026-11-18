import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSupabaseAuth } from '../features/supabase/SupabaseAuthContext';
import { usePageMeta } from '../lib/usePageMeta';
import { deleteCheck, errorText, getCheck, listChecks, type ApiError, type SavedCheck } from '../features/needs-check/api';
import { NEEDS_CHECK_CATALOG, renderRecommendations } from '../../shared/needs-check';
import { RecommendationList } from './NeedsCheckPage';
import '../styles/needs-check.css';

/**
 * /check/ergebnisse        — eigene gespeicherte Ergebnisse
 * /check/ergebnisse/:id    — ein gespeichertes Ergebnis
 *
 * Lesen nur mit Anmeldung; welche Zeilen sichtbar sind, entscheidet RLS.
 * Texte kommen aus dem Katalog der gespeicherten Modellversion, nicht aus
 * dem heutigen. Der Hinweis zur Verfügbarkeit ist ausdrücklich der heutige
 * Stand (siehe currentStatus.ts).
 */

type Load<T> = { s: 'loading' } | { s: 'ok'; data: T } | { s: 'error'; error: ApiError };

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

function SavedDetail({ check, onDeleted }: { check: SavedCheck; onDeleted: () => void }) {
  const cat = NEEDS_CHECK_CATALOG[check.modelVersion];
  const recs = renderRecommendations(check.recommendationIds, check.answers, check.modelVersion);
  const [del, setDel] = useState<{ s: 'idle' } | { s: 'busy' } | { s: 'error'; error: ApiError }>({ s: 'idle' });

  const remove = async () => {
    setDel({ s: 'busy' });
    const r = await deleteCheck(check.id);
    if (r.ok) onDeleted();
    else setDel({ s: 'error', error: r.error });
  };

  return (
    <section className="nc-card" aria-labelledby="nc-saved-h">
      <div className="nc-result-head">
        <h1 id="nc-saved-h" className="nc-h1">Gespeichertes Ergebnis</h1>
        <span className="nc-badge" data-testid="nc-basis">Grundlage: Ihre Angaben</span>
      </div>
      <p className="nc-summary">
        {formatDate(check.createdAt)} · Ziel: {cat.goalLabel[check.answers.goal]} · Bereich: {cat.areaLabel[check.answers.area]} · Website: {check.answers.hasWebsite ? (check.answers.websiteUrl ?? 'ja') : 'noch keine'}
      </p>
      <p className="nc-note" data-testid="nc-version-note">
        Empfehlungen wie am {formatDate(check.createdAt)} gespeichert (Modellversion {check.modelVersion}). Hinweise zur Verfügbarkeit zeigen den heutigen Stand, Preise stehen unter „Pakete vergleichen“.
      </p>
      <RecommendationList recs={recs} />
      <div className="nc-actions">
        <Link to="/check/ergebnisse" className="nc-link">← Alle Ergebnisse</Link>
        <button type="button" className="nc-btn nc-btn--ghost" onClick={remove} disabled={del.s === 'busy'}>
          {del.s === 'busy' ? 'Wird gelöscht …' : 'Ergebnis löschen'}
        </button>
      </div>
      <p className="nc-note">Löschen entfernt das Ergebnis. Es zählt weiter zu Ihren höchstens 20 Speicherungen in 24 Stunden.</p>
      {del.s === 'error' ? <p role="alert" className="nc-error">{errorText(del.error)}</p> : null}
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
  const navigate = useNavigate();
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
            ) : <SavedDetail check={one.data} onDeleted={() => navigate('/check/ergebnisse')} />
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
                {list.data.map((c) => {
                  const cat = NEEDS_CHECK_CATALOG[c.modelVersion];
                  return (
                    <li key={c.id}>
                      <Link to={`/check/ergebnisse/${c.id}`} className="nc-list-item">
                        <strong>{cat.goalLabel[c.answers.goal]}</strong>
                        <span>{cat.areaLabel[c.answers.area]} · {formatDate(c.createdAt)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}
