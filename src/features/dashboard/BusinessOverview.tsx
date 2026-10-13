import { Link } from 'react-router-dom';
import type { TenantStatus } from '../../lib/status/statusAdapter';
import { formatMetric } from '../../lib/status/statusAdapter';

interface Insight { id: string; title: string; severity: 'info' | 'warning' | 'critical'; recommended_action?: string; }
const scoreRows = [
  { key: 'score_gdpr', label: 'Datenschutz (DSGVO)', help: 'Wie weit die bereits erfassten Datenschutzkontrollen bewertet wurden.' },
  { key: 'score_ai_act', label: 'Regeln für KI (EU AI Act)', help: 'Bewertungsstand der erfassten KI-Kontrollen.' },
  { key: 'score_nis2', label: 'IT-Sicherheit (NIS2)', help: 'Bewertungsstand der zugeordneten Sicherheitskontrollen.' },
] as const;

export function BusinessOverview({ status, insights }: { status: TenantStatus; insights: Insight[] }) {
  const tasks = insights.slice(0, 5);
  return <section className="mb-6 grid gap-4 xl:grid-cols-[1fr_1.08fr]" aria-label="Mein Betrieb im Überblick">
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5"><p className="text-xs font-bold uppercase tracking-widest text-cyan-700">Ihr Betrieb im Blick</p><h2 className="mt-2 text-xl font-bold text-slate-900">Wo stehen wir?</h2><p className="mt-1 text-sm text-slate-500">Balken zeigen gespeicherte Bewertungen. Ein fehlender Wert bedeutet: noch keine auswertbare Messung.</p></div>
      <div className="space-y-5">
        {scoreRows.map(row => {
          const score = status.scoreDetail?.[row.key] ?? null;
          const valid = score !== null && Number.isFinite(score);
          const percent = valid ? Math.max(0, Math.min(100, score)) : 0;
          return <div key={row.key}>
            <div className="mb-1 flex items-center justify-between gap-3"><span className="text-sm font-semibold text-slate-800">{row.label}</span><span className="text-sm font-bold tabular-nums text-slate-800">{valid ? formatMetric(score, '%') : '—'}</span></div>
            <div role="meter" aria-label={row.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={valid ? percent : undefined} aria-valuetext={valid ? `${score} Prozent` : 'Noch keine auswertbare Messung'} className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              {valid && <div className="h-full rounded-full bg-cyan-500 transition-[width]" style={{width: `${percent}%`}} />}
            </div>
            <p className="mt-1 text-xs text-slate-500">{row.help}</p>
          </div>;
        })}
      </div>
      <p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">Diese Zahlen sind technische Bewertungsstände, keine behördliche Freigabe und kein Nachweis vollständiger Rechtskonformität.</p>
    </div>
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-cyan-700">Klarer nächster Schritt</p><h2 className="mt-2 text-xl font-bold text-slate-900">Was ist jetzt zu tun?</h2><p className="mt-1 mb-5 text-sm text-slate-500">Aus den vorhandenen Hinweisen Ihres Unternehmens – nicht aus Demo-Daten.</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[390px] text-left text-sm"><thead className="border-b border-slate-200 text-xs text-slate-500"><tr><th scope="col" className="pb-3 pr-3 font-semibold">Thema</th><th scope="col" className="pb-3 pr-3 font-semibold">Dringlichkeit</th><th scope="col" className="pb-3 font-semibold">Weiter</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{tasks.length ? tasks.map(task => <tr key={task.id}><td className="py-3 pr-3 font-medium text-slate-800">{task.title}</td><td className="py-3 pr-3 text-slate-600">{task.severity === 'critical' ? 'Dringend' : task.severity === 'warning' ? 'Prüfen' : 'Hinweis'}</td><td className="py-3"><Link to="/app/governance/gaps" className="font-semibold text-cyan-700 hover:underline">Ansehen →</Link></td></tr>) : <tr><td colSpan={3} className="py-6 text-slate-500">Derzeit keine aktiven Hinweise geladen. Das ist keine Bestätigung, dass alle Anforderungen erfüllt sind.</td></tr>}</tbody>
      </table></div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2"><Link to="/audit" className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-center text-sm font-semibold text-cyan-900 hover:bg-cyan-100">Website prüfen</Link><Link to="/app/company" className="rounded-xl border border-slate-200 p-3 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50">Mein Unternehmen</Link></div>
    </div>
  </section>;
}
