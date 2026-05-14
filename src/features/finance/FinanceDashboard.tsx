import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle, FileStack, Package, Bell, Calendar, Loader2,
  ArrowRight, FolderOpen,
} from 'lucide-react';
import { FinanceShell, useFinanceTenant } from './FinanceShell';
import {
  listTaxYears, createTaxYear, listTaxDocuments,
  listExports, listReminders,
} from './api';
import type {
  TaxYear, TaxDocument, TaxEvidenceExport, TaxReminder,
} from './types';

export function FinanceDashboard() {
  return (
    <FinanceShell title="Finanz-Runtime" subtitle="Steuer-Vorbereitung · Belegsammlung · Jahresordner">
      <Inner />
    </FinanceShell>
  );
}

function Inner() {
  const { activeTenantId } = useFinanceTenant();
  const [years, setYears] = useState<TaxYear[] | null>(null);
  const [docs, setDocs] = useState<TaxDocument[]>([]);
  const [exports, setExports] = useState<TaxEvidenceExport[]>([]);
  const [reminders, setReminders] = useState<TaxReminder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  const reload = () => {
    if (!activeTenantId) return;
    setError(null);
    Promise.all([
      listTaxYears(activeTenantId),
      listTaxDocuments(activeTenantId, { limit: 500 }),
      listExports(activeTenantId),
      listReminders(activeTenantId, { openOnly: true }),
    ])
      .then(([y, d, e, r]) => { setYears(y); setDocs(d); setExports(e); setReminders(r); })
      .catch((err: Error) => setError(err.message));
  };
  useEffect(reload, [activeTenantId]);

  async function bootstrapCurrentYear() {
    if (!activeTenantId) return;
    setBootstrapping(true);
    try {
      await createTaxYear(activeTenantId, new Date().getFullYear());
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen');
    } finally {
      setBootstrapping(false);
    }
  }

  if (!activeTenantId) return <p className="text-sm text-titanium-400">Tenant fehlt.</p>;
  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (years === null) return <Loader />;

  const currentYear = years.find((y) => y.year === new Date().getFullYear()) ?? years[0] ?? null;
  const currentYearDocs = currentYear ? docs.filter((d) => d.tax_year_id === currentYear.id) : [];
  const needsReview = currentYearDocs.filter((d) => d.classification_status === 'needs_review').length;
  const pending = currentYearDocs.filter((d) => d.classification_status === 'pending').length;
  const exportsForYear = currentYear ? exports.filter((e) => e.tax_year_id === currentYear.id) : [];
  const lastExport = exportsForYear[0] ?? null;
  const nextReminder = reminders[0] ?? null;

  if (years.length === 0) {
    return (
      <div className="bg-obsidian-900 border border-titanium-900 p-8 text-center space-y-3">
        <FolderOpen className="h-8 w-8 text-emerald-400 mx-auto" />
        <p className="text-sm text-titanium-200">Noch kein Steuer-Jahresordner angelegt.</p>
        <button
          onClick={bootstrapCurrentYear}
          disabled={bootstrapping}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-emerald-400 disabled:opacity-50"
        >
          {bootstrapping ? 'Lege an…' : `Jahresordner ${new Date().getFullYear()} anlegen`}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile
          to={currentYear ? `/finance/year/${currentYear.year}` : '/finance/tax-evidence'}
          icon={<Calendar className="h-4 w-4" />}
          label="Aktuelles Jahr"
          value={currentYear ? `${currentYear.year}` : '—'}
          sub={currentYear ? statusLabel(currentYear.status) : undefined}
        />
        <KpiTile
          to="/finance/documents"
          icon={<FileStack className="h-4 w-4" />}
          label="Dokumente (Jahr)"
          value={currentYearDocs.length}
        />
        <KpiTile
          to="/finance/documents"
          icon={<AlertCircle className="h-4 w-4" />}
          label="Review-Bedarf"
          value={needsReview + pending}
          tone={needsReview + pending > 0 ? 'warn' : 'ok'}
        />
        <KpiTile
          to="/finance/exports"
          icon={<Package className="h-4 w-4" />}
          label="Exportpaket"
          value={lastExport ? exportStatusLabel(lastExport.status) : '—'}
          sub={lastExport ? new Date(lastExport.created_at).toLocaleDateString('de-DE') : undefined}
        />
      </div>

      <section className="bg-obsidian-900 border border-titanium-900">
        <header className="px-4 py-2.5 border-b border-titanium-900 flex items-center justify-between">
          <h2 className="font-display font-bold text-sm text-titanium-50 flex items-center gap-2">
            <Bell className="h-4 w-4 text-emerald-400" /> Nächste Frist
          </h2>
          <Link to="/finance/reminders" className="text-xs text-emerald-400 hover:underline inline-flex items-center gap-1">
            Alle <ArrowRight className="h-3 w-3" />
          </Link>
        </header>
        {nextReminder ? (
          <div className="px-4 py-3 text-sm flex items-center justify-between">
            <div>
              <div className="text-titanium-100">{nextReminder.title}</div>
              <div className="text-[11px] text-titanium-500 font-mono">
                fällig {new Date(nextReminder.due_at).toLocaleDateString('de-DE')}
              </div>
            </div>
            <span className="text-[11px] uppercase tracking-wider text-emerald-300">
              {nextReminder.reminder_type}
            </span>
          </div>
        ) : (
          <p className="px-4 py-3 text-sm text-titanium-400">Keine offenen Erinnerungen.</p>
        )}
      </section>

      <section className="bg-obsidian-900 border border-titanium-900">
        <header className="px-4 py-2.5 border-b border-titanium-900 flex items-center justify-between">
          <h2 className="font-display font-bold text-sm text-titanium-50">Letzte Dokumente</h2>
          <Link to="/finance/documents" className="text-xs text-emerald-400 hover:underline inline-flex items-center gap-1">
            Alle <ArrowRight className="h-3 w-3" />
          </Link>
        </header>
        {currentYearDocs.length === 0 ? (
          <p className="px-4 py-3 text-sm text-titanium-400">Noch keine Belege für das aktuelle Jahr.</p>
        ) : (
          <ul className="divide-y divide-titanium-900 text-sm">
            {currentYearDocs.slice(0, 6).map((d) => (
              <li key={d.id} className="px-4 py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-titanium-100 truncate">{d.file_name}</div>
                  <div className="text-[11px] text-titanium-500">
                    {d.source_type} · {new Date(d.document_date).toLocaleDateString('de-DE')}
                    {d.counterparty_name && ` · ${d.counterparty_name}`}
                  </div>
                </div>
                <span className={`text-[11px] uppercase tracking-wider ${classColor(d.classification_status)}`}>
                  {d.classification_status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function KpiTile({
  to, icon, label, value, sub, tone = 'neutral',
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'neutral' | 'ok' | 'warn';
}) {
  const accent =
    tone === 'warn' ? 'text-amber-300'
    : tone === 'ok' ? 'text-emerald-300'
    : 'text-titanium-50';
  return (
    <Link to={to} className="bg-obsidian-900 border border-titanium-900 p-3 hover:border-emerald-700 transition-colors block">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-titanium-400 mb-1">
        {icon}{label}
      </div>
      <div className={`font-display font-bold text-2xl ${accent}`}>{value}</div>
      {sub && <div className="text-[11px] text-titanium-500 font-mono mt-0.5">{sub}</div>}
    </Link>
  );
}

function statusLabel(s: TaxYear['status']) {
  return s === 'open' ? 'offen' : s === 'locked' ? 'gesperrt' : s === 'exported' ? 'exportiert' : 'archiviert';
}
function exportStatusLabel(s: TaxEvidenceExport['status']) {
  return s === 'preparing' ? 'in Vorb.' : s === 'ready' ? 'bereit' : s === 'downloaded' ? 'geladen' : 'fehler';
}
function classColor(s: TaxDocument['classification_status']) {
  return s === 'classified' ? 'text-emerald-300' : s === 'needs_review' ? 'text-amber-300' : 'text-titanium-400';
}

export function Loader() {
  return <div className="flex items-center gap-2 text-titanium-400 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Lade …</div>;
}
