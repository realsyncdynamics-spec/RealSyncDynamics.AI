/**
 * Market Intelligence Cockpit — /market-intelligence (Super-Admin).
 *
 * Warum diese Seite neben `/market-gaps` steht
 * -------------------------------------------
 * `/market-gaps` listet und filtert den Bestand — es beantwortet „Was hat der
 * Scanner gefunden?". Diese Seite beantwortet die andere Frage: „Was folgt
 * daraus?" Gemessen am 2026-09-06 stehen 129 Lücken auf `identified` und 122
 * Briefs auf `draft` — der Scanner sammelt seit dem 2026-05-05 zuverlässig,
 * ausgewertet wurde davon nichts.
 *
 * Die Seite ist bewusst **additiv** (CLAUDE.md §10): eigene Route, eigene
 * Datei, ausschließlich vorhandene Tokens und Komponentenmuster aus
 * `MarketGapsView`. An `/market-gaps` ist nichts geändert.
 *
 * Ehrlichkeit vor Ranking
 * -----------------------
 * Die Trennschärfe-Kachel steht **vor** der Rangliste, nicht darunter. Wenn
 * `urgency_score` für 129 Einträge effektiv zwei Stufen kennt und
 * `revenue_potential` praktisch nur eine, ist jede Sortierung danach eine
 * Scheinordnung — das gehört gesagt, bevor jemand die Liste von oben
 * abarbeitet. Die Bewertung selbst liegt in
 * `src/core/market-intelligence/score.ts` (rein und getestet), nicht hier.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, Loader2, RefreshCw, Sparkles, Activity,
  Layers, Inbox, TrendingUp, ExternalLink,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getSupabase } from '../../lib/supabase';
import {
  scoreCorpus, buildCorpusStats, assessScannerFields,
  SCORE_WEIGHTS,
  type ScorableGap, type GapScore, type DiscriminationReport,
} from '../../core/market-intelligence/score';

interface IntelRow {
  industry: string;
  gaps: number;
  distinct_jobs: number;
  avg_urgency: number;
  days_since_last: number;
}

interface CorroboratedTheme {
  job_category: string;
  industry: string;
  confirmed_days: number;
  gaps: number;
}

interface IntelPayload {
  error?: string;
  funnel?: {
    gaps_by_status: Record<string, number>;
    briefs_by_status: Record<string, number>;
    gaps_total: number;
    briefs_total: number;
    high_value_without_brief: number;
  };
  brief_backlog?: { draft: number; sent: number; oldest_draft_age_days: number | null };
  scanner?: {
    last_run_status: string | null;
    hours_since_last_run: number | null;
    runs_last_14d: number;
    errors_last_14d: number;
    runs_total: number;
  };
  industries?: IntelRow[];
  corroborated_themes?: CorroboratedTheme[];
  cross_industry_themes?: number;
}

export function MarketIntelligenceView() {
  return <AuthGate>{(session) => <Inner session={session} />}</AuthGate>;
}

function Inner({ session }: { session: Session }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [intel, setIntel] = useState<IntelPayload | null>(null);
  const [gaps, setGaps] = useState<ScorableGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = getSupabase();
      const { data: prof } = await sb
        .from('profiles').select('is_super_admin').eq('id', session.user.id).maybeSingle();
      if (cancelled) return;
      const isAdmin = !!prof?.is_super_admin;
      setAllowed(isAdmin);
      if (!isAdmin) { setLoading(false); return; }
      await load();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id]);

  async function load() {
    setLoading(true);
    setError(null);
    const sb = getSupabase();

    // Zwei Quellen: Aggregate serverseitig (Joins über beide Tabellen), die
    // Einzelbewertung clientseitig über RLS — damit die Score-Logik nur an
    // einer Stelle steht und dort getestet ist.
    const [intelRes, gapsRes] = await Promise.all([
      sb.rpc('admin_market_intelligence'),
      sb.from('market_gaps')
        .select('id, industry, job_category, urgency_score, revenue_potential, build_complexity, scanned_at')
        .order('scanned_at', { ascending: false }),
    ]);

    if (intelRes.error) setError(intelRes.error.message);
    else if ((intelRes.data as IntelPayload)?.error) setError((intelRes.data as IntelPayload).error!);
    else setIntel(intelRes.data as IntelPayload);

    if (gapsRes.error) setError((prev) => prev ?? gapsRes.error!.message);
    else setGaps((gapsRes.data ?? []) as ScorableGap[]);

    setLoading(false);
  }

  // Bewertung und Diagnose aus dem geladenen Bestand. `now` einmal pro
  // Berechnung festhalten, damit alle Zeilen gegen denselben Zeitpunkt altern.
  const { ranked, byId, diagnostics, crossIndustry } = useMemo(() => {
    const now = Date.now();
    const ageDaysOf = (g: ScorableGap) =>
      Math.max(0, (now - Date.parse(g.scanned_at)) / 86_400_000);
    const scores = scoreCorpus(gaps, ageDaysOf);
    const map = new Map(gaps.map((g) => [g.id, g]));
    return {
      ranked: scores,
      byId: map,
      diagnostics: assessScannerFields(gaps),
      crossIndustry: buildCorpusStats(gaps).crossIndustryJobCategories.length,
    };
  }, [gaps]);

  if (allowed === null) {
    return <div className="min-h-screen bg-obsidian-950 flex items-center justify-center text-titanium-500 text-sm">Lade…</div>;
  }
  if (!allowed) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-obsidian-900 border border-titanium-900 p-8 text-center rounded-none">
          <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
          <h1 className="font-display text-xl font-bold text-titanium-50 mb-2">Kein Zugriff</h1>
          <p className="text-sm text-titanium-400 mb-5">
            Diese Seite ist nur für Plattform-Admins (RealSync-internes Intel).
          </p>
          <Link to="/dashboard" className="text-sm text-security-400 hover:underline">→ Zum Dashboard</Link>
        </div>
      </div>
    );
  }

  const funnel = intel?.funnel;
  const backlog = intel?.brief_backlog;
  const scanner = intel?.scanner;

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/dashboard" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-fuchsia-500 to-purple-700 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Market Intelligence</div>
            <div className="text-[11px] text-titanium-400 font-medium">Auswertung · Super-Admin</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/market-gaps"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-titanium-800 hover:border-security-500 text-titanium-300 hover:text-titanium-50 rounded-none"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Alle Lücken
          </Link>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-titanium-800 hover:border-security-500 text-titanium-300 hover:text-titanium-50 rounded-none"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reload
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3 mb-6">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-titanium-400 text-sm py-16 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade…
          </div>
        ) : (
          <>
            {/* ── Trichter: wo der Bestand stehenbleibt ───────────────────── */}
            <Section icon={<Inbox className="h-3.5 w-3.5" />} title="Trichter">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi label="Lücken gesamt" value={funnel?.gaps_total ?? 0} />
                <Kpi
                  label="davon nur „identified“"
                  value={funnel?.gaps_by_status?.identified ?? 0}
                  tone={isStalled(funnel?.gaps_by_status, 'identified') ? 'warn' : 'plain'}
                />
                <Kpi label="Briefs gesamt" value={funnel?.briefs_total ?? 0} />
                <Kpi
                  label="davon nur „draft“"
                  value={backlog?.draft ?? 0}
                  tone={isStalled(funnel?.briefs_by_status, 'draft') ? 'warn' : 'plain'}
                />
              </div>
              {backlog?.draft ? (
                <p className="text-xs text-titanium-400 mt-3">
                  Ältester unversendeter Brief liegt seit{' '}
                  <span className="font-mono text-amber-300">{backlog.oldest_draft_age_days ?? '–'}</span> Tagen.
                  {backlog.sent === 0 && ' Bisher wurde kein einziger Brief versendet.'}
                </p>
              ) : null}
              {funnel && funnel.high_value_without_brief > 0 && (
                <p className="text-xs text-amber-300 mt-2">
                  {funnel.high_value_without_brief} Lücken mit hohem Potential haben keinen Brief —
                  der Scanner sollte für diese einen anlegen.
                </p>
              )}
            </Section>

            {/* ── Trennschärfe: steht bewusst vor der Rangliste ───────────── */}
            <Section
              icon={<Activity className="h-3.5 w-3.5" />}
              title="Trennschärfe der Scanner-Bewertung"
              hint="Wie gut unterscheiden die vom Modell vergebenen Kennzahlen überhaupt zwischen Einträgen?"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {diagnostics.map((d) => <DiscriminationCard key={d.field} report={d} />)}
              </div>
              {diagnostics.some((d) => d.verdict !== 'informative') && (
                <p className="text-xs text-amber-300 mt-3 leading-relaxed">
                  Mindestens eine Kennzahl trennt kaum: Sie kennt über den gesamten Bestand hinweg
                  weniger als drei effektive Stufen. Eine Rangfolge, die sich darauf stützt,
                  sortiert — sie priorisiert nicht. Die Liste unten gewichtet deshalb die aus den
                  Daten berechnete Bestätigung am stärksten
                  ({Math.round(SCORE_WEIGHTS.corroboration * 100)} %) und die Selbstbewertung des
                  Scanners entsprechend geringer.
                </p>
              )}
              <p className="text-xs text-titanium-500 mt-2">
                Branchenübergreifende Themen im Bestand:{' '}
                <span className="font-mono text-titanium-300">{crossIndustry}</span>
                {crossIndustry === 0 && ' — Job-Kategorien sind branchengebundene Rollentitel, Überschneidung ist hier die Ausnahme.'}
              </p>
            </Section>

            {/* ── Rangliste ──────────────────────────────────────────────── */}
            <Section
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              title="Priorisierte Lücken"
              hint="Gewichte: Bestätigung 25 · Dringlichkeit 25 · Umsatz 20 · Machbarkeit 15 · Frische 15"
            >
              {ranked.length === 0 ? (
                <Empty />
              ) : (
                <div className="overflow-x-auto border border-titanium-900">
                  <table className="w-full text-sm">
                    <thead className="bg-obsidian-900 text-[11px] uppercase tracking-wider text-titanium-400">
                      <tr>
                        <Th className="text-center">#</Th>
                        <Th className="text-center">Score</Th>
                        <Th>Branche</Th>
                        <Th>Job-Kategorie</Th>
                        <Th className="text-center">Bestätigt</Th>
                        <Th className="text-center">Urg</Th>
                        <Th>Revenue</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.slice(0, 25).map((s, i) => {
                        const gap = byId.get(s.id);
                        if (!gap) return null;
                        return (
                          <tr key={s.id} className="border-t border-titanium-900 bg-obsidian-950 hover:bg-obsidian-900">
                            <Td className="text-center text-titanium-500 font-mono text-xs">{i + 1}</Td>
                            <Td className="text-center">
                              <ScoreBar score={s.score} />
                            </Td>
                            <Td className="font-bold text-titanium-100">{gap.industry}</Td>
                            <Td className="text-titanium-300">{gap.job_category}</Td>
                            <Td className="text-center">
                              <CorroborationBadge days={s.corroborationDays} />
                            </Td>
                            <Td className="text-center font-mono text-xs text-titanium-400">{gap.urgency_score}</Td>
                            <Td className="text-[10px] font-bold uppercase text-titanium-400">{gap.revenue_potential}</Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {ranked.length > 25 && (
                <p className="text-xs text-titanium-500 mt-2">
                  Zeigt 25 von {ranked.length}. Vollständige Liste unter{' '}
                  <Link to="/market-gaps" className="text-security-400 hover:underline">/market-gaps</Link>.
                </p>
              )}
            </Section>

            {/* ── Mehrfach bestätigte Themen ─────────────────────────────── */}
            <Section
              icon={<Layers className="h-3.5 w-3.5" />}
              title="Mehrfach bestätigte Themen"
              hint="Dieselbe Job-Kategorie, an mehreren verschiedenen Scan-Tagen unabhängig gefunden."
            >
              {(intel?.corroborated_themes ?? []).length === 0 ? (
                <p className="text-sm text-titanium-500">Keine Kategorie wurde bisher an mehr als einem Tag gefunden.</p>
              ) : (
                <div className="border border-titanium-900 divide-y divide-titanium-900">
                  {intel!.corroborated_themes!.map((t) => (
                    <div key={t.job_category} className="flex items-center gap-3 px-3 py-2 bg-obsidian-950">
                      <CorroborationBadge days={t.confirmed_days} />
                      <span className="text-sm text-titanium-200 flex-1 min-w-0 truncate">{t.job_category}</span>
                      <span className="text-xs text-titanium-500 shrink-0">{t.industry}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* ── Betrieb ────────────────────────────────────────────────── */}
            <Section icon={<Activity className="h-3.5 w-3.5" />} title="Scanner-Betrieb">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi label="Läufe gesamt" value={scanner?.runs_total ?? 0} />
                <Kpi label="Läufe (14 T.)" value={scanner?.runs_last_14d ?? 0} />
                <Kpi
                  label="Fehler (14 T.)"
                  value={scanner?.errors_last_14d ?? 0}
                  tone={(scanner?.errors_last_14d ?? 0) > 0 ? 'warn' : 'plain'}
                />
                <Kpi
                  label="Letzter Lauf (Std.)"
                  value={scanner?.hours_since_last_run ?? 0}
                  tone={(scanner?.hours_since_last_run ?? 0) > 48 ? 'warn' : 'plain'}
                />
              </div>
              <p className="text-xs text-titanium-500 mt-3">
                Zeitplan: täglich 06:00 UTC, 12-Branchen-Rotation. Letzter Status:{' '}
                <span className="font-mono text-titanium-300">{scanner?.last_run_status ?? '–'}</span>
              </p>
            </Section>
          </>
        )}
      </main>
    </div>
  );
}

// ─── Bausteine (nur vorhandene Tokens, Hard-Edge wie im Dashboard) ──────────

function Section({ icon, title, hint, children }: {
  icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-titanium-500">{icon}</span>
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-titanium-200">{title}</h2>
      </div>
      {hint && <p className="text-xs text-titanium-500 mb-3">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </section>
  );
}

function Kpi({ label, value, tone = 'plain' }: {
  label: string; value: number; tone?: 'plain' | 'warn';
}) {
  return (
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-3">
      <div className={`font-mono text-2xl font-bold ${tone === 'warn' ? 'text-amber-300' : 'text-titanium-50'}`}>
        {value}
      </div>
      <div className="text-[11px] text-titanium-400 mt-0.5">{label}</div>
    </div>
  );
}

function DiscriminationCard({ report }: { report: DiscriminationReport }) {
  const tone: Record<DiscriminationReport['verdict'], string> = {
    informative: 'text-emerald-300 border-emerald-900',
    weak: 'text-amber-300 border-amber-900',
    degenerate: 'text-red-300 border-red-900',
  };
  const label: Record<DiscriminationReport['verdict'], string> = {
    informative: 'trennt',
    weak: 'schwach',
    degenerate: 'entartet',
  };
  return (
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-3">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="font-mono text-xs text-titanium-300">{report.field}</span>
        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 border rounded-none ${tone[report.verdict]}`}>
          {label[report.verdict]}
        </span>
      </div>
      <div className="text-xs text-titanium-400 leading-relaxed">
        effektiv <span className="font-mono text-titanium-200">{report.effectiveValues.toFixed(1)}</span> von{' '}
        {report.distinctValues} Werten über {report.total} Einträge
      </div>
      <div className="text-[11px] text-titanium-500 mt-1">
        häufigster deckt <span className="font-mono">{Math.round(report.topShare * 100)} %</span>
        {report.topValue !== null && <> (<span className="font-mono">{report.topValue}</span>)</>}
      </div>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2 justify-center">
      <span className="font-mono text-xs font-bold text-titanium-100 w-9 text-right">{score.toFixed(1)}</span>
      <span className="inline-block w-14 h-1.5 bg-obsidian-800 rounded-none overflow-hidden" aria-hidden="true">
        <span className="block h-full bg-security-500" style={{ width: `${Math.min(100, score)}%` }} />
      </span>
    </div>
  );
}

function CorroborationBadge({ days }: { days: number }) {
  const strong = days >= 3;
  return (
    <span
      title={`An ${days} verschiedenen Scan-Tagen unabhängig gefunden`}
      className={`inline-block text-[10px] font-bold px-1.5 py-0.5 border rounded-none ${
        strong ? 'bg-fuchsia-950 text-fuchsia-200 border-fuchsia-800'
               : 'bg-titanium-900 text-titanium-400 border-titanium-800'
      }`}
    >
      {days}×
    </span>
  );
}

function Empty() {
  return (
    <div className="text-center py-12 text-titanium-500 text-sm">
      Keine Lücken — Daily-Scanner läuft täglich 06:00 UTC.
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-left font-bold ${className}`}>{children}</th>;
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}

/** Ein Zustand gilt als Stau, wenn er den gesamten Bestand ausmacht. */
function isStalled(byStatus: Record<string, number> | undefined, status: string): boolean {
  if (!byStatus) return false;
  const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
  return total > 0 && (byStatus[status] ?? 0) === total;
}
